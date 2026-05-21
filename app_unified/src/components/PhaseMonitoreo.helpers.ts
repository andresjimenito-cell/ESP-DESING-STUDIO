import { SystemParams, EspPump, WellFleetItem, HistoryMatchData, ProductionTest, SurveyPoint } from '@/types';
import { calculateBaseHead, calculateTDH, calculateSystemResults, getShaftLimitHp, interpolateTVD, calculateFluidProperties } from '@/utils';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const isWellMatchComplete = (well: WellFleetItem) => {
    const t = well.productionTest;
    const rate = Math.max(well.currentRate || 0, t?.rate || 0);
    return rate > 5 && (t?.pip || 0) > 0 && (t?.thp || 0) > 0 && (t?.freq || 0) > 0;
};

export const buildHistoryMatchFromWell = (
    well: WellFleetItem,
    basePStatic = 0,
    designBase?: SystemParams | null
): HistoryMatchData => {
    const t = well.productionTest;
    const designHm = designBase?.historyMatch;
    // Fecha de cotejo = ultima prueba SCADA / produccion
    const matchDate = t?.date || designHm?.matchDate || new Date().toISOString().split('T')[0];
    // Fecha de arranque = columna de diseno (FECHA DE ARRANQUE), no la de la prueba
    const startDate =
        designHm?.startDate ||
        (designBase as any)?.startDate ||
        (designBase as any)?.fechaArranque ||
        (designBase as any)?.fecha_arranque ||
        '';
    return {
        rate: t?.rate || well.currentRate || 0,
        frequency: t?.freq || 60,
        waterCut: t?.waterCut || 0,
        thp: t?.thp || 0,
        tht: t?.tht || 80,
        pip: t?.pip || 0,
        pd: t?.pdp || t?.hp || 0,
        pdp: t?.pdp,
        fluidLevel: 0,
        submergence: 0,
        pStatic: basePStatic > 0 ? basePStatic : 0,
        startDate,
        matchDate,
        gor: t?.gor ?? designHm?.gor,
    };
};

export const getApiKey = () => {
    // Nueva clave nivel gratuito proporcionada por el usuario
    return "AIzaSyALOKJDFF6JHthsRq_25lcoZJXGAZYebWM";
};

export const genAI = new GoogleGenerativeAI(getApiKey());

export const computeWellCapacity = (well: WellFleetItem, wellMatchParams: SystemParams, pump: EspPump) => {
    // Si no hay datos de match, no perdemos tiempo calculando
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
    let limitingFactor = 'Operacion en Punto de Diseno';
    let estimatedMaxRate = test.rate;

    // OPTIMIZACI"N AGRESIVA: Saltamos de a 5 Hz para reducir carga computacional en un 80%
    // Esto es suficiente para una estimacion predictiva de monitoreo.
    for (let simFreq = currentFreq + 5; simFreq <= 85; simFreq += 5) {
        const ratio = simFreq / baseFreq;
        const maxExpectedFlow = (pump.maxGraphRate || 6000) * ratio;
        const steps = 20; // Reducido de 30 a 20 (Suficiente para tendencia predictiva)
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

        if (sub < 400) { limitingFactor = `Sumergencia Critica (<400 ft)`; break; }
        if (ml >= 85) { limitingFactor = `Limite Termico Motor (85%)`; break; }
        if (sl >= 80) { limitingFactor = `Limite Mecanico Eje (80%)`; break; }
        if (res?.pip < 250) { limitingFactor = `Proteccion PIP (<250 psi)`; break; }
        if (totalKva >= (vsdKva * 0.95)) { limitingFactor = `Capacidad VSD (${totalKva.toFixed(0)} kVA)`; break; }

        maxAllowedFreq = simFreq;
        estimatedMaxRate = bestRate;
        if (simFreq >= 80) limitingFactor = 'Optimizado (Limite VSD)';
    }

    const potentialGain = Math.max(0, estimatedMaxRate - test.rate);
    return { maxFreq: maxAllowedFreq, maxRate: estimatedMaxRate, limitingFactor, potentialGain };
};

// --- AI DIAGNOSTIC HELPERS ---
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


