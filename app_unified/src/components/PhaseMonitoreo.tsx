import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Activity, Gauge, Thermometer, Zap, AlertTriangle, ShieldCheck,
    Monitor, Clock, LayoutGrid, List, Search, ArrowUpRight,
    ArrowDownRight, MoreVertical, RefreshCw, Cpu, Cable,
    Waves, HardDrive, Bell, Info, ChevronLeft, ChevronRight, Target,
    History, BarChart3, TrendingUp, Filter, Download, Droplets, Database,
    Globe, Palette, Moon, Sun, Brain, Layers, Maximize2, Minimize2, ClipboardCheck, X, Trash2,
    Sparkles, Send, Settings, Lock as LockIcon
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Cell, ReferenceLine,
    LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import * as XLSX from 'xlsx';

import { SystemParams, EspPump, EspMotor, EspVSD, MonitoringEvent, WellHealthStatus, PredictiveData, ProductionTest, SurveyPoint, HistoryMatchData, WellFleetItem, PipeData } from '@/types';
import { calculateSystemResults, findIntersection, generateMultiCurveData, calculateTDH, calculateBaseHead, getShaftLimitHp, interpolateTVD, calculateFluidProperties, calculateOperatingRange, calculateAffinityHead, calculateSystemTDH, calculateAOF } from '@/utils';
import { PerformanceCurveMultiAxis } from './PerformanceCurveMultiAxis';
import { VisualESPStack } from './VisualESPStack';
import { Phase6 } from './Phase6';
import { useLanguage } from '@/i18n';
import { useTheme } from '@/theme';
import { CASING_CATALOG, TUBING_CATALOG } from '@/data';
import { SecureWrapper } from './SecureWrapper';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DesignDataImport } from './DesignDataImport';
import { MatchHistorico } from './MatchHistorico';
import { AiMemoryService } from '../services/AiMemoryService';

const getApiKey = () => {
    try {
        const env = (import.meta as any).env;
        const proc = (process as any);
        return proc.env?.API_KEY || proc.env?.GEMINI_API_KEY || env?.VITE_API_KEY || env?.VITE_GEMINI_API_KEY || "";
    } catch {
        return "";
    }
};

const genAI = new GoogleGenerativeAI(getApiKey());

const INITIAL_PARAMS: SystemParams = {
    metadata: {
        projectName: 'New Design 001',
        wellName: 'Well-X',
        engineer: '',
        company: '',
        date: new Date().toISOString().split('T')[0],
        comments: ''
    },
    wellbore: {
        correlation: 'Hagedorn-Brown',
        casing: CASING_CATALOG[0],
        tubing: TUBING_CATALOG[0],
        casingTop: 0, casingBottom: 0,
        tubingTop: 0, tubingBottom: 0,
        midPerfsMD: 0
    },
    fluids: {
        apiOil: 0, geGas: 0, waterCut: 0, geWater: 1.0, salinity: 0, pb: 0, gor: 0, glr: 0,
        isDeadOil: false, co2: 0, h2s: 0, n2: 0, sandCut: 0, sandDensity: 2.65,
        pvtCorrelation: 'Lasater', viscosityModel: 'Total Fluid',
        correlations: {
            viscDeadOil: 'Beggs-Robinson', viscSatOil: 'Beggs-Robinson', viscUnsatOil: 'Vasquez-Beggs',
            viscGas: 'Lee', viscWater: 'Matthews & Russell', oilDensity: 'Katz',
            gasDensity: 'Beggs', waterDensity: 'Beggs', pbRs: 'Lasater',
            oilComp: 'Vasquez-Beggs', oilFvf: 'Vasquez-Beggs', waterFvf: 'HP41C',
            zFactor: 'Dranchuk-Purvis', surfaceTensionOil: 'Baker-Swerdloff', surfaceTensionWater: 'Hough'
        }
    },
    inflow: {
        model: 'Productivity Index', staticSource: 'BHP', pStatic: 0, staticLevel: 0, ip: 0
    },
    pressures: { totalRate: 0, pht: 0, phc: 0, pumpDepthMD: 0 },
    targets: {
        min: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 50 },
        target: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 60 },
        max: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 60 }
    },
    activeScenario: 'target',
    surfaceTemp: 0, bottomholeTemp: 0,
    motorHp: 0,
    totalDepthMD: 0, survey: [],
    simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0, ipType: 'fixed', ipTarget: 0 }
};

interface Props {
    params: SystemParams;
    pump: EspPump | null;
    pumpCatalog?: EspPump[];
    motorCatalog?: EspMotor[];
    onBack: () => void;
    onNavigateToDesign?: (wellParams: SystemParams, pump?: EspPump | null) => void;

}

// --- MOCK DATA FOR DEMO ---
const MOCK_FLEET: WellFleetItem[] = [];

// ── MODULE-LEVEL CACHE (survives component unmount/remount) ──────────
let _cachedFleet: WellFleetItem[] = [];
let _cachedDesigns: Record<string, SystemParams> = {};
let _cachedHistoricalData: Record<string, ProductionTest[]> = {};
let _dataLoaded = false;
// ─────────────────────────────────────────────────────────────────────

