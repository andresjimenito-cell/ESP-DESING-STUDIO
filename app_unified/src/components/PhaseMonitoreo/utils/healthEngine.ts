import { WellFleetItem, SystemParams, EspPump } from '@/types';
import { 
    calculateBaseHead, 
    calculateFluidProperties, 
    calculateSystemResults, 
    getShaftLimitHp, 
    interpolateTVD, 
    calculateTDH 
} from '@/utils';
import { fuzzyWellName } from './dataExtractors';

/**
 * Calculates a rigorous health score for a well based on component status, 
 * performance deviations, and physical constraints.
 */
export const getWellHealthScore = (well: WellFleetItem, customDesigns?: Record<string, any>, defaultPump?: any) => {
    const hasMatch = well.productionTest.hasMatchData && (well.currentRate > 5 || well.productionTest.pip > 0 || well.productionTest.thp > 0);
    if (!hasMatch) return 0;

    const getStrictStatusValue = (s: string) => {
        const statuses: Record<string, number> = {
            normal: 100, active: 100, optimal: 100,
            caution: 75,
            alert: 30, failure: 0,
            error: 0, 'ground-fault': 0, inactive: 50
        };
        return statuses[s] ?? 100;
    };

    const componentHealth = (
        getStrictStatusValue(well.health.pump) * 0.35 +
        getStrictStatusValue(well.health.motor) * 0.35 +
        getStrictStatusValue(well.health.cable) * 0.20 +
        getStrictStatusValue(well.health.seal) * 0.10
    );

    let performanceScore = 100;

    if (well.consumptionTheo > 0) {
        const pwrDev = Math.abs(well.consumptionReal - well.consumptionTheo) / well.consumptionTheo;
        if (pwrDev > 0.25) performanceScore -= 30;
        else if (pwrDev > 0.15) performanceScore -= 10;
    }

    if (well.targetRate > 0) {
        const rateDev = Math.abs(well.currentRate - well.targetRate) / well.targetRate;
        if (rateDev > 0.30) performanceScore -= 30;
        else if (rateDev > 0.15) performanceScore -= 10;
    }

    if (well.productionTest.pip > 0) {
        if (well.productionTest.pip < 100) performanceScore -= 50; 
        else if (well.productionTest.pip < 200) performanceScore -= 20;
    }

    const totalScore = (componentHealth * 0.70) + (Math.max(0, performanceScore) * 0.30);

    let finalScore = totalScore;

    if (customDesigns && defaultPump) {
        const wellNorm = fuzzyWellName(well.name);
        const design = Object.entries(customDesigns).find(([k]) => fuzzyWellName(k) === wellNorm)?.[1];
        let pump = defaultPump;
        let motor: any = null;

        if (design) {
            const findPump = (obj: any): any => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.stages && (obj.h0 || obj.h1)) return obj;
                for (let k in obj) { const found = findPump(obj[k]); if (found) return found; }
                return null;
            }
            pump = findPump(design) || pump;

            const findMotor = (obj: any): any => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.hp !== undefined && obj.npAmps !== undefined) return obj;
                for (let k in obj) { const found = findMotor(obj[k]); if (found) return found; }
                return null;
            }
            motor = findMotor(design);
        }

        const currentRate = well.currentRate || well.productionTest.rate || 0.1;
        const currentFreq = well.productionTest.freq || 60;
        const ratio = currentFreq / (pump.nameplateFrequency || 60);
        const minQ = (pump.minRate || 0) * ratio;
        const maxQ = (pump.maxRate || 2000) * ratio;

        const isDownthrust = currentRate < minQ * 0.95;
        const isUpthrust = currentRate > maxQ * 1.05;

        if (isDownthrust || isUpthrust) {
            finalScore = Math.min(finalScore, 55); 
        }

        if (motor && motor.hp) {
            const depth = well.depthMD || 8000;
            const bhpEst = (currentRate * (depth * 0.433) * 0.9) / (135770 * 0.65); 
            const motorLimit = motor.hp * (currentFreq / 60);

            if (motorLimit > 0) {
                const loadPct = (bhpEst / motorLimit) * 100;
                if (loadPct > 105) finalScore = Math.min(finalScore, 30); 
                else if (loadPct > 95) finalScore = Math.min(finalScore, 55); 
            }
        }
    }

    const criticalFailure = [well.health.pump, well.health.motor, well.health.cable].some(s => s === 'alert' || s === 'failure' || s === 'ground-fault');

    return Math.round(Math.max(0, Math.min(100, criticalFailure ? Math.min(finalScore, 35) : finalScore)));
};