export const getOptimizationPathLocalized = (well: WellFleetItem, capacity: any, pump: EspPump | null, language: string) => {
    if (!well || !capacity) {
        return {
            advice: language === 'es' ? 'Calculando optimizacion...' : 'Calculating optimization...',
            warning: ''
        };
    }

    const freq = well.productionTest.freq || 60;
    const ratio = freq / (pump?.nameplateFrequency || 60);
    const isDownthrust = (well.productionTest.rate || 0) < (pump?.minRate || 0) * ratio * 0.95;
    const isUpthrust = (well.productionTest.rate || 0) > (pump?.maxRate || 2000) * ratio * 1.05;

    let advice = '';
    if (capacity.potentialGain > 5) {
        advice = language === 'es'
            ? `Recomendacion: SUBIR LA FRECUENCIA hasta ${capacity.maxFreq} Hz para ganar +${Math.round(capacity.potentialGain)} BPD extras. Este aumento es seguro hasta el limite tecnico (${capacity.limitingFactor}).`
            : `Recommendation: INCREASE FREQUENCY up to ${capacity.maxFreq} Hz to gain +${Math.round(capacity.potentialGain)} extra BPD. This increase is safe up to the technical limit (${capacity.limitingFactor}).`;
    } else {
        advice = language === 'es'
            ? `Recomendacion: MANTENER LA FRECUENCIA ACTUAL de ${freq} Hz. El sistema alcanzo el limite operativo por ${capacity.limitingFactor || 'restricciones fisicas'}.`
            : `Recommendation: MAINTAIN CURRENT FREQUENCY at ${freq} Hz. The system reached its operating limit due to ${capacity.limitingFactor || 'physical constraints'}.`;
    }

    let warning = '';
    if (isDownthrust) {
        warning = language === 'es'
            ? ' [!] ACCION REQUERIDA: Comportamiento Downthrust. Ajuste VSD para subir caudal hacia 0.85-1.10 BEP; si no responde, revisar inflow/sistema.'
            : ' [!] ACTION REQUIRED: Downthrust behavior. Adjust VSD to raise flow toward 0.85-1.10 BEP; if no response, review inflow/system.';
    } else if (isUpthrust) {
        warning = language === 'es'
            ? ' [!] ACCION REQUERIDA: Comportamiento Upthrust. Ajuste VSD para bajar caudal hacia 0.85-1.10 BEP; validar aforo y contrapresion.'
            : ' [!] ACTION REQUIRED: Upthrust behavior. Adjust VSD to lower flow toward 0.85-1.10 BEP; validate test rate and backpressure.';
    }

    return { advice, warning };
};

// Backward-compatible default (Spanish) for existing call sites.
export const getOptimizationPath = (well: WellFleetItem, capacity: any, pump: EspPump | null) => {
    return getOptimizationPathLocalized(well, capacity, pump, 'es');
};

export const getWellHealthScore = (well: WellFleetItem, design?: SystemParams | null, defaultPump?: any) => {
    const hasMatch = well.productionTest.hasMatchData && (well.currentRate > 5 || well.productionTest.pip > 0 || well.productionTest.thp > 0);
    if (!hasMatch) return 0;

    // --- 1. CRITICAL STATUS (Sensor Alarms & Immediate Risk) ---
    const criticalFailure = [well.health.pump, well.health.motor, well.health.cable, well.health.seal]
        .some(s => s === 'alert' || s === 'failure' || s === 'ground-fault');

    if (criticalFailure) return 30; // CRITICAL

    // --- 2. OPERATIONAL LIMITS ANALYSIS ---
    let finalStatus: 'optimal' | 'caution' | 'critical' = 'optimal';

    if (defaultPump) {
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

        // --- Flow Limits (Cone) ---
        if (currentRate < minQ || currentRate > maxQ) {
            finalStatus = 'caution'; // Exceeding range is Caution (per user preference)
        } else if (currentRate < minQ * 1.15 || currentRate > maxQ * 0.85) {
            finalStatus = 'caution'; // Approaching range limit (within 15%) -> Caution
        }

        // --- Motor Load Limits ---
        if (motor && motor.hp) {
            const depth = well.depthMD || 8000;
            const bhpEst = (currentRate * (depth * 0.433) * 0.9) / (135770 * 0.65);
            const motorLimit = motor.hp * (currentFreq / 60);

            if (motorLimit > 0) {
                const loadPct = (bhpEst / motorLimit) * 100;
                if (loadPct > 105) return 30; // CRITICAL OVERLOAD
                else if (loadPct > 90) finalStatus = 'caution'; // Approaching limit -> Caution
            }
        }
    }

    // --- PIP Limits ---
    const pip = well.productionTest.pip || 0;
    if (pip > 0) {
        if (pip < 100) return 30; // CRITICAL PIP
        if (pip < 300) finalStatus = 'caution'; // Approaching/Low PIP -> Caution
    }

    // --- 3. RETURN TIERED SCORE ---
    if (finalStatus === 'caution') return 70;
    return 100; // OPTIMAL
};

