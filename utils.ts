
import { EspPump, SystemParams, PipeData, EspMotor, SurveyPoint, ScenarioData } from './types';
import * as PVT from './pvt'; // Import new engine

// --- UTILITY FUNCTIONS ---

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
        const p2 = survey[i+1];
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
    const safeQ = q || 0;
    
    if (sys.inflow.model === 'Vogel') {
        const qMax = (ip * pStatic) / 1.8;
        if (safeQ >= qMax) return 0;
        const ratio = safeQ / qMax;
        const a = 0.8; const b = 0.2; const c = ratio - 1;
        const disc = b*b - 4*a*c;
        if (disc < 0) return 0;
        const x = (-b + Math.sqrt(disc)) / (2*a);
        return Math.max(0, x * pStatic);
    } else {
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
    // RIGOROUS PROPERTIES USING PVT ENGINE
    const wc = params.fluids.waterCut / 100;
    const api = params.fluids.apiOil;
    const yg = params.fluids.geGas;
    
    // 1. Calculate Rs at PIP
    const Rs = PVT.calcRs(pip, temp, params.fluids);
    
    // 2. Calculate Bo at PIP
    const Bo = PVT.calcBo(pip, temp, Rs, params.fluids);
    
    // 3. Calculate Oil Density
    const gamma_o = 141.5 / (131.5 + api);
    const rho_oil = (62.4 * gamma_o + 0.0136 * Rs * yg) / Bo;
    const oilSG = rho_oil / 62.4;
    
    // 4. Water Density
    const Bw = PVT.calcWaterBo(pip, temp);
    const rho_water = (62.4 * params.fluids.geWater) / Bw;
    const waterSG = rho_water / 62.4;
    
    // 5. Gas Z-Factor & Bg
    const Z = PVT.calcZFactor(pip, temp, yg, params.fluids.correlations?.zFactor || 'Dranchuk-Abu-Kassem');
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
    
    const rhoGas = 62.4 * yg * (pip / 14.7) * (520 / (temp + 460)) * (1/Z);
    const mixDensity = (rho_oil * volOilInSitu + rho_water * volWaterInSitu + rhoGas * volGasInSitu) / volTotalInSitu;
    let mixSG = mixDensity / 62.4;

    // --- SOLIDS CORRECTION (ONLY IF SAND > 0) ---
    if (params.fluids.sandCut > 0) {
        const sandFrac = params.fluids.sandCut / 100;
        const sandDensity = params.fluids.sandDensity || 2.65;
        mixSG = mixSG * (1 - sandFrac) + sandDensity * sandFrac;
    }
    
    return { gradMix: mixSG * 0.433, viscMix: 1.0, oilSG, waterSG, mixSG, voidFraction, volGasInSitu, volLiquidInSitu: volOilInSitu + volWaterInSitu };
};

export const calculateBaseHead = (flow: number, pump: EspPump): number => {
  const { h0, h1, h2, h3, h4, h5, stages } = pump;
  const headPerStage = h0 + h1 * flow + h2 * Math.pow(flow, 2) + h3 * Math.pow(flow, 3) + h4 * Math.pow(flow, 4) + h5 * Math.pow(flow, 5);
  return headPerStage * (stages || 1);
};

export const calculateBasePowerPerStage = (flow: number, pump: EspPump): number => {
    const { p0, p1, p2, p3, p4, p5 } = pump;
    const powerPerStage = p0 + p1 * flow + p2 * Math.pow(flow, 2) + p3 * Math.pow(flow, 3) + p4 * Math.pow(flow, 4) + p5 * Math.pow(flow, 5);
    return Math.max(0, powerPerStage);
}

const calculateAffinityHead = (targetFlow: number, targetFreq: number, baseFreq: number, pump: EspPump): number | null => {
    if (baseFreq === 0) return 0;
    const ratio = targetFreq / baseFreq;
    if (ratio === 0) return 0;
    const baseFlow = targetFlow / ratio;
    if (pump.maxGraphRate > 0 && baseFlow > pump.maxGraphRate * 1.5) return null;
    const baseHead = calculateBaseHead(baseFlow, pump);
    return baseHead * Math.pow(ratio, 2);
}

