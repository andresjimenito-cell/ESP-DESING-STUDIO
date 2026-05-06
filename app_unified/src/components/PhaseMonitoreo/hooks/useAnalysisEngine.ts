import { useMemo } from 'react';
import { WellFleetItem, SystemParams, EspPump, HistoryMatchData } from '@/types';
import { 
    getWellHealthScore, computeWellCapacity, getPhase6Diagnosis 
} from '../utils/healthEngine';
import { fuzzyWellName } from '../utils/dataExtractors';
import { calculateTDH, calculateBaseHead, calculateSystemResults } from '@/utils';
import { FALLBACK_PUMP } from '../constants';

interface AnalysisEngineProps {
    fleet: WellFleetItem[];
    customDesigns: Record<string, SystemParams>;
    selectedWellId: string | null;
    params: SystemParams;
    providedPump: EspPump | null;
    searchTerm: string;
    dataFilter: string;
    healthFilter: string;
}

export const useAnalysisEngine = ({
    fleet,
    customDesigns,
    selectedWellId,
    params,
    providedPump,
    searchTerm,
    dataFilter,
    healthFilter
}: AnalysisEngineProps) => {

    const wellHealthMap = useMemo(() => {
        const map: Record<string, number> = {};
        fleet.forEach(well => {
            map[well.id] = getWellHealthScore(well, customDesigns, providedPump || FALLBACK_PUMP);
        });
        return map;
    }, [fleet, customDesigns, providedPump]);

    const sortedFleet = useMemo(() => {
        let filtered = fleet.filter(w => w.name.toUpperCase().includes(searchTerm.toUpperCase()));

        if (dataFilter === 'complete') filtered = filtered.filter(w => w.productionTest.hasMatchData && w.productionTest.pip > 0);
        if (dataFilter === 'missing') filtered = filtered.filter(w => !w.productionTest.hasMatchData || w.productionTest.pip <= 0);
        if (dataFilter === 'no-tests') filtered = filtered.filter(w => !w.productionTest.hasMatchData);

        if (healthFilter === 'healthy') filtered = filtered.filter(w => (wellHealthMap[w.id] || 0) >= 85);
        if (healthFilter === 'caution') filtered = filtered.filter(w => (wellHealthMap[w.id] || 0) >= 60 && (wellHealthMap[w.id] || 0) < 85);
        if (healthFilter === 'critical') filtered = filtered.filter(w => (wellHealthMap[w.id] || 0) < 60);

        return filtered.sort((a, b) => (wellHealthMap[a.id] || 0) - (wellHealthMap[b.id] || 0));
    }, [fleet, searchTerm, wellHealthMap, dataFilter, healthFilter]);

    const selectedWell = useMemo(() => fleet.find(w => w.id === selectedWellId), [selectedWellId, fleet]);

    const pump = useMemo(() => {
        if (!selectedWell) return providedPump || FALLBACK_PUMP;
        const normalizedName = selectedWell.name.toUpperCase().trim();
        let design: any = customDesigns[normalizedName] || customDesigns[Object.keys(customDesigns).find(k => fuzzyWellName(k) === fuzzyWellName(selectedWell.name)) || ''];

        if (design) {
            const findPump = (obj: any): EspPump | null => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                for (let k in obj) { const found = findPump(obj[k]); if (found) return found; }
                return null;
            }
            const p = findPump(design);
            if (p) return p;
        }
        return providedPump || FALLBACK_PUMP;
    }, [selectedWell, customDesigns, providedPump]);

    const wellMatchParams = useMemo(() => {
        if (!selectedWell) return params;
        const normalizedName = selectedWell.name.toUpperCase().trim();
        const designBase = customDesigns[normalizedName] || customDesigns[Object.keys(customDesigns).find(k => fuzzyWellName(k) === fuzzyWellName(selectedWell.name)) || ''] || params;

        const test = selectedWell.productionTest;
        const hasMatch = test.hasMatchData || (selectedWell.currentRate > 5);

        const mp: SystemParams = {
            ...designBase,
            wellbore: { ...params.wellbore, ...(designBase.wellbore || {}) },
            pressures: { ...params.pressures, ...(designBase.pressures || {}) },
            fluids: { ...params.fluids, ...(designBase.fluids || {}) },
            inflow: { ...params.inflow, ...(designBase.inflow || {}) },
            metadata: { ...designBase.metadata, wellName: selectedWell.name, date: test.date },
            historyMatch: hasMatch ? {
                rate: test.rate, frequency: test.freq, waterCut: test.waterCut, thp: test.thp, tht: test.tht,
                pip: test.pip, pd: test.hp || test.pdp, fluidLevel: 0, submergence: 0,
                pStatic: designBase.inflow?.pStatic || 0, startDate: test.date, matchDate: test.date, gor: test.gor
            } : undefined
        };
        return JSON.parse(JSON.stringify(mp));
    }, [selectedWell, params, customDesigns]);

    const wellDiagnostics = useMemo(() => {
        if (!selectedWell || !pump || !wellMatchParams.historyMatch) return null;
        const test = selectedWell.productionTest;
        const base = wellMatchParams;

        const freqRatio = test.freq / (pump.nameplateFrequency || 60);
        const bepAtFreq = (pump.bepRate || 1000) * freqRatio;
        const flowRatio = bepAtFreq > 0 ? test.rate / bepAtFreq : 1;

        let thrustStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        let thrustLabel = 'Normal (Stable)';
        if (flowRatio > 1.15) { thrustStatus = 'alert'; thrustLabel = 'UPTHRUST (High Risk)'; }
        else if (flowRatio < 0.70) { thrustStatus = 'alert'; thrustLabel = 'DOWNTHRUST (Instability)'; }
        else if (flowRatio > 1.08 || flowRatio < 0.85) { thrustStatus = 'caution'; thrustLabel = 'Marginal (Observe)'; }

        const freqRatio_30_60 = test.freq / 60;
        const bhpEst = (test.rate * (selectedWell.depthMD * 0.433) * 1.1) / (135770 * 0.65) * Math.max(1, Math.pow(freqRatio_30_60, 2.8));
        const motorLimit = (base.selectedMotor?.hp || 100) * Math.min(1.0, test.freq / 60);
        const motorLoad = motorLimit > 0 ? (bhpEst / motorLimit) * 100 : 85;

        let motorStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        if (motorLoad > 105) motorStatus = 'alert';
        else if (motorLoad > 90) motorStatus = 'caution';

        const qAdj = test.rate / freqRatio;
        const hBase = (pump.h0 + pump.h1 * qAdj + pump.h2 * qAdj ** 2 + pump.h3 * qAdj ** 3 + pump.h4 * qAdj ** 4 + pump.h5 * qAdj ** 5 + pump.h6 * qAdj ** 6) * pump.stages;
        const hTheo = hBase * (freqRatio ** 2);
        const hActual = selectedWell.depthMD * 0.433 * 0.9 + (test.thp * 2.31);

        const degPct = hTheo > 0 ? ((hTheo - hActual) / hTheo) * 100 : 0;
        let pumpStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        if (degPct > 15) pumpStatus = 'alert';
        else if (degPct > 8) pumpStatus = 'caution';

        const pb = base.fluids?.pb || 2200;
        const gasRisk = test.pip < pb * 1.1 ? (test.pip < pb ? 'alert' : 'caution') : 'optimal';

        return {
            thrust: { status: thrustStatus, label: thrustLabel, ratio: flowRatio * 100 },
            motor: { status: motorStatus, load: motorLoad },
            pump: { status: pumpStatus, degradation: Math.max(0, degPct) },
            gas: { status: gasRisk, pip: test.pip, pb },
            shaft: { status: motorLoad > 95 ? 'caution' : 'optimal' as any, load: motorLoad * 0.9 }
        };
    }, [selectedWell, pump, wellMatchParams]);

    const { curveData, matchPoint } = useMemo(() => {
        if (!selectedWell || !pump || !wellMatchParams.historyMatch) return { curveData: [], matchPoint: null };
        const test = selectedWell.productionTest;
        const steps = 50;
        const maxQ = (pump.maxRate || (pump as any).maxFlow || 3000) * 1.5;
        const data: any[] = [];

        for (let i = 0; i <= steps; i++) {
            const q = (maxQ / steps) * i;
            const point: any = { flow: q };
            const fRatio = test.freq / 60;
            const qAdj = q / fRatio;
            const hBase = (pump.h0 + pump.h1 * qAdj + pump.h2 * qAdj ** 2 + pump.h3 * qAdj ** 3 + pump.h4 * qAdj ** 4 + pump.h5 * qAdj ** 5 + pump.h6 * qAdj ** 6) * pump.stages;
            const hActual = hBase * (fRatio ** 2);
            point.headCurr = hActual > 0 ? hActual : null;
            try { point.systemCurve = calculateTDH(q, wellMatchParams); } catch (e) { }
            data.push(point);
        }

        const actualTDH = (test.pdp > 0 && test.pip > 0) ? (test.pdp - test.pip) / 0.43 : (test.thp * 2.31 + selectedWell.depthMD * 0.43 - test.pip * 2.31) / 0.43;
        return { curveData: data, matchPoint: { flow: test.rate, head: actualTDH } };
    }, [selectedWell, pump, wellMatchParams]);

    const operationalResults = useMemo(() =>
        selectedWell && pump && wellMatchParams.historyMatch ? calculateSystemResults(selectedWell.productionTest.rate, (selectedWell.productionTest.pip * 2.31) || 0, wellMatchParams, pump, selectedWell.productionTest.freq) : null,
        [selectedWell, pump, wellMatchParams]);

    const maxCapacityInfo = useMemo(() => {
        if (!selectedWell || !pump || selectedWell.status !== 'normal') return null;
        return computeWellCapacity(selectedWell, wellMatchParams, pump);
    }, [selectedWell, pump, wellMatchParams]);

    const { avgGlobalHealth, alertCount, globalEfficiency } = useMemo(() => {
        if (fleet.length === 0) return { avgGlobalHealth: 0, alertCount: 0, globalEfficiency: 0 };
        const alerts = fleet.filter(w => (wellHealthMap[w.id] || 0) < 40).length;
        const avg = Math.round(fleet.reduce((acc, w) => acc + (wellHealthMap[w.id] || 0), 0) / fleet.length);
        const runningWells = fleet.filter(w => w.currentRate > 5 && w.consumptionReal > 0);
        const totalTheo = runningWells.reduce((acc, w) => acc + (w.consumptionTheo || 0), 0);
        const totalReal = runningWells.reduce((acc, w) => acc + (w.consumptionReal || 0), 0);
        const efficiency = totalReal > 0 ? (totalTheo / totalReal) * 100 : 92.8;
        return { avgGlobalHealth: avg, alertCount: alerts, globalEfficiency: Math.round(Math.min(100, efficiency)) };
    }, [fleet, wellHealthMap]);

    return {
        wellHealthMap, sortedFleet, selectedWell, pump, wellMatchParams,
        wellDiagnostics, curveData, matchPoint, operationalResults,
        maxCapacityInfo, avgGlobalHealth, alertCount, globalEfficiency
    };
};
