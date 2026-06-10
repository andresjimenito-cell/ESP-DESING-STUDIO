
import React, { useState, useEffect } from 'react';
import { Cylinder, ArrowDown, Thermometer, FileCode, Trash2, Check, Activity, Map, Compass, Table, AlertTriangle, HelpCircle, Sliders, Database, Eye } from 'lucide-react';
import { SystemParams, PipeData, SurveyPoint } from '../types';
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
        <label className="text-[9px] font-black text-txt-main/70 uppercase tracking-[0.2em] block mb-0.5 group-hover:text-primary transition-colors text-shadow-sm">{label}</label>
        <div className="flex items-center glass-surface-light border border-white/5 rounded-none overflow-hidden group-focus-within:ring-2 group-focus-within:ring-primary/40 group-focus-within:border-primary transition-all p-0 relative light-sweep">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
            <input
                type="number"
                value={value}
                onChange={onChange}
                className="w-full bg-transparent py-1.5 px-2 text-xs font-mono font-black text-txt-main outline-none placeholder:text-surface-light/40 z-10"
            />
            {unit && <span className="glass-surface text-[8px] font-black text-txt-muted px-2 py-1.5 rounded-none border-l border-white/5 select-none z-10 min-w-[30px] text-center">{unit}</span>}
        </div>
    </div>
);

