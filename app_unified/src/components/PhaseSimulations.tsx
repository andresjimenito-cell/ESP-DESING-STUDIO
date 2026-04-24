
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Activity, Clock, Layers, Play, Pause, RotateCcw, AlertTriangle, Settings, Zap, Droplets, ArrowDown, Gauge, Cpu, TrendingDown, Printer, X, Download, FileText, PieChart, DollarSign } from 'lucide-react';
import { EspPump, SystemParams } from '../types';
import { calculateTDH, calculateBaseHead, calculateAffinityHead, findIntersection, calculateSystemResults, calculateBasePowerPerStage, calculateMotorPoly, generateMultiCurveData } from '../utils';
import { PerformanceCurveMultiAxis } from './PerformanceCurveMultiAxis';
import { MotorCurveMultiAxis } from './MotorCurveMultiAxis';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, ReferenceLine, ReferenceDot, AreaChart, Label, Legend } from 'recharts';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    pump: EspPump | null;
    frequency: number;
}

// --- HELPER: SHAFT LIMIT ESTIMATION ---
const getShaftLimitHp = (series: string = ""): number => {
    if (series.includes("338")) return 140;
    if (series.includes("400")) return 250;
    if (series.includes("538")) return 580;
    if (series.includes("562")) return 650;
    if (series.includes("675")) return 950;
    return 300; // Default fallback
};

