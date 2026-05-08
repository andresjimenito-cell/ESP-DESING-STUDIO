
import { EspPump, SystemParams, PipeData, EspMotor, SurveyPoint, ScenarioData, NodalSystemPoint, NodalPerformance, NodeProperties } from './types';
import * as PVT from './pvt'; // Import new engine
import { utils, writeFile } from 'xlsx';

// --- UTILITY FUNCTIONS ---

export const getDownloadFilename = (params: SystemParams, pump?: EspPump | null, suffix: string = "") => {
    const well = (params.metadata.wellName || 'WELL').replace(/[\s\W]+/g, '_');
    const model = (pump?.model || '').replace(/[\s\W]+/g, '_');
    const mfg = (pump?.manufacturer || '').replace(/[\s\W]+/g, '_');

    let parts = [well];
    if (model) parts.push(model);
    if (mfg) parts.push(mfg);
    if (suffix) parts.push(suffix);

    // Sanitize and join
    return parts.filter(Boolean).join('_');
};

export const getDesignStyle = (pump: any, index: number) => {
    const m = (pump?.manufacturer || '').toUpperCase();
    let color = '#3b82f6'; // Default Blue

    if (m.includes('BAKER') || m.includes('BH') || m.includes('BHGE')) color = '#22c55e'; // Green
    else if (m.includes('NOVOMET')) color = '#0ea5e9'; // Celeste
    else if (m.includes('SLB') || m.includes('REDA') || m.includes('SCHLUMBERGER')) color = '#2563eb'; // Blue
    else if (m.includes('HALLIBURTON')) color = '#ef4444'; // Red
    else if (m.includes('LEVARE')) color = '#8b5cf6'; // Violet
    else if (m.includes('ALK') || m.includes('ALKHORAYEF')) color = '#eab308'; // Yellow

    // Fallback if index is provided and pump is null
    const label = pump?.model
        ? `${pump.model} (${pump.manufacturer})`
        : `Design ${String.fromCharCode(65 + (index % 26))}`;

    return {
        b: color,
        bg: `${color}1a`, // 10% opacity
        label,
        t: label // Compatibility
    };
};

export const interpolateTVD = (md: number, survey: SurveyPoint[]): number => {
    if (!survey || survey.length === 0) return md;
    if (md <= survey[0].md) return survey[0].tvd;
    const last = survey[survey.length - 1];
    if (md >= last.md) {
        if (survey.length > 1) {
            const prev = survey[survey.length - 2];
            const dMD = last.md - prev.md;
            if (dMD > 0) {
                const slope = (last.tvd - prev.tvd) / dMD;
                return last.tvd + (md - last.md) * slope;
            }
        }
        return last.tvd;
    }
    for (let i = 0; i < survey.length - 1; i++) {
        const p1 = survey[i];
        const p2 = survey[i + 1];
        if (md >= p1.md && md <= p2.md) {
            const fraction = (md - p1.md) / (p2.md - p1.md);
            return p1.tvd + fraction * (p2.tvd - p1.tvd);
        }
    }
    return md;
};

export const geToSalinity = (sg: number): number => {
    if (sg <= 1.0) return 0;
    return (sg - 1) * 1400000;
};

export const salinityToGE = (ppm: number): number => {
    return 1 + (ppm / 1400000);
};

// Wrapper for legacy calls (if any remain)
export const calculateSolutionGOR = (P: number, T: number, api: number, yg: number, method: string = 'Standing'): number => {
    // Construct minimal object for PVT call
    return PVT.calcRs(P, T, { apiOil: api, geGas: yg, correlations: { pbRs: method } } as any);
};

// --- HYDRAULIC CALCULATIONS ---

const calculateReynolds = (rho: number, v: number, d: number, mu: number): number => {
    if (mu <= 0) return 0;
    // rho (lb/ft3), v (ft/s), d (ft), mu (cp)
    // Re = 1488 * rho * v * d / mu_cp
    const mu_lb_ft_s = mu * 0.000671969;
    return (rho * v * d) / mu_lb_ft_s;
};

const calculateFrictionFactor = (Re: number, roughness: number, diameter: number): number => {
    if (Re < 2000) return 64 / Math.max(1, Re);
    const relRough = roughness / diameter;
    const term = Math.pow(relRough / 3.7, 1.11) + (6.9 / Re);
    const invSqrtF = -1.8 * Math.log10(term);
    return Math.pow(1 / invSqrtF, 2);
};

// --- AUTOMATIC PVT CORRECTION ---
export const enforcePVTConsistency = (params: SystemParams): { updated: SystemParams, corrected: boolean, minGor: number } => {
    const { pb, apiOil, geGas, correlations } = params.fluids;
    const tAvg = (params.surfaceTemp + params.bottomholeTemp) / 2;
    const requiredRs = PVT.calcRs(pb, tAvg, params.fluids);

    let corrected = false;
    const newParams = JSON.parse(JSON.stringify(params));

    if (pb > 100 && newParams.fluids.gor < requiredRs * 0.05) {
        newParams.fluids.gor = Math.ceil(requiredRs);
        const wc = newParams.fluids.waterCut / 100;
        newParams.fluids.glr = newParams.fluids.gor * (1 - wc);
        corrected = true;
    }

    return { updated: newParams, corrected, minGor: requiredRs };
}

export const calculateAOF = (sys: SystemParams): number => {
    const pStatic = sys.inflow.pStatic || 0;
    const ip = sys.inflow.ip || 0;
    if (sys.inflow.model === 'Vogel') return (ip * pStatic) / 1.8;
    return ip * pStatic;
};

export const calculatePwf = (q: number, sys: SystemParams): number => {
    const pStatic = sys.inflow.pStatic || 0;
    const ip = sys.inflow.ip > 0 ? sys.inflow.ip : 0.001;
    const safeQ = Math.max(0, q || 0);

    if (sys.inflow.model === 'Vogel' || sys.inflow.model === 'Vogel (Water Correction)') {
        // Vogel (1968): q/qmax = 1 - 0.2(Pwf/Pr) - 0.8(Pwf/Pr)^2
        // Rearranged as quadratic in x = Pwf/Pr:
        //   0.8x^2 + 0.2x + (q/qmax - 1) = 0
        // AOF (qmax at Pwf=0): qmax = IP * Pr / 1.8 (Fetkovich derivation)
        const qMax = (ip * pStatic) / 1.8;
        if (qMax <= 0) return pStatic;
        if (safeQ >= qMax) return 0;
        const ratio = safeQ / qMax;
        // Quadratic: 0.8x^2 + 0.2x - (1 - ratio) = 0
        const a = 0.8, b = 0.2, c = -(1 - ratio);
        const disc = b * b - 4 * a * c;
        if (disc < 0) return 0;
        const x = (-b + Math.sqrt(disc)) / (2 * a); // positive root
        return Math.max(0, Math.min(pStatic, x * pStatic));
    } else {
        // Darcy (Linear PI): Pwf = Pr - q/IP
        return Math.max(0, pStatic - (safeQ / ip));
    }
}

export const generateIPRData = (params: SystemParams) => {
    const qMax = calculateAOF(params);
    const data = [];
    const steps = 40;
    const limit = qMax > 0 ? qMax : 1000;
    for (let i = 0; i <= steps; i++) {
        const q = (limit / steps) * i;
        const pwf = calculatePwf(q, params);
        data.push({ flow: Math.round(q), pressure: Math.max(0, pwf) });
    }
    return data;
};

