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
    // Pass 1: exact normalized match (prevents false positives like IPMIN matching PIPMINIMA)
    for (const k of Object.keys(row)) {
        const n = _norm(k);
        if (nk.some(nk2 => n === nk2)) return row[k];
    }
    // Pass 2: substring containment — only for longer search keys (≥8 chars) to avoid collisions
    for (const k of Object.keys(row)) {
        const n = _norm(k);
        if (nk.some(nk2 => nk2.length >= 8 && n.includes(nk2))) return row[k];
    }
    return null;
};
const _pipe = (cat: any[], od: number, fb: number): PipeData => { const s = cat.find(c => Math.abs(c.od - od) < 0.05) || cat.find(c => Math.abs(c.od - fb) < 0.05) || cat[0]; return { description: s?.description || '', od: s?.od || fb, id: s?.id || fb * 0.8, weight: s?.weight || 30, roughness: s?.roughness || 0.0006 }; };

// Fuzzy survey finder: Design sheet may have "WELL-A #3" while Survey sheet has "WELL-A".
// Uses normalized string containment so special chars / accents don’t block the match.
const _findSurvey = (wellName: string, surveys: Record<string, SurveyPoint[]>): SurveyPoint[] => {
    if (!wellName) return [];
    // 1. Exact match
    if (surveys[wellName]?.length) return surveys[wellName];
    // 2. Normalize both sides and try exact
    const nWell = _norm(wellName);
    for (const key of Object.keys(surveys)) {
        if (!surveys[key]?.length) continue;
        const nKey = _norm(key);
        // Exact normalized match
        if (nKey === nWell) return surveys[key];
        // Containment: one is substring of the other (normalized)
        if (nWell.includes(nKey) || nKey.includes(nWell)) return surveys[key];
    }
    return [];
};

