
import React, { useState, useMemo } from 'react';
import { Activity, Waves, Flame, Zap, Droplets, Percent, Beaker, Settings, ChevronRight, ChevronDown, Calculator, AlertTriangle, Lightbulb, Biohazard } from 'lucide-react';
import { SystemParams } from '../types';
import { geToSalinity, salinityToGE, calculateSolutionGOR } from '../utils';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
}

const TechInput = ({ label, value, unit, onChange, step = "any", disabled = false, className = "" }: any) => (
    <div className={`relative group ${disabled ? 'opacity-30 pointer-events-none grayscale' : ''} ${className}`}>
        <label className="text-[10px] font-black text-txt-muted uppercase tracking-[0.2em] block mb-1 group-hover:text-primary transition-colors">{label}</label>
        <div className="flex items-center glass-surface-light border border-white/5 rounded-xl overflow-hidden group-focus-within:ring-2 group-focus-within:ring-primary/40 transition-all p-0.5 relative light-sweep">
            <input
                type="number"
                step={step}
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="w-full bg-transparent p-1.5 text-sm font-mono font-black text-txt-main outline-none z-10"
            />
            {unit && <span className="glass-surface text-[9px] font-black text-txt-muted px-2.5 py-1 rounded-lg border border-white/5 select-none min-w-[40px] text-center z-10">{unit}</span>}
        </div>
    </div>
);

const CorrelationSelect = ({ label, value, onChange, options }: { label: string, value: string, onChange: (e: any) => void, options: string[] }) => (
    <div className="grid grid-cols-2 items-center gap-2 py-1.5 border-b border-white/5 last:border-0 hover:bg-surface-light/30 px-2 rounded-lg transition-colors group">
        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-wide group-hover:text-txt-main">{label}</label>
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                className="w-full bg-canvas text-[10px] font-black text-txt-main border border-white/5 rounded-lg py-1 pl-2 pr-6 outline-none focus:border-primary appearance-none cursor-pointer"
            >
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronRight className="w-3 h-3 text-txt-muted absolute right-1.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
        </div>
    </div>
);