export const calculateOperatingRange = (pump: EspPump, targetFrequency: number) => {
    const baseFreq = pump.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
    const ratio = targetFrequency / baseFreq;
    return {
        minRate: pump.minRate * ratio,
        maxRate: pump.maxRate * ratio,
        bepRate: pump.bepRate * ratio
    };
};

export const calculateFluidProperties = (pip: number, temp: number, params: SystemParams) => {
    // RIGOROUS PROPERTIES USING SUBPUMP MATCHING PVT ENGINE
    const wc = params.fluids.waterCut / 100;
    const yg = params.fluids.geGas;

    // 1. Calculate Rs & Pb
    const Rs = PVT.calcRs(pip, temp, params.fluids);

    // 2. Calculate Bo & Bw
    const Bo = PVT.calcBo(pip, temp, Rs, params.fluids);
    const Bw = PVT.calcWaterBo(pip, temp);

    // 3. Calculate Densities (lb/ft3) -> Katz for Oil, Beggs for Water/Gas
    const rho_oil = PVT.calcOilDensity(pip, temp, Rs, Bo, params.fluids);
    const rho_water = PVT.calcWaterDensity(params.fluids.geWater, Bw);

    const Z = PVT.calcZFactor(pip, temp, yg);
    const rho_gas = PVT.calcGasDensity(pip, temp, Z, yg);

    // 4. Converting to SGs
    const oilSG = rho_oil / 62.4;
    const waterSG = rho_water / 62.4;
    const gasSG = rho_gas / 62.4;

    // 5. Z-Factor & Bg
    const Bg = PVT.calcBg(pip, temp, Z); // bbl/scf

    // 6. Volumetrics for Void Fraction
    const Gor_prod = params.fluids.gor;
    const FreeGas = Math.max(0, Gor_prod - Rs);

    const volOilInSitu = (1 - wc) * Bo;
    const volWaterInSitu = wc * Bw;
    const volGasInSitu = (1 - wc) * FreeGas * Bg;

    const volTotalInSitu = volOilInSitu + volWaterInSitu + volGasInSitu;

    // ** VOID FRACTION (GAS PERCENTAGE BY VOLUME) **
    const voidFraction = volTotalInSitu > 0 ? volGasInSitu / volTotalInSitu : 0;
    const mixDensity = volTotalInSitu > 0
        ? (rho_oil * volOilInSitu + rho_water * volWaterInSitu + rho_gas * volGasInSitu) / volTotalInSitu
        : 62.4;
    let mixSG = mixDensity / 62.4;

    // --- SOLIDS CORRECTION (Disabled for Power/SG calculations as per user request) ---
    // if (params.fluids.sandCut > 0) { ... }


    // Viscosities & Tensions
    const viscOil = PVT.calcOilViscosity(pip, temp, Rs, params.fluids);
    const viscWater = PVT.calcWaterViscosity(temp, params.fluids.salinity);
    const tensionOil = PVT.calcOilSurfaceTension(temp, params.fluids.apiOil);
    const tensionWater = PVT.calcWaterSurfaceTension(temp);

    return {
        gradMix: mixSG * 0.433,
        viscMix: viscOil * (1 - wc) + viscWater * wc, // Simple mix
        oilSG, waterSG, mixSG,
        voidFraction, volGasInSitu,
        volLiquidInSitu: volOilInSitu + volWaterInSitu,
        Bo, Bw, Z, Rs, rhoMix: mixDensity,
        surfaceTensionOil: tensionOil,
        surfaceTensionWater: tensionWater
    };
};

export const calculateBaseHead = (flow: number, pump: EspPump): number => {
    if (!pump) return 0;
    const { h0 = 0, h1 = 0, h2 = 0, h3 = 0, h4 = 0, h5 = 0, h6 = 0, stages = 1 } = pump;
    // Truncate (don't flatline) when exceeding characterizeable flow
    const maxQ = pump.maxGraphRate > 0 ? pump.maxGraphRate * 1.05 : (pump.maxRate > 0 ? pump.maxRate * 1.1 : 1e6);
    if (flow > maxQ) return 0;
    const flowVal = isNaN(flow) ? 0 : Math.max(flow, 0);
    const headPerStage = (h0 || 0) + (h1 || 0) * flowVal + (h2 || 0) * Math.pow(flowVal, 2) + (h3 || 0) * Math.pow(flowVal, 3) + (h4 || 0) * Math.pow(flowVal, 4) + (h5 || 0) * Math.pow(flowVal, 5) + (h6 || 0) * Math.pow(flowVal, 6);

    // Safety: Head curves should never increase at the far right
    let result = Math.max(0, headPerStage);
    // REMOVED: Flatline at maxRate to avoid "angle and constant" behavior
    // If polynomial extrapolates weirdly, users prefer a break or natural drop
    return (isNaN(result) ? 0 : result) * (stages || 1);
};

export const calculateBasePowerPerStage = (flow: number, pump: EspPump): number => {
    if (!pump) return 0;
    const { p0 = 0, p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0, p6 = 0 } = pump;
    const maxQ = pump.maxGraphRate > 0 ? pump.maxGraphRate * 1.05 : (pump.maxRate > 0 ? pump.maxRate * 1.1 : 1e6);
    if (flow > maxQ) return 0;
    const flowVal = isNaN(flow) ? 0 : Math.max(flow, 0);
    const powerPerStage = (p0 || 0) + (p1 || 0) * flowVal + (p2 || 0) * Math.pow(flowVal, 2) + (p3 || 0) * Math.pow(flowVal, 3) + (p4 || 0) * Math.pow(flowVal, 4) + (p5 || 0) * Math.pow(flowVal, 5) + (p6 || 0) * Math.pow(flowVal, 6);

    // Safety: Power curves should generally not decrease at the far right of the curve 
    // unless it's a very specific pump. For simulation stability, we clamp to the peak 
    // or prevent sharp drops beyond catalog max.
    let result = Math.max(0, powerPerStage);
    if (pump.maxRate > 0 && flowVal > pump.maxRate) {
        // Calculate power at maxRate using ALL coefficients
        const pMax = (p0 || 0) + (p1 || 0) * pump.maxRate + (p2 || 0) * Math.pow(pump.maxRate, 2) + (p3 || 0) * Math.pow(pump.maxRate, 3) + (p4 || 0) * Math.pow(pump.maxRate, 4) + (p5 || 0) * Math.pow(pump.maxRate, 5) + (p6 || 0) * Math.pow(pump.maxRate, 6);
        // If the polynomial starts dropping off-catalog, don't let it fall below ~95% of pMax
        result = Math.max(result, pMax * 0.95);
    }
    return isNaN(result) ? 0 : result;
}

export const calculateAffinityHead = (targetFlow: number, targetFreq: number, baseFreq: number, pump: EspPump): number | null => {
    if (baseFreq === 0) return null;
    const ratio = targetFreq / baseFreq;
    if (ratio === 0) return null;
    const baseFlow = targetFlow / ratio;
    if (pump.maxGraphRate > 0 && baseFlow > pump.maxGraphRate * 1.5) return null;
    const baseHead = calculateBaseHead(baseFlow, pump);
    const result = baseHead * Math.pow(ratio, 2);
    return result > 2 ? result : null;
}

