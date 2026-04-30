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
    const [bootPhase, setBootPhase] = useState<'explosion' | 'loading' | 'complete'>('explosion');
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

    useEffect(() => {
        if (isBooting) {
            // Check if it's the first time this session using a module-level variable
            // This resets on page refresh, which is what the user wants.
            const isFirstLoad = !hasBootedThisSession;

            // Adjust durations based on first load vs subsequent visits
            const explosionDuration = isFirstLoad ? 1200 : 600;
            const logInterval = isFirstLoad ? 600 : 150;
            const bootPhaseCompleteDelay = isFirstLoad ? 8500 : 2500;
            const bootFinishedDelay = isFirstLoad ? 9500 : 3000;

            // Phase 1: Explosion flash
            const explosionTimer = setTimeout(() => setBootPhase('loading'), explosionDuration);

            // Phase 2: Log steps start after explosion
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

            // Phase 3: Complete
            const completeTimer = setTimeout(() => setBootPhase('complete'), bootPhaseCompleteDelay);

            const timer = setTimeout(() => {
                setIsBooting(false);
                hasBootedThisSession = true; // Mark as booted for next time
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
        const progress = (bootStep + 1) * 20;
        const logoW = 627;
        const logoH = 360;
        const cx = logoW / 2;

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
                style={{ background: '#ffffff' }}
            >
                <style>{`
                    @keyframes eks-fade-out {
                        0%   { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    @keyframes eks-logo-in {
                        0%   { opacity: 0; transform: scale(0.95); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                    @keyframes eks-rect-in {
                        0%   { opacity: 0; transform: scale(0.85); }
                        100% { opacity: 0.7; transform: scale(1); }
                    }
                    @keyframes eks-bracket-in {
                        0%   { opacity: 0; transform: scale(1.1); }
                        100% { opacity: 0.8; transform: scale(1); }
                    }
                    @keyframes eks-burst {
                        0%   { transform: rotate(var(--ba)) translateY(0);         opacity: 1; }
                        65%  { opacity: 0.9; }
                        100% { transform: rotate(var(--ba)) translateY(var(--bd)); opacity: 0; }
                    }
                    @keyframes eks-shimmer-x {
                        0% { transform: translateX(-200%) skewX(-12deg); opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { transform: translateX(200%) skewX(-12deg); opacity: 0; }
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
                    @keyframes eks-boom {
                        0% { transform: scale(1); filter: brightness(1) blur(0px); }
                        5% { transform: scale(1.05); filter: brightness(10) blur(5px); }
                        100% { transform: scale(1); filter: brightness(1) blur(0px); }
                    }
                    @keyframes eks-pulse-glow {
                        0% { filter: blur(20px); transform: scale(1); opacity: 0.4; }
                        100% { filter: blur(10px); transform: scale(1.05); opacity: 0.6; }
                    }
                    @keyframes eks-scanline {
                        0% { transform: translateY(-100%); }
                        100% { transform: translateY(100%); }
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
                {/* Fondo limpio y minimalista */}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none',
                    background: '#ffffff',
                    animation: 'eks-fade-out 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
                }} />

                {/* ── EXPLOSION / BOOM EFFECT ── */}
                {bootPhase === 'explosion' && (
                    <div className="fixed inset-0 z-[1000] pointer-events-none flex items-center justify-center">
                        <div className="absolute inset-0 bg-white animate-[eks-fade-out_0.8s_ease-out_forwards]" />
                    </div>
                )}

                {/* ── BACKGROUND TECH GRID ── */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] z-10" />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(var(--color-primary),0.1)_1px,transparent_1px),linear-gradient(0deg,rgba(var(--color-primary),0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/20 animate-[eks-scanline_4s_linear_infinite]" />
                </div>

                {/* ══════════════════════════════════════════════════════
                    LOGO — protagonista absoluto
                ══════════════════════════════════════════════════════ */}
                <div
                    style={{
                        position: 'relative', zIndex: 70,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '60px',
                        animation: 'eks-logo-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) both',
                        filter: bootPhase === 'explosion' ? 'drop-shadow(0 0 50px white)' : 'none',
                        transition: 'filter 0.5s ease-out'
                    }}
                >
                    {/* Contenedor del logo ACAPLADO A 16:9 */}
                    <div style={{ 
                        position: 'relative', 
                        width: '90vw', 
                        maxWidth: `${logoW}px`, 
                        aspectRatio: `${logoW} / ${logoH}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>

                        {/* Marcos Rectangulares Potentes */}
                        {[1.1, 1.25, 1.4].map((s, i) => (
                            <div key={i} style={{
                                position: 'absolute', inset: 0,
                                border: '1px solid rgb(var(--color-primary))',
                                borderRadius: '24px',
                                opacity: 0,
                                transform: `scale(${s})`,
                                boxShadow: '0 0 15px rgba(var(--color-primary), 0.1)',
                                animation: `eks-rect-in 1s cubic-bezier(0.16, 1, 0.3, 1) ${0.2 + i * 0.15}s forwards`,
                            }} />
                        ))}

                        {/* Corner Brackets Reforzados */}
                        {[
                            { top: -50, left: -50, borderTop: '3px solid', borderLeft: '3px solid' },
                            { top: -50, right: -50, borderTop: '3px solid', borderRight: '3px solid' },
                            { bottom: -50, left: -50, borderBottom: '3px solid', borderLeft: '3px solid' },
                            { bottom: -50, right: -50, borderBottom: '3px solid', borderRight: '3px solid' },
                        ].map((b, i) => (
                            <div key={i} style={{
                                position: 'absolute', width: '40px', height: '40px',
                                borderColor: 'rgb(var(--color-primary))',
                                opacity: 0,
                                ...b,
                                animation: `eks-bracket-in 0.8s ease-out 0.5s forwards`,
                            }} />
                        ))}

                        {/* STATIC PLACEHOLDER LOGO (Visible while video loads) */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 15, // Higher than video to hide it initially
                            opacity: videoReady ? 0 : 1,
                            transition: 'opacity 2s ease-in-out',
                            animation: !videoReady ? 'eks-pulse-glow 4s infinite alternate ease-in-out' : 'none'
                        }}>
                            <img
                                src="/LOGO.png"
                                alt="Loading..."
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover', // Match video
                                    filter: 'brightness(1.1) contrast(1.1)',
                                }}
                            />
                            {/* Scanning effect while loading */}
                            {!videoReady && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0,
                                    height: '4px',
                                    background: 'rgba(var(--color-primary), 0.8)',
                                    boxShadow: '0 0 20px rgba(var(--color-primary), 1)',
                                    zIndex: 6,
                                    animation: 'eks-sweep 2s infinite linear'
                                }} />
                            )}
                        </div>

                        {/* VIDEO LOGO PURO CON MASCARA RECTANGULAR */}
                        <video
                            src="/logo_animated.mp4"
                            autoPlay
                            muted
                            playsInline
                            preload="auto"
                            onPlaying={() => setVideoReady(true)}
                            style={{
                                position: 'absolute', inset: 0,
                                width: '100%', height: '100%', objectFit: 'cover',
                                zIndex: 10,
                                pointerEvents: 'none',
                                opacity: videoReady ? 1 : 0,
                                transform: 'scale(1)', // No scale jump
                                // Máscara rectangular con bordes suavizados
                                maskImage: 'inset(0% round 24px)',
                                WebkitMaskImage: 'inset(0% round 24px)',
                                transition: 'opacity 2s ease-in-out'
                            }}
                        />
                    </div>

                    {/* ── TERMINAL + PROGRESO ── */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '24px', width: '400px',
                        animation: 'eks-term-in 0.8s ease-out 0.5s both',
                        zIndex: 100,
                    }}>
                        {/* Log line minimalista para fondo claro */}
                        <div style={{
                            position: 'relative', width: '100%',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '14px 24px',
                            background: 'rgba(0,0,0,0.04)',
                            border: '1px solid rgba(0,0,0, 0.1)',
                            borderRadius: '12px',
                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.02)',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div className="flex items-center gap-3 w-full">
                                <span className="text-[9px] font-black text-primary opacity-50 font-mono">[{bootLogs[bootStep].sub}]</span>
                                <span style={{
                                    flex: 1, textAlign: 'left',
                                    fontSize: '10px', fontWeight: 800,
                                    letterSpacing: '0.2em', textTransform: 'uppercase',
                                    color: '#333',
                                    animation: 'eks-glitch 2s infinite'
                                }}>
                                    {bootLogs[bootStep].msg}
                                </span>
                                <span className="text-[9px] font-black text-primary opacity-30 font-mono">{bootLogs[bootStep].hex}</span>
                            </div>
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

                {/* ── FINAL FLASH ── */}
                {bootPhase === 'complete' && (
                    <div className="fixed inset-0 z-[2000] bg-white animate-[eks-fade-out_0.6s_ease-in_reverse_forwards]" />
                )}

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
        <div className="h-screen w-full relative flex items-center justify-center overflow-hidden font-sans text-txt-main selection:bg-primary/30 transition-colors duration-700 animate-landing-entry">

            {/* --- PREMIUM BACKGROUND LAYER SYSTEM --- */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                {/* Background Image Layer - Forced to fit (100% 100%) */}
                <div
                    className="absolute inset-0 bg-center no-repeat opacity-20 filter blur-sm transition-transform duration-1000 ease-out"
                    style={{
                        backgroundImage: "url('/main_bg.png')",
                        backgroundSize: "100% 100%",
                        transform: `translate3d(${mousePos.x * -0.5}px, ${mousePos.y * -0.5}px, 0)`
                    }}
                ></div>

                {/* Animated Tech Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--color-text-main),0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--color-text-main),0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

                {/* Perspective Floor Grid */}
                <div className="absolute bottom-[-20%] left-[-20%] right-[-20%] h-[50vh] bg-[linear-gradient(rgba(var(--color-primary),0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--color-primary),0.15)_1px,transparent_1px)] bg-[size:60px_60px] [transform:perspective(1000px)_rotateX(70deg)] opacity-50 animate-scan [mask-image:linear-gradient(to_top,black_10%,transparent_100%)]"></div>

                {/* Upward Floating Particles with Glow */}
                {particles.map(p => (
                    <div
                        key={p.id}
                        className="absolute bottom-[-20px] rounded-full animate-float-particle"
                        style={{
                            left: `${p.left}%`,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            opacity: p.opacity,
                            background: `radial-gradient(circle at center, rgb(var(--color-primary)) 0%, transparent 100%)`,
                            boxShadow: `0 0 ${p.size * 3}px rgb(var(--color-primary))`,
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
                    <div className="space-y-6 relative">
                        {/* Decorative background glow for text */}
                        <div className="absolute -left-10 top-10 w-40 h-40 bg-primary/20 blur-[80px] rounded-full pointer-events-none"></div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-transparent border border-primary/30 text-[9px] font-black text-primary uppercase tracking-[0.3em] backdrop-blur-sm shadow-[0_0_15px_rgba(var(--color-primary),0.2)]">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                                {t('lp.engineering')}
                            </div>
                        </div>
                        <h1 className="text-7xl md:text-8xl xl:text-[8.5rem] font-black text-txt-main leading-[0.85] tracking-tighter select-none drop-shadow-2xl">
                            ESP DESIGN <br /> STUDIO<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent animate-gradient-x bg-[length:200%_auto]">IA</span>
                        </h1>
                    </div>

                    <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary via-primary/50 to-transparent rounded-full"></div>
                        <p className="text-lg text-txt-muted max-w-xl font-medium leading-relaxed pl-8 py-2 text-shadow-sm">
                            {t('lp.desc')}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-6">
                        {[{ icon: Zap, label: 'VFD Sim' }, { icon: Database, label: 'PVT Core' }, { icon: Cpu, label: 'AI Suite' }].map((item, i) => (
                            <div key={i} className="group px-6 py-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 hover:bg-white/10 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(var(--color-primary),0.1)] cursor-default backdrop-blur-md">
                                <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                    <item.icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 group-hover:opacity-100 text-txt-main">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: FORM CARD */}
                <div className="xl:col-span-5 flex justify-center xl:justify-end animate-fadeInRight">
                    <div className="w-full max-w-[560px] relative group">
                        {/* Glow Behind Card */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/40 via-secondary/20 to-primary/40 rounded-[48px] blur-2xl opacity-40 group-hover:opacity-80 transition duration-1000 animate-pulse-slow"></div>
                        <div className="absolute -inset-4 bg-primary/10 rounded-[48px] blur-3xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>

                        <div className="relative bg-canvas/40 border border-white/10 rounded-[40px] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-3xl overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none">
                            {/* Inner ambient light */}
                            <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-primary/30 rounded-full blur-[60px] pointer-events-none"></div>

                            <div className="absolute top-0 right-0 p-8 opacity-40">
                                <Sparkles className="w-10 h-10 text-primary animate-pulse" />
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
                                                className="group relative w-full h-28 overflow-hidden rounded-[2rem] transition-all duration-500 active:scale-[0.98] border border-primary/30 bg-primary hover:shadow-[0_0_60px_rgba(var(--color-primary),0.4)] backdrop-blur-xl"
                                            >
                                                {/* Animated overlay effects */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/30 group-hover:to-black/10 transition-colors duration-500"></div>
                                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:animate-[shimmer_2s_infinite] skew-x-[-20deg]"></div>
                                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>

                                                <div className="relative z-10 flex items-center justify-between px-8 h-full">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl bg-white/20 backdrop-blur-sm border border-white/30">
                                                            <Palette className="w-8 h-8 text-white drop-shadow-md" />
                                                        </div>
                                                        <div className="text-left font-black uppercase text-white leading-tight">
                                                            <span className="block text-2xl tracking-wide drop-shadow-md">Diseño e Ingeniería</span>
                                                            <span className="block text-[10px] opacity-80 tracking-[0.4em] mt-2 font-bold flex items-center gap-2">
                                                                Design & Engineering <span className="w-8 h-[1px] bg-white/50 inline-block"></span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors border border-white/10">
                                                        <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
                                                    </div>
                                                </div>
                                            </button>
                                        </SecureWrapper>

                                        <button
                                            onClick={() => onMonitoring()}
                                            className="group relative w-full h-28 overflow-hidden rounded-[2rem] transition-all duration-500 active:scale-[0.98] border border-secondary/30 bg-secondary hover:shadow-[0_0_60px_rgba(var(--color-secondary),0.4)] backdrop-blur-xl"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/30 group-hover:to-black/10 transition-colors duration-500"></div>
                                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:animate-[shimmer_2s_infinite] skew-x-[-20deg]"></div>
                                            <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>

                                            <div className="relative z-10 flex items-center justify-between px-8 h-full">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 shadow-2xl bg-white/20 backdrop-blur-sm border border-white/30">
                                                        <Activity className="w-8 h-8 text-white drop-shadow-md" />
                                                    </div>
                                                    <div className="text-left font-black uppercase text-white leading-tight">
                                                        <span className="block text-2xl tracking-wide drop-shadow-md">Centro de Control</span>
                                                        <span className="block text-[10px] opacity-80 tracking-[0.4em] mt-2 font-bold flex items-center gap-2">
                                                            Monitoring & Operations <span className="w-8 h-[1px] bg-white/50 inline-block"></span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors border border-white/10">
                                                    <ArrowUpRight className="w-6 h-6 text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                                </div>
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
                    <span className="text-[8px] font-bold text-txt-muted uppercase tracking-[0.2em] mt-1">EDS DESIGN STUDIO © 2026 | LENIN PEÑA & ANDRE JIMENEZ.</span>
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
                
                @keyframes float-particle {
                    0% { transform: translateY(10vh) scale(0.8); opacity: 0; }
                    20% { opacity: 1; transform: translateY(-10vh) scale(1); }
                    80% { opacity: 1; transform: translateY(-80vh) scale(1); }
                    100% { transform: translateY(-110vh) scale(0.5); opacity: 0; }
                }
                .animate-float-particle { animation: float-particle linear infinite; }
                
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
                .animate-float { animation: float 6s ease-in-out infinite; }

                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.05); }
                }
                .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }

                @keyframes shimmer {
                    100% { transform: translateX(200%); }
                }

                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .animate-blink { animation: blink 0.5s infinite; }

                @keyframes gradient-x {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient-x { animation: gradient-x 4s ease infinite; }

                @keyframes landing-entry {
                    0% { opacity: 0; filter: blur(20px) brightness(2); transform: scale(0.95); }
                    10% { opacity: 0.5; filter: blur(10px) brightness(1.5); }
                    15% { opacity: 0.2; }
                    20% { opacity: 1; filter: blur(0) brightness(1); transform: scale(1); }
                }
                .animate-landing-entry { animation: landing-entry 1s ease-out forwards; }

                @keyframes fadeInLeft {
                    0% { opacity: 0; transform: translateX(-40px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                .animate-fadeInLeft { animation: fadeInLeft 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; }

                @keyframes fadeInRight {
                    0% { opacity: 0; transform: translateX(40px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                .animate-fadeInRight { animation: fadeInRight 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards; }

                .glass-surface { background: rgba(var(--color-surface-rgb), 0.7); backdrop-filter: blur(40px); }
                .glass-surface-light { background: rgba(var(--color-surface-rgb), 0.3); backdrop-filter: blur(12px); }
                
                .text-shadow-sm { text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
            `}</style>
        </div>
    );
};