const PipeConfigCard = ({ title, pipe, catalog, onSelect, bottomMD, onDepthChange, onRoughnessChange, colorClass, icon: Icon }: {
    title: string, pipe: PipeData, catalog: PipeData[], onSelect: (e: any) => void, bottomMD: number, onDepthChange: (e: any) => void, onRoughnessChange?: (e: any) => void, colorClass: string, icon: any
}) => {
    const { t } = useLanguage();

    return (
        <div className="glass-surface rounded-none border border-white/5 shadow-xl p-3 relative overflow-hidden group hover:border-primary/30 hover:shadow-glow-primary transition-all h-full flex flex-col justify-between light-sweep">
            <div className={`absolute top-0 left-0 w-1 h-full ${colorClass} opacity-40 group-hover:opacity-100 transition-all duration-700 shadow-glow-primary`}></div>
            <div className="flex justify-between items-center mb-2 pl-1 relative z-10">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-none glass-surface-light border border-white/10 ${colorClass.replace('bg-', 'text-')} shadow-glow-primary group-hover:scale-105 transition-transform duration-500`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div><h3 className="text-xs font-black text-txt-main uppercase tracking-widest">{title}</h3></div>
                </div>
                <div className="text-[9px] font-mono font-black text-txt-muted bg-canvas px-1.5 py-0.5 rounded-none border border-white/5">{pipe.od}" OD</div>
            </div>
            <div className="pl-1 space-y-1 relative z-10 flex-1 flex flex-col justify-center">
                <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-txt-muted uppercase tracking-wider">{t('p1.grade')}</label>
                    <select className="w-full bg-canvas border border-white/5 text-[10px] font-bold text-txt-main rounded-none p-1.5 outline-none focus:border-primary cursor-pointer" value={pipe.description} onChange={onSelect}>
                        {catalog.map(c => <option key={c.description} value={c.description}>{c.description}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <TechnicalInput label={t('p1.bottom')} value={bottomMD} unit="ft" onChange={onDepthChange} />
                    <div className="grid grid-cols-2 gap-1">
                        <div className="bg-canvas border border-white/5 rounded-none p-0.5 text-center flex flex-col justify-center shadow-inner">
                            <span className="block text-[7px] text-txt-muted uppercase font-black opacity-70">ID</span>
                            <span className="text-[9px] font-mono font-black text-txt-main">{pipe.id}"</span>
                        </div>
                        <div className="bg-canvas border border-white/5 rounded-none p-0.5 text-center flex flex-col justify-center shadow-inner">
                            <span className="block text-[7px] text-txt-muted uppercase font-black opacity-70">{t('p1.weight')}</span>
                            <span className="text-[9px] font-mono font-black text-txt-main">{pipe.weight}#</span>
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
    const [isAdvanced, setIsAdvanced] = useState(false);
    
    // 13 Column Inputs for Advanced / Basic
    const [mdInput, setMdInput] = useState('');
    const [incInput, setIncInput] = useState('');
    const [azimInput, setAzimInput] = useState('');
    const [tvdInput, setTvdInput] = useState('');
    const [subSeaInput, setSubSeaInput] = useState('');
    const [northingInput, setNorthingInput] = useState('');
    const [nsInput, setNsInput] = useState('');
    const [eastingInput, setEastingInput] = useState('');
    const [ewInput, setEwInput] = useState('');
    const [northingMInput, setNorthingMInput] = useState('');
    const [eastingMInput, setEastingMInput] = useState('');
    const [vsInput, setVsInput] = useState('');
    const [dlsInput, setDlsInput] = useState('');
    
    const [activeMainTab, setActiveMainTab] = useState<'plot' | 'table'>('plot');

    const handleClear = () => {
        setMdInput('');
        setIncInput('');
        setAzimInput('');
        setTvdInput('');
        setSubSeaInput('');
        setNorthingInput('');
        setNsInput('');
        setEastingInput('');
        setEwInput('');
        setNorthingMInput('');
        setEastingMInput('');
        setVsInput('');
        setDlsInput('');
        setRawSurvey('');
        setParams(prev => ({ ...prev, survey: [], totalDepthMD: 0 }));
    };

    useEffect(() => {
        if (rawSurvey) {
            const lines = rawSurvey.trim().split('\n');
            if (lines.length > 0) {
                const firstLine = lines[0].trim();
                const parts = firstLine.split(/[\t\s,]+/);
                if (parts.length > 2) {
                    setIsAdvanced(true);
                    const mds: string[] = [];
                    const incs: string[] = [];
                    const azims: string[] = [];
                    const tvds: string[] = [];
                    const subSeas: string[] = [];
                    const northings: string[] = [];
                    const nss: string[] = [];
                    const eastings: string[] = [];
                    const ews: string[] = [];
                    const northingMs: string[] = [];
                    const eastingMs: string[] = [];
                    const vss: string[] = [];
                    const dlss: string[] = [];
                    
                    for (const line of lines) {
                        const cols = line.trim().split('\t');
                        const spaceCols = line.trim().split(/\s+/);
                        const p = cols.length > 2 ? cols : spaceCols;
                        
                        mds.push(p[0] || '');
                        incs.push(p[1] || '');
                        azims.push(p[2] || '');
                        tvds.push(p[3] || '');
                        subSeas.push(p[4] || '');
                        northings.push(p[5] || '');
                        nss.push(p[6] || '');
                        eastings.push(p[7] || '');
                        ews.push(p[8] || '');
                        northingMs.push(p[9] || '');
                        eastingMs.push(p[10] || '');
                        vss.push(p[11] || '');
                        dlss.push(p[12] || '');
                    }
                    
                    setMdInput(mds.join('\n'));
                    setIncInput(incs.join('\n'));
                    setAzimInput(azims.join('\n'));
                    setTvdInput(tvds.join('\n'));
                    setSubSeaInput(subSeas.join('\n'));
                    setNorthingInput(northings.join('\n'));
                    setNsInput(nss.join('\n'));
                    setEastingInput(eastings.join('\n'));
                    setEwInput(ews.join('\n'));
                    setNorthingMInput(northingMs.join('\n'));
                    setEastingMInput(eastingMs.join('\n'));
                    setVsInput(vss.join('\n'));
                    setDlsInput(dlss.join('\n'));
                } else {
                    setIsAdvanced(false);
                    const mds: string[] = [];
                    const tvds: string[] = [];
                    for (const line of lines) {
                        const cols = line.trim().split(/[\t\s,]+/);
                        if (cols.length >= 1 && cols[0]) mds.push(cols[0]);
                        if (cols.length >= 2 && cols[1]) tvds.push(cols[1]);
                    }
                    setMdInput(mds.join('\n'));
                    setTvdInput(tvds.join('\n'));
                }
            }
        } else {
            handleClear();
        }
    }, [rawSurvey]);

    const parseLines = (text: string, advanced: boolean): SurveyPoint[] => {
        const lines = text.split('\n');
        const pts: SurveyPoint[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const lower = trimmed.toLowerCase();
            if (lower.includes('depth') || lower.includes('inc') || lower.includes('azim') || lower.includes('md') || lower.includes('tvd') || lower.includes('measure')) {
                continue;
            }

            let parts = trimmed.split('\t');
            if (parts.length <= 1) {
                parts = trimmed.split(/[\s,]+/);
            }

            if (parts.length >= 2) {
                const md = parseFloat(parts[0].replace(/,/g, ''));
                if (isNaN(md)) continue;

                if (advanced) {
                    const inc = parts.length > 1 ? parseFloat(parts[1].replace(/,/g, '')) : undefined;
                    const azim = parts.length > 2 ? parseFloat(parts[2].replace(/,/g, '')) : undefined;
                    const tvd = parts.length > 3 ? parseFloat(parts[3].replace(/,/g, '')) : parseFloat(parts[1].replace(/,/g, ''));
                    const subSea = parts.length > 4 ? parseFloat(parts[4].replace(/,/g, '')) : undefined;
                    const northing = parts.length > 5 ? parseFloat(parts[5].replace(/,/g, '')) : undefined;
                    const ns = parts.length > 6 ? (parts[6].trim().toUpperCase() as 'N' | 'S') : undefined;
                    const easting = parts.length > 7 ? parseFloat(parts[7].replace(/,/g, '')) : undefined;
                    const ew = parts.length > 8 ? (parts[8].trim().toUpperCase() as 'E' | 'W') : undefined;
                    const northingM = parts.length > 9 ? parseFloat(parts[9].replace(/,/g, '')) : undefined;
                    const eastingM = parts.length > 10 ? parseFloat(parts[10].replace(/,/g, '')) : undefined;
                    const verticalSection = parts.length > 11 ? parseFloat(parts[11].replace(/,/g, '')) : undefined;
                    const dogleg = parts.length > 12 ? parseFloat(parts[12].replace(/,/g, '')) : undefined;

                    pts.push({
                        md,
                        tvd: isNaN(tvd) ? md : tvd,
                        inc: isNaN(inc as number) ? undefined : inc,
                        azim: isNaN(azim as number) ? undefined : azim,
                        subSea: isNaN(subSea as number) ? undefined : subSea,
                        northing: isNaN(northing as number) ? undefined : northing,
                        ns: (ns === 'N' || ns === 'S') ? ns : undefined,
                        easting: isNaN(easting as number) ? undefined : easting,
                        ew: (ew === 'E' || ew === 'W') ? ew : undefined,
                        northingM: isNaN(northingM as number) ? undefined : northingM,
                        eastingM: isNaN(eastingM as number) ? undefined : eastingM,
                        verticalSection: isNaN(verticalSection as number) ? undefined : verticalSection,
                        dogleg: isNaN(dogleg as number) ? undefined : dogleg
                    });
                } else {
                    const tvd = parseFloat(parts[1].replace(/,/g, ''));
                    if (!isNaN(tvd)) {
                        pts.push({ md, tvd });
                    }
                }
            }
        }
        return pts.sort((a, b) => a.md - b.md);
    };

    const handleProcess = () => {
        let pts: SurveyPoint[] = [];
        if (isAdvanced) {
            const mds = mdInput.split('\n').map(v => v.trim());
            const incs = incInput.split('\n').map(v => v.trim());
            const azims = azimInput.split('\n').map(v => v.trim());
            const tvds = tvdInput.split('\n').map(v => v.trim());
            const subSeas = subSeaInput.split('\n').map(v => v.trim());
            const northings = northingInput.split('\n').map(v => v.trim());
            const nss = nsInput.split('\n').map(v => v.trim());
            const eastings = eastingInput.split('\n').map(v => v.trim());
            const ews = ewInput.split('\n').map(v => v.trim());
            const northingMs = northingMInput.split('\n').map(v => v.trim());
            const eastingMs = eastingMInput.split('\n').map(v => v.trim());
            const vss = vsInput.split('\n').map(v => v.trim());
            const dlss = dlsInput.split('\n').map(v => v.trim());
            
            const maxLen = Math.max(
                mds.length, incs.length, azims.length, tvds.length, subSeas.length,
                northings.length, nss.length, eastings.length, ews.length,
                northingMs.length, eastingMs.length, vss.length, dlss.length
            );
            
            const rawLines: string[] = [];
            
            for (let i = 0; i < maxLen; i++) {
                const mdVal = parseFloat(mds[i]?.replace(/,/g, '') || '');
                if (isNaN(mdVal)) continue;
                
                const incVal = parseFloat(incs[i] || '');
                const azimVal = parseFloat(azims[i] || '');
                const tvdVal = parseFloat(tvds[i]?.replace(/,/g, '') || '');
                const subSeaVal = parseFloat(subSeas[i] || '');
                const northingVal = parseFloat(northings[i] || '');
                const nsVal = nss[i]?.trim().toUpperCase() as 'N' | 'S' || undefined;
                const eastingVal = parseFloat(eastings[i] || '');
                const ewVal = ews[i]?.trim().toUpperCase() as 'E' | 'W' || undefined;
                const northingMVal = parseFloat(northingMs[i] || '');
                const eastingMVal = parseFloat(eastingMs[i] || '');
                const vsVal = parseFloat(vss[i] || '');
                const dlsVal = parseFloat(dlss[i] || '');
                
                pts.push({
                    md: mdVal,
                    tvd: isNaN(tvdVal) ? mdVal : tvdVal,
                    inc: isNaN(incVal) ? undefined : incVal,
                    azim: isNaN(azimVal) ? undefined : azimVal,
                    subSea: isNaN(subSeaVal) ? undefined : subSeaVal,
                    northing: isNaN(northingVal) ? undefined : northingVal,
                    ns: (nsVal === 'N' || nsVal === 'S') ? nsVal : undefined,
                    easting: isNaN(eastingVal) ? undefined : eastingVal,
                    ew: (ewVal === 'E' || ewVal === 'W') ? ewVal : undefined,
                    northingM: isNaN(northingMVal) ? undefined : northingMVal,
                    eastingM: isNaN(eastingMVal) ? undefined : eastingMVal,
                    verticalSection: isNaN(vsVal) ? undefined : vsVal,
                    dogleg: isNaN(dlsVal) ? undefined : dlsVal
                });
                
                rawLines.push([
                    mds[i] || '',
                    incs[i] || '',
                    azims[i] || '',
                    tvds[i] || '',
                    subSeas[i] || '',
                    northings[i] || '',
                    nss[i] || '',
                    eastings[i] || '',
                    ews[i] || '',
                    northingMs[i] || '',
                    eastingMs[i] || '',
                    vss[i] || '',
                    dlss[i] || ''
                ].join('\t'));
            }
            
            setRawSurvey(rawLines.join('\n'));
        } else {
            const mds = mdInput.trim().split('\n').map(v => v.trim());
            const tvds = tvdInput.trim().split('\n').map(v => v.trim());
            const len = Math.max(mds.length, tvds.length);
            const combinedLines: string[] = [];
            for (let i = 0; i < len; i++) {
                const mdVal = mds[i] || '';
                const tvdVal = tvds[i] || '';
                if (mdVal || tvdVal) {
                    combinedLines.push(`${mdVal}\t${tvdVal}`);
                }
            }
            pts = parseLines(combinedLines.join('\n'), false);
            setRawSurvey(pts.map(p => `${p.md}\t${p.tvd}`).join('\n'));
        }

        const td = pts.length > 0 ? pts[pts.length - 1].md : 0;
        setParams((prev: SystemParams) => ({ ...prev, survey: pts, totalDepthMD: td }));
        if (pts.length > 0 && isAdvanced) {
            setActiveMainTab('table');
        }
    };

    // Advanced Summary metrics
    const hasAdvancedData = params.survey.some(p => p.inc !== undefined || p.dogleg !== undefined);
    const maxDogleg = hasAdvancedData ? Math.max(...params.survey.map(p => p.dogleg || 0)) : 0;
    const maxInclination = hasAdvancedData ? Math.max(...params.survey.map(p => p.inc || 0)) : 0;
    const avgInclination = hasAdvancedData ? (params.survey.reduce((acc, p) => acc + (p.inc || 0), 0) / params.survey.length) : 0;

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
                    <div className="glass-surface rounded-none border border-white/5 shadow-2xl p-3 flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all duration-700 light-sweep h-full min-h-[200px]">
                        <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex justify-between items-center mb-2 pl-1 relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-none bg-canvas border border-white/5 text-primary shadow-inner group-hover:shadow-[0_0_15px_rgb(var(--color-primary)/0.3)] transition-shadow"><Thermometer className="w-4 h-4" /></div>
                                <h3 className="text-xs font-black text-txt-main uppercase tracking-widest leading-none shadow-sm">{t('p1.env')}</h3>
                            </div>
                        </div>
                        <div className="space-y-2 relative z-10 flex-1 flex flex-col justify-center">
                            <div className="flex items-center gap-3 bg-canvas/60 p-2.5 rounded-none border border-white/5 backdrop-blur-sm shadow-inner group/temp">
                                <span className="text-[10px] font-black text-secondary w-8">{t('p1.wh')}</span>
                                <input type="number" value={params.surfaceTemp} onChange={e => setParams({ ...params, surfaceTemp: parseFloat(e.target.value) })} className="w-16 bg-transparent text-center text-sm font-black text-txt-main border-b-2 border-white/5 outline-none focus:border-secondary transition-all" />
                                <span className="flex-1 h-0.5 bg-gradient-to-r from-secondary to-primary opacity-30 rounded-none"></span>
                                <input type="number" value={params.bottomholeTemp} onChange={e => setParams({ ...params, bottomholeTemp: parseFloat(e.target.value) })} className="w-16 bg-transparent text-center text-sm font-black text-txt-main border-b-2 border-white/5 outline-none focus:border-primary transition-all" />
                                <span className="text-[10px] font-black text-primary w-8 text-right">{t('p1.bh')}</span>
                            </div>
                            <TechnicalInput label={t('p1.midperfs')} value={params.wellbore.midPerfsMD} unit="ft" onChange={(e: any) => setParams({ ...params, wellbore: { ...params.wellbore, midPerfsMD: parseFloat(e.target.value) } })} className="pt-0.5" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 min-h-[520px]">
                <div className="col-span-12 lg:col-span-9 flex flex-col min-h-[520px] animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                    <div className="glass-surface border border-white/5 rounded-none flex-1 flex flex-col overflow-hidden relative shadow-2xl">
                        <div className="px-6 py-4 glass-surface border-b border-white/5 flex justify-between items-center relative z-20 shrink-0">
                            <div className="flex items-center gap-4">
                                <Compass className="w-6 h-6 text-primary shadow-glow-primary" />
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.25em]">{t('p1.trajectory')}</h3>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setActiveMainTab('plot')} 
                                    className={`text-[10px] font-black uppercase transition-all px-4 py-2 flex items-center gap-2 ${activeMainTab === 'plot' ? 'bg-primary/20 border-primary border text-primary shadow-glow-primary' : 'glass-surface-light border border-white/5 text-txt-muted hover:text-txt-main'}`}
                                >
                                    <Map className="w-3.5 h-3.5" /> Plot
                                </button>
                                <button 
                                    onClick={() => setActiveMainTab('table')} 
                                    className={`text-[10px] font-black uppercase transition-all px-4 py-2 flex items-center gap-2 ${activeMainTab === 'table' ? 'bg-primary/20 border-primary border text-primary shadow-glow-primary' : 'glass-surface-light border border-white/5 text-txt-muted hover:text-txt-main'}`}
                                >
                                    <Table className="w-3.5 h-3.5" /> Data Table {hasAdvancedData && <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 relative z-10 flex flex-col">
                            {activeMainTab === 'plot' ? (
                                <div className="w-full h-full flex-1 min-h-[420px]">
                                    <TrajectoryPlot survey={params.survey} params={params} />
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col p-6 min-h-0 overflow-y-auto custom-scrollbar">
                                    {params.survey.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-txt-muted gap-4 py-12">
                                            <AlertTriangle className="w-12 h-12 text-warning/70" />
                                            <p className="text-sm font-bold uppercase tracking-wider">{t('p1.adv_nodata')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Advanced Stats */}
                                            {hasAdvancedData && (
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="glass-surface-light border border-white/5 p-4 rounded-none relative overflow-hidden group">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">Max Inclination</span>
                                                        <p className="text-xl font-black font-mono text-txt-main mt-1">{maxInclination.toFixed(2)}°</p>
                                                    </div>
                                                    <div className="glass-surface-light border border-white/5 p-4 rounded-none relative overflow-hidden group">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
                                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">Max Dogleg Severity</span>
                                                        <p className={`text-xl font-black font-mono mt-1 ${maxDogleg > 3 ? 'text-danger shadow-glow-danger' : 'text-txt-main'}`}>
                                                            {maxDogleg.toFixed(2)} <span className="text-xs">°/100ft</span>
                                                        </p>
                                                    </div>
                                                    <div className="glass-surface-light border border-white/5 p-4 rounded-none relative overflow-hidden group">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-500"></div>
                                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">Avg Inclination</span>
                                                        <p className="text-xl font-black font-mono text-txt-main mt-1">{avgInclination.toFixed(2)}°</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* DLS Warning Alert */}
                                            {maxDogleg > 3 && (
                                                <div className="bg-danger/10 border border-danger/30 p-4 flex gap-4 items-start rounded-none animate-fadeIn">
                                                    <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5 animate-pulse" />
                                                    <div>
                                                        <h4 className="text-xs font-black text-danger uppercase tracking-wider">High Dogleg Severity Warning</h4>
                                                        <p className="text-[11px] text-txt-muted mt-1">
                                                            Dogleg rate exceeds 3.0°/100ft. There is an increased risk of the ESP equipment laying flat or resting against the casing ("equipo recostado"), which can cause severe mechanical strain, protector damage, or premature motor failure. Consider optimizing pump placement at a lower DLS zone.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Grid table */}
                                            <div className="border border-white/5 overflow-x-auto rounded-none custom-scrollbar">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="bg-canvas border-b border-white/5 text-[9px] font-black text-txt-muted uppercase tracking-wider font-mono">
                                                            <th className="p-3">MD (ft)</th>
                                                            <th className="p-3">TVD (ft)</th>
                                                            <th className="p-3">Inc (deg)</th>
                                                            <th className="p-3">Azim (deg)</th>
                                                            <th className="p-3">Sub-Sea (ft)</th>
                                                            <th className="p-3">Northing (ft)</th>
                                                            <th className="p-3">Easting (ft)</th>
                                                            <th className="p-3">VS (ft)</th>
                                                            <th className="p-3">DLS (°/100)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5 font-mono">
                                                        {params.survey.map((row, idx) => {
                                                            const isHighDls = row.dogleg && row.dogleg > 3;
                                                            return (
                                                                <tr key={idx} className={`hover:bg-white/5 transition-colors ${isHighDls ? 'bg-danger/5' : ''}`}>
                                                                    <td className="p-3 font-bold text-txt-main">{row.md.toLocaleString()}</td>
                                                                    <td className="p-3 text-txt-main">{row.tvd.toLocaleString()}</td>
                                                                    <td className="p-3 text-txt-muted">{row.inc !== undefined ? `${row.inc}°` : '—'}</td>
                                                                    <td className="p-3 text-txt-muted">{row.azim !== undefined ? `${row.azim}°` : '—'}</td>
                                                                    <td className="p-3 text-txt-muted">{row.subSea !== undefined ? row.subSea.toLocaleString() : '—'}</td>
                                                                    <td className="p-3 text-txt-muted">
                                                                        {row.northing !== undefined ? `${row.northing.toLocaleString()} ${row.ns || ''}` : '—'}
                                                                    </td>
                                                                    <td className="p-3 text-txt-muted">
                                                                        {row.easting !== undefined ? `${row.easting.toLocaleString()} ${row.ew || ''}` : '—'}
                                                                    </td>
                                                                    <td className="p-3 text-txt-muted">{row.verticalSection !== undefined ? row.verticalSection.toLocaleString() : '—'}</td>
                                                                    <td className={`p-3 font-bold ${isHighDls ? 'text-danger' : 'text-txt-muted'}`}>
                                                                        {row.dogleg !== undefined ? (
                                                                            <span className="flex items-center gap-1.5">
                                                                                {row.dogleg}
                                                                                {isHighDls && <AlertTriangle className="w-3.5 h-3.5 text-danger animate-pulse" />}
                                                                            </span>
                                                                        ) : '—'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-3 flex flex-col min-h-[520px] animate-fadeIn" style={{ animationDelay: '0.5s' }}>
                    <div className="glass-surface border border-white/5 shadow-2xl flex-1 flex flex-col overflow-hidden relative">
                        <div className="px-6 py-5 glass-surface border-b border-white/5 flex flex-col gap-4 relative z-20 shrink-0">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <FileCode className="w-6 h-6 text-primary shadow-glow-primary" />
                                    <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.25em]">{t('p1.survey_term')}</h3>
                                </div>
                                <button onClick={handleClear} className="text-[10px] font-black text-txt-muted hover:text-danger flex items-center gap-2.5 uppercase transition-all px-4 py-2 rounded-none glass-surface-light border border-white/5">
                                    <Trash2 className="w-4 h-4" /> {t('p1.clear')}
                                </button>
                            </div>

                            {/* Mode Toggle tabs */}
                            <div className="grid grid-cols-2 p-0.5 bg-canvas border border-white/5 rounded-none shrink-0 relative">
                                <button
                                    onClick={() => setIsAdvanced(false)}
                                    className={`py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-none flex items-center justify-center gap-2 ${!isAdvanced ? 'bg-primary/20 text-primary border border-primary/20 shadow-glow-primary font-black z-10' : 'text-txt-muted hover:text-txt-main z-10'}`}
                                >
                                    <Sliders className="w-3.5 h-3.5" /> {t('p1.basic')}
                                </button>
                                <button
                                    onClick={() => setIsAdvanced(true)}
                                    className={`py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-none flex items-center justify-center gap-2 ${isAdvanced ? 'bg-primary/20 text-primary border border-primary/20 shadow-glow-primary font-black z-10' : 'text-txt-muted hover:text-txt-main z-10'}`}
                                >
                                    <Compass className="w-3.5 h-3.5" /> {t('p1.advanced')}
                                </button>
                            </div>
                        </div>

                        {/* Terminal Body */}
                        <div className="flex-1 min-h-0 relative z-10 flex flex-col">
                            {!isAdvanced ? (
                                <div className="flex-1 grid grid-cols-2 divide-x divide-white/5 min-h-0 relative z-10">
                                    <div className="flex flex-col h-full relative group">
                                        <div className="absolute top-0 left-0 w-full px-5 py-2.5 bg-canvas/60 backdrop-blur-md border-b border-white/5 text-xs font-black text-txt-main uppercase tracking-widest z-10 shadow-sm">{t('p1.md')}</div>
                                        <textarea value={mdInput} onChange={e => setMdInput(e.target.value)} className="w-full h-full bg-transparent text-txt-main font-mono text-sm p-5 pt-12 outline-none resize-none leading-relaxed custom-scrollbar selection:bg-secondary/30" placeholder={t('p1.paste_md')} />
                                    </div>
                                    <div className="flex flex-col h-full relative group">
                                        <div className="absolute top-0 left-0 w-full px-5 py-2.5 bg-canvas/60 backdrop-blur-md border-b border-white/5 text-xs font-black text-txt-main uppercase tracking-widest z-10 shadow-sm">{t('p1.tvd')}</div>
                                        <textarea value={tvdInput} onChange={e => setTvdInput(e.target.value)} className="w-full h-full bg-transparent text-txt-main font-mono text-sm p-5 pt-12 outline-none resize-none leading-relaxed custom-scrollbar selection:bg-primary/30" placeholder={t('p1.paste_tvd')} />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col h-full relative p-5 pt-0 min-h-0">
                                    <div className="bg-canvas border border-white/5 p-3 mb-3 text-[10px] text-txt-muted space-y-1 rounded-none flex items-start gap-3 shrink-0">
                                        <Database className="w-4 h-4 text-primary shrink-0 mt-0.5 shadow-glow-primary" />
                                        <div>
                                            <p className="font-black text-txt-main uppercase tracking-wider">{t('p1.adv_title')}</p>
                                            <p className="text-[9px] opacity-80 leading-normal">{t('p1.adv_sub')}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Contenedor de 13 Columnas en Paralelo */}
                                    <div className="flex-grow overflow-x-auto border border-white/5 bg-canvas/30 custom-scrollbar p-2 min-h-0 relative">
                                        <div className="flex gap-1.5 h-full divide-x divide-white/5 min-w-[1540px]">
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">MD (ft)</span>
                                                <textarea value={mdInput} onChange={e => setMdInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="MD..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_inc')} (°)</span>
                                                <textarea value={incInput} onChange={e => setIncInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="Inc..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_azim')} (°)</span>
                                                <textarea value={azimInput} onChange={e => setAzimInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="Azim..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">TVD (ft)</span>
                                                <textarea value={tvdInput} onChange={e => setTvdInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="TVD..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_subsea')}</span>
                                                <textarea value={subSeaInput} onChange={e => setSubSeaInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="Subsea..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_northing')}</span>
                                                <textarea value={northingInput} onChange={e => setNorthingInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="Northing..." />
                                            </div>
                                            <div className="flex flex-col w-[80px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">N/S</span>
                                                <textarea value={nsInput} onChange={e => setNsInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1 text-center" placeholder="N/S..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_easting')}</span>
                                                <textarea value={eastingInput} onChange={e => setEastingInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="Easting..." />
                                            </div>
                                            <div className="flex flex-col w-[80px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">E/W</span>
                                                <textarea value={ewInput} onChange={e => setEwInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1 text-center" placeholder="E/W..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_northm')}</span>
                                                <textarea value={northingMInput} onChange={e => setNorthingMInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="North(m)..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_eastm')}</span>
                                                <textarea value={eastingMInput} onChange={e => setEastingMInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="East(m)..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_vs')}</span>
                                                <textarea value={vsInput} onChange={e => setVsInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="VS..." />
                                            </div>
                                            <div className="flex flex-col w-[110px] shrink-0 h-full relative pl-1.5">
                                                <span className="text-[9px] font-black text-txt-main uppercase block mb-1 text-center truncate bg-canvas py-1 border border-white/5">{t('p1.adv_dls')}</span>
                                                <textarea value={dlsInput} onChange={e => setDlsInput(e.target.value)} className="w-full flex-1 bg-transparent text-txt-main font-mono text-xs p-2 outline-none resize-none custom-scrollbar border border-white/5 mt-1" placeholder="Dogleg..." />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Preview of rows detected */}
                                    {mdInput.trim() && (
                                        <div className="mt-2 shrink-0 px-3 py-1.5 bg-primary/10 border border-primary/20 text-[10px] font-black uppercase text-primary flex items-center justify-between">
                                            <span>{t('p1.adv_detected')}:</span>
                                            <span>{mdInput.trim().split('\n').filter(line => line.trim()).length} {t('p1.adv_rows')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 glass-surface border-t border-white/5 relative z-20 shrink-0">
                            <button onClick={handleProcess} className="w-full btn-premium-primary animate-pulse-glow hover:to-orange-500 text-white py-5 rounded-none text-[11px] font-black uppercase tracking-[0.4em] transition-all border border-white/10 light-sweep flex items-center justify-center gap-3">
                                <Check className="w-6 h-6" /> {isAdvanced ? t('p1.adv_process') : t('p1.process')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


