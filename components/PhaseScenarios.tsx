
import React, { useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, ArrowRight, Layers, Activity, Droplets, Flame, ArrowUpRight, Lock, AlertTriangle, CheckCircle2, Sparkles, RefreshCcw, Unlock } from 'lucide-react';
import { SystemParams, ScenarioData } from '../types';
import { calculateTDH, calculatePwf, calculatePIP, generateIPRData, calculateAOF, calculateSystemResults } from '../utils';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceDot, Label, ReferenceLine } from 'recharts';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    results: any;
}

const getScenarioParams = (baseParams: SystemParams, scenario: ScenarioData): SystemParams => {
    return {
        ...baseParams,
        inflow: { ...baseParams.inflow, ip: scenario.ip },
        fluids: { ...baseParams.fluids, waterCut: scenario.waterCut, gor: scenario.gor, glr: scenario.gor * (1 - scenario.waterCut/100) },
        pressures: { ...baseParams.pressures, totalRate: scenario.rate }
    };
};

const ScenarioCard = ({ type, data, onChange, baseParams, active, onActivate, globalResults, maxAOF }: { type: 'min' | 'target' | 'max', data: ScenarioData, onChange: (field: keyof ScenarioData, value: number) => void, baseParams: SystemParams, active: boolean, onActivate: () => void, globalResults: any, maxAOF: number }) => {
    const { t } = useLanguage();
    
    // Calculate local feasibility
    const calcParams = getScenarioParams(baseParams, data);
    let localResults;
    
    // We always calculate local results to ensure manual changes are reflected immediately in the mini-dash,
    // even for the target case (which might be slightly ahead of global sync).
    const dummyPump = { id: 'scenario_calc', stages: 1, nameplateFrequency: 60, minRate:0, maxRate:0, bepRate:0, maxEfficiency: 70, h0:0, h1:0, h2:0, h3:0, h4:0, h5:0, p0:0, p1:0, p2:0, p3:0, p4:0, p5:0 } as any;
    localResults = calculateSystemResults(calcParams.pressures.totalRate, null, calcParams, dummyPump, data.frequency);

    const colorMap = { min: 'text-blue-400 border-blue-500/30 bg-blue-500/5', target: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5', max: 'text-amber-400 border-amber-500/30 bg-amber-500/5' };
    const activeClass = active ? `ring-2 ring-offset-2 ring-offset-surface ${type === 'min' ? 'ring-blue-500' : type === 'target' ? 'ring-emerald-500' : 'ring-amber-500'} scale-[1.02]` : 'hover:border-txt-muted opacity-90 hover:opacity-100';
    const label = type === 'min' ? t('scen.min') : type === 'target' ? t('scen.target') : t('scen.max');
    const Icon = type === 'min' ? TrendingDown : type === 'target' ? Target : TrendingUp;

    // INTELLIGENCE CHECKS
    const isImpossible = data.rate > maxAOF;
    const isCriticalDrawdown = localResults.pwf < (baseParams.inflow.pStatic * 0.1); // <10% Pr
    
    let statusColor = "text-emerald-500";
    let statusText = t('scen.feasible');
    let StatusIcon = CheckCircle2;

    if (isImpossible) {
        statusColor = "text-red-500";
        statusText = t('scen.impossible');
        StatusIcon = AlertTriangle;
    } else if (isCriticalDrawdown) {
        statusColor = "text-amber-500";
        statusText = t('scen.critical');
        StatusIcon = AlertTriangle;
    }

    return (
        <div onClick={onActivate} className={`bg-surface rounded-[32px] border border-surface-light p-6 transition-all duration-300 cursor-pointer flex flex-col justify-between h-full relative overflow-hidden group ${activeClass} ${isImpossible ? 'border-red-500/50 bg-red-900/10' : ''}`}>
            
            {active && <div className={`absolute top-0 right-0 p-2 ${type === 'min' ? 'bg-blue-600' : type === 'target' ? 'bg-emerald-600' : 'bg-amber-600'} rounded-bl-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-lg`}>{t('scen.activeCase')}</div>}
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl border ${colorMap[type].split(' ')[1]} ${colorMap[type].split(' ')[2]}`}><Icon className={`w-6 h-6 ${colorMap[type].split(' ')[0]}`} /></div>
                    <div>
                        <h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{label}</h3>
                        <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider block mt-0.5">Manual Input</span>
                    </div>
                </div>
            </div>

            {/* Smart Status Bar */}
            <div className={`flex items-center gap-2 mb-6 px-3 py-2 rounded-lg border border-surface-light/50 ${isImpossible ? 'bg-red-500/10 border-red-500/30' : 'bg-canvas'}`}>
                <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                <span className={`text-xs font-bold uppercase ${statusColor}`}>{statusText}</span>
            </div>

            <div className={`space-y-5 relative z-10`}>
                
                {/* Rate Input */}
                <div className={`bg-canvas p-5 rounded-2xl border border-surface-light group-focus-within:border-blue-500/50 transition-colors shadow-inner`}>
                    <label className="text-xs font-bold text-txt-muted uppercase block mb-2">{t('scen.prodRate')}</label>
                    <div className="flex items-baseline gap-2">
                        <input 
                            type="number" 
                            value={data.rate} 
                            onChange={(e) => onChange('rate', parseFloat(e.target.value))} 
                            className={`bg-transparent w-full text-3xl font-black outline-none font-mono ${isImpossible ? 'text-red-400' : 'text-txt-main'}`} 
                        />
                        <span className="text-xs font-bold text-txt-muted">BPD</span>
                    </div>
                    {/* Drawdown bar */}
                    <div className="mt-3 h-1.5 w-full bg-surface-light rounded-full overflow-hidden">
                        <div className={`h-full ${isImpossible ? 'bg-red-500' : isCriticalDrawdown ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (data.rate / maxAOF) * 100)}%` }}></div>
                    </div>
                </div>

                {/* Sub Params */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-canvas p-3 rounded-xl border border-surface-light focus-within:border-indigo-500/50 transition-colors">
                        <div className="flex items-center gap-1 mb-1"><ArrowUpRight className="w-3 h-3 text-indigo-400" /><label className="text-[10px] font-bold text-txt-muted uppercase">IP</label></div>
                        <input type="number" step="0.1" value={data.ip} onChange={(e) => onChange('ip', parseFloat(e.target.value))} className="bg-transparent w-full text-sm font-black text-indigo-400 outline-none font-mono" />
                    </div>
                    <div className="bg-canvas p-3 rounded-xl border border-surface-light focus-within:border-blue-500/50 transition-colors">
                        <div className="flex items-center gap-1 mb-1"><Droplets className="w-3 h-3 text-blue-400" /><label className="text-[10px] font-bold text-txt-muted uppercase">WC%</label></div>
                        <input type="number" step="1" value={data.waterCut} onChange={(e) => onChange('waterCut', parseFloat(e.target.value))} className="bg-transparent w-full text-sm font-black text-blue-400 outline-none font-mono" />
                    </div>
                    <div className="bg-canvas p-3 rounded-xl border border-surface-light focus-within:border-orange-500/50 transition-colors">
                        <div className="flex items-center gap-1 mb-1"><Flame className="w-3 h-3 text-orange-400" /><label className="text-[10px] font-bold text-txt-muted uppercase">GOR</label></div>
                        <input type="number" step="10" value={data.gor} onChange={(e) => onChange('gor', parseFloat(e.target.value))} className="bg-transparent w-full text-sm font-black text-orange-400 outline-none font-mono" />
                    </div>
                </div>

                {/* Results Mini-Dash */}
                <div className="grid grid-cols-3 gap-2 border-t border-surface-light/50 pt-3">
                    <div className="text-center"><span className="text-[10px] font-bold text-txt-muted block mb-0.5">Pwf</span><span className={`text-sm font-mono font-bold ${localResults.pwf < 200 ? 'text-red-400' : 'text-txt-main'}`}>{localResults.pwf?.toFixed(0) || '--'}</span></div>
                    <div className="text-center border-l border-surface-light/50"><span className="text-[10px] font-bold text-txt-muted block mb-0.5">PIP</span><span className="text-sm font-mono font-bold text-txt-main">{localResults.pip?.toFixed(0) || '--'}</span></div>
                    <div className="text-center border-l border-surface-light/50"><span className="text-[10px] font-bold text-txt-muted block mb-0.5">Head</span><span className={`text-sm font-mono font-black ${localResults.tdh > 0 ? 'text-emerald-400' : 'text-red-500'}`}>{localResults.tdh > 0 ? localResults.tdh.toFixed(0) : 'NA'}</span></div>
                </div>
            </div>
        </div>
    );
};

export const PhaseScenarios: React.FC<Props> = ({ params, setParams, results }) => {
    const { t } = useLanguage();
    
    // Theme colors
    const colorPrimary = 'rgb(var(--color-primary))';
    const colorSecondary = 'rgb(var(--color-secondary))';
    const colorTextMuted = 'rgb(var(--color-text-muted))';
    const colorGrid = 'rgb(var(--color-surface-light))';

    // Compute Absolute Open Flow (AOF) for limit checks
    const aof = calculateAOF(params);

    const allCurvesData = useMemo(() => {
        const pStatic = params.inflow.pStatic; const { min, target, max } = params.targets; const model = params.inflow.model;
        const getMax = (ip: number) => model === 'Vogel' ? (ip * pStatic) / 1.8 : ip * pStatic;
        const maxAOF = Math.max(getMax(min.ip), getMax(target.ip), getMax(max.ip));
        const steps = 60; const limit = maxAOF * 1.1; const stepSize = limit / steps;
        const data = [];
        for (let i = 0; i <= steps; i++) {
            const q = i * stepSize;
            const calcP = (ip: number) => { const p = calculatePwf(q, { inflow: { pStatic, ip: ip > 0 ? ip : 0.001, model } } as any); return p > 0 ? p : null; };
            const minP = calcP(min.ip); const targetP = calcP(target.ip); const maxP = calcP(max.ip);
            if (minP === null && targetP === null && maxP === null && i > 0) { data.push({ flow: Math.round(q), minP: minP !== null ? 0 : null, targetP: targetP !== null ? 0 : null, maxP: maxP !== null ? 0 : null }); break; }
            data.push({ flow: Math.round(q), minP: minP !== null ? Number(minP.toFixed(0)) : null, targetP: targetP !== null ? Number(targetP.toFixed(0)) : null, maxP: maxP !== null ? Number(maxP.toFixed(0)) : null });
        }
        return data;
    }, [params.inflow.pStatic, params.targets, params.inflow.model]);

    const updateScenarioData = (scenario: 'min' | 'target' | 'max', field: keyof ScenarioData, val: number) => {
        setParams(prev => {
            const updatedTargets = { ...prev.targets, [scenario]: { ...prev.targets[scenario], [field]: val } };
            
            // Critical: If editing target, we MUST sync the global shortcuts
            let extraUpdates = {};
            if (scenario === 'target') {
                if (field === 'rate') extraUpdates = { pressures: { ...prev.pressures, totalRate: val } };
                if (field === 'ip') extraUpdates = { ...extraUpdates, inflow: { ...prev.inflow, ip: val } };
                if (field === 'waterCut') {
                     const glr = prev.fluids.gor * (1 - val/100);
                     extraUpdates = { ...extraUpdates, fluids: { ...prev.fluids, waterCut: val, glr } };
                }
                if (field === 'gor') {
                     const glr = val * (1 - prev.fluids.waterCut/100);
                     extraUpdates = { ...extraUpdates, fluids: { ...prev.fluids, gor: val, glr } };
                }
            }

            // Sync if editing the currently active scenario
            if (prev.activeScenario === scenario) {
                const newData = updatedTargets[scenario];
                return { 
                    ...prev, 
                    targets: updatedTargets, 
                    ...extraUpdates,
                    pressures: { ...prev.pressures, totalRate: newData.rate }, 
                    inflow: { ...prev.inflow, ip: newData.ip }, 
                    fluids: { ...prev.fluids, waterCut: newData.waterCut, gor: newData.gor, glr: newData.gor * (1 - newData.waterCut/100) } 
                };
            }
            
            return { ...prev, targets: updatedTargets, ...extraUpdates };
        });
    };

    const activateScenario = (scenario: 'min' | 'target' | 'max') => {
        const data = params.targets[scenario];
        setParams(prev => ({ ...prev, activeScenario: scenario, pressures: { ...prev.pressures, totalRate: data.rate }, inflow: { ...prev.inflow, ip: data.ip }, fluids: { ...prev.fluids, waterCut: data.waterCut, gor: data.gor, glr: data.gor * (1 - data.waterCut/100) } }));
    };

    const points = useMemo(() => {
        const getOpPwf = (q: number, ip: number) => calculatePwf(q, getScenarioParams(params, { rate: q, ip, waterCut: 0, gor: 0, frequency: 60 }));
        return [ 
            { flow: params.targets.min.rate, pwf: getOpPwf(params.targets.min.rate, params.targets.min.ip), label: 'MIN', color: colorSecondary }, 
            { flow: params.targets.target.rate, pwf: getOpPwf(params.targets.target.rate, params.targets.target.ip), label: 'OBJ', color: colorPrimary }, 
            { flow: params.targets.max.rate, pwf: getOpPwf(params.targets.max.rate, params.targets.max.ip), label: 'MAX', color: colorSecondary } 
        ];
    }, [params, colorPrimary, colorSecondary]);

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-8 pb-6 animate-fadeIn">
            
            {/* Header / Toolbar */}
            <div className="bg-surface rounded-[32px] p-8 border border-surface-light shadow-lg flex justify-between items-center relative overflow-hidden">
                <div className="absolute left-0 top-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                <div>
                    <h2 className="text-2xl font-black text-txt-main uppercase tracking-tight flex items-center gap-4"><Layers className="w-8 h-8 text-indigo-500" /> {t('scen.title')}</h2>
                    <p className="text-base text-txt-muted font-medium mt-1">{t('scen.define')} <span className="text-indigo-400 opacity-80">({params.inflow.model})</span></p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-4 bg-canvas px-6 py-3 rounded-2xl border border-surface-light">
                        <span className="text-xs font-bold text-txt-muted uppercase">{t('scen.activeCase')}:</span>
                        <span className={`text-sm font-black uppercase ${params.activeScenario === 'min' ? 'text-blue-400' : params.activeScenario === 'target' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {params.activeScenario === 'min' ? t('scen.min') : params.activeScenario === 'target' ? t('scen.target') : t('scen.max')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">
                {/* Chart Area */}
                <div className="col-span-12 lg:col-span-8 bg-surface rounded-[48px] border border-surface-light shadow-xl p-6 flex flex-col relative overflow-hidden">
                    <div className="absolute top-8 left-10 z-10 pointer-events-none">
                        <span className="text-sm font-black text-txt-muted uppercase tracking-widest flex items-center gap-3"><Activity className="w-5 h-5 text-blue-500" /> {t('scen.iprMap')} (Smart Composite)</span>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={allCurvesData} margin={{ top: 60, right: 50, left: 30, bottom: 40 }}>
                                <defs>
                                    <linearGradient id="iprGradTarget" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colorPrimary} stopOpacity={0.2} /><stop offset="95%" stopColor={colorPrimary} stopOpacity={0} /></linearGradient>
                                    <filter id="glow-target" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} vertical={false} opacity={0.5} />
                                <XAxis dataKey="flow" type="number" tick={{ fontSize: 14, fontWeight: 700, fill: colorTextMuted }} axisLine={{ stroke: colorGrid }} tickLine={false}>
                                    <Label value="Flow Rate (BPD)" position="insideBottom" offset={-10} fill={colorTextMuted} fontSize={14} fontWeight={800} />
                                </XAxis>
                                <YAxis tick={{ fontSize: 14, fontWeight: 700, fill: colorTextMuted }} axisLine={false} tickLine={false}>
                                    <Label value="Pressure (psi)" angle={-90} position="insideLeft" fill={colorTextMuted} fontSize={14} fontWeight={800} />
                                </YAxis>
                                <Tooltip content={({ active, payload, label }: any) => active && payload ? <div className="bg-canvas p-5 border border-surface-light shadow-2xl rounded-2xl text-sm z-50 backdrop-blur-md"><p className="font-bold border-b border-surface-light pb-2 mb-2 text-txt-muted flex justify-between gap-8"><span>FLOW</span><span className="font-mono text-txt-main">{label} BPD</span></p><div className="space-y-2">{payload.map((e: any, i: number) => e.value !== null && <div key={i} className="flex justify-between gap-6 items-center"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{backgroundColor: e.color}}></div><span className="font-bold text-txt-muted uppercase text-xs">{e.name}</span></div><span className="font-mono font-bold text-txt-main text-base">{e.value} psi</span></div>)}</div></div> : null} cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <ReferenceLine x={aof} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'AOF Limit', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
                                <Line type="monotone" dataKey="minP" name="MIN" stroke={colorSecondary} strokeWidth={3} strokeDasharray="6 6" dot={false} activeDot={false} isAnimationActive={false} opacity={0.5} />
                                <Line type="monotone" dataKey="maxP" name="MAX" stroke={colorSecondary} strokeWidth={3} strokeDasharray="6 6" dot={false} activeDot={false} isAnimationActive={false} opacity={0.5} />
                                <Area type="monotone" dataKey="targetP" name="TARGET" stroke={colorPrimary} strokeWidth={5} fillOpacity={1} fill="url(#iprGradTarget)" filter="url(#glow-target)" />
                                {points.map((p, i) => <ReferenceDot key={i} x={p.flow} y={p.pwf} r={8} fill={p.color} stroke="none" strokeWidth={3}><Label value={p.label} position="top" fill={p.color} fontSize={13} fontWeight="900" offset={15} /></ReferenceDot>)}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Scenarios Deck */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                    <ScenarioCard type="min" data={params.targets.min} onChange={(f, v) => updateScenarioData('min', f, v)} baseParams={params} active={params.activeScenario === 'min'} onActivate={() => activateScenario('min')} globalResults={results} maxAOF={aof} />
                    <ScenarioCard type="target" data={params.targets.target} onChange={(f, v) => updateScenarioData('target', f, v)} baseParams={params} active={params.activeScenario === 'target'} onActivate={() => activateScenario('target')} globalResults={results} maxAOF={aof} />
                    <ScenarioCard type="max" data={params.targets.max} onChange={(f, v) => updateScenarioData('max', f, v)} baseParams={params} active={params.activeScenario === 'max'} onActivate={() => activateScenario('max')} globalResults={results} maxAOF={aof} />
                </div>
            </div>
        </div>
    );
};
