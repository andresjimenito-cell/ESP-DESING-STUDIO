import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Activity, Gauge, Thermometer, Zap, AlertTriangle, ShieldCheck,
    Monitor, Clock, LayoutGrid, List, Search, ArrowUpRight,
    ArrowDownRight, MoreVertical, RefreshCw, Cpu, Cable,
    Waves, HardDrive, Bell, Info, ChevronLeft, ChevronRight, Target,
    History, BarChart3, TrendingUp, Filter, Download, Droplets, Database,
    Globe, Palette, Moon, Sun, Brain, Layers, Maximize2, Minimize2, ClipboardCheck, X, Trash2,
    Sparkles, Send, Settings, Lock as LockIcon, Compass, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Cell, ReferenceLine,
    LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { SystemParams, EspPump, EspMotor, EspVSD, MonitoringEvent, WellHealthStatus, PredictiveData, ProductionTest, SurveyPoint, HistoryMatchData, WellFleetItem, PipeData } from '@/types';
import { calculateSystemResults, findIntersection, generateMultiCurveData, calculateTDH, calculateBaseHead, getShaftLimitHp, interpolateTVD, calculateFluidProperties, calculateOperatingRange, calculateAffinityHead, calculateSystemTDH, calculateAOF } from '@/utils';
import { PerformanceCurveMultiAxis } from './PerformanceCurveMultiAxis';
import { VisualESPStack } from './VisualESPStack';
import { Phase6 } from './Phase6';
import { useLanguage } from '@/i18n';
import { useTheme } from '@/theme';
import { CASING_CATALOG, TUBING_CATALOG } from '@/data';
import { SecureWrapper } from './SecureWrapper';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DesignDataImport } from './DesignDataImport';
import { MatchHistorico } from './MatchHistorico';
import { TrajectoryPlot } from './TrajectoryPlot';
import { AiMemoryService } from '../services/AiMemoryService';

// Constantes
import {
    INITIAL_PARAMS, MOCK_FLEET, FALLBACK_PUMP, HealthTagLabels,
    _cachedFleet, _cachedDesigns, _cachedHistoricalData, _dataLoaded,
    setCachedFleet, setCachedDesigns, setCachedHistoricalData, setDataLoaded
} from './PhaseMonitoreo.constants';

// Helpers
import {
    isWellMatchComplete, buildHistoryMatchFromWell,
    computeWellCapacity, getPhase6Diagnosis, getOptimizationPathLocalized,
    getOptimizationPath, getWellHealthScore,
    s_ext, d_ext, n_ext, norm_ext, fuzzyWellName, get_ext,
    smartMatchExt, exactMatchExt
} from './PhaseMonitoreo.helpers';

// Sub-componentes
import {
    WellListItem, DebouncedSearchInput, MetricCard, HealthTag,
    MetricSummaryCard, DiagnosticBadge, PredictiveWidget,
    PredictiveMiniWidget, CompValueCard, DiagnosticRow
} from './PhaseMonitoreo.subcomponents';

// FloatingAiPanel
import { FloatingAiPanel } from './FloatingAiPanel';

// Custom Hook de importacion
import { usePhaseMonitoreoImport } from './usePhaseMonitoreoImport';
import { MobileMonitoreo } from './mobile/MobileMonitoreo';

// --- PERFORMANCE OPTIMIZED SUB-COMPONENTS ---

interface Props {
    params: SystemParams;
    pump: EspPump | null;
    pumpCatalog?: EspPump[];
    motorCatalog?: EspMotor[];
    onBack: () => void;
    onNavigateToDesign?: (wellParams: SystemParams, pump?: EspPump | null) => void;

}

// --- MOCK DATA FOR DEMO ---
// "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

// --- CAPACITY SIMULATION HELPER ---
// --- CAPACITY SIMULATION HELPER (Optimized with basic memoization logic) ---