export const s_ext = (val: any): string => (val == null ? '' : String(val).trim());
export const d_ext = (val: any): string => {
    if (val == null || val === '') return new Date().toISOString().split('T')[0];
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number' && val > 30000 && val < 60000) {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    let s = String(val).trim().toLowerCase();
    const esMonths: Record<string, string> = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    s = s.replace(/\./g, '');
    for (const [abbr, num] of Object.entries(esMonths)) {
        if (s.includes(abbr)) { s = s.replace(abbr, num); break; }
    }
    s = s.replace(/[\/\s]/g, '-');
    const parts = s.split('-').filter(p => p.length > 0);
    if (parts.length === 3 && parts[0].length <= 2) {
        let day = parts[0], month = parts[1], year = parts[2];
        if (year.length === 2) year = '20' + year;
        if (day.length === 1) day = '0' + day;
        if (month.length === 1) month = '0' + month;
        const iso = `${year}-${month}-${day}`;
        if (!isNaN(new Date(iso).getTime())) return iso;
    }
    const finalD = new Date(s);
    return isNaN(finalD.getTime()) ? new Date().toISOString().split('T')[0] : finalD.toISOString().split('T')[0];
};
export const n_ext = (v: any): number => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    let s = String(v).trim().replace(/\s+/g, ' ');

    // Handle fractions like 3 1/2 or 3-1/2
    if (s.includes('/')) {
        const match = s.match(/(\d+)?[\s-]?(\d+)\/(\d+)/);
        if (match) {
            const whole = parseFloat(match[1] || '0');
            const num = parseFloat(match[2]);
            const den = parseFloat(match[3]);
            return Number((whole + (num / den)).toFixed(3));
        }
    }

    let clean = s.replace(/[^*0-9.,-]/g, '').replace(/\*.*$/, '');
    if (clean.includes(',') && clean.includes('.')) {
        if (clean.indexOf(',') > clean.indexOf('.')) clean = clean.replace(/\./g, '').replace(',', '.');
        else clean = clean.replace(/,/g, '');
    } else if (clean.includes(',')) {
        if (clean.split(',').pop()?.length === 3 && clean.split(',').length > 1) clean = clean.replace(/,/g, '');
        else clean = clean.replace(',', '.');
    }
    const res = parseFloat(clean);
    return isNaN(res) ? 0 : Number(res.toFixed(3));
};
export const norm_ext = (str: string) =>
    String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9_]/g, '');

export const fuzzyWellName = (str: string) => {
    if (!str) return '';
    const n = String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return n.replace(/(^|[^0-9])0+(\d+)/g, '$1$2');
};

export const get_ext = (row: Record<string, any>, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    const normRowKeys = rowKeys.map(norm_ext);
    for (const key of keys) {
        const nk = norm_ext(key);
        // 1. Intento Exacto
        const idxExact = normRowKeys.indexOf(nk);
        if (idxExact !== -1) return row[rowKeys[idxExact]];

        // 2. Intento Parcial (Solo si el nombre es largo y no es una columna de presion critica)
        const isCritical = nk.includes('PIP') || nk.includes('THP') || nk.includes('PDP');
        if (nk.length > 3 && !isCritical) {
            const idxPartial = normRowKeys.findIndex(nk2 => nk2 === nk || nk2.startsWith(nk + '_') || nk2.endsWith('_' + nk));
            if (idxPartial !== -1) return row[rowKeys[idxPartial]];
        }
    }
    return null;
};

