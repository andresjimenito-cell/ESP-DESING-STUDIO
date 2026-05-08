
import React, { useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, ArrowRight, Layers, Activity, Droplets, Flame, ArrowUpRight, Lock, AlertTriangle, CheckCircle2, Sparkles, RefreshCcw, Unlock, Gauge, Zap, Waves, Palette, Info } from 'lucide-react';
import { SystemParams, ScenarioData } from '../types';
import { calculateTDH, calculatePwf, calculatePIP, generateIPRData, calculateAOF, calculateSystemResults } from '../utils';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceDot, Label, ReferenceLine, Scatter } from 'recharts';
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
        fluids: { ...baseParams.fluids, waterCut: scenario.waterCut, gor: scenario.gor, glr: scenario.gor * (1 - scenario.waterCut / 100) },
        pressures: { ...baseParams.pressures, totalRate: scenario.rate }
    };
};

const ScenarioCard = ({ type, data, onChange, baseParams, active, onActivate, globalResults, maxAOF }: { type: 'min' | 'target' | 'max', data: ScenarioData, onChange: (field: keyof ScenarioData, value: number) => void, baseParams: SystemParams, active: boolean, onActivate: () => void, globalResults: any, maxAOF: number }) => {
    const { t } = useLanguage();

    // Calculate local feasibility
    const calcParams = getScenarioParams(baseParams, data);
    const localResults = calculateSystemResults(calcParams.pressures.totalRate, null, calcParams, { id: 'dummy', stages: 1 } as any, data.frequency);

    const isImpossible = data.rate > maxAOF;
    const isCriticalDrawdown = localResults.pwf < (baseParams.inflow.pStatic * 0.1); 

    const label = type === 'min' ? t('scen.min') : type === 'target' ? t('scen.target') : t('scen.max');
    const Icon = type === 'min' ? TrendingDown : type === 'target' ? Target : TrendingUp;
    
    // Performance Deltas (compared to static or previous)
    const drawdownPct = ((baseParams.inflow.pStatic - localResults.pwf) / baseParams.inflow.pStatic) * 100;

    return (
        <div
            onClick={onActivate}
            className={`group relative flex flex-col gap-4 overflow-hidden rounded-[2rem] border-2 transition-all duration-500 cursor-pointer w-full p-6 
                ${active
                    ? `border-primary/40 shadow-[0_0_40px_rgba(var(--color-primary),0.2)] glass-surface !bg-primary/[0.03] scale-[1.02] z-10`
                    : `border-white/5 glass-surface opacity-70 hover:opacity-100 hover:border-white/20 hover:scale-[1.01]`
                }
                ${isImpossible ? 'border-danger/40 bg-danger/[0.02]' : ''}
            `}
        >
            {/* Ambient Ambient Glow */}
            {active && (
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 blur-[60px] rounded-full pointer-events-none"></div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg border ${active ? 'bg-primary text-white border-white/20' : 'bg-white/5 text-txt-muted border-white/5'}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${active ? 'text-txt-main' : 'text-txt-muted'}`}>{label}</h3>
                        <div className="flex items-center gap-2 mt-1">
                             <div className={`w-2 h-2 rounded-full ${isImpossible ? 'bg-danger animate-pulse' : isCriticalDrawdown ? 'bg-warning animate-pulse' : 'bg-primary animate-pulse'}`}></div>
                             <span className="text-[10px] font-black text-txt-muted opacity-60 uppercase tracking-widest">
                                {isImpossible ? 'OUT OF RANGE' : isCriticalDrawdown ? 'CRITICAL DRAWDOWN' : 'NOMINAL RANGE'}
                             </span>
                        </div>
                    </div>
                </div>
                
                <div className="text-right">
                    <div className={`text-[10px] font-black uppercase tracking-widest opacity-40 mb-1`}>Drawdown</div>
                    <div className={`text-lg font-black font-mono tracking-tighter ${drawdownPct > 80 ? 'text-warning' : 'text-txt-main'}`}>
                        {drawdownPct.toFixed(1)}%
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* PRIMARY INPUT: RATE */}
                <div className={`flex flex-col gap-2 p-4 rounded-2xl border transition-all ${active ? 'bg-canvas/60 border-white/10 shadow-inner' : 'bg-canvas/30 border-white/5'}`}>
                    <label className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em]">{t('scen.prodRate')}</label>
                    <div className="flex items-baseline gap-2">
                        <input
                            type="number"
                            value={data.rate}
                            onChange={(e) => onChange('rate', parseFloat(e.target.value))}
                            className={`bg-transparent w-full text-3xl font-black outline-none font-mono tracking-tighter ${isImpossible ? 'text-danger' : 'text-txt-main'}`}
                        />
                        <span className="text-[10px] font-bold text-txt-muted opacity-40">BPD</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-light/30 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${isImpossible ? 'bg-danger shadow-glow-danger' : 'bg-primary shadow-glow-primary'}`} style={{ width: `${Math.min(100, (data.rate / maxAOF) * 100)}%` }}></div>
                    </div>
                </div>

                {/* SCENARIO CONSTANTS */}
                <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center group/item hover:bg-white/5 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-white/5">
                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest">IP <small className="opacity-40">idx</small></span>
                        <input type="number" step="0.1" value={data.ip} onChange={(e) => onChange('ip', parseFloat(e.target.value))} className="bg-transparent w-16 text-right text-sm font-black outline-none font-mono text-secondary" />
                    </div>
                    <div className="flex justify-between items-center group/item hover:bg-white/5 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-white/5">
                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest">WC <small className="opacity-40">%</small></span>
                        <input type="number" value={data.waterCut} onChange={(e) => onChange('waterCut', parseFloat(e.target.value))} className="bg-transparent w-16 text-right text-sm font-black outline-none font-mono text-txt-main" />
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 grid grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="flex justify-between items-center group/stat">
                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-[0.2em]">Pwf Press.</span>
                        <span className={`text-sm font-black font-mono tracking-tighter ${localResults.pwf < 200 ? 'text-danger animate-pulse' : 'text-txt-main'}`}>
                            {localResults.pwf?.toFixed(0)} <small className="text-[8px] opacity-30">psi</small>
                        </span>
                    </div>
                    <div className="flex justify-between items-center group/stat">
                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-[0.2em]">Gas GVF</span>
                        <span className="text-sm font-black font-mono tracking-tighter text-secondary">
                            {(localResults.gasAnalysis?.voidFraction * 100 || 0).toFixed(1)} <small className="text-[8px] opacity-30">%</small>
                        </span>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center group/stat">
                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-[0.2em]">Potential TDH</span>
                        <span className={`text-sm font-black font-mono tracking-tighter ${localResults.tdh > 0 ? 'text-primary' : 'text-txt-muted'}`}>
                            {localResults.tdh > 0 ? localResults.tdh.toFixed(0) : '---'} <small className="text-[8px] opacity-30">ft</small>
                        </span>
                    </div>
                    <div className="flex justify-between items-center group/stat">
                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-[0.2em]">Motor Load</span>
                        <span className="text-sm font-black font-mono tracking-tighter text-txt-main">
                            {localResults.motorLoad?.toFixed(0) || '0'} <small className="text-[8px] opacity-30">%</small>
                        </span>
                    </div>
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
                    const glr = prev.fluids.gor * (1 - val / 100);
                    extraUpdates = { ...extraUpdates, fluids: { ...prev.fluids, waterCut: val, glr } };
                }
                if (field === 'gor') {
                    const glr = val * (1 - prev.fluids.waterCut / 100);
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
                    fluids: { ...prev.fluids, waterCut: newData.waterCut, gor: newData.gor, glr: newData.gor * (1 - newData.waterCut / 100) }
                };
            }

            return { ...prev, targets: updatedTargets, ...extraUpdates };
        });
    };

    const activateScenario = (scenario: 'min' | 'target' | 'max') => {
        const data = params.targets[scenario];
        setParams((prev: SystemParams) => ({ ...prev, activeScenario: scenario, pressures: { ...prev.pressures, totalRate: data.rate }, inflow: { ...prev.inflow, ip: data.ip }, fluids: { ...prev.fluids, waterCut: data.waterCut, gor: data.gor, glr: data.gor * (1 - data.waterCut / 100) } }));
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
        <div className="flex flex-col h-full gap-6 animate-fadeIn overflow-hidden p-1">

            {/* HEADER TOOLBAR REMOVED AS PER USER REQUEST */}

            {/* ANALYTIC DASHBOARD BODY */}
            <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">

                {/* LEFT: SCENARIO CARDS (45%) */}
                <div className="flex-[0.45] flex flex-col gap-4 min-h-0 overflow-y-auto custom-scrollbar pr-2">
                    <ScenarioCard
                        type="target"
                        data={params.targets.target}
                        onChange={(f, v) => updateScenarioData('target', f, v)}
                        baseParams={params}
                        active={params.activeScenario === 'target'}
                        onActivate={() => activateScenario('target')}
                        globalResults={results}
                        maxAOF={aof}
                    />
                    <ScenarioCard
                        type="min"
                        data={params.targets.min}
                        onChange={(f, v) => updateScenarioData('min', f, v)}
                        baseParams={params}
                        active={params.activeScenario === 'min'}
                        onActivate={() => activateScenario('min')}
                        globalResults={results}
                        maxAOF={aof}
                    />
                    <ScenarioCard
                        type="max"
                        data={params.targets.max}
                        onChange={(f, v) => updateScenarioData('max', f, v)}
                        baseParams={params}
                        active={params.activeScenario === 'max'}
                        onActivate={() => activateScenario('max')}
                        globalResults={results}
                        maxAOF={aof}
                    />
                </div>

                {/* RIGHT: SYSTEM VISUALIZER (55%) */}
                <div className="flex-[0.55] glass-surface rounded-[3rem] border border-white/10 p-10 flex flex-col shadow-3xl relative overflow-hidden bg-gradient-to-br from-canvas via-canvas to-primary/[0.02]">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--color-primary),0.02)_2px,transparent_2px),linear-gradient(90deg,rgba(var(--color-primary),0.02)_2px,transparent_2px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-30 pointer-events-none"></div>

                    <div className="flex justify-between items-center mb-8 shrink-0 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 glass-surface-light rounded-2xl flex items-center justify-center text-primary border border-primary/20 shadow-glow-primary shadow-[0_0_20px_rgba(var(--color-primary),0.2)]">
                                <Activity className="w-7 h-7" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-txt-main uppercase tracking-[0.4em] mb-1.5 flex items-center gap-2">
                                    IPR OPERATIONAL ENVELOPE
                                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                                </h4>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-1 bg-primary rounded-full"></div>
                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-60">Linear-Vogel Model</span>
                                    </div>
                                    <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-1 bg-secondary rounded-full"></div>
                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-60">Stability Limit</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <div className="px-4 py-2 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
                                <Gauge className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-black text-txt-main">NOMINAL DYNAMICS</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={allCurvesData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="iprGradTarget" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={colorPrimary} stopOpacity={0.5} />
                                        <stop offset="100%" stopColor={colorPrimary} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="iprGradArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={colorPrimary} stopOpacity={0.1} />
                                        <stop offset="100%" stopColor="transparent" stopOpacity={0} />
                                    </linearGradient>
                                    <filter id="chartGlow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="4" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" stroke={colorGrid} vertical={false} opacity={0.15} />
                                <XAxis
                                    dataKey="flow"
                                    type="number"
                                    tick={{ fontSize: 10, fontWeight: 900, fill: colorTextMuted, opacity: 0.7 }}
                                    axisLine={{ stroke: colorGrid, opacity: 0.2 }}
                                    tickLine={false}
                                    height={40}
                                    domain={[0, 'auto']}
                                >
                                    <Label value="PRODUCTION FLOW (BPD)" position="insideBottom" offset={-5} fill={colorTextMuted} fontSize={9} fontWeight={950} style={{ letterSpacing: '0.3em', opacity: 0.5 }} />
                                </XAxis>
                                <YAxis
                                    tick={{ fontSize: 10, fontWeight: 900, fill: colorTextMuted, opacity: 0.7 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={45}
                                >
                                    <Label value="PWf PRESSURE (PSI)" angle={-90} position="insideLeft" fill={colorTextMuted} fontSize={9} fontWeight={950} style={{ letterSpacing: '0.3em', opacity: 0.5 }} />
                                </YAxis>
                                <Tooltip
                                    content={({ active, payload, label }: any) => active && payload ? (
                                        <div className="glass-surface p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 rounded-[2rem] text-sm z-50 animate-fadeIn">
                                            <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                                    <Info className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-60">Operational Point</p>
                                                    <p className="font-mono text-txt-main text-xl tracking-tighter">{label} <small className="text-[10px] opacity-40">BPD</small></p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {payload.map((e: any, i: number) => e.value !== null && (
                                                    <div key={i} className="flex justify-between gap-12 items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color, boxShadow: `0 0 15px ${e.color}` }}></div>
                                                            <span className="font-black text-txt-muted uppercase text-[9px] tracking-[0.2em]">{e.name}</span>
                                                        </div>
                                                        <span className="font-mono font-black text-txt-main text-lg">{e.value} <small className="text-[10px] opacity-30 uppercase">psi</small></span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    cursor={{ stroke: colorPrimary, strokeWidth: 2, strokeDasharray: '6 6', opacity: 0.3 }}
                                />
                                <ReferenceLine x={aof} stroke="rgb(var(--color-danger))" strokeDasharray="10 5" strokeWidth={3} opacity={0.5} label={{ position: 'insideTopRight', value: 'AOF LIMIT', fill: 'rgb(var(--color-danger))', fontSize: 11, fontWeight: '950', style: { letterSpacing: '0.4em' }, offset: 20 }} />
                                
                                {/* Stable Zone Fill */}
                                <Area type="monotone" dataKey="targetP" fill="url(#iprGradArea)" stroke="none" />
                                
                                <Line type="monotone" dataKey="minP" name="MIN CURVE" stroke={colorSecondary} strokeWidth={2.5} strokeDasharray="8 4" dot={false} activeDot={false} isAnimationActive={false} opacity={0.5} />
                                <Line type="monotone" dataKey="maxP" name="MAX CURVE" stroke={colorPrimary} strokeWidth={2.5} strokeDasharray="8 4" dot={false} activeDot={false} isAnimationActive={false} opacity={0.2} />
                                <Area type="monotone" dataKey="targetP" name="OPERATIONAL" stroke={colorPrimary} strokeWidth={6} fill="url(#iprGradTarget)" filter="url(#chartGlow)" animationDuration={2500} isAnimationActive={true} />
                                
                                {points.map((p, i) => (
                                    <ReferenceDot key={i} x={p.flow} y={p.pwf} r={8} fill={p.color} stroke="white" strokeWidth={3} fillOpacity={1} style={{ filter: `drop-shadow(0 0 12px ${p.color})` }}>
                                        <Label value={p.label} position="top" fill={p.color} fontSize={11} fontWeight="950" offset={18} style={{ letterSpacing: '0.1em' }} />
                                    </ReferenceDot>
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                        
                        <div className="absolute bottom-4 right-8 flex items-center gap-6 opacity-40">
                             <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-primary"></div>
                                 <span className="text-[8px] font-black uppercase tracking-widest text-txt-muted">Nominal Path</span>
                             </div>
                             <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-secondary"></div>
                                 <span className="text-[8px] font-black uppercase tracking-widest text-txt-muted">Limit Boundary</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
