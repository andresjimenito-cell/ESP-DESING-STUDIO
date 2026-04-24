
import React, { useState, useEffect, useMemo } from 'react';
import { HardDrive, Ruler, Map, Thermometer, Layers, Cylinder, ArrowDown, CircleDot, Target, Hash, FileCode, Trash2, Check, Pickaxe, Clipboard, FileText, User } from 'lucide-react';
import { SystemParams, PipeData } from '../types';
import { CASING_CATALOG, TUBING_CATALOG } from '../data';
import { interpolateTVD } from '../utils';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Label, ReferenceDot, Tooltip, ReferenceLine, ReferenceArea, Area } from 'recharts';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    rawSurvey: string;
    setRawSurvey: React.Dispatch<React.SetStateAction<string>>;
}

const TechnicalInput = ({ label, value, unit, onChange, className = "" }: any) => (
    <div className={`relative group ${className}`}>
        <label className="text-sm font-bold text-txt-muted uppercase tracking-wider block mb-2 group-hover:text-primary transition-colors">{label}</label>
        <div className="flex items-center bg-canvas border border-surface-light rounded-2xl overflow-hidden group-focus-within:ring-1 group-focus-within:ring-primary group-focus-within:border-primary transition-all p-1">
            <input 
                type="number" 
                value={value} 
                onChange={onChange} 
                className="w-full bg-transparent p-3 text-lg font-mono font-bold text-txt-main outline-none placeholder:text-surface-light"
            />
            {unit && <span className="bg-surface text-sm font-bold text-txt-muted px-4 py-3 rounded-xl border border-surface-light select-none">{unit}</span>}
        </div>
    </div>
);