export const smartMatchExt = (catalog: any[], searchString: string, isMotor: boolean = false, targetHp: number = 0, targetVolts: number = 0, targetAmps: number = 0) => {
    if ((!searchString || catalog.length === 0) && targetHp === 0 && targetVolts === 0 && targetAmps === 0) return null;
    const rawSearch = String(searchString || '').toUpperCase();
    const tokens = rawSearch.split(/[\s\-_,;()\u00A0]/).filter(t => t.length > 0);
    if (tokens.length === 0 && targetHp === 0 && targetVolts === 0 && targetAmps === 0) return null;

    let bestMatch = null; let maxScore = -999;
    let searchHp = isMotor ? (rawSearch.match(/(\d+)\s*HP/)?.[1] ? parseInt(rawSearch.match(/(\d+)\s*HP/)![1], 10) : 0) : 0;

    // Attempt to identify a 3-digit series number common in ESP equipment (e.g. 512 from N512PM235)
    let expectedSeries = '';
    const seriesMatch = rawSearch.match(/(?:N|S|M|TR)?(3\d{2}|4\d{2}|5\d{2}|6\d{2}|7\d{2})(?:PM|E|S|-|\s)/);
    if (seriesMatch) expectedSeries = seriesMatch[1];
    else {
        const fallBackMatch = rawSearch.match(/(3\d{2}|4\d{2}|5\d{2}|6\d{2}|7\d{2})/);
        if (fallBackMatch) expectedSeries = fallBackMatch[1];
    }

    const hpToMatch = targetHp > 0 ? targetHp : searchHp;

    for (const item of catalog) {
        let score = 0;
        const itemModel = String(item.model || '').toUpperCase();
        const itemSeries = String(item.series || '').toUpperCase();
        const itemTokens = [itemModel, itemSeries, String(item.manufacturer || ''), String(item.brand || ''), String(item.id || '')].map(s => String(s).split(/[\s\-_,;()\u00A0]/)).flat().filter(t => String(t).length > 2);
        const itemStr = itemTokens.join(' ').toUpperCase();

        if (expectedSeries) {
            if (itemSeries.includes(expectedSeries) || itemModel.includes(expectedSeries)) {
                score += 300;
            }
        }

        if (isMotor) {
            if (item.hp) {
                if (hpToMatch > 0) {
                    if (item.hp === hpToMatch) {
                        score += 500;
                    } else if (item.hp > hpToMatch) {
                        // Prefer higher HP, closer is better. (e.g. need 235, found 295 -> diff 60 -> score 140)
                        const diff = item.hp - hpToMatch;
                        if (diff <= 200) {
                            score += 200 - diff;
                        }
                    } else {
                        // Penalty for underpowered motors
                        const diff = hpToMatch - item.hp;
                        if (diff <= 20) {
                            score += 50 - diff; // Slight leniency for very minor deficits
                        } else {
                            score -= 300; // Strong penalty for significantly low HP
                        }
                    }
                } else if (itemStr.includes(String(item.hp)) || rawSearch.includes(String(item.hp))) {
                    score += 100;
                }
            }
            if (targetVolts > 0 && item.voltage) {
                const voltDiff = Math.abs(item.voltage - targetVolts);
                if (voltDiff === 0) score += 300;
                else if (voltDiff < 100) score += 150;
            }
            if (targetAmps > 0 && (item.npAmps || item.amps)) {
                const iAmps = item.npAmps || item.amps;
                const ampDiff = Math.abs(iAmps - targetAmps);
                if (ampDiff === 0) score += 300;
                else if (ampDiff < 5) score += 150;
            }
        }

        for (const t of tokens) {
            if (t.length < 3) continue;
            const ut = t.toUpperCase();
            if (itemTokens.some(it => it === ut)) score += 80;
            else if (itemModel.includes(ut) || ut.includes(itemModel)) score += 60;
            else if (itemStr.includes(ut)) score += 30;
        }
        if (itemModel === rawSearch) score += 500;

        if (score > maxScore) { maxScore = score; bestMatch = item; }
    }
    return maxScore > 40 ? bestMatch : null;
};
export const exactMatchExt = (catalog: any[], searchString: string) => {
    if (!searchString || !catalog?.length) return null;
    const needle = norm_ext(String(searchString));
    return catalog.find(item => norm_ext(String(item?.model || '')) === needle) || null;
};