export const calculateBhpAtPoint = (flowActual: number, freqActual: number, baseFreq: number, pump: EspPump, sg: number): number => {
    const ratio = freqActual / baseFreq;
    const flowBase = flowActual / ratio;

    const hasPowerCoeffs = (Math.abs(pump.p0) + Math.abs(pump.p1) + Math.abs(pump.p2)) > 0.0000001;

    let hpTotal: number;

    if (hasPowerCoeffs) {
        const powerBasePerStage = calculateBasePowerPerStage(flowBase, pump);
        const powerActualPerStage = powerBasePerStage * Math.pow(ratio, 3) * sg;
        hpTotal = powerActualPerStage * (pump.stages || 1);
    } else {
        const headBase = calculateBaseHead(flowBase, pump);
        const headActual = headBase * Math.pow(ratio, 2);
        const hydraulicHp = (flowActual * headActual * sg) / 135770;
        const bepActual = pump.bepRate * ratio;
        let effFactor = 0.1;
        if (bepActual > 0) {
            const deviation = (flowActual - bepActual) / (bepActual * 1.5);
            effFactor = 1 - Math.pow(deviation, 2);
        }
        effFactor = Math.max(0.1, Math.min(1.0, effFactor));
        let maxEff = pump.maxEfficiency || 70;
        if (maxEff > 0 && maxEff <= 1) maxEff *= 100;
        const estEfficiencyDec = (maxEff / 100) * effFactor;
        const finalEff = estEfficiencyDec > 0 ? estEfficiencyDec : 0.01;
        hpTotal = hydraulicHp / finalEff;
    }

    return Math.max(0, hpTotal);
}

// --- NEW FUNCTION: CALCULATE MOTOR PARAMETERS FROM COEFFS ---
export const calculateMotorPoly = (loadPct: number, motor: EspMotor) => {
    // Coefficients from Excel (Novomet/Baker) are typically designed for x as DECIMAL (0.0 to 1.0)
    // loadPct is passed as 0 to 100+, so we convert to fractional load.
    const x = loadPct / 100;
    const calcPoly = (c0 = 0, c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0) => {
        return (c0 || 0) + (c1 || 0) * x + (c2 || 0) * Math.pow(x, 2) + (c3 || 0) * Math.pow(x, 3) + (c4 || 0) * Math.pow(x, 4) + (c5 || 0) * Math.pow(x, 5);
    };

    // 1. Efficiency
    let eff = 0;
    if (motor.e0 !== undefined && motor.e1 !== undefined) {
        eff = calcPoly(motor.e0, motor.e1, motor.e2, motor.e3, motor.e4, motor.e5);
    } else {
        // Fallback generic curve
        eff = 90 * (1 - Math.exp(-x * 10)); // Simple asymptotic
    }

    // 2. Power Factor
    let pf = 0;
    if (motor.p0 !== undefined && motor.p1 !== undefined) {
        pf = calcPoly(motor.p0, motor.p1, motor.p2, motor.p3, motor.p4, motor.p5);
    } else {
        // Fallback generic curve
        pf = 88 * (1 - Math.exp(-x * 8));
    }

    // 3. Amps (% of Nameplate)
    let ampsPct = 0;
    if (motor.a0 !== undefined && motor.a1 !== undefined) {
        ampsPct = calcPoly(motor.a0, motor.a1, motor.a2, motor.a3, motor.a4, motor.a5);
    } else {
        // Fallback: Linear with offset for magnetizing current
        ampsPct = 30 + (x * 0.7);
    }

    // 4. RPM
    let rpm = 0;
    if (motor.r0 !== undefined && motor.r1 !== undefined) {
        rpm = calcPoly(motor.r0, motor.r1, motor.r2, motor.r3, motor.r4, motor.r5);
    } else {
        // Fallback: Slip curve (3600 sync)
        rpm = 3600 - (x * 1.5); // 3450 at 100% load
    }

    // --- NORMALIZATION: Detect decimal (0-1) vs percentage (1-100) coefficients ---
    // Novomet and some modern catalogs use decimals (0.92), others use percentage (92).
    let finalEff = Math.max(0, eff);
    let finalPf = Math.max(0, pf);
    let finalRpm = Math.max(0, rpm);

    if (finalEff > 0 && finalEff <= 1.0) finalEff *= 100;
    if (finalPf > 0 && finalPf <= 1.0) finalPf *= 100;
    // Handle RPM if expressed in krpm (e.g., 3.6 instead of 3600)
    if (finalRpm > 0 && finalRpm < 10) finalRpm *= 1000;

    return { eff: finalEff, pf: finalPf, ampsPct: Math.max(0, ampsPct), rpm: finalRpm };
};

const getMotorPerformance = (loadFactor: number, nameplateEff: number = 0.93, nameplatePF: number = 0.94) => {
    const lf = Math.max(0.05, loadFactor);
    const effCurveShape = 1 - Math.exp(-lf * 15);
    let currentEff = nameplateEff * effCurveShape;
    const pfCurveShape = 1 - Math.exp(-lf * 12);
    let currentPF = nameplatePF * pfCurveShape;
    if (lf > 1.25) {
        currentEff -= (lf - 1.25) * 0.1;
    }
    return {
        eff: Math.max(0.1, Math.min(0.98, currentEff)),
        pf: Math.max(0.1, Math.min(0.99, currentPF))
    };
};

// --- NODAL ANALYSIS FUNCTIONS ---

// 1. Calculate rigorous node properties (Surface, Intake, Discharge)
const calculateNodeProperties = (pressure: number, temp: number, flowSurface: number, params: SystemParams): NodeProperties => {
    const fProps = calculateFluidProperties(pressure, temp, params);

    // Deconstruct
    const { Bo, Bw, Z, Rs, mixSG, oilSG, waterSG, rhoMix, voidFraction } = fProps;

    const wc = params.fluids.waterCut / 100;
    const gor = params.fluids.gor;

    // Surface Rates
    const qOilSurf = flowSurface * (1 - wc);
    const qWaterSurf = flowSurface * wc;

    // In-situ Rates
    const qOil = qOilSurf * Bo;
    const qWater = qWaterSurf * Bw;

    // Free Gas
    const freeGasScf = Math.max(0, (gor - Rs) * qOilSurf);
    // Bg in bbl/scf
    const Bg = PVT.calcBg(pressure, temp, Z);
    const qGas = freeGasScf * Bg;

    const qTotalLiq = qOil + qWater;
    const qTotalMix = qTotalLiq + qGas;

    // Mixture Viscosity (Simplified)
    const mu_oil = PVT.calcOilViscosity(pressure, temp, Rs, params.fluids);
    const mu_water = PVT.calcWaterViscosity(temp, params.fluids.salinity);
    const mu_mix = mu_oil * (1 - wc) + mu_water * wc; // Basic weighting

    return {
        pressure,
        temperature: temp,
        oilRate: qOil,
        waterRate: qWater,
        gasRate: qGas,
        freeGasPct: (qGas / qTotalMix) * 100,
        totalLiquidRate: qTotalLiq,
        sgLiquid: (oilSG * (qOil / qTotalLiq) + waterSG * (qWater / qTotalLiq)),
        sgMixture: mixSG,
        densityLiquid: (oilSG * 62.4 * (qOil / qTotalLiq) + waterSG * 62.4 * (qWater / qTotalLiq)),
        densityMixture: rhoMix,
        viscosityMixture: mu_mix,
        solGor: Rs,
        solGwr: pressure * 0.015, // Simplified GWR correlation (approx 1.5 scf/bbl at 100 psi)
        fvfLiquid: Bo * (1 - wc) + Bw * wc, // Wtd avg
        fvfMixture: qTotalMix / flowSurface,
        zFactor: Z,
        surfaceTensionOil: fProps.surfaceTensionOil,
        surfaceTensionWater: fProps.surfaceTensionWater
    };
};