// --- PREMIUM REPORT COMPONENT ---
const SimulationReport = ({ onClose, data, params, pump }: { onClose: () => void, data: any, params: SystemParams, pump: EspPump }) => {
    const { t } = useLanguage();

    const totalFlow = data.timeData.reduce((acc: number, curr: any) => acc + (curr.flow * 30), 0);
    const costPerBbl = totalFlow > 0 ? data.totalCost / totalFlow : 0;
    const degradationHead = data.timeData.length > 0 ? ((data.timeData[0].head - data.timeData[data.timeData.length - 1].head) / data.timeData[0].head) * 100 : 0;

    const handlePrint = () => {
        const originalTitle = document.title;
        document.title = `Lifecycle_Report_${new Date().toISOString().split('T')[0]}`;
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 500);
    };

    const tableData = useMemo(() => {
        if (!pump) return [];
        const currentHz = params.targets[params.activeScenario].frequency;
        const freqsToAnalyze = [30, 40, 50, 60, 70];
        if (!freqsToAnalyze.includes(currentHz)) freqsToAnalyze.push(currentHz);
        freqsToAnalyze.sort((a, b) => a - b);

        return freqsToAnalyze.map(hz => {
            const cData = generateMultiCurveData(pump, params, hz, 60);
            const matchPoint = findIntersection(cData);
            const flow = matchPoint?.flow || 0;
            const head = matchPoint?.head || 0;
            const res = calculateSystemResults(flow, head, params, pump, hz);
            const rpm = hz * 60;
            const wc = params.fluids.waterCut || 0;
            const pStatic = params.inflow.pStatic;
            const shaftLimit = getShaftLimitHp(pump?.series);
            const bhp = res.hpTotal || 0;
            const intakeT = params.bottomholeTemp;
            const motorT = intakeT + (res.motorLoad || 0) * 0.8;

            return {
                hz, rpm, flow, pip: res.pip, wc, bwpd: flow * (wc / 100), bopd: flow * (1 - wc / 100),
                pStatic, pdp: res.pdp, pwf: res.pwf, thp: params.pressures.pht, tdh: res.tdh,
                fluidLevel: res.fluidLevel, pumpDepth: params.pressures.pumpDepthMD,
                drawdown: Math.max(0, pStatic - res.pwf), bhp,
                motorHp: params.selectedMotor?.hp || params.motorHp,
                amps: res.electrical.amps, volts: res.electrical.volts, voltDrop: res.electrical.voltDrop,
                kva: res.electrical.kva, kw: res.electrical.kw, vel: res.fluidVelocity, motorT,
                pumpEff: res.effEstimated, motorEff: res.electrical.motorEff,
                pumpShaftLoad: shaftLimit > 0 ? (bhp / shaftLimit) * 100 : 0,
                protShaftLoad: shaftLimit > 0 ? (bhp / (shaftLimit * 1.15)) * 100 : 0,
                motorShaftLoad: shaftLimit > 0 ? (bhp / (shaftLimit * 1.25)) * 100 : 0,
                thrustLoad: flow > 0 ? Math.min(100, 15 + (Math.abs(flow - (pump?.bepRate || 1000) * (hz / 60)) / ((pump?.bepRate || 1000) * (hz / 60))) * 50) : 0
            };
        });
    }, [pump, params]);

    const f0 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(0) : '-';
    const f1 = (n: number) => n !== undefined && !isNaN(n) ? n.toFixed(1) : '-';

    const rowDefinitions = [
        { label: t('p6.matchFreq'), key: 'rpm', unit: 'rpm', fmt: f0 },
        { label: t('p6.bfpd'), key: 'flow', unit: 'bpd', fmt: f0 },
        { label: t('p6.pip'), key: 'pip', unit: 'psi', fmt: f0 },
        { label: t('p3.wc'), key: 'wc', unit: '%', fmt: f1 },
        { label: t('p6.bwpd'), key: 'bwpd', unit: 'bpd', fmt: f0 },
        { label: t('p6.bopd'), key: 'bopd', unit: 'bpd', fmt: f0 },
        { label: t('p6.pStatic'), key: 'pStatic', unit: 'psi', fmt: f0 },
        { label: t('p6.pdp'), key: 'pdp', unit: 'psi', fmt: f0 },
        { label: t('p6.pwf'), key: 'pwf', unit: 'psi', fmt: f0 },
        { label: t('p3.thp'), key: 'thp', unit: 'psi', fmt: f0 },
        { label: t('p6.tdh'), key: 'tdh', unit: 'ft', fmt: f0 },
        { label: t('p6.fluidLevel'), key: 'fluidLevel', unit: 'ft', fmt: f0 },
        { label: t('p6.bhp'), key: 'bhp', unit: 'hp', fmt: f1 },
        { label: t('p6.amps'), key: 'amps', unit: 'A', fmt: f1 },
        { label: t('p6.motorVolts'), key: 'volts', unit: 'V', fmt: f0 },
        { label: t('p6.motorTemp'), key: 'motorT', unit: '°F', fmt: f0 },
        { label: t('p6.pumpEff'), key: 'pumpEff', unit: '%', fmt: f1 },
        { label: t('p6.protShaftLoad'), key: 'protShaftLoad', unit: '%', fmt: f1 },
    ];

    return (
        <div className="fixed inset-0 z-[9999] bg-canvas overflow-hidden flex flex-col animate-fadeIn">
            <div className="h-16 bg-surface border-b border-surface-light flex items-center justify-between px-8 shadow-2xl shrink-0 no-print z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-2 rounded-lg text-white"><FileText className="w-5 h-5" /></div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">{t('sim.lifecycleReport')}</h3>
                        <p className="text-xs text-txt-muted font-bold">{t('sim.opexDossier')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase shadow-lg transition-all active:scale-95">
                        <Printer className="w-4 h-4" /> {t('sim.printReport')}
                    </button>
                    <button onClick={onClose} className="p-2.5 bg-surface-light hover:bg-red-500/20 text-txt-muted hover:text-red-500 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-canvas p-8 custom-scrollbar">
                <style>{`
                    @media print {
                        @page { margin: 0.5cm; size: landscape; }
                        html, body, #root { height: auto !important; overflow: visible !important; background: white !important; }
                        body * { visibility: hidden; }
                        #lifecyle-report-paper, #lifecyle-report-paper * { visibility: visible; }
                        #lifecyle-report-paper {
                            position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0;
                            background: white !important; color: black !important; box-shadow: none !important;
                        }
                        .no-print { display: none !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>

                <div id="lifecyle-report-paper" className="bg-white w-full max-w-[297mm] min-h-[210mm] mx-auto shadow-2xl rounded-sm p-12 text-slate-900 flex flex-col relative">
                    <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{t('sim.intelligenceDossier')}</h1>
                            <p className="font-bold text-slate-500 uppercase text-xs tracking-widest">{t('sim.energyForecast')}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{t('sim.engineVersion')}</div>
                            <div className="text-sm font-black text-slate-900">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-6 mb-10 break-inside-avoid">
                        <ReportMetric label={t('sim.lifetimeOpex')} value={`$${data.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={t('sim.energyProj')} color="blue" />
                        <ReportMetric label={t('sim.costDensity')} value={`$${costPerBbl.toFixed(3)}`} sub={t('sim.priceBbl')} color="emerald" />
                        <ReportMetric label={t('sim.headIntegrity')} value={`-${degradationHead.toFixed(1)}%`} sub={t('sim.wearEnd')} color="red" />
                        <ReportMetric label={t('sim.finalProduction')} value={`${data.endFlow.toFixed(0)}`} sub={t('sim.expectedBpd')} color="amber" />
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-10 break-inside-avoid">
                        <div className="p-1 border-2 border-slate-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest p-3 pb-1 text-center bg-slate-50 border-b border-slate-100">{t('sim.loadSensitivityChart')}</h3>
                            <div className="h-56 p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={data.timeData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `M${v}`} />
                                        <YAxis stroke="#94a3b8" fontSize={9} domain={[0, 100]} />
                                        <RechartsTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                                        <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                        <Line type="monotone" dataKey="ampsPct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Amps %" />
                                        <Line type="monotone" dataKey="motorEff" stroke="#10b981" strokeWidth={2} dot={false} name="Eff %" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="p-1 border-2 border-slate-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest p-3 pb-1 text-center bg-slate-50 border-b border-slate-100">{t('sim.freqPowerChart')}</h3>
                            <div className="h-56 p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={data.timeData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `M${v}`} />
                                        <YAxis yAxisId="left" stroke="#ef4444" fontSize={9} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#0ea5e9" fontSize={9} />
                                        <RechartsTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                                        <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                        <Line yAxisId="left" type="monotone" dataKey="freq" stroke="#ef4444" strokeWidth={2} dot={false} name="Hz" />
                                        <Line yAxisId="right" type="monotone" dataKey="kw" stroke="#0ea5e9" strokeWidth={2} dot={false} name="kW" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="p-1 border-2 border-slate-100 rounded-[2rem] overflow-hidden bg-white shadow-sm border-emerald-100">
                            <h3 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest p-3 pb-1 text-center bg-emerald-50 border-b border-emerald-100">{t('sim.monthlyEnergyChart')}</h3>
                            <div className="h-56 p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.timeData}>
                                        <defs>
                                            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `M${v}`} />
                                        <YAxis stroke="#059669" fontSize={9} tickFormatter={(v) => `$${v}`} />
                                        <RechartsTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} formatter={(v) => `$${Number(v).toLocaleString()}`} />
                                        <Area type="monotone" dataKey="monthlyCost" stroke="#10b981" fillOpacity={1} fill="url(#colorCost)" strokeWidth={3} name="Monthly Cost" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* NEW: ENERGY COST TABLE */}
                    <div className="mb-10 break-inside-avoid">
                        <h3 className="font-black text-xs uppercase tracking-widest text-white bg-emerald-600 px-6 py-3 rounded-t-2xl inline-block">{t('sim.energyCostProjTable')}</h3>
                        <div className="border-4 border-emerald-600 rounded-b-2xl rounded-tr-2xl overflow-hidden shadow-lg">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-emerald-50 text-emerald-800 uppercase font-black">
                                    <tr>
                                        <th className="py-3 px-4 border-r border-emerald-100">{t('sim.monthLabel')}</th>
                                        <th className="py-3 px-4 border-r border-emerald-100 text-right">{t('sim.degradationPctLabel')}</th>
                                        <th className="py-3 px-4 border-r border-emerald-100 text-right">{t('sim.powerKwLabel')}</th>
                                        <th className="py-3 px-4 border-r border-emerald-100 text-right">{t('sim.freqHzLabel')}</th>
                                        <th className="py-3 px-4 border-r border-emerald-100 text-right">{t('sim.effPctLabel')}</th>
                                        <th className="py-3 px-4 text-right">{t('sim.monthlyCostLabel')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-100 font-bold">
                                    {data.timeData.map((row: any, i: number) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-emerald-50/20"}>
                                            <td className="py-2 px-4 text-slate-700 border-r border-emerald-100">{t('sim.monthPrefix')} {row.month}</td>
                                            <td className="py-2 px-4 text-right font-mono border-r border-emerald-100 text-slate-500">{row.wearPct.toFixed(2)}%</td>
                                            <td className="py-2 px-4 text-right font-mono border-r border-emerald-100 text-slate-600">{row.kw.toFixed(1)}</td>
                                            <td className="py-2 px-4 text-right font-mono border-r border-emerald-100 text-slate-900">{row.freq.toFixed(1)}</td>
                                            <td className="py-2 px-4 text-right font-mono border-r border-emerald-100 text-emerald-600">{row.efficiency.toFixed(1)}%</td>
                                            <td className="py-2 px-4 text-right font-mono text-emerald-700 font-black">
                                                $ {row.monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold italic mt-2 px-2">{t('sim.vsdStrategyNotes', { flow: params.pressures.totalRate })}</p>
                    </div>

                    <div className="mb-0 break-inside-avoid flex-1">
                        <h3 className="font-black text-xs uppercase tracking-widest text-white bg-slate-900 px-6 py-3 rounded-t-2xl inline-block">{t('sim.designSensMatrix')}</h3>
                        <div className="border-4 border-slate-900 rounded-b-2xl rounded-tr-2xl overflow-hidden">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-slate-100 text-slate-600 uppercase font-black">
                                    <tr>
                                        <th className="py-3 px-4 border-r border-slate-200">{t('sim.mechProfile')}</th>
                                        <th className="py-3 px-2 border-r border-slate-200 text-center">{t('sim.unitAbbr')}</th>
                                        {tableData.map(col => (
                                            <th key={col.hz} className={`py-3 px-3 border-r border-slate-200 text-right ${col.hz === params.targets[params.activeScenario].frequency ? 'bg-blue-900 text-white' : ''}`}>
                                                {col.hz} Hz
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 font-bold">
                                    {rowDefinitions.map((row, i) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                            <td className="py-2 px-4 text-slate-700 border-r border-slate-200">{row.label}</td>
                                            <td className="py-2 px-2 text-center text-slate-400 border-r border-slate-200">{row.unit}</td>
                                            {tableData.map(col => (
                                                <td key={col.hz} className={`py-2 px-3 text-right font-mono border-r border-slate-200 ${col.hz === params.targets[params.activeScenario].frequency ? 'bg-blue-50/50 text-blue-900 font-black' : 'text-slate-500'}`}>
                                                    {row.fmt(col[row.key as keyof typeof col] as number)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReportMetric = ({ label, value, sub, color }: any) => (
    <div className={`p-5 bg-${color}-50 border border-${color}-100 rounded-3xl`}>
        <div className={`text-[9px] font-black text-${color}-800 uppercase tracking-widest mb-1 opacity-60`}>{label}</div>
        <div className={`text-2xl font-black text-${color}-900 tracking-tighter leading-none mb-1 text-slate-900`}>{value}</div>
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{sub}</div>
    </div>
);


// --- MAIN COMPONENT ---
export const PhaseSimulations: React.FC<Props> = ({ params, setParams, pump, frequency }) => {
    const { t } = useLanguage();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(150);
    const [showReport, setShowReport] = useState(false);
    const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const colorPrimary = 'rgb(var(--color-primary))';
    const colorSecondary = 'rgb(var(--color-secondary))';
    const colorGrid = 'rgb(var(--color-surface-light))';

    const handleSwitchScenario = (scenario: 'min' | 'target' | 'max') => {
        const data = params.targets[scenario];
        setParams(prev => ({
            ...prev,
            activeScenario: scenario,
            pressures: { ...prev.pressures, totalRate: data.rate },
            inflow: { ...prev.inflow, ip: data.ip },
            fluids: { ...prev.fluids, waterCut: data.waterCut, gor: data.gor, glr: data.gor * (1 - data.waterCut / 100) }
        }));
        setCurrentMonth(0);
        setIsPlaying(false);
    };

    const simulationData = useMemo(() => {
        if (!pump) return { timeData: [], startFlow: 0, endFlow: 0, totalCost: 0, startOP: { flow: 0, head: 0 }, startLoad: 0, endLoad: 0 };

        const sim = params.simulation || { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0.1 };
        const { annualWearPercent = 0, simulationMonths = 36, costPerKwh = 0.1 } = sim;
        const timeData = [];
        let totalCumulativeCost = 0;

        const baseFreq = pump.nameplateFrequency || 60;

        // 1. Encontrar el punto de diseño (Mes 0)
        // Usamos la frecuencia de diseño directamente para el mes 0
        let designFlow = 0;
        let designHead = 0;

        for (let m = 0; m <= simulationMonths; m++) {
            // Desgaste anual prorrateado mensualmente (12 meses)
            const wearPct = (annualWearPercent / 12) * m;
            const headWearFactor = Math.max(0.01, 1 - (wearPct / 100));
            const effWearFactor = Math.max(0.01, 1 - ((wearPct * 1.2) / 100));

            const degradedPump = {
                ...pump,
                h0: pump.h0 * headWearFactor, h1: pump.h1 * headWearFactor, h2: pump.h2 * headWearFactor,
                h3: pump.h3 * headWearFactor, h4: pump.h4 * headWearFactor, h5: pump.h5 * headWearFactor,
            };

            let requiredFreq = frequency; // Default para el inicio

            if (m === 0) {
                // MES 0: Punto de operación exacto con frecuencia de diseño
                let lowQ = 0, highQ = (pump.maxGraphRate || 5000) * (frequency / baseFreq) * 1.5;
                for (let k = 0; k < 25; k++) {
                    const midQ = (lowQ + highQ) / 2;
                    if ((calculateAffinityHead(midQ, frequency, baseFreq, degradedPump) || 0) > calculateTDH(midQ, params)) lowQ = midQ; else highQ = midQ;
                }
                designFlow = (lowQ + highQ) / 2;
                designHead = calculateTDH(designFlow, params);
                requiredFreq = frequency;
            } else {
                // MESES > 0: Intentar mantener el caudal de diseño incrementando frecuencia (Estrategia VSD)
                let lowF = 30, highF = 95;
                for (let k = 0; k < 20; k++) {
                    const midF = (lowF + highF) / 2;
                    const hPump = calculateAffinityHead(designFlow, midF, baseFreq, degradedPump) || 0;
                    const hSys = calculateTDH(designFlow, params);
                    if (hPump > hSys) highF = midF; else lowF = midF;
                }
                requiredFreq = (lowF + highF) / 2;
            }

            // Calcular el caudal real resultante bajo esta frecuencia (por si queda corto en limite 95Hz)
            let currentFlow = designFlow;
            if (requiredFreq > 94.9 || m === 0) {
                let lowQ = 0, highQ = (pump.maxGraphRate || 5000) * (requiredFreq / baseFreq) * 1.5;
                for (let k = 0; k < 25; k++) {
                    const midQ = (lowQ + highQ) / 2;
                    if ((calculateAffinityHead(midQ, requiredFreq, baseFreq, degradedPump) || 0) > calculateTDH(midQ, params)) lowQ = midQ; else highQ = midQ;
                }
                currentFlow = (lowQ + highQ) / 2;
            }

            const res = calculateSystemResults(currentFlow, null, params, degradedPump, requiredFreq);

            // La potencia se ve afectada por la caída de eficiencia del desgaste
            const wornBhp = (res.hpTotal || 0.1) / effWearFactor;

            // Load factor relativo al motor seleccionado
            const ratedHp = (params.selectedMotor?.hp || params.motorHp || 100);
            const loadPct = (wornBhp / ratedHp) * 100;

            const mPerf = params.selectedMotor ? calculateMotorPoly(loadPct, params.selectedMotor) : { ampsPct: 30 + (loadPct * 0.7), pf: 85, rpm: 3500, eff: 90 };
            const wornKw = (wornBhp * 0.746) / (Math.max(1, mPerf.eff) / 100);

            const monthlyCost = isNaN(wornKw) ? 0 : wornKw * 24 * 30 * costPerKwh;
            totalCumulativeCost += monthlyCost;

            timeData.push({
                month: m, wearPct, freq: requiredFreq, cumulativeCost: totalCumulativeCost, monthlyCost,
                flow: Math.round(currentFlow), head: Math.round(res.tdh || 0),
                efficiency: (res.effEstimated || 0) * effWearFactor,
                bhp: wornBhp, kw: wornKw, motorLoad: loadPct,
                ampsPct: mPerf.ampsPct, pf: mPerf.pf, rpm: mPerf.rpm, motorEff: mPerf.eff,
                op: { flow: Math.round(currentFlow), head: Math.round(res.tdh || 0) }
            });
        }

        return {
            timeData,
            startFlow: timeData[0]?.flow || 0,
            endFlow: timeData[timeData.length - 1]?.flow || 0,
            totalCost: totalCumulativeCost,
            startOP: timeData[0]?.op || { flow: 0, head: 0 },
            startLoad: timeData[0]?.motorLoad || 0,
            endLoad: timeData[timeData.length - 1]?.motorLoad || 0
        };
    }, [pump, params, frequency]);


    const multiAxisData = useMemo(() => {
        if (!pump) return [];
        const baseFreq = pump.nameplateFrequency || 60;
        const ratio = frequency / baseFreq;
        const sim = params.simulation || { annualWearPercent: 0 };
        const hWF = 1 - ((sim.annualWearPercent / 100) / 12 * currentMonth);
        const eWF = 1 - (((sim.annualWearPercent * 1.2) / 100) / 12 * currentMonth);

        const wc = params.fluids.waterCut / 100;
        const oilSg = 141.5 / (131.5 + params.fluids.apiOil);
        const waterSg = params.fluids.geWater;
        const mixSG = (waterSg * wc) + (oilSg * (1 - wc));

        const data = [];
        const maxFlow = (pump.maxGraphRate || 6000) * ratio * 1.2;
        const step = maxFlow / 60;

        for (let i = 0; i <= 60; i++) {
            const q = i * step;
            const qB = q / ratio;
            const hN = calculateBaseHead(qB, pump) * Math.pow(ratio, 2);
            const hC = hN * hWF;

            const pBase = [pump.p0, pump.p1, pump.p2, pump.p3, pump.p4, pump.p5].some(v => Math.abs(v) > 1e-6) ? calculateBasePowerPerStage(qB, pump) : 0;
            const pN = pBase * Math.pow(ratio, 3) * mixSG * (pump.stages || 1);
            const eN = pN > 0.01 ? ((q * hN * mixSG) / 135770 / pN) * 100 : 0;
            const eC = eN * eWF;
            const pC = eC > 0.01 ? pN * (hWF / eWF) : pN;

            if (hN > 5) data.push({
                flow: Math.round(q),
                headNew: Number(hN.toFixed(1)),
                headCurr: hC > 5 ? Number(hC.toFixed(1)) : null,
                effNew: eN > 0 ? Number(eN.toFixed(1)) : null,
                effCurr: eC > 0 ? Number(eC.toFixed(1)) : null,
                pwrNew: pN > 0 ? Number(pN.toFixed(1)) : null,
                pwrCurr: pC > 0 ? Number(pC.toFixed(1)) : null
            });
        }
        return data;
    }, [pump, params, frequency, currentMonth]);

    useEffect(() => {
        if (isPlaying) {
            simulationRef.current = setInterval(() => {
                setCurrentMonth(prev => prev >= (params.simulation?.simulationMonths || 36) ? (setIsPlaying(false), prev) : prev + 1);
            }, playbackSpeed);
        } else if (simulationRef.current) clearInterval(simulationRef.current);
        return () => { if (simulationRef.current) clearInterval(simulationRef.current); };
    }, [isPlaying, params.simulation?.simulationMonths, playbackSpeed]);

    const currentStats = simulationData.timeData[currentMonth];

    if (!pump) return <div className="p-20 text-center"><AlertTriangle className="w-16 h-16 mx-auto mb-6 text-txt-muted opacity-20" /><span className="text-xl font-black text-txt-muted uppercase tracking-[0.4em] opacity-40">System Core Offline: Pump Required</span></div>;

    return (
        <div className="min-h-full flex flex-col gap-6 animate-fadeIn pb-12 px-1">
            {showReport && <SimulationReport onClose={() => setShowReport(false)} data={simulationData} params={params} pump={pump} />}

            {/* HEADER */}
            <div className="flex justify-between items-center px-4 shrink-0 h-16 glass-surface rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute left-0 top-0 w-2 h-full bg-primary shadow-glow-primary"></div>
                <div className="flex items-center gap-5 relative z-10 pl-2">
                    <div className="p-3 bg-primary/20 rounded-2xl border border-white/10 shadow-glow-primary">
                        <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-txt-main uppercase tracking-tighter leading-none">Lifecycle Command Center</h2>
                        <p className="text-[10px] text-txt-muted font-black uppercase tracking-[0.2em] mt-1.5 opacity-60">System Degradation & OPEX Analytics</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 relative z-10 pr-2">
                    <div className="flex glass-surface p-1 rounded-2xl border border-white/5 shadow-inner shrink-0 relative overflow-hidden h-11 items-center px-1.5">
                        {['min', 'target', 'max'].map(s => (
                            <button key={s} onClick={() => handleSwitchScenario(s as any)} className={`px-5 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-500 relative z-10 ${params.activeScenario === s ? 'bg-primary/20 text-primary shadow-glow-primary/20 border border-primary/20' : 'text-txt-muted hover:text-txt-main'}`}>
                                {s === 'min' ? 'IDLE' : s === 'target' ? 'OBJ' : 'LIMIT'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowReport(true)} className="bg-secondary hover:bg-secondary/80 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2.5 shadow-xl shadow-secondary/20 hover:shadow-secondary/40 active:scale-95 light-sweep h-11">
                        <Printer className="w-4 h-4" /> Comprehensive Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1">

                {/* TIMELINE & CONFIG (Left Side) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 min-h-0">

                    {/* PLAYER CONTROL CENTER */}
                    <div className="glass-surface border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl flex flex-col justify-between h-[340px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-10">
                                <div>
                                    <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">Simulated Lifecycle</h3>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl font-black text-txt-main tracking-tighter leading-none">{currentMonth}</span>
                                        <span className="text-sm font-black text-txt-muted uppercase tracking-[0.2em]">Months / {params.simulation.simulationMonths}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setIsPlaying(!isPlaying)} className={`h-16 w-16 rounded-[2rem] flex items-center justify-center transition-all shadow-2xl ${isPlaying ? 'bg-surface-light text-secondary border border-secondary/20 animate-pulse' : 'bg-primary text-white hover:scale-110 shadow-glow-primary'}`}>
                                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                                    </button>
                                    <button onClick={() => { setIsPlaying(false); setCurrentMonth(0); }} className="h-16 w-16 rounded-[2rem] bg-surface-light border border-white/5 text-txt-muted hover:text-txt-main flex items-center justify-center hover:bg-white/10 transition-all active:rotate-[-90deg]">
                                        <RotateCcw className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <input type="range" min="0" max={params.simulation.simulationMonths} value={currentMonth} onChange={(e) => { setIsPlaying(false); setCurrentMonth(parseInt(e.target.value)); }} className="w-full h-3 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-secondary focus:ring-4 focus:ring-primary/20 border-none shadow-inner" />
                                <div className="flex justify-between text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-40">
                                    <span>T-ZERO: DEPLOYMENT</span>
                                    <span>T-TERM: {params.simulation.simulationMonths} MO</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* LIVE SIM METRICS GRID */}
                    <div className="grid grid-cols-2 gap-4">
                        <PremiumSimMetric label={t('tele.flow')} value={(currentStats?.flow || 0)} unit="BPD" icon={Droplets} color="primary" trend={currentStats ? ((currentStats.flow - simulationData.startFlow) / Math.max(1, simulationData.startFlow) * 100) : 0} />
                        <PremiumSimMetric label={t('tele.head')} value={(currentStats?.head || 0)} unit="FT" icon={ArrowDown} color="secondary" trend={currentStats ? ((currentStats.head - simulationData.startOP.head) / Math.max(1, simulationData.startOP.head) * 100) : 0} />
                        <PremiumSimMetric label={t('p5.efficiency')} value={(currentStats?.efficiency || 0).toFixed(1)} unit="%" icon={Zap} color="secondary" alert={(currentStats?.efficiency || 0) < 40} />
                        <PremiumSimMetric label={t('p5.motorLoad')} value={(currentStats?.ampsPct || 0).toFixed(1)} unit="%" icon={Gauge} color="primary" alert={(currentStats?.ampsPct || 0) > 95} />
                    </div>

                    {/* CONFIG CARD */}
                    <div className="glass-surface-light border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-6">
                            <Settings className="w-4 h-4 text-txt-muted" />
                            <h3 className="text-[10px] font-black text-txt-main uppercase tracking-[0.2em]">{t('sim.params')}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <PremiumParam label={t('sim.wear')} value={params.simulation.annualWearPercent} unit="%" onChange={(v) => setParams({ ...params, simulation: { ...params.simulation, annualWearPercent: v } })} />
                            <PremiumParam label={t('sim.energy')} value={params.simulation.costPerKwh} unit="$/kWh" onChange={(v) => setParams({ ...params, simulation: { ...params.simulation, costPerKwh: v } })} />
                            <PremiumParam label={t('sim.time')} value={params.simulation.simulationMonths} unit={t('sim.months')} onChange={(val) => setParams((prev: SystemParams) => ({ ...prev, simulation: { ...prev.simulation, simulationMonths: Number(val) } }))} />
                        </div>
                    </div>
                </div>

                {/* VISUAL ANALYTICS (Right Side) */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 min-h-0">

                    {/* PERFORMANCE CORE */}
                    <div className="glass-surface-light rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden p-3 relative flex flex-col shrink-0 group transition-all duration-700 min-h-[450px] lg:h-[480px]">
                        <div className="absolute top-6 left-8 z-20 flex gap-6 text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-60">
                            <div className="flex items-center gap-2.5"><div className="w-3 h-1 bg-primary rounded-full"></div>{t('sim.newCore')}</div>
                            <div className="flex items-center gap-2.5"><div className="w-3 h-1 bg-secondary rounded-full"></div>{t('sim.degradedState')} ({t('sim.monthLabel')} {currentMonth})</div>
                        </div>
                        <div className="flex-1 bg-surface/50 rounded-[2rem] overflow-hidden mt-8 p-4">
                            <PerformanceCurveMultiAxis data={multiAxisData} frequency={frequency} currentFlow={currentStats?.flow || 0} pump={pump} className="w-full h-full bg-transparent" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 min-h-[350px] lg:h-[380px]">
                        {/* LOAD PROFILE SENSITIVITY */}
                        <div className="glass-surface rounded-[2rem] border border-white/5 shadow-xl p-6 flex flex-col h-full bg-gradient-to-b from-secondary/5 to-transparent">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <div>
                                    <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-1">{t('sim.loadSensitivityChart')}</h3>
                                    <div className="text-3xl font-black text-txt-main tracking-tighter">{(currentMonth === 0 ? simulationData.timeData[0]?.ampsPct : currentStats?.ampsPct || 0).toFixed(1)}% <small className="text-xs text-txt-muted uppercase">{t('p6.amps')}</small></div>
                                </div>
                                <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20"><Activity className="w-6 h-6 text-secondary" /></div>
                            </div>
                            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-black/10 p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={simulationData.timeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--color-text-muted), 0.2)" />
                                        <XAxis dataKey="month" stroke="rgb(var(--color-text-main))" fontSize={9} tickFormatter={(v) => `M${v}`} />
                                        <YAxis domain={[0, 100]} stroke="rgb(var(--color-text-main))" fontSize={9} tickFormatter={(v) => `${v}%`} />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', border: '1px solid rgba(var(--color-text-main), 0.1)', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', color: 'rgb(var(--color-text-main))' }}
                                            itemStyle={{ padding: '2px 0' }}
                                        />
                                        <Line type="monotone" dataKey="ampsPct" stroke="#f59e0b" strokeWidth={4} dot={false} name="Amps Load" isAnimationActive={false} />
                                        <Line type="monotone" dataKey="motorEff" stroke="#10b981" strokeWidth={2} dot={false} name="Motor Eff" isAnimationActive={false} />
                                        <ReferenceLine x={currentMonth} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={2} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* MONTHLY ENERGY COST */}
                        <div className="glass-surface rounded-[2rem] border border-white/5 shadow-xl p-6 flex flex-col h-full bg-gradient-to-b from-emerald-500/5 to-transparent">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <div>
                                    <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-1">{t('sim.monthlyEnergyChart')}</h3>
                                    <div className="text-3xl font-black text-txt-main tracking-tighter">${(currentStats?.monthlyCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                </div>
                                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"><DollarSign className="w-6 h-6 text-emerald-500" /></div>
                            </div>
                            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-black/10 p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={simulationData.timeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="mainCostGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--color-text-muted), 0.2)" />
                                        <XAxis dataKey="month" stroke="rgb(var(--color-text-main))" fontSize={9} tickFormatter={(v) => `M${v}`} />
                                        <YAxis stroke="rgb(var(--color-text-main))" fontSize={9} tickFormatter={(v) => `$${v}`} />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', border: '1px solid rgba(var(--color-text-main), 0.1)', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', color: 'rgb(var(--color-text-main))' }}
                                            formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Cost']}
                                        />
                                        <Area type="monotone" dataKey="monthlyCost" stroke="#10b981" fill="url(#mainCostGrad)" strokeWidth={4} isAnimationActive={false} />
                                        <ReferenceLine x={currentMonth} stroke="#10b981" strokeDasharray="3 3" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* MOTOR BEHAVIOR */}
                        <div className="glass-surface rounded-[2rem] border border-white/5 shadow-xl p-6 flex flex-col h-full bg-gradient-to-b from-secondary/5 to-transparent">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <div>
                                    <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-1">{t('sim.thermalTorque')}</h3>
                                    <div className="text-3xl font-black text-txt-main tracking-tighter">{(currentStats?.motorLoad || 0).toFixed(1)}% <small className="text-xs text-txt-muted uppercase">{t('p5.motorLoad')}</small></div>
                                </div>
                                <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20"><Zap className="w-6 h-6 text-secondary" /></div>
                            </div>
                            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-black/10">
                                <MotorCurveMultiAxis motor={params.selectedMotor} currentLoad={currentStats?.motorLoad || 0} startLoad={simulationData.startLoad} endLoad={simulationData.endLoad} className="w-full h-full bg-transparent" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PremiumSimMetric = ({ label, value, unit, icon: Icon, color, trend, alert }: any) => (
    <div className={`glass-surface rounded-2xl border ${alert ? 'border-danger shadow-glow-danger/20' : 'border-white/5'} p-5 flex flex-col justify-between group h-[130px] relative overflow-hidden transition-all hover:scale-[1.02] light-sweep`}>
        <div className={`absolute -right-6 -top-6 w-20 h-20 shadow-glow-${color === 'primary' ? 'primary' : 'secondary'}/5 blur-3xl rounded-full`}></div>
        <div className="flex justify-between items-start relative z-10">
            <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-40">{label}</span>
            <div className={`p-2 ${color === 'primary' ? 'bg-primary/10 text-primary border-primary/10' : 'bg-secondary/10 text-secondary border-secondary/10'} rounded-xl border`}>
                <Icon className="w-3.5 h-3.5" />
            </div>
        </div>
        <div className="mt-auto relative z-10">
            <div className="flex items-baseline gap-2">
                <div className={`text-2xl font-black ${alert ? 'text-danger' : 'text-txt-main'} tracking-tighter leading-none`}>{value}</div>
                <div className="text-[9px] font-black text-txt-muted uppercase opacity-40">{unit}</div>
            </div>
            {trend !== undefined && (
                <div className={`text-[9px] font-black mt-2 ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
                    {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs Start
                </div>
            )}
        </div>
    </div>
);

const PremiumParam = ({ label, value, unit, onChange }: any) => (
    <div className="glass-surface-light border border-white/5 rounded-xl p-3 flex justify-between items-center group hover:bg-white/5 transition-all">
        <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-60">{label}</span>
        <div className="flex items-center gap-2">
            <input type="number" step="0.1" value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="bg-transparent text-right text-xs font-black text-txt-main outline-none w-12 font-mono" />
            <span className="text-[9px] font-black text-txt-muted uppercase opacity-40">{unit}</span>
        </div>
    </div>
);

