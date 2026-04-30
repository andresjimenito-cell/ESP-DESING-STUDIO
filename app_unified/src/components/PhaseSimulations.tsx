
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Activity, Clock, Layers, Play, Pause, RotateCcw, AlertTriangle, Settings, Zap, Droplets, ArrowDown, Gauge, Cpu, TrendingDown, Printer, X, Download, FileText, PieChart, DollarSign } from 'lucide-react';
import { EspPump, SystemParams } from '../types';
import { calculateTDH, calculateBaseHead, calculateAffinityHead, findIntersection, calculateSystemResults, calculateBasePowerPerStage, calculateMotorPoly, generateMultiCurveData, interpolateTVD } from '../utils';
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

                    {/* NEW: ENERGY & PERFORMANCE TABLE */}
                    <div className="mb-10 break-inside-avoid">
                        <h3 className="font-black text-xs uppercase tracking-widest text-white bg-emerald-600 px-6 py-3 rounded-t-2xl inline-block">Lifecycle Performance Table</h3>
                        <div className="border-4 border-emerald-600 rounded-b-2xl rounded-tr-2xl overflow-hidden shadow-lg">
                            <table className="w-full text-[9px] text-left">
                                <thead className="bg-emerald-50 text-emerald-800 uppercase font-black">
                                    <tr>
                                        <th className="py-3 px-2 border-r border-emerald-100">Mes</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">BFPD</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">BSW %</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">IP</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">PWF</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">Pwf Min</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">% Degr</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">kW (Sys)</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">kWh/mes</th>
                                        <th className="py-3 px-2 border-r border-emerald-100 text-right">Frec Hz</th>
                                        <th className="py-3 px-2 text-right">%Eff</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-100 font-bold">
                                    {data.timeData.map((row: any, i: number) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-emerald-50/20"}>
                                            <td className="py-2 px-2 text-slate-700 border-r border-emerald-100 font-black">{row.month}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100">{row.flow.toFixed(0)}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-slate-500">{row.bsw.toFixed(1)}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-slate-500">{row.ip.toFixed(2)}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-slate-500">{row.pwf.toFixed(0)}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-slate-400 text-[10px]">{row.pwfMin.toFixed(0)}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-red-500">{row.wearPct.toFixed(2)}%</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-slate-600">{row.kw.toFixed(1)}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-emerald-600">{row.monthlyKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td className="py-2 px-2 text-right font-mono border-r border-emerald-100 text-slate-600">{row.freq.toFixed(1)}</td>
                                            <td className="py-2 px-2 text-right font-mono text-emerald-700 font-black">{row.efficiency.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold italic mt-2 px-2">* Estrategia VSD: Frecuencia ajustada para mantener Caudal Objetivo de {params.targets[params.activeScenario].rate} BPD.</p>
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

    useEffect(() => {
        // Default to 'min' scenario for lifecycle analysis if not already set or first time
        if (params.activeScenario === 'target') {
            handleSwitchScenario('min');
        }
    }, []);

    const simulationData = useMemo(() => {
        if (!pump) return { timeData: [], allScenarios: {}, totalCost: 0, startLoad: 0, endLoad: 0 };

        const simParams = params.simulation || { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0.1 };
        const { annualWearPercent = 0, simulationMonths = 36, costPerKwh = 0.1 } = simParams;
        const baseFreq = pump.nameplateFrequency || 60;

        const scenariosKeys = ['min', 'target', 'max'] as const;
        const allScenarios: Record<string, any[]> = { min: [], target: [], max: [] };
        let grandTotalCost = 0;

        for (const sKey of scenariosKeys) {
            const targetData = params.targets[sKey];
            const sStartFreq = targetData.frequency || 60;

            // Create a local param set for this scenario
            const sParams = {
                ...params,
                inflow: { ...params.inflow, ip: targetData.ip },
                fluids: { ...params.fluids, waterCut: targetData.waterCut, gor: targetData.gor, glr: targetData.gor * (1 - targetData.waterCut / 100) },
                pressures: { ...params.pressures, totalRate: targetData.rate }
            };

            const sTimeData = [];
            let totalCumulativeCost = 0;

            const designFlowBase = (params.simulation.qInitial !== undefined ? params.simulation.qInitial : targetData.rate) || 500;
            const annualFlowGrowth = params.simulation.ipType === 'variable' ? (params.simulation.qGrowthRate || 0) : 0;
            const monthlyFlowGrowthFactor = annualFlowGrowth / 100 / 12;

            for (let m = 0; m <= simulationMonths; m++) {
                const wearPct = (m * annualWearPercent) / Math.max(1, simulationMonths);
                const headWearFactor = Math.max(0.01, 1 - (wearPct / 100));
                const effWearFactorApplied = Math.max(0.01, 1 - ((wearPct * 1.2) / 100));

                const targetFlow = designFlowBase * (1 + (m * monthlyFlowGrowthFactor));

                const degradedPump = {
                    ...pump,
                    h0: pump.h0 * headWearFactor, h1: pump.h1 * headWearFactor, h2: pump.h2 * headWearFactor,
                    h3: pump.h3 * headWearFactor, h4: pump.h4 * headWearFactor, h5: pump.h5 * headWearFactor,
                };

                // --- 1. CALCULATE PWF MIN & IP REQUISITES ---
                const pStatic = sParams.inflow.pStatic || 1000;
                const perfsTVD = interpolateTVD(sParams.wellbore.midPerfsMD || sParams.pressures.pumpDepthMD, params.survey);
                const pumpTVD = interpolateTVD(sParams.pressures.pumpDepthMD, params.survey);
                const dTVD_below = Math.max(0, perfsTVD - pumpTVD);
                const waterSG = sParams.fluids.geWater || 1.0;
                const oilSg = 141.5 / (131.5 + (sParams.fluids.apiOil || 35));
                const wc = (sParams.fluids.waterCut || 0) / 100;
                const mixSgLiq = (waterSG * wc) + (oilSg * (1 - wc));

                // Pwf Min = 200 psi PIP min + Hydrostatic from perfs to pump
                const pwfMin = 200 + (dTVD_below * 0.433 * mixSgLiq);

                // --- 2. FIND FREQUENCY TO ACHIEVE targetFlow ---
                // We must solve for frequency F such that PumpHead(F, targetFlow) = SystemHead(targetFlow)
                // System head is constant for a fixed targetFlow (ignoring PVT changes due to Pwf)
                const hSys = calculateTDH(targetFlow, sParams);
                let lowF = 30, highF = 95;
                for (let k = 0; k < 20; k++) {
                    const midF = (lowF + highF) / 2;
                    const hPump = calculateAffinityHead(targetFlow, midF, baseFreq, degradedPump) || 0;
                    if (hPump > hSys) highF = midF; else lowF = midF;
                }
                const requiredFreq = (lowF + highF) / 2;

                // --- 3. GET SYSTEM RESULTS ---
                const res = calculateSystemResults(targetFlow, null, sParams, degradedPump, requiredFreq);

                // Calculate Required IP based on Pstatic and PwfMin
                const safeDrawdown = Math.max(1, pStatic - pwfMin);
                const calculatedIp = targetFlow / safeDrawdown;

                // wornBhp is the shaft power required accounting for additional internal wear
                const wornBhp = (res.hpTotal || 0.1) / effWearFactorApplied;
                const ratedHp = (params.selectedMotor?.hp || params.motorHp || 100);
                const loadPct = (wornBhp / ratedHp) * 100;

                // Recalculate motor performance for the worn BHP load
                const mPerf = params.selectedMotor ? calculateMotorPoly(loadPct, params.selectedMotor) : { ampsPct: 30 + (loadPct * 0.7), pf: 85, rpm: 3500, eff: 90 };

                // System KW is the power at the surface (VSD input), adjusted for wear
                const wornSystemKw = (res.electrical.systemKw || 0) / effWearFactorApplied;
                const monthlyKwh = wornSystemKw * 24 * 30;
                const monthlyCost = isNaN(monthlyKwh) ? 0 : monthlyKwh * costPerKwh;
                totalCumulativeCost += monthlyCost;

                sTimeData.push({
                    month: m, scenario: sKey, wearPct, freq: requiredFreq, cumulativeCost: totalCumulativeCost, monthlyCost,
                    flow: Math.round(targetFlow), head: Math.round(res.tdh || 0),
                    bsw: sParams.fluids.waterCut, ip: calculatedIp, pwf: res.pwf || 0,
                    pwfMin,
                    efficiency: (res.effEstimated || 0) * effWearFactorApplied,
                    bhp: wornBhp, kw: wornSystemKw, monthlyKwh, motorLoad: loadPct,
                    ampsPct: mPerf.ampsPct, pf: mPerf.pf, rpm: mPerf.rpm, motorEff: mPerf.eff,
                    op: { flow: Math.round(targetFlow), head: Math.round(res.tdh || 0) }
                });
            }
            allScenarios[sKey] = sTimeData;
            if (sKey === params.activeScenario) grandTotalCost = totalCumulativeCost;
        }

        const activeData = allScenarios[params.activeScenario] || [];

        return {
            timeData: activeData,
            allScenarios,
            totalCost: grandTotalCost,
            startFlow: activeData[0]?.flow || 0,
            endFlow: activeData[activeData.length - 1]?.flow || 0,
            startOP: activeData[0]?.op || { flow: 0, head: 0 },
            startLoad: activeData[0]?.motorLoad || 0,
            endLoad: activeData[activeData.length - 1]?.motorLoad || 0
        };
    }, [pump, params, frequency]);


    const multiAxisData = useMemo(() => {
        if (!pump) return [];
        const baseFreq = pump.nameplateFrequency || 60;
        const ratio = frequency / baseFreq;
        const sim = params.simulation || { annualWearPercent: 0, simulationMonths: 36 };
        const hWF = 1 - (((currentMonth * sim.annualWearPercent) / Math.max(1, sim.simulationMonths)) / 100);
        const eWF = 1 - (((currentMonth * sim.annualWearPercent * 1.2) / Math.max(1, sim.simulationMonths)) / 100);

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
        <div className="min-h-full flex flex-col gap-5 animate-fadeIn pb-8 px-2">
            {showReport && <SimulationReport onClose={() => setShowReport(false)} data={simulationData} params={params} pump={pump} />}

            {/* --- TOP BAR / COMMAND CENTER --- */}
            <div className="flex justify-between items-center px-6 h-16 glass-surface rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden shrink-0">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-gradient-to-b from-primary to-secondary shadow-glow-primary"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-glow-primary/20">
                        <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-txt-main uppercase tracking-tight leading-none">ESP Lifecycle Simulator</h2>
                        <p className="text-[9px] text-txt-muted font-black uppercase tracking-widest mt-1 opacity-50">Operational Intelligence & Degradation Analysis</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="flex bg-surface/40 p-1 rounded-xl border border-white/5 shadow-inner">
                        {['min', 'target', 'max'].map(s => (
                            <button
                                key={s}
                                onClick={() => handleSwitchScenario(s as any)}
                                className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all duration-300 ${params.activeScenario === s ? 'bg-primary text-white shadow-glow-primary' : 'text-txt-muted hover:text-txt-main hover:bg-white/5'}`}
                            >
                                {s === 'min' ? 'Idle' : s === 'target' ? 'Design' : 'Limit'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowReport(true)} className="bg-secondary hover:bg-secondary/80 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 shadow-lg shadow-secondary/20 hover:shadow-secondary/40 active:scale-95 h-10">
                        <Printer className="w-3.5 h-3.5" /> Full Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">

                {/* --- LEFT SIDEBAR: CONTROL & CONFIG --- */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-1">

                    {/* TIMELINE COCKPIT */}
                    <div className="glass-surface border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group flex flex-col gap-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">Time Elapsed</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black text-txt-main tracking-tighter">{currentMonth}</span>
                                        <span className="text-[10px] font-black text-txt-muted uppercase opacity-50">MO / {params.simulation.simulationMonths}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsPlaying(!isPlaying)} className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isPlaying ? 'bg-surface-light text-secondary border border-secondary/20 shadow-glow-secondary/20' : 'bg-primary text-white hover:scale-105 shadow-glow-primary'}`}>
                                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                                    </button>
                                    <button onClick={() => { setIsPlaying(false); setCurrentMonth(0); }} className="h-12 w-12 rounded-2xl bg-surface-light border border-white/5 text-txt-muted hover:text-txt-main flex items-center justify-center hover:bg-white/10 transition-all">
                                        <RotateCcw className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="range"
                                    min="0"
                                    max={params.simulation.simulationMonths}
                                    value={currentMonth}
                                    onChange={(e) => { setIsPlaying(false); setCurrentMonth(parseInt(e.target.value)); }}
                                    className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-secondary shadow-inner"
                                />
                                <div className="flex justify-between text-[8px] font-black text-txt-muted uppercase tracking-widest opacity-40">
                                    <span>Deployment</span>
                                    <span>End of Life</span>
                                </div>
                            </div>
                        </div>

                        {/* QUICK STATS IN SIDEBAR */}
                        <div className="grid grid-cols-2 gap-3 relative z-10 pt-4 border-t border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-txt-muted uppercase opacity-40 mb-1">Monthly OPEX</span>
                                <span className="text-sm font-black text-emerald-500">${(currentStats?.monthlyCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] font-black text-txt-muted uppercase opacity-40 mb-1">Cumulative</span>
                                <span className="text-sm font-black text-txt-main">${(currentStats?.cumulativeCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>

                    {/* CONFIGURATION TOWER */}
                    <div className="glass-surface-light border border-white/5 rounded-[2.5rem] p-6 shadow-xl flex flex-col gap-5">
                        <div className="flex items-center gap-2 mb-1">
                            <Settings className="w-3.5 h-3.5 text-primary" />
                            <h3 className="text-[10px] font-black text-txt-main uppercase tracking-[0.2em]">{t('sim.params')}</h3>
                        </div>

                        <div className="flex flex-col gap-3">
                            <PremiumParam label={t('sim.wear')} value={params.simulation.annualWearPercent} unit="%" onChange={(v: any) => setParams({ ...params, simulation: { ...params.simulation, annualWearPercent: v } })} />
                            <PremiumParam label={t('sim.energy')} value={params.simulation.costPerKwh} unit="$/kWh" onChange={(v: any) => setParams({ ...params, simulation: { ...params.simulation, costPerKwh: v } })} />
                            <PremiumParam label={t('sim.time')} value={params.simulation.simulationMonths} unit={t('sim.months')} onChange={(val: any) => setParams((prev: SystemParams) => ({ ...prev, simulation: { ...prev.simulation, simulationMonths: Number(val) } }))} />
                        </div>

                        <div className="pt-4 border-t border-white/5 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-40">{t('sim.qType')}</span>
                                <div className="flex bg-surface-light p-1 rounded-lg border border-white/5">
                                    <button
                                        onClick={() => setParams({ ...params, simulation: { ...params.simulation, ipType: 'fixed' } })}
                                        className={`px-3 py-1 rounded-md text-[8px] font-black transition-all ${params.simulation.ipType === 'fixed' ? 'bg-primary text-white shadow-glow-primary' : 'text-txt-muted hover:text-txt-main'}`}
                                    >
                                        {t('sim.fixed')}
                                    </button>
                                    <button
                                        onClick={() => setParams({ ...params, simulation: { ...params.simulation, ipType: 'variable' } })}
                                        className={`px-3 py-1 rounded-md text-[8px] font-black transition-all ${params.simulation.ipType === 'variable' ? 'bg-secondary text-white shadow-glow-secondary' : 'text-txt-muted hover:text-txt-main'}`}
                                    >
                                        {t('sim.variable')}
                                    </button>
                                </div>
                            </div>

                            <PremiumParam
                                label={params.simulation.ipType === 'variable' ? t('sim.qInitial') : t('sim.qTarget')}
                                value={params.simulation.qInitial !== undefined ? params.simulation.qInitial : params.targets[params.activeScenario].rate}
                                unit="BFPD"
                                onChange={(v: any) => setParams({ ...params, simulation: { ...params.simulation, qInitial: v } })}
                            />

                            {params.simulation.ipType === 'variable' && (
                                <PremiumParam
                                    label={t('sim.qGrowth')}
                                    value={params.simulation.qGrowthRate || 0}
                                    unit="% / Yr"
                                    onChange={(v: any) => setParams({ ...params, simulation: { ...params.simulation, qGrowthRate: v } })}
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <PremiumSimMetric label={t('tele.flow')} value={(currentStats?.flow || 0)} unit="BPD" icon={Droplets} color="primary" trend={currentStats ? ((currentStats.flow - simulationData.startFlow) / Math.max(1, simulationData.startFlow) * 100) : 0} />
                        <PremiumSimMetric label={t('tele.head')} value={(currentStats?.head || 0)} unit="FT" icon={ArrowDown} color="secondary" trend={currentStats ? ((currentStats.head - (simulationData.startOP?.head || 0)) / Math.max(1, simulationData.startOP?.head || 1) * 100) : 0} />
                        <PremiumSimMetric label="Eff" value={(currentStats?.efficiency || 0).toFixed(1)} unit="%" icon={Zap} color="primary" alert={(currentStats?.efficiency || 0) < 40} />
                        <PremiumSimMetric label="Load" value={(currentStats?.ampsPct || 0).toFixed(1)} unit="%" icon={Gauge} color="secondary" alert={(currentStats?.ampsPct || 0) > 95} />
                    </div>
                </div>

                {/* --- MAIN ANALYTICS DASHBOARD --- */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-5 overflow-y-auto custom-scrollbar">

                    {/* PRIMARY VISUALIZATION GRID */}
                    <div className="grid grid-cols-12 gap-5 min-h-[500px]">
                        {/* THE PUMP MAP */}
                        <div className="col-span-12 lg:col-span-8 relative">
                            <div className="absolute top-10 left-10 z-20 flex gap-5 text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-60 pointer-events-none">
                                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-primary rounded-full"></div> New</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-secondary rounded-full"></div> Degraded (M{currentMonth})</div>
                            </div>
                            <PerformanceCurveMultiAxis data={multiAxisData} frequency={frequency} currentFlow={currentStats?.flow || 0} pump={pump} className="w-full h-full" />
                        </div>

                        {/* SECONDARY INSIGHTS COLUMN */}
                        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
                            {/* MOTOR PERFORMANCE / THERMAL MAP */}
                            <div className="flex-1">
                                <MotorCurveMultiAxis
                                    motor={params.selectedMotor}
                                    currentLoad={currentStats?.motorLoad || 0}
                                    startLoad={simulationData.startLoad}
                                    endLoad={simulationData.endLoad}
                                    intakeTemp={params.bottomholeTemp}
                                    className="w-full h-full"
                                />
                            </div>

                            {/* COST EVOLUTION (Mini Chart) */}
                            <div className="h-[220px] bg-surface rounded-[32px] border border-white/5 shadow-2xl p-6 flex flex-col relative overflow-hidden group">
                                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full"></div>
                                <div className="flex justify-between items-center mb-4 shrink-0 relative z-10">
                                    <h3 className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">{t('sim.monthlyEnergyChart')}</h3>
                                    <DollarSign className="w-4 h-4 text-emerald-500 opacity-50" />
                                </div>
                                <div className="flex-1 min-h-0 relative z-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={simulationData.timeData}>
                                            <defs>
                                                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="monthlyCost" stroke="#10b981" fill="url(#costGrad)" strokeWidth={3} isAnimationActive={false} />
                                            <ReferenceLine x={currentMonth} stroke="#10b981" strokeDasharray="3 3" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-2 text-right relative z-10">
                                    <span className="text-xl font-black text-txt-main tracking-tighter">${(currentStats?.monthlyCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- THE MASTER DATA LOG (TABLE) --- */}
                    <div className="glass-surface-light rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col shrink-0 group transition-all duration-700">
                        <div className="flex items-center justify-between px-8 py-5 bg-surface/40 border-b border-white/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Layers className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-txt-main uppercase tracking-[0.2em]">Lifecycle Intelligence Table</h3>
                                    <p className="text-[8px] text-txt-muted uppercase tracking-widest font-bold opacity-50">High-Resolution Temporal Log</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 rounded-xl border border-white/5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[9px] font-black text-txt-muted uppercase">Active Scenario: {params.activeScenario}</span>
                                </div>
                            </div>
                        </div>
                        <div className="max-h-[500px] overflow-auto custom-scrollbar">
                            <table className="w-full text-[10px] text-left border-collapse">
                                <thead className="bg-surface/60 text-txt-muted uppercase font-black sticky top-0 z-20 backdrop-blur-md">
                                    <tr>
                                        <th className="py-4 px-6 border-b border-white/5">Month</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right">BFPD</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right">BSW</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right">IP</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right">PWF</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right text-danger/60">PWF Min</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right">% Degr</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right">kW (Sys)</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right text-emerald-500">kWh/mo</th>
                                        <th className="py-4 px-3 border-b border-white/5 text-right">Freq Hz</th>
                                        <th className="py-4 px-6 border-b border-white/5 text-right">%Eff</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-bold">
                                    {simulationData.timeData.map((row: any, m: number) => {
                                        const isActive = m === currentMonth;
                                        return (
                                            <tr key={m} className={`hover:bg-white/5 transition-colors group/row ${isActive ? 'bg-primary/10 text-white' : 'text-txt-muted'}`}>
                                                <td className={`py-3 px-6 font-black ${isActive ? 'text-primary' : 'text-txt-main opacity-40'} transition-all`}>{m}</td>
                                                <td className="py-3 px-3 text-right font-mono text-txt-main">{row.flow}</td>
                                                <td className="py-3 px-3 text-right font-mono">{row.bsw.toFixed(1)}</td>
                                                <td className="py-3 px-3 text-right font-mono text-primary font-black">{row.ip.toFixed(2)}</td>
                                                <td className={`py-3 px-3 text-right font-mono ${row.pwf < row.pwfMin ? 'text-danger animate-pulse' : ''}`}>{row.pwf.toFixed(0)}</td>
                                                <td className="py-3 px-3 text-right font-mono text-txt-muted/30 text-[9px] italic">{row.pwfMin.toFixed(0)}</td>
                                                <td className="py-3 px-3 text-right font-mono text-danger/80">{row.wearPct.toFixed(2)}%</td>
                                                <td className="py-3 px-3 text-right font-mono text-primary/80">{row.kw.toFixed(1)}</td>
                                                <td className="py-3 px-3 text-right font-mono text-emerald-500/80">{row.monthlyKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                <td className="py-3 px-3 text-right font-mono text-secondary/80">{row.freq.toFixed(1)}</td>
                                                <td className="py-3 px-6 text-right font-mono text-success/80">{row.efficiency.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-surface/20 border-t border-white/5 flex justify-end shrink-0">
                            <div className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-40">
                                Total OPEX Estimated: <span className="text-txt-main ml-2">${simulationData.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};



const PremiumParam = ({ label, value, unit, onChange }: any) => (
    <div className="glass-surface-light border border-white/5 rounded-xl p-3 flex justify-between items-center group hover:bg-white/5 transition-all">
        <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-50">{label}</span>
        <div className="flex items-center gap-2">
            <input
                type="number"
                step="0.1"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="bg-transparent text-right text-xs font-black text-txt-main outline-none w-14 font-mono focus:text-primary transition-colors"
            />
            <span className="text-[9px] font-black text-txt-muted uppercase opacity-30">{unit}</span>
        </div>
    </div>
);

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