// 2. Generate System Curve Data (Iterative)
const generateNodalSystemData = (sys: SystemParams, pump: EspPump): NodalSystemPoint[] => {
    const qMax = calculateAOF(sys);
    const steps = 8;
    const stepSize = qMax / 10; // Approx range

    const data: NodalSystemPoint[] = [];

    // Points 1-8 logic (SubPump style)
    for (let i = 1; i <= 8; i++) {
        const q = i * stepSize;

        // 1. Calculate Pwf
        const pwf = calculatePwf(q, sys);
        if (pwf < 0) continue;

        // 2. Calculate PIP (Pwf - Hydrostatic Below)
        const pumpTVD = interpolateTVD(sys.pressures.pumpDepthMD, sys.survey);
        const perfsTVD = interpolateTVD(sys.wellbore.midPerfsMD, sys.survey);
        const propsIntake = calculateFluidProperties(pwf, sys.bottomholeTemp, sys); // Approx using Pwf for props
        const hydroBelow = (Math.max(0, perfsTVD - pumpTVD)) * propsIntake.gradMix;
        const pip = Math.max(0, pwf - hydroBelow);

        // 3. Calculate Required Discharge (Tubing Head + Friction + Lift)
        const sysHead = calculateSystemTDH(q, sys); // Total TDH required

        // Convert TDH to Pressure Delta
        const dP = sysHead * propsIntake.gradMix;
        const pDischarge = pip + dP;

        // Convert Pressures to Heads (feet) relative to Intake Density
        const pipHead = pip / propsIntake.gradMix;
        const tubingHead = pDischarge / propsIntake.gradMix;

        // Volumetrics for Avg Pump Rate
        const nodeProps = calculateNodeProperties(pip, sys.bottomholeTemp, q, sys);
        const ratePump = nodeProps.oilRate + nodeProps.waterRate + nodeProps.gasRate;
        const rateLiquid = nodeProps.oilRate + nodeProps.waterRate;

        // Fluid Level (approx)
        const submergencePsi = Math.max(0, pip - (sys.pressures.phc || 0));
        const subFt = submergencePsi / propsIntake.gradMix;
        const fluidLevel = Math.max(0, sys.pressures.pumpDepthMD - subFt);

        data.push({
            point: i,
            rateSurface: q,
            ratePump: ratePump,
            tubingHead: tubingHead,
            pipHead: pipHead,
            tdh: sysHead,
            fluidLevel: fluidLevel
        });
    }

    return data;
};

// --- RIGOROUS SYSTEM CURVE ---
export const calculateSystemTDH = (flow: number, sys: SystemParams): number => {
    const q = Math.max(0, flow || 0);

    // 1. SETUP
    const pumpMD = sys.pressures.pumpDepthMD || 0;
    const pumpTVD = interpolateTVD(pumpMD, sys.survey);
    // THP = wellhead flowing pressure (psi)
    const thp = sys.pressures.pht || 50;

    // 2. FLUID SG — SubPump convention: TDH is in feet of LIQUID (no free gas)
    //    Gas effect on head is applied as a degradation factor to the pump curve separately.
    const waterSG = sys.fluids.geWater || 1.07;
    const api = sys.fluids.apiOil || 35;
    const oilSg = 141.5 / (131.5 + api);
    const wc = Math.min(1, Math.max(0, (sys.fluids.waterCut || 0) / 100));
    let mixSgLiq = (waterSG * wc) + (oilSg * (1 - wc));
    // Solids Correction Disabled for SG

    const gradLiq = 0.433 * mixSgLiq; // psi/ft — used for all head conversions

    // 3. PIP = Pwf minus hydrostatic from perforations to pump
    const pwf = calculatePwf(q, sys);
    const midPerfsTVD = interpolateTVD(sys.wellbore.midPerfsMD || pumpMD, sys.survey);
    const dTVD_below = Math.max(0, midPerfsTVD - pumpTVD);
    const pipRaw = pwf - dTVD_below * gradLiq;

    // PHYSICAL LIMIT: If intake pressure is exhausted, the well cannot deliver flow to the pump.
    // Returning NaN ensures the chart curve terminates naturally instead of flatlining.
    if (pipRaw <= 0) return NaN;
    
    const pip = Math.max(1, pipRaw);

    // 4. Static head case (zero/very low flow) — no friction
    if (q < 0.1) {
        // TDH (ft liquid) = THP_head + pump_depth - PIP_head
        const tdh_static = thp / gradLiq + pumpTVD - pip / gradLiq;
        return Math.max(0, tdh_static);
    }

    // 5. Friction in tubing above pump (Darcy-Weisbach)
    //    Uses in-situ volumetric flow rate (liquid + free gas)
    //    Capped pAvg floor at 50 psi for property stability to avoid "explosion" at low PIP
    const pAvg = Math.max(50, (pip + thp) / 2);
    const tAvg = ((sys.surfaceTemp || 80) + (sys.bottomholeTemp || 150)) / 2;
    const yg = Math.max(0.55, sys.fluids.geGas || 0.7);

    const Rs_avg = PVT.calcRs(pAvg, tAvg, sys.fluids);
    const Bo_avg = Math.max(1.0, PVT.calcBo(pAvg, tAvg, Rs_avg, sys.fluids));
    const Z_avg = Math.max(0.4, Math.min(1.5, PVT.calcZFactor(pAvg, tAvg, yg)));
    const Bg_avg = PVT.calcBg(pAvg, tAvg, Z_avg); // bbl/scf

    const gor = sys.fluids.gor || 0;
    const freeGas = Math.max(0, gor - Rs_avg); // scf/STB free gas at pump

    // In-situ volumetric flow (bbl/day)
    const qOil_sc = q * (1 - wc);
    const qLiq_insitu = qOil_sc * Bo_avg + q * wc;                // liquid bbl/d in-situ
    const qGas_insitu = qOil_sc * freeGas * Bg_avg;               // gas bbl/d in-situ
    const qMix_insitu = Math.max(0.001, qLiq_insitu + qGas_insitu); // total bbl/d

    // Convert to ft³/s
    const CONV = 5.615 / 86400; // bbl/d → ft³/s
    const idInch = sys.wellbore.tubing?.id > 0 ? sys.wellbore.tubing.id : 2.441;
    const idFt = idInch / 12;
    const areaSqFt = Math.PI * (idFt / 2) * (idFt / 2);
    const velMix_fps = (qMix_insitu * CONV) / areaSqFt; // ft/s

    // In-situ mixture density for friction (lb/ft³)
    const lambdaG = Math.max(0, Math.min(0.95, qGas_insitu / qMix_insitu));
    const holdup = Math.max(1 - lambdaG, Math.pow(1 - lambdaG, 0.5)); // Griffith simplified
    const rhoOil = (62.4 * oilSg + 0.0136 * Rs_avg * yg) / Bo_avg;
    const rhoWat = 62.4 * waterSG;
    const rhoLiq = (rhoOil * qOil_sc * Bo_avg + rhoWat * q * wc) / Math.max(0.001, qLiq_insitu);
    const rhoGas = (28.96 * yg * pAvg) / (10.73 * (tAvg + 460) * Z_avg);
    let rhoMix = Math.max(5, rhoLiq * holdup + rhoGas * (1 - holdup));
    // Solids Correction Disabled for rhoMix


    // Mixture viscosity (simplified weighted average in cp)
    const mu_oil = Math.min(1000, PVT.calcOilViscosity(pAvg, tAvg, Rs_avg, sys.fluids));
    const mu_water = Math.min(10, PVT.calcWaterViscosity(tAvg, sys.fluids.salinity || 0));
    let viscMix_cp = Math.max(0.1, mu_oil * (1 - wc) * holdup + mu_water * wc * holdup + 0.015 * (1 - holdup));
    if (!isFinite(viscMix_cp)) viscMix_cp = 1.0;

    const Re = calculateReynolds(rhoMix, velMix_fps, idFt, viscMix_cp);
    const roughnessFt = sys.wellbore.tubing?.roughness || 0.000065;
    const f = calculateFrictionFactor(Re, roughnessFt, idFt);

    // Darcy-Weisbach friction head in feet of LIQUID (for consistency with TDH units)
    const g = 32.174; // ft/s²
    const frictionHead_ft_mix = f * (pumpMD / idFt) * (velMix_fps * velMix_fps) / (2 * g);
    // Convert ft-mix to ft-liquid: multiply by SG_mix/SG_liquid
    const frictionHead_ft_liq = frictionHead_ft_mix * (rhoMix / 62.4) / mixSgLiq;

    // 6. TDH (SubPump convention — feet of liquid):
    //    TDH = THP/grad + pumpTVD + friction_ft - PIP/grad
    const tdh = thp / gradLiq + pumpTVD + frictionHead_ft_liq - pip / gradLiq;

    // If physics fails (NaN), return NaN so the chart stops drawing instead of flatlining
    if (isNaN(tdh) || !isFinite(tdh)) return NaN;
    return tdh;
};