// --- CAPACITY SIMULATION HELPER ---
// --- CAPACITY SIMULATION HELPER (Optimized with basic memoization logic) ---
const computeWellCapacity = (well: WellFleetItem, wellMatchParams: SystemParams, pump: EspPump) => {
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
    let limitingFactor = 'Operación en Punto de Diseño';
    let estimatedMaxRate = test.rate;

    // OPTIMIZACIÓN: Saltamos de a 2 Hz para reducir carga computacional en un 50%
    for (let simFreq = currentFreq + 2; simFreq <= 80; simFreq += 2) {
        const ratio = simFreq / baseFreq;
        const maxExpectedFlow = (pump.maxGraphRate || 6000) * ratio;
        const steps = 30; // Reducido de 60 a 30 (Suficiente precisión para monitoreo)
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

// --- AI DIAGNOSTIC HELPERS ---
const getPhase6Diagnosis = (well: WellFleetItem, params: SystemParams, pump: EspPump | null) => {
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

const getOptimizationPath = (well: WellFleetItem, capacity: any, pump: EspPump | null) => {
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
// --- AI PREDICTIVE WIDGET ---
// --- AI PREDICTIVE WIDGET (Optimized with useMemo) ---
const PredictiveWidget = ({ selectedWell, wellMatchParams, pump, computeWellCapacity, getOptimizationPath }: any) => {
    const [isMinimized, setIsMinimized] = useState(false);

    // Solo calculamos si el widget está expandido para ahorrar CPU
    const analysisData = useMemo(() => {
        if (isMinimized || !selectedWell || !pump) return null;

        const mp: SystemParams = {
            ...wellMatchParams,
            historyMatch: {
                ...wellMatchParams.historyMatch,
                rate: selectedWell.productionTest.rate || 0.1,
                frequency: selectedWell.productionTest.freq || 60,
                pip: selectedWell.productionTest.pip || 0,
                waterCut: selectedWell.productionTest.waterCut || 0,
                pStatic: wellMatchParams.inflow?.pStatic || 0,
            } as any
        };

        const capacity = computeWellCapacity(selectedWell, mp, pump);
        const { advice, warning } = getOptimizationPath(selectedWell, capacity, pump);

        const currentRate = selectedWell.productionTest.rate || 0.1;
        const currentFreq = selectedWell.productionTest.freq || 60;
        const ratio = currentFreq / (pump?.nameplateFrequency || 60);
        const isDownthrust = currentRate < (pump?.minRate || 0) * ratio * 0.95;
        const isUpthrust = currentRate > (pump?.maxRate || 2000) * ratio * 1.05;

        return { capacity, advice, warning, isDownthrust, isUpthrust };
    }, [isMinimized, selectedWell?.id, pump?.id, wellMatchParams?.inflow?.pStatic]);

    useEffect(() => {
        setIsMinimized(false);
        const timer = setTimeout(() => setIsMinimized(true), 10000);
        return () => clearTimeout(timer);
    }, [selectedWell?.id]);

    if (isMinimized) {
        return (
            <div className="absolute top-24 right-8 z-50 pointer-events-auto">
                <button
                    onClick={() => setIsMinimized(false)}
                    className="glass-surface border border-primary/30 bg-gradient-to-tr from-primary/20 to-transparent rounded-full p-4 shadow-[0_20px_40px_rgba(34,211,238,0.4)] hover:bg-primary/20 transition-all flex items-center justify-center animate-pulse"
                >
                    <Brain className="w-6 h-6 text-primary drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                </button>
            </div>
        );
    }

    if (!analysisData) return null;

    const { capacity, advice, warning, isDownthrust, isUpthrust } = analysisData;
    const thrustMsg = (!isDownthrust && !isUpthrust) ? 'en su Ventana Operativa' : (isDownthrust ? 'en Zona de Downthrust' : 'en Zona de Upthrust');

    return (
        <div className="absolute top-24 right-8 z-40 pointer-events-none animate-slideUp">
            <div className="glass-surface border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface rounded-[2rem] rounded-tr-xl p-6 shadow-[0_30px_50px_-10px_rgba(34,211,238,0.4)] w-[420px] flex flex-col gap-4 group transition-all backdrop-blur-3xl relative pointer-events-auto">
                <button onClick={() => setIsMinimized(true)} className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-primary border border-primary/20 bg-primary/5 transition-all z-10">
                    <Minimize2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-4 border-b border-white/5 pb-4 pr-10">
                    <div className="p-3 bg-primary/20 rounded-xl ring-1 ring-primary/40 animate-[pulse_3s_ease-in-out_infinite]">
                        <Brain className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-black text-primary tracking-[0.2em] uppercase">Análisis Predictivo IA</h3>
                        <div className="flex gap-2 mt-1">
                            {isDownthrust && <span className="px-2 py-0.5 bg-warning/20 border border-warning/40 rounded text-[10px] font-black text-warning tracking-widest uppercase animate-pulse">DOWNTHRUST</span>}
                            {isUpthrust && <span className="px-2 py-0.5 bg-danger/20 border border-danger/40 rounded text-[10px] font-black text-danger tracking-widest uppercase animate-pulse">UPTHRUST</span>}
                            <span className={`px-2 py-0.5 border rounded text-[10px] font-black tracking-widest uppercase ${(!isDownthrust && !isUpthrust) ? 'bg-success/20 border-success/40 text-success' : 'bg-white/5 border-white/10 text-txt-muted'}`}>
                                {(!isDownthrust && !isUpthrust) ? 'ÓPTIMO' : 'ALERTA'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="text-[13px] text-txt-main/90 font-medium leading-relaxed">
                    Bomba <strong>{pump?.model}</strong> opera <strong>{thrustMsg}</strong>.
                    <span className="block mt-2 text-primary/90 font-black text-sm">{advice}</span>
                    {warning && <span className="block mt-2.5 font-bold text-warning border-l-2 border-warning/40 pl-3 bg-warning/5 py-1.5 rounded-r-md">{warning}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 bg-canvas/30 -mx-6 -mb-6 p-5 rounded-b-[2rem]">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-txt-muted font-black opacity-60">Límite Seguro VSD</span>
                        <div className="text-2xl font-black text-white leading-none mt-1.5">{Math.round(capacity?.maxRate || 0)} <span className="text-[11px] text-txt-muted font-bold">BPD @ {Math.round(capacity?.maxFreq || 60)}Hz</span></div>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase tracking-widest text-txt-muted font-black opacity-60">Opt. Potencial</span>
                        <div className="text-2xl font-black text-success leading-none mt-1.5">+{Math.round(capacity?.potentialGain || 0)} <span className="text-[11px] text-success/60 font-bold">BPD</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const MetricCard = ({ label, value, unit, icon: Icon, color = 'primary', alert = false }: any) => (
    <div className={`glass-surface rounded-2xl border ${alert ? 'border-danger/50 shadow-glow-danger/20' : 'border-white/5'} p-4 flex flex-col justify-between h-28 relative overflow-hidden group transition-all`}>
        <div className={`absolute -right-4 -top-4 w-16 h-16 ${color === 'primary' ? 'bg-primary/5' : color === 'secondary' ? 'bg-secondary/5' : 'bg-danger/5'} blur-2xl rounded-full`}></div>
        <div className="flex justify-between items-start z-10">
            <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-60">{label}</span>
            <Icon className={`w-4 h-4 ${color === 'primary' ? 'text-primary' : color === 'secondary' ? 'text-secondary' : 'text-danger'} ${alert ? 'animate-pulse' : ''}`} />
        </div>
        <div className="mt-auto z-10">
            <div className={`text-2xl font-black ${alert ? 'text-danger' : 'text-txt-main'} tracking-tighter`}>{value} <small className="text-[10px] text-txt-muted uppercase">{unit}</small></div>
        </div>
    </div>
);

const HealthTagLabels: any = {
    normal: 'Operativo',
    caution: 'Advertencia',
    alert: 'Crítico',
    failure: 'Falla',
    active: 'Activo',
    inactive: 'Inactivo',
    'ground-fault': 'Falla Tierra',
    error: 'Error Sensor'
};

const HealthTag = ({ status, label }: { status: string, label: string }) => {
    const colors: any = {
        normal: 'bg-success/20 text-success border-success/30 shadow-glow-success/10',
        caution: 'bg-warning/20 text-warning border-warning/30',
        alert: 'bg-danger/20 text-danger border-danger/30 shadow-glow-danger/10',
        failure: 'bg-magenta/20 text-magenta border-magenta/30',
        active: 'bg-primary/20 text-primary border-primary/30',
        inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        'ground-fault': 'bg-danger/40 text-danger border-danger/50 animate-pulse',
        error: 'bg-magenta/40 text-magenta border-magenta/50'
    };
    const displayLabel = HealthTagLabels[status] || status.toUpperCase();
    return (
        <div className="flex items-center justify-between gap-12 w-full">
            <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-60">{label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${colors[status] || colors.inactive}`}>
                {displayLabel}
            </span>
        </div>
    );
};

// --- HEALTH CALCULATION UTILITY ---
// --- RIGOROUS HEALTH CALCULATION UTILITY ---
const getWellHealthScore = (well: WellFleetItem, customDesigns?: Record<string, any>, defaultPump?: any) => {
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

    // We dramatically soften power/rate deviation penalties to avoid false "Yellow/Orange" alerts 
    // when the well is physically operating fine just because a rigid target was missed.
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

    // Physical constraints like low PIP are still highly valid 
    if (well.productionTest.pip > 0) {
        if (well.productionTest.pip < 100) performanceScore -= 50; // Critical gas lock risk
        else if (well.productionTest.pip < 200) performanceScore -= 20;
    }

    const totalScore = (componentHealth * 0.70) + (Math.max(0, performanceScore) * 0.30);

    let finalScore = totalScore;

    // VERY STRICT INTELLIGENCE: Evaluate Downthrust/Upthrust based on active pump
    if (customDesigns && defaultPump) {
        const nrm = (s: string) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const wellNorm = nrm(well.name);
        const design = Object.entries(customDesigns).find(([k]) => nrm(k) === wellNorm)?.[1];
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

        // If physically destroying equipment in downthrust or choking in upthrust, penalize strictly!
        if (isDownthrust || isUpthrust) {
            finalScore = Math.min(finalScore, 55); // Forces Orange/Warning
        }

        // Evaluate Motor Overload dynamically
        if (motor && motor.hp) {
            const depth = well.depthMD || 8000;
            const bhpEst = (currentRate * (depth * 0.433) * 0.9) / (135770 * 0.65); // Standard ESP power heuristic
            const motorLimit = motor.hp * (currentFreq / 60);

            if (motorLimit > 0) {
                const loadPct = (bhpEst / motorLimit) * 100;
                if (loadPct > 105) finalScore = Math.min(finalScore, 30); // Danger / Red
                else if (loadPct > 95) finalScore = Math.min(finalScore, 55); // Caution / Orange 
            }
        }
    }

    const criticalFailure = [well.health.pump, well.health.motor, well.health.cable].some(s => s === 'alert' || s === 'failure' || s === 'ground-fault');

    return Math.round(Math.max(0, Math.min(100, criticalFailure ? Math.min(finalScore, 35) : finalScore)));
};


// --- FALLBACK EQUIPMENT FOR DEMO ---

const FALLBACK_PUMP: EspPump = {
    id: 'DEMO-PUMP', manufacturer: 'REDA', series: '538', model: 'DN1200', stages: 120,
    minRate: 800, bepRate: 1200, maxRate: 1600, maxEfficiency: 72, maxHead: 50, maxGraphRate: 2000,
    nameplateFrequency: 60,
    h0: 51.5, h1: -0.002, h2: -0.000018, h3: 0, h4: 0, h5: 0, h6: 0,
    p0: 0.15, p1: 0.0001, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0,
    maxFlow: 1600
};

const MetricSummaryCard = ({ label, value, unit, icon: Icon, color = 'primary' }: any) => {
    const glowClass = color === 'primary' ? 'group-hover:shadow-glow-primary/40' : color === 'secondary' ? 'group-hover:shadow-glow-secondary/40' : 'group-hover:shadow-glow-danger/40';
    const borderHover = color === 'primary' ? 'group-hover:border-primary/50' : color === 'secondary' ? 'group-hover:border-secondary/50' : 'group-hover:border-danger/50';

    return (
        <div className={`glass-surface rounded-[2.5rem] border border-white/5 p-6 flex items-center gap-6 shadow-2xl transition-all duration-700 flex-1 min-w-[220px] relative overflow-hidden group ${glowClass} ${borderHover}`}>
            {/* Ambient Background Gradient Glows */}
            <div className={`absolute -right-8 -top-8 w-40 h-40 ${color === 'primary' ? 'bg-primary/25' : color === 'secondary' ? 'bg-secondary/25' : 'bg-danger/25'} blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-1000`}></div>
            <div className={`absolute -left-12 -bottom-12 w-32 h-32 ${color === 'primary' ? 'bg-primary/15' : color === 'secondary' ? 'bg-secondary/15' : 'bg-danger/15'} blur-[40px] rounded-full opacity-30 transition-transform duration-1000 delay-150`}></div>

            {/* Themed Internal Overlay Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${color === 'primary' ? 'from-primary/5 via-transparent to-primary/5' : color === 'secondary' ? 'from-secondary/5 via-transparent to-secondary/5' : 'from-danger/5 via-transparent to-danger/5'} opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>

            {/* Icon Container with Dynamic Theme Ring */}
            <div className={`p-4 rounded-[1.5rem] ${color === 'primary' ? 'bg-primary/15 text-primary border-primary/30 shadow-glow-primary/20' : color === 'secondary' ? 'bg-secondary/15 text-secondary border-secondary/30 shadow-glow-secondary/20' : 'bg-danger/15 text-danger border-danger/30 shadow-glow-danger/20'} border relative z-10 transition-all duration-500 group-hover:rotate-6`}>
                <Icon className="w-7 h-7" />
                {/* Micro pulse effect on icon ring */}
                <div className={`absolute inset-0 rounded-[1.5rem] border-2 ${color === 'primary' ? 'border-primary' : color === 'secondary' ? 'border-secondary' : 'border-danger'} opacity-0 group-hover:animate-ping opacity-20`}></div>
            </div>

            <div className="flex flex-col relative z-20">
                <span className={`text-[10px] font-black uppercase tracking-[0.25em] mb-1.5 transition-colors duration-500 ${color === 'primary' ? 'text-primary/70 group-hover:text-primary' : color === 'secondary' ? 'text-secondary/70 group-hover:text-secondary' : 'text-danger/70 group-hover:text-danger'}`}>{label}</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-txt-main tracking-tighter leading-none drop-shadow-sm">{value}</span>
                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40 leading-none group-hover:opacity-100 group-hover:text-txt-main transition-all">{unit}</span>
                </div>
            </div>

            {/* Bottom Shine Line */}
            <div className={`absolute bottom-0 left-10 right-10 h-[2px] ${color === 'primary' ? 'bg-gradient-to-r from-transparent via-primary/60 to-transparent' : color === 'secondary' ? 'bg-gradient-to-r from-transparent via-secondary/60 to-transparent' : 'bg-gradient-to-r from-transparent via-danger/60 to-transparent'} opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
        </div>
    );
};

const DiagnosticBadge = ({ well, health, normalWellCapacity }: { well: WellFleetItem, health: number, normalWellCapacity?: any }) => {
    const isRunning = well.currentRate > 5;
    if (!isRunning) return <div className="flex items-center gap-2 bg-surface-light/50 px-3 py-1 rounded-full text-txt-muted opacity-40 font-black text-[8px] uppercase tracking-widest border border-surface-light"><Clock className="w-2.5 h-2.5" /> Standby</div>;

    if (health >= 85) return <div className="flex items-center gap-2 bg-success/10 px-3 py-1 rounded-full text-success font-black text-[8px] uppercase tracking-widest border border-success/20 shadow-glow-success/5"><ShieldCheck className="w-2.5 h-2.5" /> Optimized</div>;

    // Identify Cause
    let cause = "Investigate";
    if (well.health.pump !== 'normal') cause = `Pump: ${well.health.pump.toUpperCase()}`;
    else if (well.health.motor !== 'normal') cause = `Motor: ${well.health.motor.toUpperCase()}`;
    else if (well.health.cable !== 'normal') cause = `Cable: ${well.health.cable.toUpperCase()}`;
    else if (well.productionTest.pip < 150) cause = "Gas Lock / Low PIP";
    else if (well.productionTest.pip < 300) cause = "Gas Intf.";
    else if (well.consumptionReal > well.consumptionTheo * 1.15) cause = "Overload";
    else if (well.currentRate < well.targetRate * 0.8) cause = "Prod. Drop";

    return <div className={`flex items-center gap-2 ${health < 40 ? 'bg-danger/10 text-danger border-danger/20' : 'bg-warning/10 text-warning border-warning/20'} px-3 py-1 rounded-full font-black text-[8px] uppercase tracking-widest border animate-pulse`}>
        <AlertTriangle className="w-2.5 h-2.5" /> {cause}
    </div>;
};

// --- MAIN COMPONENT ---
const s_ext = (val: any): string => (val == null ? '' : String(val).trim());
const d_ext = (val: any): string => {
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
const n_ext = (v: any): number => {
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
const norm_ext = (str: string) =>
    String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9_]/g, '');

const get_ext = (row: Record<string, any>, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    const normRowKeys = rowKeys.map(norm_ext);
    for (const key of keys) {
        const nk = norm_ext(key);
        // 1. Intento Exacto
        const idxExact = normRowKeys.indexOf(nk);
        if (idxExact !== -1) return row[rowKeys[idxExact]];

        // 2. Intento Parcial (Solo si el nombre es largo y no es una columna de presión crítica)
        const isCritical = nk.includes('PIP') || nk.includes('THP') || nk.includes('PDP');
        if (nk.length > 3 && !isCritical) {
            const idxPartial = normRowKeys.findIndex(nk2 => nk2 === nk || nk2.startsWith(nk + '_') || nk2.endsWith('_' + nk));
            if (idxPartial !== -1) return row[rowKeys[idxPartial]];
        }
    }
    return null;
};

const smartMatchExt = (catalog: any[], searchString: string, isMotor: boolean = false, targetHp: number = 0, targetVolts: number = 0, targetAmps: number = 0) => {
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

export const PhaseMonitoreo: React.FC<Props & { vsdCatalog?: EspVSD[] }> = ({ params, pump: providedPump, pumpCatalog = [], motorCatalog = [], vsdCatalog = [], onBack, onNavigateToDesign }) => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, cycleTheme, toggleLightMode } = useTheme();
    const [isBhaMinimized, setIsBhaMinimized] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFullMatch, setShowFullMatch] = useState(false);
    const [fleet, setFleet] = useState<WellFleetItem[]>(_cachedFleet);
    const [customDesigns, setCustomDesigns] = useState<Record<string, SystemParams>>(_cachedDesigns);
    const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'caution' | 'critical'>('all');
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [selectedWellId, setSelectedWellId] = useState<string | null>(null);
    const [isWellDropdownOpen, setIsWellDropdownOpen] = useState(false);
    const wellDropdownRef = React.useRef<HTMLDivElement>(null);
    const [wellViewMode, setWellViewMode] = useState<'monitoring' | 'history'>('monitoring');
    const [wellsHistoricalData, setWellsHistoricalData] = useState<Record<string, ProductionTest[]>>(_cachedHistoricalData);
    const [importProgress, setImportProgress] = useState<{ current: number, total: number, label: string } | null>(null);

    // ── Sync module cache whenever state changes ──────────────────
    useEffect(() => { _cachedFleet = fleet; }, [fleet]);
    useEffect(() => { _cachedDesigns = customDesigns; }, [customDesigns]);
    useEffect(() => { _cachedHistoricalData = wellsHistoricalData; }, [wellsHistoricalData]);

    // --- PERFORMANCE OPTIMIZATIONS: PRE-CALCULATED DATA ---
    const wellHealthMap = useMemo(() => {
        const map: Record<string, number> = {};
        fleet.forEach(well => {
            map[well.id] = getWellHealthScore(well, customDesigns, providedPump);
        });
        return map;
    }, [fleet, customDesigns, providedPump?.id]);

    const filteredFleet = useMemo(() => {
        let result = fleet;

        // Filter by health
        if (healthFilter !== 'all') {
            result = result.filter(well => {
                const h = wellHealthMap[well.id] || 0;
                if (healthFilter === 'healthy') return h > 85;
                if (healthFilter === 'caution') return h > 60 && h <= 85;
                if (healthFilter === 'critical') return h <= 60;
                return true;
            });
        }

        // Filter by search term (normalized)
        if (searchTerm.trim()) {
            const st = norm_ext(searchTerm);
            result = result.filter(well => norm_ext(well.name).includes(st) || norm_ext(well.id).includes(st));
        }

        return result;
    }, [fleet, healthFilter, searchTerm, wellHealthMap]);

    const sortedFleet = useMemo(() => {
        return [...filteredFleet].sort((a, b) => {
            const ha = wellHealthMap[a.id] || 0;
            const hb = wellHealthMap[b.id] || 0;
            return ha - hb; // Show critical first
        });
    }, [filteredFleet, wellHealthMap]);

    const toggleLanguage = () => setLanguage(language === 'en' ? 'es' : 'en');
    const toggleTheme = toggleLightMode;

    // AUTO-SELECT FIRST WELL when fleet loads and no well is selected
    useEffect(() => {
        if (fleet.length > 0 && !selectedWellId) {
            // Try to select the first well that has match data, otherwise just the first one
            const withMatch = fleet.find(w => w.productionTest.hasMatchData);
            setSelectedWellId(withMatch ? withMatch.id : fleet[0].id);
        }
    }, [fleet, selectedWellId]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wellDropdownRef.current && !wellDropdownRef.current.contains(event.target as Node)) {
                setIsWellDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const clearFleet = () => {
        setFleet([]);
        setCustomDesigns({});
        setSelectedWellId(null);
        setWellsHistoricalData({});
        _cachedFleet = [];
        _cachedDesigns = {};
        _cachedHistoricalData = {};
        _dataLoaded = false;
    };

    const importDesignRef = React.useRef<HTMLInputElement>(null);
    const importExcelDesignRef = React.useRef<HTMLInputElement>(null);
    const importDbRef = React.useRef<HTMLInputElement>(null);
    const importWellHistoryRef = React.useRef<HTMLInputElement>(null);

    // ──── AUTO-LOAD INITIAL FILES ON MOUNT ─────────────────────────
    useEffect(() => {
        // Skip if data was already loaded (cached from previous mount)
        if (_dataLoaded || fleet.length > 0) return;

        let mounted = true;
        const loadAutoFiles = async () => {
            try {
                setImportProgress({ current: 0, total: 100, label: 'Inicializando Centro de Control...' });
                await new Promise(r => setTimeout(r, 200));

                // 1. Cargar la Flota Base
                setImportProgress({ current: 10, total: 100, label: 'Sincronizando Base de Datos Maestra...' });
                const resDesigns = await fetch('/designs_precalc.json').catch(() => null);
                if (resDesigns && resDesigns.ok && mounted) {
                    const payload = await resDesigns.json();
                    await processExcelDesignsBuffer(payload, true, true);
                } else if (mounted) {
                    setImportProgress({ current: 15, total: 100, label: 'Leyendo Registro de Diseños (XLSX)...' });
                    const resExcel = await fetch('/DATAS DE DISEÑO.xlsx');
                    if (resExcel.ok) {
                        const buf = await resExcel.arrayBuffer();
                        await processExcelDesignsBuffer(new Uint8Array(buf), true, false);
                    }
                }

                await new Promise(r => setTimeout(r, 100));

                // 2. Cargar Pruebas de Producción SCADA
                setImportProgress({ current: 50, total: 100, label: 'Recuperando Telemetría SCADA...' });
                const resScada = await fetch('/scada_precalc.json').catch(() => null);
                if (resScada && resScada.ok && mounted) {
                    const payload = await resScada.json();
                    await processScadaBuffer(payload, true, true);
                } else if (mounted) {
                    setImportProgress({ current: 60, total: 100, label: 'Procesando Reportes de Producción...' });
                    const resExcel = await fetch('/PRUEBAS DE PRODUCCION.xlsx');
                    if (resExcel.ok) {
                        const buf = await resExcel.arrayBuffer();
                        await processScadaBuffer(new Uint8Array(buf), true, false);
                    }
                }

                if (mounted) {
                    setImportProgress({ current: 100, total: 100, label: 'Sistema Listo.' });
                    await new Promise(r => setTimeout(r, 400));
                    setImportProgress(null);
                    _dataLoaded = true;
                }
            } catch (err) {
                console.error("Error auto-loading standard files:", err);
                if (mounted) setImportProgress(null);
            }
        };

        // Delay inicial para suavizar la transición
        setTimeout(loadAutoFiles, 300);

        return () => { mounted = false; };
    }, []);
    // ─────────────────────────────────────────────────────────────

    const processExcelDesignsBuffer = async (data: any, isAutoLoad = false, isPrecalcJson = false) => {
        try {
            if (isAutoLoad && !isPrecalcJson) {
                setImportProgress({ current: 5, total: 100, label: 'Conectando Base de Datos Lenta (XLSX)...' });
                await new Promise(r => setTimeout(r, 500));
            }

            let json: any[] = [];
            let jsonSurvey: any[] = [];
            const surveyDataByWell: Record<string, SurveyPoint[]> = {};

            if (isPrecalcJson) {
                json = data.data || [];
                jsonSurvey = data.survey || [];
            } else {
                const workbook = XLSX.read(data, {
                    type: 'array',
                    cellFormula: false,
                    cellHTML: false,
                    cellText: false,
                    cellStyles: false
                });
                await new Promise(r => setTimeout(r, 200));

                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                json = XLSX.utils.sheet_to_json(sheet) as any[];

                const surveySheetName = workbook.SheetNames.find(s => {
                    const sn = String(s).toUpperCase();
                    return sn.includes('SURVEY') || sn.includes('TRAYEC') || sn.includes('DESVIACIÓN');
                });

                if (surveySheetName) {
                    const surveySheet = workbook.Sheets[surveySheetName];
                    let headerRow = 0;
                    for (let i = 0; i < 20; i++) {
                        const temp = XLSX.utils.sheet_to_json(surveySheet, { range: i, header: 1 }) as any[][];
                        if (temp.length > 0 && temp[0].some(c => String(c || '').toUpperCase().includes('DEPTH'))) {
                            headerRow = i; break;
                        }
                    }
                    jsonSurvey = XLSX.utils.sheet_to_json(surveySheet, { range: headerRow }) as any[];
                }
            }

            // Loop extract unified
            jsonSurvey.forEach((row: any) => {
                const wellColRaw = row['POZO'] || row['WELL'] || row['Pozo'];
                const wName = String(wellColRaw || 'UNKNOWN').toUpperCase().trim();

                const md = row['Measured Depth (ft)'] || row['MD (ft)'] || row['Measured Depth'] || row['MD'];
                const tvd = row['Vertical Depth (ft)'] || row['TVD (ft)'] || row['Vertical Depth'] || row['TVD'];
                const p = (v: any) => {
                    const raw = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : null);
                    return raw !== null && !isNaN(raw) ? Number(raw.toFixed(1)) : null;
                };
                const fm = p(md); const ft = p(tvd);

                if (fm !== null && ft !== null && !isNaN(fm)) {
                    if (!surveyDataByWell[wName]) surveyDataByWell[wName] = [];
                    surveyDataByWell[wName].push({ md: fm, tvd: ft });
                }
            });

            if (!isPrecalcJson) await new Promise(r => setTimeout(r, 100)); // YIELD before json extract

            if (json.length === 0) return;

            const newDesigns: Record<string, SystemParams> = {};
            const wellsToAdd: WellFleetItem[] = [];

            setImportProgress({ current: 0, total: json.length, label: 'Iniciando análisis de flota...' });

            // Reducimos el chunkSize de 15 a 8 para máxima fluidez en la UI
            const chunkSize = 8;
            for (let i = 0; i < json.length; i += chunkSize) {
                const chunk = json.slice(i, i + chunkSize);

                setImportProgress({
                    current: i,
                    total: json.length,
                    label: `Analizando configuraciones: ${i} de ${json.length} pozos...`
                });

                // Aumentamos ligeramente el delay para asegurar repintado del navegador
                await new Promise(resolve => setTimeout(resolve, 5));

                chunk.forEach((row, idx) => {
                    const wellName = String(get_ext(row, ['POZO', 'WELL']) || `WELL-${i + idx}`).toUpperCase().trim();
                    if (!wellName) return;

                    // --- LÓGICA DE RUNS (NICK) ---
                    const nickName = String(get_ext(row, ['NICK', 'NOMBRE_NICK']) || wellName).toUpperCase().trim();
                    let runNumber = 0;
                    if (nickName.includes('#')) {
                        const parts = nickName.split('#');
                        runNumber = parseInt(parts[parts.length - 1], 10) || 0;
                    } else if (wellName === nickName) {
                        // Si el Nick es igual al pozo y no tiene #, asumimos Run 0 o 1
                        runNumber = 1;
                    }

                    const pStatic = n_ext(get_ext(row, ['P ESTATICA (PSI)', 'P ESTATICA', 'STATIC PRESSURE', 'PESTATICA']));
                    const pipMin = n_ext(get_ext(row, ['PIP MINIMA (PSI)', 'PIP MINIMA', 'PIPMINIMA', 'MIN PIP']));
                    const ip = n_ext(get_ext(row, ['IP (BFPD/PSI)', 'IP (BFP/PSI)', 'PRODUCTIVITY INDEX', 'PI (BFPD/PSI)']));
                    const ipMin = n_ext(get_ext(row, ['IP MÍN (BFPD/PSI)', 'IP MIN (BFPD/PSI)', 'IP MIN', 'IP MÍN', 'MIN IP']));
                    const bsw_raw = get_ext(row, ['BSW (%)', 'WATER CUT (%)', 'BSW', 'CORTE DE AGUA', 'BSW PRUEBA', 'BSW_PRUEBA', 'CORTE AGUA', 'CORTE_AGUA']);
                    let bsw = n_ext(bsw_raw);
                    // Normalización: Si el dato viene como decimal (0.98) lo convertimos a porcentaje (98)
                    if (bsw > 0 && bsw <= 1.0) bsw = bsw * 100;
                    const gor = n_ext(get_ext(row, ['GOR (SCF/STB)', 'GOR (SCFSTB)', 'GOR']));
                    const intakeMD = n_ext(get_ext(row, ['PROFUNDIDAD DE INTAKE MD (FT)', 'INTAKE MD', 'INTAKEMD']));
                    const fondoMD = n_ext(get_ext(row, ['PROFUNDIDAD TOTAL MD (FT)', 'PROFUNDIDAD TOTAL MD', 'FONDO MD', 'TOTAL DEPTH', 'PROFUNDIDADTOTALMD', 'PROFUNDIDAD TOTAL', 'PROFUNDIDAD TOTAL (FT)'])) || (intakeMD + 1000);
                    const bht = n_ext(get_ext(row, ['BHT (°F)', 'BHT']));
                    const tht = n_ext(get_ext(row, ['THT (°F)', 'THT']));
                    const api = n_ext(get_ext(row, ['°API', 'API']));
                    const topPerfs = n_ext(get_ext(row, ['TOPE DE PERFORADOS MD (FT)', 'TOPE DE PERFORADOS MD', 'TOPEDEPERFORADOS', 'TOPE DE PERFORADOS']));
                    const pbValue = n_ext(get_ext(row, ['P BURBUJA (PSI)', 'PBURBUJA', 'P BURBUJA', 'PB']));

                    const rate = (ipv: number) => Number((Math.max(0, ipv * Math.max(0, pStatic - pipMin) * 0.60)).toFixed(1));
                    const cleanIp = (v: number) => Number((v).toFixed(1));

                    const mapPipe = (catalog: any[], descLabels: string[], odLabels: string[], defaultOD: number): PipeData => {
                        let odVal = n_ext(get_ext(row, odLabels));
                        if (odVal === 0) odVal = defaultOD;
                        const rawDesc = String(get_ext(row, descLabels) || '').toUpperCase();

                        const options = catalog.filter(p => Math.abs(p.od - odVal) < 0.05);
                        let selected = options.length > 0 ? options[0] : catalog.find(c => Math.abs(c.od - defaultOD) < 0.05) || catalog[0];

                        if (options.length > 1) {
                            let extractedWeight = 0;
                            const weightMatch = rawDesc.match(/(?:X|\s|#|^)(\d+(?:\.\d+)?)\s*(?:#|LB|LBS)/i) || rawDesc.match(/X\s*(\d+(?:\.\d+)?)/i);
                            if (weightMatch) extractedWeight = parseFloat(weightMatch[1]);

                            const grades = ['K55', 'J55', 'N80', 'L80', 'P110', 'C95', 'K-55', 'J-55', 'N-80', 'L-80', 'P-110', 'C-95'];
                            const foundGrade = grades.find(g => rawDesc.replace(/[-\s]/g, '').includes(g.replace(/[-\s]/g, '')));

                            let bestScore = -1;
                            let bestMatch = selected;
                            for (const opt of options) {
                                let score = 0;
                                if (extractedWeight > 0 && Math.abs(opt.weight - extractedWeight) < 0.2) score += 500;
                                if (foundGrade && opt.description.replace(/[-\s]/g, '').includes(foundGrade.replace(/[-\s]/g, ''))) score += 300;
                                if (score > bestScore) { bestScore = score; bestMatch = opt; }
                            }
                            selected = bestMatch;
                        }
                        return selected;
                    };

                    const casing = mapPipe(CASING_CATALOG, ['DESCRIPCION CSG', 'CSG DESC'], ['CSG OD', 'CSG OD (IN)'], 7);
                    const tubing = mapPipe(TUBING_CATALOG, ['DESCRIPCION TBG', 'TBG DESC'], ['TBG OD', 'TBG OD (IN)'], 3.5);

                    const design: SystemParams = {
                        ...INITIAL_PARAMS,
                        metadata: { ...INITIAL_PARAMS.metadata, wellName, projectName: nickName, comments: `Run: ${runNumber}` },
                        wellbore: {
                            ...INITIAL_PARAMS.wellbore,
                            tubingBottom: intakeMD, casingBottom: fondoMD,
                            midPerfsMD: topPerfs || (intakeMD + 200),
                            casing, tubing
                        },
                        fluids: { ...INITIAL_PARAMS.fluids, apiOil: api || 30, waterCut: bsw, gor, pb: pbValue, isDeadOil: pbValue <= 0 },
                        inflow: { ...INITIAL_PARAMS.inflow, pStatic, ip },
                        pressures: { ...INITIAL_PARAMS.pressures, totalRate: rate(ip), pumpDepthMD: intakeMD, pht: 80 },
                        survey: surveyDataByWell[wellName] || surveyDataByWell['UNKNOWN'] || [],
                        targets: {
                            min: { rate: rate(ipMin || ip * 0.8), ip: cleanIp(ipMin || ip * 0.8), waterCut: bsw, gor, frequency: 50 },
                            target: { rate: rate(ip), ip: cleanIp(ip), waterCut: bsw, gor, frequency: 60 },
                            max: { rate: rate(ip * 1.25), ip: cleanIp(ip * 1.25), waterCut: bsw, gor, frequency: 70 }
                        },
                        bottomholeTemp: bht || 200, surfaceTemp: tht || 80
                    };

                    const pumpName = s_ext(get_ext(row, ['BOMBA', 'PUMP']));
                    const stages = n_ext(get_ext(row, ['ETAPAS']));
                    const motorName = s_ext(get_ext(row, ['MOTOR']));
                    const motorHp = n_ext(get_ext(row, ['MOTOR HP', 'HP MOTOR', 'HP']));
                    const motorVolts = n_ext(get_ext(row, ['VOL', 'VOLTAGE', 'VOLTS', 'V', 'VOLTIOS', 'MOTOR VOL', 'MOTOR VOLTAGE']));
                    const motorAmps = n_ext(get_ext(row, ['AMP', 'AMPERAGE', 'AMPERIOS', 'A', 'MOTOR AMP', 'MOTOR AMPERAGE']));
                    const vsdName = s_ext(get_ext(row, ['VARIADOR', 'VFD', 'VSD', 'VARIABLE SPEED DRIVE']));

                    const foundPump = smartMatchExt(pumpCatalog, pumpName, false);
                    if (foundPump) {
                        (design as any).customPump = { ...foundPump, stages: stages || foundPump.stages || 100 };
                    }
                    const foundMotor = smartMatchExt(motorCatalog, motorName, true, motorHp, motorVolts, motorAmps);
                    if (foundMotor) {
                        design.selectedMotor = foundMotor;
                        design.motorHp = foundMotor.hp;
                    }
                    const foundVsd = smartMatchExt(vsdCatalog, vsdName, false);
                    if (foundVsd) {
                        design.selectedVSD = foundVsd;
                    }

                    // Usamos nickName como llave primaria para evitar sobreescritura entre runs
                    newDesigns[nickName] = design;
                    wellsToAdd.push({
                        id: `EXCEL-${nickName}-${Date.now()}-${i + idx}`,
                        name: nickName,
                        status: 'normal',
                        health: { pump: 'normal', motor: 'normal', seal: 'normal', sensor: 'active', cable: 'normal' },
                        predictive: { ttf: 365, vsdStatus: 'optimal', vsdAnalysis: 'Excel Import', transformerStatus: 'optimal', transformerAnalysis: 'Normal', ventBoxStatus: 'optimal', ventBoxAnalysis: 'Normal' },
                        lastUpdate: new Date().toISOString(),
                        currentRate: 0,
                        targetRate: design.targets.target.rate,
                        consumptionReal: 0, consumptionTheo: 0,
                        depthMD: intakeMD,
                        productionTest: {
                            date: new Date().toISOString().split('T')[0],
                            rate: 0, freq: 0, thp: 0, tht: 0, waterCut: 0, pip: 0, pdp: 0, gor: 0, hp: 0, hasMatchData: false
                        }
                    });
                });
            }

            setImportProgress({ current: json.length, total: json.length, label: 'Finalizando actualización de interfaz...' });

            setCustomDesigns(prev => ({ ...prev, ...newDesigns }));
            setFleet(prev => {
                const merged = [...prev];
                wellsToAdd.forEach(nw => {
                    // Usamos el nick completo para la búsqueda exacta en la flota
                    const idx = merged.findIndex(w => w.name.toUpperCase() === nw.name.toUpperCase());
                    if (idx !== -1) merged[idx] = { ...merged[idx], ...nw };
                    else merged.push(nw);
                });
                return merged;
            });

            setImportProgress(null);
            if (!isAutoLoad) alert(`Éxito: Se procesaron ${json.length} pozos correctamente.`);

        } catch (err) {
            console.error("Error importing designs from Excel:", err);
            if (!isAutoLoad) alert("Error al procesar el archivo Excel de diseños.");
            setImportProgress(null);
        }
    };

    const handleImportExcelDesigns = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            await processExcelDesignsBuffer(data);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportDesign = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileList = Array.from(files);
        if (fileList.length === 1 && (fileList[0].name.endsWith('.xlsx') || fileList[0].name.endsWith('.xls'))) {
            handleImportExcelDesigns(e);
            return;
        }

        const newDesigns: Record<string, SystemParams> = {};
        const wellsToAdd: WellFleetItem[] = [];

        let processed = 0;
        fileList.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    if (!content) throw new Error("File empty");
                    const rawData = JSON.parse(content) as any;
                    if (!rawData || (typeof rawData !== 'object')) throw new Error("Invalid structure: Not an object");

                    let itemsToProcess: any[] = [];
                    if (Array.isArray(rawData)) {
                        itemsToProcess = rawData;
                    } else if (rawData.fleet && Array.isArray(rawData.fleet)) {
                        itemsToProcess = rawData.fleet;
                    } else if (rawData.data && Array.isArray(rawData.data)) {
                        itemsToProcess = rawData.data;
                    } else {
                        itemsToProcess = [rawData];
                    }

                    itemsToProcess.forEach((item, index) => {
                        const isProject = item.type === 'esp-studio-project';
                        const designPart = isProject && item.data?.params ? item.data.params : (item.params || item);
                        const pumpPart = isProject && item.data?.customPump ? item.data.customPump : (designPart.pump || item.pump || item.customPump);

                        // Extract well name safely and attempt deduplication using file.name
                        let rawName = designPart.metadata?.wellName || designPart.wellName || item.name;

                        // Fallbacks for default/empty names
                        if (!rawName || String(rawName).toUpperCase().includes('NUEVO_POZO') || rawName === 'WELL_NAME') {
                            rawName = file.name.replace('.json', '');
                        }

                        // If array inside a single file, append index
                        if (itemsToProcess.length > 1) {
                            rawName = `${rawName} (${index + 1})`;
                        }

                        let wellName = String(rawName).toUpperCase().trim();

                        // Deduplicate against other uploads in the same batch
                        let dedupCounter = 1;
                        let originalWellName = wellName;
                        while (newDesigns[wellName]) {
                            wellName = `${originalWellName}_${dedupCounter}`;
                            rawName = `${rawName} (${dedupCounter})`;
                            dedupCounter++;
                        }

                        const design: any = {
                            ...INITIAL_PARAMS,
                            ...designPart,
                            wellName: rawName
                        };
                        if (pumpPart) design.pump = pumpPart;

                        newDesigns[wellName] = design;

                        wellsToAdd.push({
                            id: `JSON-${wellName}-${Date.now()}-${processed}-${index}`,
                            name: rawName,
                            status: (design.historyMatch?.rate > 0) ? (design.healthStatus || 'normal') : 'inactive',
                            health: design.health || { pump: 'normal', motor: 'normal', seal: 'normal', sensor: 'active', cable: 'normal' },
                            predictive: design.predictive || { ttf: 365, vsdStatus: 'optimal', vsdAnalysis: 'Manual Import', transformerStatus: 'optimal', transformerAnalysis: 'Normal', ventBoxStatus: 'optimal', ventBoxAnalysis: 'Normal' },
                            lastUpdate: new Date(design.metadata?.date || Date.now()).toISOString(),
                            currentRate: design.historyMatch?.rate || 0,
                            targetRate: design.targets?.target?.rate || 0,
                            consumptionReal: design.powerReal || 0,
                            consumptionTheo: design.powerTheo || 0,
                            depthMD: design.pressures?.pumpDepthMD || design.wellbore?.midPerfsMD || design.depthMD || 0,

                            productionTest: {
                                date: design.historyMatch?.matchDate || new Date().toISOString().split('T')[0],
                                rate: design.historyMatch?.rate || 0,
                                freq: design.historyMatch?.frequency || 0,
                                pip: design.historyMatch?.pip || 0,
                                thp: design.historyMatch?.thp || 0,
                                waterCut: design.historyMatch?.waterCut || 0,
                                gor: design.historyMatch?.gor || 0,
                                hp: 0,
                                pdp: design.historyMatch?.pdp || 0,
                                tht: design.historyMatch?.tht || 0,
                                hasMatchData: !!(design.historyMatch?.rate > 5 || (design.historyMatch?.pip > 0 && design.historyMatch?.thp > 0))
                            }
                        });
                    });

                } catch (err) {
                    console.error("Error parsing design:", file.name, err);
                } finally {

                    processed++;
                    if (processed === fileList.length) {
                        setCustomDesigns(prev => ({ ...prev, ...newDesigns }));
                        setFleet(prev => {
                            const normalizeWellName = (s: string) => s.toUpperCase().replace(/[-_\s]/g, '').trim();
                            const merged = [...prev];

                            wellsToAdd.forEach(nw => {
                                const normalizedNw = normalizeWellName(nw.name);
                                const idx = merged.findIndex(w => normalizeWellName(w.name) === normalizedNw);
                                if (idx !== -1) {
                                    // Update existing design
                                    merged[idx] = { ...merged[idx], ...nw };
                                } else {
                                    merged.push(nw);
                                }
                            });

                            // Silent update, no alert
                            return [...merged];
                        });

                        if (wellsToAdd.length > 0) {
                            // Non-blocking upload: don't automatically select the first one
                            // setSelectedWellId(wellsToAdd[0].id);
                        }

                    }
                }
            };
            reader.readAsText(file);
        });
    };

    const processScadaBuffer = async (data: any, isAutoLoad = false, isPrecalcJson = false) => {
        try {
            if (isAutoLoad && !isPrecalcJson) {
                setImportProgress({ current: 15, total: 100, label: 'Descomprimiendo Históricos... Lento...' });
                await new Promise(r => setTimeout(r, 500));
            }

            let json: any[] = [];

            if (isPrecalcJson) {
                json = data;
            } else {
                const workbook = XLSX.read(data as Uint8Array, {
                    type: 'array',
                    cellFormula: false,
                    cellHTML: false,
                    cellText: false,
                    cellStyles: false
                });
                await new Promise(r => setTimeout(r, 100));

                setImportProgress({ current: 20, total: 100, label: 'Extrayendo hojas de telemetría...' });
                await new Promise(r => setTimeout(r, 50));

                for (const sheetName of workbook.SheetNames) {
                    const sheet = workbook.Sheets[sheetName];

                    // --- BUSCADOR DINÁMICO DE ENCABEZADOS ---
                    const previewRows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, blankrows: false }) as any[][];
                    let headerRowIdx = -1;
                    let dualHeaderRow: string[] = [];

                    for (let i = 0; i < Math.min(40, previewRows.length); i++) {
                        const row = (previewRows[i] || []).map(c => String(c || '').toUpperCase().trim());
                        const hasPozo = row.includes('POZO') || row.includes('WELL');
                        const hasFecha = row.includes('FECHA') || row.includes('DATE');
                        const hasRate = row.includes('BFPD') || row.includes('BOPD') || row.includes('PRODUCCION');

                        if (hasPozo && (hasFecha || hasRate)) {
                            headerRowIdx = i;
                            // Intentamos capturar la fila superior si parece ser un título de categoría (Dual Header)
                            if (i > 0) {
                                dualHeaderRow = (previewRows[i - 1] || []).map(c => String(c || '').toUpperCase().trim());
                            }
                            break;
                        }
                    }

                    if (headerRowIdx !== -1) {
                        // Si detectamos un dual header, combinamos las columnas para no perder información (ej: THP sobre psi)
                        const rowsRaw = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, header: 1 }) as any[][];
                        // Lógica de "Forward Fill" inteligente y combinada
                        let lastTopHeader = '';
                        const headers = (rowsRaw[0] || []).map((h, idx) => {
                            const sub = String(h || '').toUpperCase().trim();
                            const top = String(dualHeaderRow[idx] || '').toUpperCase().trim();

                            if (top) lastTopHeader = top;
                            const currentTop = top || lastTopHeader;

                            // Casos de combinación:
                            if (sub && currentTop) {
                                // Si sub es una unidad o genérico, usamos el top
                                if (['PSI', '°F', 'HZ', 'DIA', 'OPER', 'UNIT'].includes(sub)) return currentTop;
                                // Si son nombres distintos, los combinamos para evitar duplicados (ej: PRUEBA_BFPD)
                                if (sub !== currentTop) return `${currentTop}_${sub}`;
                                return sub;
                            }

                            return sub || currentTop || `COL_${idx}`;
                        });

                        console.log("[Excel Mapping] Encabezados Finales:", headers);

                        // Convertimos el resto de filas a objetos usando los nuevos encabezados
                        json = rowsRaw.slice(1).map(row => {
                            const obj: any = {};
                            headers.forEach((h, idx) => { obj[h] = row[idx]; });
                            return obj;
                        });

                        if (json.length > 0) break;
                    }
                }
            }

            if (json.length === 0) {
                setImportProgress(null);
                alert('El archivo Excel parece estar vacío o no se detectaron los encabezados (POZO, FECHA).');
                return;
            }

            setImportProgress({ current: 0, total: json.length, label: 'Sincronizando telemetría en tiempo real...' });
            const newProductionData: Record<string, ProductionTest[]> = {};

            const lastValidPipMap: Record<string, number> = {};

            // Bajamos chunkSize de 200 a 100 para evitar tirones
            const chunkSize = 100;
            for (let i = 0; i < json.length; i += chunkSize) {
                const chunk = json.slice(i, i + chunkSize);
                setImportProgress({ current: i, total: json.length, label: `Vinculando registros históricos: ${i} / ${json.length}...` });
                await new Promise(r => setTimeout(r, 5));

                chunk.forEach((row) => {
                    const name = String(get_ext(row, ['POZO', 'WELL', 'NAME', 'ID']) || '').trim();
                    if (!name) return;
                    const normName = name.toUpperCase().trim();

                    const date = d_ext(get_ext(row, ['FECHA', 'DATE', 'DATE OF TEST', 'TIMESTAMP']));
                    const rate = n_ext(get_ext(row, ['BFPD', 'GROSS RATE', 'RATE', 'CAUDAL', 'TASA DE PRUEBA', 'TASAPRUEBA', 'BFPD TEST']));
                    const bsw_raw = get_ext(row, ['BSW PRUEBA', 'BSW_PRUEBA', 'BSW_DIA', 'BSW', 'WATER CUT', 'WATERCUT', 'CORTE DE AGUA', 'B S W', 'CORTE AGUA', 'CORTE_AGUA', 'WATER_CUT']);
                    let bsw = n_ext(bsw_raw);
                    // Normalización: Si el dato viene como decimal (0.98) lo convertimos a porcentaje (98)
                    if (bsw > 0 && bsw <= 1.0) bsw = bsw * 100;

                    // Mapeo exacto para THP/THT usando los encabezados combinados
                    const thp = n_ext(get_ext(row, ['THP_PSI', 'THP', 'PRESION CABEZA', 'P-SURFACE', 'PHT']));
                    const tht = n_ext(get_ext(row, ['THT_°F', 'THT', 'TEMP CABEZA', 'T-SURFACE']));

                    // Normalización de Frecuencia (Hz) con Lógica PMM
                    const freqRaw = get_ext(row, ['FREC DE_OPER', 'FREC DE_DIA', 'FREC.PRUEBA', 'FRECUENCIA', 'FREQUENCY', 'H Z', 'HZ']);
                    let freq = n_ext(freqRaw) || 60;
                    if (freq > 80) freq = freq / 2; // Normalización PMM

                    // --- LÓGICA PIP PERSISTENTE ---
                    let pip = n_ext(get_ext(row, ['PIP_PSI', 'PIP', 'INTAKE PRESSURE', 'PI P', 'PRESION SUCCION']));
                    if (pip <= 0) {
                        pip = lastValidPipMap[normName] || 0;
                    } else {
                        lastValidPipMap[normName] = pip;
                    }

                    const pdp = n_ext(get_ext(row, ['PDESC', 'DISCHARGE PRESSURE', 'PDP', 'P-DISCHARGE', 'PD']));

                    const pt: ProductionTest = {
                        date: date || new Date().toISOString().split('T')[0],
                        rate,
                        freq,
                        pip, thp,
                        tht: tht || 80,
                        waterCut: bsw,
                        gor: 0, hp: 0, pdp,
                        hasMatchData: rate > 5 || (pip > 0 && thp > 0)
                    };

                    if (!newProductionData[normName]) newProductionData[normName] = [];
                    newProductionData[normName].push(pt);
                });
            }

            console.log("[SCADA Import] Distinct wells found in Excel:", Object.keys(newProductionData).length);

            let matchCount = 0;
            setFleet(prev => {
                const merged = [...prev];
                Object.entries(newProductionData).forEach(([wellName, tests]) => {
                    const latest = tests[tests.length - 1];
                    const normKey = norm_ext(wellName);

                    // --- LÓGICA DE RUTEO INTELIGENTE (RUN ACTUAL) ---
                    // Buscamos todos los candidatos que compartan el nombre base del pozo
                    const candidates = merged.filter(w => {
                        const baseName = w.name.split('#')[0].trim();
                        return norm_ext(baseName) === normKey;
                    });

                    if (candidates.length > 0) {
                        // El "Run Actual" es aquel cuyo nick tiene el número más alto después del #
                        let targetWell = candidates[0];
                        let maxRun = -1;

                        candidates.forEach(c => {
                            const parts = c.name.split('#');
                            const run = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) || 0 : 0;
                            if (run > maxRun) {
                                maxRun = run;
                                targetWell = c;
                            }
                        });

                        const idx = merged.findIndex(w => w.id === targetWell.id);
                        if (idx !== -1) {
                            merged[idx] = {
                                ...merged[idx],
                                currentRate: latest.rate,
                                productionTest: latest,
                                lastUpdate: latest.date
                            };
                            matchCount++;
                        }
                    }
                });
                console.log("[SCADA Import] Total fleet matches updated (Latest Run Only):", matchCount);
                return merged;
            });

            setCustomDesigns(prev => {
                const updated = { ...prev };
                Object.entries(newProductionData).forEach(([wellName, tests]) => {
                    const latest = tests[tests.length - 1];
                    const normKey = norm_ext(wellName);

                    // Identificar el Run Actual en el diccionario de diseños
                    const allDesignKeys = Object.keys(updated);
                    const candidates = allDesignKeys.filter(k => norm_ext(k.split('#')[0].trim()) === normKey);

                    if (candidates.length > 0) {
                        let targetKey = candidates[0];
                        let maxRun = -1;

                        candidates.forEach(k => {
                            const parts = k.split('#');
                            const run = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) || 0 : 0;
                            if (run > maxRun) {
                                maxRun = run;
                                targetKey = k;
                            }
                        });

                        updated[targetKey] = {
                            ...updated[targetKey],
                            metadata: {
                                ...updated[targetKey].metadata,
                                date: latest.date
                            },
                            historyMatch: {
                                rate: latest.rate, frequency: latest.freq,
                                thp: latest.thp, pip: latest.pip, pdp: latest.pdp,
                                waterCut: latest.waterCut, matchDate: latest.date,
                                startDate: latest.date, tht: latest.tht || 80,
                                hp: 0, gor: 0, pd: latest.pdp, fluidLevel: 0,
                                submergence: 0, pStatic: updated[targetKey].inflow.pStatic
                            }
                        };
                    }
                });
                return updated;
            });

            setWellsHistoricalData(prev => {
                const updated = { ...prev };
                Object.entries(newProductionData).forEach(([wellName, tests]) => {
                    updated[norm_ext(wellName)] = tests;
                });
                return updated;
            });

            if (!isAutoLoad) {
                if (matchCount > 0) {
                    alert(`Éxito: Se sincronizaron datos para ${matchCount} pozos de la flota.`);
                } else {
                    const firstFound = Object.keys(newProductionData)[0] || 'Desconocido';
                    alert(`Atención: No se encontraron coincidencias. El Excel tiene ${Object.keys(newProductionData).length} pozos (ej: "${firstFound}"), pero ninguno coincide con la flota actual. Verifique nombres.`);
                }
            }

            setImportProgress(null);

        } catch (err) {
            console.error("[SCADA Import] Error fatal:", err);
            if (!isAutoLoad) alert("Error técnico al procesar el archivo SCADA. Revise la consola.");
            setImportProgress(null);
        }
    };

    const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            await processScadaBuffer(data);
            e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    // ── GESTIÓN DE HISTORIAL DE PRODUCCIÓN (MATCH HISTORICO) ─────────────────
    const handleImportWellHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedWellId) return;

        console.log("[History Import] Process initiated for file:", file.name);
        const reader = new FileReader();
        const activeWell = fleet.find(w => w.id === selectedWellId);
        if (!activeWell) return;
        const normActiveName = norm_ext(activeWell.name);

        reader.onload = (event) => {
            const data = event.target?.result;
            let lines: string[] = [];

            try {
                let json: any[] = [];
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const workbook = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false, cellText: false, cellStyles: false });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    json = XLSX.utils.sheet_to_json(sheet);
                } else {
                    const content = new TextDecoder().decode(data as ArrayBuffer);
                    const workbook = XLSX.read(content, { type: 'string', cellFormula: false, cellHTML: false, cellText: false, cellStyles: false });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    json = XLSX.utils.sheet_to_json(sheet);
                }

                if (json.length === 0) {
                    alert("Archivo vacío o sin datos suficientes.");
                    return;
                }

                const rawTests: ProductionTest[] = json.map((row, i) => {
                    const rowWellNameRaw = get_ext(row, ['POZO', 'WELL', 'NOMBRES', 'NAME']);
                    const rowWellName = rowWellNameRaw ? String(rowWellNameRaw).trim() : '';

                    // If a well name is provided, it must match. If it's empty, we assume it belongs to the active well.
                    if (rowWellName && norm_ext(rowWellName) !== normActiveName) return null;

                    const date = d_ext(get_ext(row, ['FECHA', 'DATE', 'DATE OF TEST']));
                    const rate = n_ext(get_ext(row, ['BFPD', 'GROSS RATE', 'RATE', 'CAUDAL', 'TASA DE PRUEBA', 'TASAPRUEBA', 'BFPD TEST']));
                    const bsw_raw = get_ext(row, ['BSW PRUEBA', 'BSW_PRUEBA', 'BSW', 'WATER CUT', 'WATERCUT', 'CORTE DE AGUA', 'B S W', 'CORTE AGUA', 'CORTE_AGUA', 'WATER_CUT']);
                    let bsw = n_ext(bsw_raw);
                    // Normalización: Si el dato viene como decimal (0.98) lo convertimos a porcentaje (98)
                    if (bsw > 0 && bsw <= 1.0) bsw = bsw * 100;
                    const thp = n_ext(get_ext(row, ['THP', 'P-SURFACE', 'PHT', 'FHP', 'WHFP', 'PRESION CABEZA']));
                    const tht = n_ext(get_ext(row, ['THT', 'T-SURFACE', 'THT', 'WHT', 'TEMP CABEZA']));
                    const freq = n_ext(get_ext(row, ['FRECUENCIA', 'FREQUENCY', 'H Z', 'HZ', 'Hz']));
                    const pip = n_ext(get_ext(row, ['PIP', 'INTAKE PRESSURE', 'PI P', 'PRESION SUCCION', 'PIN']));
                    const pdp = n_ext(get_ext(row, ['PDESC', 'DISCHARGE PRESSURE', 'PDP', 'P-DISCHARGE', 'PD']));

                    return {
                        date: date || 'Unknown',
                        rate,
                        freq: freq || 60,
                        thp,
                        tht: tht || 80,
                        waterCut: bsw,
                        pip,
                        pdp,
                        gor: 0, hp: 0,
                        hasMatchData: rate > 5 || (pip > 0 && thp > 0)
                    } as ProductionTest;
                }).filter(t => t !== null) as ProductionTest[];

                if (rawTests.length > 0) {
                    // Update historical records
                    setWellsHistoricalData(prev => ({ ...prev, [norm_ext(activeWell.name)]: rawTests }));

                    // Automatically sync the fleet item and design with the LATEST record in the history file
                    const latest = rawTests[rawTests.length - 1];
                    setFleet(prev => prev.map(w => w.id === selectedWellId ? {
                        ...w,
                        currentRate: latest.rate,
                        productionTest: latest,
                        lastUpdate: new Date().toISOString()
                    } : w));

                    setWellViewMode('history');
                    alert(`Éxito: Se cargaron ${rawTests.length} registros históricos para ${activeWell.name}.`);
                } else {
                    console.log("[History Import] No matches found for:", activeWell.name);
                    alert(`Atención: No se encontraron registros para el pozo "${activeWell.name}". Verifique que los nombres coincidan.`);
                }
            } catch (err) {
                console.error("Error cargando historial:", err);
                alert("Error al procesar el archivo. Verifique el formato.");
            }
            // Reset input value to allow re-loading the same file
            e.target.value = '';
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    const selectedWell = useMemo(() => fleet.find(w => w.id === selectedWellId), [selectedWellId, fleet]);

    const pump = useMemo(() => {
        if (!selectedWell) return providedPump || FALLBACK_PUMP;
        const normalizedName = selectedWell.name.toUpperCase().trim();

        let design: any = customDesigns[normalizedName];

        // Strict fallback
        if (!design) {
            const shortName = normalizedName.replace(/^W-|^WELL-/, '');
            const key = Object.keys(customDesigns).find(k => {
                const kShort = k.replace(/^W-|^WELL-/, '');
                return kShort === shortName || k === normalizedName;
            });
            if (key) design = customDesigns[key];
        }

        if (design) {
            // Priority: recursive search for pump object
            const findPump = (obj: any): EspPump | null => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                for (let k in obj) {
                    const found = findPump(obj[k]);
                    if (found) return found;
                }
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

        // 1. Strict Search
        let designBase: SystemParams | null = customDesigns[normalizedName] || null;

        // 2. Controlled Greedy Search (only if no exact match)
        if (!designBase) {
            const shortName = normalizedName.replace(/^W-|^WELL-/, '');
            const key = Object.keys(customDesigns).find(k => {
                const kShort = k.replace(/^W-|^WELL-/, '');
                // Avoid false positives: "W-1" should NOT match "W-11"
                return kShort === shortName || k === normalizedName;
            });
            if (key) designBase = customDesigns[key];
        }

        // Final fallback to global designer state
        const base = designBase || params;

        const test = selectedWell.productionTest;
        const hasMatch = test.hasMatchData || (selectedWell.currentRate > 5);

        // HIGH-FIDELITY DEEP MERGE - CATEGORY BY CATEGORY
        // We ensure that each well has a UNIQUE SystemParams object
        // by merging the design baseline with the real-time field test data.
        const mp: SystemParams = {
            ...base,
            // Deep isolation of critical categories from the JSON design
            wellbore: { ...params.wellbore, ...(base.wellbore || {}) },
            pressures: { ...params.pressures, ...(base.pressures || {}) },
            fluids: { ...params.fluids, ...(base.fluids || {}) },
            inflow: { ...params.inflow, ...(base.inflow || {}) },

            // Metadata for identification
            metadata: {
                ...base.metadata,
                wellName: selectedWell.name,
                date: test.date
            },
            // Preservamos el caudal de diseño original del JSON
            targets: {
                ...base.targets,
                target: { ...base.targets.target }
            },
            // The History Match object is the CORE of the monitoring view
            historyMatch: hasMatch ? {
                rate: test.rate,
                frequency: test.freq,
                waterCut: test.waterCut,
                thp: test.thp,
                tht: test.tht,
                pip: test.pip,
                pd: test.hp || test.pdp,
                fluidLevel: 0,
                submergence: 0,
                pStatic: base.inflow?.pStatic || 0, // No inventar presión estática si no hay match
                startDate: test.date,
                matchDate: test.date,
                gor: test.gor
            } : undefined
        };

        return JSON.parse(JSON.stringify(mp)); // Kill all references to ensure isolation
    }, [selectedWell, params, customDesigns]);

    // The derived wellMatchParams is the SOLE TRUTH for the analysis engine.
    // By passing it directly, we ensure no stale state persists between selections    // --- DEEP DIAGNOSTICS ENGINE ---
    const wellDiagnostics = useMemo(() => {
        if (!selectedWell || !pump || !wellMatchParams.historyMatch) return null; // Only run if match data exists
        const test = selectedWell.productionTest;
        const base = wellMatchParams;

        // 1. BEP & Thrust Analysis
        const freqRatio = test.freq / (pump.nameplateFrequency || 60);
        const bepAtFreq = (pump.bepRate || 1000) * freqRatio;
        const flowRatio = bepAtFreq > 0 ? test.rate / bepAtFreq : 1;

        let thrustStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        let thrustLabel = 'Normal (Stable)';
        if (flowRatio > 1.15) { thrustStatus = 'alert'; thrustLabel = 'UPTHRUST (High Risk)'; }
        else if (flowRatio < 0.70) { thrustStatus = 'alert'; thrustLabel = 'DOWNTHRUST (Instability)'; }
        else if (flowRatio > 1.08 || flowRatio < 0.85) { thrustStatus = 'caution'; thrustLabel = 'Marginal (Observe)'; }

        // 2. Power & Loading (Estimated)
        // Corrected heuristic: BHP scales with frequency^2.5 (avg) or ^3 (theoretical)
        const freqRatio_30_60 = test.freq / 60;
        const bhpEst = (test.rate * (selectedWell.depthMD * 0.433) * 1.1) / (135770 * 0.65) * Math.max(1, Math.pow(freqRatio_30_60, 2.8));
        const motorLimit = (base.selectedMotor?.hp || 100) * Math.min(1.0, test.freq / 60); // Constant HP above 60Hz
        const motorLoad = motorLimit > 0 ? (bhpEst / motorLimit) * 100 : 85;

        let motorStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        if (motorLoad > 105) motorStatus = 'alert';
        else if (motorLoad > 90) motorStatus = 'caution';

        // 3. Degradation Analysis
        // Find theoretical head at this flow and frequency
        const qAdj = test.rate / freqRatio;
        const hBase = (pump.h0 + pump.h1 * qAdj + pump.h2 * qAdj ** 2 + pump.h3 * qAdj ** 3 + pump.h4 * qAdj ** 4 + pump.h5 * qAdj ** 5 + pump.h6 * qAdj ** 6) * pump.stages;
        const hTheo = hBase * (freqRatio ** 2);
        const hActual = selectedWell.depthMD * 0.433 * 0.9 + (test.thp * 2.31); // Estimated TDH

        const degPct = hTheo > 0 ? ((hTheo - hActual) / hTheo) * 100 : 0;
        let pumpStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        if (degPct > 15) pumpStatus = 'alert';
        else if (degPct > 8) pumpStatus = 'caution';

        // 4. Gas / PIP risk
        const pb = base.fluids?.pb || 2200;
        const gasRisk = test.pip < pb * 1.1 ? (test.pip < pb ? 'alert' : 'caution') : 'optimal';

        return {
            thrust: { status: thrustStatus, label: thrustLabel, ratio: flowRatio * 100 },
            motor: { status: motorStatus, load: motorLoad },
            pump: { status: pumpStatus, degradation: Math.max(0, degPct) },
            gas: { status: gasRisk, pip: test.pip, pb },
            shaft: { status: motorLoad > 95 ? 'caution' : 'optimal' as any, load: motorLoad * 0.9 } // Correlated to motor load
        };
    }, [selectedWell, pump, wellMatchParams]);

    // Match Logic for Selected Well
    const { curveData, matchPoint } = useMemo(() => {
        if (!selectedWell || !pump || !wellMatchParams.historyMatch) return { curveData: [], matchPoint: null };

        const test = selectedWell.productionTest;

        const steps = 50;
        const maxQ = (pump.maxRate || (pump as any).maxFlow || 3000) * 1.5;
        const data: any[] = [];

        for (let i = 0; i <= steps; i++) {
            const q = (maxQ / steps) * i;
            const point: any = { flow: q };

            // Design Curve (60Hz or Design Freq)
            const dRatio = 60 / 60; // Simplified
            const dH = (pump.h0 + pump.h1 * q + pump.h2 * q ** 2 + pump.h3 * q ** 3 + pump.h4 * q ** 4 + pump.h5 * q ** 5 + pump.h6 * q ** 6) * pump.stages;
            point.headNew = dH > 0 ? dH : null;

            // Actual Curve (Field Freq)
            const fRatio = test.freq / 60;
            const qAdj = q / fRatio;
            const hBase = (pump.h0 + pump.h1 * qAdj + pump.h2 * qAdj ** 2 + pump.h3 * qAdj ** 3 + pump.h4 * qAdj ** 4 + pump.h5 * qAdj ** 5 + pump.h6 * qAdj ** 6) * pump.stages;
            const hActual = hBase * (fRatio ** 2);
            point.headCurr = hActual > 0 ? hActual : null;

            try {
                // Use the rigorous nodal analysis function from utils instead of the simplified linear estimate
                const sysH = calculateTDH(q, wellMatchParams);
                point.systemCurve = sysH;
            } catch (e) { }

            data.push(point);
        }

        const actualTDH = (test.pdp > 0 && test.pip > 0)
            ? (test.pdp - test.pip) / 0.43
            : (test.thp * 2.31 + selectedWell.depthMD * 0.43 - test.pip * 2.31) / 0.43; // Fallback estimate

        return {
            curveData: data,
            matchPoint: { flow: test.rate, head: actualTDH }
        };
    }, [selectedWell, params, pump, wellMatchParams]);

    const operationalResults = useMemo(() =>
        selectedWell && pump && wellMatchParams.historyMatch ? calculateSystemResults(selectedWell.productionTest.rate, (selectedWell.productionTest.pip * 2.31) || 0, wellMatchParams, pump, selectedWell.productionTest.freq) : null,
        [selectedWell, pump, wellMatchParams]);

    const maxCapacityInfo = useMemo(() => {
        if (!selectedWell || !pump || selectedWell.status !== 'normal') return null;
        return computeWellCapacity(selectedWell, wellMatchParams, pump);
    }, [selectedWell, pump, wellMatchParams]);

    const { avgGlobalHealth, alertCount, globalEfficiency } = useMemo(() => {
        if (fleet.length === 0) return { avgGlobalHealth: 0, alertCount: 0, globalEfficiency: 0 };
        const alerts = fleet.filter(w => getWellHealthScore(w) < 40).length;
        const avg = Math.round(fleet.reduce((acc, w) => acc + getWellHealthScore(w), 0) / fleet.length);

        // Efficiency: (Sum of ConsumptionTheo / Sum of ConsumptionReal) for running fleet
        const runningWells = fleet.filter(w => w.currentRate > 5 && w.consumptionReal > 0);
        const totalTheo = runningWells.reduce((acc, w) => acc + (w.consumptionTheo || 0), 0);
        const totalReal = runningWells.reduce((acc, w) => acc + (w.consumptionReal || 0), 0);
        const efficiency = totalReal > 0 ? (totalTheo / totalReal) * 100 : 92.8;

        return { avgGlobalHealth: avg, alertCount: alerts, globalEfficiency: Math.round(Math.min(100, efficiency)) };
    }, [fleet]);

    const normalWellCapacities = useMemo(() => {
        const capacities: Record<string, ReturnType<typeof computeWellCapacity>> = {};
        if (fleet.length === 0 || !!selectedWell) return capacities;

        fleet.forEach(well => {
            if (well.status === 'normal' && well.productionTest.hasMatchData) {
                const wellNameUpper = well.name.toUpperCase().trim();
                let wellDesign = customDesigns[wellNameUpper];
                if (!wellDesign) {
                    const shortName = wellNameUpper.replace(/^W-|^WELL-/, '');
                    const key = Object.keys(customDesigns).find(k => k.replace(/^W-|^WELL-/, '') === shortName || k === wellNameUpper);
                    if (key) wellDesign = customDesigns[key];
                }
                const wParams = wellDesign || params;

                let wPump = null;
                if (wellDesign) {
                    const findPump = (obj: any): EspPump | null => {
                        if (!obj || typeof obj !== 'object') return null;
                        if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                        for (let k in obj) {
                            const found = findPump(obj[k]);
                            if (found) return found;
                        }
                        return null;
                    }
                    wPump = findPump(wellDesign);
                }
                wPump = wPump || providedPump || FALLBACK_PUMP;

                const mp: SystemParams = {
                    ...wParams,
                    historyMatch: {
                        rate: well.productionTest.rate,
                        frequency: well.productionTest.freq,
                        waterCut: well.productionTest.waterCut,
                        thp: well.productionTest.thp,
                        tht: 0,
                        pip: well.productionTest.pip,
                        pd: 0,
                        fluidLevel: 0,
                        submergence: 0,
                        pStatic: wParams.inflow?.pStatic || 0,
                        startDate: well.productionTest.date,
                        matchDate: well.productionTest.date,
                        gor: well.productionTest.gor
                    }
                };

                capacities[well.id] = computeWellCapacity(well, mp, wPump as EspPump);
            }
        });
        return capacities;
    }, [fleet, customDesigns, params, providedPump, selectedWell]);


    const renderFleetView = () => {
        if (fleet.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center p-20 glass-surface rounded-[3.5rem] border border-white/5 border-dashed min-h-[550px] animate-fadeIn mx-4 shadow-3xl">
                    <div className="p-8 bg-primary/10 rounded-[2.5rem] mb-10 relative border border-primary/20 shadow-glow-primary/10">
                        <Activity className="w-20 h-20 text-primary animate-pulse" />
                        <div className="absolute -top-3 -right-3 w-10 h-10 bg-primary rounded-full animate-ping opacity-20"></div>
                    </div>
                    <h3 className="text-4xl font-black text-txt-main uppercase tracking-tighter mb-4 text-center">Centro de Control ALS</h3>
                    <p className="text-txt-muted text-center max-w-xl font-medium leading-relaxed text-lg opacity-70">
                        La flota se encuentra vacía o está inicializando. Utilice los controles en la parte superior derecha para cargar sus diseños técnicos y pruebas de producción.
                    </p>
                </div>
            );
        }

        // Prepare chart data: Distribution of health across the fleet
        const healthDist = [
            { name: 'Healthy', value: fleet.filter(w => getWellHealthScore(w) >= 85).length, color: '#00ff0dff' },
            { name: 'Caution', value: fleet.filter(w => getWellHealthScore(w) >= 60 && getWellHealthScore(w) < 85).length, color: '#f59e0b' },
            { name: 'Critical', value: fleet.filter(w => getWellHealthScore(w) < 60).length, color: '#ff0000ff' },
        ];

        return (
            <div className="px-8 py-4 animate-fadeIn min-h-full space-y-1 relative">
                {/* Enhanced Ambient Overall Background Light */}
                <div className="fixed top-[10%] left-[10%] w-[600px] h-[600px] bg-primary/10 blur-[150px] rounded-full pointer-events-none -z-10 animate-pulse transition-all duration-1000"></div>
                <div className="fixed bottom-[10%] right-[10%] w-[500px] h-[500px] bg-secondary/8 blur-[120px] rounded-full pointer-events-none -z-10 transition-all duration-1000"></div>
                <div className="fixed top-[40%] left-[40%] w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10"></div>

                {/* ── CONSOLIDATED EXECUTIVE HEADER ── */}
                <header className="flex flex-col xl:flex-row items-center justify-between gap-3 bg-surface/50 backdrop-blur-xl py-2 px-6 rounded-2xl border border-surface-light shadow-[0_15px_40px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group mb-4">
                    {/* Header Dynamic Edge Light */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent opacity-30"></div>

                    <div className="flex items-center gap-4 relative z-10 pl-2">
                        {/* Compact Back Button for Global Navigation */}
                        <button onClick={onBack} className="p-2.5 bg-white/10 hover:bg-primary/20 rounded-xl border border-white/10 text-txt-muted hover:text-primary transition-all group shadow-lg" title="Regresar al Inicio">
                            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1" />
                        </button>
                    </div>

                    <div className="flex-1 max-w-xl relative group px-2">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 blur-2xl group-focus-within:opacity-100 opacity-20 transition-opacity"></div>
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted/60 group-focus-within:text-primary transition-all z-10" />
                        <input
                            type="text"
                            placeholder="SEARCH WELLS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="relative w-full h-10 bg-canvas/60 border border-surface-light/50 rounded-xl pl-12 pr-4 text-[10px] font-black text-txt-main focus:outline-none focus:border-primary/50 focus:ring-4 ring-primary/20 transition-all uppercase tracking-widest shadow-inner placeholder:text-txt-muted/30 backdrop-blur-md"
                        />
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        <div className="flex bg-canvas/40 p-1 rounded-xl border border-surface-light shadow-inner backdrop-blur-md">
                            <button onClick={() => setViewMode('grid')} className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-glow-primary/40' : 'text-txt-muted hover:bg-surface-light'}`}><LayoutGrid className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode('list')} className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-glow-primary/40' : 'text-txt-muted hover:bg-surface-light'}`}><List className="w-4 h-4" /></button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button onClick={() => importDesignRef.current?.click()} className="h-9 px-4 bg-primary text-white rounded-xl flex items-center gap-2 hover:bg-primary/80 transition-all font-black text-[8px] uppercase tracking-widest shadow-lg shadow-primary/10" title="Import Designs"><Download className="w-3.5 h-3.5" /> <span className="hidden xl:block">Diseños</span></button>
                            <button onClick={() => importDbRef.current?.click()} className="h-9 px-4 bg-secondary text-white rounded-xl flex items-center gap-2 hover:bg-secondary/80 transition-all font-black text-[8px] uppercase tracking-widest shadow-lg shadow-secondary/10" title="Import SCADA"><Database className="w-3.5 h-3.5" /> <span className="hidden xl:block">SCADA</span></button>

                            <div className="w-px h-5 bg-surface-light mx-0.5 opacity-30"></div>

                            {/* Health Filter Control Panel */}
                            <div className="flex items-center gap-1 bg-canvas/30 p-1 rounded-xl border border-surface-light backdrop-blur-md">
                                <button onClick={() => setHealthFilter('all')} className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all text-[8px] font-black uppercase tracking-widest ${healthFilter === 'all' ? 'bg-surface text-txt-main shadow-md' : 'text-txt-muted hover:text-txt-main'}`}>All</button>
                                <button onClick={() => setHealthFilter('healthy')} className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all text-[8px] font-black uppercase tracking-widest ${healthFilter === 'healthy' ? 'bg-success/20 text-success shadow-glow-success/20 border border-success/30' : 'text-txt-muted hover:text-success'}`}>
                                    <div className={`w-1 h-1 rounded-full ${healthFilter === 'healthy' ? 'bg-success animate-pulse' : 'bg-success/50'}`}></div> <span className="hidden xl:block">Healthy</span>
                                </button>
                                <button onClick={() => setHealthFilter('caution')} className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all text-[8px] font-black uppercase tracking-widest ${healthFilter === 'caution' ? 'bg-warning/20 text-warning shadow-glow-warning/20 border border-warning/30' : 'text-txt-muted hover:text-warning'}`}>
                                    <div className={`w-1 h-1 rounded-full ${healthFilter === 'caution' ? 'bg-warning shadow-glow-warning' : 'bg-warning/50'}`}></div> <span className="hidden xl:block">Caution</span>
                                </button>
                                <button onClick={() => setHealthFilter('critical')} className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all text-[8px] font-black uppercase tracking-widest ${healthFilter === 'critical' ? 'bg-danger/20 text-danger shadow-glow-danger/20 border border-danger/30' : 'text-txt-muted hover:text-danger'}`}>
                                    <div className={`w-1 h-1 rounded-full ${healthFilter === 'critical' ? 'bg-danger animate-pulse shadow-glow-danger' : 'bg-danger/50'}`}></div> <span className="hidden xl:block">Critical</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-1 bg-canvas/30 p-1 rounded-xl border border-surface-light backdrop-blur-md">
                                <button onClick={toggleLanguage} className="h-7 px-3 flex items-center gap-1.5 rounded-lg hover:bg-surface-light transition-all text-[8px] font-black font-mono text-txt-main tracking-widest uppercase" title="Cambiar Idioma">
                                    <Globe className="w-3.5 h-3.5 text-primary" /> {language}
                                </button>
                                <div className="w-px h-5 bg-surface-light mx-0.5 opacity-20"></div>
                                <button onClick={cycleTheme} className="h-7 px-3 flex items-center gap-1.5 rounded-lg hover:bg-surface-light transition-all group" title="Cycle Professional Themes">
                                    <Palette className="w-3.5 h-3.5 text-primary transition-transform" />
                                    <span className="text-[8px] font-black uppercase tracking-widest text-txt-muted group-hover:text-txt-main hidden xl:block">{theme}</span>
                                </button>
                            </div>

                            <button onClick={clearFleet} className="h-8 w-8 rounded-lg flex items-center justify-center transition-all bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white" title="Clear Fleet">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </header>





                {/* ── FLEET LOGIC: GRID vs LIST ── */}
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {sortedFleet.map(well => {
                            const health = wellHealthMap[well.id] || 0;
                            const isSelected = selectedWellId === well.id;

                            return (
                                <div
                                    key={well.id}
                                    onClick={() => {
                                        setSelectedWellId(well.id);
                                        setWellViewMode('monitoring');
                                    }}
                                    className={`
                                        group relative overflow-hidden rounded-[3rem] border transition-all duration-700 cursor-pointer shadow-3xl
                                        ${isSelected ? 'bg-primary/10 border-primary shadow-glow-primary/40' :
                                            health > 85 ? 'bg-surface/60 backdrop-blur-md border-surface-light hover:border-success/50 hover:shadow-glow-success/30' :
                                                health > 60 ? 'bg-surface/60 backdrop-blur-md border-surface-light hover:border-warning/50 hover:shadow-glow-warning/30' :
                                                    'bg-surface/60 backdrop-blur-md border-surface-light hover:border-danger/50 hover:shadow-glow-danger/30'
                                        }
                                    `}
                                >
                                    {/* Ambient card backglow */}
                                    <div className={`absolute -right-20 -top-20 w-60 h-60 blur-[100px] rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-1000 ${health > 85 ? 'bg-success' : health > 60 ? 'bg-warning' : 'bg-danger'}`}></div>

                                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${health > 85 ? 'bg-gradient-to-r from-transparent via-success to-transparent shadow-glow-success' : health > 60 ? 'bg-gradient-to-r from-transparent via-warning to-transparent' : 'bg-gradient-to-r from-transparent via-danger to-transparent shadow-glow-danger'}`}></div>

                                    <div className="p-8 relative z-10">
                                        <div className="flex justify-between items-start mb-10">
                                            <div className="flex flex-col gap-2">
                                                <h3 className="text-[28px] font-black text-txt-main tracking-tighter uppercase w-40 truncate group-hover:text-primary transition-colors drop-shadow-md">{well.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${health > 85 ? 'bg-success shadow-glow-success' : health > 60 ? 'bg-warning shadow-glow-warning' : 'bg-danger shadow-glow-danger animate-pulse'}`}></div>
                                                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] font-mono ${health > 85 ? 'text-success/70' : health > 60 ? 'text-warning/70' : 'text-danger/70'}`}>SN: {well.id.slice(-6)}</span>
                                                </div>
                                            </div>

                                            <div className="relative w-24 h-24 transition-transform duration-700">
                                                <svg className="w-full h-full transform -rotate-90 drop-shadow-lg">
                                                    <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-surface-light/30" />
                                                    <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="8" fill="transparent"
                                                        strokeDasharray={264} strokeDashoffset={264 - (264 * health) / 100}
                                                        strokeLinecap="round"
                                                        className={`${health > 85 ? 'text-success drop-shadow-[0_0_15px_rgba(var(--color-success),0.8)]' : health > 60 ? 'text-warning drop-shadow-[0_0_15px_rgba(var(--color-warning),0.8)]' : 'text-danger drop-shadow-[0_0_15px_rgba(var(--color-danger),0.8)]'} transition-all duration-1000`}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-2xl font-black text-txt-main leading-none">{health}</span>
                                                    <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest opacity-40">% HEALTH</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-8">
                                            <div className="bg-canvas/40 backdrop-blur-md rounded-3xl p-5 border border-white/5 flex flex-col items-center shadow-inner group-hover:border-primary/20 transition-colors">
                                                <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] mb-1.5 opacity-60">Production</span>
                                                <div className="text-2xl font-black text-txt-main leading-none">{Math.round(well.currentRate)} <span className="text-[10px] font-bold text-txt-muted opacity-40">BPD</span></div>
                                            </div>
                                            <div className="bg-canvas/40 backdrop-blur-md rounded-3xl p-5 border border-white/5 flex flex-col items-center shadow-inner group-hover:border-primary/20 transition-colors">
                                                <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] mb-1.5 opacity-60">Frequency</span>
                                                <div className="text-2xl font-black text-txt-main leading-none">{well.productionTest.freq} <span className="text-[10px] font-bold text-txt-muted opacity-40">HZ</span></div>
                                            </div>
                                        </div>

                                        {/* NO MATCH WARNING */}
                                        {!well.productionTest.hasMatchData && (
                                            <div className="bg-warning/10 border border-warning/30 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
                                                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                                                <span className="text-[9px] font-black text-warning uppercase tracking-widest leading-tight">Sin datos de prueba para hacer match</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-40">Sync Status</span>
                                                <span className="text-[11px] font-black text-txt-main opacity-80 font-mono tracking-wider">{new Date(well.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {onNavigateToDesign && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const wellNameUpper = well.name.toUpperCase().trim();
                                                            const wellDesign = customDesigns[wellNameUpper] || Object.values(customDesigns).find((_, idx) => Object.keys(customDesigns)[idx] && norm_ext(Object.keys(customDesigns)[idx]) === norm_ext(wellNameUpper));
                                                            const designParams = wellDesign ? {
                                                                ...params,
                                                                ...wellDesign,
                                                                wellbore: { ...params.wellbore, ...(wellDesign.wellbore || {}) },
                                                                pressures: { ...params.pressures, ...(wellDesign.pressures || {}) },
                                                                fluids: { ...params.fluids, ...(wellDesign.fluids || {}) },
                                                                inflow: { ...params.inflow, ...(wellDesign.inflow || {}) },
                                                                survey: (wellDesign.survey && wellDesign.survey.length > 0) ? wellDesign.survey : params.survey,
                                                            } : { ...params, metadata: { ...params.metadata, wellName: well.name, projectName: well.name } };
                                                            let wellPump: EspPump | null = null;
                                                            if (wellDesign) {
                                                                const findP = (obj: any): EspPump | null => {
                                                                    if (!obj || typeof obj !== 'object') return null;
                                                                    if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                                                                    for (let k in obj) { const f = findP(obj[k]); if (f) return f; }
                                                                    return null;
                                                                };
                                                                wellPump = findP(wellDesign);
                                                            }
                                                            onNavigateToDesign?.(designParams as SystemParams, wellPump || providedPump);
                                                        }}
                                                        className="w-12 h-12 rounded-[1.25rem] bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary hover:text-white flex items-center justify-center transition-all duration-500 shadow-lg hover:rotate-12 hover:shadow-glow-secondary/40 relative overflow-hidden"
                                                        title="Ir a Diseño (Phase 5)"
                                                    >
                                                        <Settings className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <div className={`w-12 h-12 rounded-[1.25rem] ${isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white'} flex items-center justify-center transition-all duration-500 shadow-lg group-hover:rotate-12`}>
                                                    <ArrowUpRight className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sortedFleet.map(well => {
                            const health = wellHealthMap[well.id] || 0;
                            const isRunning = well.currentRate > 5;
                            const capacity = normalWellCapacities[well.id];
                            const maxQ = capacity?.maxRate || well.targetRate || 1000;
                            const loadPct = Math.min(100, (well.currentRate / maxQ) * 100);

                            const currentHz = well.productionTest.freq || 0;
                            const maxHz = capacity?.maxFreq || 65;
                            const hzRatio = Math.min(1, currentHz / maxHz);

                            const statusColor = health > 85 ? 'text-success' : health > 60 ? 'text-warning' : 'text-danger';
                            const barColor = health > 75 ? 'from-success/80 to-emerald-400' : 'from-warning to-danger';
                            const rowShadow = health > 85 ? 'hover:shadow-[0_20px_60px_-15px_rgba(34,197,94,0.25)]' : 'hover:shadow-[0_20px_60px_-15px_rgba(245,158,11,0.25)]';

                            return (
                                <div
                                    key={well.id}
                                    onClick={() => {
                                        setSelectedWellId(well.id);
                                        setWellViewMode('monitoring');
                                    }}
                                    className={`group flex items-center px-10 py-6 bg-surface/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] transition-all duration-700 cursor-pointer relative overflow-hidden shadow-2xl mb-4
                                        hover:border-primary/40 hover:bg-surface/60
                                    `}
                                >
                                    {/* Futuristic Accent Bar */}
                                    <div className={`absolute left-0 top-6 bottom-6 w-1 ${health > 85 ? 'bg-success shadow-glow-success' : health > 60 ? 'bg-warning' : 'bg-danger shadow-glow-danger'} transition-all duration-700`}></div>

                                    {/* Scan Line Animation Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-20 -translate-y-[200%] group-hover:translate-y-[1000%] transition-all duration-[3000ms] pointer-events-none opacity-0 group-hover:opacity-100"></div>

                                    {/* 1. Health Status Radial (SVG) */}
                                    <div className="w-24 shrink-0 flex justify-center">
                                        <div className="relative w-16 h-16 group/radial">
                                            <svg className="w-full h-full transform -rotate-90 drop-shadow-lg">
                                                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-surface-light opacity-30" />
                                                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent"
                                                    strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * health / 100)}
                                                    strokeLinecap="round"
                                                    className={`${statusColor} transition-all duration-1000 ${health > 85 ? 'drop-shadow-[0_0_12px_rgba(34,197,94,0.8)]' : 'drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className={`text-base font-black ${statusColor} tracking-tighter`}>{health}</span>
                                                <span className="text-[7px] font-black text-txt-muted uppercase tracking-widest opacity-50 -mt-1">SYS</span>
                                            </div>
                                            {/* Micro-activity dot */}
                                            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary/20 rounded-full border border-primary animate-pulse flex items-center justify-center">
                                                <div className="w-1 h-1 bg-primary rounded-full"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Well Identity & Active Status */}
                                    <div className="flex-[1.2] min-w-[200px] flex flex-col justify-center pl-8 border-r border-white/5">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <h3 className="text-2xl font-black text-txt-main tracking-tighter uppercase group-hover:text-primary transition-colors duration-500 drop-shadow-sm">{well.name}</h3>
                                            <div className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-[0.2em] border ${isRunning ? 'bg-success/20 text-success border-success/30' : 'bg-white/5 text-txt-muted border-white/10'}`}>
                                                {isRunning ? 'Online' : 'Sleep'}
                                            </div>
                                            {!well.productionTest.hasMatchData && (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-warning/10 border border-warning/30 rounded-md">
                                                    <AlertTriangle className="w-2.5 h-2.5 text-warning" />
                                                    <span className="text-[7px] font-black text-warning uppercase">No-Match</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.4em] opacity-40">System Node: <span className="text-txt-main opacity-100 font-mono tracking-normal">{well.id.slice(-8)}</span></span>
                                        </div>
                                    </div>

                                    {/* 4. Production Analytics */}
                                    <div className="flex-[1.5] flex flex-col gap-3 px-10 justify-center">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40">Rate</span>
                                                <span className="text-2xl font-black text-txt-main tracking-tighter">{Math.round(well.currentRate)} <small className="text-[9px] font-bold text-txt-muted uppercase tracking-widest">BPD</small></span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40">Eff/Limit</span>
                                                <span className="text-sm font-black text-primary tracking-tighter">{(loadPct).toFixed(0)}% <span className="text-[9px] text-txt-muted opacity-40 whitespace-nowrap">(@{Math.round(maxQ)})</span></span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-canvas/60 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                            <div
                                                className={`h-full rounded-full bg-gradient-to-r ${barColor} shadow-glow-sm transition-all duration-1000 relative overflow-hidden`}
                                                style={{ width: `${loadPct}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 5. VSD DATA CENTER */}
                                    <div className="flex-1 flex flex-col items-center justify-center px-10 gap-2 border-l border-r border-white/5 bg-white/[0.02]">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-primary tracking-tighter">{currentHz.toFixed(1)}</span>
                                            <span className="text-[9px] font-black text-primary opacity-60 uppercase tracking-widest">Hz</span>
                                        </div>
                                        <div className="w-full flex justify-between text-[8px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-30">
                                            <span>30.0</span>
                                            <span>MAX {maxHz.toFixed(1)}</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                                            <div className="h-full bg-primary/40 rounded-full transition-all duration-1000" style={{ width: `${hzRatio * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* 6. Environment Telemetry */}
                                    <div className="flex-1 flex flex-col items-stretch justify-center gap-2 px-8">
                                        <div className="flex justify-between items-center bg-canvas/40 px-4 py-1.5 rounded-xl border border-white/5 group-hover:border-white/10 transition-all">
                                            <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40">PIP</span>
                                            <span className="text-xs font-black text-txt-main">{Math.round(well.productionTest.pip)}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-canvas/40 px-4 py-1.5 rounded-xl border border-white/5 group-hover:border-white/10 transition-all">
                                            <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40">THP</span>
                                            <span className="text-xs font-black text-txt-main">{Math.round(well.productionTest.thp)}</span>
                                        </div>
                                    </div>

                                    {/* 7. IA COMMAND CENTER */}
                                    <div className="flex-[2.5] flex flex-col justify-center px-10 border-l border-white/5 relative bg-primary/5">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full"></div>
                                        <div className="flex items-center justify-between mb-3 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/20 rounded-lg"><Brain className="w-4 h-4 text-primary" /></div>
                                                <span className="text-[11px] font-black text-primary uppercase tracking-[0.3em]">IA Predictive</span>
                                            </div>

                                            {capacity && (
                                                <div className="flex items-center gap-2">
                                                    <div className="px-3 py-1.5 bg-success/20 border border-success/40 rounded-xl flex items-center gap-2 shadow-glow-success/10">
                                                        <Zap className="w-3 h-3 text-success animate-pulse" />
                                                        <span className="text-[9px] font-black text-success uppercase tracking-wider">SUGGESTED HZ: {Math.round(capacity.maxFreq)}</span>
                                                    </div>
                                                    {capacity.potentialGain > 5 && (
                                                        <div className="px-3 py-1.5 bg-primary/20 border border-primary/40 rounded-xl flex items-center gap-2 shadow-glow-primary/10">
                                                            <ArrowUpRight className="w-3 h-3 text-primary" />
                                                            <span className="text-[9px] font-black text-primary uppercase tracking-wider">+{Math.round(capacity.potentialGain)} BPD</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-canvas/50 px-6 py-4 rounded-2xl border border-white/5 shadow-inner relative overflow-hidden group/insight">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/30 group-hover/insight:bg-primary transition-all"></div>
                                            <p className="text-[11px] font-bold text-txt-main leading-relaxed italic opacity-80 uppercase tracking-tight">
                                                {capacity && capacity.potentialGain > 5
                                                    ? `OPTIMIZACIÓN DISPONIBLE: Se detecta margen de potencia. Se recomienda subir a ${Math.round(capacity.maxFreq)} Hz para ganancia de volumen.`
                                                    : `ESTADO NOMINAL: Operación alineada con curva teórica. No se requieren ajustes de frecuencia inmediatos.`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 8. Controls */}
                                    <div className="flex flex-col items-center justify-center gap-3 pl-8 shrink-0">
                                        <DiagnosticBadge well={well} health={health} normalWellCapacity={capacity} />
                                        <div className="h-px w-10 bg-white/10"></div>
                                        {/* 
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const wellNameUpper = well.name.toUpperCase().trim();
                                                const wellDesign = customDesigns[wellNameUpper] || Object.values(customDesigns).find((_, idx) => Object.keys(customDesigns)[idx] && norm_ext(Object.keys(customDesigns)[idx]) === norm_ext(wellNameUpper));
                                                const designParams = wellDesign ? {
                                                    ...params,
                                                    ...wellDesign,
                                                    wellbore: { ...params.wellbore, ...(wellDesign.wellbore || {}) },
                                                    pressures: { ...params.pressures, ...(wellDesign.pressures || {}) },
                                                    fluids: { ...params.fluids, ...(wellDesign.fluids || {}) },
                                                    inflow: { ...params.inflow, ...(wellDesign.inflow || {}) },
                                                    survey: (wellDesign.survey && wellDesign.survey.length > 0) ? wellDesign.survey : params.survey,
                                                } : { ...params, metadata: { ...params.metadata, wellName: well.name, projectName: well.name } };
                                                let wellPump: EspPump | null = null;
                                                if (wellDesign) {
                                                    const findP = (obj: any): EspPump | null => {
                                                        if (!obj || typeof obj !== 'object') return null;
                                                        if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                                                        for (let k in obj) { const f = findP(obj[k]); if (f) return f; }
                                                        return null;
                                                    };
                                                    wellPump = findP(wellDesign);
                                                }
                                                onNavigateToDesign(designParams as SystemParams, wellPump || providedPump);
                                            }}
                                            className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary hover:text-white flex items-center justify-center transition-all shadow-xl hover:shadow-glow-secondary/40 relative"
                                            title="Configuración Técnica (Phase 5)"
                                        >
                                            <Settings className="w-5 h-5" />
                                        </button>
                                        */}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderDetailedWellView = () => {
        if (!selectedWell) return null;
        const isSynced = !!customDesigns[selectedWell.name.toUpperCase().trim()];
        const hasMatch = selectedWell.productionTest.hasMatchData || selectedWell.currentRate > 0;

        // Derive physical health for BHA coloring
        const wellNorm = norm_ext(selectedWell.name);
        const customDesign = Object.entries(customDesigns).find(([k]) => norm_ext(k) === wellNorm)?.[1];

        // Resolve pump
        let pump = providedPump;
        if (customDesign) {
            const findPump = (obj: any): EspPump | null => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                for (let k in obj) {
                    const found = findPump(obj[k]);
                    if (found) return found;
                }
                return null;
            }
            pump = findPump(customDesign) || pump;
        }
        pump = pump || FALLBACK_PUMP;



        const q = selectedWell.productionTest.rate || 0.1;
        const f = selectedWell.productionTest.freq || 60;
        const pMD = selectedWell.depthMD || 5000;
        const mMD = pMD + 100;
        const estGrad = 0.35; // Default assumption

        // Use the actual design pStatic if available, otherwise estimate it but floor it safely
        const estPStatic = (customDesign && customDesign.inflow && customDesign.inflow.pStatic > 0)
            ? customDesign.inflow.pStatic
            : Math.max(50, (mMD * estGrad) - 1000);

        const historyData: HistoryMatchData = {
            rate: selectedWell.productionTest.rate,
            frequency: selectedWell.productionTest.freq,
            waterCut: selectedWell.productionTest.waterCut,
            thp: selectedWell.productionTest.thp,
            tht: selectedWell.productionTest.tht || 80,
            pip: selectedWell.productionTest.pip,
            pd: selectedWell.productionTest.pdp || 0,
            pdp: selectedWell.productionTest.pdp,
            fluidLevel: 0,
            submergence: 0,
            pStatic: estPStatic,
            startDate: selectedWell.productionTest.date,
            matchDate: selectedWell.productionTest.date,
            gor: selectedWell.productionTest.gor
        };

        const wellMatchParams: SystemParams = customDesign ? {
            ...customDesign,
            historyMatch: historyData
        } : {
            ...INITIAL_PARAMS,
            metadata: { ...INITIAL_PARAMS.metadata, wellName: selectedWell.name },
            pressures: { ...INITIAL_PARAMS.pressures, totalRate: q, pumpDepthMD: pMD, pht: selectedWell.productionTest.thp || 80 },
            wellbore: { ...INITIAL_PARAMS.wellbore, tubingBottom: pMD, midPerfsMD: mMD },
            inflow: { ...INITIAL_PARAMS.inflow, pStatic: estPStatic, ip: q / 500 || 1.0 },
            historyMatch: historyData
        };

        const physicalHealth = {
            pump: selectedWell.health.pump,
            motor: selectedWell.health.motor,
            seal: selectedWell.health.seal,
            cable: selectedWell.health.cable,
            vsd: (selectedWell.predictive.vsdStatus === 'alert') ? 'alert' : (selectedWell.predictive.vsdStatus === 'caution' ? 'caution' : 'normal') as any
        };

        const baseFreq = pump?.nameplateFrequency || 60;
        const ratio = f / baseFreq;
        const head = calculateBaseHead(q / ratio, pump) * Math.pow(ratio, 2);

        const baselineDesign = customDesign || params;
        const liveBhaResults = calculateSystemResults(q, head, wellMatchParams, pump, f) || { pip: selectedWell.productionTest.pip, motorLoad: Math.abs(selectedWell.consumptionReal) };

        return (
            <div className="space-y-8 animate-fadeIn p-4 pb-20 relative">
                {/* NO MATCH DATA WARNING */}
                {!hasMatch && (
                    <div className="mb-4 bg-danger/10 border border-danger/30 p-10 rounded-[3rem] flex items-center justify-between shadow-glow-danger/5 animate-fadeIn">
                        <div className="flex items-center gap-8">
                            <div className="p-6 bg-danger/20 rounded-3xl border border-danger/20 text-danger"><AlertTriangle className="w-12 h-12" /></div>
                            <div>
                                <h3 className="text-3xl font-black text-danger uppercase mb-2 tracking-tighter italic">Faltan Datos de Cotejo (Match)</h3>
                                <p className="text-sm font-bold text-danger/70 uppercase tracking-widest leading-relaxed max-w-2xl">El diseño cargado no contiene datos de historial (Phase 7). Se requiere cargar una prueba de producción o configurar el cotejo manual para habilitar el análisis de salud en tiempo real.</p>
                            </div>
                        </div>
                    </div>
                )}
                {/* WELL HEADER WITH DROPDOWN SELECTOR */}
                <div className="flex justify-between items-center bg-surface/40 backdrop-blur-xl py-3 px-6 rounded-2xl border border-white/5 shadow-2xl relative group z-20">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                    <div className="flex items-center gap-6 relative z-10 w-full">
                        <div className="flex items-center gap-4">
                            {/* BACK BUTTON INTEGRATED */}
                            <button onClick={onBack} className="p-2.5 bg-white/10 hover:bg-primary/20 rounded-xl border border-white/10 text-txt-muted hover:text-primary transition-all group shadow-lg" title="Regresar al Inicio">
                                <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1" />
                            </button>

                            {/* WELL DROPDOWN SELECTOR */}
                            <div className="relative" ref={wellDropdownRef}>
                                <button
                                    onClick={() => setIsWellDropdownOpen(!isWellDropdownOpen)}
                                    className="flex items-center gap-3 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 transition-all shadow-lg cursor-pointer group/dd"
                                >
                                    <h2 className="text-xl font-black text-txt-main tracking-tighter uppercase leading-none group-hover/dd:text-primary transition-colors">{selectedWell.name}</h2>
                                    <ChevronRight className={`w-4 h-4 text-txt-muted transition-transform duration-300 ${isWellDropdownOpen ? 'rotate-90' : ''}`} />
                                </button>
                                {isWellDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-3 w-[400px] max-h-[500px] overflow-y-auto bg-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] z-[100] animate-fadeIn custom-scrollbar">
                                        <div className="p-3 border-b border-white/5">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted/50" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar pozo..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full bg-canvas/60 border border-surface-light rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-txt-main focus:outline-none focus:border-primary/50 uppercase tracking-wider placeholder:text-txt-muted/30"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            {sortedFleet.map(well => {
                                                const health = wellHealthMap[well.id] || 0;
                                                const isActive = well.id === selectedWellId;
                                                return (
                                                    <button
                                                        key={well.id}
                                                        onClick={() => {
                                                            setSelectedWellId(well.id);
                                                            setWellViewMode('monitoring');
                                                            setIsWellDropdownOpen(false);
                                                            setSearchTerm('');
                                                        }}
                                                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left mb-1 ${isActive
                                                            ? 'bg-primary/20 border border-primary/30'
                                                            : 'hover:bg-white/5 border border-transparent'
                                                            }`}
                                                    >
                                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${health >= 85 ? 'bg-success shadow-glow-success' : health >= 60 ? 'bg-warning' : 'bg-danger shadow-glow-danger'}`}></div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className={`text-sm font-black uppercase tracking-tight block truncate ${isActive ? 'text-primary' : 'text-txt-main'}`}>{well.name}</span>
                                                            <span className="text-[9px] font-bold text-txt-muted uppercase tracking-widest">
                                                                {Math.round(well.currentRate)} BPD • {well.productionTest.freq || 0} Hz
                                                            </span>
                                                        </div>
                                                        <span className={`text-xs font-black ${health >= 85 ? 'text-success' : health >= 60 ? 'text-warning' : 'text-danger'}`}>{health}%</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-1 justify-center">
                            <button
                                onClick={() => importDbRef.current?.click()}
                                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 hover:shadow-glow-secondary/20"
                                title="Subir prueba de producción puntual (CSV/Excel)"
                            >
                                <Database className="w-4 h-4" />
                                Subir Prueba
                            </button>

                            {onNavigateToDesign && (
                                <SecureWrapper isLocked={true} tooltip="Módulo de Diseño Restringido">
                                    <button
                                        onClick={() => {
                                            onNavigateToDesign(wellMatchParams, pump);
                                        }}
                                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white hover:shadow-glow-primary/40 relative"
                                        title="Ir a Diseño (Phase 5)"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Diseño
                                    </button>
                                </SecureWrapper>
                            )}

                            <SecureWrapper isLocked={true} tooltip="Módulo de Ajuste Histórico Restringido">
                                <button
                                    onClick={() => setWellViewMode(wellViewMode === 'history' ? 'monitoring' : 'history')}
                                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${wellViewMode === 'history' ? 'bg-primary text-white border-primary shadow-glow-primary/40' : 'bg-success/10 text-success border-success/20 hover:bg-success/20 hover:shadow-glow-success/20'}`}
                                >
                                    {wellViewMode === 'history' ? <Activity className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                    {wellViewMode === 'history' ? 'Monitoreo' : 'Histórico (Match)'}
                                </button>
                            </SecureWrapper>
                        </div>

                        {/* GLOBAL SETTINGS (LANGUAGE / THEME) */}
                        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 shadow-inner ml-auto">
                            <button
                                onClick={toggleLanguage}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-all text-[9px] font-black font-mono text-txt-main tracking-widest uppercase"
                            >
                                <Globe className="w-3.5 h-3.5 text-primary" /> {language}
                            </button>
                            <button
                                onClick={cycleTheme}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 text-txt-muted hover:text-primary hover:border-primary/20 group/palette"
                                title="Cambiar Tema"
                            >
                                <Palette className="w-4 h-4 text-secondary group-hover/palette:text-primary" />
                            </button>
                        </div>
                    </div>
                </div>

                {wellViewMode === 'history' ? (
                    <MatchHistorico
                        wellName={selectedWell.name}
                        pump={pump}
                        designParams={wellMatchParams}
                        productionHistory={wellsHistoricalData[norm_ext(selectedWell.name)]}
                        onImport={() => importWellHistoryRef.current?.click()}
                        onClose={() => setWellViewMode('monitoring')}
                    />
                ) : (
                    <div className="flex flex-col gap-6 animate-fadeIn relative z-10 mt-12">
                        {/* THE AI COMMENT - FLOATING BUBBLE */}
                        <PredictiveWidget
                            selectedWell={selectedWell}
                            wellMatchParams={wellMatchParams}
                            pump={pump}
                            computeWellCapacity={computeWellCapacity}
                            getOptimizationPath={getOptimizationPath}
                        />

                        {/* COMPACT ANALYTICS SECTION: PHASE 6 + BHA SCHEME */}
                        <div className="flex gap-6 items-stretch w-full min-h-[900px] relative mt-16 lg:mt-0">
                            {/* BHA DIGITAL TWIN ON THE LEFT */}
                            <div className={`glass-surface rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl flex flex-col relative group transition-all duration-500 ${isBhaMinimized ? 'w-20' : 'w-[400px]'}`}>
                                {!isBhaMinimized && (
                                    <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
                                        <button
                                            onClick={() => setIsBhaMinimized(true)}
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 text-primary"
                                            title="Minimizar BHA"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-secondary/10 rounded-xl text-secondary border border-secondary/20"><Layers className="w-4 h-4" /></div>
                                            <h3 className="text-xs font-black text-txt-main uppercase tracking-widest">Esquema BHA</h3>
                                        </div>
                                        <Activity className="w-4 h-4 text-primary animate-pulse" />
                                    </div>
                                )}
                                <div className={`flex-1 relative bg-canvas/40 overflow-hidden flex items-center justify-center p-4 transition-all duration-500 ${isBhaMinimized ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                                    <div className="absolute inset-0 opacity-10 pointer-events-none blueprint-grid"></div>
                                    <div className={`h-full origin-top flex items-center justify-center w-full transition-all duration-500 ${isBhaMinimized ? 'scale-[0.4] translate-y-10' : 'scale-100'}`}>
                                        <VisualESPStack
                                            pump={pump}
                                            motor={wellMatchParams.selectedMotor || undefined}
                                            params={wellMatchParams}
                                            results={liveBhaResults}
                                            frequency={f}
                                            health={physicalHealth as any}
                                            selectedVSD={wellMatchParams.selectedVSD}
                                        />
                                    </div>
                                </div>
                                {isBhaMinimized && (
                                    <div
                                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-canvas/80 backdrop-blur-sm cursor-pointer group-hover:bg-canvas/60 transition-all"
                                        onClick={() => setIsBhaMinimized(false)}
                                    >
                                        <div className="flex flex-col items-center gap-6 bg-primary/10 text-primary border border-primary/20 p-4 rounded-full shadow-glow-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                            <Layers className="w-5 h-5" />
                                            <div className="[writing-mode:vertical-lr] text-[12px] font-black uppercase tracking-[0.4em] transform rotate-180 whitespace-nowrap">
                                                VER BHA ESP
                                            </div>
                                            <Maximize2 className="w-5 h-5 mt-2 animate-bounce" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* MAIN PHASE 6 CANVAS ON THE RIGHT */}
                            <div className="flex-1 glass-surface rounded-[3rem] border border-white/5 shadow-3xl overflow-y-auto custom-scrollbar relative z-30" style={{ minHeight: '900px' }}>
                                {hasMatch ? (
                                    <Phase6
                                        key={selectedWell.id}
                                        params={wellMatchParams}
                                        setParams={() => { }}
                                        pump={pump}
                                        designFreq={selectedWell.productionTest.freq || 60}
                                    />
                                ) : (
                                    <div className="h-[600px] flex flex-col items-center justify-center space-y-6 text-center px-10">
                                        <div className="p-8 bg-warning/10 rounded-full border border-warning/30 animate-pulse shadow-glow-warning/30">
                                            <AlertTriangle className="w-16 h-16 text-warning" />
                                        </div>
                                        <h3 className="text-3xl font-black text-warning uppercase tracking-tighter">Análisis de Match Incompleto</h3>
                                        <div className="bg-surface/50 border border-white/10 rounded-2xl p-6 max-w-lg shadow-inner">
                                            <p className="text-txt-main/80 font-medium mb-4 text-sm leading-relaxed">
                                                Para ejecutar el simulador de desgaste y calcular los coeficientes de degradación (<strong className="text-white">Kh, Kf</strong>), el motor necesita la siguiente telemetría de campo obligatoria:
                                            </p>
                                            <div className="flex flex-wrap gap-3 justify-center mb-6">
                                                {(!selectedWell.productionTest.pip || selectedWell.productionTest.pip <= 0) && (
                                                    <div className="px-4 py-2 bg-danger/20 border border-danger/40 rounded-xl text-danger font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                        <div className="w-2 h-2 rounded-full bg-danger animate-ping"></div> FALTA PIP
                                                    </div>
                                                )}
                                                {(!selectedWell.productionTest.thp || selectedWell.productionTest.thp <= 0) && (
                                                    <div className="px-4 py-2 bg-danger/20 border border-danger/40 rounded-xl text-danger font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                        <div className="w-2 h-2 rounded-full bg-danger animate-ping"></div> FALTA THP
                                                    </div>
                                                )}
                                                {(!selectedWell.productionTest.freq || selectedWell.productionTest.freq <= 0) && (
                                                    <div className="px-4 py-2 bg-danger/20 border border-danger/40 rounded-xl text-danger font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                        <div className="w-2 h-2 rounded-full bg-danger animate-ping"></div> FALTA FRECUENCIA
                                                    </div>
                                                )}
                                                {(!selectedWell.currentRate || selectedWell.currentRate <= 5) && (
                                                    <div className="px-4 py-2 bg-danger/20 border border-danger/40 rounded-xl text-danger font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                        <div className="w-2 h-2 rounded-full bg-danger animate-ping"></div> FALTA CAUDAL (BPD)
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => importDbRef.current?.click()}
                                                className="w-full py-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/60 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                                            >
                                                <Database className="w-4 h-4" />
                                                Subir Nuevo Reporte Excel / CSV
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderNotifications = () => {
        const alerts = fleet.filter(w => getWellHealthScore(w) < 55);

        return (
            <div className="w-full h-full bg-surface/60 backdrop-blur-xl border border-surface-light rounded-[3rem] shadow-3xl relative overflow-hidden flex flex-col group/panel">
                {/* Panel edge highlight */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

                <div className="px-8 py-8 border-b border-surface-light flex items-center justify-between bg-surface-light/10">
                    <div>
                        <h4 className="text-xl font-black text-txt-main uppercase tracking-tighter flex items-center gap-3">
                            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                            AI Alerts
                        </h4>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mt-1 opacity-70">Fleet Intelligence Radar</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black ${alerts.length > 0 ? 'bg-danger/10 text-danger border border-danger/30 animate-pulse shadow-glow-danger/20' : 'bg-success/10 text-success border border-success/30'} uppercase tracking-widest`}>
                        {alerts.length} Active Alarms
                    </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-canvas/30">
                    {alerts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20 animate-fadeIn">
                            <div className="p-8 bg-success/5 rounded-full mb-6 border border-success/10">
                                <ShieldCheck className="w-20 h-20 text-success" />
                            </div>
                            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Global Fleet Status<br /><span className="text-success opacity-100">Optimal</span></p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {alerts.map(w => (
                                <div key={w.id} className="p-6 bg-surface/80 border border-white/5 rounded-[2.5rem] animate-fadeIn hover:border-danger/40 transition-all cursor-pointer shadow-xl relative overflow-hidden group/item" onClick={() => { setSelectedWellId(w.id); }}>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-danger/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                    <div className="absolute left-0 top-8 bottom-8 w-1 bg-danger rounded-full shadow-glow-danger"></div>

                                    <div className="flex items-center justify-between mb-4 relative z-10 pl-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-danger animate-ping"></div>
                                            <span className="text-[10px] font-black text-danger uppercase italic tracking-[0.2em]">Salud Crítica</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-txt-muted opacity-40">{(new Date(w.lastUpdate)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <h5 className="text-xl font-black text-txt-main uppercase tracking-tighter mb-2 relative z-10 pl-2">{w.name}</h5>
                                    <p className="text-[10px] font-bold text-txt-muted leading-relaxed uppercase opacity-60 tracking-tight pl-2 mb-6">
                                        Análisis predictivo detecta degradación acelerada del {100 - getWellHealthScore(w)}%. Posible interferencia de gas o desgaste mecánico.
                                    </p>
                                    <div className="flex justify-end relative z-10">
                                        <button className="px-6 py-2.5 bg-danger/10 text-danger text-[10px] font-black rounded-xl border border-danger/20 group-hover/item:bg-danger group-hover/item:text-white transition-all tracking-widest uppercase shadow-lg shadow-danger/5">
                                            Ver Diagnóstico
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-full pb-20 px-6 py-0 transition-all duration-700">
            {/* Header Globally Removed - Controls moved to contextual bars */}

            <div className="flex gap-6 mt-6 pb-20">
                <div className="flex-1 min-w-0 transition-all duration-500">
                    {selectedWellId ? renderDetailedWellView() : (
                        fleet.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 glass-surface rounded-[3.5rem] border border-white/5 border-dashed min-h-[550px] animate-fadeIn mx-4 shadow-3xl">
                                <div className="p-8 bg-primary/10 rounded-[2.5rem] mb-10 relative border border-primary/20 shadow-glow-primary/10">
                                    <Activity className="w-20 h-20 text-primary animate-pulse" />
                                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-primary rounded-full animate-ping opacity-20"></div>
                                </div>
                                <h3 className="text-4xl font-black text-txt-main uppercase tracking-tighter mb-4 text-center">Centro de Control ALS</h3>
                                <p className="text-txt-muted text-center max-w-xl font-medium leading-relaxed text-lg opacity-70">
                                    La flota se encuentra vacía o está inicializando. Utilice los controles en la parte superior derecha para cargar sus diseños técnicos y pruebas de producción.
                                </p>
                                <div className="flex items-center gap-4 mt-8">
                                    <button onClick={() => importDesignRef.current?.click()} className="h-12 px-8 bg-primary text-white rounded-xl flex items-center gap-3 hover:bg-primary/80 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"><Download className="w-5 h-5" /> Cargar Diseños</button>
                                    <button onClick={() => importDbRef.current?.click()} className="h-12 px-8 bg-secondary text-white rounded-xl flex items-center gap-3 hover:bg-secondary/80 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-secondary/20"><Database className="w-5 h-5" /> Cargar SCADA</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="p-8 bg-primary/10 rounded-[2.5rem] border border-primary/20">
                                    <RefreshCw className="w-16 h-16 text-primary animate-spin" />
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>

            <style>{`
                .glass-surface-light {
                    background: rgba(var(--color-surface-light), 0.1);
                    backdrop-filter: blur(20px);
                }
                .animate-slideUp {
                    animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .shadow-glow-danger {
                    box-shadow: 0 0 30px -5px rgba(239, 68, 68, 0.4);
                }
                @keyframes slideLeft {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes eks-scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
            `}</style>
            {showFullMatch && selectedWell && (
                <div className="fixed inset-0 z-[100] bg-canvas/95 backdrop-blur-xl animate-fadeIn overflow-hidden flex flex-col">
                    <div className="h-20 bg-surface/80 border-b border-white/10 flex items-center justify-between px-10 shrink-0 backdrop-blur-md">
                        <div className="flex items-center gap-6">
                            <div className="p-3 bg-primary/20 rounded-2xl border border-primary/20 shadow-glow-primary/10"><ClipboardCheck className="w-6 h-6 text-primary" /></div>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => importExcelDesignRef.current?.click()}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-glow-primary/20"
                                >
                                    <Database className="w-4 h-4" />
                                    Importar Diseños (Excel)
                                </button>
                                <button
                                    onClick={() => importDesignRef.current?.click()}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-surface-light/50 hover:bg-surface-light text-txt-main border border-white/5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    Cargar JSON
                                </button>
                                <button
                                    onClick={() => importDbRef.current?.click()}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white border border-secondary/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-glow-secondary/20"
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    Cargar Historial (Match)
                                </button>
                                <button onClick={clearFleet} className="p-2.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-xl border border-danger/20 transition-all" title="Limpiar Flota">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div>
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.2em]">{t('p5.analyzeMatch')}</h3>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">Digital Twin • {selectedWell.name}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowFullMatch(false)} className="p-3 bg-white/5 hover:bg-danger/20 text-txt-muted hover:text-danger rounded-2xl border border-white/10 transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-canvas/30">
                        <Phase6
                            params={wellMatchParams}
                            setParams={() => { }}
                            pump={pump}
                            designFreq={selectedWell.productionTest.freq}
                        />
                    </div>
                </div>
            )}
            <input type="file" ref={importDesignRef} className="hidden" accept=".json" multiple onChange={handleImportDesign} />
            <input type="file" ref={importDbRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleImportDb} />
            <input type="file" id="well-history-input" ref={importWellHistoryRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportWellHistory} />

            {/* FLOATING AI CHAT FOR MONITORING */}
            <FloatingAiPanel fleet={fleet} selectedWell={selectedWell} language={language} t={t} />

            {/* FULL-SCREEN IMPORT PROGRESS OVERLAY */}
            {importProgress && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-canvas/90 backdrop-blur-3xl animate-fadeIn">
                    {/* Background Decorative Elements */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                        <div style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `linear-gradient(rgba(var(--color-primary),0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--color-primary),0.1) 1px, transparent 1px)`,
                            backgroundSize: '60px 60px',
                        }} />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-[200%] animate-[eks-scanline_10s_linear_infinite]" />
                    </div>

                    <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[180px] animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-secondary/15 rounded-full blur-[180px] animate-pulse-slow"></div>

                    <div className="bg-surface/60 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-16 shadow-[0_0_150px_rgba(var(--color-primary),0.2)] flex flex-col items-center gap-10 max-w-2xl w-full relative overflow-hidden group">
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_3s_infinite] pointer-events-none"></div>

                        <div className="relative">
                            {/* ENLARGED VIDEO CONTAINER FOR LOADING */}
                            <div className="relative w-[480px] h-[270px] flex items-center justify-center max-w-full">
                                <div className="absolute inset-0 bg-primary/10 rounded-full blur-[100px] animate-pulse"></div>
                                
                                <div className="relative z-10 w-full h-full overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_0_50px_rgba(var(--color-primary),0.2)] bg-canvas/40 backdrop-blur-md">
                                    <video 
                                        src="/loading_mini.mp4" 
                                        autoPlay 
                                        loop 
                                        muted 
                                        playsInline 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center w-full relative z-10 gap-4 text-center">
                            <div className="space-y-1">
                                <h3 className="text-3xl font-black text-txt-main uppercase tracking-[0.3em] drop-shadow-2xl">
                                    {importProgress.label.replace('...', '')}
                                </h3>
                                <div className="h-1 w-24 bg-primary mx-auto rounded-full shadow-glow-primary opacity-60"></div>
                            </div>

                            <p className="text-txt-muted text-[10px] font-black uppercase tracking-[0.5em] opacity-50 flex items-center gap-3">
                                <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                                Synchronizing Operations Center
                            </p>

                            <div className="w-full mt-10 space-y-5">
                                <div className="w-full h-4 bg-canvas/60 rounded-full overflow-hidden border border-white/10 shadow-inner p-[3px] relative">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-shimmer-fast rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(var(--color-primary),0.6)]"
                                        style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}
                                    ></div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer pointer-events-none"></div>
                                </div>

                                <div className="flex justify-between items-end px-2">
                                    <div className="flex flex-col items-start">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1.5">System Status</span>
                                        <span className="text-[11px] font-black text-txt-muted uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 font-mono">
                                            {importProgress.current} / {importProgress.total} Nodes
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-5xl font-black text-txt-main tracking-tighter leading-none italic drop-shadow-lg">
                                            {Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}<small className="text-xl text-primary ml-1 not-italic">%</small>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PredictiveMiniWidget = ({ label, status, desc }: any) => {
    const statusConfig: any = {
        optimal: { color: 'text-success', bg: 'bg-success', glow: 'shadow-glow-success' },
        caution: { color: 'text-warning', bg: 'bg-warning', glow: 'shadow-glow-warning/30' },
        alert: { color: 'text-danger', bg: 'bg-danger', glow: 'shadow-glow-danger' }
    };
    const config = statusConfig[status] || statusConfig.optimal;
    return (
        <div className="flex items-center justify-between p-5 bg-canvas/40 backdrop-blur-md rounded-[1.5rem] border border-white/5 hover:border-primary/30 transition-all group cursor-default shadow-lg relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bg} opacity-50`}></div>
            <div className="flex items-center gap-5 relative z-10">
                <div className={`w-3 h-3 rounded-full ${config.bg} ${config.glow} shadow-sm transition-transform`}></div>
                <div>
                    <span className="text-[11px] font-black text-txt-main uppercase tracking-widest opacity-90">{label}</span>
                    <p className="text-[10px] font-bold text-txt-muted uppercase opacity-40 tracking-tighter mt-0.5 group-hover:opacity-80 transition-opacity">{desc}</p>
                </div>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${config.color} opacity-80 bg-white/5 px-3 py-1 rounded-lg border border-white/5`}>{status}</span>
        </div>
    );
};

const CompValueCard = ({ label, design, actual, unit }: any) => {
    const diff = design !== 0 ? ((actual - design) / design) * 100 : 0;
    const isGood = Math.abs(diff) < 10;
    return (
        <div className="glass-surface p-7 rounded-[2rem] border border-white/5 group hover:border-primary/40 transition-all relative overflow-hidden shadow-2xl">
            <div className={`absolute top-0 right-0 w-24 h-24 ${isGood ? 'bg-success/5' : 'bg-danger/5'} blur-[30px] rounded-full`}></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
                <span className="text-[11px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-50">{label}</span>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black border ${isGood ? 'bg-success/10 text-success border-success/20 shadow-glow-success/10' : 'bg-danger/10 text-danger border-danger/20 shadow-glow-danger/10'}`}>
                    {Math.abs(diff).toFixed(1)}% {diff > 0 ? 'UP' : 'DN'}
                </div>
            </div>
            <div className="flex items-baseline gap-3 relative z-10">
                <span className="text-3xl font-black text-txt-main tracking-tighter drop-shadow-sm">{actual?.toFixed(0)}</span>
                <span className="text-[10px] font-black text-txt-muted uppercase opacity-40">{unit}</span>
            </div>
            <div className="mt-4 flex items-center gap-3 relative z-10 bg-canvas/40 p-2.5 rounded-xl border border-white/5 w-fit">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-30">Goal:</span>
                <span className="text-[11px] font-black text-primary font-mono">{design?.toFixed(0)}</span>
            </div>
        </div>
    );
};

const DiagnosticRow = ({ label, unit, theoretical, real, lowIsBad = false, noDiff = false }: any) => {
    const diff = noDiff ? 0 : theoretical > 0 ? ((real - theoretical) / theoretical) * 100 : 0;
    const isBad = noDiff ? false : lowIsBad ? diff < -10 : Math.abs(diff) > 10;
    return (
        <tr className="border-b border-white/5 group hover:bg-white/5 transition-all relative">
            <td className="py-6 px-4 font-black text-txt-main tracking-tight opacity-80 group-hover:opacity-100 group-hover:text-primary transition-colors">{label}</td>
            <td className="py-6 px-4 text-txt-muted uppercase text-[9px] font-bold opacity-40">{unit}</td>
            <td className="py-6 px-4 font-mono text-txt-muted opacity-60">{(theoretical || 0).toFixed(0)}</td>
            <td className={`py-6 px-4 font-mono font-black ${isBad ? 'text-danger' : 'text-primary'} text-lg`}>{(real || 0).toFixed(0)}</td>
            <td className={`py-6 px-4 font-mono ${isBad ? 'text-danger' : 'text-success'} font-bold opacity-80`}>
                {noDiff ? '-' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`}
            </td>
            <td className="py-6 px-4 text-right">
                <div className={`inline-block w-4 h-4 rounded-full ${isBad ? 'bg-danger shadow-glow-danger/60 animate-pulse' : 'bg-success shadow-glow-success/40'} border-2 border-white/10 shadow-lg`}></div>
            </td>
        </tr>
    );
};

// ── FLOATING AI PANEL FOR MONITORING ──────────────────────────────────────────────
const FloatingAiPanel = ({ fleet, selectedWell, language, t }: { fleet: WellFleetItem[], selectedWell?: WellFleetItem, language: string, t: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState<any>(null);
    const endRef = useRef<HTMLDivElement>(null);

    // AI 15s MINIMIZE
    const [lastInteraction, setLastInteraction] = useState(Date.now());
    useEffect(() => {
        if (!isOpen) {
            setLastInteraction(Date.now());
            return;
        }
        const interval = setInterval(() => {
            if (Date.now() - lastInteraction >= 15000) setIsOpen(false);
        }, 1000);
        return () => clearInterval(interval);
    }, [isOpen, lastInteraction]);

    useEffect(() => {
        const apiKey = getApiKey();
        if (!apiKey) {
            console.warn("Antigravity AI: No API Key found.");
            setMsgs([{ role: 'model', text: language === 'es' ? "❌ Error: No se encontró la clave de API (GEMINI_API_KEY)." : "❌ Error: No API Key found (GEMINI_API_KEY)." }]);
            return;
        }

        try {
            // Build context based on whether looking at fleet or specific well
            let contextData = "";

            if (selectedWell) {
                const healthScore = getWellHealthScore(selectedWell);
                contextData = `ANALYSIS FOR SPECIFIC WELL: ${selectedWell.name}
                - Overall Status: ${selectedWell.status.toUpperCase()} (Score: ${healthScore.toFixed(0)}/100)
                - Production: Test=${selectedWell.productionTest.rate?.toFixed(0) || 0} BPD, Target=${selectedWell.targetRate?.toFixed(0) || 0} BPD
                - Pressures: PIP=${selectedWell.productionTest.pip?.toFixed(0) || 0} psi, THP=${selectedWell.productionTest.thp?.toFixed(0) || 0} psi
                - Component Health: Pump=${selectedWell.health.pump.toUpperCase()}, Motor=${selectedWell.health.motor.toUpperCase()}
                - Diagnostics: VSD Status=${selectedWell.predictive.vsdStatus.toUpperCase()}`;
            } else {
                const alarms = fleet.filter(w => w.status !== 'normal');
                contextData = `FLEET OVERVIEW: ${fleet.length} total wells monitored.
                - Wells with issues (${alarms.length}):
                ${alarms.map(w => `   * ${w.name}: ${w.status.toUpperCase()} (Score ${getWellHealthScore(w).toFixed(0)}/100)`).join('\n')}`;
            }

            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-pro',
                systemInstruction: `You are "Antigravity AI Co-Pilot", a Senior ESP Reliability Engineer.
                Mission: Provide diagnostics and recommendations based on real-time data.
                Respond in ${language === 'es' ? 'SPANISH' : 'ENGLISH'}. 
                SYSTEM DATA:\n${contextData}`
            });
            const s = model.startChat({ history: [] });
            setSession(s);

            const initialGreet = selectedWell
                ? (language === 'es' ? `Hola. Monoreando pozo **${selectedWell.name}**. Salud: ${getWellHealthScore(selectedWell).toFixed(0)}%. ¿En qué diagnóstico te ayudo?` : `Hello. Monitoring well **${selectedWell.name}**. Health: ${getWellHealthScore(selectedWell).toFixed(0)}%. How can I help?`)
                : (language === 'es' ? `Hola. Monitoreando **${fleet.length}** pozos. Tengo ${fleet.filter(w => w.status !== 'normal').length} alertas activas. ¿Revisamos la flota?` : `Hello. Monitoring **${fleet.length}** wells. I have ${fleet.filter(w => w.status !== 'normal').length} active alerts. Shall we review?`);

            setMsgs([{ role: 'model', text: initialGreet }]);
        } catch (err) {
            console.error("Antigravity AI Init Error:", err);
            setMsgs([{ role: 'model', text: "❌ Error inicializando sesión de IA." }]);
        }
    }, [selectedWell, language]); // Removed fleet from deps to avoid constant resets, only reset if well changes

    useEffect(() => { if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, isOpen]);

    const send = async () => {
        if (!input.trim() || !session || loading) return;
        const txt = input; setInput(''); setLoading(true);
        setMsgs(p => [...p, { role: 'user', text: txt }]);
        try {
            const res = await session.sendMessage(txt);
            setMsgs(p => [...p, { role: 'model', text: res.response.text() }]);
        } catch (err: any) {
            console.error("Antigravity AI Send Error:", err);
            setMsgs(p => [...p, { role: 'model', text: `❌ Connection error: ${err.message || 'Unknown issue'}` }]);
        }
        setLoading(false);

        // --- NEW: SAVE TO AI MEMORY ---
        if (session && input && msgs.length > 0) {
             const signature = AiMemoryService.generateSignature(selectedWell ? {
                 rate: selectedWell.currentRate,
                 pip: selectedWell.productionTest.pip,
                 frequency: selectedWell.productionTest.freq,
                 model: selectedWell.status
             } : { fleetCount: fleet.length });

             const lastMsg = msgs[msgs.length - 1];
             if (lastMsg.role === 'model') {
                 AiMemoryService.saveCase({
                     category: 'diagnosis',
                     wellName: selectedWell?.name,
                     technicalSignature: signature,
                     context: selectedWell || { fleetCount: fleet.length },
                     recommendation: lastMsg.text
                 });
             }
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
            <div className={`transition-all duration-500 transform origin-bottom-right mb-4 ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none'}`}>
                <div
                    onMouseMove={() => setLastInteraction(Date.now())}
                    onKeyDown={() => setLastInteraction(Date.now())}
                    className="w-[380px] h-[520px] glass-surface border-primary/30 rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
                >
                    {/* CHAT HEADER */}
                    <div className="p-5 border-b border-surface-light flex items-center justify-between bg-primary/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary rounded-2xl shadow-[0_0_20px_rgba(var(--color-primary),0.4)] ring-4 ring-primary/20 animate-pulse">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-txt-main text-glow">ANTIGRAVITY AI</h4>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Monitoreo Co-Piloto</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => AiMemoryService.exportMemory()} 
                                className="p-2 hover:bg-white/10 rounded-xl transition-all group"
                                title={language === 'es' ? 'Exportar Memoria IA (Archivo .json)' : 'Export AI Memory (.json)'}
                            >
                                <Download className="w-4 h-4 text-txt-muted group-hover:text-primary" />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-surface-light rounded-xl transition-colors">
                                <X className="w-4 h-4 text-txt-muted" />
                            </button>
                        </div>
                    </div>

                    {/* MESSAGES */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-canvas/30">
                        {msgs.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[11px] leading-relaxed font-medium ${m.role === 'user' ? 'bg-primary text-white shadow-lg rounded-br-none' : 'bg-surface border border-surface-light text-txt-main shadow-sm rounded-bl-none'}`}>
                                    {/* Optional markdown parsing could be added here similar to App.tsx */}
                                    <div className="whitespace-pre-wrap">{m.text}</div>
                                </div>
                            </div>
                        ))}
                        {loading && <div className="flex justify-start"><div className="bg-surface px-4 py-2 rounded-2xl border border-surface-light"><RefreshCw className="w-3 h-3 animate-spin text-primary" /></div></div>}
                        <div ref={endRef} />
                    </div>

                    {/* INPUT */}
                    <div className="p-4 bg-surface border-t border-surface-light">
                        <div className="relative">
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={language === 'es' ? 'Escribe o pregunta...' : 'Ask about fleet/wells...'} className="w-full bg-canvas border border-surface-light rounded-2xl pl-4 pr-12 py-3 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-semibold placeholder:text-txt-muted/50" />
                            <button onClick={send} disabled={!input.trim() || loading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-30">
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <button onClick={() => setIsOpen(!isOpen)} className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_15px_35px_rgba(var(--color-primary),0.4)] transition-all duration-500 group border-4 border-canvas overflow-hidden ${isOpen ? 'bg-surface text-primary rotate-90 scale-90' : 'bg-primary text-white'}`}>
                {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {fleet.filter(w => w.status !== 'normal').length > 0 && !isOpen && (
                    <div className="absolute top-0 right-0 w-4 h-4 bg-danger rounded-full border-2 border-canvas shadow-glow-danger animate-pulse"></div>
                )}
            </button>
        </div>
    );
};

export default PhaseMonitoreo;