const PipeConfigCard = ({ title, pipe, catalog, onSelect, bottomMD, onDepthChange, colorClass, icon: Icon }: { 
    title: string, pipe: PipeData, catalog: PipeData[], onSelect: (e:any)=>void, bottomMD: number, onDepthChange: (e:any)=>void, colorClass: string, icon: any 
}) => {
    const { t } = useLanguage();
    return (
    <div className="bg-surface rounded-[32px] border border-surface-light shadow-lg p-8 relative overflow-hidden group hover:border-surface-light/80 transition-all h-full">
        <div className={`absolute top-0 left-0 w-2 h-full ${colorClass} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
        
        <div className="flex justify-between items-start mb-8 pl-4">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-canvas border border-surface-light ${colorClass.replace('bg-', 'text-')}`}>
                    <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{title}</h3>
            </div>
            <div className="text-sm font-mono text-txt-muted bg-canvas px-4 py-2 rounded-xl border border-surface-light">
                {pipe.od}" OD
            </div>
        </div>
        
        <div className="pl-4 space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-bold text-txt-muted uppercase">{t('p1.grade')}</label>
                <select 
                    className="w-full bg-canvas border border-surface-light text-base font-bold text-txt-main rounded-2xl p-4 outline-none focus:border-primary"
                    value={pipe.description} 
                    onChange={onSelect}
                >
                    {catalog.map(c => <option key={c.description} value={c.description}>{c.description}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <TechnicalInput 
                    label={t('p1.bottom')} 
                    value={title.includes("Pump") ? bottomMD : bottomMD} 
                    unit="ft"
                    onChange={onDepthChange}
                />
                <div className="grid grid-cols-2 gap-3">
                     <div className="bg-canvas border border-surface-light rounded-2xl p-3 text-center flex flex-col justify-center">
                        <span className="block text-xs text-txt-muted uppercase font-bold mb-1">ID</span>
                        <span className="text-sm font-mono font-bold text-txt-main">{pipe.id}"</span>
                     </div>
                     <div className="bg-canvas border border-surface-light rounded-2xl p-3 text-center flex flex-col justify-center">
                        <span className="block text-xs text-txt-muted uppercase font-bold mb-1">{t('p1.weight')}</span>
                        <span className="text-sm font-mono font-bold text-txt-main">{pipe.weight}#</span>
                     </div>
                </div>
            </div>
        </div>
    </div>
)};

const TrajectoryPlot = ({ survey, params }: { survey: any[], params: SystemParams }) => {
    const { t } = useLanguage();
    
    // Theme Colors
    const colorPrimary = 'rgb(var(--color-primary))';
    const colorSecondary = 'rgb(var(--color-secondary))';
    const colorTextMuted = 'rgb(var(--color-text-muted))';
    const colorTextMain = 'rgb(var(--color-text-main))';
    const colorSurfaceLight = 'rgb(var(--color-surface-light))';
    const colorSurface = 'rgb(var(--color-surface))';
    const colorCanvas = 'rgb(var(--color-canvas))';

    const { processedData, pumpDep, pumpTVD, perfsDep, perfsTVD, maxTVD, kopPoint } = useMemo(() => {
        let departure = 0;
        const data = survey.map((pt, i) => {
            if (i > 0) {
                const dMD = pt.md - survey[i-1].md;
                const dTVD = pt.tvd - survey[i-1].tvd;
                departure += Math.sqrt(Math.max(0, Math.pow(dMD, 2) - Math.pow(dTVD, 2)));
            }
            return { departure: Math.round(departure), tvd: pt.tvd, md: pt.md, casedTvd: pt.md <= params.wellbore.casingBottom ? pt.tvd : null };
        });
        const pumpTVDVal = interpolateTVD(params.pressures.pumpDepthMD, survey);
        const pumpPt = data.find(d => d.tvd >= pumpTVDVal);
        const perfsTVDVal = interpolateTVD(params.wellbore.midPerfsMD, survey);
        const perfsPt = data.find(d => d.tvd >= perfsTVDVal);
        const kop = data.find((d, i) => i > 0 && (d.departure - data[i-1].departure) / (Math.max(1, d.tvd - data[i-1].tvd)) > 0.035);
        return { processedData: data, pumpDep: pumpPt?.departure || 0, pumpTVD: pumpTVDVal, perfsDep: perfsPt?.departure || 0, perfsTVD: perfsTVDVal, maxTVD: Math.ceil(Math.max(...survey.map(s => s.tvd), 1000) / 1000) * 1000, kopPoint: kop };
    }, [survey, params.wellbore.casingBottom, params.pressures.pumpDepthMD, params.wellbore.midPerfsMD]);

    const layers = [{ y1: 0, y2: maxTVD * 0.15, id: 'layerSoil' }, { y1: maxTVD * 0.15, y2: maxTVD * 0.45, id: 'layerShale' }, { y1: maxTVD * 0.45, y2: maxTVD * 0.75, id: 'layerSand' }, { y1: maxTVD * 0.75, y2: maxTVD * 1.2, id: 'layerRes' }];
    const airGap = 400;

    return (
        <div className="h-full flex flex-col bg-surface rounded-[40px] border border-surface-light shadow-2xl overflow-hidden relative group select-none">
            <div className="relative z-20 flex justify-between items-center px-10 py-6 border-b border-surface-light bg-surface/90 backdrop-blur-sm">
                <h3 className="text-sm font-black text-txt-muted uppercase tracking-widest flex items-center gap-4"><Map className="w-6 h-6 text-primary" /> {t('p1.trajectory')} <span className="text-txt-muted/70">| ENG. VIEW</span></h3>
                <div className="flex gap-6">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-canvas border border-surface-light"><div className="w-3 h-3 rounded-full bg-slate-400"></div><span className="text-xs font-bold text-txt-muted">CASING</span></div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-canvas border border-surface-light"><div className="w-3 h-3 rounded-full bg-secondary"></div><span className="text-xs font-bold text-txt-muted">TUBING</span></div>
                </div>
            </div>
            <div className="relative z-10 flex-1 min-h-[400px] p-0 bg-canvas">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={processedData} margin={{ top: 20, right: 40, left: 20, bottom: 40 }}>
                        <defs>
                            <pattern id="patSoil" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)"><rect width="20" height="20" fill={colorSurface} opacity="0.3"/><line x1="0" y1="0" x2="0" y2="20" stroke={colorSurfaceLight} strokeWidth="1" opacity="0.5"/></pattern>
                            <pattern id="patShale" patternUnits="userSpaceOnUse" width="40" height="10"><rect width="40" height="10" fill={colorSurface} opacity="0.2"/><line x1="0" y1="5" x2="25" y2="5" stroke={colorSurfaceLight} strokeWidth="1" opacity="0.5"/></pattern>
                            <pattern id="patSand" patternUnits="userSpaceOnUse" width="10" height="10"><rect width="10" height="10" fill={colorCanvas}/><circle cx="2" cy="2" r="1" fill={colorTextMuted} opacity="0.4"/><circle cx="7" cy="7" r="1" fill={colorTextMuted} opacity="0.4"/></pattern>
                            <pattern id="patRes" patternUnits="userSpaceOnUse" width="20" height="20"><rect width="20" height="20" fill={colorCanvas}/><path d="M0 20 L20 0" stroke={colorSurfaceLight} strokeWidth="2"/></pattern>
                            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colorCanvas}/><stop offset="100%" stopColor={colorSurface}/></linearGradient>
                            <filter id="glow" height="300%" width="300%" x="-75%" y="-75%"><feGaussianBlur stdDeviation="2" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                        </defs>
                        <ReferenceArea y1={-airGap} y2={0} fill="url(#skyGrad)" />
                        {layers.map((l) => <ReferenceArea key={l.id} y1={l.y1} y2={l.y2} fill={`url(#${l.id.replace('layer', 'pat')})`} fillOpacity={1}/>)}
                        <ReferenceLine y={0} stroke={colorSurfaceLight} strokeWidth={2} />
                        <CartesianGrid stroke={colorSurfaceLight} strokeDasharray="3 3" horizontal={true} vertical={true} opacity={0.3} />
                        <XAxis dataKey="departure" type="number" orientation="top" domain={[0, 'auto']} tick={{fill: colorTextMuted, fontSize: 13, fontFamily: 'monospace', fontWeight: 700}} axisLine={{stroke: colorSurfaceLight}} tickLine={false}/>
                        <YAxis dataKey="tvd" type="number" reversed domain={[-airGap, maxTVD]} tick={{fill: colorTextMuted, fontSize: 13, fontFamily: 'monospace', fontWeight: 700}} axisLine={{stroke: colorSurfaceLight}} tickLine={false} width={60}/>
                        <Tooltip contentStyle={{backgroundColor: colorSurface, borderColor: colorSurfaceLight, fontSize: '14px', borderRadius: '16px', color: colorTextMain, backdropFilter: 'blur(4px)', padding: '16px'}} itemStyle={{color: colorTextMain, fontWeight: 'bold'}} labelStyle={{color: colorTextMuted, fontFamily: 'monospace'}} formatter={(val: number) => Math.round(val)}/>
                        <ReferenceDot x={0} y={-30} r={0}>
                            <Label content={({ viewBox }: any) => (
                                <g transform={`translate(${viewBox.x}, ${viewBox.y}) scale(0.8)`}>
                                    <path d="M-15 40 L0 -50 L15 40" fill="none" stroke={colorTextMuted} strokeWidth="2" strokeLinejoin="round"/>
                                    <path d="M-12 20 H12 M-9 0 H9 M-6 -20 H6" stroke={colorSurfaceLight} strokeWidth="1"/>
                                    <path d="M-12 20 L12 0 M12 20 L-12 0" stroke={colorSurfaceLight} strokeWidth="0.5" opacity="0.5"/>
                                    <path d="M-9 0 L9 -20 M9 0 L-9 -20" stroke={colorSurfaceLight} strokeWidth="0.5" opacity="0.5"/>
                                    <rect x="-4" y="-55" width="8" height="8" fill={colorPrimary} />
                                    <line x1="0" y1="-50" x2="0" y2="40" stroke={colorTextMuted} strokeWidth="1.5" />
                                    <rect x="-25" y="40" width="50" height="10" fill={colorSurfaceLight} stroke={colorSurfaceLight} />
                                </g>
                            )} />
                        </ReferenceDot>
                        <Line type="monotone" dataKey="tvd" stroke={colorSurfaceLight} strokeWidth={14} dot={false} isAnimationActive={false} strokeOpacity={0.5}/>
                        <Line type="monotone" dataKey="casedTvd" stroke="#64748b" strokeWidth={8} dot={false} isAnimationActive={true} connectNulls={false}/>
                        <Line type="monotone" dataKey="tvd" stroke={colorPrimary} strokeWidth={4} dot={false} strokeDasharray="8 4" isAnimationActive={true} animationDuration={2000}/>
                        {kopPoint && <ReferenceDot x={kopPoint.departure} y={kopPoint.tvd} r={6} fill={colorSecondary} stroke="none"><Label value="KOP" position="right" fill={colorSecondary} fontSize={13} fontWeight="bold" offset={15} /></ReferenceDot>}
                        <ReferenceDot x={pumpDep} y={pumpTVD} r={8} fill={colorSecondary} stroke="#fff" strokeWidth={3} filter="url(#glow)"><Label content={({x, y}: any) => <g transform={`translate(${x + 15}, ${y - 15})`}><rect width="50" height="24" rx="6" fill={colorSecondary} /><text x="25" y="16" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">ESP</text><path d="M-2 12 L-8 12" stroke={colorSecondary} strokeWidth="2"/></g>} /></ReferenceDot>
                        <ReferenceArea y1={perfsTVD - 50} y2={perfsTVD + 50} x1={perfsDep - 20} x2={perfsDep + 20} fill="none"/>
                        <ReferenceDot x={perfsDep} y={perfsTVD} r={0}><Label content={({viewBox}: any) => <g transform={`translate(${viewBox.x}, ${viewBox.y})`}><circle cx="0" cy="0" r="6" fill="#10b981" /><path d="M-15 -15 L15 15 M-15 15 L15 -15" stroke="#10b981" strokeWidth="2" opacity="0.6"/><text x="15" y="5" fill="#10b981" fontSize="13" fontWeight="bold">PAY ZONE</text></g>} /></ReferenceDot>
                        <ReferenceLine y={params.totalDepthMD} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideBottomRight', value: 'TD', fill: '#ef4444', fontSize: 14, fontWeight: 'bold' }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
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
    }, []);

    const handleClear = () => { setMdInput(''); setTvdInput(''); setRawSurvey(''); setParams(prev => ({ ...prev, survey: [], totalDepthMD: 0 })); };
    const handleProcess = () => {
        const mds = mdInput.trim().split('\n').map(v => parseFloat(v.trim()));
        const tvds = tvdInput.trim().split('\n').map(v => parseFloat(v.trim()));
        const pts = [];
        const len = Math.min(mds.length, tvds.length);
        for (let i = 0; i < len; i++) if (!isNaN(mds[i]) && !isNaN(tvds[i])) pts.push({ md: mds[i], tvd: tvds[i] });
        pts.sort((a, b) => a.md - b.md);
        const maxMD = pts.length > 0 ? Math.max(...pts.map(p => p.md)) : 0;
        setParams(prev => ({ ...prev, survey: pts, totalDepthMD: maxMD > 0 ? maxMD : prev.totalDepthMD }));
        setRawSurvey(pts.map(p => `${p.md}\t${p.tvd}`).join('\n'));
    };

    return (
        <div className="flex flex-col gap-8 pb-12 h-full">
            {/* Top Grid: Casing, Tubing, Environment (Balanced) */}
            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 md:col-span-6 lg:col-span-4">
                    <PipeConfigCard title={t('p1.casing')} icon={Cylinder} colorClass="bg-slate-500" pipe={params.wellbore.casing} catalog={CASING_CATALOG} onSelect={(e) => { const c = CASING_CATALOG.find(x => x.description === e.target.value); if(c) setParams({...params, wellbore: {...params.wellbore, casing: c}}); }} bottomMD={params.wellbore.casingBottom} onDepthChange={(e) => setParams({...params, wellbore: {...params.wellbore, casingBottom: parseFloat(e.target.value)}})} />
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-4">
                    <PipeConfigCard title={t('p1.tubing')} icon={ArrowDown} colorClass="bg-secondary" pipe={params.wellbore.tubing} catalog={TUBING_CATALOG} onSelect={(e) => { const t = TUBING_CATALOG.find(x => x.description === e.target.value); if(t) setParams({...params, wellbore: {...params.wellbore, tubing: t}}); }} bottomMD={params.pressures.pumpDepthMD} onDepthChange={(e) => setParams({...params, pressures: {...params.pressures, pumpDepthMD: parseFloat(e.target.value)}})} />
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-4">
                    <div className="bg-surface rounded-[32px] border border-surface-light shadow-lg p-8 h-full flex flex-col justify-between group hover:border-primary/30 transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5 bg-primary blur-3xl pointer-events-none"></div>
                        <div className="flex justify-between items-start mb-6 relative z-10">
                             <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-canvas border border-surface-light text-primary"><Thermometer className="w-8 h-8" /></div>
                                <h3 className="text-lg font-black text-txt-main uppercase tracking-widest">{t('p1.env')}</h3>
                            </div>
                        </div>
                        <div className="space-y-8 relative z-10">
                            <div className="flex items-center gap-4 bg-canvas p-4 rounded-2xl border border-surface-light">
                                <span className="text-sm font-bold text-secondary w-10">WH</span>
                                <input type="number" value={params.surfaceTemp} onChange={e => setParams({...params, surfaceTemp: parseFloat(e.target.value)})} className="w-20 bg-transparent text-center text-lg font-black text-txt-main border-b-2 border-surface-light outline-none focus:border-secondary" />
                                <span className="flex-1 h-1 bg-gradient-to-r from-secondary to-primary opacity-50 rounded-full"></span>
                                <input type="number" value={params.bottomholeTemp} onChange={e => setParams({...params, bottomholeTemp: parseFloat(e.target.value)})} className="w-20 bg-transparent text-center text-lg font-black text-txt-main border-b-2 border-surface-light outline-none focus:border-primary" />
                                <span className="text-sm font-bold text-primary w-10 text-right">BH</span>
                            </div>
                            <TechnicalInput label={t('p1.midperfs')} value={params.wellbore.midPerfsMD} unit="ft" onChange={(e: any) => setParams({...params, wellbore: {...params.wellbore, midPerfsMD: parseFloat(e.target.value)}})} className="pt-2" />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Bottom Grid: Trajectory & Survey Data */}
            <div className="grid grid-cols-12 gap-8 flex-1 min-h-[500px]">
                <div className="col-span-12 lg:col-span-8 h-full"><TrajectoryPlot survey={params.survey} params={params} /></div>
                <div className="col-span-12 lg:col-span-4 flex flex-col h-full">
                    <div className="bg-surface rounded-[32px] border border-surface-light shadow-xl flex-1 flex flex-col overflow-hidden">
                        <div className="px-8 py-6 bg-canvas border-b border-surface-light flex justify-between items-center">
                            <div className="flex items-center gap-4"><FileCode className="w-6 h-6 text-primary" /><h3 className="text-sm font-bold text-txt-muted uppercase tracking-widest">{t('p1.survey_term')}</h3></div>
                            <button onClick={handleClear} className="text-sm font-bold text-txt-muted hover:text-red-400 flex items-center gap-3 uppercase transition-colors px-4 py-2 rounded-xl hover:bg-surface border border-transparent hover:border-surface-light"><Trash2 className="w-5 h-5" /> {t('p1.clear')}</button>
                        </div>
                        <div className="flex-1 grid grid-cols-2 divide-x divide-surface-light min-h-0">
                            <div className="flex flex-col h-full relative group">
                                <div className="absolute top-0 left-0 w-full px-6 py-3 bg-surface/90 border-b border-surface-light text-xs font-black text-secondary uppercase tracking-wider z-10">{t('p1.md')}</div>
                                <textarea 
                                    value={mdInput} 
                                    onChange={e => setMdInput(e.target.value)} 
                                    className="w-full h-full bg-surface text-secondary font-mono text-sm p-6 pt-12 outline-none resize-none leading-relaxed custom-scrollbar selection:bg-secondary/30" 
                                    placeholder={t('p1.paste_md')} 
                                />
                            </div>
                            <div className="flex flex-col h-full relative group">
                                <div className="absolute top-0 left-0 w-full px-6 py-3 bg-surface/90 border-b border-surface-light text-xs font-black text-primary uppercase tracking-wider z-10">{t('p1.tvd')}</div>
                                <textarea 
                                    value={tvdInput} 
                                    onChange={e => setTvdInput(e.target.value)} 
                                    className="w-full h-full bg-surface text-primary font-mono text-sm p-6 pt-12 outline-none resize-none leading-relaxed custom-scrollbar selection:bg-primary/30" 
                                    placeholder={t('p1.paste_tvd')} 
                                />
                            </div>
                        </div>
                        <div className="p-8 bg-canvas border-t border-surface-light">
                            <button onClick={handleProcess} className="w-full bg-surface hover:bg-primary hover:text-white text-txt-muted py-5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98] border border-surface-light hover:border-primary flex items-center justify-center gap-4"><Check className="w-6 h-6" /> {t('p1.process')}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
