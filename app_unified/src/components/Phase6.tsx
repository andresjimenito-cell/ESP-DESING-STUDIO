import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Gauge, Printer, Droplets, ArrowDown, ClipboardCheck, X, Hammer, Thermometer, RefreshCw, Maximize2, Minimize2, Brain, Calendar, Play, Zap, TrendingDown, TrendingUp, Monitor, Layers, Repeat, Cpu, Target, Info, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle, Database } from 'lucide-react';
import { SystemParams, EspPump, ScenarioData } from '../types';
import { calculateTDH, calculateSystemResults, calculateBaseHead, calculateBasePowerPerStage, calculatePDP, calculatePIP, calculateFluidProperties, interpolateTVD, generateMultiCurveData, findIntersection, getShaftLimitHp, calculatePwf, getDownloadFilename } from '../utils';
import { PumpChart } from './PumpChart';
import { PerformanceCurveMultiAxis } from './PerformanceCurveMultiAxis';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams; // Design Params
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    pump: EspPump | null;
    designFreq: number;
    trail?: any[];
}

// --- SCENARIO HELPERS ---
const getScenarioParams = (baseParams: SystemParams, scenario: ScenarioData): SystemParams => {
    return {
        ...baseParams,
        inflow: { ...baseParams.inflow, ip: scenario.ip },
        fluids: {
            ...baseParams.fluids,
            waterCut: scenario.waterCut,
            gor: scenario.gor,
            glr: scenario.gor * (1 - scenario.waterCut / 100)
        },
        pressures: { ...baseParams.pressures, totalRate: scenario.rate }
    };
};

const DesignMetric = ({ label, value }: any) => (
    <div className="bg-surface border border-primary/20 rounded-xl p-3 flex flex-col justify-between transition-all hover:bg-white/5 shadow-sm">
        <span className="text-[10px] text-txt-muted font-black uppercase tracking-[0.1em] mb-1">{label}</span>
        <span className="text-sm font-mono font-black text-txt-main tracking-tighter">{value}</span>
    </div>
);

const PremiumField = ({ label, value, unit, icon: Icon, onChange, color = 'primary' }: any) => {
    const colorClasses = {
        primary: { border: 'border-primary/30', line: 'bg-primary', icon: 'text-primary', unit: 'text-primary' },
        secondary: { border: 'border-secondary/30', line: 'bg-secondary', icon: 'text-secondary', unit: 'text-secondary' },
        success: { border: 'border-success/30', line: 'bg-success', icon: 'text-success', unit: 'text-success' },
    }[color] || { border: 'border-primary/30', line: 'bg-primary', icon: 'text-primary', unit: 'text-primary' };

    return (
        <div className={`bg-surface border ${colorClasses.border} rounded-xl p-3 flex flex-col justify-between group h-20 transition-all shadow-sm relative overflow-hidden focus-within:border-white/40`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${colorClasses.line}`}></div>
            <div className="flex justify-between items-center mb-0.5 relative z-10">
                <label className="text-[10px] font-black text-txt-muted uppercase tracking-[0.1em]">{label}</label>
                <Icon className={`w-3 h-3 ${colorClasses.icon} opacity-80`} />
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)))}
                    className="w-full bg-transparent text-lg font-black text-txt-main outline-none font-mono tracking-tighter select-all"
                />
                <span className={`text-[9px] font-black ${colorClasses.unit} uppercase mb-0.5`}>{unit}</span>
            </div>
        </div>
    );
};

const PremiumDate = ({ label, value, icon: Icon, onChange }: any) => (
    <div className="bg-surface border border-primary/20 rounded-xl p-3 flex flex-col justify-between group h-20 transition-all shadow-inner relative overflow-hidden focus-within:border-white/40">
        <div className="flex justify-between items-center mb-0.5 relative z-10">
            <label className="text-[10px] font-black text-txt-muted uppercase tracking-[0.1em]">{label}</label>
            <Icon className="w-3 h-3 text-primary opacity-80" />
        </div>
        <div className="flex items-baseline gap-2 relative z-10">
            <input
                type="date"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent text-[11px] font-black text-txt-main outline-none font-mono tracking-tighter cursor-pointer"
            />
        </div>
    </div>
);

const PremiumMetricCard = ({ label, value, subValue, icon: Icon, color, alert }: any) => {
    const IconComponent = Icon || Activity;
    return (
        <div className={`card-solid rounded-2xl border ${alert ? 'border-danger shadow-glow-danger/20' : 'border-white/10 shadow-2xl'} p-5 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-all h-[130px] light-sweep`}>
            <div className={`absolute -right-6 -top-6 w-20 h-20 ${color === 'secondary' ? 'bg-secondary/10' : color === 'primary' ? 'bg-primary/10' : 'bg-danger/10'} blur-3xl rounded-full`}></div>
            <div className="flex justify-between items-start relative z-10">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-80">{label}</span>
                <IconComponent className={`w-5 h-5 ${color === 'secondary' ? 'text-secondary' : color === 'primary' ? 'text-primary' : 'text-danger'} ${alert ? 'animate-pulse' : ''}`} />
            </div>
            <div className="mt-auto relative z-10">
                <div className={`text-2xl font-black ${alert ? 'text-danger' : 'text-txt-main'} tracking-tighter leading-none`}>{value}</div>
                <div className="text-[9px] font-black text-txt-muted uppercase mt-2 tracking-widest opacity-60">{subValue}</div>
            </div>
        </div>
    );
};

const CompPremium = ({ label, design, actual, unit, color }: any) => {
    const diff = design > 0 ? ((actual - design) / design) * 100 : 0;
    const isOver = diff > 0;
    return (
        <div className="card-solid rounded-2xl border border-white/10 shadow-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-all h-[130px] light-sweep">
            <div className={`absolute -right-6 -top-6 w-20 h-20 shadow-glow-${color}/10 blur-3xl rounded-full`}></div>
            <div className="flex justify-between items-start relative z-10">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-80">{label}</span>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black border ${Math.abs(diff) < 5 ? 'bg-success/20 text-success border-success/20' : 'bg-danger/20 text-danger border-danger/20'}`}>
                    {Math.abs(diff).toFixed(1)}% {isOver ? 'UP' : 'DN'}
                </div>
            </div>
            <div className="mt-auto relative z-10">
                <div className="text-2xl font-black text-txt-main tracking-tighter leading-none">{(actual ?? 0).toFixed(0)} <small className="text-[10px] opacity-60 font-bold uppercase">{unit}</small></div>
                <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-60">DESIGN:</span>
                    <span className="text-[10px] font-black text-txt-main opacity-80 font-mono tracking-tighter">{(design ?? 0).toFixed(0)}</span>
                </div>
            </div>
        </div>
    );
};

// --- SHARED VSD SENSITIVITY ROW CALCULATOR ---
// Physically correct approach — same method as the "Capacidad Máxima" button:
// 1. Calibrate system curve with a vertical offset so it passes through the REAL measured point.
// 2. For each target Hz, scan flow range to find where the scaled pump curve CROSSES the system curve.
// 3. Feed that real intersection into calculateSystemResults for all derived values.
// Physical consistency guaranteed: higher Hz → more flow → more drawdown → LOWER Pwf → LOWER PIP → LESS submergence.
const buildVsdRows = (
    pump: any,
    actualParams: any,
    actualFreq: number,
    fieldData: any,
    actualRes: any,
    isSensActive?: boolean
): any[] => {
    if (!pump || !actualFreq || actualFreq <= 0) return [];

    const anchorFlow = (isSensActive && actualRes?.rate) ? actualRes.rate : (Number(fieldData.rate) || 0);
    const anchorHead = (isSensActive && actualRes?.head) ? actualRes.head : (actualRes?.tdh || 0);
    if (anchorFlow <= 0 || anchorHead <= 0) return [];

    const multiplier = actualParams.multiplier || 1;

    const baseFreq = pump.nameplateFrequency > 0 ? pump.nameplateFrequency : 60;
    const sl = getShaftLimitHp(pump?.series || '');
    const pumpDepthMD = actualParams?.pressures?.pumpDepthMD || 0;
    const bht = actualParams?.bottomholeTemp || 150;
    const wc = fieldData.waterCut || actualParams?.fluids?.waterCut || 0;

    const freqs: number[] = [];
    for (let f = 30; f <= 80; f += 1) freqs.push(f);
    if (!freqs.includes(actualFreq)) {
        freqs.push(actualFreq);
        freqs.sort((a, b) => a - b);
    }

    // Find pump curve vs calibrated system curve intersection at a given Hz
    const findOperatingPoint = (hz: number): { flow: number; head: number } | null => {
        const ratio = hz / baseFreq;
        const maxQ = (pump.maxGraphRate || pump.maxRate || 3000) * ratio * 1.3;
        const steps = 100;
        const stepSize = maxQ / steps;
        let prevPHead = -1, prevSHead = -1;

        for (let i = 1; i <= steps; i++) {
            const testQ = i * stepSize;
            const qBase = testQ / ratio;
            const pHead = calculateBaseHead(qBase, pump) * ratio * ratio;
            const hStat = calculateTDH(0.1, actualParams);
            const sHead = hStat + (calculateTDH(testQ, actualParams) - hStat) * multiplier;

            if (pHead <= 0) break;

            if (i > 1 && prevPHead >= 0) {
                const d1 = prevPHead - prevSHead;
                const d2 = pHead - sHead;
                if (d1 * d2 < 0) {
                    const frac = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
                    return {
                        flow: Math.max(0, (i - 1) * stepSize + stepSize * frac),
                        head: Math.max(0, prevPHead + (pHead - prevPHead) * frac),
                    };
                }
                if (d2 < 0) break; // Pump fell below system — no higher intersection
            }
            prevPHead = pHead;
            prevSHead = sHead;
        }
        return null;
    };

    // Build a single row object from the result of calculateSystemResults
    const makeRow = (hz: number, flow: number, head: number, res: any, isActual: boolean): any => {
        const bhp = res?.hpTotal || 0;
        const pumpShaft = sl > 0 ? (bhp / sl) * 100 : 0;
        const motorLoad = res?.motorLoad || 0;
        // For the sensitivity table, we always want nodal consistency (Predicted PIP)
        // to match the intersection logic of the gemelo digital.
        const pip = res?.pip || 0;

        // Physical Limits Enforcement (High-Protection Margins)
        const pipVal = res?.pip || 0;
        const sub = pumpDepthMD > 0 ? Math.max(0, pumpDepthMD - (res?.fluidLevel ?? 0)) : 0;
        const ml = motorLoad;
        const slVal = pumpShaft;

        let limitingFactor = "";
        if (sub < 500) limitingFactor = `Sumergencia de Protección (>500 ft)`;
        else if (ml >= 75) limitingFactor = `Reserva Térmica Motor (Límite 75%)`;
        else if (slVal >= 70) limitingFactor = `Reserva Mecánica Eje (Límite 70%)`;
        else if (pipVal < 300) limitingFactor = `Protección PIP (>300 psi)`;

        // Submergence derived from fluidLevel (pumpDepth - fluid level MD from surface)
        const fluidLevel = res?.fluidLevel ?? 0;
        const submergence = pumpDepthMD > 0
            ? Math.max(0, pumpDepthMD - fluidLevel)
            : (pip > 0 ? pip / (0.433 * Math.max(0.8, res?.sgMixed || 1.0)) : 0);
        // Motor temp thermodynamic refinement (Forced Convection + Motor Inefficiency)
        const kwTerminal = res?.electrical?.kw || 0;
        const motorEfficiency = (res?.electrical?.motorEff || 85) / 100;
        const qFlow = Math.max(10, flow);
        const mix_sg = Math.max(0.6, res?.sgMixed || 0.8);
        const w_c = wc / 100;
        const Cp = 0.5 * (1 - w_c) + 1.0 * w_c; // BTU/lb-F
        const heatGeneratedBtuHr = kwTerminal * (1 - motorEfficiency) * 3412;
        const massFlowLbHr = qFlow * 14.6 * mix_sg;
        const tempRise = massFlowLbHr > 0 ? (heatGeneratedBtuHr / (massFlowLbHr * Cp)) : 0;
        // Assume 15% of heat is conducted radially to casing/formation, not into fluid.
        const motorT = bht + (tempRise * 0.85);
        const pumpEff = res?.effEstimated ?? res?.efficiency ?? 0;

        const violations: { field: string, type: 'danger' | 'warning', reason: string }[] = [];

        if (motorLoad >= 95) violations.push({ field: 'motorLoad', type: 'danger', reason: 'Sobrecarga' });
        else if (motorLoad >= 80) violations.push({ field: 'motorLoad', type: 'warning', reason: 'Carga Alta' });

        if (pumpShaft >= 95) violations.push({ field: 'pumpShaft', type: 'danger', reason: 'Límite Eje' });
        else if (pumpShaft >= 85) violations.push({ field: 'pumpShaft', type: 'warning', reason: 'Torque Alto' });

        if (pumpDepthMD > 0 && submergence < 250) violations.push({ field: 'submergence', type: 'danger', reason: 'Baja Sumerg.' });
        else if (pumpDepthMD > 0 && submergence < 500) violations.push({ field: 'submergence', type: 'warning', reason: 'Sumerg. Crítica' });

        if (pip > 0 && pip < 120) violations.push({ field: 'pip', type: 'danger', reason: 'Límite PIP' });
        else if (pip > 0 && pip < 200) violations.push({ field: 'pip', type: 'warning', reason: 'Bajo PIP' });

        const isDanger = violations.some(v => v.type === 'danger');
        const isWarning = !isDanger && violations.some(v => v.type === 'warning');
        const isSuccess = violations.length === 0;

        const limitReason = violations.map(v => v.reason).join(', ');

        const drawdown = Math.max(0, (actualParams.inflow.pStatic || 1000) - (res?.pwf || 0));
        const drawdownPct = Math.min(100, (drawdown / (actualParams.inflow.pStatic || 1000)) * 100);

        return {
            hz, flow,
            bopd: flow * (1 - wc / 100),
            bwpd: flow * (wc / 100),
            pip,
            tdh: res?.tdh ?? head,
            pwf: res?.pwf ?? 0,
            pdp: res?.pdp ?? 0,
            drawdownPct,
            amps: res?.electrical?.amps ?? 0,
            volts: res?.electrical?.volts ?? 0,
            kva: res?.electrical?.systemKva ?? 0,
            kw: res?.electrical?.systemKw ?? 0,
            motorLoad, pumpEff, motorT, submergence, pumpShaft,
            vel: res?.fluidVelocity ?? 0,
            isActual, isDanger, isWarning, isSuccess, limitReason, violations,
            noIntersection: false,
        };
    };

    return freqs.map(hz => {
        const isActual = (hz === actualFreq);

        // In NORMAL mode (not simulation), the "actual" row IS the measured data point.
        // In SIMULATION mode, the "actual" row is a PREDICTION, so we search for intersection.
        if (isActual && !isSensActive) {
            return makeRow(hz, anchorFlow, anchorHead, actualRes, true);
        }

        // Search for nodal intersection for this Hz
        const op = findOperatingPoint(hz);
        if (!op || op.flow <= 0) {
            return {
                hz, flow: 0, bopd: 0, bwpd: 0, pip: 0, tdh: 0, pwf: 0, pdp: 0,
                amps: 0, volts: 0, kw: 0, motorLoad: 0, pumpEff: 0, motorT: bht,
                submergence: 0, pumpShaft: 0, vel: 0,
                isActual, isLimit: true,
                limitReason: hz < actualFreq ? 'Sin OP (Hz demasiado bajo)' : 'Sin OP (sobrepasa sistema)',
                limitMotor: false, limitShaft: false, limitSub: false, limitPip: false,
                noIntersection: true,
                violations: [],
            };
        }

        const res = calculateSystemResults(op.flow, op.head, actualParams, pump, hz);
        return makeRow(hz, op.flow, op.head, res, isActual);
    });
};

