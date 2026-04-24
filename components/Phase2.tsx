
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
        <label className="text-sm font-bold text-txt-muted uppercase tracking-wider block mb-2 group-hover:text-primary transition-colors">{label}</label>
        <div className="flex items-center bg-canvas border border-surface-light rounded-2xl overflow-hidden group-focus-within:ring-1 group-focus-within:ring-primary group-focus-within:border-primary transition-all p-1">
            <input
                type="number"
                step={step}
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="w-full bg-transparent p-3 text-lg font-mono font-bold text-txt-main outline-none"
            />
            {unit && <span className="bg-surface text-sm font-bold text-txt-muted px-4 py-3 rounded-xl border border-surface-light select-none min-w-[50px] text-center">{unit}</span>}
        </div>
    </div>
);

const CorrelationSelect = ({ label, value, onChange, options }: { label: string, value: string, onChange: (e:any)=>void, options: string[] }) => (
    <div className="grid grid-cols-2 items-center gap-8 py-4 border-b border-surface-light last:border-0 hover:bg-surface-light/30 px-4 rounded-xl transition-colors group">
        <label className="text-sm font-bold text-txt-muted uppercase tracking-wide group-hover:text-txt-main">{label}</label>
        <div className="relative">
            <select 
                value={value} 
                onChange={onChange} 
                className="w-full bg-canvas text-base font-bold text-txt-main border border-surface-light rounded-xl py-3 pl-4 pr-10 outline-none focus:border-primary appearance-none cursor-pointer"
            >
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronRight className="w-5 h-5 text-txt-muted absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
        </div>
    </div>
);