export const calculatePIP = (q: number, sys: SystemParams): number => {
    const pwf = calculatePwf(q, sys);
    // Gradient from perfs to pump (MD/TVD)
    const pumpMD = sys.pressures?.pumpDepthMD || sys.totalDepthMD || 0;
    const perfsMD = sys.wellbore?.midPerfsMD || sys.totalDepthMD || 0;

    // Attempt TVD interpolation
    const pumpTVD = interpolateTVD(pumpMD, sys.survey);
    const perfsTVD = interpolateTVD(perfsMD, sys.survey);

    const deltaTVD = Math.max(0, perfsTVD - pumpTVD);
    const fluidProps = calculateFluidProperties(pwf, sys.bottomholeTemp, sys);
    
    // Return raw PIP (can be negative) to allow callers to detect physical exhaustion
    return pwf - (deltaTVD * 0.433 * fluidProps.mixSG);
};

export const calculatePDP = (q: number, sys: SystemParams): { pdp: number } => {
    const tdh = calculateSystemTDH(q, sys);
    const pip = calculatePIP(q, sys);

    // SubPump accounts for progressive gas compression throughout the pump.
    // We average the gas-heavy intake density with the almost-pure liquid discharge density.
    const intakeProps = calculateFluidProperties(pip, sys.bottomholeTemp, sys);
    const waterSG = sys.fluids.geWater || 1.07;
    const oilSg = 141.5 / (131.5 + (sys.fluids.apiOil || 35));
    const wc = Math.min(1, Math.max(0, (sys.fluids.waterCut || 0) / 100));
    const pureLiqSg = (waterSG * wc) + (oilSg * (1 - wc));

    // As fluid compresses, void fraction approaches 0, so SG approaches pureLiqSg
    const avgPumpSg = (intakeProps.mixSG + pureLiqSg) / 2;

    return { pdp: pip + (tdh * 0.433 * avgPumpSg) };
};

