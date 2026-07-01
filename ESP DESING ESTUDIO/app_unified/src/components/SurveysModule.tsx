import React, { useState, useEffect, useMemo } from 'react';
import { 
    Cylinder, ArrowDown, Thermometer, FileCode, Trash2, Check, Activity, Map, Compass, Table, 
    AlertTriangle, HelpCircle, Sliders, Database, Eye, ArrowLeft, Download, UploadCloud, Play, Settings, Minus
} from 'lucide-react';
import { SystemParams, PipeData, SurveyPoint } from '../types';
import { CASING_CATALOG, TUBING_CATALOG } from '../data';
import { useLanguage } from '../i18n';
import { TrajectoryPlot } from './TrajectoryPlot';
import { read, utils as xlsxUtils, write } from 'xlsx';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    onBack: () => void;
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
        <div className="glass-surface rounded-none border border-white/5 shadow-xl p-4 relative overflow-hidden group hover:border-primary/30 hover:shadow-glow-primary transition-all flex flex-col justify-between light-sweep">
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

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

interface ProcessedPoint {
    md: number;
    tvd: number;
    inc: number;
    azim: number;
}

const SpoolerPolarChart: React.FC<{ processedData: ProcessedPoint[]; limitMD: number; isDark: boolean; }> = ({ processedData, limitMD, isDark }) => {
    const size = 360, cx = size / 2, cy = size / 2, R = 135;
    const toRad = (deg: number) => (deg - 90) * DEG2RAD;
    const getPt = (deg: number, radiusVal: number) => {
        const rad = toRad(deg);
        const rPix = (radiusVal / 100) * R;
        return { x: cx + Math.cos(rad) * rPix, y: cy + Math.sin(rad) * rPix };
    };

    const sector = useMemo(() => {
        const validPoints = processedData.filter(pt => pt.md > 0 && pt.md <= limitMD && pt.azim !== undefined);
        if (validPoints.length === 0) return { start: 0, end: 0, draw: false };
        let sumSin = 0, sumCos = 0, sumW = 0;
        validPoints.forEach(pt => {
            const w = Math.sin((pt.inc ?? 0) * DEG2RAD);
            sumSin += Math.sin((pt.azim ?? 0) * DEG2RAD) * w;
            sumCos += Math.cos((pt.azim ?? 0) * DEG2RAD) * w;
            sumW += w;
        });
        let avgAz = 0;
        if (sumW < 0.0001) {
            let simpleSin = 0, simpleCos = 0;
            validPoints.forEach(pt => {
                simpleSin += Math.sin((pt.azim ?? 0) * DEG2RAD);
                simpleCos += Math.cos((pt.azim ?? 0) * DEG2RAD);
            });
            avgAz = (Math.atan2(simpleSin, simpleCos) * RAD2DEG + 360) % 360;
        } else {
            avgAz = (Math.atan2(sumSin, sumCos) * RAD2DEG + 360) % 360;
        }
        let minDiff = 0, maxDiff = 0;
        validPoints.forEach(pt => {
            const w = Math.sin((pt.inc ?? 0) * DEG2RAD);
            if (sumW >= 0.0001 && w < 0.043) return;
            let diff = pt.azim - avgAz;
            while (diff < -180) diff += 360; while (diff > 180) diff -= 360;
            if (diff < minDiff) minDiff = diff; if (diff > maxDiff) maxDiff = diff;
        });
        return { start: (avgAz + minDiff - 2 + 360) % 360, end: (avgAz + maxDiff + 2 + 360) % 360, draw: true };
    }, [processedData, limitMD]);

    const concentricValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const degreeLabels = useMemo(() => { const l: number[] = []; for (let d = 0; d < 360; d += 4) if (d !== 0 && d !== 90 && d !== 180 && d !== 270) l.push(d); return l; }, []);

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] h-[280px] select-none overflow-visible">
            {sector.draw && (
                <path
                    d={`M ${cx} ${cy} L ${cx + Math.cos(toRad(sector.start)) * R} ${cy + Math.sin(toRad(sector.start)) * R} A ${R} ${R} 0 ${(sector.end - sector.start + 360) % 360 > 180 ? 1 : 0} 1 ${cx + Math.cos(toRad(sector.end)) * R} ${cy + Math.sin(toRad(sector.end)) * R} Z`}
                    fill="rgb(var(--color-primary) / 0.08)"
                    stroke="rgb(var(--color-primary))"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                />
            )}
            {concentricValues.map(val => <circle key={val} cx={cx} cy={cy} r={(val / 100) * R} fill="none" stroke="rgb(var(--color-text-main) / 0.05)" strokeWidth={val === 100 ? 1.0 : 0.5} />)}
            {degreeLabels.map(deg => { const p = getPt(deg, 105); return <text key={`l${deg}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="6.5" fontWeight="600" fill="rgb(var(--color-text-muted))">{deg}°</text>; })}
            <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="rgb(var(--color-text-main) / 0.15)" strokeWidth="1.0" />
            <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="rgb(var(--color-text-main) / 0.15)" strokeWidth="1.0" />
            <text x={cx} y={cy - R - 10} textAnchor="middle" fill="rgb(var(--color-danger))" fontSize="12" fontWeight="900">N</text>
            <text x={cx + R + 10} y={cy} textAnchor="start" dominantBaseline="middle" fill="rgb(var(--color-text-main))" fontSize="11" fontWeight="800">E</text>
            <text x={cx} y={cy + R + 18} textAnchor="middle" fill="rgb(var(--color-text-main))" fontSize="11" fontWeight="800">S</text>
            <text x={cx - R - 10} y={cy} textAnchor="end" dominantBaseline="middle" fill="rgb(var(--color-text-main))" fontSize="11" fontWeight="800">W</text>
            {processedData.map((pt, idx) => {
                if (pt.md === 0 || pt.md > limitMD || pt.azim === undefined) return null;
                const pT = getPt(pt.azim, (pt.md / limitMD) * 98);
                return <line key={`r${idx}`} x1={cx} y1={cy} x2={pT.x} y2={pT.y} stroke="rgb(var(--color-primary))" strokeWidth="2.0" strokeLinecap="round" opacity="0.8" />;
            })}
            <circle cx={cx} cy={cy} r={3} fill="rgb(var(--color-danger))" />
        </svg>
    );
};

export const SurveysModule: React.FC<Props> = ({ params, setParams, onBack }) => {
    const { t, language } = useLanguage();
    
    // Sync initially with params survey
    const initialRaw = useMemo(() => {
        if (!params.survey || params.survey.length === 0) return '';
        const hasAdv = params.survey.some(s => s.inc !== undefined || s.dogleg !== undefined || s.azim !== undefined);
        if (hasAdv) {
            return params.survey.map(s => [
                s.md, s.inc ?? '', s.azim ?? '', s.tvd ?? '', s.subSea ?? '', s.northing ?? '', s.ns ?? '', s.easting ?? '', s.ew ?? '', s.northingM ?? '', s.eastingM ?? '', s.verticalSection ?? '', s.dogleg ?? ''
            ].join('\t')).join('\n');
        }
        return params.survey.map(s => `${s.md}\t${s.tvd}`).join('\n');
    }, [params.survey]);

    const [rawSurvey, setRawSurvey] = useState(initialRaw);
    const [isAdvanced, setIsAdvanced] = useState(false);
    const [isSpoolerMinimized, setIsSpoolerMinimized] = useState(false);
    
    // Config values for Spooler polar calculations
    const limitMD = params.wellbore.tubingBottom;
    const processedData = useMemo<ProcessedPoint[]>(() => {
        return params.survey.map(pt => ({
            md: pt.md,
            tvd: pt.tvd,
            inc: pt.inc ?? 0,
            azim: pt.azim ?? 0
        }));
    }, [params.survey]);

    const averageAzimuth = useMemo(() => {
        const validPoints = processedData.filter(pt => pt.md > 0 && pt.md <= limitMD && pt.azim !== undefined);
        if (validPoints.length === 0) return 0;
        let sumSin = 0, sumCos = 0, sumW = 0;
        validPoints.forEach(pt => {
            const w = Math.sin((pt.inc ?? 0) * DEG2RAD);
            sumSin += Math.sin((pt.azim ?? 0) * DEG2RAD) * w;
            sumCos += Math.cos((pt.azim ?? 0) * DEG2RAD) * w;
            sumW += w;
        });
        if (sumW < 0.0001) {
            let simpleSin = 0, simpleCos = 0;
            validPoints.forEach(pt => {
                simpleSin += Math.sin((pt.azim ?? 0) * DEG2RAD);
                simpleCos += Math.cos((pt.azim ?? 0) * DEG2RAD);
            });
            return (Math.atan2(simpleSin, simpleCos) * RAD2DEG + 360) % 360;
        }
        return (Math.atan2(sumSin, sumCos) * RAD2DEG + 360) % 360;
    }, [processedData, limitMD]);

    const maxCurveDLS = useMemo(() => {
        if (params.survey.length === 0) return 0;
        return Math.max(...params.survey.map(s => s.dogleg || 0));
    }, [params.survey]);

    const isDark = true;
    
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        if (file.name.endsWith('.json')) {
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    const surveyData = Array.isArray(data) ? data : (data.survey || data.data || []);
                    if (surveyData.length > 0) {
                        const mds = surveyData.map((s: any) => s.md ?? '').join('\n');
                        const tvds = surveyData.map((s: any) => s.tvd ?? '').join('\n');
                        const incs = surveyData.map((s: any) => s.inc ?? '').join('\n');
                        const azims = surveyData.map((s: any) => s.azim ?? '').join('\n');
                        const subSeas = surveyData.map((s: any) => s.subSea ?? '').join('\n');
                        const northings = surveyData.map((s: any) => s.northing ?? '').join('\n');
                        const eastings = surveyData.map((s: any) => s.easting ?? '').join('\n');
                        const dlss = surveyData.map((s: any) => s.dogleg ?? '').join('\n');

                        setMdInput(mds);
                        setTvdInput(tvds);
                        setIncInput(incs);
                        setAzimInput(azims);
                        setSubSeaInput(subSeas);
                        setNorthingInput(northings);
                        setEastingInput(eastings);
                        setDlsInput(dlss);
                        setIsAdvanced(true);
                    }
                } catch (err) {
                    alert("Error al leer el archivo JSON.");
                }
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = read(data, { type: 'array' });
                    
                    const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'SURVEY');
                    if (!sheetName) {
                        alert("No se encontró la hoja 'SURVEY' en el archivo Excel.");
                        return;
                    }

                    const sheet = workbook.Sheets[sheetName];
                    const grid = xlsxUtils.sheet_to_json(sheet, { header: 1 }) as any[][];
                    
                    let headerRowIdx = -1;
                    let colMapping: Record<string, number> = {};
                    
                    const headerPatterns = {
                        md: [/md/i, /measured\s*depth/i, /profundidad\s*medida/i, /^depth$/i, /^pm$/i],
                        tvd: [/tvd/i, /true\s*vertical\s*depth/i, /profundidad\s*verdadera/i, /^pv$/i],
                        inc: [/inc/i, /inclin/i, /deviation/i, /dev/i],
                        azim: [/azim/i, /direction/i, /rumbo/i],
                        subSea: [/subsea/i, /sub\s*sea/i, /ss/i],
                        northing: [/northing/i, /^n\/s$/i, /latitude/i],
                        easting: [/easting/i, /^e\/w$/i, /longitude/i],
                        dogleg: [/dogleg/i, /dls/i, /severidad/i]
                    };

                    for (let r = 0; r < Math.min(grid.length, 30); r++) {
                        const row = grid[r];
                        if (!row) continue;
                        
                        let foundMD = false;
                        let foundTVD = false;
                        let tempMapping: Record<string, number> = {};

                        row.forEach((cell, cIdx) => {
                            if (cell === undefined || cell === null) return;
                            const cellStr = String(cell).trim().toLowerCase();
                            
                            for (const [key, regexes] of Object.entries(headerPatterns)) {
                                if (regexes.some(rx => rx.test(cellStr))) {
                                    tempMapping[key] = cIdx;
                                    if (key === 'md') foundMD = true;
                                    if (key === 'tvd') foundTVD = true;
                                }
                            }
                        });

                        if (foundMD && (foundTVD || (tempMapping.inc !== undefined && tempMapping.azim !== undefined))) {
                            headerRowIdx = r;
                            colMapping = tempMapping;
                            break;
                        }
                    }

                    if (headerRowIdx === -1) {
                        alert("No se pudieron identificar las columnas de Survey en la hoja SURVEY (se requiere al menos MD y TVD/Inclinación).");
                        return;
                    }

                    const mds: any[] = [];
                    const tvds: any[] = [];
                    const incs: any[] = [];
                    const azims: any[] = [];
                    const subSeas: any[] = [];
                    const northings: any[] = [];
                    const eastings: any[] = [];
                    const dlss: any[] = [];

                    for (let r = headerRowIdx + 1; r < grid.length; r++) {
                        const row = grid[r];
                        if (!row || row.length === 0) continue;

                        const mdVal = colMapping.md !== undefined ? row[colMapping.md] : undefined;
                        if (mdVal === undefined || mdVal === null || isNaN(Number(mdVal))) continue;

                        mds.push(mdVal);
                        tvds.push(colMapping.tvd !== undefined ? row[colMapping.tvd] : '');
                        incs.push(colMapping.inc !== undefined ? row[colMapping.inc] : '');
                        azims.push(colMapping.azim !== undefined ? row[colMapping.azim] : '');
                        subSeas.push(colMapping.subSea !== undefined ? row[colMapping.subSea] : '');
                        northings.push(colMapping.northing !== undefined ? row[colMapping.northing] : '');
                        eastings.push(colMapping.easting !== undefined ? row[colMapping.easting] : '');
                        dlss.push(colMapping.dogleg !== undefined ? row[colMapping.dogleg] : '');
                    }

                    setMdInput(mds.join('\n'));
                    setTvdInput(tvds.join('\n'));
                    setIncInput(incs.join('\n'));
                    setAzimInput(azims.join('\n'));
                    setSubSeaInput(subSeas.join('\n'));
                    setNorthingInput(northings.join('\n'));
                    setEastingInput(eastings.join('\n'));
                    setDlsInput(dlss.join('\n'));
                    setIsAdvanced(true);

                } catch (err) {
                    alert("Error al procesar el archivo Excel.");
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const handleExportExcel = () => {
        if (params.survey.length === 0) {
            alert("No hay datos de trayectoria cargados para exportar.");
            return;
        }
        try {
            const cleanData = params.survey.map((s, idx) => ({
                "Fila": idx + 1,
                "MD (ft)": s.md,
                "TVD (ft)": s.tvd,
                "Inc (deg)": s.inc ?? '',
                "Azim (deg)": s.azim ?? '',
                "SubSea (ft)": s.subSea ?? '',
                "Northing (ft)": s.northing ?? '',
                "Easting (ft)": s.easting ?? '',
                "VS (ft)": s.verticalSection ?? '',
                "DLS (deg/100ft)": s.dogleg ?? ''
            }));
            const ws = xlsxUtils.json_to_sheet(cleanData);
            const wb = xlsxUtils.book_new();
            xlsxUtils.book_append_sheet(wb, ws, "SURVEY");
            const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Surveys_Export_${params.metadata?.wellName || 'Pozo'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert("Error al exportar archivo Excel.");
        }
    };

    const handleExportJson = () => {
        if (params.survey.length === 0) {
            alert("No hay datos de trayectoria cargados para exportar.");
            return;
        }
        try {
            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(params.survey, null, 2))}`;
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", jsonString);
            downloadAnchor.setAttribute("download", `Survey_${params.metadata?.wellName || 'Pozo'}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } catch (err) {
            alert("Error al exportar archivo JSON.");
        }
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
                    mdVal, isNaN(incVal) ? '' : incVal, isNaN(azimVal) ? '' : azimVal, isNaN(tvdVal) ? '' : tvdVal,
                    isNaN(subSeaVal) ? '' : subSeaVal, isNaN(northingVal) ? '' : northingVal, nsVal || '',
                    isNaN(eastingVal) ? '' : eastingVal, ewVal || '', isNaN(northingMVal) ? '' : northingMVal,
                    isNaN(eastingMVal) ? '' : eastingMVal, isNaN(vsVal) ? '' : vsVal, isNaN(dlsVal) ? '' : dlsVal
                ].join('\t'));
            }
            
            pts.sort((a, b) => a.md - b.md);
            setRawSurvey(rawLines.join('\n'));
        } else {
            pts = parseLines(mdInput + '\n' + tvdInput, false);
            setRawSurvey(pts.map(p => `${p.md}\t${p.tvd}`).join('\n'));
        }

        const maxMD = pts.length > 0 ? pts[pts.length - 1].md : 0;
        setParams(prev => {
            const autoTubingMD = Math.max((prev.wellbore && prev.wellbore.tubingBottom) || 0, Math.round(maxMD * 0.85));
            return {
                ...prev,
                survey: pts,
                totalDepthMD: maxMD,
                pressures: {
                    ...(prev.pressures || {}),
                    pumpDepthMD: (prev.pressures && prev.pressures.pumpDepthMD) || autoTubingMD
                },
                wellbore: {
                    ...(prev.wellbore || {}),
                    casingBottom: Math.max((prev.wellbore && prev.wellbore.casingBottom) || 0, maxMD),
                    tubingBottom: autoTubingMD,
                    midPerfsMD: (prev.wellbore && prev.wellbore.midPerfsMD) || Math.round(maxMD * 0.90)
                }
            } as any;
        });
    };

    const hasAdvancedData = params.survey.length > 0 && params.survey.some(s => s.inc !== undefined || s.dogleg !== undefined || s.azim !== undefined);
    
    const maxInclination = useMemo(() => {
        if (params.survey.length === 0) return 0;
        return Math.max(...params.survey.map(s => s.inc || 0));
    }, [params.survey]);

    const maxDogleg = useMemo(() => {
        if (params.survey.length === 0) return 0;
        return Math.max(...params.survey.map(s => s.dogleg || 0));
    }, [params.survey]);

    const avgInclination = useMemo(() => {
        if (params.survey.length === 0) return 0;
        const valid = params.survey.filter(s => s.inc !== undefined);
        if (valid.length === 0) return 0;
        return valid.reduce((acc, curr) => acc + (curr.inc || 0), 0) / valid.length;
    }, [params.survey]);

    return (
        <div className="flex flex-col h-screen w-full bg-canvas/30 text-txt-main overflow-hidden">
            {/* Header Standalone */}
            <header className="relative h-16 bg-canvas/60 backdrop-blur-md border-b border-surface-light/35 px-6 flex items-center justify-between z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack} 
                        className="p-2 bg-white/5 hover:bg-white/10 text-primary border border-white/5 hover:border-primary/20 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                        title="Volver al Menú"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="text-txt-muted font-mono text-xs font-black tracking-widest opacity-60">UTILIDAD</span>
                    <div className="h-4 w-px bg-surface-light/50"></div>
                    <h2 className="text-xs font-black text-txt-main uppercase tracking-[0.25em] flex items-center gap-2">
                        <Compass className="w-4 h-4 text-primary animate-pulse" /> SURVEYS Y TRAYECTORIAS 3D
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleExportExcel} 
                        disabled={params.survey.length === 0}
                        className="flex items-center gap-2 text-[10px] font-black text-primary hover:text-white bg-primary/10 hover:bg-primary px-4 py-2 rounded-xl transition-all border border-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" /> Exportar Excel
                    </button>
                    <button 
                        onClick={handleExportJson} 
                        disabled={params.survey.length === 0}
                        className="flex items-center gap-2 text-[10px] font-black text-secondary hover:text-white bg-secondary/10 hover:bg-secondary px-4 py-2 rounded-xl transition-all border border-secondary/20 disabled:opacity-50 cursor-pointer"
                    >
                        <FileCode className="w-3.5 h-3.5" /> Exportar JSON
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-6 p-6 min-h-0 overflow-y-auto lg:overflow-hidden relative">
                {/* LEFT/MAIN CONTAINER: 3D Plot & Data Table (Visualizador de Trayectoria) */}
                <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0 animate-fadeIn h-full" style={{ animationDelay: '0.1s' }}>
                    <div className="glass-surface border border-white/5 shadow-2xl flex-1 flex flex-col overflow-hidden relative">
                        <div className="px-6 py-4 glass-surface border-b border-white/5 flex justify-between items-center relative z-20 shrink-0">
                            <h3 className="text-xs font-black text-txt-main uppercase tracking-widest">Visualizador de Trayectoria</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setActiveMainTab('plot')} 
                                    className={`text-[10px] font-black uppercase transition-all px-4 py-2 flex items-center gap-2 cursor-pointer ${activeMainTab === 'plot' ? 'bg-primary/20 border-primary border text-primary shadow-glow-primary' : 'glass-surface-light border border-white/5 text-txt-muted hover:text-txt-main'}`}
                                >
                                    <Map className="w-3.5 h-3.5" /> 3D Trajectory
                                </button>
                                <button 
                                    onClick={() => setActiveMainTab('table')} 
                                    className={`text-[10px] font-black uppercase transition-all px-4 py-2 flex items-center gap-2 cursor-pointer ${activeMainTab === 'table' ? 'bg-primary/20 border-primary border text-primary shadow-glow-primary' : 'glass-surface-light border border-white/5 text-txt-muted hover:text-txt-main'}`}
                                >
                                    <Table className="w-3.5 h-3.5" /> Data Table {hasAdvancedData && <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 relative z-10 flex flex-col">
                            {activeMainTab === 'plot' ? (
                                <div className="w-full h-full flex-1 min-h-0 hide-right-column-survey relative">
                                    <TrajectoryPlot survey={params.survey} params={params} />
                                    
                                    {/* CSS Inject to hide the split right column and expand 3D visualizer to full width */}
                                    <style>{`
                                        .hide-right-column-survey [class*="grid-cols"] {
                                            grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
                                        }
                                        .hide-right-column-survey [class*="grid-cols"] > div:nth-child(2) {
                                            display: none !important;
                                        }
                                        .hide-right-column-survey [class*="grid-cols"] > div:first-child {
                                            border-right: none !important;
                                            width: 100% !important;
                                            height: 100% !important;
                                        }
                                        /* Center mode buttons (Estructura, Inc, Dogleg) to avoid overlap */
                                        .hide-right-column-survey .relative.flex-col > div:nth-child(3) {
                                            right: auto !important;
                                            left: 50% !important;
                                            transform: translateX(-50%) !important;
                                        }
                                    `}</style>

                                    {/* Absolute Floating Spooler ALS Card */}
                                    {params.survey.length > 0 && (
                                        isSpoolerMinimized ? (
                                            <button 
                                                onClick={() => setIsSpoolerMinimized(false)}
                                                className="absolute top-4 right-4 z-30 p-2.5 bg-surface/85 backdrop-blur-md border border-white/10 hover:border-primary/50 rounded-xl hover:text-primary transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105"
                                                title="Mostrar Optimización de Azimut"
                                            >
                                                <Compass className="w-3.5 h-3.5 text-primary animate-pulse" />
                                                <span className="text-[9px] font-black uppercase tracking-wider">Spooler ALS ({Math.round(averageAzimuth)}°)</span>
                                            </button>
                                        ) : (
                                            <div className="absolute top-4 right-4 z-30 w-72 bg-surface/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col items-center animate-fadeIn">
                                                <div className="flex w-full justify-between items-center mb-2 pb-1.5 border-b border-white/5">
                                                    <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1.5 font-sans">
                                                        <Compass className="w-3.5 h-3.5 text-primary" /> Spooler ALS
                                                    </span>
                                                    <button 
                                                        onClick={() => setIsSpoolerMinimized(true)}
                                                        className="p-1 hover:bg-white/15 rounded text-txt-muted hover:text-white transition-colors cursor-pointer"
                                                        title="Minimizar"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                
                                                <div className="scale-75 origin-center my-[-25px]">
                                                    <SpoolerPolarChart processedData={processedData} limitMD={limitMD} isDark={isDark} />
                                                </div>

                                                <div className="w-full space-y-1.5 border-t border-white/5 pt-2 text-[10px] mt-1 font-sans">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-txt-muted uppercase">Dirección:</span>
                                                        <span className="font-mono font-black text-txt-main">{Math.round(averageAzimuth)}°</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-txt-muted uppercase">Límite MD:</span>
                                                        <span className="font-mono font-black text-txt-main">{Math.round(limitMD)} ft</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-txt-muted uppercase">Máx DLS:</span>
                                                        <span className="font-mono font-black text-warning">{maxCurveDLS.toFixed(2)} °/100ft</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    )}
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
                                                            Dogleg rate exceeds 3.0°/100ft. Increased mechanical friction/strain for artificial lift installations. Pump should ideally be set in low dogleg zones.
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

                {/* RIGHT COLUMN: Stacked controls (Configuración del Pozo + Terminal de Datos Survey) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 animate-fadeIn h-full overflow-y-auto custom-scrollbar pr-1" style={{ animationDelay: '0.3s' }}>
                    {/* Casing & Tubing Configuration */}
                    <div className="glass-surface border border-white/5 shadow-2xl p-5 flex flex-col gap-4 shrink-0">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-white/5 shrink-0">
                            <Sliders className="w-5 h-5 text-primary" />
                            <h3 className="text-xs font-black text-txt-main uppercase tracking-widest">Configuración del Pozo</h3>
                        </div>
                        <div className="flex flex-col gap-4">
                            <PipeConfigCard 
                                title={t('p1.casing')} 
                                pipe={params.wellbore.casing} 
                                catalog={CASING_CATALOG} 
                                onSelect={(e) => {
                                    const c = CASING_CATALOG.find(x => x.description === e.target.value);
                                    if (c) setParams(p => ({ ...p, wellbore: { ...p.wellbore, casing: c } }));
                                }} 
                                bottomMD={params.wellbore.casingBottom} 
                                onDepthChange={(e) => setParams(p => ({ ...p, wellbore: { ...p.wellbore, casingBottom: parseFloat(e.target.value) } }))} 
                                colorClass="bg-primary" 
                                icon={Cylinder} 
                            />
                            <PipeConfigCard 
                                title={t('p1.tubing')} 
                                pipe={params.wellbore.tubing} 
                                catalog={TUBING_CATALOG} 
                                onSelect={(e) => {
                                    const c = TUBING_CATALOG.find(x => x.description === e.target.value);
                                    if (c) setParams(p => ({ ...p, wellbore: { ...p.wellbore, tubing: c } }));
                                }} 
                                bottomMD={(params.pressures && params.pressures.pumpDepthMD) || (params.wellbore && params.wellbore.tubingBottom) || 0} 
                                onDepthChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setParams(p => ({ 
                                        ...p, 
                                        wellbore: { ...(p.wellbore || {}), tubingBottom: val }, 
                                        pressures: { ...(p.pressures || {}), pumpDepthMD: val } 
                                    } as any));
                                }} 
                                onRoughnessChange={(e) => setParams(p => ({ ...p, wellbore: { ...(p.wellbore || {}), tubing: { ...((p.wellbore && p.wellbore.tubing) || {}), roughness: parseFloat(e.target.value) } } } as any))} 
                                colorClass="bg-secondary" 
                                icon={ArrowDown} 
                            />
                            
                            <div className="border-t border-white/5 pt-4 mt-2">
                                <TechnicalInput 
                                    label="Profundidad de Perforaciones (MD)" 
                                    value={params.wellbore.midPerfsMD || 0} 
                                    unit="ft" 
                                    onChange={(e: any) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setParams(p => ({ 
                                            ...p, 
                                            wellbore: { ...p.wellbore, midPerfsMD: val } 
                                        }));
                                    }} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Survey Data Terminal */}
                    <div className="glass-surface border border-white/5 shadow-2xl flex-1 flex flex-col overflow-hidden relative min-h-0">
                        <div className="px-6 py-5 glass-surface border-b border-white/5 flex flex-col gap-4 relative z-20 shrink-0">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <FileCode className="w-6 h-6 text-primary shadow-glow-primary" />
                                    <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.25em]">{t('p1.survey_term')}</h3>
                                </div>
                                <div className="flex gap-2">
                                    <label className="text-[10px] font-black text-txt-muted hover:text-primary flex items-center gap-2 uppercase transition-all px-4 py-2 rounded-none glass-surface-light border border-white/5 cursor-pointer">
                                        <Database className="w-4 h-4 text-primary" />
                                        Subir Archivo
                                        <input type="file" accept=".xlsx, .xls, .json" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                    <button onClick={handleClear} className="text-[10px] font-black text-txt-muted hover:text-danger flex items-center gap-2.5 uppercase transition-all px-4 py-2 rounded-none glass-surface-light border border-white/5 cursor-pointer">
                                        <Trash2 className="w-4 h-4" /> {t('p1.clear')}
                                    </button>
                                </div>
                            </div>

                            {/* Mode Toggle tabs */}
                            <div className="grid grid-cols-2 p-0.5 bg-canvas border border-white/5 rounded-none shrink-0 relative">
                                <button
                                    onClick={() => setIsAdvanced(false)}
                                    className={`py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-none flex items-center justify-center gap-2 cursor-pointer ${!isAdvanced ? 'bg-primary/20 text-primary border border-primary/20 shadow-glow-primary font-black z-10' : 'text-txt-muted hover:text-txt-main z-10'}`}
                                >
                                    <Sliders className="w-3.5 h-3.5" /> {t('p1.basic')}
                                </button>
                                <button
                                    onClick={() => setIsAdvanced(true)}
                                    className={`py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-none flex items-center justify-center gap-2 cursor-pointer ${isAdvanced ? 'bg-primary/20 text-primary border border-primary/20 shadow-glow-primary font-black z-10' : 'text-txt-muted hover:text-txt-main z-10'}`}
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
                            <button onClick={handleProcess} className="w-full btn-premium-primary animate-pulse-glow hover:to-orange-500 text-white py-5 rounded-none text-[11px] font-black uppercase tracking-[0.4em] transition-all border border-white/10 light-sweep flex items-center justify-center gap-3 cursor-pointer">
                                <Check className="w-6 h-6" /> Procesar y Compilar Trayectoria
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