// --- REPORT COMPONENT (PRINT VIEW) ---
const HistoryMatchReport = ({ onClose, designParams, actualParams, pump, designRes, actualRes, designFreq, actualFreq, chartData, mechanics, compareScenario, fieldData, refPoints, calculatedIP, aiAnalysis, motor, degradationPct, vsdRows }: any) => {
    const { t } = useLanguage();

    const handlePrint = () => {
        const originalTitle = document.title;
        const fname = getDownloadFilename(designParams, pump, 'Field_Sync');
        document.title = fname;
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 500);
    };

    const rp0 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(0) : '-';
    const rp1 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(1) : '-';
    const rp2 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(2) : '-';

    // vsdRows is now passed as a prop from the parent to ensure consistency

    // Design vs Actual comparison rows
    const compareRows = [
        { label: 'Caudal Total', unit: 'BPD', dv: designRes?.flow ?? designParams?.pressures?.totalRate ?? 0, av: fieldData.rate },
        { label: 'BOPD', unit: 'bpd', dv: (designRes?.flow ?? 0) * (1 - (designParams?.fluids?.waterCut ?? 0) / 100), av: fieldData.rate * (1 - fieldData.waterCut / 100) },
        { label: 'BWPD', unit: 'bpd', dv: (designRes?.flow ?? 0) * ((designParams?.fluids?.waterCut ?? 0) / 100), av: fieldData.rate * (fieldData.waterCut / 100) },
        { label: 'BSW (WC)', unit: '%', dv: designParams?.fluids?.waterCut ?? 0, av: fieldData.waterCut, dec: 1 },
        { label: 'TDH', unit: 'ft', dv: designRes?.tdh ?? 0, av: actualRes?.tdh ?? 0 },
        { label: 'PIP Intake', unit: 'psi', dv: designRes?.pip ?? 0, av: fieldData.pip },
        { label: 'P Descarga (PDP)', unit: 'psi', dv: designRes?.pdp ?? 0, av: actualRes?.pdp ?? 0 },
        { label: 'Pwf (Fondo)', unit: 'psi', dv: designRes?.pwf ?? 0, av: actualRes?.pwf ?? 0 },
        { label: 'THP Superficie', unit: 'psi', dv: designParams?.pressures?.pht ?? 0, av: fieldData.thp },
        { label: 'P Estática (Pr)', unit: 'psi', dv: designParams?.inflow?.pStatic ?? 0, av: actualParams?.inflow?.pStatic ?? 0, noD: true },
        { label: 'Drawdown (psi)', unit: 'psi', dv: Math.max(0, (designParams?.inflow?.pStatic ?? 0) - (designRes?.pwf ?? 0)), av: Math.max(0, (actualParams?.inflow?.pStatic ?? 0) - (actualRes?.pwf ?? 0)) },
        { label: 'Drawdown (%)', unit: '%', dv: ((designParams?.inflow?.pStatic - designRes?.pwf) / (designParams?.inflow?.pStatic || 1) * 100), av: ((actualParams?.inflow?.pStatic - actualRes?.pwf) / (actualParams?.inflow?.pStatic || 1) * 100), dec: 1 },
        { label: 'IP del Yacimiento', unit: 'bpd/psi', dv: designParams?.inflow?.ip ?? 0, av: calculatedIP, dec: 2 },
        { label: 'Frecuencia VSD', unit: 'Hz', dv: designFreq, av: actualFreq },
        { label: 'Amperaje', unit: 'A', dv: designRes?.electrical?.amps ?? 0, av: actualRes?.electrical?.amps ?? 0, dec: 1 },
        { label: 'Voltaje Motor', unit: 'V', dv: designRes?.electrical?.volts ?? 0, av: actualRes?.electrical?.volts ?? 0 },
        { label: 'Voltaje Superficie', unit: 'V', dv: designRes?.electrical?.surfaceVolts ?? 0, av: actualRes?.electrical?.surfaceVolts ?? 0 },
        { label: 'Potencia (kW)', unit: 'kW', dv: designRes?.electrical?.kw ?? 0, av: actualRes?.electrical?.kw ?? 0, dec: 1 },
        { label: 'KVA', unit: 'kVA', dv: designRes?.electrical?.kva ?? 0, av: actualRes?.electrical?.kva ?? 0, dec: 1 },
        { label: 'Carga Motor', unit: '%', dv: designRes?.motorLoad ?? 0, av: actualRes?.motorLoad ?? 0, dec: 1 },
        { label: 'Eficiencia Bomba', unit: '%', dv: designRes?.effEstimated ?? 0, av: actualRes?.effEstimated ?? 0, dec: 1 },
        { label: 'Vel. Fluido', unit: 'ft/s', dv: designRes?.fluidVelocity ?? 0, av: actualRes?.fluidVelocity ?? 0, dec: 2 },
        { label: 'Temp. Intake', unit: '\u00b0F', dv: designParams?.bottomholeTemp ?? 0, av: actualRes?.intakeTemp ?? 0 },
        { label: 'Submergencia', unit: 'ft', dv: 0, av: actualRes?.submergenceFt ?? 0, noD: true },
        { label: 'Nivel Fluido', unit: 'ft', dv: 0, av: actualRes?.fluidLevel ?? 0, noD: true },
        { label: 'Prof. Bomba (MD)', unit: 'ft', dv: designParams?.pressures?.pumpDepthMD ?? 0, av: actualParams?.pressures?.pumpDepthMD ?? 0, noD: true },
    ];

    const bepAtFreq = (pump?.bepRate || 1000) * (actualFreq / (pump?.nameplateFrequency || 60));
    const flowRatio = bepAtFreq > 0 ? (fieldData.rate / bepAtFreq) : 1;
    const thrustStatus = flowRatio > 1.15 ? 'UPTHRUST' : flowRatio < 0.75 ? 'DOWNTHRUST' : 'NORMAL';
    const thrustClr = thrustStatus === 'UPTHRUST' ? '#d97706' : thrustStatus === 'DOWNTHRUST' ? '#dc2626' : '#059669';
    const thrustBg = thrustStatus === 'UPTHRUST' ? '#fffbeb' : thrustStatus === 'DOWNTHRUST' ? '#fef2f2' : '#f0fdf4';

    const degLvl = (degradationPct ?? 0) > 15 ? { label: 'DESGASTE CR\u00cdTICO', clr: '#dc2626', bg: '#fef2f2', brd: '#fca5a5' }
        : (degradationPct ?? 0) > 8 ? { label: 'DEGRADACI\u00d3N ALTA', clr: '#ea580c', bg: '#fff7ed', brd: '#fdba74' }
            : (degradationPct ?? 0) > 3 ? { label: 'DESVIACI\u00d3N LEVE', clr: '#ca8a04', bg: '#fefce8', brd: '#fde047' }
                : { label: 'ALINEADO A CURVA', clr: '#16a34a', bg: '#f0fdf4', brd: '#86efac' };

    const aiLines = (aiAnalysis || 'Sin diagn\u00f3stico.').split('\n').filter((l: string) => l.trim());

    const vsdCols = [
        { label: 'BFPD', key: 'flow', fmt: rp0 },
        { label: 'BOPD', key: 'bopd', fmt: rp0 },
        { label: 'BWPD', key: 'bwpd', fmt: rp0 },
        { label: 'PIP', key: 'pip', fmt: rp0, unit: 'psi' },
        { label: 'TDH', key: 'tdh', fmt: rp0, unit: 'ft' },
        { label: 'Pwf', key: 'pwf', fmt: rp0, unit: 'psi' },
        { label: 'PDP', key: 'pdp', fmt: rp0, unit: 'psi' },
        { label: 'Amps', key: 'amps', fmt: rp1, unit: 'A' },
        { label: 'Volts', key: 'volts', fmt: rp0, unit: 'V' },
        { label: 'kW', key: 'kw', fmt: rp1, unit: 'kW' },
        { label: 'Carga Motor', key: 'motorLoad', fmt: rp1, unit: '%' },
        { label: 'Efic. Bomba', key: 'pumpEff', fmt: rp1, unit: '%' },
        { label: 'Vel. Fluido', key: 'vel', fmt: rp2, unit: 'ft/s' },
        { label: 'Temp Motor', key: 'motorT', fmt: rp0, unit: '\u00b0F' },
        { label: 'Submergencia', key: 'submergence', fmt: rp0, unit: 'ft' },
        { label: 'Pump Shaft', key: 'pumpShaft', fmt: rp1, unit: '%' },
    ];

    return (
        <div className="fixed inset-0 z-[9999] bg-canvas overflow-hidden flex flex-col animate-fadeIn">
            {/* TOP BAR */}
            <div className="h-16 bg-surface border-b border-surface-light flex items-center justify-between px-8 shrink-0 no-print z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-2 rounded-lg text-white"><ClipboardCheck className="w-5 h-5" /></div>
                    <div>
                        <h3 className="text-sm font-black text-txt-main uppercase tracking-wider">HISTORY MATCH REPORT — Diagn\u00f3stico Integral</h3>
                        <p className="text-xs text-txt-muted font-bold uppercase opacity-60">Escenario: {compareScenario.toUpperCase()} | Pozo: {designParams?.metadata?.wellName || designParams?.wellName || '-'} | {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-5 py-2 rounded-xl font-bold text-xs uppercase shadow-lg active:scale-95 transition-all">
                        <Printer className="w-4 h-4" /> Imprimir / PDF
                    </button>
                    <button onClick={onClose} className="p-2 bg-surface-light hover:bg-red-500/20 text-txt-muted hover:text-danger rounded-xl transition-all"><X className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-canvas p-6 custom-scrollbar">
                <style>{`
                    .graph-force-height > div,
                    .graph-force-height .recharts-responsive-container,
                    .graph-force-height .recharts-wrapper {
                        height: 100% !important;
                        min-height: 480px !important;
                    }
                    @media print { 
                        @page { margin: 5mm; size: A4 landscape; }
                        html, body { 
                            height: auto !important; 
                            overflow: visible !important; 
                            background: white !important; 
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        /* Hide everything using visibility to allow nested elements to override */
                        body * { visibility: hidden !important; }
                        
                        /* Show the report container and all its children */
                        div[class*="fixed"][class*="z-[9999]"],
                        div[class*="fixed"][class*="z-[9999]"] * { 
                            visibility: visible !important; 
                        }
                        
                        /* Position the report container at the top */
                        div[class*="fixed"][class*="z-[9999]"] { 
                            display: block !important; 
                            position: absolute !important; 
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            height: auto !important; 
                            overflow: visible !important; 
                            padding: 0 !important;
                            margin: 0 !important;
                            background: white !important;
                            z-index: 99999 !important;
                        }
                        #hmrp { 
                            position: static !important;
                            width: 100% !important; 
                            max-width: none !important; 
                            background: white !important; 
                            color: black !important; 
                            padding: 10mm !important; 
                            margin: 0 !important; 
                            box-shadow: none !important;
                            border: none !important;
                            overflow: visible !important;
                        }
                        .page-break { page-break-before: always !important; break-before: page !important; display: block !important; height: 1px !important; }
                        .no-print { display: none !important; }
                        .break-inside-avoid { page-break-inside: avoid !important; break-inside: avoid !important; }
                        .print-graph-container { height: 350px !important; width: 100% !important; overflow: visible !important; border: 1px solid #eee !important; }
                        .graph-force-height { height: 350px !important; }
                        .sticky { position: static !important; } 
                        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 6mm !important; }
                        .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 2mm !important; }
                        table, th, td { color: black !important; border-color: #eee !important; font-size: 8.5pt !important; line-height: 1.2 !important; }
                        .bg-blue-900, .bg-amber-700, .bg-secondary { color: white !important; -webkit-print-color-adjust: exact !important; }
                        .recharts-wrapper { overflow: visible !important; width: 100% !important; height: 100% !important; }
                        .recharts-legend-wrapper { position: static !important; padding: 5px !important; }
                        .recharts-cartesian-axis-tick-value { font-size: 9pt !important; fill: black !important; }
                    }
                `}</style>

                <div id="hmrp" className="bg-white p-12 shadow-[0_50px_100px_rgba(0,0,0,0.3)] rounded-[3rem] border border-slate-200 flex flex-col justify-between mb-8 overflow-visible relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-transparent to-slate-50 pointer-events-none"></div>

                    {/* ===== ROW 1: HEADER & LOGO ===== */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                                <img src="/LOGO.png" alt="Company Logo" className="w-16 h-16 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1">REPORTE ESP <span className="text-secondary">DESIGN PRO</span></h1>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] opacity-70">SISTEMA DE DISEÑO Y ANÁLISIS DE RENDIMIENTO</p>
                            </div>
                        </div>
                        <div className="text-right text-[9px] text-slate-500">
                            <div className="font-black text-slate-900 uppercase tracking-[0.2em]">ESP Performance Analysis | {compareScenario.toUpperCase()} | {designParams?.metadata?.wellName || 'FIELD'} | Fecha: {new Date().toLocaleDateString()}</div>
                            <div className="mt-2 font-black text-slate-500">{pump?.model || '-'} | {pump?.stages} etapas | {actualFreq} Hz</div>
                            <div>Motor: {motor?.model || 'Std'} {motor?.hp || actualParams?.motorHp || '-'} HP | Serie: {pump?.series || '-'}</div>
                        </div>
                    </div>

                    {/* ===== ROW 1: STATUS CARDS ===== */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="p-2 rounded-xl border-2 flex flex-col gap-0.5" style={{ borderColor: degLvl.brd, backgroundColor: degLvl.bg }}>
                            <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Estado Hidr\u00e1ulico</div>
                            <div className="text-base font-black uppercase" style={{ color: degLvl.clr }}>{degLvl.label}</div>
                            <div className="text-xl font-black font-mono" style={{ color: degLvl.clr }}>{(degradationPct ?? 0).toFixed(1)}% <span className="text-[8px] font-bold text-slate-400">Degrad.</span></div>
                        </div>
                        <div className="p-2 rounded-xl border-2 flex flex-col gap-0.5" style={{ borderColor: thrustClr + '99', backgroundColor: thrustBg }}>
                            <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Condici\u00f3n Empuje</div>
                            <div className="text-base font-black uppercase" style={{ color: thrustClr }}>{thrustStatus}</div>
                            <div className="text-sm font-bold text-slate-600">{(flowRatio * 100).toFixed(0)}% BEP</div>
                        </div>
                        <div className="p-2 rounded-xl border-2 border-blue-200 bg-blue-50 flex flex-col gap-0.5">
                            <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest">IP Retro-Calculado</div>
                            <div className="text-base font-black text-blue-800">{calculatedIP.toFixed(2)}</div>
                            <div className="text-[9px] font-bold text-slate-500">{(designParams?.inflow?.ip ?? 0).toFixed(2)} bpd/psi</div>
                        </div>
                        <div className="p-2 rounded-xl border-2 border-slate-200 bg-slate-50 flex flex-col gap-0.5">
                            <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Carga Motor</div>
                            <div className={`text-base font-black ${(actualRes?.motorLoad ?? 0) > 100 ? 'text-red-600' : 'text-slate-900'}`}>{(actualRes?.motorLoad ?? 0).toFixed(0)}%</div>
                            <div className="text-[9px] font-bold text-slate-500">{(actualRes?.hpTotal ?? 0).toFixed(1)} HP</div>
                        </div>
                    </div>

                    {/* ===== ROW 2: AI DIAGNOSTICS & STATUS ===== */}
                    <div className="break-inside-avoid mt-4">
                        <h3 className="font-black text-[9px] uppercase tracking-[0.2em] text-blue-800 mb-2 pb-1 border-b-2 border-slate-900 flex items-center gap-1">
                            <Brain className="w-3.5 h-3.5" /> Motor IA — Diagn\u00f3stico Integral & Pr\u00f3ximos Pasos Predictivos
                        </h3>
                        <div className="bg-slate-50 rounded-xl border-2 border-slate-100 p-4 space-y-2">
                            {aiLines.map((line: string, i: number) => {
                                if (line.startsWith('\u2501')) return <div key={i} className="text-[9px] font-black text-slate-800 uppercase tracking-widest pt-3 pb-1 mt-2 border-t border-slate-200">{line.replace(/\u2501+/g, '').trim()}</div>;
                                if (/^\d+\./.test(line)) return <div key={i} className="flex gap-2 text-[10px] font-bold text-slate-800 p-1 bg-white rounded border border-slate-100"><span className="text-slate-900 font-black shrink-0 min-w-[14px]">{line.match(/^\d+/)?.[0]}.</span><span>{line.replace(/^\d+\.\s*/, '')}</span></div>;
                                return <p key={i} className={`text-[10px] font-semibold leading-relaxed p-2 rounded-lg border ${line.includes('CR\u00cdTICO') || line.includes('DOWNTHRUST') || line.includes('UPTHRUST') || line.includes('SOBRECARGADO') ? 'bg-red-50 border-red-100 text-red-900' : line.includes('AVISO') || line.includes('PRECAUCI\u00d3N') || line.includes('GAS') ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-white border-slate-100 text-slate-700'}`}>{line}</p>;
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 pt-2 border-t border-slate-200 overflow-visible break-inside-avoid">
                        <div className="flex flex-col">
                            <h3 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-800 mb-2 pb-1 border-b-2 border-slate-900 flex items-center gap-1">
                                <Activity className="w-3 h-3" /> Curva Operación ({actualFreq} Hz)
                            </h3>
                            <div className="h-[600px] print-graph-container graph-force-height border-2 border-slate-200 rounded-xl overflow-visible bg-white relative w-full flex-1">
                                <PerformanceCurveMultiAxis data={chartData} frequency={actualFreq} currentFlow={fieldData.rate} pump={pump} minHeight={580} className="w-full h-full !bg-transparent !p-4" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h3 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-800 mb-2 pb-1 border-b-2 border-slate-900 flex items-center gap-1">
                                <Layers className="w-3 h-3" /> Sensibilidad VSD Multifrecuencia
                            </h3>
                            <div className="h-[600px] print-graph-container graph-force-height border-2 border-slate-200 rounded-xl overflow-visible bg-white relative w-full flex-1">
                                {/* Utilizing PumpChart for MultiFrequency */}
                                <PumpChart data={chartData} pump={pump} currentFrequency={actualFreq} minHeight={580} className="w-full h-full !bg-transparent !p-4" />
                            </div>
                        </div>
                    </div>

                    {/* ===== ROW 4: DESIGN vs ACTUAL TABLE ===== */}
                    <div className="mt-6 pt-4 border-t border-slate-200 break-inside-avoid">
                        <h3 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-800 mb-2 pb-1 border-b-2 border-slate-900 flex items-center gap-1">
                            <Repeat className="w-3 h-3" /> Tabla Comparativa: Diseño Original vs. Condiciones Actuales de Campo
                        </h3>
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-visible mt-4">
                            <table className="w-full text-[10px]">
                                <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200">
                                        <th className="py-3 px-4 text-left font-black uppercase tracking-widest text-slate-900 border-r border-slate-200">Parámetro</th>
                                        <th className="py-3 px-2 text-center font-black uppercase text-slate-500">Ud.</th>
                                        <th className="py-3 px-4 text-center font-black uppercase bg-slate-900 text-white shadow-lg">▪ DISEÑO</th>
                                        <th className="py-3 px-4 text-center font-black uppercase bg-secondary text-slate-900 shadow-lg">■ ACTUAL CAMPO</th>
                                        <th className="py-3 px-2 text-center font-black uppercase text-slate-500">Δ%</th>
                                        <th className="py-3 px-2 text-center font-black uppercase text-slate-500">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {compareRows.map((row, i) => {
                                        const d = row.dv ?? 0;
                                        const a = row.av ?? 0;
                                        const diff = (!row.noD && d !== 0) ? ((a - d) / d) * 100 : null;
                                        const isGood = diff !== null && Math.abs(diff) < 8;
                                        const dec = row.dec ?? 0;
                                        const fmt = (v: number) => isNaN(v) ? '-' : Number(v).toFixed(dec);
                                        return (
                                            <tr key={i} className="transition-all hover:bg-slate-50">
                                                <td className="py-3 px-4 font-black text-slate-900 uppercase tracking-tight border-r border-slate-100">{row.label}</td>
                                                <td className="py-3 px-2 text-center text-slate-400 font-mono text-[9px]">{row.unit}</td>
                                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-600 bg-slate-50/50 border-r border-slate-100">{row.noD ? '—' : fmt(d)}</td>
                                                <td className="py-3 px-4 text-center font-mono font-black text-slate-900 bg-secondary/5">{fmt(a)}</td>
                                                <td className={`py-3 px-2 text-center font-black font-mono ${diff === null ? 'text-slate-300' : isGood ? 'text-success' : 'text-danger'}`}>
                                                    {diff === null ? '—' : `${diff > 0 ? '↑' : '↓'}${Math.abs(diff).toFixed(1)}%`}
                                                </td>
                                                <td className={`py-3 px-2 text-center font-black uppercase text-[8px] tracking-widest ${diff === null ? 'text-slate-400' : isGood ? 'text-success' : 'text-danger'}`}>
                                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${isGood ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                                                        {diff === null ? 'INFO' : isGood ? 'SYNC' : 'ALIGN'}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200 break-inside-avoid">
                        <h3 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-800 mb-2 pb-1 border-b-2 border-slate-900 flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Tabla de Sensibilidad VSD (Gemelo Digital)
                        </h3>
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-auto print:overflow-visible max-h-[500px] print:max-h-none mt-2 custom-scrollbar-h shadow-lg">
                            <table className="w-full text-[9px] text-center border-collapse min-w-[1000px]">
                                <thead className="bg-slate-50 sticky top-0 z-30">
                                    <tr className="sticky top-0 z-30">
                                        <th className="p-2 px-3 font-black uppercase tracking-widest border-b border-slate-200 sticky left-0 z-40 bg-slate-50 text-secondary">Hz</th>
                                        {vsdCols.map(col => (
                                            <th key={col.label} className="p-2 px-1 font-black uppercase tracking-widest border-b border-slate-200 bg-slate-50 text-slate-800">
                                                {col.label}
                                                <span className="block text-[7px] opacity-60 lowercase font-normal">{col.unit}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {vsdRows.map((row, i) => {
                                        const tdClass = row.isActual
                                            ? 'bg-blue-50 text-blue-900'
                                            : row.isDanger
                                                ? 'bg-red-50 text-red-900'
                                                : row.isWarning
                                                    ? 'bg-amber-50 text-amber-900'
                                                    : 'bg-white text-slate-900';
                                        return (
                                            <tr key={row.hz} className="hover:bg-slate-50" title={row.limitReason || ''}>
                                                <td className={`${tdClass} p-1.5 border-r border-slate-100 font-mono font-bold sticky left-0 z-10 bg-inherit shadow-[1px_0_3px_rgba(0,0,0,0.05)]`}>
                                                    {row.hz} Hz
                                                    {row.isActual && <span className="ml-1 text-[7px] bg-blue-500 text-white px-1 rounded shadow-lg shadow-blue-500/20">FRECUENCIA ACTUAL</span>}
                                                    {row.isDanger && !row.isActual && <span className="ml-1 text-[7px] bg-danger text-white px-1 rounded animate-pulse">CRÍTICO</span>}
                                                    {row.isWarning && !row.isActual && <span className="ml-1 text-[7px] bg-amber-500 text-white px-1 rounded">AVISO</span>}
                                                </td>
                                                {vsdCols.map(col => (
                                                    <td key={col.label} className={`${tdClass} p-1.5 font-mono print:text-black`}>
                                                        {col.fmt((row as any)[col.key])}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ===== FOOTER ===== */}
                    <div className="pt-3 border-t-4 border-slate-900 flex justify-between items-center">
                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">ESP DIGITAL TWIN | An\u00e1lisis Inteligente de Rendimiento</div>
                        <div className="flex gap-12">
                            <div className="text-center"><div className="w-36 border-b-2 border-slate-300 mb-1 h-8"></div><div className="text-[7px] font-black uppercase text-slate-400">{t('p6.engineerApproval')}</div></div>
                            <div className="text-center"><div className="w-36 border-b-2 border-slate-300 mb-1 h-8"></div><div className="text-[7px] font-black uppercase text-slate-400">{t('p6.operationsDirectorate')}</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const FieldInput = ({ label, value, unit, onChange, icon: Icon, disabled = false }: any) => (
    <div className={`bg-surface border border-surface-light rounded-xl p-3 flex flex-col justify-between group focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-0.5">
            <label className="text-[9px] font-bold text-txt-muted uppercase tracking-wider group-focus-within:text-primary transition-colors">{label}</label>
            {Icon && <Icon className="w-3.5 h-3.5 text-primary opacity-60" />}
        </div>
        <div className="flex items-baseline gap-1.5">
            <input
                type="number"
                value={value}
                onChange={onChange}
                className="w-full bg-transparent text-lg font-black text-txt-main outline-none placeholder-surface-light font-mono"
                disabled={disabled}
            />
            <span className="text-[9px] font-bold text-txt-muted uppercase select-none">{unit}</span>
        </div>
    </div>
);

const DateInput = ({ label, value, onChange, icon: Icon }: any) => (
    <div className="bg-surface border border-surface-light rounded-xl p-3 flex flex-col justify-between group focus-within:border-secondary/50 focus-within:ring-1 focus-within:ring-secondary/20 transition-all shadow-sm">
        <div className="flex justify-between items-center mb-0.5">
            <label className="text-[9px] font-bold text-txt-muted uppercase tracking-wider group-focus-within:text-secondary transition-colors">{label}</label>
            {Icon && <Icon className="w-3.5 h-3.5 text-secondary opacity-60" />}
        </div>
        <div className="flex items-baseline gap-1.5">
            <input
                type="date"
                value={value}
                onChange={onChange}
                className="w-full bg-transparent text-xs font-black text-txt-main outline-none placeholder-surface-light font-mono"
            />
        </div>
    </div>
);

const f0 = (n: number) => (n !== undefined && !isNaN(n) ? n.toFixed(0) : '0');

const CompCard = ({ label, designVal, actualVal, unit }: any) => {
    const diff = actualVal - designVal;
    const pct = designVal !== 0 ? (diff / designVal) * 100 : 0;
    const isGood = Math.abs(pct) < 5;

    return (
        <div className={`glass-surface rounded-2xl border border-surface-light p-4 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 light-sweep ${isGood ? 'hover:border-primary/50' : ''}`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${isGood ? 'bg-primary shadow-glow-primary' : 'bg-secondary'}`}></div>
            <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] mb-3 opacity-70 group-hover:opacity-100 transition-opacity">{label}</span>
            <div className="flex justify-between items-end relative z-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] font-black text-txt-muted uppercase ring-1 ring-surface-light px-1 rounded">{useLanguage().t('p6.design')}</span>
                        <span className="text-xs font-bold text-secondary font-mono tracking-tight">{designVal.toFixed(0)}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-txt-main tracking-tighter drop-shadow-sm">{actualVal.toFixed(0)}</span>
                        <span className="text-[9px] font-bold text-txt-muted uppercase tracking-widest">{unit}</span>
                    </div>
                </div>
                <div className={`text-right px-2 py-1 rounded-lg backdrop-blur-md ${Math.abs(pct) < 2 ? 'bg-surface-light text-txt-muted' : pct > 0 ? 'bg-primary/10 text-primary shadow-glow-primary' : 'bg-danger/10 text-danger'}`}>
                    <div className="text-[11px] font-black font-mono tracking-tighter">{pct > 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%</div>
                </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-primary/5 blur-2xl rounded-full group-hover:bg-primary/20 transition-all duration-500"></div>
        </div>
    );
};

const SimulatedMetric = ({ label, value, sub, color = "primary", badge }: any) => {
    const colorClasses: any = {
        primary: 'text-primary',
        secondary: 'text-secondary',
        success: 'text-success',
        danger: 'text-danger',
    };

    return (
        <div className="glass-surface-light border border-white/5 rounded-2xl p-4 group transition-all duration-500 hover:border-white/20">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-60">{label}</span>
                {badge && (
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border ${badge.includes('UP') ? 'bg-success/20 text-success border-success/30' : 'bg-danger/20 text-danger border-danger/30'}`}>
                        {badge}
                    </span>
                )}
            </div>
            <div className="flex flex-col">
                <span className={`text-xl font-black font-mono tracking-tighter ${colorClasses[color]}`}>{value}</span>
                <span className="text-[9px] font-black text-txt-muted uppercase opacity-40 mt-0.5 tracking-widest">{sub}</span>
            </div>
        </div>
    );
};

export const Phase6: React.FC<Props> = ({ params, setParams, pump, designFreq, trail }) => {
    const { t } = useLanguage();
    const [showReport, setShowReport] = useState(false);
    const [isChartExpanded, setIsChartExpanded] = useState(false);
    const [compareScenario, setCompareScenario] = useState<'min' | 'target' | 'max'>('target');
    const [chartMode, setChartMode] = useState<'telemetry' | 'comparative'>('telemetry');
    const [viewMode, setViewMode] = useState<'telemetry' | 'sensitivity'>('sensitivity');
    const [isVsdTableExpanded, setIsVsdTableExpanded] = useState(false);
    const [sensScenario, setSensScenario] = useState<{ active: boolean, ip: number, thp: number }>({ active: false, ip: 0, thp: 0 });
    const [showSensModal, setShowSensModal] = useState(false);
    const [isDesignCollapsed, setIsDesignCollapsed] = useState(true);
    const [isIpManual, setIsIpManual] = useState(false);


    // --- LOCAL STATE FOR FIELD DATA ---
    // Initialize from params if available
    const [fieldData, setFieldData] = useState({
        rate: params.historyMatch?.rate ?? 0,
        frequency: params.historyMatch?.frequency ?? 0,
        waterCut: params.historyMatch?.waterCut ?? 0,
        thp: params.historyMatch?.thp ?? 0,
        tht: params.historyMatch?.tht ?? 0,
        pip: params.historyMatch?.pip ?? 0,
        pd: params.historyMatch?.pd ?? 0,
        fluidLevel: params.historyMatch?.fluidLevel ?? 0,
        submergence: params.historyMatch?.submergence ?? 0,
        pStatic: (params.historyMatch?.pStatic > 0) ? params.historyMatch.pStatic : (params.inflow?.pStatic || 0),
        ip: params.historyMatch?.ip ?? 0,
        startDate: params.historyMatch?.startDate ?? (params.historyMatch ? new Date().toISOString().split('T')[0] : ''),
        matchDate: params.historyMatch?.matchDate ?? (params.historyMatch ? new Date().toISOString().split('T')[0] : ''),
    });

    // --- SIMULATION STATE (MAXIMA CAPACIDAD) ---
    // --- SIMULATION STATE (MAXIMA CAPACIDAD) ---
    const [isMaxCapActive, setIsMaxCapActive] = useState(false);
    const [simFreq, setSimFreq] = useState(fieldData.frequency || designFreq || 60);

    // Sync Simulation Frequency when activated or when external params change
    useEffect(() => {
        if (isMaxCapActive) {
            setSimFreq(fieldData.frequency);
        }
    }, [isMaxCapActive, fieldData.frequency]);

    // EXTERNAL SYNC: React to changes in params.historyMatch (e.g. during playback)
    useEffect(() => {
        if (params.historyMatch) {
            const h = params.historyMatch;
            // Only update if there is a real difference
            if (h.rate !== fieldData.rate || h.frequency !== fieldData.frequency || h.pip !== fieldData.pip || h.thp !== fieldData.thp) {
                setFieldData({
                    ...h,
                    pStatic: (h.pStatic > 0) ? h.pStatic : (params.inflow?.pStatic || 0),
                    ip: h.ip ?? 0
                });
                if (!isMaxCapActive) setSimFreq(h.frequency);
            }
        }
    }, [params.historyMatch, params.inflow?.pStatic]);

    // BUG FIX: Persist fieldData to global params
    useEffect(() => {
        if (setParams) {
            setParams(prev => {
                // Avoid infinite feedback loops
                if (prev.historyMatch &&
                    prev.historyMatch.rate === fieldData.rate &&
                    prev.historyMatch.frequency === fieldData.frequency &&
                    prev.historyMatch.pip === fieldData.pip &&
                    prev.historyMatch.thp === fieldData.thp &&
                    prev.historyMatch.pd === fieldData.pd) return prev;

                return {
                    ...prev,
                    historyMatch: fieldData
                };
            });
        }
    }, [fieldData, setParams]);

    // 1. DERIVE DESIGN PARAMS (Standard)
    const designParams = useMemo(() => {
        if (!params.targets || !params.targets[compareScenario]) return params;
        return getScenarioParams(params, params.targets[compareScenario]);
    }, [params, compareScenario]);

    // NO-AUTO-CALC: Removed the automatic fallback that calculated PIP/THT if 0.
    // The system must now strictly reflect whatever is in the JSON or CSV.


    // 2. MATCH LOGIC: BACK-CALCULATE ACTUAL IP & GENERATE ACTUAL SYSTEM CURVE
    //
    // KEY PRINCIPLE: If the pump IS operating at (fieldData.rate, fieldData.frequency),
    // the pump curve tells us the TDH the pump is delivering (actualPumpTDH).
    // The system curve MUST pass through this same point.
    // We back-calculate IP from the measured PIP to make the system curve pass there.
    const actualResSummary = useMemo(() => {
        const baseFreq = pump?.nameplateFrequency || 60;
        const freq = Math.max(1, Number(fieldData.frequency) || 60);
        const q = Math.max(0, Number(fieldData.rate) || 0);

        // A. TDH the pump is ACTUALLY DELIVERING at this Q and frequency
        //    This is derived from the pump affinity curve — this is the ground truth.
        let pumpTDH = 0;
        if (pump && q > 0) {
            const ratio = freq / baseFreq;
            const qBase = q / ratio;
            const hBase = calculateBaseHead(qBase, pump);
            pumpTDH = Math.max(0, hBase * Math.pow(ratio, 2));
        }

        // B. Back-calculate the system state from the measured PIP
        //    The system curve TDH at Q_op must equal pumpTDH.
        //    TDH_system = THP/grad + pumpTVD + friction_ft - PIP/grad
        //    Re-arranged: since we KNOW pumpTDH and KNOW PIP (measured),
        //    we need actualParams such that calculateSystemTDH(q, actualParams) = pumpTDH.
        //    We do this by using the measured PIP to get Pwf, then back-calc IP.

        const pumpTVD = interpolateTVD(params.pressures.pumpDepthMD, params.survey);
        const perfsTVD = interpolateTVD(params.wellbore.midPerfsMD, params.survey);
        const deltaTVD = Math.max(0, perfsTVD - pumpTVD);

        const pipMeasured = fieldData.pip > 0 ? fieldData.pip : 10;
        const props = calculateFluidProperties(pipMeasured, params.bottomholeTemp, params);
        const grad = Math.max(0.1, props.gradMix);
        const pwfActual = pipMeasured + (deltaTVD * grad);

        // C. Calculate Actual IP from the measured state (Always done for friction calibration)
        const safePstatic = Math.max(10, fieldData.pStatic || params.inflow.pStatic || 0);
        const drawdown = Math.max(1, safePstatic - pwfActual);
        const autoIp = q > 0 ? q / drawdown : params.inflow.ip;

        // D. Construct "Actual" Params Object for Calibration
        const calibrationP = {
            ...params,
            inflow: { ...params.inflow, ip: autoIp, pStatic: safePstatic },
            fluids: { ...params.fluids, waterCut: fieldData.waterCut },
            pressures: { ...params.pressures, pht: fieldData.thp, totalRate: q }
        };

        // E. Calculate System Curve Friction Multiplier (Always based on Auto-IP)
        let fMulti = 1;
        if (q > 0 && pumpTDH > 0) {
            const rawSysTDH = calculateTDH(q, calibrationP);
            const hStat = calculateTDH(0.1, calibrationP);

            if (rawSysTDH > hStat) {
                const theoreticalFriction = rawSysTDH - hStat;
                const requiredFriction = pumpTDH - hStat;

                if (theoreticalFriction > 0) {
                    fMulti = requiredFriction / theoreticalFriction;
                    if (fMulti < 0.1) fMulti = 0.1;
                    if (fMulti > 5) fMulti = 5;
                }
            }
        }

        const usedIp = isIpManual && fieldData.ip > 0 ? fieldData.ip : autoIp;
        const actualP = {
            ...params,
            inflow: { ...params.inflow, ip: usedIp, pStatic: safePstatic },
            fluids: { ...params.fluids, waterCut: fieldData.waterCut },
            pressures: { ...params.pressures, pht: fieldData.thp, totalRate: q }
        };

        return { actualParams: actualP, autoIp, calculatedIP: usedIp, actualPumpTDH: pumpTDH, sysCurveFrictionMultiplier: fMulti };

    }, [fieldData.rate, fieldData.pip, fieldData.thp, fieldData.waterCut, fieldData.frequency, fieldData.pStatic, fieldData.ip, isIpManual, params, pump]);

    const { actualParams, calculatedIP, actualPumpTDH, sysCurveFrictionMultiplier } = actualResSummary;

    // 3. ACTUAL TDH = what the pump delivers at this frequency & flow (from pump curve)
    //    This is the REAL operating point head. Not re-derived from the system curve.
    //    If we have no pump or zero flow, fall back to system calc.
    const actualTDH = useMemo(() => {
        const safeRate = Number(fieldData.rate) || 0;
        if (pump && safeRate > 0 && actualPumpTDH > 0) {
            return actualPumpTDH;
        }
        return calculateTDH(safeRate, actualParams);
    }, [pump, fieldData.rate, actualPumpTDH, actualParams]);

    useEffect(() => {
        const { pdp } = calculatePDP(Number(fieldData.rate) || 0, actualParams);
        setFieldData(prev => {
            const newPd = Math.round(pdp);
            return (prev.pd !== newPd) ? { ...prev, pd: newPd } : prev;
        });
    }, [actualTDH, fieldData.rate, actualParams]);

    const targetFreq = params.targets && params.targets[compareScenario] ? params.targets[compareScenario].frequency : designFreq;
    const designRes = calculateSystemResults(designParams.pressures.totalRate, calculateTDH(designParams.pressures.totalRate, designParams), designParams, pump || {} as any, targetFreq);

    // For actual results, use the pump-derived TDH (the real operating point)
    const actualResRaw = useMemo(() => {
        return calculateSystemResults(Number(fieldData.rate) || 0, actualTDH, actualParams, pump || {} as any, Number(fieldData.frequency) || 60);
    }, [fieldData.rate, actualTDH, actualParams, pump, fieldData.frequency]);

    // --- CALCULATE ACTUAL INTAKE TEMPERATURE & RIGOROUS SUBMERGENCE ---
    const actualRes = useMemo(() => {
        const pumpMD = params.pressures.pumpDepthMD || 0;
        const fluidLevelMD = actualResRaw?.fluidLevel || actualResRaw?.fluidLevelMD || 0;
        const subMD = Math.max(0, pumpMD - fluidLevelMD);

        return {
            ...actualResRaw,
            actualFreq: fieldData.frequency,
            submergenceFt: actualResRaw?.submergenceFt ?? subMD,
            fluidLevelMD,
            intakeTemp: actualResRaw?.intakeTemp ?? (params.bottomholeTemp || 150),
            head: actualResRaw?.tdh ?? actualTDH,
            rate: fieldData.rate
        };
    }, [actualResRaw, actualTDH, params.bottomholeTemp, params.pressures.pumpDepthMD, fieldData.rate, pump, fieldData.frequency]);

    const updateField = (key: string, val: any) => {
        setFieldData(prev => ({ ...prev, [key]: val }));
    };

    // --- CALCULATE DEGRADATION % ---
    // PHYSICAL LOGIC:
    // - hTheoretical = head the FRESH pump curve says it should deliver at (Q_actual, freq_actual)
    //   This is independent of field conditions — it's pure pump affinity curve.
    // - rawSystemTDH = TDH derived purely from field measurements (PIP, THP, Q)
    //   calculated BEFORE the offset correction, via calculateTDH(Q, actualParams).
    //   This tells us what head the system observed the pump delivering.
    //
    // When pump is healthy: hTheoretical ≈ rawSystemTDH → ~0%
    // If hTheoretical > rawSystemTDH (delivers less): positive % (Degradation)
    // If hTheoretical < rawSystemTDH (delivers more): 0% (Healthy)
    const degradationPct = useMemo(() => {
        if (!pump || fieldData.rate <= 0) return 0;
        const baseFreq = pump.nameplateFrequency || 60;
        const safeFreq = Number(fieldData.frequency) || 60;
        const safeRate = Number(fieldData.rate) || 0;
        const ratio = Math.max(0.01, safeFreq / baseFreq);

        const qBase = safeRate / ratio;
        const hBase = calculateBaseHead(qBase, pump);
        const hTheoretical = hBase * Math.pow(ratio, 2);
        if (!hTheoretical || isNaN(hTheoretical) || hTheoretical <= 0) return 0;

        const rawSystemTDH = calculateTDH(safeRate, actualParams);
        if (rawSystemTDH <= 0 || isNaN(rawSystemTDH)) return 0;

        // Logic requested: 0% if healthy, increasing % if degraded.
        const gap = hTheoretical - rawSystemTDH;
        const pct = (gap / hTheoretical) * 100;

        // Return 0 if over-performing (not degraded)
        return isNaN(pct) || !isFinite(pct) ? 0 : Math.max(0, pct);
    }, [pump, fieldData.rate, fieldData.frequency, actualResSummary.actualParams]);

    // --- SIMULATION RESULTS (INTERSECTION AT SIM FREQ) ---
    const simResult = useMemo(() => {
        if (!isMaxCapActive || !pump) return null;

        // CONSISTENCY GUARD: If simFreq is identical to field, return field results exactly
        if (Math.abs(simFreq - fieldData.frequency) < 0.01) {
            return {
                ...actualRes,
                head: actualRes.head,
                rate: actualRes.rate,
                compFlow: { pct: 0, dir: 'UP' },
                compHead: { pct: 0, dir: 'UP' },
                compPwf: { pct: 0, dir: 'UP' },
                compPip: { pct: 0, dir: 'UP' }
            };
        }

        // Ensure we are using ONLY the field conditions (Match)
        const baseFreq = pump.nameplateFrequency || 60;
        const ratio = simFreq / baseFreq;

        // We increase granularity for accuracy
        const maxExpectedFlow = (pump.maxGraphRate || 6000) * ratio;
        const steps = 400;
        const stepSize = maxExpectedFlow / steps;

        let bestRate = 0;
        let bestHead = 0;

        const { sysCurveFrictionMultiplier, actualParams } = actualResSummary;

        // Helper para escalar el TDH preservando la forma de la fricción intacta al % de error
        const hStatSim = calculateTDH(0.1, actualParams);
        const getAdjustedSystemHead = (flowRate: number) => {
            const rawH = calculateTDH(flowRate, actualParams);
            if (flowRate < 5) return rawH;
            const fric = rawH - hStatSim;
            return hStatSim + fric * sysCurveFrictionMultiplier;
        };

        // SYSTEM CURVE BASE: actualResSummary contains calculatedIP + sysCurveFrictionMultiplier (Match correction)
        for (let i = 0; i < steps; i++) {
            const q = i * stepSize;
            if (q === 0) continue;

            const qB = q / ratio;
            const pHead = calculateBaseHead(qB, pump) * Math.pow(ratio, 2);
            // SYSTEM REQUIREMENT = Theoretical System TDH * Friction Multiplier
            const sHead = getAdjustedSystemHead(q);

            if (pHead < sHead) {
                // Approximate linear intersection
                const prevQ = (i - 1) * stepSize;
                const prevQB = prevQ / ratio;
                const prevPHead = calculateBaseHead(prevQB, pump) * Math.pow(ratio, 2);
                const prevSHead = getAdjustedSystemHead(prevQ);

                const d1 = prevPHead - prevSHead;
                const d2 = pHead - sHead;
                const totalD = (Math.abs(d1) + Math.abs(d2));
                const fraction = totalD > 0 ? Math.abs(d1) / totalD : 0.5;

                bestRate = prevQ + (q - prevQ) * fraction;
                bestHead = prevPHead + (pHead - prevPHead) * fraction;
                break;
            }
        }

        // Calculate all telemetry for this simulated point
        const res = calculateSystemResults(bestRate, bestHead, actualParams, pump, simFreq);

        // RIGOROUS SIM SUBMERGENCE & TEMP
        const pumpMD = params.pressures.pumpDepthMD || 0;
        const simFluidLevelMD = res?.fluidLevel || 0;
        const simSubMD = Math.max(0, pumpMD - simFluidLevelMD);

        // Add comparisons vs Design for the "UP/DN" percentages
        const compareToDesign = (val: number, designVal: number) => {
            if (!designVal) return { pct: 0, dir: 'UP' };
            const diff = ((val - designVal) / designVal) * 100;
            return { pct: Math.abs(diff), dir: diff >= 0 ? 'UP' : 'DN' };
        };

        return {
            ...res,
            rate: bestRate,
            head: bestHead,
            submergenceFt: simSubMD,
            compFlow: compareToDesign(bestRate, designParams.pressures.totalRate),
            compHead: compareToDesign(bestHead, designRes.tdh),
            compPwf: compareToDesign(res?.pwf || 0, (actualRes as any)?.pwf || 0),
            compPip: compareToDesign(res?.pip || 0, (actualRes as any)?.pip || 0),
        };

    }, [isMaxCapActive, simFreq, pump, actualResSummary, designParams, designRes, actualRes, fieldData.frequency, params]);

    // --- SENSITIVITY SCENARIO PREDICTED RESULT ---
    const scenarioResult = useMemo(() => {
        if (!sensScenario.active || !pump || sensScenario.ip <= 0) return null;

        const freq = Number(fieldData.frequency) || 60;
        const baseFreq = pump.nameplateFrequency || 60;
        const ratio = freq / baseFreq;
        const { sysCurveFrictionMultiplier, actualParams } = actualResSummary;

        // Overlay scenario parameters onto the calibrated model
        const scenarioParams = {
            ...actualParams,
            inflow: { ...actualParams.inflow, ip: sensScenario.ip },
            pressures: { ...actualParams.pressures, pht: sensScenario.thp > 0 ? sensScenario.thp : actualParams.pressures.pht }
        };

        const maxQ = (pump.maxGraphRate || 6000) * ratio;
        const steps = 300;
        const stepSize = maxQ / steps;

        let bestQ = 0;
        let bestH = 0;

        const hStat = calculateTDH(0.1, scenarioParams);

        for (let i = 1; i < steps; i++) {
            const q = i * stepSize;
            const qB = q / ratio;
            const pH = calculateBaseHead(qB, pump) * ratio * ratio;
            const sH = hStat + (calculateTDH(q, scenarioParams) - hStat) * sysCurveFrictionMultiplier;

            if (pH < sH) {
                const prevQ = (i - 1) * stepSize;
                const prevQB = prevQ / ratio;
                const prevPH = calculateBaseHead(prevQB, pump) * ratio * ratio;
                const prevSH = hStat + (calculateTDH(prevQ, scenarioParams) - hStat) * sysCurveFrictionMultiplier;

                const d1 = prevPH - prevSH;
                const d2 = pH - sH;
                const denom = Math.abs(d1) + Math.abs(d2);
                const frac = denom > 0 ? (Math.abs(d1) / denom) : 0.5;
                bestQ = prevQ + (q - prevQ) * frac;
                bestH = prevPH + (pH - prevPH) * frac;
                break;
            }
        }

        if (bestQ <= 0 && sensScenario.ip > 0) return null;
        // If IP is 0 or very low, we can still return a 'static' result if needed, 
        // but returning null lets it fallback to actualRes until user types.
        if (sensScenario.ip <= 0) return null;

        return calculateSystemResults(bestQ, bestH, scenarioParams, pump, freq);
    }, [sensScenario, fieldData.frequency, pump, actualResSummary]);

    const displayRes = (isMaxCapActive && simResult) ? simResult : ((sensScenario.active && scenarioResult) ? scenarioResult : actualRes);
    const displayFreq = isMaxCapActive ? simFreq : fieldData.frequency;
    const effectiveParams = (sensScenario.active && scenarioResult) ?
        {
            ...actualResSummary.actualParams,
            inflow: {
                ...(actualResSummary.actualParams?.inflow || {}),
                ip: sensScenario.ip || (actualResSummary.actualParams?.inflow?.ip || 0.01)
            },
            pressures: {
                ...(actualResSummary.actualParams?.pressures || {}),
                pht: sensScenario.thp || (actualResSummary.actualParams?.pressures?.pht || 0)
            }
        }
        : actualResSummary.actualParams;

    // VSD Sensitivity table — full affinity-law calculation for all frequencies
    const vsdRows = useMemo(() => {
        const paramsWithMulti = { ...effectiveParams, multiplier: actualResSummary.sysCurveFrictionMultiplier };
        return buildVsdRows(pump, paramsWithMulti, displayFreq, fieldData, displayRes, sensScenario.active);
    }, [pump, effectiveParams, displayFreq, fieldData, displayRes, sensScenario.active, actualResSummary.sysCurveFrictionMultiplier]);


    // --- SIMULATION ALERTS (LIMITS ENFORCEMENT) ---
    const simAlerts = useMemo(() => {
        if (!isMaxCapActive || !displayRes) return [];
        const alerts: { type: 'warning' | 'danger'; message: string; value: string; field: string }[] = [];

        // 1. Motor Load: Red >= 95, Yellow >= 80
        const ml = displayRes.motorLoad || 0;
        if (ml >= 95) alerts.push({ type: 'danger', message: 'SOBRECARGA MOTOR', value: `${ml.toFixed(0)}%`, field: 'Motor' });
        else if (ml >= 80) alerts.push({ type: 'warning', message: 'ALTA CARGA MOTOR', value: `${ml.toFixed(0)}%`, field: 'Motor' });

        // 2. Shaft Load (Mechanical Stress): Red >= 95, Yellow >= 85
        const sLimit = getShaftLimitHp(pump?.series);
        const sl = (displayRes.hpTotal / sLimit) * 100;
        if (sl >= 95) alerts.push({ type: 'danger', message: 'CARGA EJE CRÍTICA', value: `${sl.toFixed(0)}%`, field: 'Eje' });
        else if (sl >= 85) alerts.push({ type: 'warning', message: 'ALTA CARGA EJE', value: `${sl.toFixed(0)}%`, field: 'Eje' });

        // 3. VSD Limitation (Electrical Capacity)
        const vsdKva = (params as any).selectedVSD?.kvaRating || 350;
        const totalKva = displayRes.electrical?.systemKva || 0;
        if (totalKva > vsdKva) alerts.push({ type: 'danger', message: 'LÍMITE VSD EXCEDIDO', value: `${totalKva.toFixed(0)} kVA`, field: 'VSD' });

        // 4. Cooling Velocity (Motor Integrity): Red < 0.5, Yellow < 1.0
        const vel = displayRes.fluidVelocity || 0;
        if (vel < 0.5) alerts.push({ type: 'danger', message: 'ENFRIAMIENTO CRÍTICO', value: `${vel.toFixed(2)} ft/s`, field: 'Cooling' });
        else if (vel < 1.0) alerts.push({ type: 'warning', message: 'BAJO ENFRIAMIENTO', value: `${vel.toFixed(2)} ft/s`, field: 'Cooling' });

        // 5. Submergence: Red < 250, Yellow < 500
        const sub = displayRes.submergenceFt || 0;
        if (sub < 250) alerts.push({ type: 'danger', message: 'SUMERGENCIA BAJA', value: `${sub.toFixed(0)} ft`, field: 'Sub' });
        else if (sub < 500) alerts.push({ type: 'warning', message: 'AVISO SUMERGENCIA', value: `${sub.toFixed(0)} ft`, field: 'Sub' });

        // 6. Efficiency: Red < 20, Yellow < 35
        const eff = displayRes.efficiency || 0;
        if (eff < 20) alerts.push({ type: 'danger', message: 'EFICIENCIA CRÍTICA', value: `${eff.toFixed(1)}%`, field: 'Eff' });
        else if (eff < 35) alerts.push({ type: 'warning', message: 'BAJA EFICIENCIA', value: `${eff.toFixed(1)}%`, field: 'Eff' });

        return alerts;
    }, [isMaxCapActive, displayRes, pump?.series, params]);

    const { chartData, referencePoints, theoreticalMatch, khComparative, khFactor } = useMemo(() => {
        const data: any[] = [];
        const refPoints: any[] = [];
        let khComparative = 1;
        let khFactor = 1;

        if (!pump || !pump.bepRate) return { chartData: [], referencePoints: [], theoreticalMatch: null, khComparative: 1, khFactor: 1 };

        // 1. Prepare Parameters for ALL Scenarios
        const minP = getScenarioParams(params, params.targets.min);
        const maxP = getScenarioParams(params, params.targets.max);
        const targetP = getScenarioParams(params, params.targets.target);

        // Frequencies
        const minFreq = params.targets.min.frequency;
        const maxFreq = params.targets.max.frequency;
        const targetFreq = params.targets.target.frequency;
        const actualFreq = Math.max(30, fieldData.frequency || 60);
        const baseFreq = pump.nameplateFrequency || 60;

        // Standard Frequencies for Reference
        const standardFreqs = [30, 40, 50, 60, 70];

        // Max Flow Calculation (Must cover everything)
        const globalMaxFreq = Math.max(70, actualFreq, maxFreq);
        const maxFlow = (pump.maxGraphRate || 6000) * (globalMaxFreq / baseFreq) * 1.2;
        const step = maxFlow / 120;
        // Mix SG for Power Calc (Approx from Water Cut)
        const wc = params.fluids.waterCut / 100;
        const oilSg = 141.5 / (131.5 + params.fluids.apiOil);
        const waterSg = params.fluids.geWater;
        let mixSG = (waterSg * wc) + (oilSg * (1 - wc));
        if (params.fluids.sandCut > 0) {
            mixSG = mixSG * (1 - params.fluids.sandCut / 100) + (params.fluids.sandDensity * params.fluids.sandCut / 100);
        }

        // Flags
        const validStatus: Record<string, boolean> = {
            pumpMin: true, pumpMax: true, design: true, actual: true, userHz: true, designCurve2: true
        };
        standardFreqs.forEach(f => validStatus[`hz${f}`] = true);

        // Efficiency Cone Limits
        const headAtMinBase = Math.max(0, calculateBaseHead(pump.minRate, pump));
        const headAtMaxBase = Math.max(0, calculateBaseHead(pump.maxRate, pump));
        let kMin = 0, kMax = 0;
        if (pump.minRate > 0) kMin = headAtMinBase / Math.pow(pump.minRate, 2);
        if (pump.maxRate > 0) kMax = headAtMaxBase / Math.pow(pump.maxRate, 2);

        const limitFlowMin = pump.minRate * (globalMaxFreq / baseFreq);
        const limitFlowMax = pump.maxRate * (globalMaxFreq / baseFreq);

        const hasPowerCoeffs = [pump.p0, pump.p1, pump.p2, pump.p3, pump.p4, pump.p5].some(val => Math.abs(val) > 1e-6);

        const { sysCurveFrictionMultiplier, actualParams } = actualResSummary;

        // --- CALCULATE Kh (Head Adjustment Factor) ---
        const safeFreqKh = Number(fieldData.frequency) || 60;
        const ratioKh = safeFreqKh / baseFreq;
        const qBaseKh = (Number(fieldData.rate) || 0) / ratioKh;
        const hCatalogRef = calculateBaseHead(qBaseKh, pump) * Math.pow(ratioKh, 2);
        khFactor = hCatalogRef > 0 ? (actualPumpTDH / hCatalogRef) : 1;

        // --- CALCULATE Kh Comparative (Projected to Theoretical System) ---
        const projectedHead = calculateTDH(Number(fieldData.rate) || 0, actualParams);
        khComparative = hCatalogRef > 0 ? (projectedHead / hCatalogRef) : 1;

        for (let i = 0; i <= 120; i++) {
            const flow = i * step;
            const point: any = { flow: Math.round(flow) };

            // Helper to calc head at freq
            const calcH = (freq: number) => {
                const r = freq / baseFreq;
                const qB = flow / r;
                const hB = calculateBaseHead(qB, pump);
                return hB * Math.pow(r, 2);
            };

            // Helper to calc Power & Eff at freq
            const calcPerf = (freq: number, h: number) => {
                const r = freq / baseFreq;
                const qB = flow / r;
                let pwr = 0;
                let eff = 0;

                if (hasPowerCoeffs) {
                    const pBase = calculateBasePowerPerStage(qB, pump);
                    // P = P_base * ratio^3 * SG * Stages
                    pwr = pBase * Math.pow(r, 3) * mixSG * (pump.stages || 1);
                    if (pwr > 0.01 && h > 0) {
                        const hhp = (flow * h * mixSG) / 135770;
                        eff = (hhp / pwr) * 100;
                    }
                } else {
                    // Estimate Efficiency first
                    if (h > 0 && flow > 0) {
                        const bepActual = pump.bepRate * r;
                        const dev = (flow - bepActual) / (bepActual * 2);
                        const curveFactor = 1 - Math.pow(dev, 2);
                        eff = pump.maxEfficiency * Math.max(0, curveFactor);
                        // Back-calc Power
                        if (eff > 1) pwr = ((flow * h * mixSG) / (135770 * (eff / 100)));
                    }
                }
                return { pwr, eff };
            }

            const activeKh = chartMode === 'comparative' ? khComparative : khFactor;

            // --- 1. Standard Curves (30, 40, 50, 60, 70 Hz) ---
            standardFreqs.forEach(f => {
                const key = `hz${f}`;
                const adjKey = `hz${f}Adj`;
                if (validStatus[key]) {
                    const h = calcH(f);
                    if (h > 5) {
                        if (chartMode === 'comparative') {
                            point[key] = Number(h.toFixed(1)); // Original (100%)
                            point[adjKey] = Number((h * activeKh).toFixed(1)); // Degraded
                        } else {
                            // Monitoring Mode: Show only the Adjusted ones as the main reference
                            // Use the standard key so it looks "perfect" like Phase 5
                            point[key] = Number((h * khFactor).toFixed(1));
                            point[adjKey] = null;
                        }
                    }
                    else { validStatus[key] = false; point[key] = null; point[adjKey] = null; }
                }
            });

            // --- 2. Scenario Curves ---
            if (validStatus.pumpMin) {
                const h = calcH(minFreq);
                if (h > 5) point.pumpMin = Number((h * activeKh).toFixed(1)); else { validStatus.pumpMin = false; point.pumpMin = null; }
            }
            if (validStatus.pumpMax) {
                const h = calcH(maxFreq);
                if (h > 5) point.pumpMax = Number((h * activeKh).toFixed(1)); else { validStatus.pumpMax = false; point.pumpMax = null; }
            }

            // Design Curve (New in PerformanceCurveMultiAxis)
            if (validStatus.design) {
                const h = calcH(targetFreq);
                if (h >= 0) {
                    point.designPumpCurve = Number(h.toFixed(1));
                    const perf = calcPerf(targetFreq, h);
                    point.headNew = Number(h.toFixed(1));
                    point.pwrNew = Number(perf.pwr.toFixed(1));
                    point.effNew = Number(perf.eff.toFixed(1));
                } else {
                    validStatus.design = false;
                    point.designPumpCurve = null;
                }
            }

            // --- 2. PUMP CURVES (CATALOG vs Kh-ADJUSTED) ---
            if (validStatus.userHz) {
                const hCatalog = calcH(actualFreq);
                if (hCatalog !== null && hCatalog > 5) {
                    const hAdjusted = hCatalog * khFactor;
                    const hAdjustedComparative = hCatalog * khComparative;

                    point.unadjustedPump = Number(hCatalog.toFixed(2));
                    point.adjustedPump = Number(hAdjusted.toFixed(2));

                    if (chartMode === 'comparative') {
                        // In Comparative, userHz is the "Catalog" (Reference) and catalogPumpCurve is the "Adjusted"
                        point.userHz = point.unadjustedPump;
                        point.catalogPumpCurve = Number(hAdjustedComparative.toFixed(2));
                    } else {
                        // In Monitoring, userHz is the "Adjusted" (Reality) 
                        point.userHz = point.adjustedPump;
                        point.catalogPumpCurve = point.unadjustedPump; // Keep for internal logic but PumpChart hides it
                    }

                    const { pwr, eff } = calcPerf(actualFreq, hCatalog);
                    point.efficiency = eff > 0 ? Number(eff.toFixed(1)) : null;
                    point.pwr = pwr > 0 ? Number(pwr.toFixed(1)) : null;
                } else {
                    validStatus.userHz = false;
                    point.userHz = null;
                    point.catalogPumpCurve = null;
                }
            }

            // --- 3. DESIGN MATCH (Target Frequency) ---
            if (validStatus.designCurve2) {
                const desH = calcH(targetFreq);
                if (desH !== null && desH > 5) {
                    const { pwr: dPwr, eff: dEff } = calcPerf(targetFreq, desH);
                    point.headNew = Number(desH.toFixed(2));
                    point.effNew = dEff > 0 ? Number(dEff.toFixed(1)) : null;
                    point.pwrNew = dPwr > 0 ? Number(dPwr.toFixed(1)) : null;
                    point.designPumpCurve = point.headNew;
                } else {
                    validStatus.designCurve2 = false;
                    point.headNew = null;
                    point.designPumpCurve = null;
                }
            }

            // --- 3. System Curves (Truncated at AOF) ---
            const checkAOF = (p: SystemParams) => {
                if (p.inflow.ip > 0 && p.inflow.pStatic > 0) {
                    // Stricter check: the well must have positive intake pressure at the pump
                    return calculatePIP(flow, p) > 0;
                }
                return true;
            };

            if (checkAOF(minP)) {
                const h = calculateTDH(flow, minP);
                if (!isNaN(h) && h > 0) point.sysMin = Number(h.toFixed(1));
            }
            if (checkAOF(maxP)) {
                const h = calculateTDH(flow, maxP);
                if (!isNaN(h) && h > 0) point.sysMax = Number(h.toFixed(1));
            }
            if (checkAOF(targetP)) {
                const h = calculateTDH(flow, targetP);
                if (!isNaN(h) && h > 0) {
                    point.designSystemCurve = Number(h.toFixed(1));
                    point.pipDesign = Number(Math.max(0, calculatePIP(flow, targetP)).toFixed(1));
                }
            }
            if (checkAOF(actualParams)) {
                const h = calculateTDH(flow, actualParams);
                if (!isNaN(h) && h > 0) {
                    const hStatMatch = calculateTDH(0.1, actualParams);
                    const fricH = h - hStatMatch;
                    const correctedH = hStatMatch + fricH * sysCurveFrictionMultiplier;

                    point.unadjustedSystem = Number(h.toFixed(1));
                    point.adjustedSystem = Number(correctedH.toFixed(1));

                    if (chartMode === 'comparative') {
                        point.systemCurve = point.unadjustedSystem;
                        point.idealSystemCurve = point.unadjustedSystem; // Projected onto same IP
                    } else {
                        point.systemCurve = point.adjustedSystem;
                        point.idealSystemCurve = point.unadjustedSystem;
                    }
                }
            }

            // --- 3.5 Sensitivity Curve (Independently calculated) ---
            if (sensScenario.active && sensScenario.ip > 0) {
                const scenarioP = {
                    ...actualResSummary.actualParams,
                    inflow: { ...actualResSummary.actualParams.inflow, ip: sensScenario.ip },
                    pressures: { ...actualResSummary.actualParams.pressures, pht: sensScenario.thp > 0 ? sensScenario.thp : actualResSummary.actualParams.pressures.pht }
                };

                if (checkAOF(scenarioP)) {
                    const hSens = calculateTDH(flow, scenarioP);
                    const hStatS = calculateTDH(0.1, scenarioP);
                    // Application of friction multiplier calibrated on field test
                    const corrHSens = hStatS + (hSens - hStatS) * actualResSummary.sysCurveFrictionMultiplier;
                    if (!isNaN(corrHSens) && corrHSens > 0) {
                        point.manualSystemCurve = Number(corrHSens.toFixed(1));
                    }
                }
            }

            // --- 4. Cone Limits ---
            if (kMin > 0 && flow <= limitFlowMin * 1.15) {
                const hMin = kMin * Math.pow(flow, 2);
                if (hMin > 0) point.minLimit = Number(hMin.toFixed(1));
            }
            if (kMax > 0 && flow <= limitFlowMax * 1.15) {
                const hMax = kMax * Math.pow(flow, 2);
                if (hMax > 0) point.maxLimit = Number(hMax.toFixed(1));
            }

            data.push(point);
        }

        // --- 1. DESIGN POINT (Catalog Pump vs Catalog System) ---
        let designMatch = null;
        let targetMatch = null;
        let minMatch = null;
        let maxMatch = null;
        if (data.length > 2) {
            for (let i = 0; i < data.length - 1; i++) {
                const p1 = data[i];
                const p2 = data[i + 1];
                if (!designMatch && p1.unadjustedPump && p1.unadjustedSystem && p2.unadjustedPump && p2.unadjustedSystem) {
                    const d1 = p1.unadjustedPump - p1.unadjustedSystem;
                    const d2 = p2.unadjustedPump - p2.unadjustedSystem;
                    if (d1 * d2 <= 0) {
                        const frac = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
                        designMatch = {
                            flow: p1.flow + (p2.flow - p1.flow) * frac,
                            head: p1.unadjustedPump + (p2.unadjustedPump - p1.unadjustedPump) * frac
                        };
                    }
                }
                if (!targetMatch && p1.designPumpCurve && p1.designSystemCurve && p2.designPumpCurve && p2.designSystemCurve) {
                    const d1 = p1.designPumpCurve - p1.designSystemCurve;
                    const d2 = p2.designPumpCurve - p2.designSystemCurve;
                    if (d1 * d2 <= 0) {
                        const frac = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
                        targetMatch = {
                            flow: p1.flow + (p2.flow - p1.flow) * frac,
                            head: p1.designPumpCurve + (p2.designPumpCurve - p1.designPumpCurve) * frac
                        };
                    }
                }
                if (!minMatch && p1.pumpMin && p1.sysMin && p2.pumpMin && p2.sysMin) {
                    const d1 = p1.pumpMin - p1.sysMin;
                    const d2 = p2.pumpMin - p2.sysMin;
                    if (d1 * d2 <= 0) {
                        const frac = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
                        minMatch = {
                            flow: p1.flow + (p2.flow - p1.flow) * frac,
                            head: p1.pumpMin + (p2.pumpMin - p1.pumpMin) * frac
                        };
                    }
                }
                if (!maxMatch && p1.pumpMax && p1.sysMax && p2.pumpMax && p2.sysMax) {
                    const d1 = p1.pumpMax - p1.sysMax;
                    const d2 = p2.pumpMax - p2.sysMax;
                    if (d1 * d2 <= 0) {
                        const frac = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
                        maxMatch = {
                            flow: p1.flow + (p2.flow - p1.flow) * frac,
                            head: p1.pumpMax + (p2.pumpMax - p1.pumpMax) * frac
                        };
                    }
                }
            }
        }

        // 1. THEORETICAL Point (Blue/Gray) - Potential with New Pump & Zero Extra Friction
        if (designMatch && chartMode === 'comparative') {
            refPoints.push({
                flow: designMatch.flow,
                head: designMatch.head,
                label: 'TEÓRICO',
                color: '#007d13ff'
            });
        }

        if (targetMatch) {
            refPoints.push({
                flow: targetMatch.flow,
                head: targetMatch.head,
                label: 'OBJ',
                color: '#0b002eff'
            });
        }

        if (minMatch) {
            refPoints.push({
                flow: minMatch.flow,
                head: minMatch.head,
                label: 'MIN',
                color: '#0b002eff'
            });
        }

        if (maxMatch) {
            refPoints.push({
                flow: maxMatch.flow,
                head: maxMatch.head,
                label: 'MAX',
                color: '#0b002eff'
            });
        }

        // 2. REAL Operating Point (Orange) - Field Telemetry
        if (fieldData.rate > 0 && actualPumpTDH > 0) {
            const headToUse = chartMode === 'comparative' ? projectedHead : actualPumpTDH;
            refPoints.push({
                flow: fieldData.rate,
                head: headToUse,
                label: 'ACTUAL', color: '#ff6600ff'
            });
        }

        // SIMULATION POINT (If Active)
        if (isMaxCapActive && simResult) {
            refPoints.push({ flow: simResult.rate, head: simResult.head, label: 'CAPACIDAD MAX', color: '#22c55e' });
        } else if (sensScenario.active && scenarioResult) {
            refPoints.push({ flow: scenarioResult.rate, head: scenarioResult.head, label: 'OP PROYECTADO', color: '#3b82f6' });
        }

        if (trail && trail.length > 0) {
            refPoints.push(...trail);
        }

        return { chartData: data, referencePoints: refPoints, theoreticalMatch: designMatch, khComparative, khFactor };

    }, [pump, params, actualResSummary, sensScenario, scenarioResult, fieldData.frequency, fieldData.rate, actualPumpTDH, isMaxCapActive, simResult, compareScenario, viewMode, chartMode, trail]);

    // --- AI ANALYSIS GENERATION (ADVANCED) ---
    const aiAnalysisText = useMemo(() => {
        if (!pump) return 'Sin diagnóstico. Seleccione equipo primero.';
        const lines: string[] = [];

        // 1. Degradación hidráulica
        if (degradationPct > 15) {
            lines.push(`⚠️ CRÍTICO — Degradación hidráulica severa: ${degradationPct.toFixed(1)}% bajo la curva original.`);
            lines.push(`Causas: desgaste abrasivo, erosión por arena, incrustaciones o rotura de impulsores. Se requiere workover/pull para inspección.`);
        } else if (degradationPct > 8) {
            lines.push(`⚡ PRECAUCIÓN — Degradación moderada: ${degradationPct.toFixed(1)}%. Tendencia de desgaste acelerado.`);
            lines.push(`Registrar lecturas semanales. Verificar IP del yacimiento antes de concluir desgaste mecánico.`);
        } else if (degradationPct > 3) {
            lines.push(`🔍 AVISO — Desviación leve (${degradationPct.toFixed(1)}%). Dentro del margen de incertidumbre de medición.`);
            lines.push(`Monitoreo mensual recomendado. Sin acción correctiva inmediata.`);
        } else {
            lines.push(`✅ ÓPTIMO — Bomba dentro del ${degradationPct.toFixed(1)}% de su curva original de diseño.`);
            lines.push(`Sistema alineado con la predicción teórica. Mantener condiciones actuales.`);
        }

        // 2. Condición de empuje (Upthrust / Downthrust)
        const bepAtFreq = (pump.bepRate || 1000) * (displayFreq / (pump.nameplateFrequency || 60));
        const currentRate = displayRes.rate || 0;
        const flowRatio = bepAtFreq > 0 ? currentRate / bepAtFreq : 1;
        if (flowRatio > 1.15) {
            lines.push(`🔺 UPTHRUST — Operando al ${(flowRatio * 100).toFixed(0)}% del BEP (${bepAtFreq.toFixed(0)} BPD). Riesgo de fractura del eje por empuje axial ascendente.`);
            lines.push(`ACCIÓN: Reducir frecuencia o restringir válvula de superficie para acercar el caudal al BEP.`);
        } else if (flowRatio < 0.75) {
            lines.push(`🔻 DOWNTHRUST — Operando al ${(flowRatio * 100).toFixed(0)}% del BEP. Desgaste cojinetes radiales + sobrecalentamiento del motor.`);
            lines.push(`ACCIÓN: Aumentar frecuencia del VSD o verificar caída de IP del yacimiento.`);
        } else {
            lines.push(`⚖️ THRUST NORMAL — ${(flowRatio * 100).toFixed(0)}% del BEP. Cargas axiales dentro del rango operativo.`);
        }

        // 3. Motor
        const ml = displayRes.motorLoad || 0;
        if (ml >= 95) lines.push(`🔥 MOTOR SOBRECARGADO al ${ml.toFixed(0)}%. ACCIÓN INMEDIATA: Reducir frecuencia.`);
        else if (ml >= 80) lines.push(`⚠️ Motor al límite (${ml.toFixed(0)}%). Monitorear temperatura diariamente.`);
        else if (ml < 40) lines.push(`❄️ Motor subexigido (${ml.toFixed(0)}%). Riesgo de bajo enfriamiento.`);

        // 4. PIP / Gas
        const currentPip = displayRes.pip || 0;
        const pb = effectiveParams?.fluids?.pb || 0;
        if (pb > 0 && currentPip > 0 && currentPip < pb * 1.15) {
            lines.push(`💨 GAS EN INTAKE — PIP=${currentPip.toFixed(0)} psi cerca de Pb=${pb.toFixed(0)} psi. Riesgo bloqueo.`);
        } else if (currentPip > 0 && currentPip < 120) {
            lines.push(`⚡ PIP BAJO (${currentPip.toFixed(0)} psi). Riesgo cavitación.`);
        }

        // 5. IP Comparación
        const dIP = designParams?.inflow?.ip || 0;
        const ipDiff = dIP > 0 ? ((calculatedIP - dIP) / dIP) * 100 : 0;
        if (Math.abs(ipDiff) > 15) {
            lines.push(ipDiff < 0
                ? `📉 IP REDUCIDO: ${dIP.toFixed(2)} → ${calculatedIP.toFixed(2)} bpd/psi (${Math.abs(ipDiff).toFixed(0)}% menor). El yacimiento perdió productividad. CAUSA PRINCIPAL de bajo caudal — no necesariamente desgaste de bomba.`
                : `📈 IP MAYOR AL DISEÑO: ${calculatedIP.toFixed(2)} vs ${dIP.toFixed(2)} bpd/psi (+${ipDiff.toFixed(0)}%). Verificar riesgo de upthrust.`);
        }

        // 6. Próximos pasos (HIGH PROTECTION MODE - Strict Margins)
        const successRows = [...vsdRows].filter(r => {
            if (!r.isSuccess) return false;
            // Additional 'High Protection' guards for AI recommendation
            const ml = (r as any).motorLoad || 0;
            const sl = (r as any).shaftStress || 0;
            const pip = (r as any).pip || 0;
            const sub = (r as any).submergence || 0;
            return ml < 75 && sl < 70 && pip >= 300 && sub >= 500;
        }).sort((a, b) => b.hz - a.hz);

        const dangerRows = [...vsdRows].filter(r => r.isDanger).sort((a, b) => a.hz - b.hz);

        const maxOptimalHz = successRows.length > 0 ? successRows[0].hz : fieldData.frequency;
        const firstDangerHz = dangerRows.length > 0 ? dangerRows[0].hz : 81;

        // Identify the first row that presents any violation to info the user why
        const firstLimitedRow = vsdRows.find(r => !r.isSuccess && r.hz > fieldData.frequency);
        const limitReason = firstLimitedRow?.violations[0]?.reason || "Límite técnico general";

        lines.push('━━━ PRÓXIMOS PASOS ━━━');
        if (degradationPct > 15 || ml >= 95) {
            lines.push('1. Programar workover/pull for inspection inmediata del equipo de fondo.');
            lines.push('2. Descargar historial de amperaje/voltaje para identificar el inicio de la falla.');
            lines.push('3. Rediseñar equipo ajustado al IP actual.');
        } else if (degradationPct > 8 || flowRatio > 1.15 || flowRatio < 0.75) {
            const advice = flowRatio < 0.75
                ? `Incrementar frecuencia gradualmente hasta ${maxOptimalHz} Hz (Límite óptimo antes de alertas).`
                : 'Reducir frecuencia para operar cerca del BEP.';
            lines.push(`1. Optimización VSD: ${advice}`);
            lines.push(`2. Nota: A partir de ${maxOptimalHz + 1} Hz se detecta: ${limitReason}.`);
            lines.push('3. Monitoreo diario de temperatura y carga motor.');
        } else {
            lines.push(`1. Margen Operativo: El sistema opera de forma óptima hasta ${maxOptimalHz} Hz.`);
            lines.push(`2. Restricción: No se recomienda exceder este límite debido a: ${limitReason}.`);
            lines.push(`3. Punto de Corte: El riesgo crítico de falla (DANGER) comienza a los ${firstDangerHz} Hz.`);
        }

        // 7. Simulación de Capacidad (Maximum Capacity Section)
        if (isMaxCapActive && simResult) {
            lines.push('\n━━━ ANÁLISIS DE CAPACIDAD ━━━');
            const gain = simResult.rate - fieldData.rate;
            if (gain > 5) {
                lines.push(`📈 POTENCIAL: Incrementar a ${simFreq} Hz genera +${gain.toFixed(0)} BPD adicionales.`);
            } else if (gain < -5) {
                lines.push(`📉 REDUCCIÓN: Operar a ${simFreq} Hz bajaría la producción en ${Math.abs(gain).toFixed(0)} BPD.`);
            }

            if (simAlerts.length > 0) {
                lines.push('⚠️ RESTRICCIONES DE SIMULACIÓN:');
                simAlerts.forEach(a => lines.push(`  - ${a.message} (${a.value})`));
                lines.push(`RECOMENDACIÓN: El punto de 65 Hz NO es recomendable. Ajustar máximo a ${maxOptimalHz} Hz.`);
            } else if (Math.abs(gain) > 5) {
                lines.push('✅ FACTIBILIDAD: El cambio de frecuencia es seguro mecánica y eléctricamente.');
                lines.push(`RECOMENDACIÓN: Ajustar VSD a ${simFreq} Hz para capturar el potencial de ${simResult.rate.toFixed(0)} BPD.`);
            }
        }

        return lines.join('\n');
    }, [degradationPct, displayRes, pump, fieldData, effectiveParams, designParams, calculatedIP, isMaxCapActive, simResult, simFreq, simAlerts, vsdRows]);

    const mechanics = useMemo(() => {
        const bhp = actualRes.hpTotal || 0;
        const limit = getShaftLimitHp(pump?.series || "");
        return {
            efficiency: actualRes.efficiency || 0,
            motorLoad: actualRes.motorLoad || 0,
            pumpShaftPct: Math.min(100, (bhp / limit) * 100),
            sealShaftPct: Math.min(100, (bhp / (limit * 1.15)) * 100),
            motorShaftPct: Math.min(100, (bhp / (limit * 1.25)) * 100),
            thrustBearingPct: Math.min(100, 15 + (Math.abs(fieldData.rate - (pump?.bepRate || 1000)) / 1000 * 10)),
        };
    }, [actualRes, pump, fieldData]);

    const safePump = pump || { id: 'tmp', manufacturer: '', model: '' } as EspPump;

    const rp0 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(0) : '-';
    const rp1 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(1) : '-';
    const rp2 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(2) : '-';

    const vsdCols = [
        { label: 'BFPD', key: 'flow', fmt: rp0 },
        { label: 'BOPD', key: 'bopd', fmt: rp0 },
        { label: 'BWPD', key: 'bwpd', fmt: rp0 },
        { label: 'PIP', key: 'pip', fmt: rp0, unit: 'psi' },
        { label: 'TDH', key: 'tdh', fmt: rp0, unit: 'ft' },
        { label: 'Pwf', key: 'pwf', fmt: rp0, unit: 'psi' },
        { label: 'DrDwn', key: 'drawdownPct', fmt: (n: number) => `${Number(n || 0).toFixed(1)}%` },
        { label: 'PDP', key: 'pdp', fmt: rp0, unit: 'psi' },
        { label: 'Amps', key: 'amps', fmt: rp1, unit: 'A' },
        { label: 'Volts', key: 'volts', fmt: rp0, unit: 'V' },
        { label: 'kVA', key: 'kva', fmt: rp0, unit: 'kVA' },
        { label: 'kW', key: 'kw', fmt: rp1, unit: 'kW' },
        { label: 'Carga Motor', key: 'motorLoad', fmt: rp1, unit: '%' },
        { label: 'Efic. Bomba', key: 'pumpEff', fmt: rp1, unit: '%' },
        { label: 'Vel. Fluido', key: 'vel', fmt: rp2, unit: 'ft/s' },
        { label: 'Temp Motor', key: 'motorT', fmt: rp0, unit: '\u00b0F' },
        { label: 'Submergencia', key: 'submergence', fmt: rp0, unit: 'ft' },
        { label: 'Pump Shaft', key: 'pumpShaft', fmt: rp1, unit: '%' },
    ];



    return (
        <>
            {/* FULL SCREEN MODAL */}
            {isChartExpanded && createPortal(
                <div className="fixed inset-0 z-[9999] bg-surface/95 backdrop-blur-xl p-8 flex flex-col animate-fadeIn">
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-surface-light">
                        <div>
                            <h2 className="text-4xl font-black text-txt-main uppercase tracking-tighter">{t('p6.perfComp')}</h2>
                            <p className="text-base font-bold text-txt-muted uppercase tracking-widest">{t('p6.history')} | FULL SCREEN VIEW</p>
                        </div>
                        <button onClick={() => setIsChartExpanded(false)} className="p-4 bg-surface rounded-full border border-surface-light text-txt-muted hover:text-white hover:bg-surface-light transition-colors">
                            <Minimize2 className="w-10 h-10" />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 bg-surface rounded-[32px] border border-surface-light p-4 shadow-2xl relative overflow-hidden">
                        <PumpChart data={chartData} pump={safePump} currentFrequency={fieldData.frequency} referencePoints={trail || referencePoints} targetFlow={fieldData.rate} className="w-full h-full" isDiagnosticMode={chartMode === 'comparative'} />
                    </div>
                </div>,
                document.body
            )}



            {/* HEADER */}
            <div className={`flex justify-between items-center px-6 shrink-0 h-13 card-solid rounded-2xl border shadow-xl relative overflow-hidden group transition-all duration-700 mb-4 ${isMaxCapActive ? 'border-success/40 ring-1 ring-success/10' : 'border-white/10'}`}>
                <div className={`absolute left-0 top-0 w-2 h-full transition-colors duration-700 ${isMaxCapActive ? 'bg-success shadow-glow-success' : 'bg-secondary shadow-glow-secondary'}`}></div>
                <div className="flex items-center gap-5 relative z-10 pl-2">
                    <div className={`p-3 rounded-2xl border transition-all duration-700 ${isMaxCapActive ? 'bg-success/20 border-success/30 shadow-glow-success/20' : 'bg-secondary/20 border-white/10 shadow-glow-secondary'}`}>
                        {isMaxCapActive ? <Zap className="w-6 h-6 text-success animate-pulse" /> : <ClipboardCheck className="w-6 h-6 text-secondary" />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-txt-main uppercase tracking-[0.1em] leading-none drop-shadow-md">
                            {isMaxCapActive ? "CAPACITY " : (sensScenario.active ? "SENSITIVITY (IP/THP)" : "MATCH")}
                        </h2>
                        <div className="flex items-center gap-3 mt-1.5">
                            <div className={`h-[1px] w-8 ${isMaxCapActive ? 'bg-success' : (sensScenario.active ? 'bg-primary' : 'bg-secondary')}`}></div>
                            <p className="text-[10px] text-txt-muted font-black uppercase tracking-[0.3em] opacity-40">
                                {isMaxCapActive ? "PREDICCIÓN BASADA EN MUESTRA CALIBRADA" : (sensScenario.active ? "ANÁLISIS DE SENSIBILIDAD PRODUCTIVA" : t('p6.fieldSync'))}
                            </p>
                            <div className="w-1 h-1 rounded-full bg-txt-muted opacity-30 mx-1"></div>
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${params.isMechVerified ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/30' : 'bg-white/5 text-txt-muted border border-white/10'}`}>
                                <Database className="w-2.5 h-2.5" />
                                {params.isMechVerified ? "ESTADOS MECÁNICOS" : "DISEÑO ORIGINAL"}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 relative z-10 pr-2">
                    {/* NEW COEFFICIENTS LOCATION (HEADER) */}
                    <div className="flex items-center gap-4 mr-2 bg-surface px-5 py-1.5 rounded-2xl border border-surface-light shadow-lg">
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">{chartMode === 'comparative' ? 'Kh (Proyectado)' : 'Kh (Actual)'}</span>
                            <span className="text-sm font-mono text-primary font-black leading-tight drop-shadow-sm">
                                {chartMode === 'comparative' ? khComparative.toFixed(3) : khFactor.toFixed(3)}
                            </span>
                        </div>
                        <div className="w-px h-6 bg-surface-light"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-secondary/60 uppercase tracking-widest">Kf (Fricción)</span>
                            <span className="text-sm font-mono text-secondary font-black leading-tight drop-shadow-sm">
                                {chartMode === 'comparative' ? '1.000 (IP Fijo)' : actualResSummary.sysCurveFrictionMultiplier.toFixed(3)}
                            </span>
                        </div>
                    </div>

                    <div className="flex bg-canvas/40 p-1 rounded-2xl border border-white/10 shadow-inner shrink-0 relative overflow-hidden h-11 items-center px-1.5 mr-2">
                        <button
                            onClick={() => {
                                setChartMode('telemetry');
                                setIsMaxCapActive(false);
                            }}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-500 relative z-10 ${chartMode === 'telemetry' && !isMaxCapActive
                                ? 'bg-primary/20 text-primary shadow-glow-primary/20 border border-primary/20'
                                : 'text-txt-muted hover:text-txt-main'
                                }`}
                        >
                            Monitoreo
                        </button>
                        <button
                            onClick={() => {
                                setChartMode('comparative');
                                setIsMaxCapActive(false);
                            }}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-500 relative z-10 ${chartMode === 'comparative'
                                ? 'bg-secondary/20 text-secondary shadow-glow-secondary/20 border border-secondary/20'
                                : 'text-txt-muted hover:text-txt-main'
                                }`}
                        >
                            Comparativa
                        </button>
                    </div>
                    <div className="flex bg-canvas/40 p-1 rounded-2xl border border-white/10 shadow-inner shrink-0 relative overflow-hidden h-11 items-center px-1.5">
                        {['min', 'target', 'max'].map(s => (
                            <button
                                key={s}
                                onClick={() => setCompareScenario(s as any)}
                                className={`px-5 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-500 relative z-10 ${compareScenario === s ? 'bg-secondary/20 text-secondary shadow-glow-secondary/20 border border-secondary/20' : 'text-txt-muted hover:text-txt-main'}`}
                            >
                                {s === 'min' ? t('p5.min') : s === 'target' ? t('p5.target') : t('p5.max')}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowReport(true)} className="bg-primary hover:bg-primary/80 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2.5 shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-95 light-sweep h-11">
                        <Printer className="w-4 h-4" /> {t('p6.print')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1">
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                    <div className="card-solid border border-white/10 rounded-[2rem] p-6 relative overflow-hidden group shrink-0 shadow-2xl transition-all duration-500 hover:border-secondary/40">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity className="w-24 h-24 text-primary" />
                        </div>
                        <div className="flex justify-between items-center mb-0 relative z-10 bg-primary/10 -mx-6 -mt-6 p-4 border-b border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={() => setIsDesignCollapsed(!isDesignCollapsed)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-all ${isDesignCollapsed ? 'bg-white/5' : 'bg-primary/20 text-primary'}`}>
                                    {isDesignCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{t('p6.designRef')}</h3>
                                    <div className="text-[10px] font-black text-primary mt-0.5 uppercase tracking-tighter opacity-80">{compareScenario.toUpperCase()} — {t('p5.preview')}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {params.isMechVerified && (
                                    <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">VERIFICADO</span>
                                )}
                                <span className="bg-primary text-white px-3 py-1 rounded-lg text-[10px] font-black">TARGET</span>
                            </div>
                        </div>

                        {!isDesignCollapsed && (
                            <div className="grid grid-cols-2 gap-3 relative z-10 mt-6 animate-slideDown">
                                <DesignMetric label={t('tele.flow')} value={`${designParams.pressures.totalRate} BPD`} />
                                <DesignMetric label={t('p5.freq')} value={`${params.targets[compareScenario].frequency} Hz`} />
                                <DesignMetric label="TDH" value={`${designRes.tdh?.toFixed(0)} ft`} />
                                <DesignMetric label={t('p3.pip')} value={`${designRes.pip?.toFixed(0)} psi`} />
                                <DesignMetric label="INTAKE MD" value={`${designParams.pressures.pumpDepthMD?.toFixed(0)} ft`} />
                                <DesignMetric label="INTAKE TVD" value={`${interpolateTVD(designParams.pressures.pumpDepthMD, designParams.survey).toFixed(0)} ft`} />
                                <DesignMetric label="PMP (MD)" value={`${designParams.wellbore.midPerfsMD?.toFixed(0)} ft`} />
                                <DesignMetric label="PMP (TVD)" value={`${interpolateTVD(designParams.wellbore.midPerfsMD, designParams.survey).toFixed(0)} ft`} />
                            </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            <Info className="w-3 h-3 text-txt-muted" />
                            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-txt-muted">
                                Fuente: {params.isMechVerified ? 'ESTADOS MECÁNICOS (VERIFICADO)' : 'DISEÑO ORIGINAL (AUTO)'}
                            </span>
                        </div>
                    </div>

                    <div className={`card-solid rounded-[2rem] border p-6 shadow-2xl flex-1 relative overflow-hidden flex flex-col gap-6 min-h-0 min-h-[400px] transition-all duration-700 ${isMaxCapActive ? 'border-success/40 ring-1 ring-success/20 bg-success/[0.04]' : 'border-white/10'}`}>
                        <div className={`absolute inset-0 bg-gradient-to-b transition-colors duration-700 ${isMaxCapActive ? 'from-success/10 to-transparent' : 'from-primary/5 to-transparent'}`}></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4 bg-primary/10 -mx-6 -mt-6 p-3 border-b border-primary/20 rounded-t-[2rem]">
                                <div className="p-1.5 bg-primary/20 rounded-lg text-primary border border-primary/30"><Activity className="w-3.5 h-3.5" /></div>
                                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{t('p6.surfaceData')}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                <PremiumField label={t('p6.testRate')} value={fieldData.rate} unit="BPD" icon={Droplets} onChange={(v: any) => updateField('rate', v)} color="secondary" />
                                <PremiumField
                                    label={t('p5.freq')}
                                    value={displayFreq}
                                    unit="Hz"
                                    icon={Activity}
                                    onChange={(v: any) => isMaxCapActive ? setSimFreq(v) : updateField('frequency', v)}
                                    color={isMaxCapActive ? 'success' : 'secondary'}
                                />
                                <PremiumField label={t('p6.measThp')} value={fieldData.thp} unit="psi" icon={Gauge} onChange={(v: any) => updateField('thp', v)} color="secondary" />
                                <PremiumField label={t('p6.measTht')} value={fieldData.tht} unit="°F" icon={Thermometer} onChange={(v: any) => updateField('tht', v)} color="secondary" />
                                <div className="col-span-2">
                                    <PremiumField label={t('p2.waterCut')} value={fieldData.waterCut} unit="%" icon={Droplets} onChange={(v: any) => updateField('waterCut', v)} color="secondary" />
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-3 mt-2 pt-5 border-t border-white/5">
                                    <PremiumDate label={t('p6.startDate')} value={fieldData.startDate} icon={Calendar} onChange={(v: any) => updateField('startDate', v)} />
                                    <PremiumDate label={t('p6.matchDate')} value={fieldData.matchDate} icon={Calendar} onChange={(v: any) => updateField('matchDate', v)} />
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-6">
                            <div className="flex items-center gap-3 mb-4 bg-primary/10 -mx-6 p-3 border-y border-primary/20">
                                <div className="p-1.5 bg-primary/20 rounded-lg text-primary border border-primary/30"><ArrowDown className="w-3.5 h-3.5" /></div>
                                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{t('p6.downholeData')}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div className="col-span-2 grid grid-cols-2 gap-3">
                                    <PremiumField label="P. Estática" value={Math.round((fieldData.pStatic > 0) ? fieldData.pStatic : (params.inflow.pStatic || 0))} unit="psi" icon={Layers} onChange={(v: any) => updateField('pStatic', v)} color="primary" />
                                    <PremiumField label={t('p6.measPip')} value={Math.round(fieldData.pip)} unit="psi" icon={Gauge} onChange={(v: any) => updateField('pip', v)} color="primary" />
                                </div>
                                <div className={`col-span-2 rounded-[1.5rem] p-4 flex flex-col justify-between group transition-all duration-500 shadow-2xl relative overflow-hidden ${sensScenario.active ? 'bg-primary/20 border-2 border-primary/40 ring-1 ring-primary/20' : 'bg-surface/50 border border-white/10'}`}>
                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    <div className="flex justify-between items-center mb-3 relative z-10">
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-60">
                                                {sensScenario.active ? "IP SIMULADO" : t('p6.calcIp')}
                                            </label>
                                            <span className="text-[8px] font-black text-primary/60 uppercase tracking-tighter">Calibrado: {calculatedIP?.toFixed(2)}</span>
                                        </div>
                                        <button
                                            type="button"
                                            title="Use esta suite para analizar el comportamiento del sistema (caudal, PIP, Pwf) ante cambios hipotéticos en el IP del reservorio o la presión de cabezal (THP)."
                                            onClick={(e) => {
                                                e.preventDefault();
                                                // Reset to 0 when activating for first time, or keep current if already active
                                                setSensScenario({
                                                    active: !sensScenario.active,
                                                    ip: sensScenario.active ? sensScenario.ip : 0,
                                                    thp: sensScenario.active ? sensScenario.thp : 0
                                                });
                                            }}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2.5 shadow-xl ${sensScenario.active ? 'bg-primary text-white shadow-glow-primary/50 animate-pulse-subtle scale-105' : 'bg-white/5 text-txt-muted hover:bg-white/10 hover:text-white border border-white/5'}`}
                                        >
                                            <TrendingUp className={`w-3.5 h-3.5 ${sensScenario.active ? 'animate-bounce' : ''}`} />
                                            {sensScenario.active ? "En Sesión" : "Sensibilizar"}
                                        </button>
                                    </div>

                                    {sensScenario.active ? (
                                        <div className="flex flex-col gap-4 relative z-10 animate-fadeIn mt-2">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[8px] font-black text-primary uppercase ml-1 opacity-70">Nuevo IP (BFPD/PSI)</label>
                                                <div className="flex items-center bg-black/40 rounded-xl border border-white/30 overflow-hidden focus-within:border-primary/50 transition-all shadow-inner">
                                                    <input
                                                        type="number"
                                                        value={sensScenario.ip}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setSensScenario({ ...sensScenario, ip: isNaN(val) ? 0 : val });
                                                        }}
                                                        autoFocus
                                                        className="w-full bg-transparent px-3 py-2.5 text-lg font-black text-txt-main outline-none font-mono placeholder:text-txt-muted/20"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[8px] font-black text-secondary uppercase ml-1 opacity-70">Nueva THP (PSI)</label>
                                                <div className="flex items-center bg-black/40 rounded-xl border border-white/30 overflow-hidden focus-within:border-secondary/50 transition-all shadow-inner">
                                                    <input
                                                        type="number"
                                                        value={sensScenario.thp}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const val = parseFloat(raw);
                                                            setSensScenario({ ...sensScenario, thp: isNaN(val) ? 0 : val });
                                                        }}
                                                        className="w-full bg-transparent px-3 py-2.5 text-lg font-black text-txt-main outline-none font-mono placeholder:text-txt-muted/20"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-1 p-2 bg-primary/20 rounded-lg border border-primary/30 shadow-glow-primary/10">
                                                <p className="text-[7px] font-black text-primary uppercase leading-tight text-center tracking-widest animate-pulse">
                                                    PROYECCIÓN NODAL ACTIVA
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-baseline gap-2 relative z-10 py-2">
                                            <span className="text-3xl font-black text-primary font-mono tracking-tighter">{calculatedIP?.toFixed(2) ?? '0.00'}</span>
                                            <span className="text-[9px] font-black text-txt-muted uppercase opacity-40 italic"> BFPD/PSI</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-4 pt-6 border-t border-white/10">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl border transition-all ${isMaxCapActive ? 'bg-success/20 text-success border-success/40 shadow-glow-success/20' : 'bg-white/5 text-txt-muted border-white/10'}`}>
                                            <Zap className={`w-4 h-4 ${isMaxCapActive ? 'animate-pulse' : ''}`} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-txt-main uppercase tracking-[0.2em]">Cálculo Capacidad Máxima</h3>
                                    </div>
                                    <button
                                        onClick={() => setIsMaxCapActive(!isMaxCapActive)}
                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${isMaxCapActive ? 'bg-success text-white border-success shadow-glow-success' : 'bg-white/5 text-txt-muted border-white/10 hover:bg-white/10'}`}
                                    >
                                        {isMaxCapActive ? 'ACTIVADO' : 'ACTIVAR'}
                                    </button>
                                </div>

                                {isMaxCapActive && (
                                    <div className="bg-success/5 rounded-2xl p-4 border border-success/20 animate-fadeIn">
                                        <p className="text-[9px] font-medium text-success/80 leading-relaxed uppercase tracking-wider">
                                            Modo Simulación Activo. Ajuste la frecuencia para predecir el comportamiento del pozo y la bomba basándose en el IP y sistema calibrados.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2 min-h-0 bg-success/[0.005] rounded-[3rem] p-0">
                    <div className={`card-solid rounded-[2.5rem] border shadow-2xl overflow-hidden p-3 relative flex flex-col shrink-0 group transition-all duration-700 min-h-[450px] lg:h-[480px] ${isMaxCapActive ? 'border-success/40 ring-1 ring-success/20' : 'border-white/10'}`}>
                        <div className={`absolute inset-0 ${isMaxCapActive ? 'bg-success/5' : 'bg-secondary/5'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                        <div className="absolute top-6 right-8 flex gap-3 z-20">
                            <div className={`w-2.5 h-2.5 rounded-full ${isMaxCapActive ? 'bg-success animate-pulse shadow-glow-success' : 'bg-secondary animate-pulse shadow-glow-secondary'}`}></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-primary/40"></div>
                        </div>
                        <button onClick={() => setIsChartExpanded(true)} className="absolute bottom-6 right-8 z-30 p-3.5 glass-surface border border-white/10 rounded-2xl text-txt-muted hover:text-secondary hover:scale-110 transition-all opacity-0 group-hover:opacity-100 shadow-2xl">
                            <Maximize2 className="w-6 h-6" />
                        </button>

                        {chartData.length > 0 ? (
                            <div className="w-full h-full relative">
                                {(!fieldData.pip || fieldData.pip <= 0 || !fieldData.thp || fieldData.thp <= 0 || !fieldData.frequency || fieldData.frequency <= 0 || !fieldData.rate || fieldData.rate <= 5) && (
                                    <div className="absolute inset-0 z-40 bg-surface/80 backdrop-blur-md flex flex-col items-center justify-center rounded-[2rem] p-10 text-center animate-fadeIn">
                                        <div className="p-6 bg-warning/10 rounded-full border border-warning/30 animate-pulse shadow-glow-warning/20 mb-6">
                                            <AlertTriangle className="w-12 h-12 text-warning" />
                                        </div>
                                        <h3 className="text-2xl font-black text-warning uppercase tracking-tighter mb-4">Telemetría Incompleta</h3>
                                        <p className="text-txt-main/80 text-sm font-medium max-w-md mb-6 leading-relaxed">
                                            Faltan variables críticas para ejecutar el cálculo de degradación. Por favor, <strong>ingrese los valores manualmente</strong> en el panel izquierdo (Datos de Superficie/Fondo).
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-3">
                                            {(!fieldData.pip || fieldData.pip <= 0) && (
                                                <div className="px-3 py-1.5 bg-danger/20 border border-danger/40 rounded-lg text-danger font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-danger animate-ping"></div> FALTA PIP
                                                </div>
                                            )}
                                            {(!fieldData.thp || fieldData.thp <= 0) && (
                                                <div className="px-3 py-1.5 bg-danger/20 border border-danger/40 rounded-lg text-danger font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-danger animate-ping"></div> FALTA THP
                                                </div>
                                            )}
                                            {(!fieldData.frequency || fieldData.frequency <= 0) && (
                                                <div className="px-3 py-1.5 bg-danger/20 border border-danger/40 rounded-lg text-danger font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-danger animate-ping"></div> FALTA FRECUENCIA
                                                </div>
                                            )}
                                            {(!fieldData.rate || fieldData.rate <= 5) && (
                                                <div className="px-3 py-1.5 bg-danger/20 border border-danger/40 rounded-lg text-danger font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-glow-danger/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-danger animate-ping"></div> FALTA CAUDAL
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <PumpChart
                                    data={chartData}
                                    pump={pump}
                                    currentFrequency={displayFreq}
                                    isDiagnosticMode={chartMode === 'comparative'}
                                    referencePoints={referencePoints}
                                    targetFlow={displayRes.rate}
                                    className="w-full h-full"
                                />

                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-txt-muted opacity-30 uppercase font-black tracking-[0.4em] gap-8">
                                <div className="p-10 bg-surface rounded-full border border-white/10 animate-float">
                                    <Activity className="w-20 h-20 text-secondary/40" />
                                </div>
                                <span className="text-sm">{pump ? "Syncing Field Telemetry..." : "Hardware Identification Required"}</span>
                            </div>
                        )}

                        {isMaxCapActive && (
                            <div className="absolute bottom-6 left-12 right-24 z-20 animate-slideUp flex flex-col gap-3">
                                {simAlerts.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                                        {simAlerts.map((alert, idx) => (
                                            <div key={idx} className={`shrink-0 px-4 py-2 rounded-xl flex items-center gap-3 border shadow-2xl backdrop-blur-md animate-pulse-slow ${alert.type === 'danger' ? 'bg-danger/20 border-danger/40 text-danger' : 'bg-warning/20 border-warning/40 text-warning'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${alert.type === 'danger' ? 'bg-danger shadow-glow-danger' : 'bg-warning shadow-glow-warning'}`}></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[7px] font-black uppercase opacity-60 tracking-widest">{alert.field}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">{alert.message} ({alert.value})</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="bg-surface/90 border border-success/40 rounded-2xl p-4 shadow-glow-success/10 flex items-center justify-between gap-6 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-success/5 animate-pulse"></div>
                                    <div className="flex flex-col relative z-10">
                                        <span className="text-[8px] font-black text-success uppercase tracking-widest mb-1">Frecuencia Simulación</span>
                                        <span className="text-lg font-black text-txt-main font-mono">{simFreq} Hz</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="30"
                                        max="80"
                                        step="0.5"
                                        value={simFreq}
                                        onChange={(e) => setSimFreq(parseFloat(e.target.value))}
                                        className="flex-1 h-1.5 bg-success/20 rounded-lg appearance-none cursor-pointer accent-success relative z-10"
                                    />
                                    <div className="flex items-center gap-4 border-l border-white/10 pl-6 relative z-10">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest mb-0.5">Caudal Predicho</span>
                                            <span className="text-sm font-black text-success font-mono">{displayRes?.rate?.toFixed(0)} BPD</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest mb-0.5">Cabezal Predicho</span>
                                            <span className="text-sm font-black text-success font-mono">{displayRes?.head?.toFixed(0)} FT</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MODAL / PANEL DE SENSIBILIDAD - Rendered via Portal to avoid clipping */}
                    {showSensModal && createPortal(
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowSensModal(false)}></div>
                            <div className="bg-canvas border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.5)] relative z-10 overflow-hidden animate-zoomIn border-t-2 border-t-primary/40">
                                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-surface-raised">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/20 rounded-2xl text-primary border border-primary/30">
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white uppercase tracking-widest leading-none">Análisis de Sensibilidad</h3>
                                            <p className="text-[10px] text-txt-muted font-black uppercase mt-2 opacity-50 tracking-widest italic">Simulación de Reservorio y Superficie</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowSensModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                        <X className="w-7 h-7 text-txt-muted hover:text-white" />
                                    </button>
                                </div>
                                <div className="p-10 flex flex-col gap-8">
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-txt-muted uppercase tracking-widest">Nuevo IP (Yacimiento)</label>
                                                <span className="text-[9px] font-black text-primary uppercase">Actual: {calculatedIP.toFixed(2)}</span>
                                            </div>
                                            <div className="relative group">
                                                <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                                                <input
                                                    type="number"
                                                    value={sensScenario.ip}
                                                    onChange={(e) => setSensScenario({ ...sensScenario, ip: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-surface-light border border-white/10 p-6 rounded-[1.5rem] text-3xl font-black text-primary outline-none focus:border-primary/50 transition-all font-mono relative z-10"
                                                    placeholder="0.0"
                                                />
                                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-txt-muted opacity-30 z-10">BFPD/PSI</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-txt-muted uppercase tracking-widest">Nueva THP (Superficie)</label>
                                                <span className="text-[9px] font-black text-secondary uppercase">Actual: {fieldData.thp} psi</span>
                                            </div>
                                            <div className="relative group">
                                                <div className="absolute inset-0 bg-secondary/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                                                <input
                                                    type="number"
                                                    value={sensScenario.thp}
                                                    onChange={(e) => setSensScenario({ ...sensScenario, thp: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-surface-light border border-white/10 p-6 rounded-[1.5rem] text-3xl font-black text-secondary outline-none focus:border-secondary/50 transition-all font-mono relative z-10"
                                                    placeholder="0.0"
                                                />
                                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-txt-muted opacity-30 z-10">PSI</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 mt-4">
                                        <button
                                            onClick={() => {
                                                setSensScenario({ active: false, ip: 0, thp: 0 });
                                                setShowSensModal(false);
                                            }}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-txt-muted text-[11px] font-black uppercase py-5 rounded-2xl border border-white/10 transition-all hover:text-white"
                                        >
                                            Reset / Limpiar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSensScenario({ ...sensScenario, active: true });
                                                setShowSensModal(false);
                                            }}
                                            className="flex-1 bg-primary text-white text-[11px] font-black uppercase py-5 rounded-2xl shadow-glow-primary/30 hover:scale-[1.03] active:scale-[0.97] transition-all"
                                        >
                                            Ejecutar Sensibilidad
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* CONSOLIDATED CENTRAL OPERATION BAR */}
                    <div className="flex items-center justify-center gap-6 px-4 py-1 relative">
                        <div className="flex bg-surface-light/40 backdrop-blur-md p-1 rounded-[1.5rem] border border-white/5 shadow-2xl relative z-10">
                            <button
                                onClick={() => setViewMode('telemetry')}
                                className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-500 ${viewMode === 'telemetry' ? 'bg-secondary text-black shadow-glow-secondary/20 scale-[1.02]' : 'text-txt-muted hover:text-white hover:bg-white/5'}`}
                            >
                                <Monitor className="w-3.5 h-3.5" /> Telemetría
                            </button>
                            <button
                                onClick={() => setViewMode('sensitivity')}
                                className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-500 ${viewMode === 'sensitivity' ? 'bg-primary text-white shadow-glow-primary/20 scale-[1.02]' : 'text-txt-muted hover:text-white hover:bg-white/5'}`}
                            >
                                <TrendingUp className="w-3.5 h-3.5" /> Sensibilidad VSD
                            </button>

                            <div className="w-px h-6 bg-white/10 mx-2 self-center"></div>

                            <button
                                onClick={() => setIsVsdTableExpanded(!isVsdTableExpanded)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-500 ${isVsdTableExpanded ? 'bg-warning/20 text-warning border border-warning/30 shadow-glow-warning/10' : 'text-txt-muted hover:text-txt-main hover:bg-white/5'}`}
                            >
                                <Activity className="w-3.5 h-3.5 text-warning" />
                                {isVsdTableExpanded ? 'Modo Simple' : 'Modo Detallado (1Hz)'}
                            </button>
                        </div>

                        {/* Floating Status Indicator */}
                        <div className="absolute right-8 flex items-center gap-4 text-[9px] font-black text-txt-muted uppercase tracking-[0.3em] opacity-40">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success"></div> Live</div>
                            <span>Node: {String((params as any)?.id || 'GEN-01').slice(-6)}</span>
                        </div>
                    </div>

                    {viewMode === 'telemetry' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0 pb-1">
                                <PremiumMetricCard label={t('p6.degradation')} value={`${(degradationPct ?? 0).toFixed(1)}%`} subValue={t('p6.headLoss')} icon={TrendingDown} color="danger" alert={(degradationPct ?? 0) > 10} />
                                <PremiumMetricCard
                                    label={t('p6.vsdStatus')}
                                    value={((params as any).selectedVSD && (displayRes?.electrical?.systemKva ?? 0) > (params as any).selectedVSD.kvaRating) ? t('p6.limited') : t('p6.normal')}
                                    subValue={(params as any).selectedVSD ? `${(params as any).selectedVSD.kvaRating} kVA` : t('p6.noVsd')}
                                    icon={Monitor}
                                    color={((params as any).selectedVSD && (displayRes?.electrical?.systemKva ?? 0) > (params as any).selectedVSD.kvaRating) ? "danger" : "secondary"}
                                    alert={(params as any).selectedVSD && (displayRes?.electrical?.systemKva ?? 0) > (params as any).selectedVSD.kvaRating}
                                />
                                <PremiumMetricCard
                                    label={t('p6.actualDemand')}
                                    value={`${displayRes?.electrical?.systemKva?.toFixed(1) ?? '0.0'}`}
                                    subValue={t('p6.kvaSurface')}
                                    icon={Zap}
                                    color={isMaxCapActive ? "success" : "secondary"}
                                />
                                <PremiumMetricCard label={t('tele.systemPower')} value={`${displayRes?.electrical?.systemKw?.toFixed(1) ?? '0.0'} kW`} subValue={t('p6.totalInput')} icon={Zap} color={isMaxCapActive ? "success" : "secondary"} />
                                <PremiumMetricCard label={t('tele.sub')} value={`${displayRes?.submergenceFt?.toFixed(0) ?? '0'} ft`} subValue={t('p6.abovePump')} icon={Droplets} color={isMaxCapActive ? "success" : "primary"} alert={(displayRes?.submergenceFt ?? 0) < 500} />
                                <PremiumMetricCard label={t('tele.intakeTemp')} value={`${displayRes?.intakeTemp?.toFixed(1) ?? '0.0'} F`} subValue={t('p6.pumpIntake')} icon={Thermometer} color="secondary" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0 pb-1">
                                <CompPremium label={sensScenario.active ? "TDH Predicho" : t('tele.head')} design={designRes?.tdh ?? 0} actual={displayRes?.head ?? 0} unit="ft" color={isMaxCapActive ? "success" : "secondary"} />
                                <CompPremium label={sensScenario.active ? "Pwf Predicha" : t('p3.pwf')} design={designRes?.pwf ?? 0} actual={displayRes?.pwf ?? 0} unit="psi" color={isMaxCapActive ? "success" : "primary"} />
                                <PremiumMetricCard label={t('p5.motorLoad')} value={`${(displayRes?.motorLoad ?? 0).toFixed(0)}%`} subValue={`${displayRes?.hpTotal?.toFixed(1) ?? '0.0'} HP`} icon={Zap} color={isMaxCapActive ? "success" : "primary"} alert={(displayRes?.motorLoad ?? 0) > 105} />
                                <CompPremium label={sensScenario.active ? "Caudal Predicho" : t('tele.flow')} design={designParams.pressures.totalRate} actual={displayRes.rate} unit="bpd" color={isMaxCapActive ? "success" : "secondary"} />
                                <CompPremium label={sensScenario.active ? "PIP Predicha" : t('p3.pip')} design={designRes.pip} actual={displayRes.pip} unit="psi" color={isMaxCapActive ? "success" : "primary"} />
                                <CompPremium label={sensScenario.active ? "Drawdown %" : "Drawdown %"} design={((designParams.inflow.pStatic - designRes.pwf) / (designParams.inflow.pStatic || 1) * 100)} actual={((effectiveParams.inflow.pStatic - displayRes.pwf) / (effectiveParams.inflow.pStatic || 1) * 100)} unit="%" color={sensScenario.active ? "primary" : "secondary"} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-2 shrink-0 pb-1">
                                <PremiumMetricCard label={t('sens.vel')} value={`${displayRes?.fluidVelocity?.toFixed(2) ?? '0.0'}`} subValue={t('p6.cooling')} icon={Droplets} color={isMaxCapActive ? "success" : "primary"} alert={(displayRes?.fluidVelocity ?? 0) < 0.5} />
                                <PremiumMetricCard label={t('sens.volts')} value={`${displayRes?.electrical?.volts?.toFixed(0) ?? '0'}`} subValue={t('p6.downhole')} icon={Zap} color="secondary" />
                                <PremiumMetricCard label={t('sens.amps')} value={`${displayRes?.electrical?.amps?.toFixed(1) ?? '0.0'}`} subValue={t('p6.matchCap')} icon={Activity} color="secondary" />
                                <PremiumMetricCard label={t('tele.surfaceVolts')} value={`${displayRes?.electrical?.surfaceVolts?.toFixed(0) ?? '0'}`} subValue={t('p6.vsdOut')} icon={Zap} color={isMaxCapActive ? "success" : "primary"} />
                                <PremiumMetricCard label={t('p5.efficiency')} value={`${displayRes?.efficiency?.toFixed(1) ?? '0.0'}%`} subValue={t('p6.hydraulic')} icon={Activity} color="success" />
                                <PremiumMetricCard label={t('tele.shaftTorque')} value={t('p6.normal')} subValue={t('p6.safetyMargin')} icon={ShieldCheck} color="success" />
                                <PremiumMetricCard label={t('p6.matchSuccess')} value={isMaxCapActive ? "SIM" : "98.5%"} subValue={t('p6.modelConvergence')} icon={Target} color={isMaxCapActive ? "success" : "primary"} />
                            </div>
                        </>
                    ) : (
                        <div className="card-solid border border-white/10 rounded-[2rem] overflow-hidden flex flex-col min-h-[500px] shadow-2xl animate-fadeIn">
                            <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-surface-raised/50">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-xs font-black text-txt-main uppercase tracking-tight border-l-2 border-primary pl-3">Simulación VSD (30-80 Hz)</h3>
                                    <span className="text-[8px] text-txt-muted font-bold uppercase tracking-widest opacity-40 italic">Condiciones de campo actuales</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500 shadow-glow-primary animate-pulse"></div>
                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Frecuencia Campo: {fieldData.frequency} Hz</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar-h glass-table border-t border-white/5 max-h-[600px]">
                                <table className="w-full text-left border-separate border-spacing-0 min-w-[1200px]">
                                    <thead className="sticky top-0 z-20 table-header-fusion">
                                        <tr>
                                            <th className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.2em] sticky left-0 top-0 z-50 frequency-cell-solid shadow-[4px_0_10px_rgba(0,0,0,0.3)]">Frecuencia</th>
                                            {vsdCols.map(col => (
                                                <th key={col.label} className="px-3 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-center sticky top-0 z-20 table-header-fusion">
                                                    {col.label}
                                                    {col.unit && <span className="block text-[8px] opacity-40 lowercase mt-1 font-bold">{col.unit}</span>}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {vsdRows.filter(row => isVsdTableExpanded || row.isActual || row.hz % 10 === 0).map((row) => {
                                            const tdBaseClass = row.isActual
                                                ? 'table-cell-actual'
                                                : row.isDanger
                                                    ? 'table-cell-danger'
                                                    : row.isWarning
                                                        ? 'table-cell-warning'
                                                        : 'table-cell-success';

                                            // Ensure sticky column is always solid
                                            const stickyBgClass = row.isActual ? 'frequency-cell-actual-solid' : 'frequency-cell-solid';

                                            return (
                                                <tr
                                                    key={row.hz}
                                                    className="table-row-fusion group/row"
                                                    title={row.limitReason || ''}
                                                >
                                                    <td className={`${tdBaseClass} ${stickyBgClass} px-5 py-4 whitespace-nowrap sticky left-0 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.3)] text-white font-black border-r border-white/10`}>
                                                        <div className="flex items-center gap-3">
                                                            {row.isActual && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-glow-primary animate-pulse"></div>}
                                                            {row.isDanger && !row.isActual && <div className="w-2.5 h-2.5 rounded-full bg-danger shadow-glow-danger animate-pulse"></div>}
                                                            {row.isWarning && !row.isActual && <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-glow-warning"></div>}
                                                            {row.isSuccess && !row.isActual && <div className="w-2 h-2 rounded-full bg-success/40"></div>}

                                                            <span className="text-sm font-black tracking-tight">
                                                                {row.hz} <small className="opacity-40 text-[9px]">Hz</small>
                                                            </span>
                                                            {row.isActual && <span className="text-[9px] text-primary px-2 py-0.5 rounded border border-primary/30 font-black uppercase tracking-widest bg-primary/5">ACTUAL</span>}
                                                            {row.violations.length > 0 && !row.isActual && !row.noIntersection && (
                                                                <div className="flex gap-1.5">
                                                                    {row.violations.map((v, idx) => (
                                                                        <div key={idx} className={`w-2 h-2 rounded-full ${v.type === 'danger' ? 'bg-danger shadow-glow-danger' : 'bg-warning shadow-glow-warning'}`} title={v.reason}></div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {row.noIntersection && (
                                                                <span className="text-[9px] bg-white/10 text-txt-muted px-2 py-0.5 rounded-md font-black tracking-wide opacity-40">
                                                                    Sin Convergencia
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {row.noIntersection ? (
                                                        <td colSpan={vsdCols.length} className="px-3 py-4 text-center text-[11px] text-txt-muted opacity-40 italic font-medium uppercase tracking-widest">
                                                            Conflicto de Sistema — No se encontró ajuste de fluido
                                                        </td>
                                                    ) : vsdCols.map(col => {
                                                        const violation = row.violations?.find(v => v.field === col.key);
                                                        const highlightClass = violation
                                                            ? (violation.type === 'danger'
                                                                ? 'text-danger font-black font-mono'
                                                                : 'text-warning font-black font-mono')
                                                            : 'text-txt-main/90';

                                                        return (
                                                            <td key={col.label} className={`${tdBaseClass} px-3 py-3 text-center transition-colors duration-500`}>
                                                                <div className={`text-xs ${highlightClass}`}>
                                                                    {col.fmt((row as any)[col.key])}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 bg-white/5 border-t border-white/5 text-right">
                                <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-40">
                                    ★ Los valores mostrados son proyecciones del gemelo digital basadas en el IPR (IP: {(sensScenario.active && sensScenario.ip > 0 ? sensScenario.ip : calculatedIP).toFixed(2)}) {sensScenario.active ? 'Simulado' : 'Calibrado'}.
                                </span>
                            </div>
                        </div>
                    )}

                    {showReport && (
                        <HistoryMatchReport
                            onClose={() => setShowReport(false)}
                            designParams={designParams}
                            actualParams={effectiveParams}
                            pump={pump}
                            designRes={designRes}
                            actualRes={displayRes}
                            designFreq={designFreq}
                            actualFreq={displayFreq}
                            chartData={chartData}
                            mechanics={null}
                            compareScenario={compareScenario}
                            fieldData={fieldData}
                            refPoints={referencePoints}
                            calculatedIP={sensScenario.active ? sensScenario.ip : calculatedIP}
                            aiAnalysis={aiAnalysisText}
                            motor={(params as any).motor}
                            degradationPct={degradationPct}
                            vsdRows={vsdRows}
                        />
                    )}
                </div>
            </div>
        </>
    );
};