const calculateBhpAtPoint = (flowActual: number, freqActual: number, baseFreq: number, pump: EspPump, sg: number): number => {
    const ratio = freqActual / baseFreq;
    const flowBase = flowActual / ratio;
    
    const hasPowerCoeffs = (Math.abs(pump.p0) + Math.abs(pump.p1) + Math.abs(pump.p2)) > 0.0000001;
    
    if (hasPowerCoeffs) {
        const powerBasePerStage = calculateBasePowerPerStage(flowBase, pump);
        const powerActualPerStage = powerBasePerStage * Math.pow(ratio, 3) * sg;
        return powerActualPerStage * (pump.stages || 1);
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
        const maxEff = pump.maxEfficiency || 70; 
        const estEfficiencyDec = (maxEff / 100) * effFactor;
        const finalEff = estEfficiencyDec > 0 ? estEfficiencyDec : 0.01;
        return hydraulicHp / finalEff;
    }
}

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

// --- RIGOROUS SYSTEM CURVE (FIXED: Calls PVT Engine) ---
const calculateSystemTDH = (flow: number, sys: SystemParams): number => {
    const q = flow || 0;
    
    // 1. SETUP
    const pumpMD = sys.pressures.pumpDepthMD;
    const pumpTVD = interpolateTVD(pumpMD, sys.survey);
    const thp = sys.pressures.pht; 
    
    // 2. INTAKE PRESSURE (PIP) PRELIMINARY
    const pwf = calculatePwf(q, sys);
    
    // Initial guess properties
    const waterSG = sys.fluids.geWater;
    const api = sys.fluids.apiOil || 35;
    const oilSgStd = 141.5 / (131.5 + api);
    const wc = sys.fluids.waterCut / 100;
    let mixSgLiquid = (waterSG * wc) + (oilSgStd * (1 - wc));

    // SOLIDS CORRECTION FOR HYDROSTATIC (ONLY IF PRESENT)
    if (sys.fluids.sandCut > 0) {
        const sand = sys.fluids.sandCut / 100;
        const sandSG = sys.fluids.sandDensity || 2.65;
        mixSgLiquid = mixSgLiquid * (1 - sand) + sandSG * sand;
    }
    
    const midPerfsTVD = interpolateTVD(sys.wellbore.midPerfsMD, sys.survey);
    const verticalDist = Math.max(0, midPerfsTVD - pumpTVD);
    const hydrostaticBelow = verticalDist * 0.433 * mixSgLiquid; 
    const pip = Math.max(0, pwf - hydrostaticBelow); 

    if (pwf <= 0.001 || pip <= 0) return NaN;

    if (q < 0.1) {
        const hydroColumn = pumpTVD * 0.433 * mixSgLiquid;
        const dischargeReq = thp + hydroColumn;
        const deltaP = dischargeReq - pip;
        return Math.max(0, deltaP / (0.433 * mixSgLiquid));
    }

    // --- RIGOROUS PVT CALCULATION FOR TUBING LOSSES ---
    // Calculate Average Conditions inside Tubing
    const safeThp = Math.max(50, thp);
    const pAvg = (pip + safeThp) / 2;
    
    const tSurf = sys.surfaceTemp || 80;
    const tBh = sys.bottomholeTemp || 150;
    const tAvg = (tSurf + tBh) / 2;
    const yg = sys.fluids.geGas || 0.7;
    
    // ** CALL PVT ENGINE **
    const Rs_avg = PVT.calcRs(pAvg, tAvg, sys.fluids);
    const Bo_avg = PVT.calcBo(pAvg, tAvg, Rs_avg, sys.fluids);
    const Z_avg = PVT.calcZFactor(pAvg, tAvg, yg, sys.fluids.correlations?.zFactor || 'Dranchuk-Abu-Kassem');
    const Bg_avg = PVT.calcBg(pAvg, tAvg, Z_avg);
    
    // ** CALL VISCOSITY ENGINE **
    const mu_oil = PVT.calcOilViscosity(pAvg, tAvg, Rs_avg, sys.fluids);
    const mu_gas = PVT.calcGasViscosity(tAvg, yg, (28.96*yg*pAvg)/(Z_avg*10.73*(tAvg+460)), sys.fluids.correlations?.viscGas || 'Lee');
    const mu_water = PVT.calcWaterViscosity(tAvg, sys.fluids.salinity, sys.fluids.correlations?.viscWater || 'Matthews & Russell');

    const gor = sys.fluids.gor;
    const freeGas = Math.max(0, gor - Rs_avg);
    
    // Volumetric Flows (In-Situ)
    const qOil = q * (1 - wc);
    const vSL = (qOil * Bo_avg + q * wc); 
    const vSG = (qOil * freeGas * Bg_avg); 
    const vMix = vSL + vSG;
    
    // Holdup & Density
    const lambdaG = vMix > 0 ? vSG / vMix : 0;
    const lambdaL = 1 - lambdaG;
    const holdup = Math.max(lambdaL, Math.pow(lambdaL, 0.5)); // Hagedorn-Brown simpl.

    const rhoL = 62.4 * mixSgLiquid;
    const rhoG = 62.4 * yg * (pAvg / 14.7) * (520 / (tAvg + 460)) * (1/Z_avg); 
    let rhoMix = (rhoL * holdup) + (rhoG * (1 - holdup));

    // SOLIDS CORRECTION FOR DENSITY
    if (sys.fluids.sandCut > 0) {
        const sand = sys.fluids.sandCut / 100;
        const sandDensity = (sys.fluids.sandDensity || 2.65) * 62.4;
        rhoMix = rhoMix * (1 - sand) + sandDensity * sand;
    }

    const mixSgTubing = rhoMix / 62.4;

    // --- FRICTION ---
    const idInch = sys.wellbore.tubing.id > 0 ? sys.wellbore.tubing.id : 2.441;
    const idFt = idInch / 12;
    const areaSqFt = Math.PI * Math.pow(idFt/2, 2);
    const velMix = (vMix * 5.615 / 86400) / areaSqFt; 
    
    // ** USE DYNAMIC VISCOSITY **
    // Mixture Viscosity (Arrhenius approx)
    let viscMix = Math.pow(mu_oil, (1-wc)*holdup) * Math.pow(mu_water, wc*holdup) * Math.pow(mu_gas, (1-holdup));
    
    // SOLIDS CORRECTION FOR VISCOSITY (Thomas Eq)
    if (sys.fluids.sandCut > 0) {
        const phi = sys.fluids.sandCut / 100;
        const relVisc = 1 + 2.5*phi + 10.05*phi*phi + 0.00273*Math.exp(16.6*phi);
        viscMix *= relVisc;
    }

    const Re = calculateReynolds(rhoMix, velMix, idFt, viscMix);
    const roughnessFt = sys.wellbore.tubing.roughness || 0.000065; 
    const f = calculateFrictionFactor(Re, roughnessFt, idFt);
    
    const g = 32.174;
    const fHead = f * (pumpMD / idFt) * (Math.pow(velMix, 2) / (2 * g));
    const frictionPsi = fHead * 0.433 * mixSgTubing;

    // --- HYDROSTATIC & TDH ---
    const hydroTubingPsi = pumpTVD * 0.433 * mixSgTubing;
    const requiredDischargePsi = thp + hydroTubingPsi + frictionPsi;
    const deltaPsi = requiredDischargePsi - pip;
    
    // Convert DeltaPsi to Head using Liquid Gradient at pump
    const tdh = deltaPsi / (0.433 * mixSgLiquid);

    return Math.max(0, tdh);
};