/**
 * Simulates the maximum potential capacity of a well based on current physical limits.
 */
export const computeWellCapacity = (well: WellFleetItem, wellMatchParams: SystemParams, pump: EspPump) => {
    if (!wellMatchParams?.historyMatch || !pump) return null;

    const test = well.productionTest;
    const q = Math.max(0.1, test.rate);
    const baseFreq = pump.nameplateFrequency || 60;
    const currentFreq = test.freq || 60;
    const ratioActual = Math.max(0.01, currentFreq / baseFreq);

    const qBaseActual = q / ratioActual;
    const hBaseAtQ = calculateBaseHead(qBaseActual, pump);
    const actualPumpTDH = Math.max(0, hBaseAtQ * Math.pow(ratioActual, 2));

    const pipMeasured = test.pip > 0 ? test.pip : 10;
    const pumpMD = well.depthMD || wellMatchParams.pressures?.pumpDepthMD || 5000;
    const perfsMD = well.depthMD > 0 ? well.depthMD + 100 : (wellMatchParams.wellbore?.midPerfsMD || 5100);
    const pumpTVD = interpolateTVD(pumpMD, wellMatchParams.survey);
    const perfsTVD = interpolateTVD(perfsMD, wellMatchParams.survey);
    const deltaTVD = Math.max(0, perfsTVD - pumpTVD);

    const fluidProps = calculateFluidProperties(pipMeasured, wellMatchParams.bottomholeTemp, wellMatchParams);
    const currentGrad = fluidProps.gradMix || 0.35;
    const pwfActual = pipMeasured + (deltaTVD * currentGrad);

    const existingPStatic = wellMatchParams.inflow?.pStatic || 0;
    const baseDrawdown = existingPStatic > pwfActual ? (existingPStatic - pwfActual) : Math.max(500, q / 1.5);
    const validPStatic = pwfActual + baseDrawdown;
    const calculatedIP = q / baseDrawdown;

    const actualParams = {
        ...wellMatchParams,
        inflow: { ...wellMatchParams.inflow, ip: calculatedIP, pStatic: validPStatic },
        fluids: { ...wellMatchParams.fluids, waterCut: test.waterCut },
        pressures: { ...wellMatchParams.pressures, pht: test.thp, phc: 0, totalRate: q, pumpDepthMD: pumpMD }
    };

    let sysCurveOffset = 0;
    const rawSysTDH = calculateTDH(q, actualParams);
    if (rawSysTDH > 0) sysCurveOffset = actualPumpTDH - rawSysTDH;

    let maxAllowedFreq = currentFreq;
    let limitingFactor = 'Operación en Punto de Diseño';
    let estimatedMaxRate = test.rate;

    for (let simFreq = currentFreq + 2; simFreq <= 80; simFreq += 2) {
        const ratio = simFreq / baseFreq;
        const maxExpectedFlow = (pump.maxGraphRate || 6000) * ratio;
        const steps = 30; 
        const stepSize = maxExpectedFlow / steps;

        let bestRate = 0;
        let bestHead = 0;

        for (let i = 0; i < steps; i++) {
            const testQ = i * stepSize;
            if (testQ === 0) continue;
            const qB = testQ / ratio;
            const pHead = calculateBaseHead(qB, pump) * Math.pow(ratio, 2);
            const sHead = calculateTDH(testQ, actualParams) + sysCurveOffset;

            if (pHead < sHead) {
                const prevQ = (i - 1) * stepSize;
                bestRate = prevQ + (testQ - prevQ) * 0.5;
                bestHead = pHead;
                break;
            }
        }

        if (bestRate === 0) { limitingFactor = 'Altura de Bombeo Agotada (TDH Max)'; break; }

        const res = calculateSystemResults(bestRate, bestHead, actualParams, pump, simFreq);
        const ml = res?.motorLoad || 0;
        const sLimit = getShaftLimitHp(pump?.series);
        const sl = sLimit > 0 ? ((res?.hpTotal || 0) / sLimit) * 100 : 0;
        const sub = Math.max(0, pumpMD - (res?.fluidLevel || 0));
        const totalKva = res?.electrical?.systemKva || 0;
        const vsdKva = (wellMatchParams as any).selectedVSD?.kvaRating || 350;

        if (sub < 500) { limitingFactor = `Sumergencia de Protección (>500 ft)`; break; }
        if (ml >= 75) { limitingFactor = `Reserva Térmica Motor (Límite 75%)`; break; }
        if (sl >= 70) { limitingFactor = `Reserva Mecánica Eje (Límite 70%)`; break; }
        if (res?.pip < 300) { limitingFactor = `Protección PIP (>300 psi)`; break; }
        if (totalKva >= (vsdKva * 0.90)) { limitingFactor = `Capacidad Reservada VSD (${totalKva.toFixed(0)} kVA)`; break; }

        maxAllowedFreq = simFreq;
        estimatedMaxRate = bestRate;
        if (simFreq >= 80) limitingFactor = 'Optimizado a 80 Hz (Límite Máximo VSD)';
    }

    const potentialGain = Math.max(0, estimatedMaxRate - test.rate);
    return { maxFreq: maxAllowedFreq, maxRate: estimatedMaxRate, limitingFactor, potentialGain };
};

