
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Gauge, Printer, Droplets, ArrowDown, ClipboardCheck, X, Hammer, Thermometer, RefreshCw, Maximize2, Minimize2, Brain, Calendar, Play } from 'lucide-react';
import { SystemParams, EspPump, ScenarioData } from '../types';
import { calculateTDH, calculateSystemResults, calculateBaseHead, calculatePDP, calculateFluidProperties, interpolateTVD } from '../utils';
import { PumpChart } from './PumpChart';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams; // Design Params
    pump: EspPump | null;
    designFreq: number;
}

// --- HELPER: SHAFT LIMIT ESTIMATION ---
const getShaftLimitHp = (series: string): number => {
    if (series.includes("338")) return 140;
    if (series.includes("400")) return 250;
    if (series.includes("538")) return 580;
    if (series.includes("562")) return 650;
    if (series.includes("675")) return 950;
    return 300; // Default fallback
};

// Helper to reconstruct params from a scenario
const getScenarioParams = (baseParams: SystemParams, scenario: ScenarioData): SystemParams => {
    return {
        ...baseParams,
        inflow: { ...baseParams.inflow, ip: scenario.ip },
        fluids: { 
            ...baseParams.fluids, 
            waterCut: scenario.waterCut, 
            gor: scenario.gor, 
            glr: scenario.gor * (1 - scenario.waterCut/100) 
        },
        pressures: { ...baseParams.pressures, totalRate: scenario.rate }
    };
};

