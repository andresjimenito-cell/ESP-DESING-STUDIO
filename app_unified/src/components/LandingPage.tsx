import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
    Globe, Command, FileText, User, Briefcase, ChevronRight,
    Activity, Zap, Power, Palette, Sun, Moon, Database, Sparkles, Cpu, GitCompareArrows, ArrowUpRight,
    FileSpreadsheet, UploadCloud as UploadIcon, Terminal, ShieldCheck, Radio, Search, X, RefreshCw, CheckCircle2, Settings, Cog, Lock
} from 'lucide-react';
import { SystemParams, SurveyPoint, PipeData } from '../types';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { CASING_CATALOG, TUBING_CATALOG } from '../data';
import { SecureWrapper, useAuth } from './SecureWrapper';

// ── Inline Excel Parser helpers ──────────────────────────────────────────────
const _n = (v: any) => {
    if (v == null) return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : Math.round(v * 100) / 100;
    const r = parseFloat(String(v).replace(',', '.').replace(/[^\-0-9.]/g, ''));
    return isNaN(r) ? 0 : Math.round(r * 100) / 100;
};
const _s = (v: any) => v == null ? '' : String(v).trim();
const _norm = (s: string) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const _get = (row: Record<string, any>, keys: string[]): any => {
    const nk = keys.map(_norm);
    for (const k of Object.keys(row)) {
        const n = _norm(k);
        if (nk.some(nk2 => n === nk2)) return row[k];
    }
    for (const k of Object.keys(row)) {
        const n = _norm(k);
        if (nk.some(nk2 => nk2.length >= 8 && n.includes(nk2))) return row[k];
    }
    return null;
};
const _pipe = (cat: any[], od: number, fb: number): PipeData => { const s = cat.find(c => Math.abs(c.od - od) < 0.05) || cat.find(c => Math.abs(c.od - fb) < 0.05) || cat[0]; return { description: s?.description || '', od: s?.od || fb, id: s?.id || fb * 0.8, weight: s?.weight || 30, roughness: s?.roughness || 0.0006 }; };

const _findSurvey = (wellName: string, surveys: Record<string, SurveyPoint[]>): SurveyPoint[] => {
    if (!wellName) return [];
    if (surveys[wellName]?.length) return surveys[wellName];
    const nWell = _norm(wellName);
    for (const key of Object.keys(surveys)) {
        if (!surveys[key]?.length) continue;
        const nKey = _norm(key);
        if (nKey === nWell) return surveys[key];
        if (nWell.includes(nKey) || nKey.includes(nWell)) return surveys[key];
    }
    return [];
};

const _baseWell = (name: string) =>
    name.replace(/#\d+/gi, '').replace(/\brun\s*\d+/gi, '').replace(/[_\-\s]+\d+$/, '').trim();

const _rowToParams = (row: Record<string, any>, surveys: Record<string, SurveyPoint[]>): SystemParams => {
    const g = (k: string[]) => _get(row, k);
    const well = _s(g(['POZO'])); const pSt = _n(g(['P ESTATICA (PSI)', 'P ESTATICA', 'PESTATICA'])); const pip = _n(g(['PIP MINIMA (PSI)', 'PIP MINIMA']));
    const ip = _n(g(['IP (BFPD/PSI)', 'IP (BFP/PSI)']));
    const ipMn = _n(g(['IP MÍN (BFPD/PSI)', 'IP MIN (BFPD/PSI)', 'IP MÍN', 'IP MIN']));
    const ipMx = _n(g(['IP MÁX (BFPD/PSI)', 'IP MAX (BFPD/PSI)', 'IP MÁX', 'IP MAX']));
    const bsw = _n(g(['BSW (%)']));
    const bswMn = _n(g(['BSW MÍN (%)', 'BSW MIN (%)', 'BSW MÍN', 'BSW MIN']));
    const bswMx = _n(g(['BSW MÁX (%)', 'BSW MAX (%)', 'BSW MÁX', 'BSW MAX']));
    const gor = _n(g(['GOR (SCF/STB)', 'GOR (SCFSTB)', 'GOR']));
    const gorMn = _n(g(['GOR MÍN', 'GOR MIN']));
    const gorMx = _n(g(['GOR MÁX', 'GOR MAX']));
    const intMD = _n(g(['PROFUNDIDAD DE INTAKE MD (FT)', 'INTAKE MD'])); const totMD = _n(g(['PROFUNDIDAD TOTAL MD (FT)', 'PROFUNDIDAD TOTAL MD']));
    const tp = _n(g(['TOPE DE PERFORADOS MD (FT)', 'TOPE DE PERFORADOS'])); const bp = _n(g(['BASE DE PERFORADOS MD (FT)', 'BASE DE PERFORADOS']));
    const tht = _n(g(['THT (°F)', 'THT'])); const bht = _n(g(['BHT (°F)', 'BHT']));
    const csgOd = _n(g(['CSG OD (IN)', 'CSG OD'])); const tbgOd = _n(g(['TBG OD (IN)', 'TBG OD'])); const tbgId = _n(g(['TBG ID (IN)', 'TBG ID']));
    const pht = _n(g(['THP (PSI)', 'THP'])); const phc = _n(g(['CHP (PSI)', 'CHP']));
    const api = _n(g(['°API', 'API'])); const gew = _n(g(['GE DEL AGUA', 'GE AGUA'])) || 1.05; const geg = _n(g(['GE DEL GAS', 'GE GAS'])) || 0.7;
    const sal = _n(g(['SALINIDAD (PPM)', 'SALINIDAD'])); const pb = _n(g(['P BURBUJA (PSI)', 'PBURBUJA']));
    const casing = _pipe(CASING_CATALOG, csgOd || 7, 7); const tubing = _pipe(TUBING_CATALOG, tbgOd || 3.5, 3.5);
    if (tbgId > 0) tubing.id = tbgId;
    const _r2 = (v: number) => Math.round(v * 100) / 100;
    const rate = (iv: number) => Math.round(Math.max(0, (iv || 0) * Math.max(0, pSt - pip)));
    return {
        metadata: { projectName: well, wellName: well, engineer: _s(g(['RESPONSABLE DISEÑO PROVEEDOR', 'RESPONSABLE DISENO PROVEEDOR'])), company: _s(g(['CAMPO'])), date: new Date().toISOString().split('T')[0], comments: `Batch|${_s(g(['FORMACION PRODUCTORA', 'FORMACION']))}` },
        wellbore: { correlation: 'Hagedorn-Brown', casing, tubing, casingTop: 0, tubingTop: 0, casingBottom: totMD, tubingBottom: intMD || totMD * 0.85, midPerfsMD: (tp + bp) / 2 || intMD + 200 },
        fluids: { apiOil: _r2(api || 30), geGas: _r2(geg), waterCut: _r2(bsw), geWater: _r2(gew), salinity: _r2(sal), pb: _r2(pb), gor: _r2(gor), glr: _r2(gor * (1 - bsw / 100)), isDeadOil: pb <= 0, co2: _r2(_n(g(['CO2 % MOLAR', 'CO2']))), h2s: _r2(_n(g(['H2S % MOLAR', 'H2S']))), n2: _r2(_n(g(['N2 % MOLAR', 'N2']))), sandCut: _r2(_n(g(['PRODUCCION DE SOLIDOS (PTB)', 'PRODUCCION DE SOLIDOS']))), sandDensity: 2.65, pvtCorrelation: 'Lasater', viscosityModel: 'Total Fluid', correlations: { viscDeadOil: 'Beggs-Robinson', viscSatOil: 'Beggs-Robinson', viscUnsatOil: 'Vasquez-Beggs', viscGas: 'Lee', viscWater: 'Matthews & Russell', oilDensity: 'Katz', gasDensity: 'Beggs', waterDensity: 'Beggs', pbRs: 'Lasater', oilComp: 'Vasquez-Beggs', oilFvf: 'Vasquez-Beggs', waterFvf: 'HP41C', zFactor: 'Dranchuk-Purvis', surfaceTensionOil: 'Baker-Swerdloff', surfaceTensionWater: 'Hough' } },
        inflow: { model: 'Productivity Index', staticSource: 'BHP', pStatic: _r2(pSt), ip: _r2(ip || 1), staticLevel: 0 },
        pressures: { totalRate: rate(ip), pht: _r2(pht || 50), phc: _r2(phc || 50), pumpDepthMD: _r2(intMD || totMD * 0.85) },
        targets: { min: { rate: rate(ipMn || ip * 0.7), ip: _r2(ipMn || ip * 0.7), waterCut: _r2(bswMn || bsw), gor: _r2(gorMn || gor), frequency: 50 }, target: { rate: rate(ip), ip: _r2(ip), waterCut: _r2(bsw), gor: _r2(gor), frequency: 60 }, max: { rate: rate(ipMx || ip * 1.3), ip: _r2(ipMx || ip * 1.3), waterCut: _r2(bswMx || bsw), gor: _r2(gorMx || gor * 1.2), frequency: 70 } },
        activeScenario: 'target', surfaceTemp: _r2(tht || 80), bottomholeTemp: _r2(bht || 200), totalDepthMD: _r2(totMD),
        survey: _findSurvey(well, surveys), motorHp: 0, simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0.12, ipType: 'fixed', ipTarget: ip },
        initialPumpName: _s(g(['BOMBA'])),
        initialStages: _n(g(['ETAPAS'])),
        initialMotorName: _s(g(['MOTOR'])),
        initialCableName: _s(g(['CABLE'])),
        initialVSDName: _s(g(['VARIADOR']))
    };
};

