
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    UploadCloud, X, GitCompareArrows, ChevronLeft, Activity,
    Cpu, BarChart3, DollarSign, Award, CheckCircle2, ChevronDown, ChevronUp,
    Sparkles, Send, RefreshCw, Info, Globe, LayoutDashboard, ShieldCheck, Zap, AlertTriangle, Layers,
    TrendingUp, Gauge, Settings, Trash2, List, PanelRightClose, PanelRightOpen,
    Radar as RadarIcon, BarChart as LucideBarChart, Droplets, Moon, Sun, Palette
} from 'lucide-react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Cell, Tooltip as ReTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { read, utils as xlsxUtils } from 'xlsx';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme';
import { ComparatorCurves } from './ComparatorCurves';
import { calculateScenarioResults, getDesignStyle } from '../utils';
import { VisualESPStack } from './VisualESPStack';

const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");

// ── TYPES ────────────────────────────────────────────────────────────────────
interface DesignSnapshot { id: string; fileName: string; params: any; pump: any; results: any; frequency: number; }

interface Props { onBack: () => void; initialDesign?: DesignSnapshot; }

// ── PALETTE ──────────────────────────────────────────────────────────────────
const DEFAULT_DC = [
    { b: '#3b82f6', bg: 'rgba(59,130,246,0.1)', t: 'Design A' },
    { b: '#f59e0b', bg: 'rgba(245,158,11,0.1)', t: 'Design B' },
    { b: '#10b981', bg: 'rgba(16,185,129,0.1)', t: 'Design C' },
    { b: '#a855f7', bg: 'rgba(168,85,247,0.1)', t: 'Design D' },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const f0 = (v: any) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(0) : '—');
const f1 = (v: any) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '—');


function techScoreRange(d: DesignSnapshot) {
    const res = ['min', 'target', 'max'].map(sk => calculateScenarioResults(d, sk as any)) as any[];
    const valid = res.filter(r => r && isFinite(r.flow));
    if (valid.length < 3) return 30;

    let score = 0;

    // 1. Efficiency Consistency (Avg across range) - 20 pts
    const avgEff = valid.reduce((acc, r) => acc + (r.effEstimated || 0), 0) / valid.length;
    score += Math.min(20, (avgEff / 68) * 20);

    // 2. Motor Load Stability - 20 pts
    const mlRange = valid.map(r => r.motorLoad || 0);
    const minMl = Math.min(...mlRange), maxMl = Math.max(...mlRange);
    if (minMl >= 65 && maxMl <= 100) score += 20;
    else if (minMl >= 45 && maxMl <= 110) score += 12;
    else score += 4;

    // 3. PIP Margin (Safety) - 20 pts
    const pb = d.params?.fluids?.pb || 0;
    const minPip = res[0]?.pip || 0;
    if (minPip > pb * 1.3) score += 20;
    else if (minPip > pb * 1.05) score += 12;
    else score += 4;

    // 4. BEP Alignment - 20 pts
    const tgt = res[1];
    const bep = d.pump?.bepRate || 1;
    const ratio = tgt?.flow / bep;
    if (ratio >= 0.9 && ratio <= 1.05) score += 20;
    else if (ratio >= 0.75 && ratio <= 1.25) score += 12;
    else score += 4;

    // 5. Energy Intensity Penalty - 20 pts
    const avgIntensity = valid.reduce((acc, r) => acc + ((r.electrical?.kw || 0) / (Math.max(1, r.flow))) * 1000, 0) / valid.length;
    if (avgIntensity < 0.6) score += 20;
    else if (avgIntensity < 1.0) score += 15;
    else if (avgIntensity < 1.4) score += 8;
    else score += 0;

    return Math.round(score);
}