export const PhaseMonitoreo: React.FC<Props & { vsdCatalog?: EspVSD[] }> = ({ params, pump: providedPump, pumpCatalog = [], motorCatalog = [], vsdCatalog = [], onBack, onNavigateToDesign }) => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, cycleTheme, toggleLightMode } = useTheme();
    const [isBhaMinimized, setIsBhaMinimized] = useState(true);
    const [isTrajectoryMinimized, setIsTrajectoryMinimized] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const [showFullMatch, setShowFullMatch] = useState(false);
    const [fleet, setFleet] = useState<WellFleetItem[]>(_cachedFleet);
    const [customDesigns, setCustomDesigns] = useState<Record<string, SystemParams>>(_cachedDesigns);
    const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'caution' | 'critical'>('all');
    const [dataFilter, setDataFilter] = useState<'all' | 'complete' | 'missing'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'operativo' | 'fallado' | 'pull' | 'pendiente'>('all');
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [selectedWellId, setSelectedWellId] = useState<string | null>(null);
    const [isWellDropdownOpen, setIsWellDropdownOpen] = useState(false);
    const wellDropdownRef = React.useRef<HTMLDivElement>(null);
    const wellDropdownPanelRef = React.useRef<HTMLDivElement>(null);
    const [wellViewMode, setWellViewMode] = useState<'monitoring' | 'history'>('monitoring');
    const [wellsHistoricalData, setWellsHistoricalData] = useState<Record<string, ProductionTest[]>>(_cachedHistoricalData);
    const [importProgress, setImportProgress] = useState<{ current: number, total: number, label: string } | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            return 0.55; // Zoom out on mobile viewports so everything fits nicely
        }
        return 0.8;
    });
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768;
        }
        return false;
    });
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [visibleCount, setVisibleCount] = useState<number>(50);
    const [isSyncingOneDrive, setIsSyncingOneDrive] = useState(false);

    // Carga directa desde OneDrive a través del proxy serverless (/api/onedrive-fetch)
    const loadFromOneDrive = useCallback(async (silent = false) => {
        if (!silent) setImportProgress({ current: 0, total: 100, label: language === 'es' ? 'Conectando con OneDrive...' : 'Connecting to OneDrive...' });
        try {
            // 1. Descargar Excel de Diseños (usa Microsoft Graph API via proxy)
            if (!silent) setImportProgress({ current: 10, total: 100, label: language === 'es' ? 'Descargando Base de Datos Maestra desde OneDrive...' : 'Downloading master database from OneDrive...' });
            const resDesigns = await fetch(`/api/onedrive-fetch?file=designs&format=json&t=${Date.now()}`);
            if (resDesigns.ok) {
                const data = await resDesigns.json();
                await processExcelDesignsBufferRef.current(data, true, true);
            } else {
                const errData = await resDesigns.json().catch(() => ({ error: `HTTP ${resDesigns.status}` }));
                throw new Error(errData.detail || errData.error || `Error descargando diseños: ${resDesigns.status}`);
            }

            // 2. Descargar Excel de Pruebas de Producción / SCADA
            if (!silent) setImportProgress({ current: 60, total: 100, label: language === 'es' ? 'Descargando datos SCADA/Producción desde OneDrive...' : 'Downloading SCADA/Production data from OneDrive...' });
            const resScada = await fetch(`/api/onedrive-fetch?file=scada&format=json&t=${Date.now()}`);
            if (resScada.ok) {
                const data = await resScada.json();
                await processScadaBufferRef.current(data, true, true);
            } else {
                const errData = await resScada.json().catch(() => ({ error: `HTTP ${resScada.status}` }));
                throw new Error(errData.detail || errData.error || `Error descargando SCADA: ${resScada.status}`);
            }

            if (!silent) {
                setImportProgress({ current: 100, total: 100, label: language === 'es' ? '¡Sistema Listo!' : 'System Ready!' });
                await new Promise(r => setTimeout(r, 400));
                setImportProgress(null);
                setDataLoaded(true);
            }
            console.log('✅ [OneDrive Sync] Datos cargados correctamente desde OneDrive.');
        } catch (err: any) {
            console.error('[OneDrive Sync] Error:', err);
            if (!silent) {
                setImportProgress(null);
                alert(language === 'es'
                    ? `Error al sincronizar con OneDrive: ${err.message}\n\nVerifica que el servidor esté activo y los links de OneDrive sean válidos.`
                    : `Error syncing from OneDrive: ${err.message}`);
            }
            throw err;
        }
    }, [language]);

    const handleForceSync = async () => {
        if (isSyncingOneDrive) return;
        setIsSyncingOneDrive(true);
        try {
            await loadFromOneDrive(false);
        } finally {
            setTimeout(() => setIsSyncingOneDrive(false), 1000);
        }
    };

    // Reset visible count when filters or dropdown state change
    useEffect(() => {
        setVisibleCount(50);
    }, [deferredSearchTerm, healthFilter, dataFilter, statusFilter, isWellDropdownOpen]);

    // "?"? Sync module cache whenever state changes "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    useEffect(() => { setCachedFleet(fleet); }, [fleet]);
    useEffect(() => { setCachedDesigns(customDesigns); }, [customDesigns]);
    useEffect(() => { setCachedHistoricalData(wellsHistoricalData); }, [wellsHistoricalData]);

    // --- PERFORMANCE OPTIMIZATIONS: PRE-CALCULATED DATA ---
    // Pre-index designs for O(1) lookup in health calculations
    const indexedDesigns = useMemo(() => {
        const map: Record<string, SystemParams> = {};
        Object.entries(customDesigns).forEach(([key, design]) => {
            map[fuzzyWellName(key)] = design;
        });
        return map;
    }, [customDesigns]);

    const wellHealthMap = useMemo(() => {
        const map: Record<string, number> = {};
        fleet.forEach(well => {
            const wellNorm = fuzzyWellName(well.name);
            const design = indexedDesigns[wellNorm];
            map[well.id] = getWellHealthScore(well, design, providedPump);
        });
        return map;
    }, [fleet, indexedDesigns, providedPump?.id]);

    const filteredFleet = useMemo(() => {
        let result = fleet;

        // Filter by health
        if (healthFilter !== 'all') {
            result = result.filter(well => {
                const h = wellHealthMap[well.id] || 0;
                if (healthFilter === 'healthy') return h > 85;
                if (healthFilter === 'caution') return h > 60 && h <= 85;
                if (healthFilter === 'critical') return h <= 60;
                return true;
            });
        }

        // Filter by data completeness
        if (dataFilter !== 'all') {
            result = result.filter(well => {
                const isComplete = isWellMatchComplete(well);
                if (dataFilter === 'complete') return isComplete;
                if (dataFilter === 'missing') return !isComplete;
                return true;
            });
        }

        // Filter by status (estadoActual)
        if (statusFilter !== 'all') {
            result = result.filter(well => well.estadoActual === statusFilter);
        }

        // Filter by search term (normalized) - Using deferred term to keep UI responsive
        if (deferredSearchTerm.trim()) {
            const st = norm_ext(deferredSearchTerm);
            result = result.filter(well => norm_ext(well.name).includes(st) || norm_ext(well.id).includes(st));
        }

        return result;
    }, [fleet, healthFilter, dataFilter, statusFilter, deferredSearchTerm, wellHealthMap]);

    const sortedFleet = useMemo(() => {
        return [...filteredFleet].sort((a, b) => {
            // Prioritize 'operativo' status
            if (a.estadoActual === 'operativo' && b.estadoActual !== 'operativo') return -1;
            if (a.estadoActual !== 'operativo' && b.estadoActual === 'operativo') return 1;

            const ha = wellHealthMap[a.id] || 0;
            const hb = wellHealthMap[b.id] || 0;
            return ha - hb; // Show critical first
        });
    }, [filteredFleet, wellHealthMap]);

    const toggleLanguage = () => setLanguage(language === 'en' ? 'es' : 'en');
    const toggleTheme = toggleLightMode;

    // AUTO-SELECT FIRST WELL when fleet loads and no well is selected
    useEffect(() => {
        if (fleet.length > 0 && !selectedWellId) {
            // Try to select the first well that has match data, otherwise just the first one
            const withMatch = fleet.find(w => w.productionTest.hasMatchData);
            setSelectedWellId(withMatch ? withMatch.id : fleet[0].id);
        }
    }, [fleet, selectedWellId]);

    const handleDropdownScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
            setVisibleCount(prev => Math.min(prev + 50, sortedFleet.length));
        }
    }, [sortedFleet.length]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (wellDropdownRef.current?.contains(target)) return;
            if (wellDropdownPanelRef.current?.contains(target)) return;
            setIsWellDropdownOpen(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);
    const clearFleet = () => {
        setFleet([]);
        setCustomDesigns({});
        setSelectedWellId(null);
        setWellsHistoricalData({});
        setCachedFleet([]);
        setCachedDesigns({});
        setCachedHistoricalData({});
        setDataLoaded(false);
    };

    const importDesignRef = React.useRef<HTMLInputElement>(null);
    const importExcelDesignRef = React.useRef<HTMLInputElement>(null);
    const importDbRef = React.useRef<HTMLInputElement>(null);
    const importWellHistoryRef = React.useRef<HTMLInputElement>(null);

    const { processExcelDesignsBuffer, processScadaBuffer, handleImportDesign, handleImportDb, handleImportWellHistory } = usePhaseMonitoreoImport(
        setFleet,
        setCustomDesigns,
        setWellsHistoricalData,
        setImportProgress,
        setWellViewMode,
        fleet,
        selectedWellId,
        pumpCatalog,
        motorCatalog,
        vsdCatalog
    );

    // "?"?"?"? REFS TO PREVENT SSE CONNECTION LOOP "?"?"?"?"?"?"?"?"?
    const processExcelDesignsBufferRef = useRef(processExcelDesignsBuffer);
    const processScadaBufferRef = useRef(processScadaBuffer);

    useEffect(() => {
        processExcelDesignsBufferRef.current = processExcelDesignsBuffer;
        processScadaBufferRef.current = processScadaBuffer;
    }, [processExcelDesignsBuffer, processScadaBuffer]);

    // "?"?"?"? AUTO-LOAD INICIAL DESDE ONEDRIVE "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    const loadFromOneDriveRef = useRef(loadFromOneDrive);
    useEffect(() => {
        loadFromOneDriveRef.current = loadFromOneDrive;
    }, [loadFromOneDrive]);

    useEffect(() => {
        // Omitir si los datos ya están en caché de esta sesión
        if (_dataLoaded || fleet.length > 0) return;

        let mounted = true;
        const loadAutoFiles = async () => {
            try {
                // Cargar siempre directo desde OneDrive (datos siempre frescos del Excel)
                if (mounted) {
                    await loadFromOneDriveRef.current(false);
                }
            } catch (err) {
                console.error('[Auto-Load] Error cargando datos desde OneDrive:', err);
                if (mounted) setImportProgress(null);
            }
        };

        setTimeout(loadAutoFiles, 300);
        return () => { mounted = false; };
    }, [language]);
    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?


    const selectedWell = useMemo(() => fleet.find(w => w.id === selectedWellId), [selectedWellId, fleet]);

    const handleHistoryMatchChange = useCallback((hm: HistoryMatchData) => {
        if (!selectedWellId) return;
        const selected = fleet.find(w => w.id === selectedWellId);
        const selectedNorm = selected ? fuzzyWellName(selected.name) : '';
        setFleet(prev => prev.map(w => {
            if (w.id !== selectedWellId) return w;
            const rate = Number(hm.rate) || 0;
            const freq = Number(hm.frequency) || 0;
            const pip = Number(hm.pip) || 0;
            const thp = Number(hm.thp) || 0;
            return {
                ...w,
                currentRate: rate > 0 ? rate : w.currentRate,
                productionTest: {
                    ...w.productionTest,
                    rate,
                    freq,
                    pip,
                    thp,
                    tht: Number(hm.tht) || 0,
                    waterCut: Number(hm.waterCut) || 0,
                    pdp: Number(hm.pd) || Number(hm.pdp) || 0,
                    hp: Number(hm.pd) || Number(hm.pdp) || 0,
                    gor: hm.gor ?? w.productionTest.gor,
                    date: hm.matchDate || w.productionTest.date,
                    hasMatchData: rate > 5 || (pip > 0 && thp > 0),
                },
            };
        }));
        if (selectedNorm) {
            setCustomDesigns(prev => {
                const next = { ...prev };
                const key = Object.keys(next).find(k => fuzzyWellName(k) === selectedNorm);
                if (!key) return prev;
                next[key] = {
                    ...next[key],
                    historyMatch: {
                        ...(next[key].historyMatch || {}),
                        startDate: hm.startDate || next[key].historyMatch?.startDate || '',
                        matchDate: hm.matchDate || next[key].historyMatch?.matchDate || '',
                    } as HistoryMatchData
                };
                return next;
            });
        }
    }, [selectedWellId, fleet]);

    const pump = useMemo(() => {
        if (!selectedWell || selectedWell.estadoActual === 'pendiente') return null;
        const normalizedName = selectedWell.name.toUpperCase().trim();

        let design: any = customDesigns[normalizedName];

        // Strict fallback
        if (!design) {
            const shortName = normalizedName.replace(/^W-|^WELL-/, '');
            const key = Object.keys(customDesigns).find(k => {
                const kShort = k.replace(/^W-|^WELL-/, '');
                return kShort === shortName || k === normalizedName;
            });
            if (key) design = customDesigns[key];
        }

        if (design) {
            // Priority: recursive search for pump object
            const findPump = (obj: any): EspPump | null => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                for (let k in obj) {
                    const found = findPump(obj[k]);
                    if (found) return found;
                }
                return null;
            }
            const p = findPump(design);
            if (p) return p;
        }
        return providedPump || null;
    }, [selectedWell, customDesigns, providedPump]);

    const wellMatchParams = useMemo(() => {
        if (!selectedWell) return params;
        const normalizedName = selectedWell.name.toUpperCase().trim();

        // 1. Strict Search
        let designBase: SystemParams | null = customDesigns[normalizedName] || null;

        // 2. Controlled Greedy Search (only if no exact match)
        if (!designBase) {
            const shortName = normalizedName.replace(/^W-|^WELL-/, '');
            const key = Object.keys(customDesigns).find(k => {
                const kShort = k.replace(/^W-|^WELL-/, '');
                // Avoid false positives: "W-1" should NOT match "W-11"
                return kShort === shortName || k === normalizedName;
            });
            if (key) designBase = customDesigns[key];
        }

        // Final fallback to global designer state
        const base = designBase || params;

        const test = selectedWell.productionTest;
        const pStaticBase = base.inflow?.pStatic || params.inflow?.pStatic || 0;

        // HIGH-FIDELITY DEEP MERGE - CATEGORY BY CATEGORY
        // We ensure that each well has a UNIQUE SystemParams object
        // by merging the design baseline with the real-time field test data.
        const mp: SystemParams = {
            ...base,
            // Deep isolation of critical categories from the JSON design
            wellbore: { ...params.wellbore, ...(base.wellbore || {}) },
            pressures: { ...params.pressures, ...(base.pressures || {}) },
            fluids: { ...params.fluids, ...(base.fluids || {}) },
            inflow: { ...params.inflow, ...(base.inflow || {}) },

            // Metadata for identification
            metadata: {
                ...base.metadata,
                wellName: selectedWell.name,
                date: test.date
            },
            // Preservamos el caudal de diseno original del JSON
            targets: {
                ...base.targets,
                target: { ...base.targets.target }
            },
            // Siempre disponible para entrada manual aunque no haya prueba importada
            historyMatch: buildHistoryMatchFromWell(selectedWell, pStaticBase, base)
        };

        return mp; // No deep clone needed if we don't mutate. mp is fresh.
    }, [selectedWell, params, customDesigns]);

    // The derived wellMatchParams is the SOLE TRUTH for the analysis engine.
    // By passing it directly, we ensure no stale state persists between selections    // --- DEEP DIAGNOSTICS ENGINE ---
    const wellDiagnostics = useMemo(() => {
        if (!selectedWell || !pump || !wellMatchParams.historyMatch) return null; // Only run if match data exists
        const test = selectedWell.productionTest;
        const base = wellMatchParams;

        // 1. BEP & Thrust Analysis
        const freqRatio = test.freq / (pump.nameplateFrequency || 60);
        const bepAtFreq = (pump.bepRate || 1000) * freqRatio;
        const flowRatio = bepAtFreq > 0 ? test.rate / bepAtFreq : 1;

        const minQ = (pump.minRate || 0) * freqRatio;
        const maxQ = (pump.maxRate || 2000) * freqRatio;

        let thrustStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        let thrustLabel = 'Normal (Stable)';
        if (test.rate > maxQ * 1.05) {
            thrustStatus = 'alert';
            thrustLabel = 'UPTHRUST (High Risk)';
        } else if (test.rate < minQ * 0.95) {
            thrustStatus = 'alert';
            thrustLabel = 'DOWNTHRUST (Instability)';
        } else if (test.rate > maxQ || test.rate < minQ) {
            thrustStatus = 'caution';
            thrustLabel = 'Marginal (Observe)';
        }

        // 2. Power & Loading (Estimated)
        // Corrected heuristic: BHP scales with frequency^2.5 (avg) or ^3 (theoretical)
        const freqRatio_30_60 = test.freq / 60;
        const bhpEst = (test.rate * (selectedWell.depthMD * 0.433) * 1.1) / (135770 * 0.65) * Math.max(1, Math.pow(freqRatio_30_60, 2.8));

        // ONLY calculate motor load if a motor is actually defined in the design
        const hasMotorData = !!base.selectedMotor;
        const motorLimit = hasMotorData ? (base.selectedMotor!.hp * Math.min(1.0, test.freq / 60)) : 0;
        const motorLoad = hasMotorData && motorLimit > 0 ? (bhpEst / motorLimit) * 100 : 0;

        let motorStatus: 'optimal' | 'caution' | 'alert' | 'unknown' = hasMotorData ? 'optimal' : 'unknown';
        if (hasMotorData) {
            if (motorLoad > 105) motorStatus = 'alert';
            else if (motorLoad > 90) motorStatus = 'caution';
        }

        // 3. Degradation Analysis
        // Find theoretical head at this flow and frequency
        const qAdj = test.rate / freqRatio;
        const hBase = (pump.h0 + pump.h1 * qAdj + pump.h2 * qAdj ** 2 + pump.h3 * qAdj ** 3 + pump.h4 * qAdj ** 4 + pump.h5 * qAdj ** 5 + pump.h6 * qAdj ** 6) * pump.stages;
        const hTheo = hBase * (freqRatio ** 2);
        const hActual = selectedWell.depthMD * 0.433 * 0.9 + (test.thp * 2.31); // Estimated TDH

        const degPct = hTheo > 0 ? ((hTheo - hActual) / hTheo) * 100 : 0;
        let pumpStatus: 'optimal' | 'caution' | 'alert' = 'optimal';
        if (degPct > 15) pumpStatus = 'alert';
        else if (degPct > 8) pumpStatus = 'caution';

        // 4. Gas / PIP risk
        const pb = base.fluids?.pb || 2200;
        const gasRisk = test.pip < pb * 1.1 ? (test.pip < pb ? 'alert' : 'caution') : 'optimal';

        return {
            thrust: { status: thrustStatus, label: thrustLabel, ratio: flowRatio * 100 },
            motor: { status: motorStatus, load: motorLoad, hasData: hasMotorData },
            pump: { status: pumpStatus, degradation: Math.max(0, degPct) },
            gas: { status: gasRisk, pip: test.pip, pb },
            shaft: { status: (hasMotorData && motorLoad > 95) ? 'caution' : 'optimal' as any, load: hasMotorData ? motorLoad * 0.9 : 0 }
        };
    }, [selectedWell, pump, wellMatchParams]);

    // Match Logic for Selected Well
    const { curveData, matchPoint } = useMemo(() => {
        if (!selectedWell || !pump || !wellMatchParams.historyMatch) return { curveData: [], matchPoint: null };

        const test = selectedWell.productionTest;

        const steps = 50;
        const maxQ = (pump.maxRate || (pump as any).maxFlow || 3000) * 1.5;
        const data: any[] = [];

        for (let i = 0; i <= steps; i++) {
            const q = (maxQ / steps) * i;
            const point: any = { flow: q };

            // Design Curve (60Hz or Design Freq)
            const dRatio = 60 / 60; // Simplified
            const dH = (pump.h0 + pump.h1 * q + pump.h2 * q ** 2 + pump.h3 * q ** 3 + pump.h4 * q ** 4 + pump.h5 * q ** 5 + pump.h6 * q ** 6) * pump.stages;
            point.headNew = dH > 0 ? dH : null;

            // Actual Curve (Field Freq)
            const fRatio = test.freq / 60;
            const qAdj = q / fRatio;
            const hBase = (pump.h0 + pump.h1 * qAdj + pump.h2 * qAdj ** 2 + pump.h3 * qAdj ** 3 + pump.h4 * qAdj ** 4 + pump.h5 * qAdj ** 5 + pump.h6 * qAdj ** 6) * pump.stages;
            const hActual = hBase * (fRatio ** 2);
            point.headCurr = hActual > 0 ? hActual : null;

            try {
                // Use the rigorous nodal analysis function from utils instead of the simplified linear estimate
                const sysH = calculateTDH(q, wellMatchParams);
                point.systemCurve = sysH;
            } catch (e) { }

            data.push(point);
        }

        const actualTDH = (test.pdp > 0 && test.pip > 0)
            ? (test.pdp - test.pip) / 0.43
            : (test.thp * 2.31 + selectedWell.depthMD * 0.43 - test.pip * 2.31) / 0.43; // Fallback estimate

        return {
            curveData: data,
            matchPoint: { flow: test.rate, head: actualTDH }
        };
    }, [selectedWell, params, pump, wellMatchParams]);

    const operationalResults = useMemo(() =>
        selectedWell && pump && wellMatchParams.historyMatch ? calculateSystemResults(selectedWell.productionTest.rate, (selectedWell.productionTest.pip * 2.31) || 0, wellMatchParams, pump, selectedWell.productionTest.freq) : null,
        [selectedWell, pump, wellMatchParams]);

    const maxCapacityInfo = useMemo(() => {
        if (!selectedWell || !pump || selectedWell.status !== 'normal') return null;
        return computeWellCapacity(selectedWell, wellMatchParams, pump);
    }, [selectedWell, pump, wellMatchParams]);

    const { avgGlobalHealth, alertCount, globalEfficiency } = useMemo(() => {
        if (fleet.length === 0) return { avgGlobalHealth: 0, alertCount: 0, globalEfficiency: 0 };
        const alerts = fleet.filter(w => getWellHealthScore(w) < 40).length;
        const avg = Math.round(fleet.reduce((acc, w) => acc + getWellHealthScore(w), 0) / fleet.length);

        // Efficiency: (Sum of ConsumptionTheo / Sum of ConsumptionReal) for running fleet
        const runningWells = fleet.filter(w => w.currentRate > 5 && w.consumptionReal > 0);
        const totalTheo = runningWells.reduce((acc, w) => acc + (w.consumptionTheo || 0), 0);
        const totalReal = runningWells.reduce((acc, w) => acc + (w.consumptionReal || 0), 0);
        const efficiency = totalReal > 0 ? (totalTheo / totalReal) * 100 : 92.8;

        return { avgGlobalHealth: avg, alertCount: alerts, globalEfficiency: Math.round(Math.min(100, efficiency)) };
    }, [fleet]);

    const normalWellCapacities = useMemo(() => {
        const capacities: Record<string, ReturnType<typeof computeWellCapacity>> = {};
        if (fleet.length === 0 || !!selectedWell) return capacities;

        fleet.forEach(well => {
            if (well.status === 'normal' && well.productionTest.hasMatchData) {
                const wellNameUpper = well.name.toUpperCase().trim();
                let wellDesign = customDesigns[wellNameUpper];
                if (!wellDesign) {
                    const shortName = wellNameUpper.replace(/^W-|^WELL-/, '');
                    const key = Object.keys(customDesigns).find(k => k.replace(/^W-|^WELL-/, '') === shortName || k === wellNameUpper);
                    if (key) wellDesign = customDesigns[key];
                }
                const wParams = wellDesign || params;

                let wPump = null;
                if (wellDesign) {
                    const findPump = (obj: any): EspPump | null => {
                        if (!obj || typeof obj !== 'object') return null;
                        if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                        for (let k in obj) {
                            const found = findPump(obj[k]);
                            if (found) return found;
                        }
                        return null;
                    }
                    wPump = findPump(wellDesign);
                }
                wPump = wPump || providedPump || FALLBACK_PUMP;

                const mp: SystemParams = {
                    ...wParams,
                    historyMatch: {
                        rate: well.productionTest.rate,
                        frequency: well.productionTest.freq,
                        waterCut: well.productionTest.waterCut,
                        thp: well.productionTest.thp,
                        tht: 0,
                        pip: well.productionTest.pip,
                        pd: 0,
                        fluidLevel: 0,
                        submergence: 0,
                        pStatic: wParams.inflow?.pStatic || 0,
                        startDate: wParams.historyMatch?.startDate || '',
                        matchDate: well.productionTest.date,
                        gor: well.productionTest.gor
                    }
                };

                capacities[well.id] = computeWellCapacity(well, mp, wPump as EspPump);
            }
        });
        return capacities;
    }, [fleet, customDesigns, params, providedPump, selectedWell]);




    const renderDetailedWellView = () => {
        if (!selectedWell) return null;

        const isESP = !selectedWell.als || selectedWell.als.toUpperCase() === 'ESP';
        if (!isESP) {
            return (
                <div className="flex flex-col gap-8 p-10 items-center justify-center min-h-[700px] animate-fadeIn">
                    <div className="w-32 h-32 bg-warning/10 rounded-full border border-warning/20 flex items-center justify-center shadow-glow-warning/20">
                        <LockIcon className="w-16 h-16 text-warning" />
                    </div>
                    <div className="text-center space-y-4 max-w-2xl">
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{language === 'es' ? 'Sistema No Soportado' : 'Unsupported System'}</h2>
                        <p className="text-lg font-medium text-txt-muted leading-relaxed">
                            El pozo ({selectedWell.name}) utiliza un sistema de levantamiento <strong className="text-warning uppercase tracking-widest text-sm">{selectedWell.als}</strong>.
                            Actualmente, el tablero de monitoreo avanzado esta optimizado exclusivamente para sistemas <strong className="text-primary">ESP (Bombeo Electrosumergible)</strong>.
                        </p>
                        <div className="pt-6">
                            <p className="text-[10px] font-black text-txt-muted uppercase tracking-[0.4em]">Modulos para otros sistemas en desarrollo</p>
                        </div>
                    </div>
                </div>
            );
        }

        const isSynced = !!customDesigns[selectedWell.name.toUpperCase().trim()] || !!Object.keys(customDesigns).find(k => fuzzyWellName(k) === fuzzyWellName(selectedWell.name));
        const isMatchComplete = isWellMatchComplete(selectedWell);

        // Derive physical health for BHA coloring
        const wellNorm = fuzzyWellName(selectedWell.name);
        const customDesign = Object.entries(customDesigns).find(([k]) => fuzzyWellName(k) === wellNorm)?.[1];

        // Resolve pump
        const isPendiente = selectedWell.estadoActual === 'pendiente';
        let pump = isPendiente ? null : providedPump;
        if (customDesign && !isPendiente) {
            const findPump = (obj: any): EspPump | null => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.stages && (obj.h0 || obj.h1)) return obj as EspPump;
                for (let k in obj) {
                    const found = findPump(obj[k]);
                    if (found) return found;
                }
                return null;
            }
            pump = findPump(customDesign) || pump;
        }
        if (!isPendiente) {
            pump = pump || null;
        }



        const q = selectedWell.productionTest.rate || 0.1;
        const f = selectedWell.productionTest.freq || 60;
        const pMD = selectedWell.depthMD || 5000;
        const mMD = pMD + 100;
        const estGrad = 0.35; // Default assumption

        // Use the actual design pStatic if available, otherwise estimate it but floor it safely
        const estPStatic = (customDesign && customDesign.inflow && customDesign.inflow.pStatic > 0)
            ? customDesign.inflow.pStatic
            : Math.max(50, (mMD * estGrad) - 1000);

        const designStartDate =
            customDesign?.historyMatch?.startDate ||
            (customDesign as any)?.startDate ||
            (customDesign as any)?.fechaArranque ||
            (customDesign as any)?.fecha_arranque ||
            '';
        const designRunLife =
            String(customDesign?.historyMatch?.runLife ?? (customDesign as any)?.runLife ?? '').trim();

        const historyData: HistoryMatchData = {
            rate: selectedWell.productionTest.rate,
            frequency: selectedWell.productionTest.freq,
            waterCut: selectedWell.productionTest.waterCut,
            thp: selectedWell.productionTest.thp,
            tht: selectedWell.productionTest.tht || 80,
            pip: selectedWell.productionTest.pip,
            pd: selectedWell.productionTest.pdp || 0,
            pdp: selectedWell.productionTest.pdp,
            fluidLevel: 0,
            submergence: 0,
            pStatic: estPStatic,
            startDate: designStartDate,
            matchDate: selectedWell.productionTest.date,
            gor: selectedWell.productionTest.gor,
            runLife: designRunLife as any
        };

        const wellMatchParams: SystemParams = customDesign ? {
            ...customDesign,
            motorExactFound: (customDesign as any)?.motorExactFound ?? !!customDesign?.selectedMotor,
            historyMatch: historyData
        } : {
            ...INITIAL_PARAMS,
            motorExactFound: false,
            metadata: { ...INITIAL_PARAMS.metadata, wellName: selectedWell.name },
            pressures: { ...INITIAL_PARAMS.pressures, totalRate: q, pumpDepthMD: pMD, pht: selectedWell.productionTest.thp || 80 },
            wellbore: { ...INITIAL_PARAMS.wellbore, tubingBottom: pMD, midPerfsMD: mMD },
            inflow: { ...INITIAL_PARAMS.inflow, pStatic: estPStatic, ip: q / 500 || 1.0 },
            historyMatch: historyData
        };

        const physicalHealth = {
            pump: selectedWell.health.pump,
            motor: selectedWell.health.motor,
            seal: selectedWell.health.seal,
            cable: selectedWell.health.cable,
            vsd: (selectedWell.predictive.vsdStatus === 'alert') ? 'alert' : (selectedWell.predictive.vsdStatus === 'caution' ? 'caution' : 'normal') as any
        };

        const hasPumpExact = !!pump;
        const hasMotorExact = !!wellMatchParams.selectedMotor;
        const baseFreq = pump?.nameplateFrequency || 60;
        const ratio = f / baseFreq;
        const head = hasPumpExact ? calculateBaseHead(q / ratio, pump) * Math.pow(ratio, 2) : 0;
        const liveBhaResults = hasPumpExact
            ? (calculateSystemResults(q, head, wellMatchParams, pump, f) || {
                pip: selectedWell.productionTest.pip,
                // Only use consumptionReal as a motorLoad proxy if a motor is actually defined
                motorLoad: hasMotorExact ? Math.abs(selectedWell.consumptionReal) : 0
            })
            : null;
        const safeBhaResults = liveBhaResults || { fluidLevel: 0, fluidLevelMD: 0, submergenceFt: 0, pumpIntakePressure: 0, motorLoad: 0, pip: 0 };

        if (isPendiente) {
            return (
                <div className="flex flex-col gap-8 p-10 items-center justify-center min-h-[700px] animate-fadeIn">
                    <div className="w-32 h-32 bg-slate-500/10 rounded-full border border-slate-500/20 flex items-center justify-center shadow-glow-slate/20">
                        <Clock className="w-16 h-16 text-slate-400" />
                    </div>
                    <div className="text-center space-y-4 max-w-2xl">
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{language === 'es' ? 'Estado: Pendiente' : 'Status: Pending'}</h2>
                        <p className="text-lg font-medium text-txt-muted leading-relaxed">
                            Este pozo ({selectedWell.name}) ha sido marcado como <strong className="text-primary uppercase tracking-widest text-sm">Pendiente</strong> en la base de datos de diseno.
                            Actualmente no se encuentra en operacion y no cuenta con un sistema de levantamiento artificial (ESP) instalado.
                        </p>
                        <div className="flex flex-col items-center gap-2 pt-6">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">{language === 'es' ? 'Acciones Disponibles' : 'Available Actions'}</span>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => onNavigateToDesign?.(wellMatchParams, pump)}
                                    className="px-8 py-3 bg-primary text-white font-black uppercase tracking-widest text-[11px] shadow-glow-primary/40 hover:scale-105 transition-all"
                                >
                                    Ver Diseno Planificado
                                </button>
                                <button
                                    onClick={() => setWellViewMode('history')}
                                    className="px-8 py-3 bg-white/10 text-white font-black uppercase tracking-widest text-[11px] border border-white/20 hover:bg-white/20 transition-all"
                                >
                                    Ver Historial de Match
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Placeholder for BHA area to maintain layout balance */}
                    <div className="w-full max-w-4xl grid grid-cols-3 gap-6 mt-12 opacity-40 grayscale">
                        <div className="h-32 glass-surface border border-white/5 p-6 flex flex-col justify-center items-center gap-2">
                            <Target className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{language === 'es' ? 'Sin Equipo' : 'No Equipment'}</span>
                        </div>
                        <div className="h-32 glass-surface border border-white/5 p-6 flex flex-col justify-center items-center gap-2">
                            <Database className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Sin Telemetria</span>
                        </div>
                        <div className="h-32 glass-surface border border-white/5 p-6 flex flex-col justify-center items-center gap-2">
                            <Monitor className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{language === 'es' ? 'Sin Registro' : 'No Records'}</span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-2 animate-fadeIn px-1.5 py-1 pb-12 relative">
                {/* NO MATCH DATA WARNING */}
                {!isMatchComplete && (
                    <div className="mb-3 bg-danger/10 border border-danger/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-glow-danger/5 animate-fadeIn backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-danger/20 rounded-lg border border-danger/25 text-danger shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-danger uppercase tracking-tight">
                                    {language === 'es' ? 'Faltan Datos de Cotejo (Match)' : 'Missing Match Data'}
                                </h3>
                                <p className="text-[11px] font-medium text-danger/80 mt-0.5 leading-normal">
                                    {language === 'es' 
                                        ? 'Complete los campos de telemetría o suba un reporte para habilitar el análisis nodal.' 
                                        : 'Please enter telemetry data or upload a report to enable nodal analysis.'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => importDbRef.current?.click()}
                            className="shrink-0 px-4 py-2 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 rounded-lg font-black uppercase tracking-widest text-[9px] transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                        >
                            <Database className="w-3.5 h-3.5" />
                            {language === 'es' ? 'Subir Reporte' : 'Upload Report'}
                        </button>
                    </div>
                )}

                {/* NO SURVEY DATA WARNING */}
                {wellMatchParams.survey.length === 0 && (
                    <div className="mb-3 bg-warning/10 border border-warning/20 p-4 rounded-xl flex items-start gap-4 shadow-glow-warning/5 animate-fadeIn backdrop-blur-md">
                        <div className="p-2.5 bg-warning/20 rounded-lg border border-warning/25 text-warning shrink-0">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-warning uppercase tracking-tight">
                                {language === 'es' ? 'Trayectoria No Vinculada' : 'No Survey Linked'}
                            </h3>
                            <p className="text-[11px] font-medium text-warning/80 mt-0.5 leading-normal">
                                {language === 'es' 
                                    ? `No se encontró trayectoria para "${selectedWell.name}". Se asume pozo vertical para cálculos de TVD.` 
                                    : `No survey found for "${selectedWell.name}". Vertical wellpath assumed for TVD calculations.`}
                            </p>
                        </div>
                    </div>
                )}
                {/* WELL HEADER TOOLBAR */}
                {(() => {
                    const currentHealth = wellHealthMap[selectedWell.id] || 0;
                    const healthLabel = currentHealth >= 90 ? 'OPTIMAL' : currentHealth >= 60 ? 'CAUTION' : 'CRITICAL';
                    const healthClass = currentHealth >= 90 ? 'text-success bg-success/10 border-success/25' : currentHealth >= 60 ? 'text-warning bg-warning/10 border-warning/25' : 'text-danger bg-danger/10 border-danger/25';
                    const toolbarBtn = 'h-8 md:h-9 px-2.5 md:px-3.5 rounded-none text-[8px] font-black uppercase tracking-widest transition-all border flex items-center gap-1 md:gap-1.5 shrink-0';
                    return (
                        <>
                            <div className="sticky top-0 z-[100] flex flex-row items-center justify-between gap-2 md:gap-3 bg-surface/95 backdrop-blur-xl py-2 px-2 md:py-3 md:px-3 border border-white/10 border-t-2 border-t-primary/40 shadow-lg w-full overflow-x-auto md:overflow-visible custom-scrollbar-h overflow-y-visible">
                                {/* Left: back + well selector */}
                                <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                                    <div className="flex items-center gap-1.5 md:gap-3">
                                        <button onClick={onBack} className="h-8 w-8 md:h-11 md:w-11 flex items-center justify-center bg-white/5 hover:bg-primary/15 border border-white/10 text-txt-muted hover:text-primary transition-all shrink-0" title="Regresar al Inicio">
                                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                                        </button>
 
                                        <div className="relative min-w-0 overflow-visible z-[60]" ref={wellDropdownRef}>
                                            <button
                                                onClick={() => {
                                                    if (!isWellDropdownOpen) {
                                                        setVisibleCount(50);
                                                    }
                                                    setIsWellDropdownOpen(!isWellDropdownOpen);
                                                }}
                                                className={`h-8 md:h-11 flex items-center gap-1.5 md:gap-3 pl-2.5 pr-2 md:pl-4 md:pr-3 border transition-all max-w-[160px] md:max-w-[min(400px,65vw)] ${isWellDropdownOpen ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-white/5 hover:bg-white/10 border-white/10'}`}
                                            >
                                                <Monitor className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary shrink-0" />
                                                <span className="text-xs md:text-xl font-black text-txt-main tracking-tighter uppercase truncate drop-shadow-sm">{selectedWell.name}</span>
                                                <span className={`hidden sm:inline text-[9px] font-black px-2 py-0.5 border uppercase tracking-widest shrink-0 ${healthClass}`}>{healthLabel}</span>
                                                <ChevronRight className={`w-3.5 h-3.5 md:w-4 md:h-4 text-txt-muted shrink-0 transition-transform ${isWellDropdownOpen ? 'rotate-90' : ''}`} />
                                            </button>
 
                                            {isWellDropdownOpen && (() => {
                                                const dropdownContent = (
                                                    <>
                                                        {/* Backdrop for mobile to prevent background interactions and overlap issues */}
                                                        <div 
                                                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] md:hidden"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsWellDropdownOpen(false);
                                                            }}
                                                        />
                                                        <div
                                                            ref={wellDropdownPanelRef}
                                                            className="fixed md:absolute top-[8%] md:top-full left-4 right-4 md:left-0 md:right-auto mt-2 z-[9999] md:z-[500] flex flex-col bg-surface border border-white/15 border-t-2 border-t-primary/50 shadow-[0_28px_80px_rgba(0,0,0,0.55)] w-[calc(100vw-32px)] md:w-[580px] h-[80vh] md:h-auto max-h-[80vh] md:max-h-[82vh] overflow-hidden"
                                                        >
                                                            <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-secondary/5">
                                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="p-1.5 bg-primary/15 border border-primary/25 text-primary">
                                                                            <List className="w-4 h-4" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[9px] font-black text-txt-muted uppercase tracking-[0.2em]">{language === 'es' ? 'Flota de Pozos' : 'Well Fleet'}</p>
                                                                            <p className="text-xs font-black text-txt-main uppercase tracking-tight">{sortedFleet.length} {language === 'es' ? 'registros' : 'records'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setIsWellDropdownOpen(false)}
                                                                        className="h-7 w-7 flex items-center justify-center border border-white/10 hover:border-primary/30 hover:bg-primary/10 text-txt-muted hover:text-primary transition-all"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                                <DebouncedSearchInput
                                                                    value={searchTerm}
                                                                    onChange={setSearchTerm}
                                                                    placeholder={language === 'es' ? 'Buscar pozo...' : 'Search well...'}
                                                                />
                                                                <div className="flex items-center gap-1 bg-canvas/50 p-0.5 border border-white/5 mt-2">
                                                                    <button onClick={(e) => { e.stopPropagation(); setDataFilter('all'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'all' ? 'bg-primary text-white' : 'text-txt-muted hover:bg-white/5'}`}>Datos: Todos</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setDataFilter('complete'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'complete' ? 'bg-success/20 text-success' : 'text-txt-muted hover:bg-white/5'}`}>Completos</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setDataFilter('missing'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'missing' ? 'bg-warning/20 text-warning' : 'text-txt-muted hover:bg-white/5'}`}>Faltan</button>
                                                                </div>
                                                                <div className="flex items-center gap-1 bg-canvas/50 p-0.5 border border-white/5 mt-1.5">
                                                                    <button onClick={(e) => { e.stopPropagation(); setHealthFilter('all'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'all' ? 'bg-primary text-white' : 'text-txt-muted hover:bg-white/5'}`}>Salud: Todos</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setHealthFilter('healthy'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'healthy' ? 'bg-success/20 text-success' : 'text-txt-muted hover:bg-white/5'}`}>Healthy</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setHealthFilter('caution'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'caution' ? 'bg-warning/20 text-warning' : 'text-txt-muted hover:bg-white/5'}`}>Caution</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setHealthFilter('critical'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'critical' ? 'bg-danger/20 text-danger' : 'text-txt-muted hover:bg-white/5'}`}>Critical</button>
                                                                </div>
                                                                <div className="flex items-center gap-1 bg-canvas/50 p-0.5 border border-white/5 mt-1.5">
                                                                    <button onClick={(e) => { e.stopPropagation(); setStatusFilter('all'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${statusFilter === 'all' ? 'bg-primary text-white' : 'text-txt-muted hover:bg-white/5'}`}>Estado: Todos</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setStatusFilter('operativo'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${statusFilter === 'operativo' ? 'bg-success/20 text-success' : 'text-txt-muted hover:bg-white/5'}`}>Operativo</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setStatusFilter('fallado'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${statusFilter === 'fallado' ? 'bg-danger/20 text-danger' : 'text-txt-muted hover:bg-white/5'}`}>Fallado</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setStatusFilter('pull'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${statusFilter === 'pull' ? 'bg-warning/20 text-warning' : 'text-txt-muted hover:bg-white/5'}`}>Pull</button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setStatusFilter('pendiente'); }} className={`h-7 px-2.5 rounded-md flex items-center justify-center transition-all text-[7px] font-black uppercase tracking-widest flex-1 ${statusFilter === 'pendiente' ? 'bg-slate-500/20 text-slate-400' : 'text-txt-muted hover:bg-white/5'}`}>Pendiente</button>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-h-[420px] overflow-y-auto custom-scrollbar p-2 bg-canvas/25" onScroll={handleDropdownScroll}>
                                                                {sortedFleet.length === 0 ? (
                                                                    <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center opacity-50 px-6">
                                                                        <Search className="w-8 h-8 text-txt-muted mb-3" />
                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-txt-muted">{language === 'es' ? 'Sin pozos con ese filtro' : 'No wells match filters'}</p>
                                                                    </div>
                                                                ) : (
                                                                    sortedFleet.slice(0, visibleCount).map(well => (
                                                                        <WellListItem
                                                                            key={well.id}
                                                                            well={well}
                                                                            health={wellHealthMap[well.id] || 0}
                                                                            isActive={well.id === selectedWellId}
                                                                            isMechVerified={customDesigns[fuzzyWellName(well.name)]?.isMechVerified}
                                                                            onSelect={(id: string) => {
                                                                                setSelectedWellId(id);
                                                                                setWellViewMode('monitoring');
                                                                                setIsWellDropdownOpen(false);
                                                                                setSearchTerm('');
                                                                            }}
                                                                        />
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                                return isMobile ? createPortal(dropdownContent, document.body) : dropdownContent;
                                            })()}
                                        </div>
                                    </div>
                                </div>
 
                                <div className="w-px h-6 bg-white/10 shrink-0" />
 
                                {/* Center: primary actions */}
                                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                                    <button
                                        onClick={() => importDbRef.current?.click()}
                                        className={`${toolbarBtn} bg-secondary/10 text-secondary border-secondary/25 hover:bg-secondary/20`}
                                        title="Subir prueba de produccion puntual (CSV/Excel)"
                                    >
                                        <Database className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{language === 'es' ? 'Subir Prueba' : 'Upload Test'}</span>
                                    </button>
 
                                    {onNavigateToDesign && (
                                        <SecureWrapper isLocked={true} tooltip="Modulo de Diseno Restringido">
                                            <button
                                                onClick={() => onNavigateToDesign(wellMatchParams, pump)}
                                                className={`${toolbarBtn} bg-primary/10 text-primary border-primary/25 hover:bg-primary hover:text-white`}
                                                title="Ir a Diseno (Phase 5)"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">{language === 'es' ? 'Diseno' : 'Design'}</span>
                                            </button>
                                        </SecureWrapper>
                                    )}
 
                                    <SecureWrapper isLocked={true} tooltip="Modulo de Ajuste Historico Restringido">
                                        <button
                                            onClick={() => setWellViewMode(wellViewMode === 'history' ? 'monitoring' : 'history')}
                                            className={`${toolbarBtn} ${wellViewMode === 'history' ? 'bg-primary text-white border-primary' : 'bg-success/10 text-success border-success/25 hover:bg-success/20'}`}
                                        >
                                            {wellViewMode === 'history' ? <Activity className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                                            <span className="hidden sm:inline">{wellViewMode === 'history' ? (language === 'es' ? 'Monitoreo' : 'Monitoring') : (language === 'es' ? 'Historico' : 'History')}</span>
                                        </button>
                                    </SecureWrapper>
 
                                    <button
                                        onClick={handleForceSync}
                                        disabled={isSyncingOneDrive}
                                        className={`${toolbarBtn} bg-success/10 text-success border-success/25 hover:bg-success/20 disabled:opacity-50`}
                                        title="Sincronizar OneDrive en Caliente"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOneDrive ? 'animate-spin' : ''}`} />
                                        <span className="hidden sm:inline">{isSyncingOneDrive ? (language === 'es' ? 'Sincronizando...' : 'Syncing...') : (language === 'es' ? 'Sincronizar' : 'Sync')}</span>
                                    </button>
                                </div>
 
                                <div className="w-px h-6 bg-white/10 shrink-0" />
 
                                {/* Right: settings */}
                                <div className="flex items-center gap-1 md:gap-1.5 bg-white/5 p-0.5 md:p-1 border border-white/10 shrink-0 ml-auto">
                                    <a
                                        href="https://1drv.ms/x/c/06cc4035ad46ff97/IQClWg69qziUQZ4pcxlcyoF5AdzaFbqGWhkSVp1rxJKvfwQ?e=Zuk6P7"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-8 px-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/25 rounded-none text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shrink-0"
                                        title={language === 'es' ? 'Abrir Excel de Diseño' : 'Open Design Excel'}
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{language === 'es' ? 'Diseño' : 'Design'}</span>
                                    </a>
 
                                    <a
                                        href="https://1drv.ms/x/c/06cc4035ad46ff97/IQCX60W0l5YeQbDd8jHpZlMJAa0JHU31uqYaXJU1Tawo8I8?e=SD43E4"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-8 px-2.5 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white border border-secondary/25 rounded-none text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shrink-0"
                                        title={language === 'es' ? 'Abrir Excel de Pruebas' : 'Open Tests Excel'}
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{language === 'es' ? 'Pruebas' : 'Tests'}</span>
                                    </a>
 
                                    <button onClick={toggleLanguage} className="h-8 px-2.5 hover:bg-white/10 rounded-none transition-all text-[8px] font-black font-mono text-txt-main tracking-widest uppercase flex items-center gap-1">
                                        <Globe className="w-3 text-primary" /> {language}
                                    </button>
                                    <button onClick={cycleTheme} className="h-8 w-8 flex items-center justify-center hover:bg-white/10 rounded-none transition-all text-txt-muted hover:text-primary" title="Cambiar Tema">
                                        <Palette className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isMobile) {
                                                setZoomLevel(prev => prev <= 0.6 ? 0.75 : 0.55);
                                            } else {
                                                setZoomLevel(prev => prev === 1 ? 0.8 : 1);
                                            }
                                        }}
                                        className="h-8 w-8 flex items-center justify-center hover:bg-white/10 rounded-none transition-all text-txt-muted hover:text-primary"
                                        title={isMobile 
                                            ? (zoomLevel <= 0.6 ? "Aumentar Escala (75%)" : "Reducir Escala (55%)")
                                            : (zoomLevel === 1 ? "Reducir Escala (80%)" : "Aumentar Escala (100%)")
                                        }
                                    >
                                        {isMobile 
                                            ? (zoomLevel <= 0.6 ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />)
                                            : (zoomLevel === 1 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />)
                                        }
                                    </button>
                                </div>
                            </div>
                        </>
                    );
                })()}

                {wellViewMode === 'history' ? (
                    <MatchHistorico
                        wellName={selectedWell.name}
                        pump={pump}
                        designParams={wellMatchParams}
                        productionHistory={wellsHistoricalData[fuzzyWellName(selectedWell.name)]}
                        onImport={() => importWellHistoryRef.current?.click()}
                        onClose={() => setWellViewMode('monitoring')}
                    />
                ) : (
                    <div className="flex flex-col gap-2 relative z-10 mt-1">
                        {/* THE AI COMMENT - FLOATING BUBBLE */}
                        <PredictiveWidget
                            selectedWell={selectedWell}
                            wellMatchParams={wellMatchParams}
                            pump={pump}
                            computeWellCapacity={computeWellCapacity}
                            getOptimizationPath={getOptimizationPath}
                        />

                        {/* COMPACT ANALYTICS SECTION: PHASE 6 + BHA SCHEME */}
                        <div className="flex flex-col md:flex-row gap-2 items-stretch w-full min-h-[900px] relative">
                            {/* NARROW SIDEBAR CONTROL AREA */}
                            <div className="flex flex-row md:flex-col gap-3 shrink-0 w-full md:w-16 bg-surface/40 border border-white/5 backdrop-blur-md p-2 justify-center md:justify-start items-center relative z-50">
                                {/* TAB: BHA */}
                                <button
                                    onClick={() => {
                                        setIsBhaMinimized(!isBhaMinimized);
                                        if (isBhaMinimized) setIsTrajectoryMinimized(true); // Exclusión mutua
                                    }}
                                    className={`w-full md:w-12 h-12 md:h-[350px] rounded-none flex flex-row md:flex-col items-center justify-center gap-2 md:gap-3 transition-all duration-300 border ${!isBhaMinimized
                                        ? 'bg-primary border-primary shadow-glow-primary text-canvas'
                                        : 'bg-primary/5 text-txt-muted border-primary/10 hover:bg-primary/15 hover:text-primary hover:border-primary/25'
                                        }`}
                                    style={{
                                        color: !isBhaMinimized ? 'rgb(var(--color-canvas))' : undefined
                                    }}
                                    title={language === 'es' ? 'Ver BHA ESP' : 'View ESP BHA'}
                                >
                                    <Layers className="w-4 h-4 shrink-0" />
                                    <span className="hidden md:inline [writing-mode:vertical-lr] text-[9px] font-black uppercase tracking-[0.2em] transform rotate-180 whitespace-nowrap">
                                        {language === 'es' ? 'VER BHA ESP' : 'VIEW ESP BHA'}
                                    </span>
                                    <span className="inline md:hidden text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                                        {language === 'es' ? 'BHA ESP' : 'ESP BHA'}
                                    </span>
                                </button>

                                {/* TAB: TRAYECTORIA */}
                                <button
                                    onClick={() => {
                                        setIsTrajectoryMinimized(!isTrajectoryMinimized);
                                        if (isTrajectoryMinimized) setIsBhaMinimized(true); // Exclusión mutua
                                    }}
                                    className={`w-full md:w-12 h-12 md:h-[350px] rounded-none flex flex-row md:flex-col items-center justify-center gap-2 md:gap-3 transition-all duration-300 border ${!isTrajectoryMinimized
                                        ? 'bg-primary border-primary shadow-glow-primary text-canvas'
                                        : 'bg-primary/5 text-txt-muted border-primary/10 hover:bg-primary/15 hover:text-primary hover:border-primary/25'
                                        }`}
                                    style={{
                                        color: !isTrajectoryMinimized ? 'rgb(var(--color-canvas))' : undefined
                                    }}
                                    title={language === 'es' ? 'Ver Trayectoria' : 'View Trajectory'}
                                >
                                    <Compass className="w-4 h-4 animate-[spin_12s_linear_infinite] shrink-0" />
                                    <span className="hidden md:inline [writing-mode:vertical-lr] text-[9px] font-black uppercase tracking-[0.2em] transform rotate-180 whitespace-nowrap">
                                        {language === 'es' ? 'TRAYECTORIA' : 'TRAJECTORY'}
                                    </span>
                                    <span className="inline md:hidden text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                                        {language === 'es' ? 'TRAYECTORIA' : 'TRAJECTORY'}
                                    </span>
                                </button>
                            </div>

                            {/* OVERLAY: BHA DIGITAL TWIN */}
                            {!isBhaMinimized && (
                                <div className="absolute md:left-[72px] left-0 top-0 bottom-0 w-full md:w-[540px] max-w-full md:max-w-[calc(100vw-120px)] z-40 glass-surface border border-white/10 shadow-3xl flex flex-col animate-slideRight">
                                    <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
                                        <button
                                            onClick={() => setIsBhaMinimized(true)}
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-sm transition-all border border-white/5 text-primary"
                                            title="Minimizar BHA"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-secondary/10 rounded-sm text-secondary border border-secondary/20"><Layers className="w-4 h-4" /></div>
                                            <h3 className="text-xs font-black text-txt-main uppercase tracking-widest">Esquema BHA</h3>
                                        </div>
                                        <Activity className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex-1 relative bg-canvas/40 overflow-hidden flex items-center justify-center p-4">
                                        <div className="absolute inset-0 opacity-10 pointer-events-none blueprint-grid"></div>
                                        <div className="h-full origin-top flex items-center justify-center w-full">
                                            {hasPumpExact ? (
                                                <VisualESPStack
                                                    pump={pump}
                                                    motor={wellMatchParams.selectedMotor || undefined}
                                                    params={wellMatchParams}
                                                    results={safeBhaResults}
                                                    frequency={f}
                                                    health={physicalHealth as any}
                                                    selectedVSD={wellMatchParams.selectedVSD}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-danger/5 border border-danger/20">
                                                    <AlertTriangle className="w-10 h-10 text-danger mb-4" />
                                                    <h4 className="text-sm font-black uppercase tracking-widest text-danger">
                                                        {language === 'es' ? 'BOMBA NO ENCONTRADA' : 'PUMP NOT FOUND'}
                                                    </h4>
                                                    <p className="text-[11px] font-bold text-txt-muted mt-3 max-w-md leading-relaxed">
                                                        {language === 'es'
                                                            ? 'No encontramos datos o coeficientes de la bomba. Agregue coeficientes en COEF.'
                                                            : 'Pump data/coefficients not found. Add coefficients in COEF.'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* OVERLAY: TRAYECTORIA */}
                            {!isTrajectoryMinimized && (
                                <div className="absolute md:left-[80px] left-0 top-0 h-[90vh] max-h-[950px] min-h-[600px] w-full md:w-[1200px] max-w-full md:max-w-[calc(100vw-120px)] z-40 glass-surface rounded-br-3xl rounded-tr-3xl overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.6)] flex flex-col animate-slideRight animate-fadeIn">
                                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-surface-raised backdrop-blur-md">
                                        <button
                                            onClick={() => setIsTrajectoryMinimized(true)}
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-sm transition-all border border-white/5 text-primary"
                                            title="Minimizar Trayectoria"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-primary/10 rounded-sm text-primary border border-primary/20"><Compass className="w-4 h-4 animate-[spin_8s_linear_infinite]" /></div>
                                            <h3 className="text-xs font-black text-txt-main uppercase tracking-widest font-mono">Trayectoria</h3>
                                        </div>
                                        <Globe className="w-4 h-4 text-secondary animate-pulse" />
                                    </div>
                                    <div className="flex-1 relative bg-canvas/40 overflow-hidden flex flex-col p-4">
                                        {wellMatchParams.survey && wellMatchParams.survey.length > 0 ? (
                                            <div className="flex-1 w-full h-full min-h-0">
                                                {/* Se pasa isSidebar={false} para usar la versión ancha de doble columna */}
                                                <TrajectoryPlot survey={wellMatchParams.survey} params={wellMatchParams} isSidebar={false} />
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-6 animate-fadeIn">
                                                <AlertTriangle className="w-12 h-12 text-warning mb-4 animate-pulse" />
                                                <p className="text-xs font-black uppercase tracking-widest">Sin Datos de Trayectoria</p>
                                                <p className="text-[10px] font-bold text-txt-muted uppercase mt-2">No se encontro una trayectoria (survey) vinculada para el pozo "{selectedWell.name}". Los calculos utilizaran aproximacion vertical.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* MAIN PHASE 6 CANVAS ON THE RIGHT */}
                            <div className="flex-1 glass-surface rounded-none border border-white/5 shadow-3xl overflow-y-auto custom-scrollbar relative z-30" style={{ minHeight: '900px' }}>
                                <Phase6
                                    key={selectedWell.id}
                                    params={wellMatchParams}
                                    syncParams={false}
                                    onHistoryMatchChange={handleHistoryMatchChange}
                                    pump={pump}
                                    designFreq={selectedWell.productionTest.freq || 60}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderNotifications = () => {
        const alerts = fleet.filter(w => getWellHealthScore(w) < 55);

        return (
            <div className="w-full h-full bg-surface/60 backdrop-blur-xl border border-surface-light rounded-none shadow-3xl relative overflow-hidden flex flex-col group/panel">
                {/* Panel edge highlight */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

                <div className="px-8 py-8 border-b border-surface-light flex items-center justify-between bg-surface-light/10">
                    <div>
                        <h4 className="text-xl font-black text-txt-main uppercase tracking-tighter flex items-center gap-3">
                            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                            AI Alerts
                        </h4>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mt-1 opacity-70">Fleet Intelligence Radar</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-none text-[10px] font-black ${alerts.length > 0 ? 'bg-danger/10 text-danger border border-danger/30 animate-pulse shadow-glow-danger/20' : 'bg-success/10 text-success border border-success/30'} uppercase tracking-widest`}>
                        {alerts.length} Active Alarms
                    </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-canvas/30">
                    {alerts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20 animate-fadeIn">
                            <div className="p-8 bg-success/5 rounded-none mb-6 border border-success/10">
                                <ShieldCheck className="w-20 h-20 text-success" />
                            </div>
                            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Global Fleet Status<br /><span className="text-success opacity-100">Optimal</span></p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {alerts.map(w => (
                                <div key={w.id} className="p-6 bg-surface/80 border border-white/5 rounded-none animate-fadeIn hover:border-danger/40 transition-all cursor-pointer shadow-xl relative overflow-hidden group/item" onClick={() => { setSelectedWellId(w.id); }}>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-danger/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                    <div className="absolute left-0 top-8 bottom-8 w-1 bg-danger rounded-none shadow-glow-danger"></div>

                                    <div className="flex items-center justify-between mb-4 relative z-10 pl-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-none bg-danger"></div>
                                            <span className="text-[10px] font-black text-danger uppercase italic tracking-[0.2em]">Salud Critica</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-txt-muted opacity-40">{(new Date(w.lastUpdate)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <h5 className="text-xl font-black text-txt-main uppercase tracking-tighter mb-2 relative z-10 pl-2">{w.name}</h5>
                                    <p className="text-[10px] font-bold text-txt-muted leading-relaxed uppercase opacity-60 tracking-tight pl-2 mb-6">
                                        Analisis predictivo detecta degradacion acelerada del {100 - getWellHealthScore(w)}%. Posible interferencia de gas o desgaste mecanico.
                                    </p>
                                    <div className="flex justify-end relative z-10">
                                        <button className="px-6 py-2.5 bg-danger/10 text-danger text-[10px] font-black rounded-none border border-danger/20 group-hover/item:bg-danger group-hover/item:text-white transition-all tracking-widest uppercase shadow-lg shadow-danger/5">
                                            Ver Diagnostico
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (isMobile) {
        return (
            <MobileMonitoreo
                fleet={fleet}
                selectedWell={selectedWell || null}
                setSelectedWell={setSelectedWellId}
                language={language}
                t={t}
                wellMatchParams={wellMatchParams}
                pump={pump}
                onBack={onBack}
                onForceSync={handleForceSync}
                isSyncingOneDrive={isSyncingOneDrive}
                onHistoryMatchChange={handleHistoryMatchChange}
                vsdCatalog={vsdCatalog}
                clearFleet={clearFleet}
                importDesignRef={importDesignRef}
                importDbRef={importDbRef}
                importWellHistoryRef={importWellHistoryRef}
                operationalResults={operationalResults}
                onNavigateToDesign={onNavigateToDesign}
                cycleTheme={cycleTheme}
                toggleLanguage={toggleLanguage}
                wellViewMode={wellViewMode}
                setWellViewMode={setWellViewMode}
                wellsHistoricalData={wellsHistoricalData}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                dataFilter={dataFilter}
                setDataFilter={setDataFilter}
                healthFilter={healthFilter}
                setHealthFilter={setHealthFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                sortedFleet={sortedFleet}
                importProgress={importProgress}
                wellHealthMap={wellHealthMap}
            />
        );
    }

    return (
        <div style={{ zoom: zoomLevel }} className="min-h-full pb-12 px-2 py-0 transition-all duration-700">
            {/* Header Globally Removed - Controls moved to contextual bars */}

            <div className="flex gap-3 mt-1 pb-12">
                <div className="flex-1 min-w-0 transition-all duration-500">
                    {fleet.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 glass-surface rounded-none border border-white/5 min-h-[600px] animate-fadeIn mx-4 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                            {/* Decorative Background Elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-none group-hover:bg-primary/10 transition-all duration-1000"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 blur-[100px] rounded-none group-hover:bg-secondary/10 transition-all duration-1000"></div>

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="p-10 bg-gradient-to-br from-primary/20 to-transparent rounded-none mb-12 relative border border-primary/30 shadow-[0_0_50px_rgba(var(--color-primary),0.15)] group-hover:scale-110 transition-transform duration-700">
                                    <Activity className="w-24 h-24 text-primary animate-[pulse_4s_ease-in-out_infinite]" />
                                    <div className="absolute -inset-4 border border-primary/10 rounded-none animate-ping opacity-20"></div>

                                    {/* Corner Accents for Icon */}
                                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
                                </div>

                                <div className="space-y-4 text-center mb-12">
                                    <h3 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl italic">
                                        Centro de Control <span className="text-primary">ALS</span>
                                    </h3>
                                    <div className="h-1 w-32 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto"></div>
                                    <p className="text-txt-muted text-center max-w-2xl font-medium leading-relaxed text-xl opacity-60 px-10">
                                        Plataforma de monitoreo en tiempo real sincronizada. <br />
                                        <span className="text-sm font-black uppercase tracking-[0.2em] mt-4 block">Esperando inicializacion de nodos o carga de archivos maestros.</span>
                                    </p>
                                </div>

                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={() => importDesignRef.current?.click()}
                                        className="h-14 px-10 bg-primary/10 text-primary border border-primary/30 rounded-none flex items-center gap-4 hover:bg-primary hover:text-white transition-all font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/10 group/btn"
                                    >
                                        <Download className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                                        Cargar Disenos
                                    </button>
                                    <button
                                        onClick={() => importDbRef.current?.click()}
                                        className="h-14 px-10 bg-secondary/10 text-secondary border border-secondary/30 rounded-none flex items-center gap-4 hover:bg-secondary hover:text-white transition-all font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-secondary/10 group/btn"
                                    >
                                        <Database className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                                        Cargar SCADA
                                    </button>
                                    <button
                                        onClick={handleForceSync}
                                        disabled={isSyncingOneDrive}
                                        className="h-14 px-10 bg-success/10 text-success border border-success/30 rounded-none flex items-center gap-4 hover:bg-success hover:text-white transition-all font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-success/10 disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-6 h-6 ${isSyncingOneDrive ? 'animate-spin' : ''}`} />
                                        {isSyncingOneDrive ? (language === 'es' ? 'Sincronizando...' : 'Syncing...') : (language === 'es' ? 'Sincronizar OneDrive' : 'Sync OneDrive')}
                                    </button>
                                </div>

                                <div className="mt-16 flex items-center gap-12 opacity-30">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-txt-muted rounded-none"></div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.4em]">Standby</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-txt-muted rounded-none"></div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.4em]">No Data</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-txt-muted rounded-none"></div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.4em]">Secure Link</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        renderDetailedWellView()
                    )}
                </div>
            </div>

            <style>{`
                .glass-surface-light {
                    background: rgb(var(--color-surface-light) / 0.1);
                    backdrop-filter: blur(20px);
                }
                .animate-slideUp {
                    animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slideRight {
                    animation: slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideRight {
                    from { transform: translateX(-30px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .shadow-glow-danger {
                    box-shadow: 0 0 30px -5px rgba(239, 68, 68, 0.4);
                }
                @keyframes slideLeft {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes eks-scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
            `}</style>
            {showFullMatch && selectedWell && (
                <div className="fixed inset-0 z-[100] bg-canvas/95 backdrop-blur-xl animate-fadeIn overflow-hidden flex flex-col">
                    <div className="h-20 bg-surface/80 border-b border-white/10 flex items-center justify-between px-10 shrink-0 backdrop-blur-md">
                        <div className="flex items-center gap-6">
                            <div className="p-3 bg-primary/20 rounded-none border border-primary/20 shadow-glow-primary/10"><ClipboardCheck className="w-6 h-6 text-primary" /></div>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => importExcelDesignRef.current?.click()}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 rounded-none font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-glow-primary/20"
                                >
                                    <Database className="w-4 h-4" />
                                    Importar Disenos (Excel)
                                </button>
                                <button
                                    onClick={() => importDesignRef.current?.click()}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-surface-light/50 hover:bg-surface-light text-txt-main border border-white/5 rounded-none font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    Cargar JSON
                                </button>
                                <button
                                    onClick={() => importDbRef.current?.click()}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white border border-secondary/20 rounded-none font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-glow-secondary/20"
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    Cargar Historial (Match)
                                </button>
                                <button onClick={clearFleet} className="p-2.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-none border border-danger/20 transition-all" title="Limpiar Flota">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleForceSync}
                                    disabled={isSyncingOneDrive}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-success/10 hover:bg-success text-success hover:text-white border border-success/20 rounded-none font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                                    title="Sincronizar OneDrive Ahora"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isSyncingOneDrive ? 'animate-spin' : ''}`} />
                                    {isSyncingOneDrive ? (language === 'es' ? 'Sincronizando...' : 'Syncing...') : (language === 'es' ? 'Sincronizar OneDrive' : 'Sync OneDrive')}
                                </button>
                            </div>

                            <div>
                                <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.2em]">{t('p5.analyzeMatch')}</h3>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">Digital Twin - {selectedWell.name}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowFullMatch(false)} className="p-3 bg-white/5 hover:bg-danger/20 text-txt-muted hover:text-danger rounded-none border border-white/10 transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-canvas/30">
                        <Phase6
                            params={wellMatchParams}
                            syncParams={false}
                            onHistoryMatchChange={handleHistoryMatchChange}
                            pump={pump}
                            designFreq={selectedWell.productionTest.freq || 60}
                        />
                    </div>
                </div>
            )}
            <input type="file" ref={importDesignRef} className="hidden" accept=".json" multiple onChange={handleImportDesign} />
            <input type="file" ref={importDbRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleImportDb} />
            <input type="file" id="well-history-input" ref={importWellHistoryRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportWellHistory} />

            {/* FLOATING AI CHAT FOR MONITORING */}
            <FloatingAiPanel
                fleet={fleet}
                selectedWell={selectedWell}
                language={language}
                t={t}
                wellParams={wellMatchParams}
                pump={pump}
                operationalResults={operationalResults}
                productionHistory={wellsHistoricalData[fuzzyWellName(selectedWell.name)]}
            />

            {/* FULL-SCREEN IMPORT PROGRESS OVERLAY - Simplified & Minimal */}
            {importProgress && (
                <div
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
                    style={{
                        backgroundColor: 'rgb(var(--color-canvas))',
                        backgroundImage: 'linear-gradient(rgb(var(--color-canvas) / 0.85), rgb(var(--color-canvas) / 0.85)), url(/main_bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    {/* Minimal Atmosphere */}
                    <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent pointer-events-none"></div>

                    <div className="flex flex-col items-center gap-10 max-w-sm w-full relative z-10">
                        {/* Logo - Simple & Free floating - Larger */}
                        <div className="relative group animate-fadeIn">
                            <img
                                src="/LOGO.png"
                                alt="Loading..."
                                className="w-84 h-84 object-contain"
                                style={{
                                    filter: 'drop-shadow(0 0 50px rgba(var(--color-primary), 0.4))',
                                }}
                            />
                        </div>

                        <div className="w-full flex flex-col items-center gap-6 animate-fadeInUp">
                            <div className="text-center space-y-1">
                                <h3 className="text-xl font-bold text-primary uppercase tracking-[0.25em]">
                                    {importProgress.label.replace('...', '')}
                                </h3>
                                <div className="flex items-center justify-center gap-2 opacity-60">
                                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse"></span>
                                    <p className="text-[7px] font-bold text-primary uppercase tracking-[0.3em]">
                                        Sincronizando registros
                                    </p>
                                </div>
                            </div>

                            {/* Minimal Progress Bar */}
                            <div className="w-full space-y-3 px-8">
                                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_8px_rgba(var(--color-primary),0.4)]"
                                        style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}
                                    ></div>
                                </div>

                                <div className="flex justify-between items-end px-1">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[6px] font-bold text-txt-muted uppercase tracking-widest opacity-40">
                                            Telemetry Stream
                                        </span>
                                        <span className="text-[8px] font-bold text-txt-muted/70 uppercase tracking-widest">
                                            ID: {importProgress.current} / {importProgress.total}
                                        </span>
                                    </div>
                                    <span className="text-2xl font-light text-primary tracking-tighter">
                                        {Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}<span className="text-[8px] text-primary/60 ml-0.5">%</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Minimal Status Footer */}
                        <div className="flex items-center gap-6 text-[6px] font-bold uppercase tracking-[0.4em] text-primary/40 mt-4">
                            <span className="flex items-center gap-1.5"><Cpu className="w-2 h-2" /> System Ready</span>
                            <span className="w-[1px] h-2 bg-primary/10"></span>
                            <span className="flex items-center gap-1.5"><Waves className="w-2 h-2" /> Fleet Sync</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default PhaseMonitoreo;


