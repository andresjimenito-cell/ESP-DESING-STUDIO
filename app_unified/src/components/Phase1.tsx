
import React, { useState, useEffect } from 'react';
import { Cylinder, ArrowDown, Thermometer, FileCode, Trash2, Check, Activity, Map } from 'lucide-react';
import { SystemParams, PipeData } from '../types';
import { CASING_CATALOG, TUBING_CATALOG } from '../data';
import { useLanguage } from '../i18n';
import { TrajectoryPlot } from './TrajectoryPlot';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    rawSurvey: string;
    setRawSurvey: React.Dispatch<React.SetStateAction<string>>;
}

const TechnicalInput = ({ label, value, unit, onChange, className = "" }: any) => (
    <div className={`relative group ${className}`}>
        <label className="text-[10px] font-black text-txt-main/70 uppercase tracking-[0.2em] block mb-1 group-hover:text-primary transition-colors text-shadow-sm">{label}</label>
        <div className="flex items-center glass-surface-light border border-white/5 rounded-xl overflow-hidden group-focus-within:ring-2 group-focus-within:ring-primary/40 group-focus-within:border-primary transition-all p-0.5 relative light-sweep">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
            <input
                type="number"
                value={value}
                onChange={onChange}
                className="w-full bg-transparent p-2 text-sm font-mono font-black text-txt-main outline-none placeholder:text-surface-light/40 z-10"
            />
            {unit && <span className="glass-surface text-[9px] font-black text-txt-muted px-2.5 py-2 rounded-lg border border-white/5 select-none z-10 min-w-[40px] text-center">{unit}</span>}
        </div>
    </div>
);