// ── UPLOAD ZONE ────────────────────────────────────────────────────────────────
const UploadZone = ({ onFile, idx }: { onFile: (s: DesignSnapshot) => void; idx: number }) => {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const { language, t } = useLanguage();
    const cfg = DEFAULT_DC[idx % 4];

    const handle = (file: File) => {
        setLoading(true); setErr('');
        const isXlsx = file.name.endsWith('.xlsx');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let jsonStr = '';
                if (isXlsx) {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const wb = read(data, { type: 'array' });
                    const sheet = wb.Sheets['APP_DATA'];
                    if (sheet) {
                        const jsonData = xlsxUtils.sheet_to_json(sheet, { header: 1 }) as any[][];
                        jsonStr = jsonData[1]?.[0] as string;
                    }
                } else {
                    jsonStr = e.target?.result as string;
                }

                if (!jsonStr) throw new Error("Format Error");
                const json = JSON.parse(jsonStr);
                if (json.type === 'esp-studio-project' && json.data) {
                    const d = json.data;
                    const res = calculateScenarioResults({ params: d.params, pump: d.customPump, frequency: d.frequency || 60 } as any, 'target');
                    onFile({
                        id: `d${Date.now()}${idx}`,
                        fileName: file.name.replace('.json', '').replace('.xlsx', ''),
                        params: d.params,
                        pump: d.customPump,
                        results: res || {},
                        frequency: d.frequency || 60
                    });
                } else setErr(language === 'es' ? "Formato Inválido" : "Invalid Format");
            } catch (err) { setErr(language === 'es' ? "Error de archivo" : "File Error"); }
            finally { setLoading(false); }
        };

        if (isXlsx) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
    };

    return (
        <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-500 overflow-hidden relative group/upload glass-surface"
            style={{ borderColor: cfg.b + '33' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f); }}>
            <input type="file" accept=".json,.xlsx" className="hidden" onChange={e => { if (e.target.files?.[0]) handle(e.target.files[0]); }} />
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover/upload:opacity-100 transition-opacity pointer-events-none" />
            <div className="p-4 rounded-2xl shadow-inner group-hover/upload:scale-110 transition-transform duration-500" style={{ background: cfg.bg }}>
                {loading ? <RefreshCw className="w-8 h-8 animate-spin" style={{ color: cfg.b }} /> : <UploadCloud className="w-8 h-8" style={{ color: cfg.b }} />}
            </div>
            <div className="text-center relative z-10 space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: cfg.b }}>{cfg.t}</p>
                <p className="text-[11px] text-txt-muted font-bold uppercase opacity-80">{err || t('dc.upload')}</p>
            </div>
            {/* Reflective shine element inside */}
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/5 blur-3xl rounded-full" />
        </label>
    );
};