export const Phase2: React.FC<Props> = ({ params, setParams }) => {
    const { t } = useLanguage();
    const [isPvtConfigOpen, setIsPvtConfigOpen] = useState(false);
    const [isImpuritiesOpen, setIsImpuritiesOpen] = useState(false);

    const calculatedGor = useMemo(() => {
        const tAvg = (params.surfaceTemp + params.bottomholeTemp) / 2;
        const correlation = params.fluids.correlations?.pbRs || 'Standing';
        return calculateSolutionGOR(params.fluids.pb, tAvg, params.fluids.apiOil, params.fluids.geGas, correlation);
    }, [params.fluids.pb, params.fluids.apiOil, params.fluids.geGas, params.surfaceTemp, params.bottomholeTemp, params.fluids.correlations?.pbRs]);

    // SMART TIPS
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

    return (
        <div className="flex flex-col gap-10 pb-12">
            
            {/* SMART TIPS BANNER */}
            {smartTips.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-[24px] p-6 flex items-start gap-4 animate-fadeIn">
                    <div className="p-3 bg-amber-500/20 rounded-full text-amber-500 shrink-0"><Lightbulb className="w-6 h-6" /></div>
                    <div className="space-y-1 pt-1">
                        <h4 className="text-sm font-black text-amber-500 uppercase tracking-wider">PVT Smart Tips</h4>
                        {smartTips.map((tip, i) => (
                            <p key={i} className="text-xs font-bold text-txt-muted">{tip}</p>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                
                {/* 1. OIL PHASE */}
                <div className="bg-surface rounded-[32px] border border-surface-light shadow-lg p-8 flex flex-col gap-10 relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-r from-orange-600 to-amber-500"></div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-2xl bg-orange-900/30 text-orange-400 border border-orange-500/30"><Flame className="w-6 h-6" /></div>
                        <div>
                            <h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{t('p2.oilPhase')}</h3>
                            <span className="text-[10px] font-bold text-txt-muted uppercase">Primary Data</span>
                        </div>
                    </div>
                    <div className="space-y-10">
                        <div className="bg-canvas p-2 rounded-3xl flex shadow-inner border border-surface-light">
                            <button onClick={() => setParams({...params, fluids: {...params.fluids, isDeadOil: false}})} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${!params.fluids.isDeadOil ? 'bg-surface-light text-white shadow-md' : 'text-txt-muted hover:text-txt-main'}`}>{t('p2.sat')}</button>
                            <button onClick={() => setParams({...params, fluids: {...params.fluids, isDeadOil: true}})} className={`flex-1 py-4 text-xs font-black uppercase rounded-2xl transition-all ${params.fluids.isDeadOil ? 'bg-surface-light text-white shadow-md' : 'text-txt-muted hover:text-txt-main'}`}>{t('p2.dead')}</button>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <TechInput label={t('p2.api')} value={params.fluids.apiOil} unit="°API" onChange={(e: any) => setParams({...params, fluids: {...params.fluids, apiOil: parseFloat(e.target.value)}})} />
                            <TechInput label={t('p2.gasSg')} value={params.fluids.geGas} unit="SG" step="0.01" onChange={(e: any) => setParams({...params, fluids: {...params.fluids, geGas: parseFloat(e.target.value)}})} />
                        </div>
                        <div className={`transition-all duration-300 ${params.fluids.isDeadOil ? 'opacity-20 blur-sm pointer-events-none' : ''}`}>
                             <TechInput label={t('p2.pb')} value={params.fluids.pb} unit="psi" disabled={params.fluids.isDeadOil} onChange={(e: any) => setParams({...params, fluids: {...params.fluids, pb: parseFloat(e.target.value)}})} />
                        </div>
                        <div className="p-6 bg-canvas rounded-3xl border border-surface-light">
                            <div className="flex justify-between items-center text-xs font-bold text-txt-muted uppercase mb-4"><span>{t('p2.estDensity')}</span><span className="font-mono text-base text-txt-main">{params.fluids.apiOil > 0 ? (141.5 / (131.5 + params.fluids.apiOil)).toFixed(3) : '-'} SG</span></div>
                            <div className="h-3 w-full bg-surface-light rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" style={{width: `${Math.min(100, Math.max(0, ((141.5 / (131.5 + params.fluids.apiOil)) - 0.7) / 0.3 * 100))}%`}}></div></div>
                        </div>
                    </div>
                </div>

                {/* 2. WATER PHASE */}
                <div className="bg-surface rounded-[32px] border border-surface-light shadow-lg p-8 flex flex-col gap-10 relative overflow-hidden group hover:border-cyan-500/30 transition-colors">
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-r from-cyan-500 to-teal-400"></div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-2xl bg-cyan-900/30 text-cyan-400 border border-cyan-500/30"><Waves className="w-6 h-6" /></div>
                        <h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{t('p2.waterPhase')}</h3>
                    </div>
                    <div className="space-y-8">
                        <div className="bg-cyan-950/20 p-8 rounded-3xl border border-cyan-900/50">
                            <div className="flex items-center gap-4 mb-6"><Beaker className="w-5 h-5 text-cyan-400" /><h4 className="text-sm font-black text-cyan-300 uppercase tracking-wider">{t('p2.salinityCtrl')}</h4></div>
                            <div className="space-y-6">
                                <TechInput label={t('p2.waterSg')} value={params.fluids.geWater} unit="SG" step="0.001" onChange={(e: any) => { const ge = parseFloat(e.target.value); setParams({...params, fluids: {...params.fluids, geWater: ge, salinity: geToSalinity(ge)}}); }} />
                                <div className="flex items-center gap-4 opacity-30"><div className="h-px bg-cyan-500 flex-1"></div><span className="text-xs font-bold text-cyan-500 uppercase">{t('p2.synced')}</span><div className="h-px bg-cyan-500 flex-1"></div></div>
                                <TechInput label={t('p2.salinity')} value={Math.round(params.fluids.salinity)} unit="ppm" onChange={(e: any) => { const sal = parseFloat(e.target.value); setParams({...params, fluids: {...params.fluids, salinity: sal, geWater: salinityToGE(sal)}}); }} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-6 bg-canvas rounded-2xl border border-surface-light shadow-sm">
                            <span className="text-xs font-bold text-txt-muted uppercase">{t('p2.waterType')}</span>
                            <span className={`text-sm font-black uppercase px-4 py-2 rounded-xl ${params.fluids.salinity < 1000 ? 'bg-blue-900/50 text-blue-300 border border-blue-800' : params.fluids.salinity < 30000 ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800' : 'bg-teal-900/50 text-teal-300 border border-teal-800'}`}>
                                {params.fluids.salinity < 1000 ? t('p2.fresh') : params.fluids.salinity < 30000 ? t('p2.brackish') : t('p2.brine')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. FLUID MIXTURE & GOR */}
                <div className="bg-surface rounded-[32px] border border-surface-light shadow-lg p-8 flex flex-col gap-10 relative overflow-hidden group hover:border-primary/30 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-secondary"></div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-2xl bg-primary/20 text-primary border border-primary/30"><Droplets className="w-6 h-6" /></div>
                        <div>
                            <h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{t('p2.mixture')}</h3>
                            <span className="text-[10px] font-bold text-txt-muted uppercase">Final Calculations</span>
                        </div>
                    </div>
                    <div className="bg-canvas rounded-3xl p-10 border border-surface-light flex flex-col items-center justify-center relative shadow-inner">
                        <div className="relative w-52 h-52 flex items-center justify-center">
                             <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                                <path className="text-surface-light" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                                <path className="text-primary drop-shadow-[0_0_6px_rgba(var(--color-primary),0.5)] transition-all duration-500 ease-out" strokeDasharray={`${params.fluids.waterCut}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                             </svg>
                             <div className="absolute inset-0 flex flex-col items-center justify-center">
                                 <span className="text-6xl font-black text-txt-main tracking-tighter drop-shadow-md">{params.fluids.waterCut.toFixed(1)}%</span>
                                 <span className="text-xs font-bold text-txt-muted uppercase tracking-widest mt-2">{t('p2.waterCut')}</span>
                             </div>
                        </div>
                        <input type="range" min="0" max="100" step="0.1" value={params.fluids.waterCut} onChange={e => handleWaterCutChange(parseFloat(e.target.value))} className="w-full h-3 bg-surface-light rounded-xl appearance-none cursor-pointer mt-10 accent-primary hover:accent-primary/80 transition-all" />
                        <div className="w-full mt-8 border-t border-surface-light pt-8"><TechInput label={`${t('p2.waterCut')} (Precise)`} value={params.fluids.waterCut} unit="%" step="0.1" onChange={(e: any) => handleWaterCutChange(parseFloat(e.target.value))} /></div>
                    </div>
                    <div className="space-y-8">
                        <div className="relative">
                            {/* Visual Alert for GOR Recalculation */}
                            {params.fluids.pb > 0 && !params.fluids.isDeadOil && (
                                <div className="mb-4 flex items-center gap-3 text-amber-500 bg-amber-900/20 p-3 rounded-xl border border-amber-900/50">
                                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-wide">AI: GOR Sync with PVT</span>
                                </div>
                            )}
                            <TechInput label={t('p2.gor')} value={params.fluids.gor.toFixed(1)} unit="scf/stb" onChange={(e: any) => handleGorChange(parseFloat(e.target.value))} />
                            
                            {params.fluids.pb > 0 && !params.fluids.isDeadOil && (
                                <div className="mt-4 flex items-center justify-between bg-canvas p-4 rounded-2xl border border-surface-light">
                                    <div className="text-xs font-bold text-txt-muted"><span className="block opacity-70 uppercase tracking-widest mb-1">Rs @ Pb ({params.fluids.correlations?.pbRs || 'Standing'})</span><span className="text-base font-mono text-emerald-400">{calculatedGor.toFixed(0)} scf/stb</span></div>
                                    <button onClick={applyCalculatedGor} className="bg-surface hover:bg-emerald-600 hover:text-white text-txt-muted p-3 rounded-xl shadow-lg transition-colors border border-surface-light hover:border-emerald-500" title="Apply Calculated Rs"><Calculator className="w-5 h-5" /></button>
                                </div>
                            )}
                        </div>
                        <TechInput label={t('p2.glr')} value={params.fluids.glr.toFixed(1)} unit="scf/bbl" onChange={(e: any) => handleGlrChange(parseFloat(e.target.value))} />
                    </div>
                </div>

            </div>

            {/* NEW: CONTAMINANTS CARD */}
            <div className={`bg-surface rounded-[32px] border border-surface-light shadow-lg relative overflow-hidden transition-all duration-500 ease-in-out`}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-amber-600"></div>
                <button onClick={() => setIsImpuritiesOpen(!isImpuritiesOpen)} className="w-full flex items-center justify-between p-10 focus:outline-none hover:bg-surface-light/50 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-red-900/30 text-red-400 border border-red-500/30"><Biohazard className="w-6 h-6" /></div>
                        <div>
                            <h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{t('p2.impurities')}</h3>
                            <p className="text-[10px] font-bold text-txt-muted uppercase mt-1">Solids, Sand & Contaminants</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        {hasImpurities && (
                            <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-wide">Adjustments Active</span>
                            </div>
                        )}
                        <div className={`p-3 rounded-full bg-canvas border border-surface-light text-txt-muted transition-transform duration-300 ${isImpuritiesOpen ? 'rotate-180 text-red-400 border-red-500/30' : ''}`}><ChevronDown className="w-8 h-8" /></div>
                    </div>
                </button>
                {isImpuritiesOpen && (
                    <div className="px-10 pb-10 pt-0 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-surface-light/50">
                            {/* Solids Section */}
                            <div className="space-y-6">
                                <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> Solids & Sand</h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <TechInput label={t('p2.solidsVol')} value={params.fluids.sandCut} unit="%" step="0.1" onChange={(e: any) => setParams({...params, fluids: {...params.fluids, sandCut: parseFloat(e.target.value)}})} />
                                    <TechInput label={t('p2.solidsSg')} value={params.fluids.sandDensity} unit="SG" step="0.01" onChange={(e: any) => setParams({...params, fluids: {...params.fluids, sandDensity: parseFloat(e.target.value)}})} />
                                </div>
                                <p className="text-xs text-txt-muted leading-relaxed bg-canvas p-4 rounded-xl border border-surface-light">
                                    Note: Adding solids will increase mixture density and viscosity (using Thomas equation for suspension rheology). This increases required head and horsepower.
                                </p>
                            </div>
                            
                            {/* Gas Impurities Section */}
                            <div className="space-y-6 md:border-l md:border-surface-light/50 md:pl-12">
                                <h4 className="text-sm font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Biohazard className="w-4 h-4" /> Gas Impurities</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <TechInput label={t('p2.co2')} value={params.fluids.co2} unit="%" step="0.1" onChange={(e: any) => setParams({...params, fluids: {...params.fluids, co2: parseFloat(e.target.value)}})} />
                                    <TechInput label={t('p2.h2s')} value={params.fluids.h2s} unit="%" step="0.1" onChange={(e: any) => setParams({...params, fluids: {...params.fluids, h2s: parseFloat(e.target.value)}})} />
                                    <TechInput label={t('p2.n2')} value={params.fluids.n2} unit="%" step="0.1" onChange={(e: any) => setParams({...params, fluids: {...params.fluids, n2: parseFloat(e.target.value)}})} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* CONFIGURATION PANEL */}
            <div className={`bg-surface rounded-[32px] border border-surface-light shadow-lg relative overflow-hidden transition-all duration-500 ease-in-out`}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-600 to-purple-500"></div>
                <button onClick={() => setIsPvtConfigOpen(!isPvtConfigOpen)} className="w-full flex items-center justify-between p-10 focus:outline-none hover:bg-surface-light/50 transition-colors">
                    <div className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-indigo-900/30 text-indigo-400 border border-indigo-500/30"><Settings className="w-6 h-6" /></div><h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{t('p2.pvtConfig')}</h3></div>
                    <div className={`p-3 rounded-full bg-canvas border border-surface-light text-txt-muted transition-transform duration-300 ${isPvtConfigOpen ? 'rotate-180 text-indigo-400 border-indigo-500/30' : ''}`}><ChevronDown className="w-8 h-8" /></div>
                </button>
                {isPvtConfigOpen && (
                    <div className="px-10 pb-10 pt-0 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:divide-x md:divide-surface-light/50 pt-8 border-t border-surface-light/50">
                            <div className="space-y-6">
                                <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-6 border-l-4 border-primary pl-4">Viscosity Models</h4>
                                <div className="flex flex-col gap-4">
                                    <CorrelationSelect label="Dead Oil" value={params.fluids.correlations?.viscDeadOil || 'Beggs-Robinson'} onChange={e => updateCorr('viscDeadOil', e.target.value)} options={['Kartoatmodjo', 'Beggs-Robinson', 'Glaso', 'Beal']} />
                                    <CorrelationSelect label="Saturated" value={params.fluids.correlations?.viscSatOil || 'Beggs-Robinson'} onChange={e => updateCorr('viscSatOil', e.target.value)} options={['Kartoatmodjo', 'Beggs-Robinson', 'Chew-Connally']} />
                                    <CorrelationSelect label="Undersaturated" value={params.fluids.correlations?.viscUnsatOil || 'Vasquez-Beggs'} onChange={e => updateCorr('viscUnsatOil', e.target.value)} options={['Kartoatmodjo', 'Vasquez-Beggs', 'Beal']} />
                                    <CorrelationSelect label="Gas" value={params.fluids.correlations?.viscGas || 'Lee'} onChange={e => updateCorr('viscGas', e.target.value)} options={['Lee', 'Carr-Kobayashi-Burrows']} />
                                    <CorrelationSelect label="Water" value={params.fluids.correlations?.viscWater || 'Matthews & Russell'} onChange={e => updateCorr('viscWater', e.target.value)} options={['Matthews & Russell', 'Meehan']} />
                                </div>
                            </div>
                            <div className="space-y-6 pl-0 md:pl-8">
                                <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-6 border-l-4 border-amber-500 pl-4">PVT Properties</h4>
                                <div className="flex flex-col gap-4">
                                    <CorrelationSelect label="Oil Density" value={params.fluids.correlations?.oilDensity || 'Katz'} onChange={e => updateCorr('oilDensity', e.target.value)} options={['Standing', 'Vasquez-Beggs', 'Glaso', 'Marhoun', 'Katz']} />
                                    <CorrelationSelect label="Bubble Point & GOR" value={params.fluids.correlations?.pbRs || 'Standing'} onChange={e => updateCorr('pbRs', e.target.value)} options={['Standing', 'Vasquez-Beggs', 'Glaso', 'Lasater', 'Kartoatmodjo', 'Petrosky', 'Marhoun']} />
                                    <CorrelationSelect label="Oil Compressibility" value={params.fluids.correlations?.oilComp || 'Vasquez-Beggs'} onChange={e => updateCorr('oilComp', e.target.value)} options={['Kartoatmodjo', 'Vasquez-Beggs', 'Petrosky']} />
                                    <CorrelationSelect label="Oil FVF (Bo)" value={params.fluids.correlations?.oilFvf || 'Vasquez-Beggs'} onChange={e => updateCorr('oilFvf', e.target.value)} options={['Kartoatmodjo', 'Standing', 'Vasquez-Beggs', 'Glaso', 'Marhoun']} />
                                    <CorrelationSelect label="Z Factor" value={params.fluids.correlations?.zFactor || 'Dranchuk-Abu-Kassem'} onChange={e => updateCorr('zFactor', e.target.value)} options={['Hall & Yarborough', 'Dranchuk-Abu-Kassem', 'Dranchuk-Purvis']} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