// Extract the base well name by stripping common run/suffix patterns (" #3", " RUN3", "_V2"...)
const _baseWell = (name: string) =>
    name.replace(/#\d+/gi, '').replace(/\brun\s*\d+/gi, '').replace(/[_\-\s]+\d+$/, '').trim();


const _rowToParams = (row: Record<string, any>, surveys: Record<string, SurveyPoint[]>): SystemParams => {
    const g = (k: string[]) => _get(row, k);
    const well = _s(g(['POZO'])); const pSt = _n(g(['P ESTATICA (PSI)', 'P ESTATICA', 'PESTATICA'])); const pip = _n(g(['PIP MINIMA (PSI)', 'PIP MINIMA']));
    // IP / BSW / GOR — three scenarios
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
        survey: _findSurvey(well, surveys), motorHp: 0, simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0.12 },
        // Equipment Auto-Filling
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

        // ── ALL heavy work runs on a background Web Worker thread ──
        // The main UI thread is NEVER blocked, so the browser stays fully responsive.
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

        // Transfer the ArrayBuffer to the worker (zero-copy, instant)
        file.arrayBuffer().then(buffer => {
            worker.postMessage({ buffer }, [buffer]);
        });

    }, [setBatchView, setBatchDesigns, setBatchSurveys, setBatchFile]);

    const [isBooting, setIsBooting] = useState(true);
    const [bootStep, setBootStep] = useState(0);

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
        "INITIALIZING CORE.V26...",
        "LOADING NEURAL NETWORKS...",
        "SYNCING WELL DATA...",
        "ENCRYPTING PROTOCOLS...",
        "SYSTEM READY."
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

    useEffect(() => {
        if (isBooting) {
            const interval = setInterval(() => {
                setBootStep(prev => {
                    if (prev < bootLogs.length - 1) return prev + 1;
                    clearInterval(interval);
                    return prev;
                });
            }, 280);

            const timer = setTimeout(() => {
                setIsBooting(false);
            }, 2000);

            return () => {
                clearInterval(interval);
                clearTimeout(timer);
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
        const progress = (bootStep + 1) * 20;
        const logoSize = 360; // Protagonismo colosal
        const cx = logoSize / 2; // 180

        // Burst particles — deterministas (sin Math.random)
        const burstParticles = Array.from({ length: 48 }).map((_, i) => {
            const angle = (i / 48) * 360;
            const distance = 280 + Math.sin(i * 0.9) * 90 + Math.cos(i * 1.5) * 55;
            return {
                angle,
                distance,
                size: 2 + (i % 3),
                delay: (i % 8) * 0.035,
                duration: 0.75 + (i % 5) * 0.09,
                isWhite: i % 5 === 0,
            };
        });

        // ── RUTAS DE CIRCUITO IMPRESO (PCB FUTURISTA) ──
        const pcbBasePaths = [
            // Left buses
            [[0, 15], [15, 15], [25, 25], [35, 25]],
            [[0, 35], [10, 35], [20, 45], [25, 45]],
            [[0, 50], [5, 50], [15, 60], [25, 60]],
            [[0, 75], [15, 75], [25, 65], [35, 65]],

            // Right buses
            [[100, 15], [85, 15], [75, 25], [65, 25]],
            [[100, 35], [90, 35], [80, 45], [75, 45]],
            [[100, 50], [95, 50], [85, 60], [75, 60]],
            [[100, 75], [85, 75], [75, 65], [65, 65]],

            // Top buses
            [[15, 0], [15, 15], [20, 20], [30, 20]],
            [[35, 0], [35, 10], [45, 20], [50, 20]],
            [[65, 0], [65, 10], [55, 20], [50, 20]],
            [[85, 0], [85, 15], [80, 20], [70, 20]],

            // Bottom buses
            [[15, 100], [15, 85], [20, 80], [30, 80]],
            [[35, 100], [35, 90], [45, 80], [50, 80]],
            [[65, 100], [65, 90], [55, 80], [50, 80]],
            [[85, 100], [85, 85], [80, 80], [70, 80]],

            // Interconnects Details (Mid range)
            [[25, 25], [30, 30], [30, 40], [35, 45]],
            [[75, 25], [70, 30], [70, 40], [65, 45]],
            [[25, 75], [30, 70], [30, 60], [35, 55]],
            [[75, 75], [70, 70], [70, 60], [65, 55]],

            // Core ring connections
            [[35, 25], [40, 30], [40, 40], [45, 45]],
            [[65, 25], [60, 30], [60, 40], [55, 45]],
            [[35, 65], [40, 60], [40, 50], [45, 45]],
            [[65, 65], [60, 60], [60, 50], [55, 45]],
        ];

        const pcbTraces: any[] = [];
        const pcbVias: any[] = [];

        pcbBasePaths.forEach((path, i) => {
            const count = 2 + (i % 4); // 2 to 5 parallel tracks to maintain high density but better performance

            // Efectos eléctricos sincronizados 100% con los tokens del tema activo
            let colorRGB = 'var(--color-primary)';
            if (i % 3 === 1) colorRGB = 'var(--color-secondary)';
            if (i % 3 === 2) colorRGB = 'var(--color-accent)';

            for (let c = 0; c < count; c++) {
                const offset = c * 0.35; // Tighter grouping for thinner lines
                const newPath = path.map(pt => [pt[0] + offset, pt[1] + offset]);

                pcbTraces.push({
                    pts: newPath,
                    id: `${i}-${c}`,
                    delay: (i * 0.15) % 3,
                    dur: 1.5 + (i % 3) * 0.5,
                    isPrimary: c === 0 || c === Math.floor(count / 2),
                    colorRGB
                });

                // add vias
                if (c === 0 || count <= 2 || c === count - 1) {
                    pcbVias.push({ x: newPath[0][0], y: newPath[0][1], big: c === 0, delay: (i * 0.1) % 2, colorRGB });
                    pcbVias.push({ x: newPath[newPath.length - 1][0], y: newPath[newPath.length - 1][1], big: false, delay: (i * 0.1) % 2, colorRGB });
                }
            }
        });

        const toPathStr = (pts: number[][]) =>
            pts.map((p, ix) => `${ix === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

        const pathLength = (pts: number[][]) =>
            pts.slice(1).reduce((acc, p, ix) => {
                const dx = p[0] - pts[ix][0], dy = p[1] - pts[ix][1];
                return acc + Math.sqrt(dx * dx + dy * dy);
            }, 0);

        return (
            <div
                className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden font-mono"
                style={{ background: 'rgb(var(--color-canvas))' }}
            >
                <style>{`
                    @keyframes eks-fade-out {
                        0%   { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    @keyframes eks-logo-in {
                        0%   { opacity: 0; filter: brightness(22) blur(40px) saturate(4); transform: scale(3.5); }
                        30%  { opacity: 1; filter: brightness(5) blur(4px);  transform: scale(1.08); }
                        100% { opacity: 1; filter: brightness(1.2) blur(0) drop-shadow(0 0 70px rgb(var(--color-primary) / 1)); transform: scale(1); }
                    }
                    @keyframes eks-logo-halo {
                        0%, 100% { transform: scale(1);    opacity: 0.55; }
                        50%      { transform: scale(1.14); opacity: 1;    }
                    }
                    @keyframes eks-shockwave {
                        0%   { transform: scale(0.01); opacity: 1; }
                        100% { transform: scale(50);   opacity: 0; }
                    }
                    @keyframes eks-burst {
                        0%   { transform: rotate(var(--ba)) translateY(0);         opacity: 1; }
                        65%  { opacity: 0.9; }
                        100% { transform: rotate(var(--ba)) translateY(var(--bd)); opacity: 0; }
                    }
                    @keyframes eks-sweep {
                        0%   { top: -4px; opacity: 0; }
                        5%   { opacity: 1; }
                        92%  { opacity: 0.6; }
                        100% { top: 100%;  opacity: 0; }
                    }
                    @keyframes eks-ring-cw  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
                    @keyframes eks-ring-ccw { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
                    @keyframes eks-ring-in  { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes eks-blink    { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                    @keyframes eks-term-in  { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes eks-glitch {
                        0%, 86%, 100% { clip-path: none; transform: skewX(0); }
                        88% { clip-path: inset(10% 0 74% 0); transform: skewX(-6deg); }
                        90% { clip-path: inset(55% 0 20% 0); transform: skewX(5deg); }
                        92% { clip-path: none; transform: skewX(0); }
                    }
                    @keyframes eks-ping {
                        0%   { transform: scale(1);   opacity: 0.8; }
                        100% { transform: scale(3.2); opacity: 0;   }
                    }
                    @keyframes eks-neural-in {
                        from { opacity: 0; }
                        to   { opacity: 1; }
                    }
                    @keyframes neural-fall {
                        0%   { transform: translateY(-5%) scale(0.8); opacity: 0; }
                        15%  { opacity: 0.7; }
                        85%  { opacity: 0.3; }
                        100% { transform: translateY(108%) scale(1);  opacity: 0; }
                    }
                `}</style>

                {/* ── THEME CONTROLS ── */}
                <div className="absolute top-8 right-8 z-50 flex gap-4 items-center bg-canvas/40 p-2 rounded-2xl border border-white/5 backdrop-blur-xl shadow-2xl">
                    <button onClick={toggleLanguage} className="h-10 px-4 flex items-center gap-3 rounded-xl hover:bg-white/5 transition-all group">
                        <Globe className="w-4 h-4 text-primary group-hover:rotate-180 transition-transform duration-700" />
                        <span className="text-[10px] font-black text-white tracking-widest uppercase font-mono">{language}</span>
                    </button>
                    <div className="w-[1px] h-6 bg-white/10" />
                    <button onClick={cycleTheme} className="h-10 px-4 flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group">
                        <Palette className="w-4 h-4 text-primary animate-pulse-subtle" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono text-primary">{theme}</span>
                    </button>
                </div>

                {/* ── LIMPIEZA / ENTRADA SUAVE (FADE-IN DESDE CANVAS) ── */}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none',
                    background: 'rgb(var(--color-canvas))',
                    animation: 'eks-fade-out 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
                }} />

                {/* ── FONDOS: grid + scanlines + viñeta dinámicos ── */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.15,
                    backgroundImage: 'linear-gradient(rgb(var(--color-text-main) / 0.15) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--color-text-main) / 0.15) 1px,transparent 1px)',
                    backgroundSize: '30px 30px'
                }} />
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgb(var(--color-text-main) / 0.04) 2px,rgb(var(--color-text-main) / 0.04) 4px)'
                }} />
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse at center, transparent 28%, rgb(var(--color-canvas) / 0.94) 100%)'
                }} />

                {/* ── BARRIDO ── */}
                <div style={{
                    position: 'absolute', left: 0, right: 0, height: '2px', zIndex: 30, pointerEvents: 'none',
                    background: 'linear-gradient(90deg,transparent,rgba(var(--color-primary),0.55),white,rgba(var(--color-primary),0.55),transparent)',
                    boxShadow: '0 0 24px 12px rgba(var(--color-primary),0.4)',
                    animation: 'eks-sweep 2.8s ease-in 0.3s forwards',
                }} />

                {/* ══════════════════════════════════════════════════════
                    RED NEURONAL — SVG full-screen, capa de fondo
                ══════════════════════════════════════════════════════ */}
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        zIndex: 4, pointerEvents: 'none',
                        animation: 'eks-neural-in 0.9s ease-out 0.4s both',
                        filter: 'drop-shadow(0px 0px 4px rgba(var(--color-primary), 0.5))' // HW Accelerated CSS shadow instead of heavy SVG filter
                    }}
                >
                    {/* Trazados Base (Track lines) superfinos con colores eléctricos */}
                    {pcbTraces.map((t, i) => (
                        <path
                            key={`base-${i}`}
                            d={toPathStr(t.pts)}
                            fill="none"
                            stroke={`rgb(${t.colorRGB} / ${t.isPrimary ? 0.75 : 0.35})`}
                            strokeWidth={t.isPrimary ? "0.12" : "0.05"}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ))}

                    {/* Vías / Pads miniaturizadas (Conectores de alta precisión) */}
                    {pcbVias.map((v, i) => (
                        <g key={`via-${i}`}>
                            <circle cx={v.x} cy={v.y} r={v.big ? 0.35 : 0.2} fill={`rgb(${v.colorRGB} / 0.95)`} />
                            <circle cx={v.x} cy={v.y} r={v.big ? 0.15 : 0.08} fill="white" />
                            {v.big && (
                                <circle cx={v.x} cy={v.y} r={0.8} fill="none" stroke={`rgb(${v.colorRGB} / 0.8)`} strokeWidth="0.08">
                                    <animate attributeName="r" values="0.35; 1.2; 0.35" dur="2s" begin={`${v.delay}s`} repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="1; 0; 1" dur="2s" begin={`${v.delay}s`} repeatCount="indefinite" />
                                </circle>
                            )}
                        </g>
                    ))}

                    {/* Data Pulses láser muy veloces, finos y eléctricos */}
                    {pcbTraces.filter(t => t.isPrimary).map((t, i) => {
                        const dStr = toPathStr(t.pts);
                        const len = pathLength(t.pts);
                        return (
                            <path
                                key={`pulse-${i}`}
                                d={dStr}
                                fill="none"
                                stroke={i % 3 === 0 ? "white" : `rgb(${t.colorRGB} / 1)`}
                                strokeWidth="0.22"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray={`${len * 0.08} ${len * 1.5}`}
                            >
                                <animate
                                    attributeName="stroke-dashoffset"
                                    from={len * 1.58} to={-len * 0.08}
                                    dur={`${t.dur}s`} begin={`${t.delay}s`} repeatCount="indefinite"
                                />
                                {/* Parpadeo eléctrico en los pulsos de datos */}
                                <animate
                                    attributeName="opacity"
                                    values="0.2; 1; 0.5; 1; 0"
                                    keyTimes="0; 0.1; 0.15; 0.2; 1"
                                    dur={`${t.dur}s`}
                                    begin={`${t.delay}s`}
                                    repeatCount="indefinite"
                                />
                            </path>
                        );
                    })}
                </svg>

                {/* Lluvia de bits 0/1 */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', overflow: 'hidden', fontFamily: 'monospace' }}>
                    {Array.from({ length: 60 }).map((_, i) => {
                        const x = (i * 1.67) % 100;
                        const sz = 7 + (i % 5) * 2;
                        const del = (i * 0.09) % 5;
                        const dur = 3.5 + (i % 4) * 1.2;
                        const al = 0.06 + (i % 4) * 0.07;
                        return (
                            <span key={i} style={{
                                position: 'absolute', left: `${x}%`, top: '-20px',
                                fontSize: `${sz}px`, fontWeight: 900,
                                color: `rgb(var(--color-primary) / ${al})`,
                                opacity: 0,
                                animation: `neural-fall ${dur}s linear infinite`,
                                animationDelay: `${del}s`,
                                textShadow: `0 0 8px rgb(var(--color-primary) / 0.3)`,
                            }}>
                                {i % 2 === 0 ? '1' : '0'}
                            </span>
                        );
                    })}
                </div>

                {/* ── SHOCKWAVES ── */}
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                        position: 'absolute', top: 'calc(50% - 80px)', left: '50%',
                        width: '12px', height: '12px', borderRadius: '50%',
                        marginTop: '-6px', marginLeft: '-6px',
                        border: `${2.8 - i * 0.4}px solid rgb(var(--color-primary) / ${0.92 - i * 0.1})`,
                        boxShadow: `0 0 ${18 + i * 6}px rgb(var(--color-primary) / 0.5)`,
                        transformOrigin: 'center center',
                        animation: `eks-shockwave ${1.0 + i * 0.12}s cubic-bezier(0.08,0.6,0.25,1) ${i * 0.1}s forwards`,
                        zIndex: 20, pointerEvents: 'none',
                    }} />
                ))}

                {/* ── PARTÍCULAS DE EXPLOSIÓN ── */}
                <div style={{
                    position: 'absolute', top: 'calc(50% - 80px)', left: '50%',
                    width: 0, height: 0, zIndex: 22, pointerEvents: 'none',
                }}>
                    {burstParticles.map((p, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50%',
                            top: `-${p.size / 2}px`, left: `-${p.size / 2}px`,
                            background: p.isWhite ? 'rgb(var(--color-text-main))' : 'rgb(var(--color-primary) / 1)',
                            boxShadow: p.isWhite
                                ? `0 0 ${p.size * 4}px rgb(var(--color-text-main))`
                                : `0 0 ${p.size * 3}px rgb(var(--color-primary) / 0.9)`,
                            ['--ba' as any]: `${p.angle}deg`,
                            ['--bd' as any]: `-${p.distance}px`,
                            animation: `eks-burst ${p.duration}s cubic-bezier(0.04,0,0.45,1) ${p.delay}s forwards`,
                        }} />
                    ))}
                </div>

                {/* ══════════════════════════════════════════════════════
                    LOGO — protagonista absoluto
                ══════════════════════════════════════════════════════ */}
                <div style={{
                    position: 'relative', zIndex: 70,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '44px',
                }}>
                    {/* Contenedor del logo */}
                    <div style={{ position: 'relative', width: `${logoSize}px`, height: `${logoSize}px` }}>

                        {/* Halos de resplandor */}
                        <div style={{
                            position: 'absolute', inset: '-55%', borderRadius: '50%',
                            background: 'rgb(var(--color-primary) / 0.16)',
                            filter: 'blur(75px)',
                            animation: 'eks-logo-halo 2.8s ease-in-out infinite 1.2s',
                        }} />
                        <div style={{
                            position: 'absolute', inset: '-22%', borderRadius: '50%',
                            background: 'rgb(var(--color-primary) / 0.12)',
                            filter: 'blur(38px)',
                            animation: 'eks-logo-halo 2.2s ease-in-out infinite 1.9s',
                        }} />

                        {/* Ping */}
                        <div style={{
                            position: 'absolute', inset: '-18%', borderRadius: '50%',
                            border: '1.5px solid rgb(var(--color-primary) / 0.6)',
                            animation: 'eks-ping 2.4s ease-out infinite 1.5s',
                        }} />

                        {/* Anillo exterior 520px — horario */}
                        <div style={{
                            position: 'absolute',
                            top: `${cx - 260}px`, left: `${cx - 260}px`,
                            width: '520px', height: '520px', borderRadius: '50%',
                            border: '1px solid rgb(var(--color-primary) / 0.15)',
                            animation: 'eks-ring-cw 22s linear infinite, eks-ring-in 0.7s ease-out 0.6s both',
                        }}>
                            <div style={{
                                position: 'absolute', top: '-6px', left: 'calc(50% - 6px)',
                                width: '12px', height: '12px', borderRadius: '50%',
                                background: 'rgb(var(--color-secondary) / 1)',
                                boxShadow: '0 0 18px 6px rgb(var(--color-secondary) / 0.8)',
                            }} />
                        </div>

                        {/* Anillo medio 420px — antihorario */}
                        <div style={{
                            position: 'absolute',
                            top: `${cx - 210}px`, left: `${cx - 210}px`,
                            width: '420px', height: '420px', borderRadius: '50%',
                            border: '1px solid rgb(var(--color-primary) / 0.28)',
                            animation: 'eks-ring-ccw 13s linear infinite, eks-ring-in 0.7s ease-out 0.75s both',
                        }}>
                            <div style={{
                                position: 'absolute', top: '-7px', left: 'calc(50% - 7px)',
                                width: '14px', height: '14px', borderRadius: '50%',
                                background: 'rgb(var(--color-primary) / 1)',
                                boxShadow: '0 0 22px 7px rgb(var(--color-primary) / 0.9)',
                            }} />
                        </div>

                        {/* Anillo interior 334px */}
                        <div style={{
                            position: 'absolute',
                            top: `${cx - 167}px`, left: `${cx - 167}px`,
                            width: '334px', height: '334px', borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.06)',
                            animation: 'eks-ring-cw 7s linear infinite, eks-ring-in 0.7s ease-out 0.9s both',
                        }} />

                        {/* LOGO */}
                        <img
                            src="/LOGO.png"
                            alt="EDS Core"
                            style={{
                                position: 'absolute', inset: 0,
                                width: '100%', height: '100%', objectFit: 'contain',
                                animation: 'eks-logo-in 0.85s cubic-bezier(0.16,1,0.3,1) 0.1s both',
                                filter: 'drop-shadow(0 0 65px rgb(var(--color-primary) / 0.95)) drop-shadow(0 0 140px rgb(var(--color-primary) / 0.4)) brightness(1.4)',
                                zIndex: 10,
                            }}
                        />
                    </div>

                    {/* ── TERMINAL + PROGRESO ── */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '18px', width: '460px',
                        animation: 'eks-term-in 0.5s ease-out 0.9s both',
                    }}>
                        {/* Log line con glitch */}
                        <div style={{
                            position: 'relative', width: '100%',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '15px 24px',
                            background: 'rgba(var(--color-primary),0.04)',
                            border: '1px solid rgba(var(--color-primary),0.22)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(20px)',
                            animation: 'eks-glitch 4.5s ease-in-out infinite',
                        }}>
                            {[
                                { top: 0, left: 0, borderTop: '2px solid', borderLeft: '2px solid' },
                                { top: 0, right: 0, borderTop: '2px solid', borderRight: '2px solid' },
                                { bottom: 0, left: 0, borderBottom: '2px solid', borderLeft: '2px solid' },
                                { bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' },
                            ].map((s, i) => (
                                <div key={i} style={{
                                    position: 'absolute', width: '12px', height: '12px',
                                    borderColor: 'rgba(var(--color-primary),0.7)', ...s,
                                }} />
                            ))}
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', fontWeight: 900 }}>&gt;</span>
                            <span style={{
                                flex: 1, textAlign: 'center',
                                fontSize: '11px', fontWeight: 900,
                                letterSpacing: '0.35em', textTransform: 'uppercase',
                                color: '#ffffff',
                                textShadow: '0 0 18px rgba(var(--color-primary),1), 0 0 40px rgba(var(--color-primary),0.6)',
                            }}>
                                {bootLogs[bootStep]}
                            </span>
                            <span style={{
                                display: 'inline-block', width: '8px', height: '14px',
                                background: 'rgba(var(--color-primary),0.9)',
                                boxShadow: '0 0 8px rgba(var(--color-primary),1)',
                                animation: 'eks-blink 0.5s infinite',
                            }} />
                        </div>

                        {/* Barra lineal + arco en fila */}
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '20px', padding: '0 4px' }}>
                            {/* Barra lineal */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{
                                    width: '100%', height: '2px', borderRadius: '2px',
                                    background: 'rgba(var(--color-primary),0.1)', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%', width: `${progress}%`,
                                        background: 'linear-gradient(90deg,rgba(var(--color-primary),0.4),rgba(var(--color-primary),1),white)',
                                        boxShadow: '0 0 18px rgba(var(--color-primary),0.8)',
                                        transition: 'width 0.7s ease-out', borderRadius: '2px',
                                    }} />
                                </div>
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    fontSize: '7px', fontWeight: 900, letterSpacing: '0.28em',
                                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
                                }}>
                                    <span>ESP_ENGINE_CORE</span>
                                    <span>V-26.BETA</span>
                                </div>
                            </div>

                            {/* Arco SVG circular */}
                            {(() => {
                                const sz = 72, sw = 3;
                                const r = (sz - sw * 2) / 2;
                                const circ = 2 * Math.PI * r;
                                const dash = circ - (circ * progress) / 100;
                                const angle = (progress / 100) * 2 * Math.PI - Math.PI / 2;
                                return (
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <svg width={sz} height={sz} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                                            {Array.from({ length: 32 }).map((_, ti) => {
                                                const a = (ti / 32) * 2 * Math.PI - Math.PI / 2;
                                                const inner = r - 4, outer = r + 1.5;
                                                return (
                                                    <line key={ti}
                                                        x1={sz / 2 + inner * Math.cos(a)} y1={sz / 2 + inner * Math.sin(a)}
                                                        x2={sz / 2 + outer * Math.cos(a)} y2={sz / 2 + outer * Math.sin(a)}
                                                        stroke={`rgba(var(--color-primary),${ti % 4 === 0 ? 0.38 : 0.12})`}
                                                        strokeWidth={ti % 4 === 0 ? 1.2 : 0.7}
                                                    />
                                                );
                                            })}
                                            <circle cx={sz / 2} cy={sz / 2} r={r}
                                                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
                                            <circle cx={sz / 2} cy={sz / 2} r={r}
                                                fill="none"
                                                stroke="rgba(var(--color-primary),1)"
                                                strokeWidth={sw + 1} strokeLinecap="round"
                                                strokeDasharray={circ} strokeDashoffset={dash}
                                                style={{
                                                    transition: 'stroke-dashoffset 0.75s ease-out',
                                                    filter: 'drop-shadow(0 0 5px rgba(var(--color-primary),0.9))',
                                                }}
                                            />
                                            <circle
                                                cx={sz / 2 + r * Math.cos(angle)}
                                                cy={sz / 2 + r * Math.sin(angle)}
                                                r={3.5} fill="white"
                                                style={{ filter: 'drop-shadow(0 0 6px rgba(var(--color-primary),1)) drop-shadow(0 0 16px white)' }}
                                            />
                                        </svg>
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{
                                                fontSize: '16px', fontWeight: 900, color: '#fff',
                                                textShadow: '0 0 16px rgba(var(--color-primary),1)',
                                                lineHeight: 1, letterSpacing: '-0.02em',
                                            }}>{progress}%</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* ── BARRA DE ESTADO inferior ── */}
                <div style={{ position: 'absolute', bottom: '22px', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '24px',
                        fontSize: '8px', fontWeight: 900, letterSpacing: '0.3em',
                        textTransform: 'uppercase', color: 'rgba(var(--color-primary),0.25)',
                    }}>
                        <span>SYS_CORE=0x7FA</span>
                        <div style={{
                            width: '4px', height: '4px', borderRadius: '50%',
                            background: 'rgba(var(--color-primary),0.5)',
                            animation: 'eks-blink 1.1s infinite'
                        }} />
                        <span>SECURE_CHANNEL_ACTIVE</span>
                        <div style={{
                            width: '4px', height: '4px', borderRadius: '50%',
                            background: 'rgba(var(--color-primary),0.5)',
                            animation: 'eks-blink 1.1s infinite 0.55s'
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

    // --- RENDER DEL LANDING PAGE ---
    return (
        <div className="h-screen w-full bg-canvas relative flex items-center justify-center overflow-hidden font-sans text-txt-main selection:bg-primary/30 transition-colors duration-700 animate-landing-entry">

            {/* --- BACKGROUND LAYER SYSTEM --- */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="ambient-light bg-primary/20 top-[-10%] left-[-10%] w-[70vw] h-[70vw]" style={{ animationDuration: '15s' }}></div>

                <div
                    className="absolute inset-[-5%] bg-cover bg-center opacity-10 mix-blend-luminosity grayscale transition-transform duration-700 ease-out"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1599940824399-b87987ced72a?q=80&w=2927&auto=format&fit=crop')`,
                        transform: `translate3d(${mousePos.x * -0.8}px, ${mousePos.y * -0.8}px, 0) scale(1.02)`
                    }}
                />

                <div className="absolute bottom-[-10%] left-[-20%] right-[-20%] h-[40vh] bg-[linear-gradient(rgba(var(--color-primary),0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--color-primary),0.12)_1px,transparent_1px)] bg-[size:50px_50px] [transform:perspective(1000px)_rotateX(75deg)] opacity-40 animate-scan"></div>

                {particles.map(p => (
                    <div
                        key={p.id}
                        className="absolute bottom-[-10px] bg-primary rounded-full animate-float"
                        style={{
                            left: `${p.left}%`,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            opacity: p.opacity,
                            boxShadow: `0 0 8px rgba(var(--color-primary), 0.8)`,
                            animationDelay: `${p.delay}s`,
                            animationDuration: `${p.duration}s`,
                        }}
                    />
                ))}
            </div>

            {/* --- HEADER --- */}
            <header className="absolute top-0 left-0 w-full p-8 z-50 flex justify-between items-center animate-fadeIn">
                <div className="flex items-center gap-4 group cursor-default">
                    <div className="w-14 h-14 glass-surface-light rounded-2xl flex items-center justify-center relative z-10 border border-white/10 group-hover:border-primary/50 transition-all duration-500 overflow-hidden shadow-2xl">
                        <img src="/LOGO.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(var(--color-primary),0.5)] brightness-110" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-3xl font-black tracking-tighter text-txt-main leading-none uppercase">
                            EDS<span className="text-primary">.IA</span>
                        </span>
                        <span className="text-[8px] font-bold text-txt-muted uppercase tracking-[0.4em] opacity-60 mt-1">VERSION BETA</span>
                    </div>
                </div>

                <div className="flex gap-2 items-center bg-white/5 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">

                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                    <button onClick={toggleLanguage} className="h-10 px-4 flex items-center gap-2 rounded-xl hover:bg-white/10 transition-all group">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-black text-txt-main tracking-widest uppercase font-mono">{language}</span>
                    </button>
                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                    <button onClick={cycleTheme} className="h-10 px-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group">
                        <Palette className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest font-mono text-primary">{theme}</span>
                    </button>
                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
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
                        className={`h-10 px-4 flex items-center gap-2 rounded-xl transition-all group ${isAdmin ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-transparent text-txt-muted hover:bg-white/10'}`}
                    >
                        <Settings className={`w-4 h-4 ${isAdmin ? 'animate-spin-slow' : ''}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest font-mono hidden md:block">
                            {isAdmin ? 'Admin' : 'Lock'}
                        </span>
                    </button>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="relative z-30 w-full max-w-[1400px] px-12 grid grid-cols-1 xl:grid-cols-12 gap-16 items-center">

                {/* LEFT: CONTENT */}
                <div className="xl:col-span-7 space-y-10 animate-fadeInLeft">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-[0.3em]">
                                {t('lp.engineering')}
                            </span>
                        </div>
                        <h1 className="text-7xl md:text-8xl xl:text-[8.5rem] font-black text-txt-main leading-[0.8] tracking-tighter select-none">
                            ESP DESIGN STUDIO<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary/80">IA</span>
                        </h1>
                    </div>

                    <p className="text-lg text-txt-muted max-w-xl font-medium leading-relaxed border-l-2 border-primary/30 pl-8 py-2">
                        {t('lp.desc')}
                    </p>

                    <div className="flex flex-wrap gap-4 pt-4">
                        {[{ icon: Zap, label: 'VFD Sim' }, { icon: Database, label: 'PVT Core' }, { icon: Cpu, label: 'AI Suite' }].map((item, i) => (
                            <div key={i} className="px-6 py-3 rounded-xl glass-surface-light border border-white/10 flex items-center gap-3 hover:border-primary/40 transition-colors">
                                <item.icon className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: FORM CARD */}
                <div className="xl:col-span-5 flex justify-center xl:justify-end animate-fadeInRight">
                    <div className="w-full max-w-[560px] relative group">
                        <div className="absolute -inset-4 bg-primary/10 rounded-[48px] blur-3xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>

                        <div className="relative glass-surface border border-white/10 rounded-[40px] p-8 md:p-12 shadow-3xl backdrop-blur-3xl overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-20">
                                <Sparkles className="w-12 h-12 text-primary" />
                            </div>

                            <div className="mb-10 space-y-2">
                                <h3 className="text-3xl font-black text-txt-main uppercase tracking-tight">
                                    {t('lp.access')}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="h-1 w-10 bg-primary rounded-full shadow-glow-primary"></div>
                                    <p className="text-[11px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-40">{t('lp.security')}</p>
                                </div>
                            </div>

                            <div className="relative min-h-[300px]">
                                {menuLevel === 'main' ? (
                                    <div className="space-y-6 animate-fadeIn">
                                        <SecureWrapper isLocked={true} tooltip="Módulo de Diseño Bloqueado" className="w-full">
                                            <button
                                                onClick={() => setMenuLevel('design')}
                                                className="group relative w-full h-24 overflow-hidden rounded-3xl transition-all active:scale-[0.98] border border-white/20 bg-primary hover:shadow-[0_0_40px_rgba(var(--color-primary),0.3)] shadow-glow-primary/20"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                                <div className="relative z-10 flex items-center justify-between px-8 h-full">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg bg-white/20">
                                                            <Palette className="w-7 h-7 text-white" />
                                                        </div>
                                                        <div className="text-left font-black uppercase text-white leading-tight">
                                                            <span className="block text-xl tracking-wider">Diseño e Ingeniería</span>
                                                            <span className="block text-[10px] opacity-70 tracking-[0.3em] mt-1.5 font-bold">Design & Engineering</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-2 transition-transform" />
                                                </div>
                                            </button>
                                        </SecureWrapper>

                                        <button
                                            onClick={() => onMonitoring()}
                                            className="group relative w-full h-24 overflow-hidden rounded-3xl transition-all active:scale-[0.98] border border-white/20 bg-secondary hover:shadow-[0_0_40px_rgba(var(--color-secondary),0.3)] shadow-glow-secondary/20"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                            <div className="relative z-10 flex items-center justify-between px-8 h-full">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg bg-white/20">
                                                        <Activity className="w-7 h-7 text-white" />
                                                    </div>
                                                    <div className="text-left font-black uppercase text-white leading-tight">
                                                        <span className="block text-xl tracking-wider">Centro de Control</span>
                                                        <span className="block text-[10px] opacity-70 tracking-[0.3em] mt-1.5 font-bold">Monitoring & Operations</span>
                                                    </div>
                                                </div>
                                                <ArrowUpRight className="w-6 h-6 text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                                            </div>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-fadeIn">
                                        <button onClick={() => { setIsStartingNew(false); setMenuLevel('main'); }} className="flex items-center gap-2 text-txt-muted hover:text-txt-main transition-colors group">
                                            <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary group-hover:text-txt-main transition-colors">Menú Principal</span>
                                        </button>

                                        {/* CATEGORY: DESIGN */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 px-1">
                                                <div className="w-1.5 h-3 bg-primary/40 rounded-full"></div>
                                                <h4 className="text-[10px] font-black text-txt-main uppercase tracking-[0.4em] opacity-40">Diseño e Ingeniería</h4>
                                            </div>

                                            {!isStartingNew ? (
                                                <div className="space-y-3">
                                                    <button
                                                        onClick={() => setIsStartingNew(true)}
                                                        className="group relative w-full h-20 overflow-hidden rounded-2xl bg-primary transition-all hover:shadow-[0_0_40px_rgba(var(--color-primary),0.3)] active:scale-[0.98] border border-white/20"
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                                        <div className="relative z-10 flex items-center justify-between px-8">
                                                            <div className="flex items-center gap-5">
                                                                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                    <Zap className="w-6 h-6 text-white" />
                                                                </div>
                                                                <div className="text-left font-black uppercase text-white leading-tight">
                                                                    <span className="block text-[15px] tracking-wider">Nuevo Proyecto</span>
                                                                    <span className="block text-[8px] opacity-60 tracking-[0.3em] mt-1">Start Engineering</span>
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                                                        </div>
                                                    </button>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <button onClick={() => fileInputRef.current?.click()} className="group flex items-center justify-center gap-4 h-16 rounded-2xl border border-white/5 bg-white/3 hover:bg-white/8 transition-all px-6">
                                                            <UploadIcon className="w-5 h-5 text-primary/40 group-hover:text-primary transition-all" />
                                                            <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest group-hover:text-txt-main leading-tight text-left">Importar<br />JSON</span>
                                                        </button>
                                                        {/* MASTER DB LOADER */}
                                                        <button
                                                            onClick={handleLoadMaster}
                                                            disabled={batchView === 'loading'}
                                                            className="group flex flex-col items-center justify-center gap-1.5 h-16 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all px-2"
                                                        >
                                                            {batchView === 'loading'
                                                                ? <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                                                                : <Database className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />}
                                                            <span className="text-[7.5px] font-black text-primary/80 group-hover:text-primary uppercase tracking-widest leading-tight text-center">
                                                                Cargar Base<br />Datos ALS
                                                            </span>
                                                        </button>

                                                        {/* BATCH EXCEL PICKER */}
                                                        <button
                                                            onClick={() => batchFileRef.current?.click()}
                                                            disabled={batchView === 'loading'}
                                                            className="group flex flex-col items-center justify-center gap-1.5 h-16 rounded-2xl border border-white/5 bg-white/3 hover:bg-white/8 transition-all px-2"
                                                        >
                                                            <UploadIcon className="w-4 h-4 text-txt-muted/40 group-hover:text-primary transition-all" />
                                                            <span className="text-[7.5px] font-black text-txt-muted uppercase tracking-widest group-hover:text-txt-main leading-tight text-center">
                                                                {batchView === 'list' ? 'Cambiar' : 'Otro'}<br />Excel Pozos
                                                            </span>
                                                            <input ref={batchFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                                                                onChange={e => { const f = e.target.files?.[0]; if (f) handleBatchFile(f); e.target.value = ''; }} />
                                                        </button>
                                                    </div>

                                                    {/* PROGRESS BAR — shown while processing */}
                                                    {batchView === 'loading' && (
                                                        <div className="rounded-2xl border border-primary/20 bg-canvas/40 backdrop-blur-md p-6 flex flex-col items-center justify-center gap-4 mt-3">
                                                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Procesando base de datos...</span>
                                                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                                                <div
                                                                    className="bg-primary h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(var(--color-primary),0.5)]"
                                                                    style={{ width: `${batchProgress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[8px] font-mono text-txt-muted opacity-70">{batchProgress}% &mdash; Por favor espere</span>
                                                        </div>
                                                    )}

                                                    {/* INLINE WELL LIST — shown when Excel is loaded */}
                                                    {batchView === 'list' && (
                                                        <div className="rounded-2xl border border-primary/20 bg-canvas/60 backdrop-blur-md overflow-hidden animate-fadeIn mt-3">
                                                            {/* Mini header */}
                                                            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-primary/5">
                                                                <div className="relative flex-1">
                                                                    <Search className="w-3 h-3 text-txt-muted absolute left-2 top-1/2 -translate-y-1/2" />
                                                                    <input type="text" value={batchSearch} onChange={e => setBatchSearch(e.target.value)}
                                                                        placeholder="Buscar diseño, pozo..."
                                                                        className="w-full bg-transparent text-[9px] font-black text-txt-main pl-6 pr-2 py-1 outline-none placeholder:font-normal placeholder:opacity-40" />
                                                                </div>
                                                                <span className="text-[7px] font-black text-txt-muted opacity-40 uppercase tracking-wider shrink-0">{batchFile}</span>
                                                                <button onClick={() => { setBatchView('idle'); setBatchDesigns([]); setBatchSelected(null); }} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                                                                    <X className="w-3 h-3 text-txt-muted" />
                                                                </button>
                                                            </div>
                                                            {/* Scrollable list */}
                                                            <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                                                                {batchDesigns
                                                                    .filter(row => {
                                                                        if (!batchSearch) return true;
                                                                        const q = batchSearch.toLowerCase();
                                                                        // Filter by POZO name and campo only
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
                                                                            <button key={rowKey} disabled={!!batchSelected}
                                                                                onClick={() => {
                                                                                    setBatchSelected(rowKey);
                                                                                    try {
                                                                                        const p = _rowToParams(row, batchSurveys);
                                                                                        setTimeout(() => { onQuickImport(p); }, 400);
                                                                                    } catch (e) { setBatchSelected(null); }
                                                                                }}
                                                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors ${chosen ? 'bg-primary/10' : ''
                                                                                    }`}
                                                                            >
                                                                                <div className={`text-[10px] font-black font-mono w-8 shrink-0 ${chosen ? 'text-primary' : 'text-txt-muted opacity-50'
                                                                                    }`}>{dNum}</div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className={`text-[9px] font-black uppercase truncate ${chosen ? 'text-primary' : 'text-txt-main'
                                                                                        }`}>{well || '—'}</div>
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[7px] text-txt-muted opacity-40 font-bold uppercase">{campo}</span>
                                                                                        {hasSvy && <span className="text-[6px] font-black text-secondary/60 border border-secondary/20 rounded px-1">SVY</span>}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right shrink-0">
                                                                                    <div className={`text-[8px] font-black font-mono ${rate > 0 ? 'text-primary' : 'text-txt-muted opacity-30'
                                                                                        }`}>{rate > 0 ? `${rate.toFixed(0)} BPD` : '—'}</div>
                                                                                    <div className="text-[7px] text-txt-muted opacity-30 font-mono">{idPz}</div>
                                                                                </div>
                                                                                {chosen
                                                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                                                                    : <ChevronRight className="w-3.5 h-3.5 text-txt-muted opacity-20 shrink-0" />}
                                                                            </button>
                                                                        );
                                                                    })
                                                                }
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-4 p-6 bg-white/3 rounded-3xl border border-primary/20 animate-fadeIn mt-3">
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">{t('lp.identifier')}</label>
                                                            <input
                                                                type="text"
                                                                value={params.metadata.projectName}
                                                                onChange={e => setParams({ ...params, metadata: { ...params.metadata, projectName: e.target.value } })}
                                                                className="w-full bg-canvas border border-white/5 text-txt-main font-bold text-xl rounded-xl py-5 px-6 focus:border-primary/50 outline-none transition-all uppercase"
                                                                placeholder="Pozo / Proyecto"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[9px] font-black text-txt-muted uppercase tracking-widest ml-1">Ingeniero</label>
                                                                <input
                                                                    type="text"
                                                                    value={params.metadata.engineer}
                                                                    onChange={e => setParams({ ...params, metadata: { ...params.metadata, engineer: e.target.value } })}
                                                                    className="w-full bg-canvas border border-white/5 text-txt-main font-bold text-xs rounded-xl py-4 px-4 outline-none"
                                                                    placeholder="Responsable"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[9px] font-black text-txt-muted uppercase tracking-widest ml-1">Compañía</label>
                                                                <input
                                                                    type="text"
                                                                    value={params.metadata.company}
                                                                    onChange={e => setParams({ ...params, metadata: { ...params.metadata, company: e.target.value } })}
                                                                    className="w-full bg-canvas border border-white/5 text-txt-main font-bold text-xs rounded-xl py-4 px-4 outline-none"
                                                                    placeholder="Empresa"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 pt-2">
                                                        <button onClick={() => setIsStartingNew(false)} className="flex-1 py-4 bg-white/5 text-[10px] font-black text-txt-muted uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">Cancelar</button>
                                                        <button onClick={onStart} className="flex-[2] py-4 bg-primary text-[10px] font-black text-white uppercase tracking-widest rounded-xl shadow-glow-primary hover:brightness-110 transition-all">Iniciar Fase</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* CATEGORY: TOOLS */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 px-1">
                                                <div className="w-1.5 h-3 bg-txt-muted/20 rounded-full"></div>
                                                <h4 className="text-[10px] font-black text-txt-main uppercase tracking-[0.4em] opacity-40">Herramientas</h4>
                                            </div>
                                            <button onClick={onCompare} className="group flex items-center justify-between w-full h-16 px-8 rounded-2xl border border-white/5 bg-white/3 hover:bg-white/8 transition-all">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <GitCompareArrows className="w-5 h-5 text-primary opacity-60" />
                                                    </div>
                                                    <span className="font-black uppercase tracking-[0.2em] text-txt-muted group-hover:text-txt-main text-[12px] transition-colors">Comparador de Desempeño</span>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-txt-muted opacity-20 group-hover:opacity-100 transition-all" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <input
                type="file"
                ref={fileInputRef}
                onChange={onImportFile}
                accept=".json,.xlsx"
                className="hidden"
            />

            <footer className="absolute bottom-8 left-8 z-40 flex items-center gap-6 opacity-40 hover:opacity-80 transition-all">
                <div className="h-[1px] w-12 bg-primary/40"></div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.5em]">Status: ALS FRONTERA ACTIVE</span>
                    <span className="text-[8px] font-bold text-txt-muted uppercase tracking-[0.2em] mt-1">EDS DESIGN STUDIO © 2026 | L. PEÑA & A. JIMÉNEZ</span>
                </div>
            </footer>

            <style>{`
                .ambient-light {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                    animation: pulse-light 12s infinite alternate ease-in-out;
                }
                @keyframes pulse-light {
                    0% { transform: scale(1); opacity: 0.1; }
                    100% { transform: scale(1.1); opacity: 0.3; }
                }
                @keyframes scan {
                    from { background-position: 0 0; }
                    to { background-position: 0 100px; }
                }
                .animate-scan { animation: scan 8s linear infinite; }
                @keyframes float {
                    0% { transform: translateY(5vh); opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { transform: translateY(-110vh); opacity: 0; }
                }
                .animate-float { animation: float linear infinite; }
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer { animation: shimmer 1.5s infinite; }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .animate-blink { animation: blink 0.5s infinite; }

                @keyframes landing-entry {
                    0% { opacity: 0; filter: blur(20px) brightness(2); transform: scale(0.95); }
                    10% { opacity: 0.5; filter: blur(10px) brightness(1.5); }
                    15% { opacity: 0.2; }
                    20% { opacity: 1; filter: blur(0) brightness(1); transform: scale(1); }
                }
                .animate-landing-entry { animation: landing-entry 1s ease-out forwards; }

                @keyframes fadeInLeft {
                    0% { opacity: 0; transform: translateX(-30px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                .animate-fadeInLeft { animation: fadeInLeft 0.8s ease-out 0.2s forwards; }

                @keyframes fadeInRight {
                    0% { opacity: 0; transform: translateX(30px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                .animate-fadeInRight { animation: fadeInRight 0.8s ease-out 0.4s forwards; }

                .glass-surface { background: rgba(var(--color-surface-rgb), 0.7); backdrop-filter: blur(40px); }
                .glass-surface-light { background: rgba(var(--color-surface-rgb), 0.3); backdrop-filter: blur(12px); }
            `}</style>
        </div>
    );
};