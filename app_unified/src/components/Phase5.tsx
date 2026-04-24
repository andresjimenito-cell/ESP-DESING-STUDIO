
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Cpu, Database, Sparkles, Zap, Printer, X, Save, FileText, TrendingUp, DollarSign, Calendar, AlertCircle, Filter, PieChart, Activity, Gauge, Server, UploadCloud, ChevronRight, CheckCircle2, BarChart3, Construction, Droplets, ArrowDown, Layers, Clock, TrendingDown, Eye, Settings, Target, Hammer, Star, Battery, Cable, Flame, Download, Share2, Search, SlidersHorizontal, ChevronDown, ChevronUp, Box, Library, Table, Maximize2, AlertTriangle, Monitor, GitCompareArrows } from 'lucide-react';
import { EspPump, EspMotor, EspCable, EspVSD, SystemParams, NodalSystemPoint } from '../types';
import { calculateTDH, calculateBaseHead, findIntersection, calculateSystemResults, calculateBasePowerPerStage, calculateMotorPoly, generateMultiCurveData, getShaftLimitHp, calculatePDP, calculateFluidProperties, interpolateTVD, calculatePwf, getDownloadFilename, calculateBhpAtPoint } from '../utils';
import { PerformanceCurveMultiAxis } from './PerformanceCurveMultiAxis';
import { MotorCurveMultiAxis } from './MotorCurveMultiAxis';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, ReferenceLine, ReferenceDot, AreaChart, Label, Legend } from 'recharts';
import { PumpChart } from './PumpChart';
import { MotorChart } from './MotorChart';
import { VisualESPStack } from './VisualESPStack';
import { STANDARD_PUMPS, STANDARD_MOTORS, CABLE_CATALOG, VSD_CATALOG } from '../data';
import { useLanguage } from '../i18n';
import { runAISelection } from '../aiSelectionEngine';

interface Phase5Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    customPump: EspPump | null;
    setCustomPump: React.Dispatch<React.SetStateAction<EspPump | null>>;
    pumpCatalog: EspPump[];
    motorCatalog: EspMotor[];
    setShowPumpModal: (show: boolean) => void;
    curveData: any[];
    match: any;
    results: any;
    onCompare?: (snapshot: any) => void;
    onReloadCatalog?: () => void;
}