// --- MASTER CALCULATION FUNCTION ---
export const calculateSystemResults = (
    matchFlow: number | null,
    matchHead: number | null,
    sys: SystemParams,
    pump: EspPump,
    frequency: number
): any => {
    const qMax = calculateAOF(sys);

    // Handle Zero Flow / Deadhead Logic
    let q = Math.max(0, matchFlow || 0);
    let tdh = Math.max(0, matchHead || calculateSystemTDH(q, sys));

    const stages = pump?.stages > 0 ? pump.stages : 1;
    const baseFreq = pump?.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
    const wc = (sys.fluids.waterCut || 0) / 100;

    // --- PIP & PDP ---
    const pwf = calculatePwf(q, sys);
    const pip = calculatePIP(q, sys);
    const pdp = calculatePDP(q, sys).pdp;

    // --- GAS ANALYSIS ---
    const intakeTemp = sys.bottomholeTemp || 150;
    const fProps = calculateFluidProperties(pip, intakeTemp, sys);
    const fg = fProps.voidFraction || 0;
    let gasStatus: 'Stable' | 'Separator Required' | 'Gas Lock Risk' = 'Stable';
    let gasDegradation = 0;
    if (fg > 0.35) { gasStatus = 'Gas Lock Risk'; gasDegradation = 0.40; }
    else if (fg > 0.10) { gasStatus = 'Separator Required'; gasDegradation = 0.15; }

    const mixSG = fProps.mixSG > 0 ? fProps.mixSG : 1.0;
    // For motor loading, we use a more conservative SG (Liquid SG) to ensure 
    // that gas interference doesn't hide a potential mechanical overload. 
    // If the pump is full of liquid, the load is highest.
    const oilSG = fProps.oilSG || 0.85;
    const waterSG = fProps.waterSG || 1.0;
    const liquidSG = (oilSG * (1 - wc) + waterSG * wc);
    const motorLoadSG = Math.max(liquidSG, mixSG);

    // Fluid Level
    const chp = sys.pressures.phc || 0;
    const submergencePsi = Math.max(0, pip - chp);
    const submergenceFt = submergencePsi / (0.433 * mixSG);
    const fluidLevelMD = Math.max(0, sys.pressures.pumpDepthMD - submergenceFt);

    const headPerStage = stages > 0 ? tdh / stages : tdh;

    // --- HP CALCULATION ---
    // 1. Conservative BHP for Motor Load & Electrical Sizing (Liquid SG)
    let hpTotal = calculateBhpAtPoint(q, frequency, baseFreq, pump, motorLoadSG);
    if (isNaN(hpTotal) || !isFinite(hpTotal)) hpTotal = 0.1;

    // 2. Actual BHP for Efficiency Reporting (Mixture SG)
    let hpActual = calculateBhpAtPoint(q, frequency, baseFreq, pump, mixSG);
    if (isNaN(hpActual) || !isFinite(hpActual)) hpActual = 0.1;

    const hydraulicHp = (q * tdh * mixSG) / 135770;
    let pumpEff = hpActual > 0 ? (Math.max(0, hydraulicHp) / hpActual) * 100 : 0;
    if (isNaN(pumpEff)) pumpEff = 0;

    // Use selected motor HP if available, fall back to manually entered motorHp
    const motorHpNameplate = (sys.selectedMotor?.hp ?? sys.motorHp ?? 0) > 0
        ? (sys.selectedMotor?.hp ?? sys.motorHp)
        : 1;
    // Available HP at VSD frequency
    // Standard ESP motors are constant torque below base frequency (60Hz) 
    // and constant horsepower above base frequency (voltage clamp).
    const motorBaseHz = 60;
    const isOverFreq = frequency > motorBaseHz;
    // In over-voltage operation (constant V/f), HP increases linearly with frequency (RPM)
    const availableHp = motorHpNameplate * (frequency / motorBaseHz);

    const loadFactor = hpTotal / Math.max(0.1, availableHp);
    const motorLoadPct = loadFactor * 100;

    const isPMM = sys.selectedMotor?.model?.includes('PMM') || sys.selectedMotor?.series?.includes('560');

    // --- MOTOR PERFORMANCE ---
    let motorEffDecimal = 0.93;
    let motorPFDecimal = 0.94;
    let motorRPM = 3500 * (frequency / baseFreq);

    if (sys.selectedMotor && sys.selectedMotor.e0 !== undefined) {
        const perf = calculateMotorPoly(motorLoadPct, sys.selectedMotor);
        motorEffDecimal = perf.eff / 100;
        motorPFDecimal = perf.pf / 100;
        motorRPM = perf.rpm * (frequency / baseFreq);
    } else {
        const baseEff = isPMM ? 0.94 : 0.89;
        const basePF = isPMM ? 0.96 : 0.85;
        const mp = getMotorPerformance(loadFactor, baseEff, basePF);
        motorEffDecimal = mp.eff;
        motorPFDecimal = mp.pf;
    }

    const kw = (hpTotal * 0.746) / Math.max(0.5, motorEffDecimal);
    const ratedVolts = sys.selectedMotor?.voltage || (motorHpNameplate * 15);
    // VSD Volts: Linear V/Hz up to 90Hz (specialized over-voltage operation)
    const runVolts = Math.min(ratedVolts * 1.5, (ratedVolts * (frequency / 60)) || 480);

    // Safety check for PF
    const pfFinal = Math.max(0.5, Math.min(0.99, motorPFDecimal));

    let runAmps = 0;
    if (runVolts > 0 && pfFinal > 0) {
        runAmps = (kw * 1000) / (1.732 * runVolts * pfFinal);
    }

    // --- CABLE VOLTAGE DROP ---
    let cableResPer1000 = 0.045; // Default #4 cable
    if (sys.selectedCable && sys.selectedCable.ohmsPer1000ft > 0) {
        cableResPer1000 = sys.selectedCable.ohmsPer1000ft;
    }

    const avgTempF = ((sys.surfaceTemp || 80) + (sys.bottomholeTemp || 150)) / 2;
    const tempCorrection = 1 + ((avgTempF - 77) * 0.00214); // Slightly higher temp coeff for copper
    const effectiveRes = cableResPer1000 * tempCorrection;
    const cableLenKft = (sys.pressures.pumpDepthMD || 0) / 1000;
    const voltDrop = 1.732 * runAmps * effectiveRes * cableLenKft;

    const surfaceVolts = runVolts + voltDrop;
    const surfaceKva = (1.732 * surfaceVolts * runAmps) / 1000;

    // --- VSD CALCULATIONS ---
    const selectedVsd = (sys as any).selectedVSD;
    let vsdEffRaw = (selectedVsd?.efficiency || 96.5); // Lowered from 97.5
    // Normalize decimal to percentage
    if (vsdEffRaw > 0 && vsdEffRaw <= 1.0) vsdEffRaw *= 100;
    const vsdEffDecimal = vsdEffRaw / 100;

    // Exact Surface Power (Motor Real Power + Pure Resistive Cable Losses)
    const cableKw = (3 * (runAmps * runAmps) * effectiveRes * cableLenKft) / 1000;
    const surfaceKw = kw + cableKw;

    const systemKw = surfaceKw / vsdEffDecimal;
    const systemKva = systemKw / 0.90; // Lowered from 0.92 to be more 'demanding'

    const tbgId = sys.wellbore.tubing?.id || 2.441;
    const areaSqFt = (Math.PI * Math.pow(tbgId / 12, 2)) / 4;
    const velocity = areaSqFt > 0 ? (q * 5.615 / 86400) / areaSqFt : 0;

    // --- MOTOR TEMPERATURE & THRUST ---
    const qFlow = Math.max(10, q);
    const w_c = wc;
    const Cp = 0.5 * (1 - w_c) + 1.0 * w_c;
    const motorEffValue = motorEffDecimal;
    const heatLossKw = kw * (1 - motorEffValue);
    const heatGeneratedBtuHr = heatLossKw * 3412.14;
    const massFlowLbHr = qFlow * 14.6 * mixSG;
    const tempRise = massFlowLbHr > 0 ? (heatGeneratedBtuHr / (massFlowLbHr * Cp)) : 0;
    const motorT = intakeTemp + (tempRise * 0.85); // 0.85 as a cooling efficiency factor

    const bepAtFreq = (pump?.bepRate || 1000) * (frequency / (pump?.nameplateFrequency || 60));
    const thrustRatio = bepAtFreq > 0 ? (q / bepAtFreq) : 1;
    let thrustStatus = "Normal";
    if (thrustRatio > 1.15) thrustStatus = "Upthrust";
    else if (thrustRatio < 0.75) thrustStatus = "Downthrust";

    // --- SHAFT LOADS ---
    const mechLimits = getEquipmentMechanicalLimits(pump?.series || "");
    const pumpShaftLoad = (hpTotal / mechLimits.pumpLimit) * 100;
    const protectorShaftLoad = (hpTotal / mechLimits.protectorLimit) * 100;
    const motorShaftLoad = (hpTotal / mechLimits.motorLimit) * 100;

    // --- AMP LOADS ---
    const motorNPAmps = sys.selectedMotor?.amps || (motorHpNameplate * 0.8); // Estimate if missing
    const cableMaxAmps = sys.selectedCable?.maxAmps || 100;
    const mleMaxAmps = cableMaxAmps * 0.85; // MLE typically ~15% less ampacity than main cable

    const motorAmpLoad = motorNPAmps > 0 ? (runAmps / motorNPAmps) * 100 : 0;
    const cableAmpLoad = (runAmps / cableMaxAmps) * 100;
    const mleAmpLoad = (runAmps / mleMaxAmps) * 100;

    // Nodal Data Generation
    const nodalPerformance: NodalPerformance = {
        intake: calculateNodeProperties(pip, intakeTemp, q, sys),
        discharge: calculateNodeProperties(pdp, intakeTemp + 10, q, sys),
        surface: calculateNodeProperties(sys.pressures.pht || 50, sys.surfaceTemp || 80, q, sys)
    };

    return {
        flow: q,
        pip,
        pwf,
        sgMixed: mixSG,
        qMax,
        hpTotal,
        hpActual,
        hpPerStage: hpTotal / stages,
        headPerStage,
        effEstimated: pumpEff,
        motorLoad: motorLoadPct,
        motorAmpLoad,
        cableAmpLoad,
        mleAmpLoad,
        pumpShaftLoad,
        protectorShaftLoad,
        motorShaftLoad,
        motorT,
        thrustStatus,
        availableHp,
        requiredMotorHp: hpTotal * 1.1,
        fluidLevel: fluidLevelMD,
        tdh,
        efficiency: pumpEff,
        pdp,
        fluidVelocity: velocity,
        electrical: {
            volts: runVolts,
            surfaceVolts,
            amps: runAmps,
            kva: surfaceKva,
            kw, // Motor terminal kW
            surfaceKw,
            systemKw,
            systemKva,
            pf: motorPFDecimal * 100,
            motorEff: motorEffDecimal * 100,
            vsdEff: vsdEffDecimal * 100,
            voltDrop,
            rpm: motorRPM
        },
        gasAnalysis: {
            voidFraction: fg,
            status: gasStatus,
            degradationFactor: gasDegradation
        },
        nodalPerformance,
        systemCurveData: generateNodalSystemData(sys, pump)
    };
};