interface LandingPageProps {
    onStart: () => void;
    onCompare: () => void;
    onMonitoring: () => void;
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    language: string;
    toggleLanguage: () => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onQuickImport: (p: SystemParams) => void;
    menuLevel: 'main' | 'design';
    setMenuLevel: (l: 'main' | 'design') => void;
    batchState: {
        view: 'idle' | 'loading' | 'list'; setView: (v: 'idle' | 'loading' | 'list') => void;
        designs: Record<string, any>[]; setDesigns: (d: Record<string, any>[]) => void;
        surveys: Record<string, SurveyPoint[]>; setSurveys: (s: Record<string, SurveyPoint[]>) => void;
        file: string; setFile: (f: string) => void;
    };
}

// ── Persistent session state ──────────────────────────────────────────────────
let hasBootedThisSession = false;

export const LandingPage: React.FC<LandingPageProps> = ({
    onStart,
    onCompare,
    onMonitoring,
    params,
    setParams,
    language,
    toggleLanguage,
    onImportFile,
    onQuickImport,
    menuLevel,
    setMenuLevel,
    batchState
}) => {
    const { t } = useLanguage();
    const { view: batchView, setView: setBatchView, designs: batchDesigns, setDesigns: setBatchDesigns, surveys: batchSurveys, setSurveys: setBatchSurveys, file: batchFile, setFile: setBatchFile } = batchState;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const batchFileRef = useRef<HTMLInputElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0, rawX: 0, rawY: 0 });
    const [isStartingNew, setIsStartingNew] = useState(false);
    const { theme, cycleTheme, toggleLightMode } = useTheme();

    const [batchSearch, setBatchSearch] = useState('');
    const [batchProgress, setBatchProgress] = useState(0);
    const [batchSelected, setBatchSelected] = useState<string | null>(null);

    const { isAdmin, loginAdmin, logoutAdmin } = useAuth();

    const handleBatchFile = useCallback((file: File) => {
        setBatchView('loading');
        setBatchDesigns([]);
        setBatchSelected(null);
        setBatchProgress(5);
        setBatchFile(file.name);

        const worker = new Worker(
            new URL('../workers/excelWorker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (ev: MessageEvent) => {
            const msg = ev.data;
            if (msg.type === 'progress') {
                setBatchProgress(msg.value as number);
            } else if (msg.type === 'done') {
                setBatchSurveys(msg.surveys);
                setBatchDesigns(msg.designs);
                setBatchProgress(100);
                setTimeout(() => setBatchView('list'), 200);
                worker.terminate();
            } else if (msg.type === 'error') {
                console.error('Excel worker error:', msg.message);
                setBatchView('idle');
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            console.error('Worker crashed:', err);
            setBatchView('idle');
            worker.terminate();
        };

        file.arrayBuffer().then(buffer => {
            worker.postMessage({ buffer }, [buffer]);
        });

    }, [setBatchView, setBatchDesigns, setBatchSurveys, setBatchFile]);

    const [isBooting, setIsBooting] = useState(true);
    const [bootStep, setBootStep] = useState(0);
    const [bootPhase, setBootPhase] = useState<'explosion' | 'loading' | 'complete'>('loading');
    const [videoReady, setVideoReady] = useState(false);

    const handleLoadMaster = useCallback(async () => {
        setBatchView('loading');
        setBatchProgress(0);
        try {
            const resp = await fetch('/DATAS%20DE%20DISE%C3%91O.xlsx');
            if (!resp.ok) throw new Error('Master Excel not found');
            const blob = await resp.blob();
            const file = new File([blob], 'DATAS DE DISEÑO.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            handleBatchFile(file);
        } catch (e) {
            console.warn('Master Excel failed to load:', e);
            setBatchView('idle');
        }
    }, [handleBatchFile, setBatchView]);

    const bootLogs = [
        { msg: "INITIALIZING CORE.V26...", sub: "SYS", hex: "0x00A1" },
        { msg: "LOADING NEURAL NETWORKS...", sub: "AI", hex: "0x03F2" },
        { msg: "MOUNTING PVT ENGINE...", sub: "PVT", hex: "0x07B4" },
        { msg: "CALIBRATING PUMP CATALOG...", sub: "ESP", hex: "0x0C88" },
        { msg: "SYNCING WELL DATABASES...", sub: "DB", hex: "0x1AF0" },
        { msg: "ENCRYPTING CHANNELS...", sub: "SEC", hex: "0x2D10" },
        { msg: "COMPILING CORRELATIONS...", sub: "ENG", hex: "0x3E44" },
        { msg: "VALIDATING SURVEY DATA...", sub: "SVY", hex: "0x4F72" },
        { msg: "ESTABLISHING LINK...", sub: "NET", hex: "0x5C90" },
        { msg: "SYSTEM READY.", sub: "OK", hex: "0x7FFF" },
    ];

    const particles = useMemo(() => {
        return Array.from({ length: 30 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 5,
            duration: 8 + Math.random() * 12,
            size: 2 + Math.random() * 4,
            opacity: 0.4 + Math.random() * 0.4
        }));
    }, []);

    // Antigravity-style particle field — more orbs, varied sizes, slow drift
    const fieldParticles = useMemo(() => {
        return Array.from({ length: 80 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 1 + Math.random() * 3.5,
            speed: 20 + Math.random() * 60,
            drift: (Math.random() - 0.5) * 40,
            delay: Math.random() * -30,
            opacity: 0.15 + Math.random() * 0.5,
            color: i % 3 === 0 ? 'var(--color-primary)' : i % 3 === 1 ? 'var(--color-secondary)' : 'var(--color-accent)',
        }));
    }, []);

    useEffect(() => {
        if (isBooting) {
            const isFirstLoad = !hasBootedThisSession;
            const explosionDuration = isFirstLoad ? 600 : 400;
            const logInterval = isFirstLoad ? 200 : 100;
            const bootPhaseCompleteDelay = isFirstLoad ? 3000 : 1400;
            const bootFinishedDelay = isFirstLoad ? 3800 : 1900;

            const explosionTimer = setTimeout(() => setBootPhase('loading'), explosionDuration);

            const logStart = setTimeout(() => {
                const interval = setInterval(() => {
                    setBootStep(prev => {
                        if (prev < bootLogs.length - 1) return prev + 1;
                        clearInterval(interval);
                        return prev;
                    });
                }, logInterval);
                (window as any).__bootInterval = interval;
            }, explosionDuration + 100);

            const completeTimer = setTimeout(() => setBootPhase('complete'), bootPhaseCompleteDelay);

            const timer = setTimeout(() => {
                setIsBooting(false);
                hasBootedThisSession = true;
            }, bootFinishedDelay);

            return () => {
                clearTimeout(explosionTimer);
                clearTimeout(logStart);
                clearTimeout(completeTimer);
                clearTimeout(timer);
                if ((window as any).__bootInterval) clearInterval((window as any).__bootInterval);
            };
        }
    }, [isBooting]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20,
                rawX: e.clientX,
                rawY: e.clientY
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // BOOT SCREEN
    // ─────────────────────────────────────────────────────────────────────────
    if (isBooting) {
        const progress = (bootStep + 1) * 10;

        return (
            <div
                className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden font-mono"
                style={{
                    backgroundColor: 'rgb(var(--color-canvas))',
                    backgroundImage: 'linear-gradient(rgb(var(--color-canvas) / 0.75), rgb(var(--color-canvas) / 0.75)), url(/main_bg.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <style>{`
                    @keyframes eks-fade-out {
                        0%   { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    @keyframes eks-logo-in {
                        0%   { opacity: 0; transform: scale(0.9) translateY(20px); }
                        100% { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    @keyframes eks-sweep {
                        0%   { top: -4px; opacity: 0; }
                        5%   { opacity: 1; }
                        92%  { opacity: 0.6; }
                        100% { top: 100%;  opacity: 0; }
                    }
                    @keyframes eks-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                    @keyframes eks-term-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes eks-ignite {
                        0% { transform: scale(0); opacity: 1; }
                        100% { transform: scale(8); opacity: 0; }
                    }
                    @keyframes eks-grid-scroll {
                        0% { background-position: 0 0; }
                        100% { background-position: 0 80px; }
                    }
                    @keyframes eks-ring-cw  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
                    @keyframes eks-ring-ccw { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
                    @keyframes eks-float-data {
                        0%   { transform: translateY(100vh) translateX(0);   opacity: 0; }
                        10%  { opacity: 0.6; }
                        90%  { opacity: 0.4; }
                        100% { transform: translateY(-20vh) translateX(var(--drift)); opacity: 0; }
                    }
                    @keyframes eks-halo-pulse {
                        0%, 100% { transform: scale(1); opacity: 0.3; }
                        50%       { transform: scale(1.15); opacity: 0.6; }
                    }
                    @keyframes eks-complete-flash {
                        0%   { opacity: 0; }
                        40%  { opacity: 1; }
                        90%  { opacity: 1; }
                        100% { opacity: 1; }
                    }
                    @keyframes eks-logo-illuminate {
                        0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(var(--color-primary), 0.25)); }
                        50%       { filter: brightness(1.2) drop-shadow(0 0 32px rgba(var(--color-primary), 0.55)); }
                    }
                    @keyframes eks-particle-rise {
                        0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
                        5%   { opacity: var(--op); }
                        95%  { opacity: calc(var(--op) * 0.5); }
                        100% { transform: translateY(-80vh) translateX(var(--drift)) scale(0.4); opacity: 0; }
                    }
                    @keyframes eks-scanline {
                        0%   { transform: translateY(-100%); opacity: 0; }
                        10%  { opacity: 0.06; }
                        90%  { opacity: 0.03; }
                        100% { transform: translateY(100%); opacity: 0; }
                    }
                `}</style>

                {/* ── THEME CONTROLS ── */}
                <div className="absolute top-6 right-6 z-50 flex gap-2 items-center">
                    <button onClick={toggleLanguage} className="h-9 px-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[9px] font-black text-white/70 tracking-widest uppercase">{language}</span>
                    </button>
                    <button onClick={cycleTheme} className="h-9 px-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 backdrop-blur-md hover:bg-primary/20 transition-all">
                        <Palette className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">{theme}</span>
                    </button>
                </div>

                {/* ── FADE IN from canvas ── */}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none',
                    background: 'rgb(var(--color-canvas))',
                    animation: 'eks-fade-out 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
                }} />



                {/* ── DEEP SPACE BACKGROUND ── */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* Subtle perspective grid */}
                    <div className="absolute inset-0"
                        style={{
                            background: 'radial-gradient(ellipse at center, rgba(var(--color-primary), 0.04) 0%, transparent 70%)'
                        }}
                    />
                    <div
                        className="absolute bottom-[-15%] left-[-60%] right-[-60%] h-[55%] opacity-30"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(var(--color-secondary),0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--color-secondary),0.2) 1px, transparent 1px)',
                            backgroundSize: '60px 60px',
                            transform: 'perspective(700px) rotateX(65deg)',
                            animation: 'eks-grid-scroll 5s linear infinite'
                        }}
                    />

                    {/* Rising data particles — antigravity style */}
                    {fieldParticles.slice(0, 50).map(p => (
                        <div
                            key={p.id}
                            className="absolute rounded-full"
                            style={{
                                left: `${p.x}%`,
                                bottom: '-10px',
                                width: p.size,
                                height: p.size,
                                background: `rgb(${p.color})`,
                                boxShadow: `0 0 ${p.size * 4}px rgb(${p.color})`,
                                '--op': p.opacity,
                                '--drift': `${p.drift}px`,
                                animation: `eks-particle-rise ${p.speed}s linear ${p.delay}s infinite`,
                                opacity: 0,
                            } as any}
                        />
                    ))}

                    {/* Scanline sweep */}
                    <div style={{
                        position: 'absolute', left: 0, right: 0, height: '30%',
                        background: 'linear-gradient(to bottom, transparent, rgba(var(--color-primary), 0.04), transparent)',
                        animation: 'eks-scanline 8s linear infinite',
                        pointerEvents: 'none',
                    }} />
                </div>

                {/* ════════════════════════════════
                    CENTER LOGO CLUSTER
                ════════════════════════════════ */}
                <div style={{
                    position: 'relative', zIndex: 70,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 64,
                    animation: 'eks-logo-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) both',
                    transform: `perspective(1200px) rotateY(${mousePos.x * 0.3}deg) rotateX(${-mousePos.y * 0.3}deg)`,
                    transition: 'transform 0.15s ease-out',
                }}>
                    {/* Logo container with orbital rings */}
                    <div style={{ position: 'relative', width: 'min(85vw, 380px)' }}>
                        {/* Outer halo */}
                        <div style={{
                            position: 'absolute', inset: -60,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(var(--color-primary), 0.12) 0%, transparent 65%)',
                            animation: 'eks-halo-pulse 5s ease-in-out infinite',
                        }} />

                        {/* Orbital ring 1 */}
                        <div style={{
                            position: 'absolute', inset: -20,
                            border: '1px solid rgba(var(--color-primary), 0.12)',
                            borderRadius: '50%',
                            animation: 'eks-ring-cw 20s linear infinite',
                        }}>
                            {/* Orbiting dot */}
                            <div style={{
                                position: 'absolute', top: -3, left: '50%',
                                width: 6, height: 6, borderRadius: '50%',
                                background: 'rgb(var(--color-primary))',
                                boxShadow: '0 0 10px rgb(var(--color-primary))',
                                transform: 'translateX(-50%)',
                            }} />
                        </div>

                        {/* Orbital ring 2 (slower, tilted) */}
                        <div style={{
                            position: 'absolute', inset: -36,
                            border: '0.5px solid rgba(var(--color-secondary), 0.08)',
                            borderRadius: '50%',
                            animation: 'eks-ring-ccw 35s linear infinite',
                            transform: 'rotate3d(1, 0.5, 0, 55deg)',
                        }}>
                            <div style={{
                                position: 'absolute', bottom: -2, right: '30%',
                                width: 3, height: 3, borderRadius: '50%',
                                background: 'rgb(var(--color-secondary))',
                                boxShadow: '0 0 6px rgb(var(--color-secondary))',
                            }} />
                        </div>

                        {/* Logo image with scan sweep */}
                        <div style={{
                            position: 'relative',
                            animation: 'eks-logo-illuminate 4s ease-in-out infinite',
                            transform: `translate(${mousePos.x * 0.15}px, ${mousePos.y * 0.15}px)`,
                            transition: 'transform 0.2s ease-out',
                        }}>
                            <img
                                src="/LOGO.png"
                                alt="EDS.IA"
                                style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
                            />
                            {/* Scan line over logo */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: -10, right: -10,
                                height: '2px',
                                background: 'linear-gradient(90deg, transparent, rgba(var(--color-secondary), 0.9), transparent)',
                                boxShadow: '0 0 12px rgba(var(--color-secondary), 0.8)',
                                animation: 'eks-sweep 3.5s ease-in-out infinite',
                            }} />
                        </div>
                    </div>

                    {/* ── TERMINAL BLOCK ── */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 20, width: 'min(90vw, 420px)',
                        animation: 'eks-term-in 0.8s ease-out 0.6s both',
                    }}>
                        {/* Current log line */}
                        <div style={{
                            width: '100%', padding: '14px 24px',
                            background: 'rgba(var(--color-primary), 0.04)',
                            border: '1px solid rgba(var(--color-primary), 0.08)',
                            borderRadius: 14,
                            backdropFilter: 'blur(16px)',
                            display: 'flex', alignItems: 'center', gap: 16,
                        }}>
                            <span style={{
                                fontSize: 10, letterSpacing: '0.08em',
                                color: 'rgba(var(--color-primary), 0.4)',
                                flexShrink: 0, fontWeight: 700,
                            }}>
                                {bootLogs[bootStep].hex}
                            </span>
                            <span style={{
                                flex: 1,
                                fontSize: 10, letterSpacing: '0.4em',
                                color: 'rgba(var(--color-secondary), 0.7)',
                                fontWeight: 600, textTransform: 'uppercase',
                            }}>
                                {bootLogs[bootStep].msg}
                            </span>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: bootStep === bootLogs.length - 1
                                    ? 'rgb(var(--color-primary))'
                                    : 'rgba(var(--color-secondary), 0.5)',
                                boxShadow: bootStep === bootLogs.length - 1
                                    ? '0 0 10px rgb(var(--color-primary))'
                                    : 'none',
                                animation: 'eks-blink 1s infinite',
                                flexShrink: 0,
                            }} />
                        </div>

                        {/* Progress row: linear bar + circular arc */}
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16 }}>
                            {/* Linear bar */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{
                                    width: '100%', height: 3, borderRadius: 4,
                                    background: 'rgba(var(--color-primary), 0.08)',
                                    overflow: 'hidden',
                                    border: '0.5px solid rgba(var(--color-primary), 0.06)',
                                }}>
                                    <div style={{
                                        height: '100%', width: `${progress}%`,
                                        background: 'linear-gradient(90deg, rgba(var(--color-primary), 0.5), rgba(var(--color-primary), 1))',
                                        boxShadow: '0 0 16px rgba(var(--color-primary), 0.8)',
                                        transition: 'width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        borderRadius: 4,
                                    }} />
                                </div>
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    fontSize: 7, fontWeight: 900, letterSpacing: '0.25em',
                                    textTransform: 'uppercase',
                                    color: 'rgba(var(--color-primary), 0.2)',
                                }}>
                                    <span>ESP_ENGINE</span>
                                    <span>V26.BETA</span>
                                </div>
                            </div>

                            {/* Arc indicator */}
                            {(() => {
                                const sz = 64, sw = 2.5;
                                const r = (sz - sw * 2) / 2;
                                const circ = 2 * Math.PI * r;
                                const dash = circ - (circ * progress) / 100;
                                const angle = (progress / 100) * 2 * Math.PI - Math.PI / 2;
                                return (
                                    <div style={{ position: 'relative', flexShrink: 0, width: sz, height: sz }}>
                                        <svg width={sz} height={sz} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                                            <circle cx={sz / 2} cy={sz / 2} r={r}
                                                fill="none"
                                                stroke="rgba(var(--color-primary),0.06)"
                                                strokeWidth={sw}
                                            />
                                            <circle cx={sz / 2} cy={sz / 2} r={r}
                                                fill="none"
                                                stroke="rgba(var(--color-primary),1)"
                                                strokeWidth={sw}
                                                strokeLinecap="round"
                                                strokeDasharray={circ}
                                                strokeDashoffset={dash}
                                                style={{
                                                    transition: 'stroke-dashoffset 0.7s ease-out',
                                                    filter: 'drop-shadow(0 0 4px rgba(var(--color-primary),0.9))',
                                                }}
                                            />
                                            <circle
                                                cx={sz / 2 + r * Math.cos(angle)}
                                                cy={sz / 2 + r * Math.sin(angle)}
                                                r={3} fill="white"
                                                style={{ filter: 'drop-shadow(0 0 5px rgba(var(--color-primary),1))' }}
                                            />
                                        </svg>
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{
                                                fontSize: 12, fontWeight: 700,
                                                color: 'rgb(var(--color-text-main))', letterSpacing: '-0.02em',
                                            }}>{progress}%</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* ── FINAL FLASH ── */}
                {bootPhase === 'complete' && (
                    <div className="fixed inset-0 z-[2000] bg-white animate-[eks-complete-flash_1.2s_ease-in-out_forwards]" />
                )}

                {/* ── STATUS BAR ── */}
                <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 20,
                        fontSize: 7, fontWeight: 900, letterSpacing: '0.28em',
                        textTransform: 'uppercase',
                        color: 'rgba(var(--color-primary), 0.2)',
                    }}>
                        <span>SYS_CORE=0x7FA</span>
                        <div style={{
                            width: 3, height: 3, borderRadius: '50%',
                            background: 'rgba(var(--color-primary),0.4)',
                            animation: 'eks-blink 1.1s infinite',
                        }} />
                        <span>SECURE_CHANNEL_ACTIVE</span>
                        <div style={{
                            width: 3, height: 3, borderRadius: '50%',
                            background: 'rgba(var(--color-primary),0.4)',
                            animation: 'eks-blink 1.1s 0.55s infinite',
                        }} />
                        <span>AJM © 2026</span>
                    </div>
                </div>
            </div>
        );
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FIN BOOT SCREEN
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // LANDING PAGE — Visual Overhaul
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="h-screen w-full relative flex items-center justify-center overflow-hidden font-sans text-txt-main selection:bg-primary/30 transition-colors duration-700 animate-landing-entry">

            {/* ══════════════════════════════════════════════════════
                BACKGROUND SYSTEM — Deep Space + Antigravity Field
            ══════════════════════════════════════════════════════ */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                {/* Primary radial atmosphere */}
                <div className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(var(--color-primary), 0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 70%, rgba(var(--color-secondary), 0.05) 0%, transparent 55%)'
                    }}
                />

                {/* Background image — very subtle */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: "url('/main_bg.png')",
                        backgroundSize: "100% 100%",
                        filter: 'blur(2px) saturate(0.5)',
                        transform: `translate3d(${mousePos.x * -0.3}px, ${mousePos.y * -0.3}px, 0)`,
                        transition: 'transform 0.3s ease-out',
                    }}
                />

                {/* Fine dot mesh */}
                <div className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(var(--color-primary), 0.18) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        maskImage: 'radial-gradient(ellipse 90% 80% at center, black 20%, transparent 100%)',
                    }}
                />

                {/* Perspective floor */}
                <div
                    className="absolute bottom-[-25%] left-[-30%] right-[-30%] h-[45vh] opacity-25 animate-scan"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(var(--color-primary),0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--color-primary),0.2) 1px, transparent 1px)',
                        backgroundSize: '52px 52px',
                        transform: 'perspective(900px) rotateX(68deg)',
                        maskImage: 'linear-gradient(to top, black 5%, transparent 100%)',
                    }}
                />

                {/* ── ANTIGRAVITY PARTICLE FIELD ── */}
                {fieldParticles.map(p => (
                    <div
                        key={p.id}
                        className="absolute rounded-full"
                        style={{
                            left: `${p.x}%`,
                            bottom: '-8px',
                            width: p.size,
                            height: p.size,
                            background: `rgb(${p.color})`,
                            boxShadow: `0 0 ${p.size * 5}px rgb(${p.color})`,
                            '--op': p.opacity,
                            '--drift': `${p.drift}px`,
                            animationName: 'lp-particle-rise',
                            animationDuration: `${p.speed}s`,
                            animationDelay: `${p.delay}s`,
                            animationTimingFunction: 'linear',
                            animationIterationCount: 'infinite',
                            opacity: 0,
                        } as any}
                    />
                ))}

                {/* Mouse-tracking glow orb */}
                <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        width: 700, height: 700,
                        background: 'radial-gradient(circle, rgba(var(--color-primary), 0.06) 0%, transparent 65%)',
                        left: mousePos.rawX - 350,
                        top: mousePos.rawY - 350,
                        transition: 'left 0.4s ease-out, top 0.4s ease-out',
                        zIndex: 1,
                    }}
                />
            </div>

            {/* ══════════════════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════════════════ */}
            <header className="absolute top-0 left-0 w-full px-8 py-6 z-50 flex justify-between items-center animate-fadeIn">
                {/* Logo + wordmark */}
                <div className="flex items-center gap-3 group cursor-default">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden border transition-all duration-500"
                        style={{
                            background: 'rgba(var(--color-primary), 0.08)',
                            borderColor: 'rgba(var(--color-primary), 0.15)',
                        }}
                    >
                        <img
                            src="/LOGO.png"
                            alt="EDS.IA"
                            className="w-full h-full object-contain"
                            style={{ filter: 'drop-shadow(0 0 6px rgba(var(--color-primary),0.4))' }}
                        />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-2xl font-black tracking-tighter text-txt-main uppercase">
                            EDS<span className="text-primary">.IA</span>
                        </span>
                        <span
                            className="text-[7px] font-bold uppercase tracking-[0.45em] mt-1"
                            style={{ color: 'rgba(var(--color-primary), 0.4)' }}
                        >
                            VERSION BETA
                        </span>
                    </div>
                </div>

                {/* Nav pills */}
                <div
                    className="flex gap-1 items-center p-1 rounded-2xl border"
                    style={{
                        background: 'rgba(var(--color-canvas), 0.6)',
                        borderColor: 'rgba(var(--color-primary), 0.08)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    <button
                        onClick={toggleLanguage}
                        className="h-9 px-4 flex items-center gap-2 rounded-xl transition-all hover:bg-white/8"
                    >
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[9px] font-black text-txt-main/70 tracking-widest uppercase font-mono">{language}</span>
                    </button>

                    <div className="w-px h-4" style={{ background: 'rgba(var(--color-primary), 0.1)' }} />

                    <button
                        onClick={cycleTheme}
                        className="h-9 px-4 flex items-center gap-2 rounded-xl transition-all"
                        style={{ background: 'rgba(var(--color-primary), 0.08)', border: '0.5px solid rgba(var(--color-primary), 0.2)' }}
                    >
                        <Palette className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-widest font-mono text-primary">{theme}</span>
                    </button>

                    <div className="w-px h-4" style={{ background: 'rgba(var(--color-primary), 0.1)' }} />

                    <button
                        onClick={() => {
                            if (isAdmin) {
                                logoutAdmin();
                            } else {
                                const pass = window.prompt("Ingrese contraseña de administrador:");
                                if (pass) {
                                    const success = loginAdmin(pass);
                                    if (!success) alert("Contraseña incorrecta");
                                }
                            }
                        }}
                        className={`h-9 px-4 flex items-center gap-2 rounded-xl transition-all ${isAdmin ? 'text-primary' : 'text-txt-muted/50 hover:bg-white/8'}`}
                        style={isAdmin ? { background: 'rgba(var(--color-primary), 0.1)', border: '0.5px solid rgba(var(--color-primary), 0.2)' } : {}}
                    >
                        <Settings className={`w-3.5 h-3.5 ${isAdmin ? 'animate-spin-slow' : ''}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest font-mono hidden md:block">
                            {isAdmin ? 'Admin' : 'Lock'}
                        </span>
                    </button>
                </div>
            </header>

            {/* ══════════════════════════════════════════════════════
                MAIN CONTENT
            ══════════════════════════════════════════════════════ */}
            <main className="relative z-30 w-full max-w-[1380px] px-10 grid grid-cols-1 xl:grid-cols-12 gap-12 items-center">

                {/* ── LEFT: HERO TEXT ── */}
                <div className="xl:col-span-7 space-y-8 animate-fadeInLeft">

                    {/* Status badge */}
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center gap-2.5 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.3em]"
                            style={{
                                background: 'linear-gradient(90deg, rgba(var(--color-primary), 0.15), transparent)',
                                border: '0.5px solid rgba(var(--color-primary), 0.25)',
                                color: 'rgb(var(--color-primary))',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                            </span>
                            {t('lp.engineering')}
                        </div>
                    </div>

                    {/* Main headline */}
                    <div className="space-y-1 relative">
                        {/* Ambient glow behind text */}
                        <div
                            className="absolute -left-16 top-8 w-56 h-56 rounded-full pointer-events-none"
                            style={{ background: 'rgba(var(--color-primary), 0.08)', filter: 'blur(60px)' }}
                        />

                        <h1
                            className="text-[6.5rem] md:text-[8rem] xl:text-[9rem] font-black text-txt-main leading-[0.82] tracking-[-0.03em] select-none relative"
                            style={{
                                transform: `translate3d(${mousePos.x * 0.08}px, ${mousePos.y * 0.08}px, 0)`,
                                transition: 'transform 0.25s ease-out',
                            }}
                        >
                            ESP
                            <br />
                            <span className="relative">
                                DESIGN
                                {/* Underline accent */}
                                <span
                                    className="absolute -bottom-2 left-0 h-[3px] w-2/3 rounded-full"
                                    style={{ background: 'linear-gradient(90deg, rgb(var(--color-primary)), transparent)' }}
                                />
                            </span>
                            <br />
                            <span
                                className="text-transparent bg-clip-text"
                                style={{
                                    backgroundImage: 'linear-gradient(100deg, rgb(var(--color-primary)), rgb(var(--color-secondary)), rgb(var(--color-accent)))',
                                    backgroundSize: '200% auto',
                                    animation: 'gradient-x 5s ease infinite',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                STUDIO
                            </span>
                            <span
                                className="text-transparent bg-clip-text ml-3 text-[5rem]"
                                style={{
                                    backgroundImage: 'linear-gradient(100deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))',
                                    WebkitTextFillColor: 'transparent',
                                    verticalAlign: 'super',
                                    fontSize: '40%',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                IA
                            </span>
                        </h1>
                    </div>

                    {/* Description */}
                    <div className="relative pl-6 py-1">
                        <div
                            className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full"
                            style={{ background: 'linear-gradient(to bottom, rgb(var(--color-primary)), transparent)' }}
                        />
                        <p className="text-base leading-relaxed font-medium max-w-lg"
                            style={{ color: 'rgba(var(--color-text-main), 0.55)' }}>
                            {t('lp.desc')}
                        </p>
                    </div>

                    {/* Tech chips */}
                    <div className="flex flex-wrap gap-3 pt-2">
                        {[
                            { icon: Zap, label: 'VFD Sim' },
                            { icon: Database, label: 'PVT Core' },
                            { icon: Cpu, label: 'AI Suite' }
                        ].map((item, i) => (
                            <div
                                key={i}
                                className="group flex items-center gap-3 px-5 py-3 rounded-2xl cursor-default transition-all duration-300 hover:-translate-y-0.5"
                                style={{
                                    background: 'rgba(var(--color-canvas), 0.5)',
                                    border: '0.5px solid rgba(var(--color-primary), 0.12)',
                                    backdropFilter: 'blur(12px)',
                                    boxShadow: '0 2px 20px rgba(var(--color-primary), 0)',
                                    transition: 'all 0.3s ease',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(var(--color-primary), 0.12)')}
                                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 20px rgba(var(--color-primary), 0)')}
                            >
                                <div
                                    className="p-2 rounded-xl transition-colors"
                                    style={{ background: 'rgba(var(--color-primary), 0.1)' }}
                                >
                                    <item.icon className="w-4 h-4 text-primary" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-main/70 group-hover:text-txt-main transition-colors">
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── RIGHT: PANEL CARD ── */}
                <div className="xl:col-span-5 flex justify-center xl:justify-end animate-fadeInRight">
                    <div className="w-full max-w-[520px] relative">

                        {/* Card glow */}
                        <div
                            className="absolute -inset-px rounded-[36px] opacity-50"
                            style={{
                                background: 'linear-gradient(135deg, rgba(var(--color-primary), 0.3), rgba(var(--color-secondary), 0.15), rgba(var(--color-primary), 0.3))',
                                filter: 'blur(20px)',
                                animation: 'lp-card-glow 8s ease-in-out infinite alternate',
                            }}
                        />

                        {/* Card surface */}
                        <div
                            className="relative rounded-[32px] p-8 md:p-10 overflow-hidden"
                            style={{
                                background: 'rgba(var(--color-canvas), 0.75)',
                                border: '0.5px solid rgba(var(--color-primary), 0.12)',
                                backdropFilter: 'blur(40px)',
                                boxShadow: '0 32px 64px -16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            {/* Inner ambient glow top-right */}
                            <div
                                className="absolute top-[-40px] right-[-40px] w-[140px] h-[140px] rounded-full pointer-events-none"
                                style={{ background: 'rgba(var(--color-primary), 0.12)', filter: 'blur(50px)' }}
                            />

                            {/* Sparkle icon */}
                            <div className="absolute top-0 right-0 p-8 opacity-20">
                                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                            </div>

                            {/* Card header */}
                            <div className="mb-8 space-y-2">
                                <h3 className="text-2xl font-black text-txt-main uppercase tracking-tight">
                                    {t('lp.access')}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="h-0.5 w-8 rounded-full"
                                        style={{ background: 'rgb(var(--color-primary))' }}
                                    />
                                    <p
                                        className="text-[9px] font-black uppercase tracking-[0.25em]"
                                        style={{ color: 'rgba(var(--color-primary), 0.4)' }}
                                    >
                                        {t('lp.security')}
                                    </p>
                                </div>
                            </div>

                            {/* ── MENU LEVELS ── */}
                            <div className="relative min-h-[280px]">
                                {menuLevel === 'main' ? (
                                    <div className="space-y-4 animate-fadeIn">
                                        {/* Design & Engineering */}
                                        <SecureWrapper isLocked={true} tooltip="Módulo de Diseño Bloqueado" className="w-full">
                                            <button
                                                onClick={() => setMenuLevel('design')}
                                                className="group relative w-full h-[104px] overflow-hidden rounded-[1.5rem] transition-all duration-400 active:scale-[0.98]"
                                                style={{
                                                    background: 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-primary) / 0.8))',
                                                    border: '1px solid rgb(var(--color-primary) / 0.5)',
                                                    boxShadow: '0 10px 40px -10px rgb(var(--color-primary) / 0.4)',
                                                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 12px 48px rgba(var(--color-primary), 0.4)')}
                                                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(var(--color-primary), 0.2)')}
                                            >
                                                {/* Shimmer */}
                                                <div
                                                    className="absolute inset-0 -translate-x-full group-hover:translate-x-full"
                                                    style={{
                                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                                                        transition: 'transform 0.6s ease',
                                                        transform: 'skewX(-15deg)',
                                                    }}
                                                />
                                                <div
                                                    className="absolute right-0 top-0 w-[120px] h-[120px] rounded-full -translate-y-1/3 translate-x-1/3 group-hover:scale-125 transition-transform duration-500"
                                                    style={{ background: 'rgba(255,255,255,0.08)' }}
                                                />
                                                <div className="relative z-10 flex items-center justify-between px-7 h-full">
                                                    <div className="flex items-center gap-5">
                                                        <div
                                                            className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
                                                            style={{ background: 'rgb(255 255 255 / 0.15)', border: '1px solid rgb(255 255 255 / 0.25)' }}
                                                        >
                                                            <Palette className="w-7 h-7 text-white" />
                                                        </div>
                                                        <div className="text-left">
                                                            <span className="block text-[18px] font-black text-white uppercase tracking-wider leading-tight">Diseño e Ingeniería</span>
                                                            <span className="block text-[8px] font-bold text-white/70 uppercase tracking-[0.4em] mt-1">Design & Engineering</span>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="w-10 h-10 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform"
                                                        style={{ background: 'rgb(255 255 255 / 0.12)', border: '1px solid rgb(255 255 255 / 0.2)' }}
                                                    >
                                                        <ChevronRight className="w-5 h-5 text-white" />
                                                    </div>
                                                </div>
                                            </button>
                                        </SecureWrapper>

                                        {/* Monitoring */}
                                        <button
                                            onClick={() => onMonitoring()}
                                            className="group relative w-full h-[104px] overflow-hidden rounded-[1.5rem] transition-all duration-400 active:scale-[0.98]"
                                            style={{
                                                background: 'linear-gradient(135deg, rgb(var(--color-secondary)), rgb(var(--color-secondary) / 0.8))',
                                                border: '1px solid rgb(var(--color-secondary) / 0.5)',
                                                boxShadow: '0 10px 40px -10px rgb(var(--color-secondary) / 0.3)',
                                                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.boxShadow = '0 15px 50px -10px rgb(var(--color-secondary) / 0.5)';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.boxShadow = '0 10px 40px -10px rgb(var(--color-secondary) / 0.3)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <div
                                                className="absolute inset-0 -translate-x-full group-hover:translate-x-full"
                                                style={{
                                                    background: 'linear-gradient(90deg, transparent, rgb(255 255 255 / 0.15), transparent)',
                                                    transition: 'transform 0.6s ease',
                                                    transform: 'skewX(-15deg)',
                                                }}
                                            />
                                            <div
                                                className="absolute left-0 bottom-0 w-[120px] h-[120px] rounded-full translate-y-1/3 -translate-x-1/3 group-hover:scale-125 transition-transform duration-500"
                                                style={{ background: 'rgb(255 255 255 / 0.08)' }}
                                            />
                                            <div className="relative z-10 flex items-center justify-between px-7 h-full">
                                                <div className="flex items-center gap-5">
                                                    <div
                                                        className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300"
                                                        style={{ background: 'rgb(255 255 255 / 0.15)', border: '1px solid rgb(255 255 255 / 0.25)' }}
                                                    >
                                                        <Activity className="w-7 h-7 text-white" />
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="block text-[18px] font-black text-white uppercase tracking-wider leading-tight">Centro de Control</span>
                                                        <span className="block text-[8px] font-bold text-white/70 uppercase tracking-[0.4em] mt-1">Monitoring & Operations</span>
                                                    </div>
                                                </div>
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                                                    style={{ background: 'rgb(255 255 255 / 0.12)', border: '1px solid rgb(255 255 255 / 0.2)' }}
                                                >
                                                    <ArrowUpRight className="w-5 h-5 text-white" />
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-7 animate-fadeIn">
                                        {/* Back button */}
                                        <button
                                            onClick={() => { setIsStartingNew(false); setMenuLevel('main'); }}
                                            className="flex items-center gap-2 transition-colors group"
                                            style={{ color: 'rgba(var(--color-primary), 0.6)' }}
                                            onMouseEnter={e => (e.currentTarget.style.color = 'rgb(var(--color-primary))')}
                                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(var(--color-primary), 0.6)')}
                                        >
                                            <ChevronRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Menú Principal</span>
                                        </button>

                                        {/* Design section */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2.5 px-1">
                                                <div className="w-1 h-3 rounded-full" style={{ background: 'rgba(var(--color-primary), 0.4)' }} />
                                                <h4
                                                    className="text-[9px] font-black uppercase tracking-[0.4em]"
                                                    style={{ color: 'rgba(var(--color-text-main), 0.35)' }}
                                                >
                                                    Diseño e Ingeniería
                                                </h4>
                                            </div>

                                            {!isStartingNew ? (
                                                <div className="space-y-3">
                                                    {/* New project */}
                                                    <button
                                                        onClick={() => setIsStartingNew(true)}
                                                        className="group relative w-full h-[72px] overflow-hidden rounded-2xl active:scale-[0.98] transition-all"
                                                        style={{
                                                            background: 'rgb(var(--color-primary))',
                                                            border: '0.5px solid rgba(var(--color-primary), 0.5)',
                                                            boxShadow: '0 4px 20px rgba(var(--color-primary), 0.2)',
                                                            transition: 'all 0.3s ease',
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(var(--color-primary), 0.4)')}
                                                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--color-primary), 0.2)')}
                                                    >
                                                        <div
                                                            className="absolute inset-0 opacity-0 group-hover:opacity-100"
                                                            style={{
                                                                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
                                                                transform: 'skewX(-15deg) translateX(-100%)',
                                                                transition: 'transform 0.5s ease, opacity 0s',
                                                                animation: 'lp-shimmer 2s infinite',
                                                            }}
                                                        />
                                                        <div className="relative z-10 flex items-center justify-between px-6 h-full">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                    <Zap className="w-5 h-5 text-white" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <span className="block text-[13px] font-black text-white uppercase tracking-wider">Nuevo Proyecto</span>
                                                                    <span className="block text-[7px] text-white/50 uppercase tracking-[0.3em] mt-0.5 font-bold">Start Engineering</span>
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                                                        </div>
                                                    </button>

                                                    {/* Import grid */}
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <button
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="group flex flex-col items-center justify-center gap-1.5 h-[60px] rounded-2xl transition-all"
                                                            style={{
                                                                background: 'linear-gradient(135deg, rgba(var(--color-primary), 0.08), rgba(var(--color-primary), 0.02))',
                                                                border: '1px solid rgba(var(--color-primary), 0.15)',
                                                                boxShadow: '0 4px 12px rgba(var(--color-primary), 0.05)',
                                                            }}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-primary), 0.15), rgba(var(--color-primary), 0.05))';
                                                                e.currentTarget.style.borderColor = 'rgba(var(--color-primary), 0.3)';
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-primary), 0.08), rgba(var(--color-primary), 0.02))';
                                                                e.currentTarget.style.borderColor = 'rgba(var(--color-primary), 0.15)';
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            <UploadIcon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                                            <span className="text-[7px] font-black text-primary/80 group-hover:text-primary uppercase tracking-widest leading-none">Importar JSON</span>
                                                        </button>

                                                        <button
                                                            onClick={handleLoadMaster}
                                                            disabled={batchView === 'loading'}
                                                            className="group flex flex-col items-center justify-center gap-1.5 h-[60px] rounded-2xl transition-all"
                                                            style={{
                                                                background: 'linear-gradient(135deg, rgba(var(--color-secondary), 0.1), rgba(var(--color-secondary), 0.03))',
                                                                border: '1px solid rgba(var(--color-secondary), 0.2)',
                                                                boxShadow: '0 4px 12px rgba(var(--color-secondary), 0.05)',
                                                            }}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-secondary), 0.18), rgba(var(--color-secondary), 0.08))';
                                                                e.currentTarget.style.borderColor = 'rgba(var(--color-secondary), 0.4)';
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-secondary), 0.1), rgba(var(--color-secondary), 0.03))';
                                                                e.currentTarget.style.borderColor = 'rgba(var(--color-secondary), 0.2)';
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            {batchView === 'loading'
                                                                ? <RefreshCw className="w-4 h-4 text-secondary animate-spin" />
                                                                : <Database className="w-4 h-4 text-secondary group-hover:scale-110 transition-transform" />}
                                                            <span className="text-[7px] font-black text-secondary group-hover:text-secondary uppercase tracking-widest leading-none text-center">BD ALS Master</span>
                                                        </button>

                                                        <button
                                                            onClick={() => batchFileRef.current?.click()}
                                                            disabled={batchView === 'loading'}
                                                            className="group flex flex-col items-center justify-center gap-1.5 h-[60px] rounded-2xl transition-all"
                                                            style={{
                                                                background: 'linear-gradient(135deg, rgba(var(--color-accent), 0.08), rgba(var(--color-accent), 0.02))',
                                                                border: '1px solid rgba(var(--color-accent), 0.15)',
                                                                boxShadow: '0 4px 12px rgba(var(--color-accent), 0.05)',
                                                            }}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-accent), 0.15), rgba(var(--color-accent), 0.05))';
                                                                e.currentTarget.style.borderColor = 'rgba(var(--color-accent), 0.3)';
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-accent), 0.08), rgba(var(--color-accent), 0.02))';
                                                                e.currentTarget.style.borderColor = 'rgba(var(--color-accent), 0.15)';
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            <UploadIcon className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                                                            <span className="text-[7px] font-black text-accent group-hover:text-accent uppercase tracking-widest leading-none text-center">Excel Pozos</span>
                                                            <input ref={batchFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                                                                onChange={e => { const f = e.target.files?.[0]; if (f) handleBatchFile(f); e.target.value = ''; }} />
                                                        </button>
                                                    </div>

                                                    {/* Progress bar — loading state */}
                                                    {batchView === 'loading' && (
                                                        <div
                                                            className="rounded-2xl p-5 flex flex-col items-center justify-center gap-4 animate-fadeIn"
                                                            style={{
                                                                background: 'rgba(var(--color-canvas), 0.5)',
                                                                border: '0.5px solid rgba(var(--color-primary), 0.12)',
                                                                backdropFilter: 'blur(12px)',
                                                            }}
                                                        >
                                                            <RefreshCw className="w-7 h-7 text-primary animate-spin" />
                                                            <span
                                                                className="text-[9px] font-black uppercase tracking-widest"
                                                                style={{ color: 'rgb(var(--color-primary))' }}
                                                            >
                                                                Procesando base de datos...
                                                            </span>
                                                            <div
                                                                className="w-full h-1.5 rounded-full overflow-hidden"
                                                                style={{ background: 'rgba(var(--color-primary), 0.08)' }}
                                                            >
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-300"
                                                                    style={{
                                                                        width: `${batchProgress}%`,
                                                                        background: 'rgb(var(--color-primary))',
                                                                        boxShadow: '0 0 8px rgba(var(--color-primary), 0.6)',
                                                                    }}
                                                                />
                                                            </div>
                                                            <span
                                                                className="text-[8px] font-mono"
                                                                style={{ color: 'rgba(var(--color-primary), 0.4)' }}
                                                            >
                                                                {batchProgress}% — Por favor espere
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Well list */}
                                                    {batchView === 'list' && (
                                                        <div
                                                            className="rounded-2xl overflow-hidden animate-fadeIn"
                                                            style={{
                                                                background: 'rgba(var(--color-canvas), 0.6)',
                                                                border: '0.5px solid rgba(var(--color-primary), 0.12)',
                                                                backdropFilter: 'blur(16px)',
                                                            }}
                                                        >
                                                            {/* List header */}
                                                            <div
                                                                className="flex items-center gap-2 px-3 py-2.5"
                                                                style={{ borderBottom: '0.5px solid rgba(var(--color-primary), 0.06)', background: 'rgba(var(--color-primary), 0.03)' }}
                                                            >
                                                                <div className="relative flex-1">
                                                                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'rgba(var(--color-primary), 0.3)' }} />
                                                                    <input
                                                                        type="text"
                                                                        value={batchSearch}
                                                                        onChange={e => setBatchSearch(e.target.value)}
                                                                        placeholder="Buscar diseño, pozo..."
                                                                        className="w-full bg-transparent text-[9px] font-black pl-6 pr-2 py-1 outline-none"
                                                                        style={{ color: 'rgb(var(--color-text-main))' }}
                                                                    />
                                                                </div>
                                                                <span
                                                                    className="text-[7px] font-black uppercase tracking-wider shrink-0"
                                                                    style={{ color: 'rgba(var(--color-primary), 0.25)' }}
                                                                >
                                                                    {batchFile}
                                                                </span>
                                                                <button
                                                                    onClick={() => { setBatchView('idle'); setBatchDesigns([]); setBatchSelected(null); }}
                                                                    className="p-1 rounded-lg transition-all hover:bg-white/10"
                                                                >
                                                                    <X className="w-3 h-3" style={{ color: 'rgba(var(--color-primary), 0.4)' }} />
                                                                </button>
                                                            </div>

                                                            {/* Items */}
                                                            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                                {batchDesigns
                                                                    .filter(row => {
                                                                        if (!batchSearch) return true;
                                                                        const q = batchSearch.toLowerCase();
                                                                        return [
                                                                            _s(_get(row, ['POZO'])),
                                                                            _s(_get(row, ['CAMPO']))
                                                                        ].some(v => v.toLowerCase().includes(q));
                                                                    })
                                                                    .map((row, i) => {
                                                                        const dNum = _s(_get(row, ['DISEÑO #', 'DISENO #'])) || `#${i + 1}`;
                                                                        const well = _s(_get(row, ['POZO']));
                                                                        const campo = _s(_get(row, ['CAMPO']));
                                                                        const idPz = _s(_get(row, ['ID POZO-FECHA']));
                                                                        const pSt = _n(_get(row, ['P ESTATICA (PSI)', 'P ESTATICA']));
                                                                        const pip = _n(_get(row, ['PIP MINIMA (PSI)', 'PIP MINIMA']));
                                                                        const ip = _n(_get(row, ['IP (BFPD/PSI)']));
                                                                        const rate = Math.max(0, ip * Math.max(0, pSt - pip));
                                                                        const hasSvy = _findSurvey(well, batchSurveys).length > 0;
                                                                        const rowKey = `${dNum}-${well}-${i}`;
                                                                        const chosen = batchSelected === rowKey;
                                                                        return (
                                                                            <button
                                                                                key={rowKey}
                                                                                disabled={!!batchSelected}
                                                                                onClick={() => {
                                                                                    setBatchSelected(rowKey);
                                                                                    try {
                                                                                        const p = _rowToParams(row, batchSurveys);
                                                                                        setTimeout(() => { onQuickImport(p); }, 400);
                                                                                    } catch (e) { setBatchSelected(null); }
                                                                                }}
                                                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${chosen ? '' : 'hover:bg-white/4'}`}
                                                                                style={chosen ? { background: 'rgba(var(--color-primary), 0.08)' } : {}}
                                                                            >
                                                                                <div
                                                                                    className="text-[9px] font-black font-mono w-8 shrink-0"
                                                                                    style={{ color: chosen ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.3)' }}
                                                                                >
                                                                                    {dNum}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div
                                                                                        className="text-[9px] font-black uppercase truncate"
                                                                                        style={{ color: chosen ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-main))' }}
                                                                                    >
                                                                                        {well || '—'}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span
                                                                                            className="text-[7px] font-bold uppercase"
                                                                                            style={{ color: 'rgba(var(--color-text-main), 0.3)' }}
                                                                                        >
                                                                                            {campo}
                                                                                        </span>
                                                                                        {hasSvy && (
                                                                                            <span
                                                                                                className="text-[6px] font-black rounded px-1"
                                                                                                style={{
                                                                                                    color: 'rgba(var(--color-secondary), 0.6)',
                                                                                                    border: '0.5px solid rgba(var(--color-secondary), 0.2)',
                                                                                                }}
                                                                                            >
                                                                                                SVY
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right shrink-0">
                                                                                    <div
                                                                                        className="text-[8px] font-black font-mono"
                                                                                        style={{ color: rate > 0 ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.2)' }}
                                                                                    >
                                                                                        {rate > 0 ? `${rate.toFixed(0)} BPD` : '—'}
                                                                                    </div>
                                                                                    <div
                                                                                        className="text-[7px] font-mono"
                                                                                        style={{ color: 'rgba(var(--color-primary), 0.25)' }}
                                                                                    >
                                                                                        {idPz}
                                                                                    </div>
                                                                                </div>
                                                                                {chosen
                                                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                                                                    : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-15" style={{ color: 'rgb(var(--color-primary))' }} />}
                                                                            </button>
                                                                        );
                                                                    })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                /* New project form */
                                                <div
                                                    className="space-y-4 p-5 rounded-3xl animate-fadeIn"
                                                    style={{
                                                        background: 'rgba(var(--color-primary), 0.03)',
                                                        border: '0.5px solid rgba(var(--color-primary), 0.12)',
                                                    }}
                                                >
                                                    <div className="space-y-1.5">
                                                        <label
                                                            className="text-[8px] font-black uppercase tracking-widest ml-1"
                                                            style={{ color: 'rgb(var(--color-primary))' }}
                                                        >
                                                            {t('lp.identifier')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={params.metadata.projectName}
                                                            onChange={e => setParams({ ...params, metadata: { ...params.metadata, projectName: e.target.value } })}
                                                            className="w-full text-txt-main font-bold text-lg rounded-xl py-4 px-5 outline-none uppercase transition-all"
                                                            style={{
                                                                background: 'rgba(var(--color-canvas), 0.8)',
                                                                border: '0.5px solid rgba(var(--color-primary), 0.1)',
                                                            }}
                                                            placeholder="Pozo / Proyecto"
                                                            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(var(--color-primary), 0.4)')}
                                                            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(var(--color-primary), 0.1)')}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <label
                                                                className="text-[8px] font-black uppercase tracking-widest ml-1"
                                                                style={{ color: 'rgba(var(--color-primary), 0.4)' }}
                                                            >
                                                                Ingeniero
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={params.metadata.engineer}
                                                                onChange={e => setParams({ ...params, metadata: { ...params.metadata, engineer: e.target.value } })}
                                                                className="w-full text-txt-main font-bold text-xs rounded-xl py-3 px-4 outline-none transition-all"
                                                                style={{
                                                                    background: 'rgba(var(--color-canvas), 0.8)',
                                                                    border: '0.5px solid rgba(var(--color-primary), 0.08)',
                                                                }}
                                                                placeholder="Responsable"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label
                                                                className="text-[8px] font-black uppercase tracking-widest ml-1"
                                                                style={{ color: 'rgba(var(--color-primary), 0.4)' }}
                                                            >
                                                                Compañía
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={params.metadata.company}
                                                                onChange={e => setParams({ ...params, metadata: { ...params.metadata, company: e.target.value } })}
                                                                className="w-full text-txt-main font-bold text-xs rounded-xl py-3 px-4 outline-none transition-all"
                                                                style={{
                                                                    background: 'rgba(var(--color-canvas), 0.8)',
                                                                    border: '0.5px solid rgba(var(--color-primary), 0.08)',
                                                                }}
                                                                placeholder="Empresa"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={() => setIsStartingNew(false)}
                                                            className="flex-1 py-3.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                                                            style={{
                                                                background: 'rgba(var(--color-primary), 0.06)',
                                                                color: 'rgba(var(--color-primary), 0.5)',
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--color-primary), 0.1)')}
                                                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(var(--color-primary), 0.06)')}
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={onStart}
                                                            className="flex-[2] py-3.5 text-[9px] font-black text-white uppercase tracking-widest rounded-xl transition-all"
                                                            style={{
                                                                background: 'rgb(var(--color-primary))',
                                                                boxShadow: '0 4px 20px rgba(var(--color-primary), 0.3)',
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
                                                            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
                                                        >
                                                            Iniciar Fase
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Tools section */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2.5 px-1">
                                                <div
                                                    className="w-1 h-3 rounded-full"
                                                    style={{ background: 'rgba(var(--color-text-main), 0.15)' }}
                                                />
                                                <h4
                                                    className="text-[9px] font-black uppercase tracking-[0.4em]"
                                                    style={{ color: 'rgba(var(--color-text-main), 0.3)' }}
                                                >
                                                    Herramientas
                                                </h4>
                                            </div>
                                            <button
                                                onClick={onCompare}
                                                className="group flex items-center justify-between w-full h-[60px] px-6 rounded-2xl transition-all"
                                                style={{
                                                    background: 'linear-gradient(135deg, rgba(var(--color-primary), 0.1), rgba(var(--color-secondary), 0.1))',
                                                    border: '1px solid rgba(var(--color-primary), 0.2)',
                                                    boxShadow: '0 4px 15px rgba(var(--color-primary), 0.1)',
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-primary), 0.15), rgba(var(--color-secondary), 0.15))';
                                                    e.currentTarget.style.borderColor = 'rgba(var(--color-primary), 0.4)';
                                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(var(--color-primary), 0.2)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(var(--color-primary), 0.1), rgba(var(--color-secondary), 0.1))';
                                                    e.currentTarget.style.borderColor = 'rgba(var(--color-primary), 0.2)';
                                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(var(--color-primary), 0.1)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                                                        style={{ background: 'rgba(var(--color-primary), 0.15)' }}
                                                    >
                                                        <GitCompareArrows className="w-5 h-5 text-primary group-hover:animate-pulse" />
                                                    </div>
                                                    <span
                                                        className="text-[11px] font-black uppercase tracking-[0.2em] transition-colors"
                                                        style={{ color: 'rgb(var(--color-text-main))' }}
                                                    >
                                                        Comparador de Desempeño
                                                    </span>
                                                </div>
                                                <ChevronRight
                                                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                                                    style={{ color: 'rgb(var(--color-primary))' }}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Hidden file input */}
            <input type="file" ref={fileInputRef} onChange={onImportFile} accept=".json,.xlsx" className="hidden" />

            {/* Footer */}
            <footer className="absolute bottom-6 left-8 z-40 flex items-center gap-5 opacity-30 hover:opacity-70 transition-all duration-500">
                <div
                    className="h-px w-10 rounded-full"
                    style={{ background: 'rgb(var(--color-primary))' }}
                />
                <div className="flex flex-col">
                    <span
                        className="text-[8px] font-black uppercase tracking-[0.5em]"
                        style={{ color: 'rgb(var(--color-primary))' }}
                    >
                        Status: ALS FRONTERA ACTIVE
                    </span>
                    <span
                        className="text-[7px] font-bold uppercase tracking-[0.2em] mt-0.5"
                        style={{ color: 'rgba(var(--color-text-main), 0.4)' }}
                    >
                        EDS DESIGN STUDIO © 2026 | LENIN PEÑA & ANDRE JIMENEZ.
                    </span>
                </div>
            </footer>

            {/* ── ALL KEYFRAMES ── */}
            <style>{`
                @keyframes lp-particle-rise {
                    0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
                    6%   { opacity: var(--op, 0.4); }
                    94%  { opacity: calc(var(--op, 0.4) * 0.4); }
                    100% { transform: translateY(-90vh) translateX(var(--drift, 0px)) scale(0.3); opacity: 0; }
                }
                @keyframes lp-card-glow {
                    0%   { opacity: 0.3; transform: scale(0.98); }
                    100% { opacity: 0.6; transform: scale(1.02); }
                }
                @keyframes lp-shimmer {
                    0%   { transform: skewX(-15deg) translateX(-100%); }
                    100% { transform: skewX(-15deg) translateX(300%); }
                }
                @keyframes gradient-x {
                    0%, 100% { background-position: 0% 50%; }
                    50%       { background-position: 100% 50%; }
                }
                @keyframes scan {
                    from { background-position: 0 0; }
                    to   { background-position: 0 80px; }
                }
                .animate-scan { animation: scan 6s linear infinite; }

                @keyframes landing-entry {
                    0%   { opacity: 0; filter: blur(16px); transform: scale(0.97); }
                    40%  { filter: blur(4px); }
                    100% { opacity: 1; filter: blur(0); transform: scale(1); }
                }
                .animate-landing-entry { animation: landing-entry 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }

                @keyframes fadeInLeft {
                    from { opacity: 0; transform: translateX(-30px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .animate-fadeInLeft { animation: fadeInLeft 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }

                @keyframes fadeInRight {
                    from { opacity: 0; transform: translateX(30px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .animate-fadeInRight { animation: fadeInRight 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }

                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.35; }
                    50%       { opacity: 0.65; }
                }
                .animate-pulse-slow { animation: pulse-slow 7s ease-in-out infinite; }
                .animate-spin-slow  { animation: spin 4s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .glass-surface-light {
                    background: rgba(var(--color-surface-rgb), 0.3);
                    backdrop-filter: blur(12px);
                }
                .hover\\:bg-white\\/4:hover { background: rgba(255,255,255,0.04); }
                .hover\\:bg-white\\/8:hover { background: rgba(255,255,255,0.08); }
            `}</style>
        </div>
    );
};