export const calculatePIP = (q: number, sys: SystemParams): number => {
    const pwf = calculatePwf(q, sys);
    const pumpTVD = interpolateTVD(sys.pressures.pumpDepthMD, sys.survey);
    const perfsTVD = interpolateTVD(sys.wellbore.midPerfsMD, sys.survey);
    const verticalDist = Math.max(0, perfsTVD - pumpTVD);
    
    const wc = sys.fluids.waterCut / 100;
    let mixSG = (sys.fluids.geWater * wc) + (141.5/(131.5+sys.fluids.apiOil) * (1-wc));
    
    // Solids Correction
    if (sys.fluids.sandCut > 0) {
        const sand = sys.fluids.sandCut / 100;
        const sandSG = sys.fluids.sandDensity || 2.65;
        mixSG = mixSG * (1 - sand) + sandSG * sand;
    }

    const hydro = verticalDist * 0.433 * mixSG;
    return Math.max(0, pwf - hydro);
}

export const calculatePDP = (q: number, sys: SystemParams): { pdp: number } => {
    const pumpTVD = interpolateTVD(sys.pressures.pumpDepthMD, sys.survey);
    const wc = sys.fluids.waterCut / 100;
    let mixSG = (sys.fluids.geWater * wc) + (141.5/(131.5+sys.fluids.apiOil) * (1-wc));
    
    // Solids Correction
    if (sys.fluids.sandCut > 0) {
        const sand = sys.fluids.sandCut / 100;
        const sandSG = sys.fluids.sandDensity || 2.65;
        mixSG = mixSG * (1 - sand) + sandSG * sand;
    }

    const hydro = pumpTVD * 0.433 * mixSG;
    return { pdp: sys.pressures.pht + hydro };
}