export const generateMultiCurveData = (pump: EspPump, system: SystemParams, userFrequency: number, points: number = 60): any[] => {
    const data: any[] = [];
    const baseFreq = pump.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
    const maxFreq = Math.max(70, userFrequency);
    const maxPlotFlow = pump.maxGraphRate > 0
        ? (pump.maxGraphRate * (maxFreq / baseFreq)) * 1.1
        : 1000;
    const step = maxPlotFlow / points;

    const standardFreqs = [30, 40, 50, 60, 70];
    const activeCurves: Record<string, boolean> = { userHz: true };
    standardFreqs.forEach(f => activeCurves[`hz${f}`] = true);

    const headAtMinBase = Math.max(0, calculateBaseHead(pump.minRate, pump));
    const headAtMaxBase = Math.max(0, calculateBaseHead(pump.maxRate, pump));
    let kMin = 0, kMax = 0;
    if (pump.minRate > 0) kMin = headAtMinBase / Math.pow(pump.minRate, 2);
    if (pump.maxRate > 0) kMax = headAtMaxBase / Math.pow(pump.maxRate, 2);

    const MAX_CONE_HZ = 80;
    const maxConeFlowMin = pump.minRate * (MAX_CONE_HZ / baseFreq);
    const maxConeFlowMax = pump.maxRate * (MAX_CONE_HZ / baseFreq);

    const wc = system.fluids.waterCut / 100;
    let mixSG = (system.fluids.geWater * wc) + (141.5 / (131.5 + system.fluids.apiOil) * (1 - wc));

    // Solids Correction Disabled for mixSG in Curve Generation


    for (let i = 0; i <= points; i++) {
        const flow = i * step;
        const point: any = { flow: Number(flow.toFixed(0)) };

        standardFreqs.forEach(freq => {
            const key = `hz${freq}`;
            if (activeCurves[key]) {
                const h = calculateAffinityHead(flow, freq, baseFreq, pump);
                if (h !== null && h > 5) point[key] = Number(h.toFixed(2));
                else { activeCurves[key] = false; point[key] = null; }
            } else { point[key] = null; }
        });

        if (activeCurves.userHz) {
            const hUser = calculateAffinityHead(flow, userFrequency, baseFreq, pump);
            if (hUser !== null && hUser > 5) {
                point.userHz = Number(hUser.toFixed(2));
                if (flow > 0) {
                    const bhp = calculateBhpAtPoint(flow, userFrequency, baseFreq, pump, mixSG);
                    const hhp = (flow * hUser * mixSG) / 135770;
                    let eff = 0;
                    if (bhp > 0) eff = (hhp / bhp) * 100;
                    if (eff > 0 && eff < 100) point.efficiency = Number(eff.toFixed(1));
                    else point.efficiency = null;
                } else point.efficiency = 0;
            } else {
                activeCurves.userHz = false; point.userHz = null; point.efficiency = null;
            }
        }

        // System Curve: SubPump behavior — only plot where the RESERVOIR can deliver
        // (i.e., where Pwf > 0). Beyond AOF, the system curve is undefined.
        const hasPressureData = system.pressures.pumpDepthMD > 0;
        if (hasPressureData) {
            // Check if reservoir can produce at this rate (Pwf must be positive)
            const hasFullIPR = system.inflow.ip > 0 && system.inflow.pStatic > 0;
            const pwfAtFlow = hasFullIPR ? calculatePwf(flow, system) : 999;
            if (pwfAtFlow > 0) {
                try {
                    const sysHead = calculateTDH(flow, system);
                    if (!isNaN(sysHead) && isFinite(sysHead) && sysHead > 0 && sysHead < 50000) {
                        point.systemCurve = Number(sysHead.toFixed(2));
                    } else {
                        point.systemCurve = null;
                    }
                } catch {
                    point.systemCurve = null;
                }
            } else {
                point.systemCurve = null; // beyond AOF — reservoir exhausted
            }
        }

        if (kMin > 0) {
            const minH = kMin * Math.pow(flow, 2);
            point.minLimit = minH > 0 ? Number(minH.toFixed(2)) : null;
        }
        if (kMax > 0) {
            const maxH = kMax * Math.pow(flow, 2);
            point.maxLimit = maxH > 0 ? Number(maxH.toFixed(2)) : null;
        }

        data.push(point);
    }
    return data;
};

export const findIntersection = (data: any[]): { flow: number, head: number } | null => {
    // 1. Standard search for a crossing point
    for (let i = 0; i < data.length - 1; i++) {
        const p1 = data[i];
        const p2 = data[i + 1];
        if (p1.userHz !== null && p1.systemCurve !== null && p2.userHz !== null && p2.systemCurve !== null) {
            const diff1 = p1.userHz - p1.systemCurve;
            const diff2 = p2.userHz - p2.systemCurve;
            if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
                const fraction = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
                return {
                    flow: Math.round(p1.flow + (p2.flow - p1.flow) * fraction),
                    head: Math.round(p1.userHz + (p2.userHz - p1.userHz) * fraction)
                };
            }
        }
    }

    // 2. Bound Handling: If the pump is so powerful that its curve is ALWAYS above the system curve
    // even at AOF (reservoir limit), we assume the point is AOF (exhausted).
    const validPoints = data.filter(d => d.userHz !== null && d.systemCurve !== null);
    if (validPoints.length > 0) {
        const lastValid = validPoints[validPoints.length - 1];
        // If pump head is still greater than system head at the last calculated point (AOF limit)
        if (lastValid.userHz > lastValid.systemCurve) {
            return { flow: lastValid.flow, head: lastValid.userHz };
        }
    }

    return null;
}

// --- OPTIMIZED CACHING FOR SYSTEM TDH ---
let sysTdhCache: Map<string, number> = new Map();
const lastSysParamsHash = { val: "" };

/**
 * Optimized wrapper for calculateSystemTDH with a simple run-time cache.
 * Clears whenever key parameters (IP, pStatic, etc) change.
 */
export const calculateTDH = (flow: number, sys: SystemParams): number => {
    const hash = `${sys.pressures.pht}-${sys.inflow.pStatic}-${sys.inflow.ip}-${sys.fluids.waterCut}-${sys.fluids.gor}`;
    if (hash !== lastSysParamsHash.val) {
        sysTdhCache.clear();
        lastSysParamsHash.val = hash;
    }
    const flowKey = flow.toFixed(2);
    if (sysTdhCache.has(flowKey)) return sysTdhCache.get(flowKey)!;

    const val = calculateSystemTDH(flow, sys);
    sysTdhCache.set(flowKey, val);
    return val;
};

// --- HELPER: EQUIPMENT LIMIT ESTIMATION ---
export const getEquipmentMechanicalLimits = (series: string = "") => {
    let pumpLimit = 300;
    let protectorLimit = 300;
    let motorLimit = 300;

    if (series.includes("338")) {
        pumpLimit = 140; protectorLimit = 160; motorLimit = 160;
    } else if (series.includes("400") || series.includes("450")) {
        pumpLimit = 250; protectorLimit = 280; motorLimit = 300;
    } else if (series.includes("513") || series.includes("538")) {
        pumpLimit = 580; protectorLimit = 600; motorLimit = 650;
    } else if (series.includes("562")) {
        pumpLimit = 650; protectorLimit = 700; motorLimit = 800;
    } else if (series.includes("675") || series.includes("725")) {
        pumpLimit = 950; protectorLimit = 1000; motorLimit = 1200;
    }

    return { pumpLimit, protectorLimit, motorLimit };
};

export const getShaftLimitHp = (series: string = ""): number => {
    return getEquipmentMechanicalLimits(series).pumpLimit;
};