export const Phase2: React.FC<Props> = ({ params, setParams }) => {
    const { t } = useLanguage();
    const [isPvtConfigOpen, setIsPvtConfigOpen] = useState(true);
    const [isImpuritiesOpen, setIsImpuritiesOpen] = useState(true);

    const calculatedGor = useMemo(() => {
        const tAvg = (params.surfaceTemp + params.bottomholeTemp) / 2;
        const correlation = params.fluids.correlations?.pbRs || 'Standing';
        return calculateSolutionGOR(params.fluids.pb, tAvg, params.fluids.apiOil, params.fluids.geGas, correlation);
    }, [params.fluids.pb, params.fluids.apiOil, params.fluids.geGas, params.surfaceTemp, params.bottomholeTemp, params.fluids.correlations?.pbRs]);

    const smartTips = useMemo(() => {
        const tips = [];
        if (params.fluids.apiOil < 15 && params.fluids.apiOil > 0) tips.push(t('tip.heavyOilVisc'));
        if (params.fluids.pb > 2000) tips.push(t('tip.highPb'));
        if (params.fluids.salinity > 100000) tips.push(t('tip.highSal'));
        return tips;
    }, [params.fluids.apiOil, params.fluids.pb, params.fluids.salinity, t]);

    const handleGorChange = (val: number) => {
        const wcFrac = params.fluids.waterCut / 100;
        setParams(p => ({ ...p, fluids: { ...p.fluids, gor: val, glr: val * (1 - wcFrac) } }));
    };

    const handleGlrChange = (val: number) => {
        const wcFrac = params.fluids.waterCut / 100;
        const factor = (1 - wcFrac);
        setParams(p => ({ ...p, fluids: { ...p.fluids, glr: val, gor: factor > 0 ? val / factor : 0 } }));
    };

    const handleWaterCutChange = (val: number) => {
        let safeVal = Math.max(0, Math.min(100, val));
        const wcFrac = safeVal / 100;
        const currentGor = params.fluids.gor;
        const newGlr = currentGor * (1 - wcFrac);
        setParams(p => ({ ...p, fluids: { ...p.fluids, waterCut: safeVal, glr: newGlr } }));
    };

    const updateCorr = (key: keyof typeof params.fluids.correlations, val: string) => {
        setParams(p => ({ ...p, fluids: { ...p.fluids, correlations: { ...p.fluids.correlations, [key]: val } } }));
    };

    const applyCalculatedGor = () => { if (calculatedGor > 0) handleGorChange(Math.round(calculatedGor)); };

    const hasImpurities = params.fluids.sandCut > 0 || params.fluids.h2s > 0 || params.fluids.co2 > 0 || params.fluids.n2 > 0;

    // Determine salinity tier label (no dynamic color classes)
    const salinityLabel = params.fluids.salinity < 1000 ? t('p2.fresh') : params.fluids.salinity < 30000 ? t('p2.brackish') : t('p2.brine');

    return (
        <div className="flex flex-col gap-4 pb-4 h-full overflow-hidden">

            {/* SMART TIPS BANNER */}
            {smartTips.length > 0 && (
                <div className="glass-surface border border-primary/30 rounded-xl p-4 flex items-center gap-4 animate-fadeIn shrink-0 shadow-glow-primary/10">
                    <div className="p-2.5 bg-primary/20 rounded-xl text-primary shrink-0 shadow-glow-primary animate-pulse"><Lightbulb className="w-5 h-5" /></div>
                    <div className="flex flex-wrap gap-x-8 gap-y-1">
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mr-2">PVT Smart Intelligence:</h4>
                        {smartTips.map((tip, i) => (
                            <p key={i} className="text-[11px] font-bold text-txt-muted flex items-center gap-2.5"><span className="w-1.5 h-1.5 bg-primary rounded-full shadow-glow-primary"></span>{tip}</p>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">

                {/* 1. OIL PHASE — primary accent */}
                <div className="glass-surface rounded-[2rem] border border-white/5 shadow-xl p-6 flex flex-col relative overflow-hidden group hover:border-primary/40 transition-all duration-700 animate-fadeIn h-full light-sweep" style={{ animationDelay: '0.1s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-primary to-primary/20 shadow-glow-primary"></div>

                    <div className="flex justify-between items-start mb-6 relative z-10 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl glass-surface-light text-primary border border-white/10 shadow-glow-primary group-hover:scale-110 transition-transform duration-500"><Flame className="w-6 h-6" /></div>
                            <div>
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.25em] leading-tight">{t('p2.oilPhase')}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-glow-primary"></span>
                                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-70">{t('p2.primaryData')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 relative z-10 flex-1 flex flex-col">
                        {/* Saturated / Dead Oil toggle */}
                        <div className="glass-surface-light p-1 rounded-2xl flex shadow-inner border border-white/5 backdrop-blur-sm">
                            <button onClick={() => setParams({ ...params, fluids: { ...params.fluids, isDeadOil: false } })} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${!params.fluids.isDeadOil ? 'bg-primary text-white shadow-glow-primary' : 'text-txt-muted hover:text-primary'}`}>{t('p2.sat')}</button>
                            <button onClick={() => setParams({ ...params, fluids: { ...params.fluids, isDeadOil: true } })} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${params.fluids.isDeadOil ? 'bg-primary text-white shadow-glow-primary' : 'text-txt-muted hover:text-primary'}`}>{t('p2.dead')}</button>
                        </div>

                        <div className="glass-surface-light rounded-[2rem] p-5 border border-white/5 space-y-4 shadow-inner">
                            <div className="grid grid-cols-2 gap-4">
                                <TechInput label={t('p2.api')} value={params.fluids.apiOil} unit="°API" onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, apiOil: parseFloat(e.target.value) } })} />
                                <TechInput label={t('p2.gasSg')} value={params.fluids.geGas} unit="SG" step="0.01" onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, geGas: parseFloat(e.target.value) } })} />
                            </div>
                            <div className={`transition-all duration-500 ${params.fluids.isDeadOil ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                                <TechInput label={t('p2.pb')} value={params.fluids.pb} unit="psi" disabled={params.fluids.isDeadOil} onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, pb: parseFloat(e.target.value) } })} />
                            </div>
                        </div>

                        {/* Density widget */}
                        <div className="mt-auto p-4 bg-primary/5 rounded-2xl border border-primary/15 shadow-inner group/density relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/density:opacity-20 transition-opacity">
                                <Activity className="w-12 h-12 text-primary" />
                            </div>
                            <div className="flex justify-between items-end mb-3 relative z-10">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Percent className="w-3.5 h-3.5" /> {t('p2.estDensity')}
                                    </span>
                                    <span className="text-[8px] font-bold text-txt-muted uppercase tracking-widest">Hydraulic Weighting</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[8px] font-black text-txt-muted uppercase opacity-60 tracking-tighter">Liquid SG</span>
                                    <span className="font-mono text-2xl font-black text-txt-main tracking-tighter drop-shadow-sm">
                                        {params.fluids.apiOil > 0 ? (141.5 / (131.5 + params.fluids.apiOil)).toFixed(3) : '---'}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3 relative z-10">
                                <div className="h-2.5 w-full bg-surface-light/50 rounded-full overflow-hidden shadow-inner flex p-0.5 border border-white/5">
                                    <div className="h-full bg-gradient-to-r from-primary to-primary/50 rounded-full transition-all duration-1000 ease-out shadow-primary/20 relative"
                                        style={{ width: `${Math.min(100, Math.max(5, ((141.5 / (131.5 + params.fluids.apiOil)) - 0.7) / 0.3 * 100))}%` }}>
                                        <div className="absolute top-0 right-0 w-1 h-full bg-white opacity-40 blur-[1px]"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[8px] font-black uppercase text-txt-muted tracking-widest px-1">
                                    <span className={params.fluids.apiOil > 35 ? "text-primary" : ""}>Light</span>
                                    <span className={params.fluids.apiOil <= 35 && params.fluids.apiOil > 20 ? "text-primary" : ""}>Medium</span>
                                    <span className={params.fluids.apiOil <= 20 ? "text-primary" : ""}>Heavy</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. WATER PHASE — secondary accent */}
                <div className="glass-surface rounded-[2rem] border border-white/5 shadow-xl p-6 flex flex-col relative overflow-hidden group hover:border-secondary/40 transition-all duration-700 animate-fadeIn h-full light-sweep" style={{ animationDelay: '0.2s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-secondary to-secondary/30 shadow-glow-secondary"></div>

                    <div className="flex justify-between items-start mb-6 relative z-10 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl glass-surface-light text-secondary border border-white/10 shadow-glow-secondary group-hover:scale-110 transition-transform duration-500"><Waves className="w-6 h-6" /></div>
                            <div>
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.25em] leading-tight">{t('p2.waterPhase')}</h3>
                                <div className="flex items-center gap-2 mt-1 opacity-70">
                                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-glow-secondary"></span>
                                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest">{t('p2.primaryData')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 relative z-10 flex-1 flex flex-col">
                        {/* Salinity Control */}
                        <div className="bg-secondary/5 p-3 xl:p-4 rounded-[2rem] border border-secondary/15 backdrop-blur-md relative overflow-hidden flex flex-col gap-2 shadow-xl">
                            <div className="flex items-center justify-between relative z-10 border-b border-secondary/10 pb-3">
                                <div className="flex items-center gap-2">
                                    <Beaker className="w-4 h-4 text-secondary" />
                                    <h4 className="text-[10px] font-black text-txt-main uppercase tracking-widest leading-none">{t('p2.salinityCtrl')}</h4>
                                </div>
                                <span className="text-[8px] font-black bg-secondary/10 text-secondary px-2.5 py-1 rounded-full border border-secondary/20 uppercase tracking-tighter">Analytical Mode</span>
                            </div>

                            <div className="space-y-4 relative z-10">
                                <TechInput
                                    label={t('p2.waterSg')}
                                    className=""
                                    value={params.fluids.geWater} unit="SG" step="0.001"
                                    onChange={(e: any) => { const ge = parseFloat(e.target.value); setParams({ ...params, fluids: { ...params.fluids, geWater: ge, salinity: geToSalinity(ge) } }); }}
                                />
                                <div className="flex items-center justify-center py-1">
                                    <div className="h-[1px] bg-gradient-to-r from-transparent via-secondary/30 to-transparent w-full relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-3 text-[7px] font-black text-secondary uppercase tracking-[0.3em] backdrop-blur-sm border border-secondary/20 rounded-full">{t('p2.synced')}</div>
                                    </div>
                                </div>
                                <TechInput
                                    label={t('p2.salinity')}
                                    className=""
                                    value={Math.round(params.fluids.salinity)} unit="ppm"
                                    onChange={(e: any) => { const sal = parseFloat(e.target.value); setParams({ ...params, fluids: { ...params.fluids, salinity: sal, geWater: salinityToGE(sal) } }); }}
                                />
                            </div>
                        </div>

                        {/* Fluid Type Indicator */}
                        <div className="mt-auto p-4 bg-secondary/5 rounded-2xl border border-secondary/15 shadow-inner group/indicator relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover/indicator:opacity-15 transition-opacity">
                                <Waves className="w-10 h-10 text-secondary" />
                            </div>
                            <div className="flex items-center justify-between relative z-10 mb-3">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] mb-1">{t('p2.waterType')}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-secondary animate-ping"></div>
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Ionization Potential</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[8px] font-black text-txt-muted uppercase opacity-60 tracking-tighter">Cond. Est.</span>
                                    <span className="font-mono text-xl font-black text-secondary tracking-tighter">
                                        {Math.round(params.fluids.salinity * 1.6).toLocaleString()} <span className="text-[10px] opacity-60">μS</span>
                                    </span>
                                </div>
                            </div>
                            <div className="px-4 py-3 rounded-xl border-t border-white/5 transition-all duration-500 flex items-center justify-between bg-secondary/10 text-txt-main">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{salinityLabel}</span>
                                <ChevronRight className="w-4 h-4 opacity-40 group-hover/indicator:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. FLUID MIXTURE & GOR */}
                <div className="glass-surface rounded-[2rem] border border-white/5 shadow-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all duration-700 animate-fadeIn h-full light-sweep" style={{ animationDelay: '0.3s' }}>
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-secondary shadow-glow-primary"></div>

                    <div className="flex items-center gap-4 mb-4 relative z-10 shrink-0">
                        <div className="p-3 rounded-2xl glass-surface-light text-primary border border-white/10 shadow-glow-primary group-hover:scale-110 transition-transform duration-500"><Droplets className="w-6 h-6" /></div>
                        <div>
                            <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.25em] leading-tight">{t('p2.mixture')}</h3>
                            <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-70">{t('p2.finalCalc')}</span>
                        </div>
                    </div>

                    <div className="glass-surface-light rounded-[2rem] p-6 border border-white/5 flex flex-col items-center justify-center relative shadow-inner flex-1 mb-4">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                                <path className="text-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                <path className="text-primary transition-all duration-700 ease-out" strokeDasharray={`${params.fluids.waterCut}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px rgba(var(--color-primary), 0.8))' }} />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <input
                                    type="number" min="0" max="100" step="0.1"
                                    value={params.fluids.waterCut}
                                    onChange={e => handleWaterCutChange(parseFloat(e.target.value) || 0)}
                                    className="w-20 bg-transparent text-3xl font-black text-txt-main tracking-tighter text-center outline-none selection:bg-primary/20"
                                />
                                <span className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] mt-1">{t('p2.waterCut')}</span>
                            </div>
                        </div>
                        <input type="range" min="0" max="100" step="0.1" value={params.fluids.waterCut} onChange={e => handleWaterCutChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-surface-light/50 rounded-full appearance-none cursor-pointer mt-5 accent-primary hover:accent-orange-500 transition-all" />
                    </div>

                    <div className="space-y-2 relative z-10">
                        <div className="relative">
                            <TechInput label={t('p2.gor')} value={params.fluids.gor} unit="scf/stb" onChange={(e: any) => handleGorChange(parseFloat(e.target.value))} />
                            {params.fluids.pb > 0 && !params.fluids.isDeadOil && (
                                <div className="mt-2 flex items-center justify-between bg-canvas p-3 rounded-xl border border-white/5 shadow-inner group/rs">
                                    <div className="text-[10px] font-black text-txt-muted"><span className="block opacity-70 uppercase tracking-widest mb-0.5">{t('p2.rsPb')}</span><span className="text-sm font-mono text-secondary">{calculatedGor.toFixed(0)} scf/stb</span></div>
                                    <button onClick={applyCalculatedGor} className="bg-surface hover:bg-primary/20 hover:text-primary text-txt-muted p-2 rounded-lg shadow-sm transition-all border border-white/5 active:scale-90" title="Apply Calculated Rs"><Calculator className="w-5 h-5" /></button>
                                </div>
                            )}
                        </div>
                        <TechInput label={t('p2.glr')} value={params.fluids.glr} unit="scf/bbl" onChange={(e: any) => handleGlrChange(parseFloat(e.target.value))} />
                    </div>
                </div>

            </div>

            {/* BOTTOM PANELS */}
            <div className="flex gap-4 shrink-0">
                {/* 4. CONTAMINANTS CARD */}
                <div className="flex-1 glass-surface rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-500 ease-in-out">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-danger to-warning"></div>
                    <div className="w-full flex items-center justify-between p-4 bg-surface-light/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 shadow-sm"><Biohazard className="w-5 h-5" /></div>
                            <div className="text-left">
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-widest">{t('p2.impurities')}</h3>
                                <p className="text-[10px] font-bold text-txt-muted uppercase mt-0.5 tracking-wider">{t('p2.solidsContam')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {hasImpurities && (
                                <div className="bg-danger/10 text-danger border border-danger/20 px-2 py-0.5 rounded-lg flex items-center gap-2 animate-pulse">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wide">{t('p2.activeTerm')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {isImpuritiesOpen && (
                        <div className="px-5 pb-5 pt-0 animate-fadeIn">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-white/10">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-secondary uppercase tracking-widest mb-2 flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> {t('p2.solidsContam')}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <TechInput label={t('p2.solidsVol')} value={params.fluids.sandCut} unit="%" step="0.1" onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, sandCut: parseFloat(e.target.value) } })} />
                                        <TechInput label={t('p2.solidsSg')} value={params.fluids.sandDensity} unit="SG" step="0.01" onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, sandDensity: parseFloat(e.target.value) } })} />
                                    </div>
                                </div>
                                <div className="space-y-4 md:border-l md:border-white/10 md:pl-6">
                                    <h4 className="text-xs font-black text-danger uppercase tracking-widest mb-2 flex items-center gap-2"><Biohazard className="w-3.5 h-3.5" /> {t('p2.impurities')}</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <TechInput label={t('p2.co2')} value={params.fluids.co2} unit="%" step="0.1" onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, co2: parseFloat(e.target.value) } })} />
                                        <TechInput label={t('p2.h2s')} value={params.fluids.h2s} unit="%" step="0.1" onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, h2s: parseFloat(e.target.value) } })} />
                                        <TechInput label={t('p2.n2')} value={params.fluids.n2} unit="%" step="0.1" onChange={(e: any) => setParams({ ...params, fluids: { ...params.fluids, n2: parseFloat(e.target.value) } })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. CONFIGURATION PANEL */}
                <div className="flex-1 glass-surface rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-500 ease-in-out">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary"></div>
                    <div className="w-full flex items-center justify-between p-4 bg-surface-light/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm"><Settings className="w-5 h-5" /></div>
                            <h3 className="text-sm font-black text-txt-main uppercase tracking-widest">{t('p2.pvtConfig')}</h3>
                        </div>
                    </div>
                    {isPvtConfigOpen && (
                        <div className="px-5 pb-5 pt-0 animate-fadeIn">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:divide-x md:divide-white/10 pt-3 border-t border-white/10">
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-2 border-l-2 border-primary pl-2">{t('p2.viscModels')}</h4>
                                    <div className="flex flex-col gap-1.5">
                                        <CorrelationSelect label={t('p2.deadOilTerm')} value={params.fluids.correlations?.viscDeadOil || 'Beggs-Robinson'} onChange={e => updateCorr('viscDeadOil', e.target.value)} options={['Kartoatmodjo', 'Beggs-Robinson', 'Glaso', 'Beal']} />
                                        <CorrelationSelect label={t('p2.satTerm')} value={params.fluids.correlations?.viscSatOil || 'Beggs-Robinson'} onChange={e => updateCorr('viscSatOil', e.target.value)} options={['Kartoatmodjo', 'Beggs-Robinson', 'Chew-Connally']} />
                                        <CorrelationSelect label={t('p2.unsatTerm')} value={params.fluids.correlations?.viscUnsatOil || 'Vasquez-Beggs'} onChange={e => updateCorr('viscUnsatOil', e.target.value)} options={['Kartoatmodjo', 'Vasquez-Beggs', 'Beal']} />
                                    </div>
                                </div>
                                <div className="space-y-3 pl-0 md:pl-6">
                                    <h4 className="text-xs font-black text-secondary uppercase tracking-widest mb-2 border-l-2 border-secondary pl-2">{t('p2.pvtProp')}</h4>
                                    <div className="flex flex-col gap-1.5">
                                        <CorrelationSelect label={t('p2.oilDenTerm')} value={params.fluids.correlations?.oilDensity || 'Katz'} onChange={e => updateCorr('oilDensity', e.target.value)} options={['Standing', 'Vasquez-Beggs', 'Glaso', 'Marhoun', 'Katz']} />
                                        <CorrelationSelect label={t('p2.pbRsTerm')} value={params.fluids.correlations?.pbRs || 'Standing'} onChange={e => updateCorr('pbRs', e.target.value)} options={['Standing', 'Vasquez-Beggs', 'Glaso', 'Lasater', 'Kartoatmodjo', 'Petrosky', 'Marhoun']} />
                                        <CorrelationSelect label={t('p2.zFactTerm')} value={params.fluids.correlations?.zFactor || 'Dranchuk-Abu-Kassem'} onChange={e => updateCorr('zFactor', e.target.value)} options={['Hall & Yarborough', 'Dranchuk-Abu-Kassem', 'Dranchuk-Purvis']} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