// --- REUSABLE COLLAPSIBLE SECTION COMPONENT ---
const CollapsibleSection = ({ title, icon: Icon, children, isOpen, onToggle, colorClass = "primary" }: any) => {
    return (
        <div className={`glass-surface rounded-[2rem] border border-white/5 shadow-xl overflow-hidden transition-all duration-700 flex-shrink-0 ${isOpen ? 'ring-2 ring-primary/30 shadow-glow-primary/10' : ''}`}>
            <button
                onClick={onToggle}
                className={`w-full flex items-center justify-between p-4 transition-all duration-500 group outline-none sticky top-0 z-10 light-sweep ${isOpen ? 'bg-primary/5' : 'bg-transparent'}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-2xl glass-surface-light text-${colorClass} border border-white/5 group-hover:bg-white/10 transition-all duration-500 shadow-sm shadow-${colorClass}/20`}>
                        {Icon && <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-[10px] font-black text-txt-main uppercase tracking-[0.2em] group-hover:tracking-[0.25em] transition-all duration-500">{title}</span>
                </div>
                <div className={`p-2 rounded-full transition-all duration-500 ${isOpen ? 'rotate-180 bg-primary/20 text-primary shadow-glow-primary' : 'rotate-0 text-txt-muted'}`}>
                    <ChevronDown className="w-4 h-4" />
                </div>
            </button>
            <div className={`transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                <div className="border-t border-white/5 animate-fadeIn">
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- DRAFT INPUT COMPONENT ---
const DraftInput = ({ value, onChange, className, instant = false, ...props }: any) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => { setLocalValue(value); }, [value]);

    const handleChange = (e: any) => {
        const val = e.target.value;
        setLocalValue(val);
        if (instant) {
            const num = parseFloat(val);
            if (!isNaN(num)) onChange(num);
        }
    };

    const handleBlur = () => {
        const num = parseFloat(localValue);
        if (!isNaN(num)) onChange(num);
        else setLocalValue(value);
    };

    return (
        <input
            {...props}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') handleBlur(); }}
            className={className}
        />
    );
};

// --- TELEMETRY COMPONENTS ---
const KPICard = ({ label, value, unit, icon: Icon, colorClass, highlight = false, glow = false, target }: any) => {
    const safeValue = (value === 'NaN' || value === undefined || value === null) ? '-' : value;
    const border = highlight ? `border-primary/50 shadow-glow-primary` : 'border-white/5';

    // Check if within 2% of target
    const isMet = target > 0 && Math.abs(parseFloat(value) - target) / target < 0.02;

    return (
        <div className={`relative glass-surface rounded-[2rem] border ${border} p-6 flex flex-col justify-between overflow-hidden group hover:scale-[1.03] hover:border-primary/40 transition-all duration-500 min-h-[110px] light-sweep`}>
            {isMet && <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-[8px] font-black text-white rounded-bl-xl z-20 animate-fadeIn shadow-glow-primary uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="w-2.5 h-2.5" /> MET</div>}
            <div className={`absolute -right-10 -top-10 w-24 h-24 bg-${colorClass}/10 blur-3xl rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-1000`}></div>

            <div className="flex justify-between items-start z-10">
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-txt-main/60 mb-0.5 group-hover:text-primary/80 transition-opacity">{label}</span>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black tracking-tighter text-txt-main font-mono`}>{safeValue}</span>
                        <span className="text-[10px] font-black text-txt-main/40 uppercase tracking-widest">{unit}</span>
                    </div>
                    {target > 0 && (
                        <div className="mt-2 flex items-center gap-2 px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 w-fit">
                            <div className="text-[8px] font-black text-txt-muted uppercase tracking-tighter opacity-50">TARGET:</div>
                            <div className={`text-[10px] font-black font-mono ${isMet ? 'text-primary' : 'text-secondary/70'}`}>{target.toLocaleString()}</div>
                        </div>
                    )}
                </div>
                <div className={`p-3.5 rounded-2xl glass-surface-light text-${colorClass === 'primary' ? 'primary' : 'secondary'} border border-white/5 shadow-inner group-hover:shadow-glow-${colorClass === 'primary' ? 'primary' : 'secondary'} transition-all duration-500`}>
                    {Icon && <Icon className={`w-5 h-5 ${glow ? 'animate-pulse' : ''}`} />}
                </div>
            </div>
        </div>
    );
};

const DigitalReadout = ({ label, value, unit, color }: any) => {
    const safeVal = (value === undefined || value === null || isNaN(value)) ? '0.0' : value;
    return (
        <div className="glass-surface-light border border-white/5 rounded-2xl p-3.5 flex items-center justify-between min-w-[130px] shadow-inner relative overflow-hidden group hover:border-white/10 transition-all duration-500">
            <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
            <div className="flex flex-col gap-0.5 relative z-10">
                <span className="text-[8px] font-black text-txt-muted uppercase tracking-[0.2em] mb-0.5 opacity-60 group-hover:opacity-100 transition-opacity">{label}</span>
                <div className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-black font-mono tracking-tight text-${color} text-glow-${color}`}>{safeVal}</span>
                    <span className="text-[9px] font-black text-txt-muted uppercase opacity-40">{unit}</span>
                </div>
            </div>
            <div className={`w-1 h-8 rounded-full bg-${color}/10 border border-${color}/20 group-hover:scale-y-110 transition-transform duration-500`}></div>
        </div>
    );
};

// --- HELPER FUNCTIONS ---
const generateMultiFrequencyTable = (pump: EspPump, params: SystemParams, centerHz: number) => {
    // INCREASED DENSITY: 5Hz intervals from 30 to 80
    const freqs = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
    if (!freqs.includes(centerHz)) freqs.push(centerHz);
    freqs.sort((a, b) => a - b);

    return freqs.map(hz => {
        const cData = generateMultiCurveData(pump, params, hz, 60);
        const matchPoint = findIntersection(cData);
        let flow = matchPoint ? matchPoint.flow : 0;
        let head = matchPoint ? matchPoint.head : 0;
        const res = calculateSystemResults(flow, head, params, pump, hz);

        const rpm = hz * 60;
        const wc = params.fluids.waterCut || 0;
        const bwpd = flow * (wc / 100);
        const bopd = flow * (1 - wc / 100);
        const pStatic = params.inflow.pStatic;
        const drawdown = Math.max(0, pStatic - res.pwf);
        const shaftLimit = getShaftLimitHp(pump?.series);
        const bhp = res.hpTotal || 0;
        const pumpShaftLoad = shaftLimit > 0 ? (bhp / shaftLimit) * 100 : 0;
        const protShaftLoad = shaftLimit > 0 ? (bhp / (shaftLimit * 1.15)) * 100 : 0;
        const motorShaftLoad = shaftLimit > 0 ? (bhp / (shaftLimit * 1.25)) * 100 : 0;
        const bep = (pump?.bepRate || 1000) * (hz / (pump?.nameplateFrequency || 60));
        const thrustLoad = flow > 0 ? Math.min(100, 15 + (Math.abs(flow - bep) / bep) * 50) : 0;
        const intakeT = params.bottomholeTemp;
        const kwTerminal = res.electrical?.kw || 0;
        const motorEfficiency = (res.electrical?.motorEff || 85) / 100;
        const mix_sg = Math.max(0.6, res.sgMixed || 0.8);
        const w_c = wc / 100;
        const Cp = 0.5 * (1 - w_c) + 1.0 * w_c;
        const heatGeneratedBtuHr = kwTerminal * (1 - motorEfficiency) * 3412;
        const massFlowLbHr = Math.max(10, flow) * 14.6 * mix_sg;
        const tempRise = massFlowLbHr > 0 ? (heatGeneratedBtuHr / (massFlowLbHr * Cp)) : 0;
        const motorT = intakeT + (tempRise * 0.85);

        return {
            hz, rpm, flow, pip: res.pip, wc, bwpd, bopd, pStatic, pdp: res.pdp, pwf: res.pwf,
            thp: params.pressures.pht, tdh: res.tdh, fluidLevel: res.fluidLevel,
            pumpDepth: params.pressures.pumpDepthMD, drawdown, bhp,
            motorHp: params.motorHp,
            amps: res.electrical.amps, volts: res.electrical.volts, voltDrop: res.electrical.voltDrop,
            kva: res.electrical.systemKva, kw: res.electrical.systemKw, vel: res.fluidVelocity, motorT,
            pumpEff: res.effEstimated, motorEff: res.electrical.motorEff,
            availableHp: res.availableHp ?? 0,
            submergence: (params.pressures.pumpDepthMD || 0) - (res.fluidLevel || 0),
            pumpShaftLoad, protShaftLoad, motorShaftLoad, thrustLoad, motorLoad: res.motorLoad,
            gasVoid: (res.gasAnalysis?.voidFraction || 0) * 100
        };
    });
};

const f0 = (n: number) => n !== undefined && !isNaN(n) ? Math.round(n).toLocaleString() : '-';
const f1 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(1) : '-';

// --- REPORT SELECTOR MODAL ---
export const ReportSelectorModal = ({ isOpen, onClose, onSelect, scenarios }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-canvas/80 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-surface border border-white/10 rounded-[32px] w-full max-w-md p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)] animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-txt-main uppercase tracking-tight flex items-center gap-3">
                        <Printer className="w-5 h-5 text-primary" /> {useLanguage().t('p5.designReport')}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-surface-light rounded-xl transition-all"><X className="w-5 h-5 text-txt-muted" /></button>
                </div>
                <div className="space-y-3">
                    <button onClick={() => onSelect('comprehensive')} className="w-full p-6 text-left bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-2xl transition-all group">
                        <div className="font-black text-primary uppercase text-sm mb-1">{useLanguage().t('p5.compReport')}</div>
                        <div className="text-xs text-txt-muted font-bold">Resumen completo de los 3 casos de diseño (MIN, OBJ, MAX)</div>
                    </button>
                    <div className="h-px bg-surface-light my-4"></div>
                    <div className="text-[10px] font-black text-txt-muted uppercase tracking-widest mb-2 px-1">Escenarios Individuales</div>
                    {['min', 'target', 'max'].map((s) => (
                        <button key={s} onClick={() => onSelect(s)} className="w-full p-4 text-left hover:bg-white/5 border border-white/5 rounded-2xl font-black uppercase text-xs flex justify-between items-center transition-all">
                            <span>{s === 'target' ? 'OBJETIVO (TARGET)' : s.toUpperCase()}</span>
                            <ChevronRight className="w-4 h-4 text-primary" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- DESIGN REPORT COMPONENT (PRINT VIEW) ---
export const DesignReport = ({ onClose, params, pump, results, frequency, motor, cable, type = 'target' }: any) => {
    const { t } = useLanguage();

    const handlePrint = () => {
        const originalTitle = document.title;
        const fname = getDownloadFilename(params, pump, `Design_${type.toUpperCase()}`);
        document.title = fname;
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 500);
    };

    // Calculate report data based on type
    const scenariosToRender = useMemo(() => {
        if (type === 'comprehensive') return ['min', 'target', 'max'];
        return [type];
    }, [type]);

    const rowDefinitions = [
        { label: t('sens.rpm'), key: 'rpm', unit: 'rpm', fmt: f0 },
        { label: t('sens.flow'), key: 'flow', unit: 'bpd', fmt: f0 },
        { label: t('sens.pip'), key: 'pip', unit: 'psi', fmt: f0 },
        { label: "BSW", key: 'wc', unit: '%', fmt: f1 },
        { label: "BWPD", key: 'bwpd', unit: 'bpd', fmt: f0 },
        { label: "BOPD", key: 'bopd', unit: 'bpd', fmt: f0 },
        { label: t('sens.pStatic'), key: 'pStatic', unit: 'psi', fmt: f0 },
        { label: t('sens.pdp'), key: 'pdp', unit: 'psi', fmt: f0 },
        { label: t('sens.pwf'), key: 'pwf', unit: 'psi', fmt: f0 },
        { label: t('sens.thp'), key: 'thp', unit: 'psi', fmt: f0 },
        { label: t('sens.tdh'), key: 'tdh', unit: 'ft', fmt: f0 },
        { label: t('sens.fluidLevel'), key: 'fluidLevel', unit: 'ft', fmt: f0 },
        { label: t('sens.pumpDepth'), key: 'pumpDepth', unit: 'ft', fmt: f0 },
        { label: t('sens.drawdown'), key: 'drawdown', unit: 'psi', fmt: f0 },
        { label: "BHP Requerido", key: 'bhp', unit: 'hp', fmt: f1 },
        { label: "Potencia Nominal", key: 'availableHp', unit: 'hp', fmt: f1 },
        { label: t('sens.amps'), key: 'amps', unit: 'A', fmt: f1 },
        { label: t('sens.volts'), key: 'volts', unit: 'V', fmt: f0 },
        { label: t('sens.voltDrop'), key: 'voltDrop', unit: 'V', fmt: f0 },
        { label: t('sens.kva'), key: 'kva', unit: 'kVA', fmt: f1 },
        { label: t('sens.kw'), key: 'kw', unit: 'kW', fmt: f1 },
        { label: t('sens.vel'), key: 'vel', unit: 'ft/s', fmt: f1 },
        { label: t('sens.motorT'), key: 'motorT', unit: '°F', fmt: f0 },
        { label: t('sens.pumpEff'), key: 'pumpEff', unit: '%', fmt: f1 },
        { label: t('sens.motorEff'), key: 'motorEff', unit: '%', fmt: f1 },
        { label: t('sens.shaftLoadPump'), key: 'pumpShaftLoad', unit: '%', fmt: f1 },
        { label: t('sens.shaftLoadProt'), key: 'protShaftLoad', unit: '%', fmt: f1 },
        { label: t('sens.shaftLoadMotor'), key: 'motorShaftLoad', unit: '%', fmt: f1 },
        { label: t('p5.motorLoad'), key: 'motorLoad', unit: '%', fmt: f1 },
        { label: t('sens.thrustLoad'), key: 'thrustLoad', unit: '%', fmt: f1 },
    ];



    return (
        <div className="fixed inset-0 z-[9999] bg-canvas overflow-hidden flex flex-col animate-fadeIn report-overlay-backdrop">
            <div className="h-16 bg-surface border-b border-white/5 flex items-center justify-between px-8 shadow-2xl shrink-0 no-print z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-2.5 rounded-xl text-white shadow-lg"><Printer className="w-6 h-6" /></div>
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-wider">{t('p5.designReport')}</h3>
                        <p className="text-sm text-txt-muted font-bold truncate max-w-[300px]">{type === 'comprehensive' ? 'Comprehensive Multi-Case Analysis' : `Scenario Analysis: ${type.toUpperCase()}`}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handlePrint} className="flex items-center gap-3 bg-primary hover:bg-primary/80 text-white px-8 py-3 rounded-2xl font-bold text-sm uppercase shadow-lg shadow-primary/20 transition-all active:scale-95">
                        <Download className="w-5 h-5" /> {t('p5.printPdf')}
                    </button>
                    <button onClick={onClose} className="p-3 bg-surface-light hover:bg-red-500/20 text-txt-muted hover:text-red-500 rounded-2xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-100 p-8 custom-scrollbar report-main-scroll">
                <style>{`
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
                        
                        /* Hide everything EXCEPT the report and its parents */
                        body * { visibility: hidden !important; }
                        
                        /* Ensure all parent containers are visible and not clipping */
                        #root, #root *, main, 
                        .report-overlay-backdrop, 
                        .report-main-scroll,
                        #design-report-paper, 
                        #design-report-paper * { 
                            visibility: visible !important; 
                        }
                        
                        /* Reset heights and overflows for all parents to allow scrolling */
                        #root, main, .report-overlay-backdrop, .report-main-scroll {
                            display: block !important;
                            position: static !important;
                            height: auto !important;
                            overflow: visible !important;
                            width: 100% !important;
                            flex: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            border: none !important;
                            background: white !important;
                        }
                        
                        #design-report-paper {
                            position: static !important;
                            width: 100% !important;
                            max-width: none !important;
                            padding: 10mm !important;
                            margin: 0 auto !important;
                            background-color: white !important;
                            color: black !important;
                            box-shadow: none !important;
                            height: auto !important;
                            overflow: visible !important;
                            display: block !important;
                        }
                        
                        .no-print { display: none !important; }
                        .page-break { page-break-before: always !important; break-before: page !important; display: block !important; height: 1px !important; }
                        .break-inside-avoid { page-break-inside: avoid !important; }
                        
                        /* Specific charts/images */
                        .chart-container-report { height: 450px !important; width: 100% !important; overflow: visible !important; }
                        
                        /* Contrast for PDF */
                        table, th, td { border-color: #ddd !important; color: black !important; }
                        h1, h2, h3, h4 { color: black !important; }
                        .bg-slate-900 { background-color: #000 !important; color: white !important; }
                    }
                    
                    /* Preview Styles (Non-Print) */
                    .report-container { max-width: 280mm; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 10px 50px rgba(0,0,0,0.1); border-radius: 8px; color: #0f172a; }
                    .chart-container-report { height: 400px !important; margin-bottom: 20px; }
                `}</style>

                <div id="design-report-paper" className="report-container">
                    <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                        <div className="flex items-center gap-4">
                            <Activity className="w-12 h-12 text-slate-900" />
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">ESP DESIGN STUDIO</h1>
                                <p className="font-bold text-slate-500 uppercase text-sm tracking-widest">{t('p5.designReport')} - {params.metadata.projectName || 'P-001'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('p5.generatedOn')}</div>
                            <div className="text-xl font-black">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* COMMON EQUIPMENT SECTION (Shown once at the top if comprehensive, or as part of scenario if individual) */}
                    {(type === 'comprehensive' || scenariosToRender.length === 1) && (
                        <div className="mb-10">
                            <div className="bg-slate-900 text-white px-8 py-3 rounded-xl mb-6">
                                <h2 className="text-xl font-black uppercase tracking-widest">{type === 'comprehensive' ? t('p5.compReport') : `Scenario: ${type.toUpperCase()}`}</h2>
                            </div>

                            <div className="grid grid-cols-3 gap-6 mb-8">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Wellbore Summary</h4>
                                    <div className="space-y-2 text-sm font-bold">
                                        <div className="flex justify-between"><span>{t('sens.pumpDepth')}:</span><span>{params.pressures.pumpDepthMD} ft</span></div>
                                        <div className="flex justify-between"><span>{t('sens.pStatic')}:</span><span>{params.inflow.pStatic} psi</span></div>
                                        <div className="flex justify-between"><span>{t('p3.pi')}:</span><span>{params.inflow.ip} bpd/psi</span></div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">{t('p5.equipSpec')}</h4>
                                    <div className="space-y-2 text-sm font-bold">
                                        <div className="flex justify-between"><span>{t('p5.pump')}:</span><span className="truncate ml-2">{pump?.model || '-'}</span></div>
                                        <div className="flex justify-between"><span>{t('p5.bodies')}:</span><span>{pump?.housingCount || 1}</span></div>
                                        <div className="flex justify-between"><span>{t('p5.motor')}:</span><span>{motor?.hp || params.motorHp} HP</span></div>
                                        <div className="flex justify-between"><span>{t('p2.mixture')}:</span><span>{cable?.awg || '-'} AWG</span></div>
                                        <div className="flex justify-between"><span>VSD:</span><span className="truncate ml-2">{(params as any).selectedVSD?.model || 'N/A'}</span></div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">{t('p5.designTarget')}</h4>
                                    <div className="space-y-2 text-sm font-bold">
                                        <div className="flex justify-between"><span>{t('p5.targetFlow')}:</span><span>{params.targets[params.activeScenario].rate} BPD</span></div>
                                        <div className="flex justify-between"><span>{t('p5.freq')}:</span><span>{params.targets[params.activeScenario].frequency} Hz</span></div>
                                        <div className="flex justify-between"><span>{t('p2.waterCut')}:</span><span>{params.fluids.waterCut}%</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* SINGLE BHA SCHEMATIC FOR THE REPORT */}
                            <div className="border-2 border-slate-900 rounded-2xl bg-[#020617] overflow-hidden mb-10 h-[650px] relative">
                                <h4 className="bg-slate-900 text-white text-[12px] font-black uppercase px-6 py-3 tracking-widest flex items-center gap-2">
                                    <Layers className="w-5 h-5" /> SCHEMATIC (DESIGN CONFIGURATION)
                                </h4>
                                <div className="absolute inset-0 pt-12 flex justify-center">
                                    <VisualESPStack
                                        pump={pump}
                                        motor={motor}
                                        results={results}
                                        params={params}
                                        cable={cable}
                                        frequency={params.targets[params.activeScenario].frequency}
                                        selectedVSD={(params as any).selectedVSD}
                                        mode="report"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SCENARIO SPECIFIC DATA */}
                    {scenariosToRender.map((scenarioId, sIdx) => {
                        const sFreq = params.targets[scenarioId as keyof typeof params.targets].frequency;
                        if (!pump) return null;
                        const sRes = calculateSystemResults(params.targets[scenarioId as keyof typeof params.targets].rate, 0, params, pump, sFreq);
                        const sVsdData = generateMultiFrequencyTable(pump, params, sFreq);

                        return (
                            <div key={scenarioId} className={sIdx > 0 ? "page-break pt-10" : "mt-10"}>
                                <div className="bg-slate-900 text-white px-8 py-3 rounded-xl mb-6 flex justify-between items-center">
                                    <h2 className="text-lg font-black uppercase tracking-widest">Case: {scenarioId.toUpperCase()} Performance</h2>
                                    <span className="text-blue-400 font-bold font-mono">{params.targets[scenarioId as keyof typeof params.targets].rate} BPD @ {sFreq} Hz</span>
                                </div>

                                <div className="grid grid-cols-2 gap-8 mb-8">
                                    <div className="flex flex-col border-2 border-slate-900 rounded-2xl bg-white overflow-hidden shadow-sm">
                                        <h4 className="bg-slate-900 text-white text-[10px] font-black uppercase px-4 py-2 tracking-widest">
                                            {t('p5.perfCurve')} @ {sFreq} Hz
                                        </h4>
                                        <div className="chart-container-report p-2">
                                            <PumpChart
                                                data={generateMultiCurveData(pump, params, sFreq)}
                                                pump={pump}
                                                currentFrequency={sFreq}
                                                intersectionPoint={{ flow: sRes.flow, head: sRes.tdh }}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                                        <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Operating Results</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { label: t('kpi.activeProd'), val: sRes.flow?.toLocaleString(), unit: 'BPD' },
                                                { label: t('sens.tdh'), val: sRes.tdh?.toLocaleString(), unit: 'FT' },
                                                { label: 'PIP', val: sRes.pip?.toFixed(0), unit: 'PSI' },
                                                { label: t('sens.amps'), val: sRes.electrical?.amps?.toFixed(1), unit: 'A' },
                                                { label: t('sens.kw'), val: sRes.electrical?.kw?.toFixed(1), unit: 'kW' },
                                                { label: t('p5.motorLoad'), val: sRes.motorLoad?.toFixed(1), unit: '%' },
                                                { label: t('p5.efficiency'), val: sRes.effEstimated?.toFixed(1), unit: '%' },
                                                { label: t('sens.pwf'), val: sRes.pwf?.toFixed(0), unit: 'PSI' },
                                            ].map((kpi, k) => (
                                                <div key={k} className="flex justify-between border-b border-slate-200 pb-1 text-sm">
                                                    <span className="font-bold text-slate-500 uppercase text-[10px]">{kpi.label}</span>
                                                    <span className="font-black text-slate-900">{kpi.val} <span className="text-[10px] opacity-60">{kpi.unit}</span></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* VSD TABLE FOR THIS SCENARIO */}
                                <div className="mb-8">
                                    <h4 className="font-black text-xs uppercase tracking-wider text-white bg-slate-900 px-4 py-2 rounded-t-xl inline-block">{t('p5.vsdAnalysis')}</h4>
                                    <div className="border-2 border-slate-900 rounded-b-xl rounded-tr-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-[9px] text-left">
                                            <thead className="bg-slate-100 text-slate-600 uppercase font-black">
                                                <tr>
                                                    <th className="py-2 px-3 border-r border-slate-200">{t('p6.param')}</th>
                                                    <th className="py-2 px-2 border-r border-slate-200 text-center">Unit</th>
                                                    {sVsdData.map(col => (
                                                        <th key={col.hz} className={`py-2 px-2 border-r border-slate-200 text-right ${Math.abs(col.hz - sFreq) < 0.1 ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                            {col.hz} Hz
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 font-bold">
                                                {rowDefinitions.map((row, i) => (
                                                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                                        <td className="py-1 px-3 text-slate-700 border-r border-slate-200 uppercase">{row.label}</td>
                                                        <td className="py-1 px-2 text-center text-slate-400 border-r border-slate-200 uppercase">{row.unit}</td>
                                                        {sVsdData.map(col => {
                                                            const val = col[row.key as keyof typeof col];
                                                            const isMatch = Math.abs(col.hz - sFreq) < 0.1;
                                                            return (
                                                                <td key={col.hz} className={`py-1 px-2 text-right font-mono border-r border-slate-200 ${isMatch ? 'bg-blue-50 text-slate-900' : 'text-slate-600'}`}>
                                                                    {row.fmt(val as number)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {/* RE-INSERTED: WELL SYSTEM CURVE DETAIL */}
                                <div className="mt-8 break-inside-avoid">
                                    <h4 className="flex items-center gap-2 text-[12px] font-black uppercase text-slate-900 border-b-2 border-slate-900 pb-1 mb-4">
                                        <Layers className="w-4 h-4" /> {t('p5.wellSysCurve')}
                                    </h4>
                                    <div className="overflow-hidden rounded-lg border-2 border-slate-900">
                                        <table className="w-full text-[10px] text-left">
                                            <thead className="bg-slate-900 text-white uppercase font-black">
                                                <tr>
                                                    <th className="px-3 py-2">{t('p5.point')}</th>
                                                    <th className="px-3 py-2 text-right">{t('p5.tubingHead')} (ft)</th>
                                                    <th className="px-3 py-2 text-right">{t('p5.pipHead')} (ft)</th>
                                                    <th className="px-3 py-2 text-right">{t('sens.tdh')} (ft)</th>
                                                    <th className="px-3 py-2 text-right">{t('p5.surfRate')} (BPD)</th>
                                                    <th className="px-3 py-2 text-right">{t('p5.pumpRate')} (BPD)</th>
                                                    <th className="px-3 py-2 text-right">{t('p5.fluidLevel')} (ft)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-bold">
                                                {(sRes.systemCurveData || []).map((pt: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-3 py-1.5 text-slate-400">{pt.point}</td>
                                                        <td className="px-3 py-1.5 text-right">{f0(pt.tubingHead)}</td>
                                                        <td className="px-3 py-1.5 text-right">{f0(pt.pipHead)}</td>
                                                        <td className="px-3 py-1.5 text-right">{f0(pt.tdh)}</td>
                                                        <td className="px-3 py-1.5 text-right text-blue-600">{f0(pt.rateSurface)}</td>
                                                        <td className="px-3 py-1.5 text-right text-slate-500">{f0(pt.ratePump)}</td>
                                                        <td className="px-3 py-1.5 text-right">{f0(pt.fluidLevel)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-blue-100 border-t-2 border-blue-900">
                                                    <td className="px-3 py-2 text-blue-900 font-black">{t('p5.design')}</td>
                                                    <td className="px-3 py-2 text-right text-blue-900 font-black">{f0(sRes.tdh + sRes.pip / 0.433)}</td>
                                                    <td className="px-3 py-2 text-right text-blue-900 font-black">{f0(sRes.pip / 0.433)}</td>
                                                    <td className="px-3 py-2 text-right text-blue-900 font-black">{f0(sRes.tdh)}</td>
                                                    <td className="px-3 py-2 text-right text-blue-900 font-black">{f0(sRes.flow)}</td>
                                                    <td className="px-3 py-2 text-right text-blue-900 font-black">{f0(sRes.nodalPerformance?.intake?.totalLiquidRate + sRes.nodalPerformance?.intake?.gasRate)}</td>
                                                    <td className="px-3 py-2 text-right text-blue-900 font-black">{f0(sRes.fluidLevel)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* RE-INSERTED: THEORETICAL PUMP PERFORMANCE (NODAL) */}
                                <div className="mt-8 break-inside-avoid">
                                    <h4 className="flex items-center gap-2 text-[12px] font-black uppercase text-slate-900 border-b-2 border-slate-900 pb-1 mb-4">
                                        <Activity className="w-4 h-4" /> {t('p5.theoPerf')}
                                    </h4>
                                    <div className="overflow-hidden rounded-lg border-2 border-slate-900">
                                        <table className="w-full text-[10px] text-right font-bold">
                                            <thead className="bg-slate-900 text-white uppercase font-black">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-blue-100 uppercase tracking-tighter">{t('p5.desc')}</th>
                                                    <th className="px-3 py-2">{t('p5.intake')}</th>
                                                    <th className="px-3 py-2">{t('p5.discharge')}</th>
                                                    <th className="px-3 py-2">{t('p5.surface')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 italic">
                                                {[
                                                    { label: 'Oil Rate, Bbl/D', key: 'oilRate', intake: sRes.nodalPerformance?.intake?.oilRate, discharge: sRes.nodalPerformance?.discharge?.oilRate, surface: sRes.nodalPerformance?.surface?.oilRate },
                                                    { label: 'In-situ Gas Rate Through Pump, Bbl/D', key: 'gasRate', intake: sRes.nodalPerformance?.intake?.gasRate, discharge: sRes.nodalPerformance?.discharge?.gasRate, surface: 0 },
                                                    { label: 'Free Gas Percent, %', key: 'freeGasPct', intake: sRes.nodalPerformance?.intake?.freeGasPct, discharge: sRes.nodalPerformance?.discharge?.freeGasPct, surface: 0 },
                                                    { label: 'Water Rate, Bbl/D', key: 'waterRate', intake: sRes.nodalPerformance?.intake?.waterRate, discharge: sRes.nodalPerformance?.discharge?.waterRate, surface: sRes.nodalPerformance?.surface?.waterRate },
                                                    { label: 'Total Liquid Rate, Bbl/D', key: 'totalLiquidRate', intake: sRes.nodalPerformance?.intake?.totalLiquidRate, discharge: sRes.nodalPerformance?.discharge?.totalLiquidRate, surface: sRes.nodalPerformance?.surface?.totalLiquidRate },
                                                    { label: 'Pressure, psig', key: 'pressure', intake: sRes.nodalPerformance?.intake?.pressure, discharge: sRes.nodalPerformance?.discharge?.pressure, surface: sRes.nodalPerformance?.surface?.pressure },
                                                    { label: 'Specific Gravity Liquid, wtr=1', key: 'sgLiquid', intake: sRes.nodalPerformance?.intake?.sgLiquid, discharge: sRes.nodalPerformance?.discharge?.sgLiquid, surface: sRes.nodalPerformance?.surface?.sgLiquid },
                                                    { label: 'Specific Gravity Mixture, wtr=1', key: 'sgMixture', intake: sRes.nodalPerformance?.intake?.sgMixture, discharge: sRes.nodalPerformance?.discharge?.sgMixture, surface: sRes.nodalPerformance?.surface?.sgMixture },
                                                    { label: 'Liquid Density, lb/cf', key: 'densityLiquid', intake: sRes.nodalPerformance?.intake?.densityLiquid, discharge: sRes.nodalPerformance?.discharge?.densityLiquid, surface: sRes.nodalPerformance?.surface?.densityLiquid },
                                                    { label: 'Mixture Density, lb/cf', key: 'densityMixture', intake: sRes.nodalPerformance?.intake?.densityMixture, discharge: sRes.nodalPerformance?.discharge?.densityMixture, surface: sRes.nodalPerformance?.surface?.densityMixture },
                                                    { label: 'Solution GOR, scf/bbl', key: 'solGor', intake: sRes.nodalPerformance?.intake?.solGor, discharge: sRes.nodalPerformance?.discharge?.solGor, surface: sRes.nodalPerformance?.surface?.solGor },
                                                    { label: 'Solution GWR, scf/bbl', key: 'solGwr', intake: sRes.nodalPerformance?.intake?.solGwr, discharge: sRes.nodalPerformance?.discharge?.solGwr, surface: sRes.nodalPerformance?.surface?.solGwr },
                                                    { label: 'Liquid FVF, res/surf', key: 'fvfLiquid', intake: sRes.nodalPerformance?.intake?.fvfLiquid, discharge: sRes.nodalPerformance?.discharge?.fvfLiquid, surface: sRes.nodalPerformance?.surface?.fvfLiquid },
                                                    { label: 'Mixture FVF, res/surf', key: 'fvfMixture', intake: sRes.nodalPerformance?.intake?.fvfMixture, discharge: sRes.nodalPerformance?.discharge?.fvfMixture, surface: sRes.nodalPerformance?.surface?.fvfMixture },
                                                    { label: 'Gas Deviation Factor (Z)', key: 'zFactor', intake: sRes.nodalPerformance?.intake?.zFactor, discharge: sRes.nodalPerformance?.discharge?.zFactor, surface: sRes.nodalPerformance?.surface?.zFactor },
                                                ].map((row, r) => (
                                                    <tr key={r} className="hover:bg-slate-50">
                                                        <td className="px-3 py-1 text-left bg-slate-50/50 text-slate-500 uppercase text-[9px] font-black leading-tight border-r border-slate-100">{row.label}</td>
                                                        <td className="px-3 py-1 font-mono">{row.intake !== undefined ? f1(row.intake) : '-'}</td>
                                                        <td className="px-3 py-1 font-mono">{row.discharge !== undefined ? f1(row.discharge) : '-'}</td>
                                                        <td className="px-3 py-1 font-mono bg-slate-50/30">{row.surface !== undefined ? f1(row.surface) : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="text-[9px] font-bold text-slate-400 italic text-right mb-10">Calculations based on {scenarioId.toUpperCase()} scenario parameters.</div>
                            </div>
                        );
                    })}

                    {/* AI ANALYSIS SECTION */}
                    <div className="page-break pt-10">
                        <div className="bg-slate-900 text-white px-8 py-3 rounded-xl mb-6 flex items-center gap-3">
                            <Sparkles className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-black uppercase tracking-widest">AI Design Analysis & Recommendations</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm flex items-center gap-2">
                                    <Target className="w-4 h-4 text-blue-500" /> Operational Range Analysis
                                </h4>
                                <p className="text-sm leading-relaxed text-slate-600 font-medium">
                                    The selected ESP configuration ({pump?.model}) shows a highly viable operational range between {params.targets.min.frequency}Hz and {params.targets.max.frequency}Hz.
                                    The "Target" efficiency is optimized at {results?.effEstimated?.toFixed(1)}%, with the operating point sitting within {Math.abs(((results?.flow || 0) - (pump?.bepRate || 0)) / (pump?.bepRate || 1) * 100).toFixed(1)}% of the Best Efficiency Point (BEP).
                                </p>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                    <div className="flex justify-between text-xs font-black uppercase mb-1"><span>Recommended Min</span><span className="text-blue-500">{params.targets.min.rate} BPD</span></div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: '30%' }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-500" /> Maintenance & Life-Cycle
                                </h4>
                                <ul className="text-sm space-y-2 text-slate-600 font-medium">
                                    <li className="flex gap-2"><span>•</span> <span>Winding temperature is predicted at {(params.bottomholeTemp + (results?.motorLoad || 0) * 0.8).toFixed(0)}°F, which is well within the {motor?.voltage || 1000}V class insulation limits.</span></li>
                                    <li className="flex gap-2"><span>•</span> <span>Gas management strategy Recommended: {results?.nodalPerformance?.intake?.freeGasPct > 15 ? "Gas Separator Required" : "Standard Intake Sufficient"}.</span></li>
                                    <li className="flex gap-2"><span>•</span> <span>Predicted drawdown of {(params.inflow.pStatic - (results?.pwf || 0)).toFixed(0)} PSI indicates stable reservoir response.</span></li>
                                </ul>
                            </div>
                        </div>

                        <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl">
                            <h4 className="font-black text-blue-900 uppercase text-xs mb-3">Expert Design Summary</h4>
                            <p className="text-sm text-blue-800 font-bold italic leading-relaxed">
                                "The design is robust for the specified conditions. We recommend starting production at {params.targets.min.frequency}Hz to monitor initial drawdown before ramping up to the {params.targets.target.frequency}Hz target point. Ensure high-frequency monitoring of motor vibration if operating above 65Hz."
                            </p>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-slate-200 text-center no-print">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Generated by ESP Designer AI Engine • Technical Support: support@esp-studio.ai</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- AI SOURCE MODAL ---
interface AISourceModalProps { isOpen: boolean; onClose: () => void; onSelectSource: (source: 'standard' | 'imported') => void; }
const AISourceModal: React.FC<AISourceModalProps> = ({ isOpen, onClose, onSelectSource }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-canvas/60 backdrop-blur-xl p-4 animate-fadeIn">
            <div className="glass-surface p-12 rounded-[3.5rem] max-w-xl w-full shadow-2xl border border-white/10 space-y-10 relative overflow-hidden light-sweep">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>

                <div className="text-center space-y-4 relative z-10">
                    <div className="w-24 h-24 glass-surface-light rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-white/5 shadow-2xl shadow-primary/20 relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
                        <Sparkles className="w-12 h-12 text-primary relative z-10 animate-float" />
                    </div>
                    <h3 className="text-4xl font-black text-txt-main uppercase tracking-tighter leading-none">{t('p5.aiEngine')}</h3>
                    <p className="text-txt-muted font-black uppercase tracking-[0.3em] text-[10px] opacity-60">{t('p5.selectSource')}</p>
                </div>

                <div className="grid grid-cols-2 gap-8 relative z-10">
                    <button onClick={() => onSelectSource('standard')} className="glass-surface-light hover:bg-white/5 border border-white/5 hover:border-primary/40 p-10 rounded-[2.5rem] flex flex-col items-center gap-5 transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-primary/0 group-hover:bg-primary/40 transition-all"></div>
                        <Server className="w-12 h-12 text-txt-muted group-hover:text-primary transition-all duration-500 group-hover:scale-110" />
                        <span className="text-[11px] font-black uppercase text-txt-muted group-hover:text-txt-main tracking-widest transition-all">{t('p5.standard')}</span>
                    </button>
                    <button onClick={() => onSelectSource('imported')} className="glass-surface-light hover:bg-white/5 border border-white/5 hover:border-secondary/40 p-10 rounded-[2.5rem] flex flex-col items-center gap-5 transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-secondary/0 group-hover:bg-secondary/40 transition-all"></div>
                        <UploadCloud className="w-12 h-12 text-txt-muted group-hover:text-secondary transition-all duration-500 group-hover:scale-110" />
                        <span className="text-[11px] font-black uppercase text-txt-muted group-hover:text-txt-main tracking-widest transition-all">{t('p5.imported')}</span>
                    </button>
                </div>

                <button onClick={onClose} className="w-full py-5 text-[10px] font-black text-txt-muted hover:text-txt-main transition-colors relative z-10 uppercase tracking-[0.5em] opacity-40 hover:opacity-100">{t('p5.cancel')}</button>
            </div>
        </div>
    );
};

// --- AI RECOMMENDATIONS MODAL ---
interface AIRecommendationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    recommendations: any[];
    onSelect: (rec: any) => void;
}
const AIRecommendationsModal: React.FC<AIRecommendationsModalProps> = ({ isOpen, onClose, recommendations, onSelect }) => {
    if (!isOpen || !recommendations.length) return null;
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-canvas/60 backdrop-blur-2xl p-4 animate-fadeIn">
            <div className="glass-surface border border-white/10 rounded-[3.5rem] max-w-4xl w-full shadow-2xl p-10 space-y-8 relative overflow-hidden light-sweep">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>

                <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-4 glass-surface-light rounded-[1.5rem] border border-white/5 shadow-glow-primary"><Sparkles className="w-8 h-8 text-primary" /></div>
                        <div>
                            <h3 className="text-2xl font-black text-txt-main uppercase tracking-tighter leading-none">AI CORE RECOMMENDATIONS</h3>
                            <p className="text-[10px] font-black text-txt-muted uppercase tracking-[0.3em] mt-2 opacity-60">OPTIMIZED HYDRAULIC CONFIGURATIONS (TOP 5)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 glass-surface-light hover:bg-white/10 rounded-2xl transition-all border border-white/5 active:scale-90 group">
                        <X className="w-6 h-6 text-txt-muted group-hover:text-txt-main" />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar relative z-10">
                    {recommendations.map((rec, i) => (
                        <button key={i} onClick={() => onSelect(rec)} className="w-full glass-surface-light hover:bg-white/5 border border-white/5 hover:border-primary/40 p-6 rounded-[2.5rem] flex items-center gap-8 transition-all duration-500 group relative overflow-hidden text-left">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:translate-x-0 translate-x-4"><ChevronRight className="w-6 h-6 text-primary shadow-glow-primary" /></div>

                            <div className="w-1/2 flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20">{rec.pump.manufacturer}</div>
                                    {rec.isMostUsed && <div className="bg-white/5 text-txt-main text-[8px] font-black px-2 py-1 rounded-full border border-white/10 uppercase tracking-widest flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /> TOP INVENTORY</div>}
                                </div>
                                <div className="text-2xl font-black text-txt-main uppercase tracking-tighter leading-tight group-hover:text-primary transition-colors">{rec.pump.model}</div>
                                <div className="flex gap-4 items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">STAGES</span>
                                        <span className="text-xs font-black text-txt-main font-mono">{rec.stages}</span>
                                    </div>
                                    <div className="w-[1px] h-6 bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">MOTOR</span>
                                        <span className="text-xs font-black text-txt-main font-mono">{rec.motor.hp} HP</span>
                                    </div>
                                    <div className="w-[1px] h-6 bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">BHP</span>
                                        <span className="text-xs font-black text-secondary font-mono">{Math.round(rec.bhp)}</span>
                                    </div>
                                    <div className="w-[1px] h-6 bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">AMPS</span>
                                        <span className="text-xs font-black text-primary font-mono">{rec.amps?.toFixed(1)}</span>
                                    </div>
                                    <div className="w-[1px] h-6 bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">kW</span>
                                        <span className="text-xs font-black text-txt-main font-mono">{rec.kw?.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 space-y-4 border-l border-white/5 pl-8">
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1 opacity-60">OP RANGE (BPD)</span>
                                        <span className="text-sm font-black text-txt-main font-mono tracking-tighter">{Math.round(rec.pump.minRate)} <span className="opacity-30 text-[10px]">TO</span> {Math.round(rec.pump.maxRate)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest block mb-1">MATCH SCORE</span>
                                        <span className="text-xl font-black text-txt-main font-mono">{Math.round(rec.score)}%</span>
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-[1px]"></div>
                                    <div className="h-full bg-gradient-to-r from-primary to-secondary relative z-10 shadow-glow-primary" style={{ width: `${Math.min(100, rec.score)}%` }}></div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="flex justify-between items-center opacity-40 px-2 relative z-10">
                    <p className="text-[9px] font-black text-txt-muted uppercase tracking-[0.4em]">ESP DESIGNER ANALYTIC ENGINE v2.0</p>
                    <div className="flex gap-4">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Phase5: React.FC<Phase5Props> = ({ params, setParams, customPump, setCustomPump, pumpCatalog, motorCatalog, setShowPumpModal, curveData, match, results, onCompare, onReloadCatalog }) => {
    const { t } = useLanguage();
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiRecommendations, setAIRecommendations] = useState<any[]>([]);
    const [showAIRecommendations, setShowAIRecommendations] = useState(false);
    const [showReportSelector, setShowReportSelector] = useState(false);
    const [reportConfig, setReportConfig] = useState<any>({ isOpen: false, type: 'target' });

    const [activeChart, setActiveChart] = useState<'pump' | 'multi' | 'motor'>('pump');
    const [viewMode, setViewMode] = useState<'analytics' | 'table'>('analytics');
    const [isTableMaximized, setIsTableMaximized] = useState(false);

    // --- DERATING STATE ---
    const [derating, setDerating] = useState({ head: 1.0, power: 1.0, eff: 1.0 });
    const resetDerating = () => setDerating({ head: 1.0, power: 1.0, eff: 1.0 });

    // --- EFFECTIVE PUMP (Applying Derating) ---
    const effectivePump = useMemo(() => {
        if (!customPump) return null;
        if (derating.head === 1 && derating.power === 1 && derating.eff === 1) return customPump;
        return {
            ...customPump,
            h0: (customPump.h0 || 0) * derating.head, h1: (customPump.h1 || 0) * derating.head, h2: (customPump.h2 || 0) * derating.head, h3: (customPump.h3 || 0) * derating.head, h4: (customPump.h4 || 0) * derating.head, h5: (customPump.h5 || 0) * derating.head, h6: (customPump.h6 || 0) * derating.head,
            p0: (customPump.p0 || 0) * derating.power, p1: (customPump.p1 || 0) * derating.power, p2: (customPump.p2 || 0) * derating.power, p3: (customPump.p3 || 0) * derating.power, p4: (customPump.p4 || 0) * derating.power, p5: (customPump.p5 || 0) * derating.power, p6: (customPump.p6 || 0) * derating.power,
            maxEfficiency: (customPump.maxEfficiency || 0) * derating.eff
        };
    }, [customPump, derating]);

    // --- COLLAPSIBLE SECTIONS STATE ---
    const [openSections, setOpenSections] = useState({
        bhaComponents: false,
        pumps: true,
        motors: false,
        cables: false,
        vsd: false,
        vsdTable: true,
        equipped: true,
        visualStack: true,
        derating: false
    });

    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // --- SEARCH & FILTER STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSeries, setFilterSeries] = useState<string>('ALL');
    const [filterManuf, setFilterManuf] = useState<string>('ALL');
    const [showViableOnly, setShowViableOnly] = useState(false);
    const [motorSearch, setMotorSearch] = useState('');
    const [motorFilterSeries, setMotorFilterSeries] = useState<string>('ALL');
    const [motorFilterManuf, setMotorFilterManuf] = useState<string>('ALL');
    const [cableSearch, setCableSearch] = useState('');
    const [vsdSearch, setVsdSearch] = useState('');

    const frequency = params.targets[params.activeScenario].frequency || 60;
    const reqTdh = calculateTDH(params.pressures.totalRate, params);
    const targetFlow = params.pressures.totalRate;

    // RE-CALC MATCH & RESULTS based on EFFECTIVE PUMP
    const effectiveCurveData = useMemo(() => effectivePump ? generateMultiCurveData(effectivePump, params, frequency) : [], [effectivePump, params, frequency]);
    const effectiveMatch = useMemo(() => findIntersection(effectiveCurveData), [effectiveCurveData]);

    // --- VIRTUAL OPERATING POINT LOGIC ---
    const activeFlow = effectiveMatch?.flow ?? (targetFlow > 0 ? targetFlow : 0);
    const activeHead = useMemo(() => {
        if (effectiveMatch?.head) return effectiveMatch.head;
        if (effectivePump && activeFlow > 0) {
            const baseFreq = effectivePump.nameplateFrequency || 60;
            const flowBase = activeFlow * (baseFreq / frequency);
            const headBase = calculateBaseHead(flowBase, effectivePump);
            return headBase * Math.pow(frequency / baseFreq, 2);
        }
        return 0;
    }, [effectiveMatch, effectivePump, activeFlow, frequency]);

    const activeResults = useMemo(() => {
        if (activeFlow >= 0 && effectivePump) {
            return calculateSystemResults(activeFlow, activeHead, params, effectivePump, frequency);
        }
        return results;
    }, [effectiveMatch, results, activeFlow, activeHead, params, effectivePump, frequency]);

    const isFlowTargetMet = targetFlow > 0 ? Math.abs(activeFlow - targetFlow) / targetFlow < 0.025 : true;
    const isHeadTargetMet = reqTdh > 0 ? Math.abs((activeHead || 0) - reqTdh) / reqTdh < 0.025 : true;
    const gasStatus = activeResults?.gasAnalysis?.status || 'Stable';
    const gasVoid = activeResults?.gasAnalysis?.voidFraction || 0;
    const isGasCritical = gasStatus !== 'Stable';

    // --- CALCULATE MULTI-FREQUENCY DATA FOR UI TABLE (LIVE) ---
    const vsdTableData = useMemo(() => {
        if (!effectivePump) return [];
        const currentHz = params.targets[params.activeScenario].frequency;
        return generateMultiFrequencyTable(effectivePump, params, currentHz);
    }, [effectivePump, params, params.selectedMotor]);

    const rowDefinitions = [
        { label: "Freq", key: 'hz', unit: 'Hz', fmt: (n: number) => n.toFixed(1) },
        { label: "RPM", key: 'rpm', unit: 'rpm', fmt: (n: number) => f0(n) },
        { label: "BFPD", key: 'flow', unit: 'bpd', fmt: (n: number) => f0(n) },
        { label: "TDH", key: 'tdh', unit: 'ft', fmt: (n: number) => f0(n) },
        { label: "PDP", key: 'pdp', unit: 'psi', fmt: (n: number) => f0(n) },
        { label: "PIP", key: 'pip', unit: 'psi', fmt: (n: number) => f0(n) },
        { label: "Submerg", key: 'submergence', unit: 'ft', fmt: (n: number) => f0(n) },
        { label: "Amps", key: 'amps', unit: 'A', fmt: (n: number) => f1(n) },
        { label: "Volts", key: 'volts', unit: 'V', fmt: (n: number) => f0(n) },
        { label: "Power", key: 'kw', unit: 'kW', fmt: (n: number) => f1(n) },
        { label: "Eff (%)", key: 'pumpEff', unit: '%', fmt: (n: number) => f1(n) },
        { label: "Motor Load", key: 'motorLoad', unit: '%', fmt: (n: number) => f0(n) },
        { label: "Shaft Load", key: 'pumpShaftLoad', unit: '%', fmt: (n: number) => f0(n) },
        { label: "Intake Gas", key: 'gasVoid', unit: '%', fmt: (n: number) => f1(n) },
        { label: "Cooling", key: 'vel', unit: 'ft/s', fmt: (n: number) => f1(n) },
        { label: "Motor T", key: 'motorT', unit: '°F', fmt: (n: number) => f0(n) },
    ];

    const updateFrequency = (val: number) => {
        // Permitimos un rango más amplio (0-120 Hz) para dar flexibilidad total al ingeniero
        const safeVal = isNaN(val) ? 60 : Math.min(120, Math.max(0, val));
        setParams((prev: SystemParams) => ({ 
            ...prev, 
            targets: { 
                ...prev.targets, 
                [prev.activeScenario]: { ...prev.targets[prev.activeScenario], frequency: safeVal } 
            } 
        }));
    };
    const switchScenario = (scen: 'min' | 'target' | 'max') => {
        const data = params.targets[scen];
        setParams((prev: SystemParams) => ({ ...prev, activeScenario: scen, pressures: { ...prev.pressures, totalRate: data.rate }, inflow: { ...prev.inflow, ip: data.ip }, fluids: { ...prev.fluids, waterCut: data.waterCut, gor: data.gor, glr: data.gor * (1 - data.waterCut / 100) } }));
    };

    // --- SMART CATALOG PROCESSING ---
    const activePumpList = pumpCatalog;
    const activeMotorList = motorCatalog;

    const uniqueSeries = useMemo(() => Array.from(new Set(activePumpList.map(p => p.series))).sort(), [activePumpList]);
    const uniqueManuf = useMemo(() => Array.from(new Set(activePumpList.map(p => p.manufacturer))).sort(), [activePumpList]);

    const uniqueMotorSeries = useMemo(() => Array.from(new Set(activeMotorList.map(m => m.series))).sort(), [activeMotorList]);
    const uniqueMotorManuf = useMemo(() => Array.from(new Set(activeMotorList.map(m => m.manufacturer))).sort(), [activeMotorList]);

    const groupedPumps = useMemo(() => {
        let filtered = activePumpList.filter(p => {
            if (!p || !p.id) return false;
            const search = searchQuery.toLowerCase();
            if (search && !p.model.toLowerCase().includes(search) && !p.manufacturer.toLowerCase().includes(search)) return false;
            if (filterSeries !== 'ALL' && p.series !== filterSeries) return false;
            if (filterManuf !== 'ALL' && p.manufacturer !== filterManuf) return false;
            return true;
        });
        const processed = filtered.map(pump => {
            const baseFreq = pump.nameplateFrequency || 60;
            const minLimit = pump.minRate * (40 / baseFreq);
            const maxLimit = pump.maxRate * (70 / baseFreq);
            const hasLimits = pump.minRate > 0 || pump.maxRate > 0;
            const isViable = hasLimits ? (targetFlow >= minLimit && targetFlow <= maxLimit) : true;
            
            const effectiveFlow = targetFlow > 0 ? targetFlow : pump.bepRate;
            const effectiveTDH = reqTdh > 0 ? reqTdh : (params.pressures.pumpDepthMD || 5000) * 0.433;
            const hBase = calculateBaseHead(effectiveFlow / (60 / baseFreq), pump);
            let reqStages = 0;
            if (hBase > 0) reqStages = Math.ceil(effectiveTDH / hBase);
            return { pump, isViable: targetFlow > 0 ? isViable : true, minCap: minLimit, maxCap: maxLimit, reqStages };
        });
        const finalFilter = (showViableOnly && targetFlow > 0) ? processed.filter(i => i.isViable) : processed;
        const sorted = finalFilter.sort((a, b) => { if (a.isViable && !b.isViable) return -1; if (!a.isViable && b.isViable) return 1; if (a.pump.series !== b.pump.series) return a.pump.series.localeCompare(b.pump.series); return a.pump.model.localeCompare(b.pump.model); });
        const groups: Record<string, typeof sorted> = {};
        sorted.forEach(item => { const s = item.pump.series || "Other"; if (!groups[s]) groups[s] = []; groups[s].push(item); });
        return groups;
    }, [activePumpList, searchQuery, filterSeries, filterManuf, showViableOnly, targetFlow, params, reqTdh]);

    const processedMotors = useMemo(() => {
        let filtered = activeMotorList.filter(m => {
            if (!m || !m.id) return false;
            const s = motorSearch.toLowerCase();
            if (s && !m.model.toLowerCase().includes(s) && !m.manufacturer.toLowerCase().includes(s) && !m.hp.toString().includes(s)) return false;
            if (motorFilterSeries !== 'ALL' && m.series !== motorFilterSeries) return false;
            if (motorFilterManuf !== 'ALL' && m.manufacturer !== motorFilterManuf) return false;
            return true;
        });

        const reqHp = activeResults.requiredMotorHp || 0;
        return filtered.map(m => ({
            motor: m,
            isFit: reqHp > 0 ? (m.hp >= reqHp) : true,
            isUnder: m.hp < reqHp
        })).sort((a, b) => a.motor.hp - b.motor.hp);
    }, [activeMotorList, motorSearch, motorFilterSeries, motorFilterManuf, activeResults.requiredMotorHp]);

    const processedCables = useMemo(() => {
        let filtered = CABLE_CATALOG;
        if (cableSearch) { const s = cableSearch.toLowerCase(); filtered = filtered.filter(c => c.model.toLowerCase().includes(s) || c.awg.toLowerCase().includes(s)); }
        return filtered;
    }, [cableSearch]);

    // --- VSD PROCESSING ---
    const processedVSDs = useMemo(() => {
        const reqKva = activeResults?.electrical?.kva || (params.motorHp * 0.7457 / 0.9);
        const filtered = VSD_CATALOG.filter(v => {
            if (!vsdSearch) return true;
            const s = vsdSearch.toLowerCase();
            return v.model.toLowerCase().includes(s) || v.manufacturer.toLowerCase().includes(s) || v.brand.toLowerCase().includes(s);
        });
        return filtered.map(v => {
            const safetyFactor = 1.25;
            const isFit = reqKva > 0 ? (v.kvaRating >= reqKva * safetyFactor && v.kvaRating <= reqKva * safetyFactor * 4) : true;
            const isUnder = reqKva > 0 && v.kvaRating < reqKva * safetyFactor;
            const margin = reqKva > 0 ? ((v.kvaRating / (reqKva * safetyFactor) - 1) * 100) : null;
            return { vsd: v, isFit, isUnder, margin };
        }).sort((a, b) => a.vsd.kvaRating - b.vsd.kvaRating);
    }, [vsdSearch, activeResults, params.motorHp]);

    const handleVSDSelect = (vsd: EspVSD) => {
        setParams(p => ({ ...p, selectedVSD: vsd }));
        setOpenSections(prev => ({ ...prev, vsd: false }));
    };

    const handleManualSelect = (item: any) => {
        let flowToUse = params.pressures.totalRate;
        let updateFlow = false;
        if (flowToUse <= 0) { flowToUse = item.pump.bepRate; updateFlow = true; }
        const newStages = item.reqStages > 0 ? item.reqStages : 100;
        const bodies = Math.ceil(newStages / (item.pump.maxStages || 100));
        const tempPump = { ...item.pump, stages: newStages, housingCount: bodies };
        const tdhToUse = reqTdh > 0 ? reqTdh : (params.pressures.pumpDepthMD || 5000) * 0.433;
        const res = calculateSystemResults(flowToUse, tdhToUse, params, tempPump, 60);
        const reqHp = res.hpTotal * 1.15;
        const validSourceCatalog = activeMotorList.filter(m => m && m.id);
        const motor = validSourceCatalog.find(m => m.hp >= reqHp) || validSourceCatalog[validSourceCatalog.length - 1];
        setCustomPump(tempPump); updateFrequency(60);
        setParams(p => ({ ...p, motorHp: motor?.hp || p.motorHp, selectedMotor: motor, pressures: updateFlow ? { ...p.pressures, totalRate: flowToUse } : p.pressures }));
        setOpenSections(prev => ({ ...prev, motors: true }));
    };

    const handleMotorSelect = (motor: EspMotor) => { setParams(p => ({ ...p, motorHp: motor.hp, selectedMotor: motor })); setOpenSections(prev => ({ ...prev, cables: true })); };
    const handleCableSelect = (cable: EspCable) => { setParams(p => ({ ...p, selectedCable: cable })); };
    const runAIOptimization = (source: 'standard' | 'imported') => {
        setShowAIModal(false);
        const catalog = source === 'standard' ? STANDARD_PUMPS : pumpCatalog;
        if (!catalog.length) return;

        const results = runAISelection(
            catalog,
            activeMotorList,
            CABLE_CATALOG,
            params,
            calculateSystemResults,
            calculateTDH
        );

        if (results && results.length > 0) {
            setAIRecommendations(results);
            setShowAIRecommendations(true);
        }
    };

    const handleExportJson = () => {
        const exportData = {
            type: 'esp-studio-project',
            version: '2.4',
            timestamp: new Date().toISOString(),
            data: {
                params: params,
                customPump: effectivePump || customPump || null,
                results: activeResults,
                frequency: frequency
            }
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const projectName = params.metadata.wellName || params.metadata.projectName || 'WELL';
        const pumpName = customPump?.model || 'PUMP';
        a.download = `${projectName.toUpperCase()}_${pumpName.toUpperCase()}_EXPORT.json`.replace(/\s+/g, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleApplyRecommendation = (rec: any) => {

        const { pump, stages, motor, cable } = rec;
        const bodies = Math.ceil(stages / (pump.maxStages || 100));
        const tempPump = { ...pump, stages, housingCount: bodies };

        setCustomPump(tempPump);
        updateFrequency(60);
        setParams(p => ({
            ...p,
            motorHp: motor?.hp || p.motorHp,
            selectedMotor: motor,
            selectedCable: cable || p.selectedCable
        }));

        setShowAIRecommendations(false);
        setOpenSections(prev => ({ ...prev, equipped: true }));
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-fadeIn pb-2 overflow-hidden px-1">
            <ReportSelectorModal isOpen={showReportSelector} onClose={() => setShowReportSelector(false)} onSelect={(type: string) => { setShowReportSelector(false); setReportConfig({ isOpen: true, type }); }} />
            <AISourceModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} onSelectSource={runAIOptimization} />
            <AIRecommendationsModal
                isOpen={showAIRecommendations}
                onClose={() => setShowAIRecommendations(false)}
                recommendations={aiRecommendations}
                onSelect={handleApplyRecommendation}
            />
            {reportConfig.isOpen && <DesignReport onClose={() => setReportConfig({ isOpen: false, type: 'target' })} type={reportConfig.type} params={params} pump={effectivePump} results={activeResults} frequency={frequency} motor={params.selectedMotor} cable={params.selectedCable} />}

            {/* HEADER */}
            <div className="flex justify-between items-center px-4 shrink-0 h-16 glass-surface rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute left-0 top-0 w-2 h-full bg-primary shadow-glow-primary"></div>
                <div className="flex items-center gap-5 relative z-10 pl-2">
                    <div className="p-3 bg-primary/20 rounded-2xl border border-white/10 shadow-glow-primary">
                        <Cpu className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-txt-main uppercase tracking-tighter leading-none">{t('p5.solver')}</h2>
                        <p className="text-[10px] text-txt-muted font-black uppercase tracking-[0.2em] mt-1.5 opacity-60">Technical Optimization Workspace</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 relative z-10 pr-2">
                    <button onClick={handleExportJson} className="glass-surface hover:bg-white/10 text-success hover:text-success/80 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2.5 border border-success/30 shadow-sm light-sweep">
                        <Save className="w-4 h-4" /> {useLanguage().language === 'es' ? 'GUARDAR JSON' : 'SAVE JSON'}
                    </button>
                    <button onClick={() => {
                        if (onCompare && customPump) {
                            onCompare({
                                id: `d${Date.now()}`,
                                fileName: params.metadata.projectName || 'Current Design',
                                params: params,
                                pump: effectivePump || customPump,
                                results: activeResults,
                                frequency: frequency
                            });
                        }
                    }} className="glass-surface hover:bg-white/10 text-indigo-500 hover:text-indigo-400 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2.5 border border-indigo-500/20 shadow-sm light-sweep">
                        <GitCompareArrows className="w-4 h-4" /> {useLanguage().language === 'es' ? 'COMPARAR' : 'COMPARE'}
                    </button>

                    <button onClick={() => setShowPumpModal(true)} className="glass-surface hover:bg-white/10 text-txt-muted hover:text-txt-main px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2.5 border border-white/5 shadow-sm light-sweep">
                        <Database className="w-4 h-4" /> {t('p5.loadDb')}
                    </button>
                    <button onClick={() => setShowAIModal(true)} className="btn-premium-primary animate-pulse-glow text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2.5 transition-all active:scale-95 light-sweep">
                        <Sparkles className="w-4 h-4 animate-pulse text-white" /> {t('p5.auto')}
                    </button>
                </div>
            </div>

            {/* TELEMETRY GRID - Symmetric 6-column layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 shrink-0 px-1">
                <KPICard label={t('kpi.activeProd')} value={activeFlow?.toLocaleString() || '-'} unit="BPD" icon={Droplets} colorClass="primary" highlight={true} glow={isFlowTargetMet} target={targetFlow} />
                <KPICard label={t('kpi.genHead')} value={activeHead?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '-'} unit="FT" icon={Activity} colorClass={isHeadTargetMet ? "primary" : "secondary"} highlight={true} glow={isHeadTargetMet} target={reqTdh} />
                <KPICard label={t('kpi.sysEff')} value={activeResults?.effEstimated?.toFixed(1) || '-'} unit="%" icon={Zap} colorClass="primary" />
                <KPICard label={t('p5.powerDraw')} value={activeResults?.electrical?.kw?.toFixed(1) || '-'} unit="kW" icon={Cpu} colorClass="secondary" />
                <KPICard label={t('kpi.gas')} value={((gasVoid || 0) * 100).toFixed(1)} unit="%" icon={Flame} colorClass={gasStatus === 'Stable' ? 'secondary' : 'danger'} highlight={isGasCritical} glow={isGasCritical} />
                <KPICard label={t('sens.pwf')} value={activeResults?.pwf?.toFixed(0) || '-'} unit="PSI" icon={ArrowDown} colorClass="primary" />
            </div>

            {/* SYMMETRIC SCENARIO BRIDGE - FULL WIDTH */}
            <div className="px-1 shrink-0">
                <div className="glass-surface p-1.5 rounded-[2rem] border border-white/5 shadow-xl flex items-center gap-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5"></div>
                    {['min', 'target', 'max'].map((s) => (
                        <button
                            key={s}
                            onClick={() => switchScenario(s as any)}
                            className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all duration-500 flex items-center justify-center gap-4 relative z-10 border ${params.activeScenario === s ? 'bg-primary/20 text-primary border-primary/40 shadow-glow-primary/20 scale-[1.01]' : 'glass-surface-light border-white/5 text-txt-muted hover:text-txt-main hover:border-white/10'}`}
                        >
                            <div className={`p-2 rounded-xl border ${params.activeScenario === s ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10'}`}>
                                <Target className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col items-start gap-0.5">
                                <span className={`text-[8px] tracking-[0.2em] font-black ${params.activeScenario === s ? 'opacity-100' : 'opacity-40'}`}>{s === 'min' ? 'IDLE' : s === 'target' ? 'NOMINAL' : 'LIMIT'}</span>
                                <span className="text-sm font-mono tracking-tighter leading-none">{params.targets[s as keyof typeof params.targets].rate} <small className="opacity-60 text-[9px]">BPD</small></span>
                            </div>
                            {params.activeScenario === s && <div className="absolute top-1 right-4 w-1.5 h-1.5 bg-primary rounded-full shadow-glow-primary animate-pulse"></div>}
                        </button>
                    ))}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 overflow-hidden pr-1">


                {/* 1. SELECTION & SCHEMATIC PANEL (Left) */}
                <div className="flex-1 lg:flex-[0.28] flex flex-col gap-6 overflow-y-auto custom-scrollbar min-h-0 pr-1">

                    {/* --- COMPONENT SELECTION (MINIMIZED BY DEFAULT) --- */}
                    <CollapsibleSection title="ESP COMPONENTS" icon={Layers} isOpen={openSections.bhaComponents} onToggle={() => toggleSection('bhaComponents')} colorClass="primary">
                        <div className="p-4 space-y-4 bg-canvas/30 rounded-b-2xl">
                            {/* Sync Button instead of Standard/Imported Toggle */}
                            {onReloadCatalog && (
                                <button 
                                    onClick={onReloadCatalog} 
                                    className="w-full py-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-3 shadow-sm group"
                                >
                                    <Clock className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                                    {useLanguage().language === 'es' ? 'SINCRONIZAR CATÁLOGO' : 'SYNC CATALOG'}
                                </button>
                            )}

                            <CollapsibleSection title="PUMP DERATING" icon={TrendingDown} isOpen={openSections.derating} onToggle={() => toggleSection('derating')} colorClass="primary">
                                <div className="p-5 space-y-5 bg-white/5">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest opacity-60">Factors</span>
                                        <button onClick={resetDerating} className="text-[8px] font-black text-primary uppercase tracking-widest hover:text-txt-main">Reset</button>
                                    </div>
                                    <div className="space-y-5">
                                        <div><div className="flex justify-between text-[9px] font-black mb-1.5"><span className="text-txt-muted uppercase">HEAD</span><span className="text-secondary font-mono">{derating.head.toFixed(2)}x</span></div><input type="range" min="0.5" max="1.5" step="0.01" value={derating.head} onChange={(e) => setDerating(prev => ({ ...prev, head: parseFloat(e.target.value) }))} className="w-full h-1 bg-canvas rounded-lg appearance-none cursor-pointer accent-secondary" /></div>
                                        <div><div className="flex justify-between text-[9px] font-black mb-1.5"><span className="text-txt-muted uppercase">POWER</span><span className="text-secondary font-mono">{derating.power.toFixed(2)}x</span></div><input type="range" min="0.5" max="1.5" step="0.01" value={derating.power} onChange={(e) => setDerating(prev => ({ ...prev, power: parseFloat(e.target.value) }))} className="w-full h-1 bg-canvas rounded-lg appearance-none cursor-pointer accent-secondary" /></div>
                                        <div><div className="flex justify-between text-[9px] font-black mb-1.5"><span className="text-txt-muted uppercase">EFF</span><span className="text-primary font-mono">{derating.eff.toFixed(2)}x</span></div><input type="range" min="0.5" max="1.5" step="0.01" value={derating.eff} onChange={(e) => setDerating(prev => ({ ...prev, eff: parseFloat(e.target.value) }))} className="w-full h-1 bg-canvas rounded-lg appearance-none cursor-pointer accent-primary shadow-glow-primary" /></div>
                                    </div>
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection title={t('p5.pumps')} icon={Settings} isOpen={openSections.pumps} onToggle={() => toggleSection('pumps')} colorClass="primary">
                                <div className="p-3 space-y-3 bg-white/5">
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-canvas/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[10px] font-black text-txt-main outline-none focus:border-primary/40 uppercase" />
                                            <Search className="w-3.5 h-3.5 text-txt-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                        </div>
                                        <div className="flex gap-2">
                                            <select value={filterSeries} onChange={(e) => setFilterSeries(e.target.value)} className="flex-1 glass-surface-light text-[9px] font-black text-txt-muted px-2 py-2 rounded-xl outline-none border border-white/5">
                                                <option value="ALL">All Series</option>
                                                {uniqueSeries.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <select value={filterManuf} onChange={(e) => setFilterManuf(e.target.value)} className="flex-1 glass-surface-light text-[9px] font-black text-txt-muted px-2 py-2 rounded-xl outline-none border border-white/5">
                                                <option value="ALL">All Manuf</option>
                                                {uniqueManuf.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        {/* Viability Filter Toggle */}
                                        <button 
                                            onClick={() => setShowViableOnly(!showViableOnly)}
                                            className={`w-full py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${showViableOnly ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-txt-muted border-white/10 hover:border-white/20'}`}
                                        >
                                            <Filter className="w-3 h-3" />
                                            {showViableOnly ? 'Showing Viable Only' : 'Showing All Pumps'}
                                        </button>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                        {Object.entries(groupedPumps).map(([series, items]: [string, any[]]) => (
                                            <div key={series} className="space-y-1.5">
                                                <div className="text-[8px] font-black text-txt-muted uppercase tracking-widest pl-2 py-1 bg-primary/5 rounded-md">{series}</div>
                                                {items.map((item: any, idx: number) => {
                                                    const isActive = item.pump.id === customPump?.id;
                                                    return (
                                                        <button key={idx} onClick={() => handleManualSelect(item)} className={`w-full text-left p-2.5 rounded-xl border transition-all flex justify-between items-center group ${isActive ? 'bg-primary/10 border-primary' : 'glass-surface-light border-white/5 hover:border-primary/40'}`}>
                                                            <div className="min-w-0 flex-1">
                                                                <div className={`text-[10px] font-black uppercase truncate ${isActive ? 'text-primary' : 'text-txt-main'}`}>{item.pump.model}</div>
                                                                <div className="text-[7px] text-txt-muted font-black uppercase opacity-60">{item.pump.manufacturer}</div>
                                                            </div>
                                                            <div className={`px-2 py-1 rounded-lg text-[8px] font-black ml-2 ${isActive ? 'bg-primary text-white' : 'bg-white/5 text-txt-muted'}`}>{item.reqStages} STG</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection title={t('p5.motors')} icon={Zap} isOpen={openSections.motors} onToggle={() => toggleSection('motors')} colorClass="secondary">
                                <div className="p-3 space-y-3 bg-white/5">
                                    {/* HP Requerida Banner */}
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                                        <Zap className="w-4 h-4 text-secondary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[8px] font-black text-txt-muted uppercase tracking-widest">POTENCIA REQUERIDA (BHP)</div>
                                            <div className="text-base font-black text-secondary font-mono">
                                                {activeResults?.hpTotal?.toFixed(1) || '-'} <span className="text-[9px] text-txt-muted">HP</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[8px] font-black text-txt-muted uppercase tracking-widest">A NIVEL MOTOR</div>
                                            <div className="text-base font-black text-primary font-mono">{activeResults?.requiredMotorHp?.toFixed(1) || '-'} <span className="text-[9px] text-txt-muted">HP</span></div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="relative">
                                            <input type="text" value={motorSearch} onChange={(e) => setMotorSearch(e.target.value)} placeholder="Search Motor..." className="w-full bg-canvas/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[10px] font-black text-txt-main outline-none focus:border-secondary/40 uppercase" />
                                            <Search className="w-3.5 h-3.5 text-txt-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                        </div>
                                        <div className="flex gap-2">
                                            <select value={motorFilterSeries} onChange={(e) => setMotorFilterSeries(e.target.value)} className="flex-1 glass-surface-light text-[9px] font-black text-txt-muted px-2 py-2 rounded-xl outline-none border border-white/5">
                                                <option value="ALL">All Series</option>
                                                {uniqueMotorSeries.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <select value={motorFilterManuf} onChange={(e) => setMotorFilterManuf(e.target.value)} className="flex-1 glass-surface-light text-[9px] font-black text-txt-muted px-2 py-2 rounded-xl outline-none border border-white/5">
                                                <option value="ALL">All Manuf</option>
                                                {uniqueMotorManuf.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                        {processedMotors.map(({ motor, isFit }, idx) => {
                                            const isActive = params.selectedMotor?.id === motor.id;
                                            return (
                                                <button key={idx} onClick={() => { handleMotorSelect(motor); setActiveChart('motor'); }} className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center ${isActive ? 'bg-secondary/15 border-secondary shadow-glow-secondary/10' : isFit ? 'glass-surface-light border-white/5 hover:border-secondary/40' : 'bg-red-500/10 border-red-500/30 grayscale contrast-75'} group`}>
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`text-[10px] font-black uppercase truncate ${isActive ? 'text-secondary' : 'text-txt-main'}`}>{motor.model}</div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-[7px] text-txt-muted font-black uppercase opacity-60 tracking-wider">{(motor.manufacturer)}</div>
                                                            <div className="h-1 w-1 rounded-full bg-white/10"></div>
                                                            <div className="text-[8px] font-black text-primary font-mono">{motor.hp} HP</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right ml-2 group-hover:scale-110 transition-transform">
                                                        <div className="text-[9px] font-black font-mono text-txt-main">{motor.voltage}V</div>
                                                        <div className="text-[7px] font-black text-txt-muted opacity-40 uppercase">{motor.series}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection title="CABLE" icon={Cable} isOpen={openSections.cables} onToggle={() => toggleSection('cables')} colorClass="primary">
                                <div className="p-3 space-y-3 bg-white/5">
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                        {processedCables.map((cbl, idx) => {
                                            const isActive = params.selectedCable?.id === cbl.id;
                                            return (
                                                <button key={idx} onClick={() => handleCableSelect(cbl)} className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center ${isActive ? 'bg-primary/10 border-primary' : 'glass-surface-light border-white/5 hover:border-primary/40'}`}>
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`text-[10px] font-black uppercase truncate ${isActive ? 'text-primary' : 'text-txt-main'}`}>{cbl.awg} {cbl.type}</div>
                                                        <div className="text-[7px] text-txt-muted font-black uppercase opacity-60">{cbl.model}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CollapsibleSection>

                            {/* ===== VSD / VARIADOR SELECTOR ===== */}
                            <CollapsibleSection title="VSD / VARIADOR" icon={Monitor} isOpen={openSections.vsd} onToggle={() => toggleSection('vsd')} colorClass="secondary">
                                <div className="p-3 space-y-3 bg-white/5">
                                    {/* Required kVA Banner */}
                                    {(activeResults?.electrical?.kva || 0) > 0 && (
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                                            <Zap className="w-4 h-4 text-secondary shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[8px] font-black text-txt-muted uppercase tracking-widest">REQ. mín. VSD (x1.25)</div>
                                                <div className="text-base font-black text-secondary font-mono">
                                                    {(activeResults.electrical.kva * 1.25).toFixed(1)} <span className="text-[9px] text-txt-muted">kVA</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[8px] font-black text-txt-muted uppercase tracking-widest">I motor</div>
                                                <div className="text-base font-black text-primary font-mono">{activeResults.electrical.amps?.toFixed(1) || '-'} <span className="text-[9px] text-txt-muted">A</span></div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Selected VSD summary */}
                                    {(params as any).selectedVSD && (
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[9px] font-black text-primary uppercase tracking-widest">VSD SELECCIONADO</div>
                                                <div className="text-[10px] font-black text-txt-main truncate">{(params as any).selectedVSD.model} — {(params as any).selectedVSD.kvaRating} kVA</div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Search */}
                                    <div className="relative">
                                        <input
                                            type="text" value={vsdSearch}
                                            onChange={(e) => setVsdSearch(e.target.value)}
                                            placeholder="Buscar VSD por modelo o fabricante..."
                                            className="w-full bg-canvas/40 border border-white/5 rounded-xl py-2.5 pl-9 pr-4 text-[10px] font-black text-txt-main outline-none focus:border-secondary/40 uppercase"
                                        />
                                        <Search className="w-3.5 h-3.5 text-txt-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                    </div>
                                    {/* VSD List */}
                                    <div className="max-h-[360px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                        {processedVSDs.map(({ vsd, isFit, isUnder, margin }, idx) => {
                                            const isActive = (params as any).selectedVSD?.id === vsd.id;
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleVSDSelect(vsd)}
                                                    disabled={isUnder}
                                                    className={`w-full text-left p-3 rounded-xl border transition-all ${isActive ? 'bg-secondary/15 border-secondary shadow-glow-secondary/20'
                                                        : isUnder ? 'opacity-25 grayscale pointer-events-none'
                                                            : isFit ? 'glass-surface-light border-green-500/30 hover:border-secondary/40'
                                                                : 'glass-surface-light border-white/5 hover:border-white/20 opacity-60'
                                                        }`}
                                                >
                                                    {/* Header */}
                                                    <div className="flex justify-between items-start mb-2.5">
                                                        <div className="min-w-0 flex-1">
                                                            <div className={`text-[10px] font-black uppercase leading-tight ${isActive ? 'text-secondary' : isFit ? 'text-txt-main' : 'text-txt-muted'}`}>
                                                                {vsd.model}
                                                            </div>
                                                            <div className="text-[7px] text-txt-muted font-black uppercase opacity-60">{vsd.brand} · {vsd.manufacturer}</div>
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black ml-2 shrink-0 ${isActive ? 'bg-secondary text-white'
                                                            : isFit ? 'bg-green-500/20 text-green-400'
                                                                : 'bg-white/10 text-txt-muted'
                                                            }`}>
                                                            {vsd.kvaRating} kVA
                                                        </div>
                                                    </div>
                                                    {/* Specs grid */}
                                                    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                                                        <div>
                                                            <div className="text-[6px] font-black text-txt-muted uppercase tracking-widest">V entrada</div>
                                                            <div className="text-[8px] font-black text-txt-main font-mono leading-tight">{vsd.inputVoltage}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[6px] font-black text-txt-muted uppercase tracking-widest">V salida</div>
                                                            <div className="text-[8px] font-black text-txt-main font-mono leading-tight">{vsd.outputVoltage}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[6px] font-black text-txt-muted uppercase tracking-widest">Frecuencia</div>
                                                            <div className="text-[8px] font-black text-txt-main font-mono leading-tight">{vsd.outputFrequency}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[6px] font-black text-txt-muted uppercase tracking-widest">THD</div>
                                                            <div className="text-[8px] font-black text-txt-main font-mono">{vsd.thd}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[6px] font-black text-txt-muted uppercase tracking-widest">Eficiencia</div>
                                                            <div className="text-[8px] font-black text-secondary font-mono">{vsd.efficiency}%</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[6px] font-black text-txt-muted uppercase tracking-widest">Carcasa</div>
                                                            <div className="text-[8px] font-black text-txt-main font-mono">{vsd.enclosure}</div>
                                                        </div>
                                                    </div>
                                                    {/* Compatibility indicator */}
                                                    {isFit && margin !== null && (
                                                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
                                                            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                                                <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${Math.min(100, 100 / (1 + margin / 100))}%` }}></div>
                                                            </div>
                                                            <span className="text-[7px] font-black text-green-400 uppercase tracking-wider">+{margin.toFixed(0)}% sobre req.</span>
                                                        </div>
                                                    )}
                                                    {vsd.notes && (
                                                        <div className="mt-1.5 text-[7px] text-txt-muted font-bold italic opacity-50 truncate">{vsd.notes}</div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CollapsibleSection>
                        </div>
                    </CollapsibleSection>

                    {/* BHA SCHEMATIC */}
                    <CollapsibleSection title={t('vis.bha')} icon={Layers} isOpen={openSections.visualStack} onToggle={() => toggleSection('visualStack')} colorClass="secondary">
                        <div className="relative h-[650px] w-full overflow-hidden glass-surface rounded-b-[2rem] shadow-2xl group">
                            <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-transparent to-canvas/40 pointer-events-none z-10"></div>
                            <div className="flex-1 w-full relative h-full transition-all duration-700">
                                <VisualESPStack
                                    pump={customPump}
                                    motor={params.selectedMotor}
                                    params={params}
                                    results={activeResults}
                                    frequency={params.targets[params.activeScenario].frequency}
                                    selectedVSD={(params as any).selectedVSD}
                                    mode="ui"
                                />
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>

                {/* 2. MAIN RESULTS DASHBOARD (Center) */}
                <div className="flex-1 lg:flex-[0.44] flex flex-col gap-6 overflow-y-auto custom-scrollbar min-h-0 pr-2 pb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 flex glass-surface p-1.5 rounded-[1.5rem] border border-white/5 shadow-inner shrink-0 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <button onClick={() => setViewMode('analytics')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-3 transition-all relative z-10 ${viewMode === 'analytics' ? 'bg-primary/20 text-primary shadow-glow-primary/10 border border-primary/20' : 'text-txt-muted hover:text-txt-main hover:bg-white/5'}`}>
                                <Activity className="w-4 h-4" /> {useLanguage().language === 'es' ? 'ANALÍTICOS' : 'ANALYTICS'}
                            </button>
                            <button onClick={() => setViewMode('table')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-3 transition-all relative z-10 ${viewMode === 'table' ? 'bg-secondary/20 text-secondary shadow-glow-secondary/10 border border-secondary/20' : 'text-txt-muted hover:text-txt-main hover:bg-white/5'}`}>
                                <Table className="w-4 h-4" /> {useLanguage().language === 'es' ? 'OPERATIVOS' : 'VSD TABLE'}
                            </button>
                        </div>
                    </div>

                    {viewMode === 'analytics' ? (
                        <>
                            <div className="flex glass-surface p-1.5 rounded-[1.5rem] border border-white/5 shadow-inner shrink-0 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <button onClick={() => setActiveChart('pump')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all relative z-10 ${activeChart === 'pump' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-txt-muted hover:text-txt-main hover:bg-white/5'}`}>
                                    <Layers className="w-4 h-4" /> {t('p5.perfCurve')}
                                </button>
                                <button onClick={() => setActiveChart('multi')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all relative z-10 ${activeChart === 'multi' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-txt-muted hover:text-txt-main hover:bg-white/5'}`}>
                                    <Sparkles className="w-4 h-4" /> {t('p5.analytics')}
                                </button>
                                <button onClick={() => setActiveChart('motor')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all relative z-10 ${activeChart === 'motor' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'text-txt-muted hover:text-txt-main hover:bg-white/5'}`}>
                                    <Zap className="w-4 h-4" /> {t('p5.motorCurve')}
                                </button>
                            </div>
                            <div className="glass-surface-light rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden p-3 relative flex flex-col shrink-0 group transition-all duration-700 h-[620px]">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="absolute top-4 right-6 flex gap-2 z-20">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                    <div className="w-2 h-2 rounded-full bg-secondary/50"></div>
                                </div>
                                {activeChart === 'pump' && effectivePump && effectiveCurveData.length > 0 ? (
                                    <PumpChart
                                        data={effectiveCurveData}
                                        pump={effectivePump}
                                        currentFrequency={frequency}
                                        intersectionPoint={effectiveMatch}
                                        targetFlow={params.pressures.totalRate}
                                        className="w-full h-full"
                                    />
                                ) : activeChart === 'multi' && effectivePump && effectiveCurveData.length > 0 ? (
                                    <PerformanceCurveMultiAxis
                                        data={effectiveCurveData.map(d => {
                                            const wc = params.fluids.waterCut / 100;
                                            const mixSG = (params.fluids.geWater * wc) + (141.5 / (131.5 + params.fluids.apiOil) * (1 - wc));
                                            const baseHz = effectivePump.nameplateFrequency || 60;
                                            return {
                                                ...d,
                                                headCurr: d.userHz,
                                                effCurr: d.efficiency,
                                                pwrCurr: calculateBhpAtPoint(d.flow, frequency, baseHz, effectivePump, mixSG),
                                                pwrNew: calculateBhpAtPoint(d.flow, baseHz, baseHz, effectivePump, mixSG), // Design power at base freq
                                                headNew: calculateBaseHead(d.flow * (baseHz / frequency), effectivePump)
                                            };
                                        })}
                                        pump={effectivePump}
                                        currentFlow={activeFlow}
                                        frequency={frequency}
                                        className="w-full h-full"
                                    />
                                ) : activeChart === 'motor' && params.selectedMotor ? (
                                    <MotorChart motor={params.selectedMotor} currentLoadPct={activeResults?.motorLoad || 0} />
                                ) : (
                                    <div className="flex-1 flex flex-col gap-6 items-center justify-center text-txt-muted font-black uppercase tracking-[0.3em] text-sm opacity-40">
                                        <div className="p-8 glass-surface-light rounded-full border border-white/5 animate-float">
                                            <Settings className="w-16 h-16 animate-spin-slow text-primary/40" />
                                        </div>
                                        {!effectivePump ? t('p5.selectEq') : "Synthesizing Analytic Model..."}
                                    </div>
                                )}
                            </div>

                        </>
                    ) : (
                        <div className="flex-1 min-h-0 flex flex-col gap-4 animate-fadeIn">
                            <div className="glass-surface-light rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col p-1.5 h-[620px]">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-primary/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/20 rounded-xl"><Table className="w-5 h-5 text-primary" /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-txt-main uppercase tracking-tighter">{t('p5.vsdAnalysis')}</h3>
                                            <p className="text-[9px] text-txt-muted font-black uppercase tracking-widest opacity-60">Multifrequency performance analysis</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow-emerald"></div>
                                            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        </div>
                                        <button
                                            onClick={() => setIsTableMaximized(true)}
                                            className="p-2 rounded-xl glass-surface border border-white/10 text-txt-muted hover:text-primary hover:border-primary/40 transition-all active:scale-95"
                                        >
                                            <Maximize2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="min-w-[1200px] w-full text-[10px] text-left border-collapse">
                                        <thead className="bg-canvas text-txt-muted uppercase font-black sticky top-0 z-10 border-b border-white/5">
                                            <tr>{rowDefinitions.map(def => (<th key={def.key} className="py-4 px-4 whitespace-nowrap text-center tracking-widest">{def.label} <span className="opacity-60 block text-[8px] mt-0.5">{def.unit}</span></th>))}</tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {vsdTableData.map((row, i) => {
                                                const isCurrent = Math.abs(row.hz - frequency) < 0.1;
                                                return (
                                                    <tr key={i} className={`hover:bg-primary/5 transition-all duration-300 group ${isCurrent ? 'bg-primary/10 border-l-2 border-primary' : ''}`}>
                                                        {rowDefinitions.map(def => {
                                                            const val = (row as any)[def.key];
                                                            const numVal = Number(val) || 0;
                                                            let cellBg = '';
                                                            let cellText = 'text-txt-main';
                                                            if (def.key === 'motorLoad' || def.key === 'pumpShaftLoad') {
                                                                if (numVal >= 100) { cellBg = 'bg-red-500/80 text-white'; }
                                                                else if (numVal >= 85) { cellBg = 'bg-amber-400/80 text-slate-900'; }
                                                            }
                                                            else if (def.key === 'pip') {
                                                                if (numVal < 150) { cellBg = 'bg-red-500/80 text-white'; }
                                                                else if (numVal < 300) { cellBg = 'bg-amber-400/80 text-slate-900'; }
                                                            }
                                                            return (
                                                                <td key={def.key} className={`py-4 px-4 text-center font-mono font-black transition-all ${cellBg} ${isCurrent && !cellBg ? 'text-primary' : 'text-txt-main opacity-80'}`}>
                                                                    {def.fmt(val as number)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-canvas/30 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.3em]">Stability Matrix @ Current SG</span>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-black text-emerald-500 uppercase">SAFE</span></div>
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-[8px] font-black text-amber-400 uppercase">CAUTION</span></div>
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[8px] font-black text-red-500 uppercase">ALARM</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. RIGHT PANEL (Config & Detailed Results) */}
                <div className="flex-1 lg:flex-[0.28] flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">


                    <CollapsibleSection title={t('p5.equipped')} icon={CheckCircle2} isOpen={openSections.equipped} onToggle={() => toggleSection('equipped')} colorClass="primary">
                        <div className="p-6 space-y-5 bg-white/5">
                            {customPump && (
                                <div className="pb-6 border-b border-white/5 space-y-5">
                                    <div className="flex items-center gap-5 glass-surface p-5 rounded-[2rem] border border-white/10 shadow-glow-primary/5 group focus-within:ring-2 ring-primary/30 transition-all relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full"></div>
                                        <div className="flex-1 relative z-10">
                                            <label className="text-[9px] font-black text-txt-muted uppercase block mb-2 tracking-[0.2em] opacity-60">{t('p6.operatingFreq')}</label>
                                            <div className="flex items-baseline gap-2">
                                                <DraftInput type="number" min="1" max="90" step="0.1" value={frequency} onChange={updateFrequency} instant={true} className="w-24 bg-transparent text-3xl font-black text-primary outline-none font-mono tracking-tighter" />
                                                <span className="text-xs font-black text-txt-muted uppercase opacity-40">Hz</span>
                                            </div>
                                        </div>
                                        <div className="p-4 glass-surface-light rounded-2xl text-primary group-focus-within:shadow-glow-primary transition-all relative z-10"><Activity className="w-7 h-7" /></div>
                                    </div>

                                    <div className="flex gap-4">
                                        <button onClick={() => { const step = customPump.stageIncrease || 1; const s = Math.max((customPump.stages || 0) - step, customPump.minStages || 1); const bodies = Math.ceil(s / (customPump.maxStages || 100)); setCustomPump({ ...customPump, stages: s, housingCount: bodies }); }} className="w-16 h-16 rounded-2xl glass-surface border border-white/10 hover:bg-white/5 flex items-center justify-center font-black text-txt-muted text-2xl hover:text-danger transition-all active:scale-90 shadow-xl border-b-4 border-white/5 hover:border-b-2 active:border-b-0 group">
                                            <span className="group-hover:scale-125 transition-transform">-</span>
                                        </button>
                                        <div className="flex-1 glass-surface border border-white/10 rounded-2xl flex flex-col items-center justify-center shadow-xl border-b-4 border-white/5 group">
                                            <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.3em] mt-1 opacity-60">{t('p6.stages')}</span>
                                            <DraftInput
                                                type="number"
                                                value={customPump.stages}
                                                instant={true}
                                                onFocus={(e: any) => e.target.select()}
                                                onChange={(s: number) => {
                                                    const val = Math.max(1, s);
                                                    const bodies = Math.ceil(val / (customPump.maxStages || 100));
                                                    setCustomPump({ ...customPump, stages: val, housingCount: bodies });
                                                }}
                                                className="w-full bg-transparent text-center text-2xl font-black text-txt-main outline-none font-mono tracking-tighter"
                                            />
                                        </div>
                                        <button onClick={() => { const step = customPump.stageIncrease || 1; const s = (customPump.stages || 0) + step; const bodies = Math.ceil(s / (customPump.maxStages || 100)); setCustomPump({ ...customPump, stages: s, housingCount: bodies }); }} className="w-16 h-16 rounded-2xl glass-surface border border-white/10 hover:bg-white/5 flex items-center justify-center font-black text-txt-muted text-2xl hover:text-primary transition-all active:scale-90 shadow-xl border-b-4 border-white/5 hover:border-b-2 active:border-b-0 group">
                                            <span className="group-hover:scale-125 transition-transform">+</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center glass-surface-light p-5 rounded-[1.5rem] border border-white/5 shadow-inner group hover:border-primary/40 transition-all duration-500">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[9px] text-primary font-black uppercase block tracking-[0.2em] mb-2 opacity-60">{t('p6.hydraulic')}</span>
                                    <div className="text-xs font-black text-txt-main truncate leading-tight group-hover:text-primary transition-colors">{customPump?.model || '-'}</div>
                                    <div className="text-[8px] text-txt-muted font-black uppercase mt-1 tracking-widest">{customPump?.series} {t('p6.seriesT')}</div>
                                </div>
                                <div className="text-right flex flex-col gap-2 items-end ml-4 shrink-0">
                                    <span className="text-[10px] text-txt-main font-black block glass-surface px-4 py-1.5 rounded-xl border border-white/10 shadow-sm">{customPump?.stages || 0} STG</span>
                                    {customPump?.housingCount && customPump.housingCount > 0 && (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/20 border border-secondary/20 shadow-glow-secondary/10">
                                            <Box className="w-3 h-3 text-secondary" />
                                            <span className="text-[9px] text-secondary font-black uppercase tracking-tighter">
                                                {customPump.housingCount} {customPump.housingCount === 1 ? 'UNIT' : 'UNITS'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-center glass-surface-light p-5 rounded-[1.5rem] border border-white/5 shadow-inner group hover:border-secondary/40 transition-all duration-500">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[9px] text-secondary font-black uppercase block tracking-[0.2em] mb-2 opacity-60">{t('p5.inductionMotor')}</span>
                                    <div className="text-xs font-black text-txt-main truncate leading-tight group-hover:text-secondary transition-colors">{params.selectedMotor?.model || '-'}</div>
                                    <div className="text-[8px] text-txt-muted font-black uppercase mt-1 tracking-widest">{params.selectedMotor?.manufacturer}</div>
                                </div>
                                <div className="text-right flex flex-col gap-2 items-end ml-4 shrink-0">
                                    <span className="text-[10px] text-txt-main font-black block glass-surface px-4 py-1.5 rounded-xl border border-white/10 shadow-sm">{params.selectedMotor?.hp || params.motorHp} HP</span>
                                    <div className="text-[8px] text-secondary font-black uppercase tracking-widest opacity-60">SYSTEM DRIVE</div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center glass-surface-light p-5 rounded-[1.5rem] border border-white/5 shadow-inner group hover:border-primary/40 transition-all duration-500">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[9px] text-txt-muted font-black uppercase block tracking-[0.2em] mb-2 opacity-60">POWER CONDUCTOR</span>
                                    <div className="text-xs font-black text-txt-main truncate leading-tight">{params.selectedCable?.awg || '-'} AWG {params.selectedCable?.type}</div>
                                    <div className="text-[8px] text-txt-muted font-black uppercase mt-1 tracking-widest">{params.selectedCable?.model}</div>
                                </div>
                                <div className="p-3 glass-surface rounded-xl border border-white/5 text-txt-muted"><Cable className="w-4 h-4" /></div>
                            </div>

                            <div className="flex justify-between items-center glass-surface-light p-5 rounded-[1.5rem] border border-white/5 shadow-inner group hover:border-secondary/40 transition-all duration-500">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[9px] text-secondary font-black uppercase block tracking-[0.2em] mb-2 opacity-60">{t('p6.surfaceVSD')}</span>
                                    <div className="text-xs font-black text-txt-main truncate leading-tight group-hover:text-secondary transition-colors">{(params as any).selectedVSD?.model || 'NOT SELECTED'}</div>
                                    <div className="text-[8px] text-txt-muted font-black uppercase mt-1 tracking-widest">{(params as any).selectedVSD?.brand} · {(params as any).selectedVSD?.manufacturer}</div>
                                </div>
                                <div className="text-right flex flex-col gap-2 items-end ml-4 shrink-0">
                                    <span className="text-[10px] text-txt-main font-black block glass-surface px-4 py-1.5 rounded-xl border border-white/10 shadow-sm">{(params as any).selectedVSD?.kvaRating || 0} kVA</span>
                                    <div className="p-3 glass-surface rounded-xl border border-white/5 text-secondary"><Monitor className="w-4 h-4" /></div>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>
            </div>

            {/* FULLSCREEN TABLE OVERLAY */}
            {isTableMaximized && (
                <div className="fixed inset-0 z-[100] bg-canvas/80 backdrop-blur-3xl animate-fadeIn p-8 flex flex-col items-center justify-center">
                    <div className="w-full max-w-[1400px] h-[90vh] glass-surface rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(var(--color-primary),0.1)] overflow-hidden flex flex-col relative animate-scaleIn">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-primary/5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/20 rounded-2xl shadow-glow-primary/20"><Table className="w-7 h-7 text-primary" /></div>
                                <div>
                                    <h2 className="text-xl font-black text-txt-main uppercase tracking-tighter">{t('p5.vsdAnalysis')}</h2>
                                    <p className="text-[10px] text-txt-muted font-black uppercase tracking-[0.3em] opacity-60">Complete Multi-Frequency Stability Matrix</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsTableMaximized(false)}
                                className="w-12 h-12 rounded-2xl glass-surface border border-white/10 flex items-center justify-center text-txt-muted hover:text-danger hover:border-danger/40 transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-1">
                            <table className="w-full text-xs text-left border-collapse min-w-[1400px]">
                                <thead className="bg-primary/10 text-primary uppercase font-black sticky top-0 z-10 backdrop-blur-xl border-b border-primary/20">
                                    <tr>
                                        {rowDefinitions.map(def => (
                                            <th key={def.key} className="py-6 px-6 whitespace-nowrap text-center tracking-widest border-r border-white/5 last:border-0">
                                                {def.label}
                                                <span className="opacity-60 block text-[9px] mt-1 font-mono">{def.unit}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {vsdTableData.map((row, i) => {
                                        const isCurrent = Math.abs(row.hz - frequency) < 0.1;
                                        return (
                                            <tr key={i} className={`hover:bg-primary/5 transition-all duration-300 group ${isCurrent ? 'bg-primary/15 border-l-4 border-primary shadow-inner' : ''}`}>
                                                {rowDefinitions.map(def => {
                                                    const val = (row as any)[def.key];
                                                    const numVal = Number(val) || 0;
                                                    let cellBg = '';
                                                    let cellText = 'text-txt-main';
                                                    if (def.key === 'motorLoad' || def.key === 'pumpShaftLoad') {
                                                        if (numVal >= 100) { cellBg = 'bg-red-500/90 text-white shadow-glow-danger/20'; }
                                                        else if (numVal >= 85) { cellBg = 'bg-amber-400/90 text-slate-900 shadow-glow-amber/20'; }
                                                    }
                                                    else if (def.key === 'pip') {
                                                        if (numVal < 150) { cellBg = 'bg-red-500/90 text-white'; }
                                                        else if (numVal < 300) { cellBg = 'bg-amber-400/90 text-slate-900'; }
                                                    }
                                                    return (
                                                        <td key={def.key} className={`py-6 px-6 text-center font-mono font-black transition-all border-r border-white/5 last:border-0 ${cellBg} ${isCurrent && !cellBg ? 'text-primary scale-110' : 'text-txt-main opacity-80'}`}>
                                                            {def.fmt(val as number)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 bg-canvas/40 border-t border-white/5 flex justify-between items-center px-10">
                            <span className="text-[10px] font-black text-txt-muted uppercase tracking-[0.3em]">Stability Index Version 2.0 • Live Computation</span>
                            <div className="flex items-center gap-10">
                                <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-[10px] font-black text-emerald-500 uppercase">SAFE OPERATING ZONE</span></div>
                                <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-amber-400"></div><span className="text-[10px] font-black text-amber-400 uppercase">CAUTION / MONITORING</span></div>
                                <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-[10px] font-black text-red-500 uppercase">ALARM / CRITICAL</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