// --- EXCEL EXPORT FUNCTION ---
export const exportProjectToExcel = (params: SystemParams, pump: EspPump | null, motor: EspMotor | undefined, designRes: any, vsdDataDesign: any[], vsdDataActual: any[]) => {
    const wb = utils.book_new();

    // 1. UNIFIED ENGINEERING SUMMARY SHEET
    const summaryData = [
        ["ESP PROJECT ENGINEERING REPORT", "", "", "", "REPORT DATE:", new Date().toLocaleDateString()],
        ["Project Name:", params.metadata.projectName || "Unnamed", "", "", "Company:", params.metadata.company || "N/A"],
        ["Well Name:", params.metadata.wellName || "N/A", "", "", "Analyzed By:", params.metadata.engineer || "N/A"],
        ["", "", "", "", "", ""],
        ["--- FLUID PROPERTIES ---", "", "", "--- RESERVOIR DATA ---", "", ""],
        ["API Oil Gravity", params.fluids.apiOil, "API", "Static Reservoir Pressure", params.inflow.pStatic, "psi"],
        ["Water Cut (BSW)", params.fluids.waterCut, "%", "Productivity Index (PI)", params.inflow.ip, "bpd/psi"],
        ["Produced GOR", params.fluids.gor, "scf/stb", "Bottomhole Temp (BHT)", params.bottomholeTemp, "°F"],
        ["Gas Specific Gravity", params.fluids.geGas, "sg", "Formation Bubble Point", params.fluids.pb, "psi"],
        ["Water Specific Gravity", params.fluids.geWater, "sg", "Mid-Perforations Depth", params.wellbore.midPerfsMD, "ft MD"],
        ["", "", "", "", "", ""],
        ["--- EQUIPMENT SELECTION ---", "", "", "--- DESIGN TARGETS ---", "", ""],
        ["Pump Model", pump ? `${pump.manufacturer} ${pump.model}` : "None", "", "Operating Scenario", params.activeScenario.toUpperCase(), ""],
        ["Pump Series", pump?.series || "N/A", "", "Target Production Rate", params.pressures.totalRate, "BPD"],
        ["Total Pump Stages", pump?.stages || 0, "stg", "Operating Frequency", params.targets[params.activeScenario].frequency, "Hz"],
        ["Motor Model", motor ? `${motor.manufacturer} ${motor.model}` : "None", "", "Potencia Nominal", designRes.availableHp?.toFixed(1), "HP"],
        ["Motor Nameplate Amps", motor?.amps || 0, "A", "", "", ""],
        ["Cable Model", params.selectedCable?.model || "Generic", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["--- CALCULATED PERFORMANCE ---", "", "", "", "", ""],
        ["Metric Description", "Value", "Unit", "Metric Description", "Value", "Unit"],
        ["Pump Intake Pressure (PIP)", designRes.pip?.toFixed(1), "psi", "Motor Operating Load (HP)", designRes.motorLoad?.toFixed(1), "%"],
        ["Flowing Bottomhole Pres (Pwf)", designRes.pwf?.toFixed(1), "psi", "Motor Operating Load (Amp)", designRes.motorAmpLoad?.toFixed(1), "%"],
        ["Total Dynamic Head (TDH)", designRes.tdh?.toFixed(1), "ft", "Motor Operating Current", designRes.electrical.amps?.toFixed(1), "A"],
        ["P Descarga (PDP)", designRes.pdp?.toFixed(1), "psi", "Surface Voltage Required", designRes.electrical.surfaceVolts?.toFixed(0), "V"],
        ["Estimated Pump Efficiency", designRes.effEstimated?.toFixed(1), "%", "Active System Power", designRes.electrical.systemKw?.toFixed(1), "kW"],
        ["Temp. Motor (Est.)", designRes.motorT?.toFixed(1), "°F", "KVA Sistema (VSD)", designRes.electrical.systemKva?.toFixed(1), "kVA"],
        ["Carga Eje Bomba", designRes.pumpShaftLoad?.toFixed(1), "%", "Carga Cable Amp", designRes.cableAmpLoad?.toFixed(1), "%"],
        ["Carga Eje Protector", designRes.protectorShaftLoad?.toFixed(1), "%", "Carga MLE Amp", designRes.mleAmpLoad?.toFixed(1), "%"],
        ["Carga Eje Motor", designRes.motorShaftLoad?.toFixed(1), "%", "Carga Zapata (Thrust)", designRes.thrustStatus, "-"],
        ["Intake Void Fraction", (designRes.gasAnalysis?.voidFraction * 100 || 0).toFixed(1), "%", "Annular Fluid Velocity", designRes.fluidVelocity?.toFixed(1), "ft/s"]
    ];

    const wsSummary = utils.aoa_to_sheet(summaryData);
    // Visual sizing for columns
    wsSummary['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 8 },
        { wch: 30 }, { wch: 20 }, { wch: 8 }
    ];
    utils.book_append_sheet(wb, wsSummary, "Engineering Summary");

    // 2. VSD ANALYSIS (Design)
    if (vsdDataDesign && vsdDataDesign.length > 0) {
        const wsVsdD = utils.json_to_sheet(vsdDataDesign);
        wsVsdD['!cols'] = [
            { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
        ];
        utils.book_append_sheet(wb, wsVsdD, "VSD Matrix (Design)");
    }

    // 3. VSD ANALYSIS (Match)
    if (vsdDataActual && vsdDataActual.length > 0) {
        const wsVsdA = utils.json_to_sheet(vsdDataActual);
        wsVsdA['!cols'] = [
            { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
        ];
        utils.book_append_sheet(wb, wsVsdA, "VSD Matrix (Actual)");
    }

    // 4. HIDDEN DATA FOR APP IMPORT
    const projectPayload = {
        type: 'esp-studio-project',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        data: { params, customPump: pump, frequency: params.targets[params.activeScenario].frequency }
    };
    const wsData = utils.aoa_to_sheet([["JSON_DATA"], [JSON.stringify(projectPayload)]]);
    utils.book_append_sheet(wb, wsData, "APP_DATA");

    const filename = getDownloadFilename(params, pump, "Report");
    writeFile(wb, `${filename}.xlsx`);
};

// --- SCENARIO HELPERS ---

export const getScenarioParams = (params: any, sk: 'min' | 'target' | 'max'): any => {
    if (!params) return {};
    const sc = params.targets?.[sk];
    const base = { ...params };

    // Ensure base structures exist before spreading
    const pressures = base.pressures || {};
    const inflow = base.inflow || {};
    const fluids = base.fluids || {};

    if (!sc) return { ...base, pressures, inflow, fluids };

    return {
        ...base,
        pressures: { ...pressures, totalRate: sc.rate ?? pressures.totalRate ?? 0 },
        inflow: { ...inflow, ip: sc.ip ?? inflow.ip ?? 0 },
        fluids: { ...fluids, waterCut: sc.waterCut ?? fluids.waterCut ?? 0, gor: sc.gor ?? fluids.gor ?? 0 },
    };
};

export const calculateScenarioResults = (design: any, sk: 'min' | 'target' | 'max') => {
    if (!design || !design.pump || !design.params) return null;
    try {
        const sp = getScenarioParams(design.params, sk);
        const freq = design.params.targets?.[sk]?.frequency ?? design.frequency ?? 60;
        const pts = generateMultiCurveData(design.pump, sp, freq, 60);
        const match = findIntersection(pts);
        if (!match) return null;
        return calculateSystemResults(match.flow, match.head, sp, design.pump, freq);
    } catch (e) {
        console.error("Error calculating scenario results:", e);
        return null;
    }
};