/**
 * Generates optimization advice and warnings based on well capacity and physical state.
 */
export const getOptimizationPath = (well: WellFleetItem, capacity: any, pump: EspPump | null) => {
    if (!well || !capacity) return { advice: 'Calculando optimización...', warning: '' };

    const freq = well.productionTest.freq || 60;
    const isDownthrust = (well.productionTest.rate || 0) < (pump?.minRate || 0) * (freq / (pump?.nameplateFrequency || 60));
    const isUpthrust = (well.productionTest.rate || 0) > (pump?.maxRate || 2000) * (freq / (pump?.nameplateFrequency || 60));

    let advice = '';
    if (capacity.potentialGain > 5) {
        advice = `Recomendación: SUBIR LA FRECUENCIA hasta ${capacity.maxFreq} Hz para ganar +${Math.round(capacity.potentialGain)} BPD extras. Dicho aumento es validado como seguro puesto que el estado mecánico actual soportará la carga hasta topar con su límite técnico (${capacity.limitingFactor}).`;
    } else {
        advice = `Recomendación: MANTENER LA FRECUENCIA ACTUAL de ${freq} Hz. El sistema ha alcanzado el límite operativo dictado por ${capacity.limitingFactor || 'restricciones físicas'}. Incrementar el libraje generaría riesgo inminente de fallo o sobrecarga térmica en la cara del motor.`;
    }

    let warning = '';
    if (isDownthrust) {
        warning = ` [!] ACCIÓN REQUERIDA: Ante el comportamiento en Downthrust, el empuje axial desgastará prematuramente las arandelas de la bomba. Se sugiere bajar la frecuencia en su VSD o mejorar el inflow del reservorio minimizando ahogos.`;
    } else if (isUpthrust) {
        warning = ` [!] ACCIÓN REQUERIDA: Ante el comportamiento en Upthrust, considere incrementar la frecuencia del variador para alinear el bombeo con la curva ideal o aplicar contrapresión / estrangulador en superficie para empujar el punto de operación.`;
    }

    return { advice, warning };
};

/**
 * Diagnostic logic for Phase 6 (thrust and flow analysis).
 */
export const getPhase6Diagnosis = (well: WellFleetItem, params: SystemParams, pump: EspPump | null) => {
    if (!well || !params || !pump) return null;
    const freq = well.productionTest.freq || 60;
    const ratio = freq / (pump.nameplateFrequency || 60);
    const qRaw = well.productionTest.rate || 0.1;
    const qBase = qRaw / ratio;

    const minQ = pump.minRate * ratio;
    const maxQ = pump.maxRate * ratio;

    let thrustStatus: 'optimal' | 'upthrust' | 'downthrust' = 'optimal';
    if (qRaw < minQ * 0.95) thrustStatus = 'downthrust';
    else if (qRaw > maxQ * 1.05) thrustStatus = 'upthrust';

    return { thrustStatus, minQ, maxQ, ratio };
};