// ── HARDWARE MATRIX ───────────────────────────────────────────────────────────
const PumpHardwareMatrix = ({ designs }: { designs: DesignSnapshot[] }) => {
    const { language, t } = useLanguage();
    const specs = [
        { l: t('dc.manufacturer'), k: 'pump.manufacturer' },
        { l: t('dc.pumpModel'), k: 'pump.model' },
        { l: t('dc.totalStages'), k: 'pump.stages' },
        { l: t('dc.housingCount'), k: 'pump.housingCount' },
        { l: t('dc.series'), k: 'pump.series' },
        { l: t('dc.motorHp'), k: 'params.selectedMotor.hp' },
        { l: t('dc.motorVolt'), k: 'params.selectedMotor.voltage' },
        { l: t('dc.motorAmps'), k: 'params.selectedMotor.amps' },
    ];

    return (
        <div className="glass-surface rounded-[24px] border border-surface-light p-4 shadow-lg mb-4 card-shine overflow-hidden relative light-sweep">
            <div className="animate-scan-line opacity-10" />
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                    <Settings className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-txt-main text-glow">
                    {language === 'es' ? 'ESPECIFICACIONES DE HARDWARE' : 'HARDWARE SPECIFICATIONS'}
                </h3>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-surface-light/20">
                            <th className="py-3 px-4 text-left text-[11px] font-black uppercase text-txt-muted/70 w-[200px] tracking-wider">Spec</th>
                            {designs.map((d, i) => {
                                const cfg = getDesignStyle(d.pump, i);
                                return (
                                    <th key={i} className="py-3 px-4 text-center text-xs font-black uppercase tracking-[0.15em] border-l border-white/5" style={{ color: cfg.b }}>
                                        {cfg.t}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {specs.map((s, si) => (
                            <tr key={si} className="border-b border-surface-light/5 row-highlight transition-all">
                                <td className="py-3 px-4 text-xs font-black text-txt-muted/80 uppercase tracking-tight">{s.l}</td>
                                {designs.map((d, i) => {
                                    const val = s.k.split('.').reduce((o, key) => o?.[key], d as any);
                                    return (
                                        <td key={i} className="py-3 px-4 text-center text-sm font-black text-txt-main border-l border-white/5 font-mono">
                                            {typeof val === 'number' ? f0(val) : (val || '—')}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// BHA Comparison removed as per user request

// ── DECISION RADAR UNIT ──────────────────────────────────────────────────────
const DecisionRadar = ({ designs, scores }: { designs: DesignSnapshot[]; scores: number[] }) => {
    const { language, t } = useLanguage();

    const radarData = useMemo(() => {
        const metrics = [
            { key: 'opex', label: t('dc.opexEff') },
            { key: 'safety', label: t('dc.safetyPip') },
            { key: 'stability', label: t('dc.loadStability') },
            { key: 'robust', label: t('dc.robustness') },
            { key: 'flex', label: t('dc.flexibility') },
        ];

        return metrics.map(m => {
            const entry: any = { subject: m.label };
            designs.forEach((d, i) => {
                const rMin = calculateScenarioResults(d, 'min');
                const rObj = calculateScenarioResults(d, 'target');
                const rMax = calculateScenarioResults(d, 'max');
                const pb = d.params?.fluids?.pb || 1000;

                let val = 50;

                if (m.key === 'opex') {
                    // Normalize around 70% efficiency
                    val = ((rObj?.effEstimated || 0) / 75) * 100;
                }
                if (m.key === 'safety') {
                    // Margin above bubble point at min flow
                    const margin = (rMin?.pip || 0) / pb;
                    val = margin > 1.5 ? 100 : margin > 1.1 ? 80 : margin > 1.0 ? 60 : 30;
                }
                if (m.key === 'stability') {
                    // Variation of motor load across range (less variation = more stable)
                    const mlRange = Math.abs((rMax?.motorLoad || 0) - (rMin?.motorLoad || 0));
                    val = 100 - (mlRange * 2);
                }
                if (m.key === 'robust') {
                    // Alignment with BEP at target
                    const bep = d.pump?.bepRate || 1;
                    const deviation = Math.abs(1 - (rObj?.flow / bep));
                    val = 100 - (deviation * 200);
                }
                if (m.key === 'flex') {
                    // Width of operating window relative to flow
                    const window = (rMax?.flow || 0) - (rMin?.flow || 0);
                    val = (window / (rObj?.flow || 1)) * 150;
                }

                entry[`d${i}`] = Math.max(15, Math.min(100, val));
            });
            return entry;
        });
    }, [designs, language]);

    return (
        <div className="h-[400px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="85%" data={radarData}>
                    <defs>
                        {designs.map((_, i) => (
                            <filter key={`glow${i}`} id={`glow${i}`} x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2.5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        ))}
                    </defs>
                    <PolarGrid stroke="rgba(var(--color-text-muted), 0.15)" strokeDasharray="4 4" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'rgb(var(--color-text-main))', fontSize: 10, fontWeight: '900', letterSpacing: '0.05em' }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    {designs.map((d, i) => {
                        const cfg = getDesignStyle(d.pump, i);
                        return (
                            <Radar
                                key={i}
                                name={cfg.t}
                                dataKey={`d${i}`}
                                stroke={cfg.b}
                                fill={cfg.b}
                                fillOpacity={0.15}
                                strokeWidth={3.5}
                                filter={`url(#glow${i})`}
                            />
                        );
                    })}
                    <ReTooltip
                        contentStyle={{
                            backgroundColor: 'rgba(var(--color-surface), 0.9)',
                            borderRadius: '20px',
                            border: '1px solid var(--color-surface-light)',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(12px)',
                            padding: '12px'
                        }}
                        itemStyle={{ fontSize: '12px', fontWeight: '900', padding: '2px 0' }}
                    />
                </RadarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-full scale-[0.85] opacity-20" />
        </div>
    );
};


// ── BAR BENCHMARKING Metrics ────────────────────────────────────────────────
const TechnicalBarBenchmarking = ({ designs }: { designs: DesignSnapshot[] }) => {
    const { language } = useLanguage();

    const data = useMemo(() => {
        return designs.map((d, i) => {
            const res = calculateScenarioResults(d, 'target');
            const kw = res?.electrical?.kw || 0;
            const flow = res?.flow || 1;
            const costPerKwh = d.params?.simulation?.costPerKwh || 0.12;

            return {
                name: getDesignStyle(d.pump, i).t,
                efficiency: Number((res?.effEstimated || 0).toFixed(1)),
                intensity: Number(((kw / flow) * 1000).toFixed(2)),
                dailyCost: Math.round(kw * 24 * costPerKwh),
                fill: getDesignStyle(d.pump, i).b
            };
        });
    }, [designs]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Efficiency Chart */}
            <div className="glass-surface rounded-[24px] border border-surface-light p-5 shadow-lg relative overflow-hidden card-shine light-sweep">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                        <BarChart3 className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-txt-main">
                        {language === 'es' ? 'Eficiencia del Sistema (%)' : 'System Efficiency (%)'}
                    </h3>
                </div>
                <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgb(var(--color-text-muted))', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis hide domain={[0, 'auto']} />
                            <ReTooltip
                                contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-surface-light)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'black', color: 'var(--color-text-main)' }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />
                            <Bar dataKey="efficiency" radius={[8, 8, 0, 0]} barSize={25} label={{ position: 'top', fill: 'var(--color-text-main)', fontSize: 10, fontWeight: 'black' }}>
                                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Intensity Chart */}
            <div className="glass-surface rounded-[24px] border border-surface-light p-5 shadow-lg relative overflow-hidden card-shine light-sweep">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <Zap className="w-4 h-4 text-emerald-500" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-txt-main">
                        {language === 'es' ? 'Intensidad Energética (kW/kBPD)' : 'Energy Intensity (kW/kBPD)'}
                    </h3>
                </div>
                <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgb(var(--color-text-muted))', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis hide domain={[0, 'auto']} />
                            <ReTooltip
                                contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-surface-light)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'black', color: 'var(--color-text-main)' }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />
                            <Bar dataKey="intensity" radius={[8, 8, 0, 0]} barSize={25} label={{ position: 'top', fill: 'var(--color-text-main)', fontSize: 10, fontWeight: 'black' }}>
                                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Daily Cost Chart */}
            <div className="glass-surface rounded-[24px] border border-surface-light p-5 shadow-lg relative overflow-hidden card-shine light-sweep">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg">
                        <DollarSign className="w-4 h-4 text-amber-500" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-txt-main">
                        {language === 'es' ? 'Costo Operativo Diario ($/día)' : 'Daily Operating Cost ($/day)'}
                    </h3>
                </div>
                <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgb(var(--color-text-muted))', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis hide domain={[0, 'auto']} />
                            <ReTooltip
                                contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-surface-light)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'black', color: 'var(--color-text-main)' }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />
                            <Bar dataKey="dailyCost" radius={[8, 8, 0, 0]} barSize={25} label={{ position: 'top', fill: 'var(--color-text-main)', fontSize: 10, fontWeight: 'black', formatter: (v: any) => `$${v}` }}>
                                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export const DesignComparator: React.FC<Props> = ({ onBack, initialDesign }) => {
    const { language, setLanguage, t } = useLanguage();
    const { theme, cycleTheme, toggleLightMode } = useTheme();
    const toggleLanguage = () => setLanguage(language === 'en' ? 'es' : 'en');
    const [designs, setDesigns] = useState<DesignSnapshot[]>([]);
    const [showUpload, setShowUpload] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
 
    useEffect(() => {
        if (initialDesign && designs.length === 0) {
            setDesigns([initialDesign]);
        }
    }, [initialDesign]);

    const add = useCallback((s: DesignSnapshot) => setDesigns(p => [...p.filter(d => d.fileName !== s.fileName), s].slice(0, 4)), []);
    const rem = (id: string) => setDesigns(p => p.filter(d => d.id !== id));


    const canCompare = designs.length >= 2;
    const scores = useMemo(() => designs.map(techScoreRange), [designs]);
    const bestScore = Math.max(...scores, 0);

    return (
        <div className="flex h-screen bg-canvas text-txt-main font-sans selection:bg-primary/30 overflow-hidden">
            {/* SLEEK SIDEBAR */}
            <aside className={`transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] border-r border-white/5 bg-surface/20 backdrop-blur-3xl flex flex-col relative z-50 ${sidebarOpen ? 'w-[340px]' : 'w-0 opacity-0 -translate-x-full'}`}>
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-glow-primary">
                            <Layers className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-glow">{language === 'es' ? 'Panel de Control' : 'Control Panel'}</h2>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all magnetic-button">
                        <PanelRightClose className="w-5 h-5 text-txt-muted" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
                    {/* UPLOAD ZONE - PRIMARY ACTION */}
                    <div className="space-y-3">
                        <UploadZone idx={designs.length} onFile={add} />
                    </div>

                    {/* ACTIVE DESIGNS LIST */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-3">
                            <h3 className="text-xs font-black text-txt-muted uppercase tracking-[0.2em]">{language === 'es' ? 'Escenarios' : 'Scenarios'}</h3>
                            <span className="text-[11px] font-black text-primary px-3 py-1 bg-primary/10 rounded-full border border-primary/20 shadow-glow-primary">{designs.length}/4</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {designs.map((d, i) => (
                                <div key={d.id} className="group relative p-3 rounded-2xl border border-surface-light transition-all hover:border-primary/40 glass-surface shadow-sm overflow-hidden card-shine">
                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ background: getDesignStyle(d.pump, i).b }} />
                                    <div className="flex items-center justify-between mb-2 ml-1">
                                        <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: getDesignStyle(d.pump, i).b }}>{getDesignStyle(d.pump, i).t}</span>
                                        <button onClick={() => rem(d.id)} className="p-1.5 hover:bg-red-500/10 text-txt-muted hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-[13px] font-black truncate text-txt-main px-1 mb-4 tracking-tight">{d.fileName}</p>

                                    {/* BSW Display (Read-only) */}
                                    <div className="px-1 space-y-1 pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-txt-main/60 uppercase tracking-widest flex items-center gap-2">
                                                <Droplets className="w-3.5 h-3.5" /> BSW
                                            </span>
                                            <span className="text-[13px] font-black text-primary font-mono">{d.params.fluids.waterCut}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-surface-light bg-surface-light/20">
                    <button onClick={onBack} className="w-full btn-premium-primary flex items-center justify-center gap-3 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.25em] text-white light-sweep">
                        <ChevronLeft className="w-5 h-5" /> {language === 'es' ? 'SALIR' : 'EXIT'}
                    </button>
                </div>
            </aside>

            {/* MAIN DASHBOARD */}
            <main className="flex-1 overflow-y-auto custom-scrollbar relative bg-canvas">
                {/* AURORA DECORATION */}
                <div className="aurora-bg">
                    <div className="aurora-1" />
                    <div className="aurora-2" />
                </div>
                {/* FLOATING TOGGLE FOR SIDEBAR */}
                {!sidebarOpen && (
                    <button onClick={() => setSidebarOpen(true)} className="fixed top-8 left-8 z-[60] p-3 bg-surface border border-surface-light rounded-2xl shadow-2xl text-primary hover:scale-110 transition-all">
                        <PanelRightOpen className="w-5 h-5" />
                    </button>
                )}

                {/* DASHBOARD HEADER */}
                <header className="sticky top-0 z-50 glass-surface px-4 h-14 flex items-center justify-between border-b border-surface-light/80 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-tr from-primary to-secondary rounded-xl shadow-lg">
                                <GitCompareArrows className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xs font-black uppercase tracking-[0.3em] text-glow">{t('dc.title')}</h1>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 items-center bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                        <button onClick={toggleLanguage} className="h-10 px-4 flex items-center gap-2 rounded-xl hover:bg-white/10 transition-all group" title="Switch Language">
                            <Globe className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] font-black text-txt-main tracking-widest uppercase font-mono">{language}</span>
                        </button>
                        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                        <button onClick={cycleTheme} className="h-10 px-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group" title="Cycle Professional Themes">
                            <Palette className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest font-mono text-primary hidden md:block">{theme}</span>
                        </button>
                    </div>
                </header>

                <div className="px-4 py-4 space-y-6">
                    {canCompare ? (
                        <div className="space-y-6">
                            {/* BENTO LAYOUT: RANKING + RADAR + KPI */}
                            <div className="grid grid-cols-12 gap-4">
                                {/* LEFT: RANKING */}
                                <div className="col-span-12 lg:col-span-4 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        {designs.map((d, i) => {
                                            const sc = scores[i];
                                            const cfg = getDesignStyle(d.pump, i);
                                            const isWinner = sc === bestScore;
                                            return (
                                                <div key={i} className={`p-2 rounded-[16px] border transition-all duration-500 relative group glass-surface ${isWinner
                                                    ? 'bg-gradient-to-br from-primary/10 to-transparent border-primary/30 shadow-lg shadow-primary/5'
                                                    : 'opacity-90'
                                                    }`}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: cfg.b }}>{cfg.t}</span>
                                                        <span className="text-[13px] font-black italic tracking-tighter" style={{ color: cfg.b }}>{sc}</span>
                                                    </div>
                                                    <div className="w-full bg-canvas/40 h-1 rounded-full overflow-hidden mb-1.5">
                                                        <div className="h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(var(--color-primary),0.5)]" style={{ width: `${sc}%`, background: cfg.b }} />
                                                    </div>
                                                    <p className="text-[10px] font-black text-txt-main/70 truncate uppercase tracking-tight">{d.pump?.model}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* RIGHT: KEY PERFORMANCE INDICATORS - COMPARATIVE VIEW */}
                                <div className="col-span-12 lg:col-span-8 grid grid-cols-4 gap-2">
                                    {[
                                        { l: language === 'es' ? 'Eficiencia %' : 'Efficiency %', m: 'eff', i: Zap, c: 'text-primary', bg: 'from-primary/10' },
                                        { l: language === 'es' ? 'Mín PIP (psi)' : 'Min PIP (psi)', m: 'pip', i: Activity, c: 'text-emerald-500', bg: 'from-emerald-500/10' },
                                        { l: language === 'es' ? 'Intensidad' : 'Energy Int.', m: 'int', i: Cpu, c: 'text-indigo-500', bg: 'from-indigo-500/10' },
                                        { l: language === 'es' ? 'Rango (BPD)' : 'Range (BPD)', m: 'range', i: TrendingUp, c: 'text-amber-500', bg: 'from-amber-500/10' },
                                    ].map((kpi, idx) => {
                                        const values = designs.map(d => {
                                            const rObj = calculateScenarioResults(d, 'target');
                                            const rMin = calculateScenarioResults(d, 'min');
                                            const rMax = calculateScenarioResults(d, 'max');
                                            if (kpi.m === 'eff') return rObj?.effEstimated || 0;
                                            if (kpi.m === 'pip') return rMin?.pip || 0;
                                            if (kpi.m === 'int') return ((rObj?.electrical?.kw || 0) / (rObj?.flow || 1)) * 1000;
                                            if (kpi.m === 'range') return (rMax?.flow || 0) - (rMin?.flow || 0);
                                            return 0;
                                        });

                                        return (
                                            <div key={idx} className={`glass-surface p-3 rounded-[24px] border border-surface-light flex flex-col group bg-gradient-to-br ${kpi.bg}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className={`p-2 rounded-xl bg-canvas/40 border border-surface-light shadow-inner`}>
                                                        <kpi.i className={`w-3.5 h-3.5 ${kpi.c}`} />
                                                    </div>
                                                    <p className="text-[9px] font-black text-txt-main uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">{kpi.l}</p>
                                                </div>

                                                <div className="space-y-2">
                                                    {designs.map((d, i) => (
                                                        <div key={i} className="flex items-center justify-between gap-2 overflow-hidden">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: getDesignStyle(d.pump, i).b }} />
                                                                <span className="text-[8px] font-black text-txt-muted uppercase truncate">{getDesignStyle(d.pump, i).t}</span>
                                                            </div>
                                                            <span className="text-[11px] font-black text-txt-main font-mono whitespace-nowrap">
                                                                {kpi.m === 'eff' ? f1(values[i]) + '%' :
                                                                    kpi.m === 'pip' ? f0(values[i]) :
                                                                        kpi.m === 'int' ? f1(values[i]) :
                                                                            f0(values[i])}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <PumpHardwareMatrix designs={designs} />
                                <div className="glass-surface rounded-[24px] border border-surface-light p-4 shadow-lg mb-4 flex flex-col items-center justify-center overflow-hidden relative card-shine light-sweep">
                                    <div className="animate-scan-line opacity-10" />
                                    <DecisionRadar designs={designs} scores={scores} />
                                </div>
                            </div>

                            <TechnicalBarBenchmarking designs={designs} />

                            {/* MIDDLE: TECHNICAL RANGE MATRIX (ENHANCED) */}
                            <div className="grid grid-cols-1 gap-8">
                                <div className="glass-surface rounded-[40px] border border-surface-light p-8 shadow-2xl space-y-6 overflow-hidden relative card-shine light-sweep">
                                    <div className="animate-scan-line opacity-20" />
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-secondary/10 rounded-2xl border border-secondary/20 shadow-inner">
                                                <Activity className="w-5 h-5 text-secondary animate-pulse" />
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-txt-main text-glow">{t('dc.techMatrix')}</h3>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-[900px]">
                                            <thead>
                                                <tr className="border-b border-surface-light">
                                                    <th className="py-4 px-6 text-xs font-black uppercase text-txt-muted/70 sticky left-0 bg-surface z-20 border-r border-white/5">{language === 'es' ? 'Variable' : 'Variable'}</th>
                                                    {designs.map((d, i) => (
                                                        <th key={i} colSpan={3} className="py-4 px-3 text-center border-l border-white/5 bg-canvas/20">
                                                            <span className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: getDesignStyle(d.pump, i).b }}>{getDesignStyle(d.pump, i).t}</span>
                                                        </th>
                                                    ))}
                                                </tr>
                                                <tr className="bg-canvas/40">
                                                    <th className="py-2 px-6 border-b border-white/5 sticky left-0 z-20 bg-surface border-r border-white/5"></th>
                                                    {designs.map((_, i) => (
                                                        <React.Fragment key={i}>
                                                            <th className="py-2 px-2 text-[10px] font-black text-center text-txt-muted uppercase tracking-tighter border-l border-white/5">Min</th>
                                                            <th className="py-2 px-2 text-[10px] font-black text-center text-primary uppercase tracking-tighter bg-primary/10">Obj</th>
                                                            <th className="py-2 px-2 text-[10px] font-black text-center text-txt-muted uppercase tracking-tighter">Max</th>
                                                        </React.Fragment>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { l: 'Flow BPD', k: 'flow', f: f0, icon: TrendingUp },
                                                    { l: 'Head ft', k: 'tdh', f: f0, icon: Gauge },
                                                    { l: 'Power kW', k: 'electrical.kw', f: f1, icon: Zap },
                                                    { l: language === 'es' ? 'Costo $/día' : 'Cost $/day', k: 'cost', f: f0, icon: DollarSign, calc: (r: any, d: any) => r?.electrical?.kw * 24 * (d.params?.simulation?.costPerKwh || 0.12) },
                                                    { l: 'PIP psi', k: 'pip', f: f0, icon: Activity },
                                                    { l: 'Eff %', k: 'effEstimated', f: f1, icon: BarChart3 },
                                                    { l: 'Motor %', k: 'motorLoad', f: f0, icon: Cpu },
                                                    { l: 'GVF %', k: 'gasAnalysis.voidFraction', f: (v: any) => f1(v * 100), icon: Droplets },
                                                    { l: language === 'es' ? 'Etapas' : 'Stages', k: 'stages', f: f0, icon: Layers, calc: (_: any, d: any) => d.pump?.stages },
                                                    { l: language === 'es' ? 'Cuerpos' : 'Bodies', f: f0, icon: List, calc: (_: any, d: any) => d.pump?.housingCount || 1 },
                                                    { l: 'kW/kBPD', k: 'intensity', f: f1, icon: ShieldCheck, calc: (r: any) => (r?.electrical?.kw / (r?.flow || 1)) * 1000 },
                                                ].map((row, ri) => (
                                                    <tr key={ri} className="border-b border-surface-light/10 row-highlight transition-all group">
                                                        <td className="py-4 px-6 text-[11px] font-black text-txt-main sticky left-0 bg-surface/90 backdrop-blur-md z-20 flex items-center gap-3 group-hover:pl-8 transition-all duration-300 border-r border-white/5 border-b border-white/5">
                                                            <row.icon className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                                            {row.l}
                                                        </td>
                                                        {designs.map((d, i) => {
                                                            const res = ['min', 'target', 'max'].map(sk => calculateScenarioResults(d, sk as any)) as any[];
                                                            return (
                                                                <React.Fragment key={i}>
                                                                    <td className="py-4 px-2 text-center text-[13px] font-bold border-l border-white/5 opacity-80 font-mono">
                                                                        {row.calc ? row.f(row.calc(res[0], d)) : row.f(row.k.split('.').reduce((o, i) => o?.[i], res[0]))}
                                                                    </td>
                                                                    <td className="py-4 px-2 text-center text-[13px] font-black text-primary bg-primary/10 font-mono">
                                                                        {row.calc ? row.f(row.calc(res[1], d)) : row.f(row.k.split('.').reduce((o, i) => o?.[i], res[1]))}
                                                                    </td>
                                                                    <td className="py-4 px-2 text-center text-[13px] font-bold opacity-80 font-mono border-r border-white/5">
                                                                        {row.calc ? row.f(row.calc(res[2], d)) : row.f(row.k.split('.').reduce((o, i) => o?.[i], res[2]))}
                                                                    </td>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <ComparatorCurves designs={designs} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-10 animate-fadeIn">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative p-16 rounded-[60px] bg-surface/40 backdrop-blur-3xl border border-surface-light shadow-[0_50px_100px_rgba(0,0,0,0.1)] flex items-center justify-center">
                                    <GitCompareArrows className="w-32 h-32 text-primary opacity-20 animate-pulse" />
                                </div>
                            </div>
                            <div className="max-w-2xl space-y-4">
                                <h1 className="text-4xl font-black uppercase tracking-[0.4em] text-txt-main">{t('dc.awaitingDesigns')}</h1>
                                <p className="text-xs text-txt-muted font-bold tracking-[0.1em] opacity-60 leading-loose uppercase">
                                    {t('dc.awaitingSub')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* FLOATING AI CHAT */}
            {canCompare && <FloatingAiPanel designs={designs} language={language} />}
        </div>
    );
};

// ── FLOATING AI PANEL ──────────────────────────────────────────────────────────
const FloatingAiPanel = ({ designs, language }: { designs: DesignSnapshot[]; language: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState<any>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!process.env.API_KEY) return;
        const designData = designs.map((d, i) => {
            const scs = ['min', 'target', 'max'].map(sk => calculateScenarioResults(d, sk as any)) as any[];
            const cfg = getDesignStyle(d.pump, i);
            return `${cfg.t}: 
            - RANGE: Min=${f0(scs[0]?.flow)} BPD, Target=${f0(scs[1]?.flow)} BPD, Max=${f0(scs[2]?.flow)} BPD
            - PERFORMANCE: TDH=${f0(scs[1]?.tdh)}ft, Efficiency=${f1(scs[1]?.effEstimated)}%, MotorLoad=${f0(scs[1]?.motorLoad)}%
            - RISKS: PIP=${f0(scs[0]?.pip)}psi (vs Pb=${f0(d.params?.fluids?.pb)}psi), GVF Max=${f1(scs[2]?.gasAnalysis?.voidFraction * 100)}%`;
        }).join('\n');

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction: `You are a Senior ESP Application Engineer. Your mission is to provide rigorous technical comparison between the provided designs. 
            Focus on:
            1. BEP Alignment: Is the target rate near the pump's Best Efficiency Point?
            2. Run-life Safety: Verify motor loads (keep 70-90%) and PIP safety margins above Bubble Point.
            3. Gas Handling: Flag designs exceeding 35% GVF at intake.
            4. Power Optimization: Which design has the lowest kW per barrel?
            Be precise, use engineering terminology, and always recommend the most stable design over the most 'aggressive' one. 
            Respond in ${language === 'es' ? 'SPANISH' : 'ENGLISH'}. 
            SYSTEM DATA:\n${designData}`
        });
        const s = model.startChat({ history: [] });
        setSession(s);
        setMsgs([{ role: 'model', text: language === 'es' ? `Hola. He analizado los ${designs.length} diseños. ¿En qué aspecto técnico deseas profundizar?` : `Hello. I have analyzed the ${designs.length} designs. What technical aspect would you like to explore?` }]);
    }, [designs.length, language]);

    useEffect(() => { if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, isOpen]);

    const send = async () => {
        if (!input.trim() || !session || loading) return;
        const txt = input; setInput(''); setLoading(true);
        setMsgs(p => [...p, { role: 'user', text: txt }]);
        try {
            const res = await session.sendMessage(txt);
            setMsgs(p => [...p, { role: 'model', text: res.response.text() }]);
        } catch { setMsgs(p => [...p, { role: 'model', text: '❌ Connection error.' }]); }
        setLoading(false);
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
            <div className={`transition-all duration-500 transform origin-bottom-right mb-4 ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="w-[380px] h-[520px] glass-surface border-primary/30 rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">
                    {/* CHAT HEADER */}
                    <div className="p-5 border-b border-surface-light flex items-center justify-between bg-primary/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary rounded-2xl shadow-[0_0_20px_rgba(var(--color-primary),0.4)] ring-4 ring-primary/20 animate-pulse">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-txt-main text-glow">Neural Advisor</h4>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">AI Core Active</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-surface-light rounded-xl transition-colors">
                            <X className="w-4 h-4 text-txt-muted" />
                        </button>
                    </div>

                    {/* MESSAGES */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-canvas/30">
                        {msgs.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[11px] leading-relaxed font-medium ${m.role === 'user' ? 'bg-primary text-white shadow-lg rounded-br-none' : 'bg-surface border border-surface-light text-txt-main shadow-sm rounded-bl-none'}`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {loading && <div className="flex justify-start"><div className="bg-surface px-4 py-2 rounded-2xl border border-surface-light"><RefreshCw className="w-3 h-3 animate-spin text-primary" /></div></div>}
                        <div ref={endRef} />
                    </div>

                    {/* INPUT */}
                    <div className="p-4 bg-surface border-t border-surface-light">
                        <div className="relative">
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={language === 'es' ? 'Escribe aquí...' : 'Type here...'} className="w-full bg-canvas border border-surface-light rounded-2xl pl-4 pr-12 py-3 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-semibold placeholder:text-txt-muted/50" />
                            <button onClick={send} disabled={!input.trim() || loading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-30">
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <button onClick={() => setIsOpen(!isOpen)} className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_15px_35px_rgba(var(--color-primary),0.4)] transition-all duration-500 group border-4 border-canvas overflow-hidden ${isOpen ? 'bg-surface text-primary rotate-90 scale-90' : 'bg-primary text-white hover:scale-105 active:scale-95'}`}>
                {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
        </div>
    );
};