// --- MASTER CALCULATION FUNCTION ---
export const calculateSystemResults = (
    matchFlow: number | null, 
    matchHead: number | null,
    sys: SystemParams, 
    pump: EspPump, 
    frequency: number
) => {
    const qMax = calculateAOF(sys);

    if (matchFlow === null || matchFlow < 0) {
        return {
            pip: 0, pwf: 0, qMax, hpTotal: 0, hpPerStage: 0, headPerStage: 0,
            effEstimated: 0, motorLoad: 0, requiredMotorHp: 0,
            electrical: { volts: 0, amps: 0, kva: 0, kw: 0, pf: 0, motorEff: 0, voltDrop: 0 },
            tdh: 0, efficiency: 0, fluidLevel: sys.pressures.pumpDepthMD, pdp: 0, fluidVelocity: 0,
            gasAnalysis: { voidFraction: 0, status: 'Stable', degradationFactor: 0 }
        };
    }

    const q = matchFlow;
    const stages = pump.stages > 0 ? pump.stages : 1;
    const baseFreq = pump.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
    
    const wc = sys.fluids.waterCut / 100;
    
    // --- PIP CALCULATION ---
    const pwf = calculatePwf(q, sys);
    const pumpTVD = interpolateTVD(sys.pressures.pumpDepthMD, sys.survey);
    const perfsTVD = interpolateTVD(sys.wellbore.midPerfsMD, sys.survey);
    const verticalDist = Math.max(0, perfsTVD - pumpTVD);
    
    // Call rigorous fluid properties at intake
    // Note: We use an estimated PIP first to get properties, then refine?
    // For now, linear approx is fine for hydrostatic
    let mixSG_approx = (sys.fluids.geWater * wc) + (141.5/(131.5+sys.fluids.apiOil) * (1-wc));
    
    // Solids Correction
    if (sys.fluids.sandCut > 0) {
        const sand = sys.fluids.sandCut / 100;
        const sandSG = sys.fluids.sandDensity || 2.65;
        mixSG_approx = mixSG_approx * (1 - sand) + sandSG * sand;
    }

    const hydro = verticalDist * 0.433 * mixSG_approx;
    const pip = Math.max(0, pwf - hydro);

    // --- GAS ANALYSIS (TURPIN & DUNLOP) ---
    // 1. Get Fluid Properties at Intake Conditions
    const intakeTemp = sys.bottomholeTemp; // Assuming isothermal near bottom for simplicity
    const fProps = calculateFluidProperties(pip, intakeTemp, sys);
    
    // 2. Turpin Logic
    const fg = fProps.voidFraction; // Void Fraction
    let gasStatus: 'Stable' | 'Separator Required' | 'Gas Lock Risk' = 'Stable';
    let gasDegradation = 0;

    if (fg > 0.35) {
        gasStatus = 'Gas Lock Risk';
        gasDegradation = 0.40; // Critical loss
    } else if (fg > 0.10) {
        gasStatus = 'Separator Required';
        gasDegradation = 0.15; // Moderate loss
    }

    // --- TDH & LIFT ---
    let tdh = matchHead;
    if (tdh === null || tdh === undefined) {
        tdh = calculateSystemTDH(q, sys);
        if (isNaN(tdh)) tdh = 0;
    }

    const chp = sys.pressures.phc || 0;
    // Use rigorous density if available, else approx
    const mixSG = fProps.mixSG > 0 ? fProps.mixSG : mixSG_approx;
    
    const submergencePsi = Math.max(0, pip - chp);
    const submergenceFt = submergencePsi / (0.433 * mixSG);
    const fluidLevelMD = Math.max(0, sys.pressures.pumpDepthMD - submergenceFt);

    const headPerStage = tdh / stages;
    
    let hpTotal = 0;
    if (tdh > 0) {
        hpTotal = calculateBhpAtPoint(q, frequency, baseFreq, pump, mixSG);
    }

    const hydraulicHp = (q * tdh * mixSG) / 135770;
    let pumpEff = 0;
    if (hpTotal > 0) pumpEff = (hydraulicHp / hpTotal) * 100;
    
    const motorHpNameplate = sys.motorHp > 0 ? sys.motorHp : 1; 
    const availableHp = motorHpNameplate * (frequency / baseFreq);
    const loadFactor = hpTotal / Math.max(0.1, availableHp);
    const motorLoadPct = loadFactor * 100;

    const isPMM = sys.selectedMotor?.model?.includes('PMM') || sys.selectedMotor?.series?.includes('560');
    const baseEff = isPMM ? 0.94 : 0.93;
    const basePF = isPMM ? 0.96 : 0.94;

    const { eff: motorEffDecimal, pf: motorPFDecimal } = getMotorPerformance(loadFactor, baseEff, basePF);

    const kw = (hpTotal * 0.746) / motorEffDecimal;
    const ratedVolts = sys.selectedMotor?.voltage || (motorHpNameplate * 15);
    const runVolts = ratedVolts * (frequency / baseFreq);

    let runAmps = 0;
    if (runVolts > 0 && motorPFDecimal > 0) {
        runAmps = (kw * 1000) / (1.732 * runVolts * motorPFDecimal);
    }

    const cableResPer1000 = 0.45;
    const cableLenKft = sys.pressures.pumpDepthMD / 1000;
    const voltDrop = 1.732 * runAmps * cableResPer1000 * cableLenKft;
    const surfaceVolts = runVolts + voltDrop;
    const kva = (1.732 * surfaceVolts * runAmps) / 1000;

    const tbgId = sys.wellbore.tubing.id || 2.441;
    const areaSqFt = (Math.PI * Math.pow(tbgId/12, 2)) / 4;
    const velocity = areaSqFt > 0 ? (q * 5.615 / 86400) / areaSqFt : 0;

    const { pdp } = calculatePDP(q, sys);

    return {
        pip,
        pwf,
        qMax,
        hpTotal,        
        hpPerStage: hpTotal / stages,
        headPerStage,
        effEstimated: pumpEff,
        motorLoad: motorLoadPct, 
        requiredMotorHp: hpTotal * 1.1,
        fluidLevel: fluidLevelMD,
        tdh: tdh,
        efficiency: pumpEff,
        pdp,
        fluidVelocity: velocity,
        electrical: {
            volts: runVolts,
            surfaceVolts,
            amps: runAmps,
            kva: kva,
            kw: kw,
            pf: motorPFDecimal * 100,
            motorEff: motorEffDecimal * 100,
            voltDrop
        },
        gasAnalysis: {
            voidFraction: fg,
            status: gasStatus,
            degradationFactor: gasDegradation
        }
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
  let mixSG = (system.fluids.geWater * wc) + (141.5/(131.5+system.fluids.apiOil) * (1-wc));
  
  // Solids Correction
  if (system.fluids.sandCut > 0) {
        const sand = system.fluids.sandCut / 100;
        const sandSG = system.fluids.sandDensity || 2.65;
        mixSG = mixSG * (1 - sand) + sandSG * sand;
  }

  for (let i = 0; i <= points; i++) {
      const flow = i * step; 
      const point: any = { flow: Number(flow.toFixed(0)) };
      
      standardFreqs.forEach(freq => {
          const key = `hz${freq}`;
          if (activeCurves[key]) {
              const h = calculateAffinityHead(flow, freq, baseFreq, pump);
              if (h !== null && h > 1) point[key] = Number(h.toFixed(2));
              else { activeCurves[key] = false; point[key] = null; }
          } else { point[key] = null; }
      });

      if (activeCurves.userHz) {
          const hUser = calculateAffinityHead(flow, userFrequency, baseFreq, pump);
          if (hUser !== null && hUser > 1) {
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

      if (system.inflow.ip > 0 && system.inflow.pStatic > 0) {
          const sysHead = calculateSystemTDH(flow, system);
          if (!isNaN(sysHead) && sysHead > 0) point.systemCurve = Number(sysHead.toFixed(2));
          else point.systemCurve = null;
      }

      if (kMin > 0 && flow <= maxConeFlowMin) {
          const minH = kMin * Math.pow(flow, 2);
          point.minLimit = minH > 0 ? Number(minH.toFixed(2)) : null;
      }
      if (kMax > 0 && flow <= maxConeFlowMax) {
          const maxH = kMax * Math.pow(flow, 2);
          point.maxLimit = maxH > 0 ? Number(maxH.toFixed(2)) : null;
      }

      data.push(point);
  }
  return data;
};

export const findIntersection = (data: any[]): { flow: number, head: number } | null => {
    for (let i = 0; i < data.length - 1; i++) {
        const p1 = data[i];
        const p2 = data[i+1];
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
    return null;
}

export const calculateTDH = (flow: number, sys: SystemParams): number => calculateSystemTDH(flow, sys);