// --- REPORT COMPONENT (PRINT VIEW) ---
const HistoryMatchReport = ({ onClose, designParams, actualParams, pump, designRes, actualRes, designFreq, actualFreq, chartData, mechanics, compareScenario, fieldData, refPoints, calculatedIP, aiAnalysis }: any) => {
    const { t } = useLanguage();

    const handlePrint = () => {
        const originalTitle = document.title;
        document.title = `History_Match_Report_${new Date().toISOString().split('T')[0]}`;
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 500);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-canvas overflow-hidden flex flex-col animate-fadeIn">
            {/* Action Bar */}
            <div className="h-16 bg-surface border-b border-surface-light flex items-center justify-between px-8 shadow-2xl shrink-0 no-print z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-600 p-2 rounded-lg text-white"><Printer className="w-5 h-5"/></div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">{t('p6.reportTitle')}</h3>
                        <p className="text-xs text-txt-muted font-bold">Post-Job Analysis</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase shadow-lg shadow-amber-900/20 transition-all transform active:scale-95">
                        <Printer className="w-4 h-4" /> Print / Save PDF
                    </button>
                    <button onClick={onClose} className="p-2.5 bg-surface-light hover:bg-red-500/20 text-txt-muted hover:text-red-500 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-canvas p-8 custom-scrollbar">
                <style>{`
                    @media print {
                        @page { margin: 0.5cm; size: auto; }
                        html, body, #root { height: auto !important; overflow: visible !important; background: white !important; }
                        body * { visibility: hidden; }
                        #history-report-paper, #history-report-paper * { visibility: visible; }
                        #history-report-paper {
                            position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0;
                            background: white !important; color: black !important; box-shadow: none !important; min-height: 0 !important;
                        }
                        .no-print { display: none !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>

                <div id="history-report-paper" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl rounded-sm p-10 md:p-12 text-slate-900 flex flex-col relative">
                    <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{t('p6.reportTitle')}</h1>
                            <p className="font-bold text-slate-500 uppercase text-xs tracking-widest">{t('p6.reportSub')} ({compareScenario.toUpperCase()})</p>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Analysis Date</div>
                            <div className="text-sm font-black text-slate-900">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="mb-8 p-6 bg-blue-50 border border-blue-100 rounded-xl break-inside-avoid">
                        <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-2"><Brain className="w-4 h-4"/> AI Diagnostic</h4>
                        <p className="text-sm font-medium text-blue-900 leading-relaxed">{aiAnalysis || "No AI analysis generated."}</p>
                    </div>

                    <div className="mb-10 break-inside-avoid">
                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 mb-4 border-b-2 border-slate-200 pb-1">1. {t('p6.perfComp')}</h3>
                        <div className="h-[450px] w-full border border-slate-200 rounded-xl overflow-hidden bg-slate-50 print:border-slate-300">
                            <PumpChart 
                                data={chartData} 
                                pump={pump} 
                                currentFrequency={actualFreq}
                                intersectionPoint={{ flow: fieldData.rate, head: actualRes.tdh }} 
                                referencePoints={refPoints}
                                targetFlow={fieldData.rate}
                                className="w-full h-full bg-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-10 break-inside-avoid">
                        <div>
                            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 mb-4 border-b-2 border-slate-200 pb-1">2. {t('p6.hydData')}</h3>
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                                        <th className="p-2 font-black border-b border-slate-200">{t('p6.param')}</th>
                                        <th className="p-2 font-black border-b border-slate-200 text-right">{t('p6.unit')}</th>
                                        <th className="p-2 font-black border-b border-slate-200 text-right text-emerald-600">Actual</th>
                                        <th className="p-2 font-black border-b border-slate-200 text-right">{t('p6.delta')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
                                    {[
                                        { lbl: t('tele.flow'), unit: 'BPD', d: designParams.pressures.totalRate, a: fieldData.rate },
                                        { lbl: t('p5.freq'), unit: 'Hz', d: designFreq, a: fieldData.frequency },
                                        { lbl: t('p3.pi'), unit: 'bpd/psi', d: designParams.inflow.ip, a: calculatedIP },
                                        { lbl: t('p3.thp'), unit: 'psi', d: designParams.pressures.pht, a: fieldData.thp },
                                        { lbl: t('p3.pip'), unit: 'psi', d: designRes.pip, a: fieldData.pip },
                                        { lbl: t('tele.head'), unit: 'ft', d: designRes.tdh, a: actualRes.tdh },
                                    ].map((row, i) => {
                                        const delta = row.d !== 0 ? ((row.a - row.d) / row.d) * 100 : 0;
                                        return (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="p-2 font-bold text-slate-800">{row.lbl}</td>
                                                <td className="p-2 text-right text-slate-400 font-mono text-[10px] uppercase">{row.unit}</td>
                                                <td className="p-2 text-right font-mono font-bold text-emerald-700">{row.a?.toFixed(1)}</td>
                                                <td className={`p-2 text-right font-mono font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div>
                            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 mb-4 border-b-2 border-slate-200 pb-1">3. {t('p6.mechAnalysis')}</h3>
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                                        <th className="p-2 font-black border-b border-slate-200">Component</th>
                                        <th className="p-2 font-black border-b border-slate-200 text-right">{t('p6.unit')}</th>
                                        <th className="p-2 font-black border-b border-slate-200 text-right">Load</th>
                                        <th className="p-2 font-black border-b border-slate-200 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
                                    {[
                                        { lbl: 'Pump Efficiency', val: mechanics.efficiency },
                                        { lbl: 'Motor Power Load', val: mechanics.motorLoad },
                                        { lbl: 'Pump Shaft Load', val: mechanics.pumpShaftPct },
                                        { lbl: 'Motor Shaft Load', val: mechanics.motorShaftPct },
                                        { lbl: 'Seal Shaft Load', val: mechanics.sealShaftPct },
                                        { lbl: 'Seal Thrust Load', val: mechanics.thrustBearingPct },
                                    ].map((row, i) => {
                                        let status = 'OK';
                                        let color = 'text-emerald-600';
                                        
                                        if (row.lbl !== 'Pump Efficiency') {
                                            if (row.val > 100) { status = 'OVERLOAD'; color = 'text-red-600'; }
                                            else if (row.val > 90) { status = 'HIGH'; color = 'text-amber-500'; }
                                        } else {
                                            status = '-'; color = 'text-slate-400';
                                        }
                                        
                                        return (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="p-2 font-bold text-slate-800">{row.lbl}</td>
                                                <td className="p-2 text-right text-slate-400 font-mono text-[10px] uppercase">%</td>
                                                <td className="p-2 text-right font-mono font-bold text-slate-900">{row.val.toFixed(1)}</td>
                                                <td className={`p-2 text-right font-bold text-[10px] ${color}`}>{status}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const FieldInput = ({ label, value, unit, onChange, colorClass = "amber", icon: Icon, disabled = false }: any) => (
    <div className={`bg-surface border border-surface-light rounded-3xl p-6 flex flex-col justify-between group focus-within:border-${colorClass}-500/50 focus-within:ring-1 focus-within:ring-${colorClass}-500/20 transition-all ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-2">
            <label className={`text-sm font-bold text-txt-muted uppercase tracking-wider group-focus-within:text-${colorClass}-400 transition-colors`}>{label}</label>
            {Icon && <Icon className={`w-6 h-6 text-${colorClass}-500 opacity-60`} />}
        </div>
        <div className="flex items-baseline gap-3">
            <input
                type="number"
                value={value}
                onChange={onChange}
                className="w-full bg-transparent text-2xl font-black text-txt-main outline-none placeholder-surface-light font-mono"
                disabled={disabled}
            />
            <span className="text-xs font-bold text-txt-muted uppercase select-none">{unit}</span>
        </div>
    </div>
);

const DateInput = ({ label, value, onChange, colorClass = "amber", icon: Icon }: any) => (
    <div className={`bg-surface border border-surface-light rounded-3xl p-6 flex flex-col justify-between group focus-within:border-${colorClass}-500/50 focus-within:ring-1 focus-within:ring-${colorClass}-500/20 transition-all`}>
        <div className="flex justify-between items-center mb-2">
            <label className={`text-sm font-bold text-txt-muted uppercase tracking-wider group-focus-within:text-${colorClass}-400 transition-colors`}>{label}</label>
            {Icon && <Icon className={`w-6 h-6 text-${colorClass}-500 opacity-60`} />}
        </div>
        <div className="flex items-baseline gap-3">
            <input
                type="date"
                value={value}
                onChange={onChange}
                className="w-full bg-transparent text-lg font-black text-txt-main outline-none placeholder-surface-light font-mono"
            />
        </div>
    </div>
);

const CompCard = ({ label, designVal, actualVal, unit }: any) => {
    const diff = actualVal - designVal;
    const pct = designVal !== 0 ? (diff / designVal) * 100 : 0;
    
    return (
        <div className="bg-surface border border-surface-light rounded-3xl p-6 flex flex-col justify-between">
            <span className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-3">{label}</span>
            <div className="flex justify-between items-end">
                <div>
                    <span className="text-sm font-bold text-secondary block mb-1">D: {designVal.toFixed(0)}</span>
                    <span className="text-2xl font-black text-txt-main block">A: {actualVal.toFixed(0)}</span>
                </div>
                <div className={`text-right ${Math.abs(pct) < 2 ? 'text-txt-muted' : pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className="text-sm font-black">{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</div>
                    <span className="text-xs font-bold text-txt-muted">{unit}</span>
                </div>
            </div>
        </div>
    );
};

export const Phase6: React.FC<Props> = ({ params, pump, designFreq }) => {
    const { t } = useLanguage();
    const [showReport, setShowReport] = useState(false);
    const [isChartExpanded, setIsChartExpanded] = useState(false);
    const [compareScenario, setCompareScenario] = useState<'min' | 'target' | 'max'>('target');
    
    // --- LOCAL STATE FOR FIELD DATA ---
    const [fieldData, setFieldData] = useState({
        rate: params.pressures.totalRate,
        frequency: designFreq,
        waterCut: params.fluids.waterCut,
        thp: params.pressures.pht,
        tht: params.surfaceTemp,
        // Downhole
        pip: 0,
        pd: 0, 
        fluidLevel: 0,
        submergence: 0,
        // Calculated
        pStatic: params.inflow.pStatic,
        // NEW: Dates for Ramp Up Logic
        startDate: new Date().toISOString().split('T')[0],
        matchDate: new Date().toISOString().split('T')[0],
    });

    // 1. DERIVE DESIGN PARAMS (Standard)
    const designParams = useMemo(() => getScenarioParams(params, params.targets[compareScenario]), [params, compareScenario]);

    // Initial PIP Calc from Design if 0
    useEffect(() => {
        if (fieldData.pip === 0 && pump) {
            const tdh = calculateTDH(fieldData.rate, params);
            const res = calculateSystemResults(fieldData.rate, tdh, params, pump, fieldData.frequency);
            setFieldData(prev => ({ ...prev, pip: Math.round(res.pip || 0) }));
        }
    }, []);

    // 2. MATCH LOGIC: BACK-CALCULATE ACTUAL IP & GENERATE ACTUAL SYSTEM CURVE
    const { actualParams, calculatedIP } = useMemo(() => {
        // A. Calculate Hydrostatic Pressure below pump
        const pumpTVD = interpolateTVD(params.pressures.pumpDepthMD, params.survey);
        const perfsTVD = interpolateTVD(params.wellbore.midPerfsMD, params.survey);
        const deltaTVD = Math.max(0, perfsTVD - pumpTVD);
        
        const props = calculateFluidProperties(fieldData.pip, params.bottomholeTemp, params);
        const grad = Math.max(0.1, props.gradMix);
        const pwfActual = fieldData.pip + (deltaTVD * grad);
        
        // B. Calculate Actual IP
        const drawdown = Math.max(1, params.inflow.pStatic - pwfActual);
        const newIp = fieldData.rate / drawdown;

        // C. Construct "Actual" Params Object
        const actualP = {
            ...params,
            inflow: { ...params.inflow, ip: newIp },
            fluids: { ...params.fluids, waterCut: fieldData.waterCut },
            pressures: { ...params.pressures, pht: fieldData.thp, totalRate: fieldData.rate }
        };

        return { actualParams: actualP, calculatedIP: newIp };

    }, [fieldData.rate, fieldData.pip, fieldData.thp, fieldData.waterCut, params]);

    // 3. CALCULATE ACTUAL TDH
    const actualTDH = calculateTDH(fieldData.rate, actualParams);
    
    useEffect(() => {
        const { pdp } = calculatePDP(fieldData.rate, actualParams);
        setFieldData(prev => {
            const newPd = Math.round(pdp);
            return (prev.pd !== newPd) ? { ...prev, pd: newPd } : prev;
        });
    }, [actualTDH, fieldData.rate, actualParams]);

    const designRes = calculateSystemResults(designParams.pressures.totalRate, calculateTDH(designParams.pressures.totalRate, designParams), designParams, pump || {} as any, params.targets[compareScenario].frequency);
    const actualRes = calculateSystemResults(fieldData.rate, actualTDH, actualParams, pump || {} as any, fieldData.frequency);

    const updateField = (key: string, val: any) => {
        setFieldData(prev => ({ ...prev, [key]: val }));
    };

    // --- CHART DATA GENERATION: ALL 3 CASES + ACTUAL + STANDARD CURVES ---
    const { chartData, referencePoints, theoreticalMatch } = useMemo(() => {
        if (!pump) return { chartData: [], referencePoints: [], theoreticalMatch: null };

        // 1. Prepare Parameters for ALL Scenarios
        const minP = getScenarioParams(params, params.targets.min);
        const maxP = getScenarioParams(params, params.targets.max);
        const targetP = getScenarioParams(params, params.targets.target);

        // Frequencies
        const minFreq = params.targets.min.frequency;
        const maxFreq = params.targets.max.frequency;
        const targetFreq = params.targets.target.frequency;
        const actualFreq = fieldData.frequency;
        const baseFreq = pump.nameplateFrequency || 60;

        // Standard Frequencies for Reference
        const standardFreqs = [30, 40, 50, 60, 70];

        // Max Flow Calculation (Must cover everything)
        const globalMaxFreq = Math.max(70, actualFreq, maxFreq);
        const maxFlow = (pump.maxGraphRate || 6000) * (globalMaxFreq / baseFreq) * 1.2;
        const step = maxFlow / 60; 
        const data = [];

        // Flags
        const validStatus: Record<string, boolean> = {
            pumpMin: true, pumpMax: true, design: true, actual: true
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

        for (let i = 0; i <= 60; i++) {
            const flow = i * step;
            const point: any = { flow: Math.round(flow) };

            // Helper to calc head at freq
            const calcH = (freq: number) => {
                const r = freq / baseFreq;
                const qB = flow / r;
                const hB = calculateBaseHead(qB, pump);
                return hB * Math.pow(r, 2);
            };

            // --- 1. Standard Curves (30, 40, 50, 60, 70 Hz) ---
            standardFreqs.forEach(f => {
                const key = `hz${f}`;
                if (validStatus[key]) {
                    const h = calcH(f);
                    if (h > 0) point[key] = Number(h.toFixed(1));
                    else { validStatus[key] = false; point[key] = null; }
                }
            });

            // --- 2. Scenario Curves ---
            if (validStatus.pumpMin) {
                const h = calcH(minFreq);
                if (h > 0) point.pumpMin = Number(h.toFixed(1)); else { validStatus.pumpMin = false; point.pumpMin = null; }
            }
            if (validStatus.pumpMax) {
                const h = calcH(maxFreq);
                if (h > 0) point.pumpMax = Number(h.toFixed(1)); else { validStatus.pumpMax = false; point.pumpMax = null; }
            }
            if (validStatus.design) {
                const h = calcH(targetFreq);
                if (h > 0) point.designPumpCurve = Number(h.toFixed(1)); else { validStatus.design = false; point.designPumpCurve = null; }
            }
            
            // Actual (User Hz)
            if (validStatus.actual) {
                const h = calcH(actualFreq);
                if (h > 0) {
                    point.userHz = Number(h.toFixed(1));
                } else { 
                    validStatus.actual = false; 
                    point.userHz = null; 
                }
            }

            // --- 3. System Curves ---
            const hSysMin = calculateTDH(flow, minP);
            const hSysMax = calculateTDH(flow, maxP);
            const hSysTarget = calculateTDH(flow, targetP);
            const hSysActual = calculateTDH(flow, actualParams);

            if (hSysMin > 0 && !isNaN(hSysMin)) point.sysMin = Number(hSysMin.toFixed(1));
            if (hSysMax > 0 && !isNaN(hSysMax)) point.sysMax = Number(hSysMax.toFixed(1));
            if (hSysTarget > 0 && !isNaN(hSysTarget)) point.designSystemCurve = Number(hSysTarget.toFixed(1));
            if (hSysActual > 0 && !isNaN(hSysActual)) point.systemCurve = Number(hSysActual.toFixed(1));

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

        // FIND INTERSECTION (MATCH POINT)
        let tMatch = null;
        for (let i = 0; i < data.length - 1; i++) {
            const p1 = data[i];
            const p2 = data[i+1];
            if (typeof p1.userHz === 'number' && typeof p1.systemCurve === 'number' && typeof p2.userHz === 'number' && typeof p2.systemCurve === 'number') {
                const d1 = p1.userHz - p1.systemCurve;
                const d2 = p2.userHz - p2.systemCurve;
                if (Math.sign(d1) !== Math.sign(d2)) {
                    const factor = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
                    tMatch = {
                        flow: p1.flow + (p2.flow - p1.flow) * factor,
                        head: p1.userHz + (p2.userHz - p1.userHz) * factor
                    };
                    break;
                }
            }
        }

        const refPoints = [
            { flow: designParams.pressures.totalRate, head: designRes.tdh, label: 'DESIGN', color: '#60a5fa' },
            { flow: fieldData.rate, head: actualTDH, label: 'MEASURED', color: '#f59e0b' } 
        ];

        return { chartData: data, referencePoints: refPoints, theoreticalMatch: tMatch };

    }, [pump, params, actualParams, fieldData.frequency, compareScenario, fieldData.rate, actualTDH]);

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

    const safePump = pump || { id: 'tmp', manufacturer:'', model:'' } as EspPump;

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-8 animate-fadeIn pb-6">
            
            {/* --- FULL SCREEN MODAL --- */}
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
                        <PumpChart data={chartData} pump={safePump} currentFrequency={fieldData.frequency} intersectionPoint={theoreticalMatch} intersectionLabel="OP (Match)" referencePoints={referencePoints} targetFlow={fieldData.rate} className="w-full h-full" />
                    </div>
                </div>,
                document.body
            )}

            {showReport && <HistoryMatchReport onClose={() => setShowReport(false)} designParams={designParams} actualParams={actualParams} pump={pump} designRes={designRes} actualRes={actualRes} designFreq={params.targets[compareScenario].frequency} actualFreq={fieldData.frequency} chartData={chartData} mechanics={mechanics} compareScenario={compareScenario} fieldData={fieldData} refPoints={referencePoints} calculatedIP={calculatedIP} />}

            <div className="flex justify-between items-center bg-surface p-8 rounded-[40px] border border-surface-light shadow-lg">
                <div className="flex items-center gap-6"><div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20"><ClipboardCheck className="w-10 h-10 text-amber-500" /></div><div><h2 className="text-2xl font-black text-txt-main uppercase tracking-tight">{t('p6.history')}</h2><p className="text-base font-medium text-txt-muted">{t('p6.analysis')}</p></div></div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-canvas p-2 rounded-2xl border border-surface-light mr-2">{['min', 'target', 'max'].map(s => (<button key={s} onClick={() => setCompareScenario(s as any)} className={`px-5 py-2 text-xs font-black uppercase rounded-xl transition-colors ${compareScenario === s ? 'bg-amber-600 text-white' : 'text-txt-muted hover:text-txt-main'}`}>{s === 'min' ? 'MIN' : s === 'target' ? 'OBJ' : 'MAX'}</button>))}</div>
                    <button onClick={() => setShowReport(true)} className="bg-surface-light hover:bg-surface-light/80 text-txt-main hover:text-white px-6 py-4 rounded-2xl text-sm font-bold uppercase flex items-center gap-3 border border-surface-light transition-all"><Printer className="w-6 h-6" /> {t('p6.print')}</button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-3">
                    <div className="bg-surface/50 border border-surface-light rounded-[32px] p-8 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-secondary"></div>
                        <div className="flex justify-between items-center mb-6"><h3 className="text-base font-black text-secondary uppercase tracking-widest">{t('p6.designRef')} ({compareScenario.toUpperCase()})</h3><span className="bg-secondary/20 text-secondary px-4 py-1.5 rounded-lg text-xs font-bold border border-secondary/20">TARGET</span></div>
                        <div className="grid grid-cols-2 gap-6 opacity-70 grayscale group-hover:grayscale-0 transition-all"><div><span className="block text-xs text-txt-muted font-bold uppercase mb-1">{t('tele.flow')}</span><span className="text-lg font-mono font-black text-txt-main">{designParams.pressures.totalRate} BPD</span></div><div><span className="block text-xs text-txt-muted font-bold uppercase mb-1">{t('p5.freq')}</span><span className="text-lg font-mono font-black text-txt-main">{params.targets[compareScenario].frequency} Hz</span></div><div><span className="block text-xs text-txt-muted font-bold uppercase mb-1">TDH</span><span className="text-lg font-mono font-black text-txt-main">{designRes.tdh?.toFixed(0)} ft</span></div><div><span className="block text-xs text-txt-muted font-bold uppercase mb-1">{t('p3.pip')}</span><span className="text-lg font-mono font-black text-txt-main">{designRes.pip?.toFixed(0)} psi</span></div></div>
                    </div>

                    <div className="bg-surface rounded-[32px] border border-surface-light p-8 shadow-xl flex-1 relative overflow-hidden flex flex-col gap-8">
                        <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
                        <div>
                            <div className="flex items-center gap-4 mb-5"><Activity className="w-6 h-6 text-amber-500" /><h3 className="text-base font-black text-txt-main uppercase tracking-widest">{t('p6.surfaceData')}</h3></div>
                            <div className="grid grid-cols-2 gap-5">
                                <FieldInput label={t('p6.testRate')} value={fieldData.rate} unit="BPD" icon={Droplets} onChange={(e:any) => updateField('rate', parseFloat(e.target.value))} />
                                <FieldInput label={t('p5.freq')} value={fieldData.frequency} unit="Hz" icon={Activity} onChange={(e:any) => updateField('frequency', parseFloat(e.target.value))} />
                                <FieldInput label={t('p6.measThp')} value={fieldData.thp} unit="psi" icon={Gauge} onChange={(e:any) => updateField('thp', parseFloat(e.target.value))} />
                                <FieldInput label={t('p6.measTht')} value={fieldData.tht} unit="°F" icon={Thermometer} onChange={(e:any) => updateField('tht', parseFloat(e.target.value))} />
                                <FieldInput label={t('p2.waterCut')} value={fieldData.waterCut} unit="%" icon={Droplets} onChange={(e:any) => updateField('waterCut', parseFloat(e.target.value))} />
                                {/* New Date Inputs for Ramp Up Logic */}
                                <div className="col-span-2 grid grid-cols-2 gap-5 mt-2 pt-4 border-t border-surface-light/50">
                                    <DateInput label={t('p6.startDate')} value={fieldData.startDate} icon={Calendar} onChange={(e:any) => updateField('startDate', e.target.value)} colorClass="blue" />
                                    <DateInput label={t('p6.matchDate')} value={fieldData.matchDate} icon={Calendar} onChange={(e:any) => updateField('matchDate', e.target.value)} colorClass="blue" />
                                </div>
                            </div>
                        </div>
                        <div className="w-full h-px bg-surface-light"></div>
                        <div><div className="flex items-center gap-4 mb-5"><ArrowDown className="w-6 h-6 text-indigo-500" /><h3 className="text-base font-black text-txt-main uppercase tracking-widest">{t('p6.downholeData')}</h3></div><div className="grid grid-cols-2 gap-5"><FieldInput label={t('p6.measPip')} value={Math.round(fieldData.pip)} unit="psi" colorClass="indigo" icon={Gauge} onChange={(e:any) => updateField('pip', parseFloat(e.target.value))} /><div className="bg-surface border border-surface-light rounded-3xl p-6 flex flex-col justify-between group opacity-80"><div className="flex justify-between items-center mb-2"><label className="text-sm font-bold text-txt-muted uppercase tracking-wider">{t('p6.calcIp')}</label><RefreshCw className="w-6 h-6 text-emerald-500 animate-spin-slow" /></div><div className="flex items-baseline gap-3"><span className="text-4xl font-black text-emerald-400 font-mono">{calculatedIP.toFixed(2)}</span><span className="text-xs font-bold text-txt-muted uppercase select-none">bpd/psi</span></div></div></div></div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-8 flex flex-col gap-8 h-full overflow-y-auto pr-3 custom-scrollbar">
                    
                    <div className="h-[50vh] min-h-[500px] bg-surface rounded-[40px] border border-surface-light shadow-2xl p-2 relative flex flex-col overflow-hidden shrink-0 group">
                        <button onClick={() => setIsChartExpanded(true)} className="absolute bottom-6 right-6 z-20 bg-surface/80 backdrop-blur text-txt-muted hover:text-white hover:bg-surface-light p-3 rounded-full border border-surface-light transition-all opacity-0 group-hover:opacity-100 shadow-lg"><Maximize2 className="w-8 h-8" /></button>
                        <PumpChart data={chartData} pump={safePump} currentFrequency={fieldData.frequency} intersectionPoint={theoreticalMatch} intersectionLabel="OP (Match)" referencePoints={referencePoints} targetFlow={fieldData.rate} className="w-full h-full" />
                        <div className="absolute top-6 right-8 flex gap-6 text-xs font-bold text-txt-muted uppercase"><div className="flex items-center gap-2"><div className="w-4 h-1.5 bg-emerald-500 rounded-full"></div>ACTUAL MATCH</div><div className="flex items-center gap-2"><div className="w-4 h-1.5 bg-secondary rounded-full opacity-50"></div>DESIGN</div></div>
                    </div>

                    <div className="grid grid-cols-4 gap-6 shrink-0">
                        <CompCard label={t('tele.head')} designVal={designRes.tdh || 0} actualVal={actualTDH} unit="ft" />
                        <CompCard label={t('p3.pwf')} designVal={designRes.pwf || 0} actualVal={actualRes.pwf || 0} unit="psi" />
                        <CompCard label={t('p3.pip')} designVal={designRes.pip || 0} actualVal={fieldData.pip} unit="psi" />
                        <div className={`bg-surface border border-surface-light rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden`}><span className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-3 flex items-center gap-2"><Hammer className="w-5 h-5" /> {t('p6.mechAnalysis')}</span><div className="flex justify-between items-end relative z-10"><div><span className="text-xs font-bold text-txt-muted block mb-1">{t('p6.pumpShaftLoad')}</span><span className={`text-2xl font-black block text-txt-main`}>{mechanics.pumpShaftPct.toFixed(0)}%</span></div><div className="text-right"><span className={`text-3xl font-black ${mechanics.motorLoad > 100 ? 'text-red-500' : 'text-txt-muted'}`}>{mechanics.motorLoad.toFixed(0)}%</span><span className="text-xs font-bold text-txt-muted block">Motor Load</span></div></div></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