const PipeConfigCard = ({ title, pipe, catalog, onSelect, bottomMD, onDepthChange, onRoughnessChange, colorClass, icon: Icon }: {
    title: string, pipe: PipeData, catalog: PipeData[], onSelect: (e: any) => void, bottomMD: number, onDepthChange: (e: any) => void, onRoughnessChange?: (e: any) => void, colorClass: string, icon: any
}) => {
    const { t } = useLanguage();

    return (
        <div className="glass-surface rounded-2xl border border-white/5 shadow-xl p-4 relative overflow-hidden group hover:border-primary/30 hover:shadow-glow-primary transition-all h-full flex flex-col justify-between light-sweep">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${colorClass} opacity-40 group-hover:opacity-100 transition-all duration-700 shadow-glow-primary`}></div>
            <div className="flex justify-between items-center mb-4 pl-1 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl glass-surface-light border border-white/10 ${colorClass.replace('bg-', 'text-')} shadow-glow-primary group-hover:scale-110 transition-transform duration-500`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div><h3 className="text-sm font-black text-txt-main uppercase tracking-widest">{title}</h3></div>
                </div>
                <div className="text-[10px] font-mono font-black text-txt-muted bg-canvas px-2 py-0.5 rounded border border-white/5">{pipe.od}" OD</div>
            </div>
            <div className="pl-1 space-y-1.5 relative z-10 flex-1 flex flex-col justify-center">
                <div className="space-y-0.5">
                    <label className="text-[9px] font-black text-txt-muted uppercase tracking-wider">{t('p1.grade')}</label>
                    <select className="w-full bg-canvas border border-white/5 text-[11px] font-bold text-txt-main rounded-lg p-2 outline-none focus:border-primary cursor-pointer" value={pipe.description} onChange={onSelect}>
                        {catalog.map(c => <option key={c.description} value={c.description}>{c.description}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                    <TechnicalInput label={t('p1.bottom')} value={bottomMD} unit="ft" onChange={onDepthChange} />
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-canvas border border-white/5 rounded-lg p-1 text-center flex flex-col justify-center shadow-inner">
                            <span className="block text-[8px] text-txt-muted uppercase font-black opacity-70">ID</span>
                            <span className="text-[10px] font-mono font-black text-txt-main">{pipe.id}"</span>
                        </div>
                        <div className="bg-canvas border border-white/5 rounded-lg p-1 text-center flex flex-col justify-center shadow-inner">
                            <span className="block text-[8px] text-txt-muted uppercase font-black opacity-70">{t('p1.weight')}</span>
                            <span className="text-[10px] font-mono font-black text-txt-main">{pipe.weight}#</span>
                        </div>
                    </div>
                </div>
                {onRoughnessChange && <TechnicalInput label={t('p1.roughness')} value={pipe.roughness} unit="ft" onChange={onRoughnessChange} />}
            </div>
        </div>
    )
};

export const Phase1: React.FC<Props> = ({ params, setParams, rawSurvey, setRawSurvey }) => {
    const { t } = useLanguage();
    const [mdInput, setMdInput] = useState('');
    const [tvdInput, setTvdInput] = useState('');

    useEffect(() => {
        if (!mdInput && !tvdInput && rawSurvey) {
            const lines = rawSurvey.split('\n');
            const mds = [], tvds = [];
            for (const line of lines) {
                const parts = line.trim().split(/[\t\s,]+/);
                if (parts.length >= 1) mds.push(parts[0]);
                if (parts.length >= 2) tvds.push(parts[1]);
            }
            setMdInput(mds.join('\n')); setTvdInput(tvds.join('\n'));
        }
    }, [rawSurvey]);

    const handleClear = () => { setMdInput(''); setTvdInput(''); setRawSurvey(''); setParams(prev => ({ ...prev, survey: [], totalDepthMD: 0 })); };
    const handleProcess = () => {
        const mds = mdInput.trim().split('\n').map(v => parseFloat(v.trim()));
        const tvds = tvdInput.trim().split('\n').map(v => parseFloat(v.trim()));
        const pts = [];
        const len = Math.min(mds.length, tvds.length);
        for (let i = 0; i < len; i++) if (!isNaN(mds[i]) && !isNaN(tvds[i])) pts.push({ md: mds[i], tvd: tvds[i] });
        pts.sort((a, b) => a.md - b.md);
        const td = pts.length > 0 ? pts[pts.length - 1].md : 0;
        setParams((prev: SystemParams) => ({ ...prev, survey: pts, totalDepthMD: td }));
        setRawSurvey(pts.map(p => `${p.md}\t${p.tvd}`).join('\n'));
    };

    return (
        <div className="flex flex-col gap-4 pb-8 animate-fadeIn">
            <div className="grid grid-cols-12 gap-4 shrink-0 transition-all duration-500">
                <div className="col-span-12 md:col-span-6 lg:col-span-4 transition-all hover:scale-[1.01]">
                    <PipeConfigCard title={t('p1.casing')} icon={Cylinder} colorClass="bg-slate-500" pipe={params.wellbore.casing} catalog={CASING_CATALOG} onSelect={(e) => { const c = CASING_CATALOG.find(x => x.description === e.target.value); if (c) setParams({ ...params, wellbore: { ...params.wellbore, casing: c } }); }} bottomMD={params.wellbore.casingBottom} onDepthChange={(e) => setParams({ ...params, wellbore: { ...params.wellbore, casingBottom: parseFloat(e.target.value) } })} />
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-4 transition-all hover:scale-[1.01]" style={{ animationDelay: '0.2s' }}>
                    <PipeConfigCard title={t('p1.tubing')} icon={ArrowDown} colorClass="bg-secondary" pipe={params.wellbore.tubing} catalog={TUBING_CATALOG} onSelect={(e) => { const t = TUBING_CATALOG.find(x => x.description === e.target.value); if (t) setParams({ ...params, wellbore: { ...params.wellbore, tubing: t } }); }} bottomMD={params.pressures.pumpDepthMD} onDepthChange={(e) => setParams({ ...params, pressures: { ...params.pressures, pumpDepthMD: parseFloat(e.target.value) } })} onRoughnessChange={(e) => setParams({ ...params, wellbore: { ...params.wellbore, tubing: { ...params.wellbore.tubing, roughness: parseFloat(e.target.value) } } })} />
                </div>
                <div className="col-span-12 md:col-span-12 lg:col-span-4 transition-all hover:scale-[1.01]" style={{ animationDelay: '0.3s' }}>
                    <div className="glass-surface rounded-[2rem] border border-white/5 shadow-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all duration-700 light-sweep h-full min-h-[280px]">
                        <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex justify-between items-center mb-3 pl-2 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-canvas border border-white/5 text-primary shadow-inner group-hover:shadow-[0_0_15px_rgb(var(--color-primary)/0.3)] transition-shadow"><Thermometer className="w-5 h-5" /></div>
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-widest leading-none shadow-sm">{t('p1.env')}</h3>
                            </div>
                        </div>
                        <div className="space-y-4 relative z-10 flex-1 flex flex-col justify-center">
                            <div className="flex items-center gap-4 bg-canvas/60 p-4 rounded-2xl border border-white/5 backdrop-blur-sm shadow-inner group/temp">
                                <span className="text-sm font-black text-secondary w-10">{t('p1.wh')}</span>
                                <input type="number" value={params.surfaceTemp} onChange={e => setParams({ ...params, surfaceTemp: parseFloat(e.target.value) })} className="w-20 bg-transparent text-center text-base font-black text-txt-main border-b-2 border-white/5 outline-none focus:border-secondary transition-all" />
                                <span className="flex-1 h-1 bg-gradient-to-r from-secondary to-primary opacity-30 rounded-full"></span>
                                <input type="number" value={params.bottomholeTemp} onChange={e => setParams({ ...params, bottomholeTemp: parseFloat(e.target.value) })} className="w-20 bg-transparent text-center text-base font-black text-txt-main border-b-2 border-white/5 outline-none focus:border-primary transition-all" />
                                <span className="text-sm font-black text-primary w-10 text-right">{t('p1.bh')}</span>
                            </div>
                            <TechnicalInput label={t('p1.midperfs')} value={params.wellbore.midPerfsMD} unit="ft" onChange={(e: any) => setParams({ ...params, wellbore: { ...params.wellbore, midPerfsMD: parseFloat(e.target.value) } })} className="pt-1" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 min-h-[500px]">
                <div className="col-span-12 lg:col-span-8 h-[500px] animate-fadeIn" style={{ animationDelay: '0.4s' }}><TrajectoryPlot survey={params.survey} params={params} /></div>
                <div className="col-span-12 lg:col-span-4 flex flex-col min-h-[500px] animate-fadeIn" style={{ animationDelay: '0.5s' }}>
                    <div className="glass-surface rounded-[2rem] border border-white/5 shadow-2xl flex-1 flex flex-col overflow-hidden relative">
                        <div className="px-6 py-5 glass-surface border-b border-white/5 flex justify-between items-center relative z-20 shrink-0">
                            <div className="flex items-center gap-4">
                                <FileCode className="w-6 h-6 text-primary shadow-glow-primary" />
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.25em]">{t('p1.survey_term')}</h3>
                            </div>
                            <button onClick={handleClear} className="text-[10px] font-black text-txt-muted hover:text-danger flex items-center gap-2.5 uppercase transition-all px-4 py-2 rounded-xl glass-surface-light border border-white/5">
                                <Trash2 className="w-4 h-4" /> {t('p1.clear')}
                            </button>
                        </div>
                        <div className="flex-1 grid grid-cols-2 divide-x divide-white/5 min-h-0 relative z-10">
                            <div className="flex flex-col h-full relative group">
                                <div className="absolute top-0 left-0 w-full px-5 py-2.5 bg-canvas/60 backdrop-blur-md border-b border-white/5 text-xs font-black text-secondary uppercase tracking-widest z-10 shadow-sm">{t('p1.md')}</div>
                                <textarea value={mdInput} onChange={e => setMdInput(e.target.value)} className="w-full h-full bg-transparent text-secondary font-mono text-sm p-5 pt-12 outline-none resize-none leading-relaxed custom-scrollbar selection:bg-secondary/30" placeholder={t('p1.paste_md')} />
                            </div>
                            <div className="flex flex-col h-full relative group">
                                <div className="absolute top-0 left-0 w-full px-5 py-2.5 bg-canvas/60 backdrop-blur-md border-b border-white/5 text-xs font-black text-primary uppercase tracking-widest z-10 shadow-sm">{t('p1.tvd')}</div>
                                <textarea value={tvdInput} onChange={e => setTvdInput(e.target.value)} className="w-full h-full bg-transparent text-primary font-mono text-sm p-5 pt-12 outline-none resize-none leading-relaxed custom-scrollbar selection:bg-primary/30" placeholder={t('p1.paste_tvd')} />
                            </div>
                        </div>
                        <div className="p-6 glass-surface border-t border-white/5 relative z-20 shrink-0">
                            <button onClick={handleProcess} className="w-full btn-premium-primary animate-pulse-glow hover:to-orange-500 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] transition-all border border-white/10 light-sweep flex items-center justify-center gap-3">
                                <Check className="w-6 h-6" /> {t('p1.process')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
