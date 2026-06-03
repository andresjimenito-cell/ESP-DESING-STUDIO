import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Activity, ChevronLeft, RefreshCw, Download, Database, Trash2,
    Monitor, Shield, Zap, Droplets, Thermometer, ShieldCheck,
    TrendingUp, MessageSquare, Menu, X, Send, Sparkles, AlertTriangle,
    Layers, Compass, Target, Globe, FileSpreadsheet, Settings, Palette
} from 'lucide-react';
import { WellFleetItem, EspPump, SystemParams, HistoryMatchData } from '@/types';
import { getWellHealthScore, computeWellCapacity, getOptimizationPath } from '../PhaseMonitoreo.helpers';
import { calculateSystemResults, calculateBaseHead, interpolateTVD } from '../../utils';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { VisualESPStack } from '../VisualESPStack';
import { TrajectoryPlot } from '../TrajectoryPlot';
import { Phase6 } from '../Phase6';
import { MatchHistorico } from '../MatchHistorico';
import { PredictiveWidget, DebouncedSearchInput } from '../PhaseMonitoreo.subcomponents';

interface Props {
    fleet: WellFleetItem[];
    selectedWell: WellFleetItem | null;
    setSelectedWell: (w: string | null) => void;
    language: string;
    t: any;
    wellMatchParams: SystemParams;
    pump: EspPump | null;
    onBack: () => void;
    onForceSync: () => void;
    isSyncingOneDrive: boolean;
    onHistoryMatchChange: (data: any) => void;
    vsdCatalog: any[];
    clearFleet: () => void;
    importDesignRef: React.RefObject<HTMLInputElement | null>;
    importDbRef: React.RefObject<HTMLInputElement | null>;
    importWellHistoryRef: React.RefObject<HTMLInputElement | null>;
    operationalResults: any;
    onNavigateToDesign?: (wellParams: SystemParams, pump?: EspPump | null) => void;
    cycleTheme: () => void;
    toggleLanguage: () => void;
    wellViewMode: 'monitoring' | 'history';
    setWellViewMode: (mode: 'monitoring' | 'history') => void;
    wellsHistoricalData: any;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    dataFilter: string;
    setDataFilter: (filter: 'all' | 'complete' | 'missing') => void;
    healthFilter: string;
    setHealthFilter: (filter: 'all' | 'healthy' | 'caution' | 'critical') => void;
    statusFilter: string;
    setStatusFilter: (filter: 'all' | 'operativo' | 'fallado' | 'pull' | 'pendiente') => void;
    sortedFleet: WellFleetItem[];
    importProgress: any;
    wellHealthMap: Record<string, number>;
}

export const MobileMonitoreo: React.FC<Props> = ({
    fleet,
    selectedWell,
    setSelectedWell,
    language,
    t,
    wellMatchParams,
    pump,
    onBack,
    onForceSync,
    isSyncingOneDrive,
    onHistoryMatchChange,
    vsdCatalog,
    clearFleet,
    importDesignRef,
    importDbRef,
    importWellHistoryRef,
    operationalResults,
    onNavigateToDesign,
    cycleTheme,
    toggleLanguage,
    wellViewMode,
    setWellViewMode,
    wellsHistoricalData,
    searchTerm,
    setSearchTerm,
    dataFilter,
    setDataFilter,
    healthFilter,
    setHealthFilter,
    statusFilter,
    setStatusFilter,
    sortedFleet,
    importProgress,
    wellHealthMap
}) => {
    const [activeTab, setActiveTab] = useState<'fleet' | 'analysis' | 'bha' | 'copilot'>('fleet');
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');

    useEffect(() => {
        if (showKeyModal) {
            setApiKeyInput(localStorage.getItem('openrouter_api_key') || '');
        }
    }, [showKeyModal]);

    useEffect(() => {
        const dismissed = sessionStorage.getItem('pwa-prompt-dismissed');
        if (!dismissed) {
            const timer = setTimeout(() => setShowInstallPrompt(true), 2500);
            return () => clearTimeout(timer);
        }
    }, []);

    const suggestions = useMemo(() => {
        return selectedWell ? [
            {
                es: `Analizar telemetría de ${selectedWell.name}`,
                en: `Analyze telemetry of ${selectedWell.name}`,
                prompt: `Analiza la telemetría actual del pozo ${selectedWell.name} y dime si el punto de operación es óptimo o si tiene problemas de downthrust o sobrecarga.`
            },
            {
                es: `Simular VSD a 70 Hz en ${selectedWell.name}`,
                en: `Simulate VSD at 70 Hz on ${selectedWell.name}`,
                prompt: `Simula un cambio de frecuencia a 70 Hz en el pozo ${selectedWell.name}. ¿Cuál sería el nuevo caudal estimado y cómo afectaría la carga del eje de la bomba?`
            },
            {
                es: `Evaluar sumergencia y presiones`,
                en: `Evaluate submergence and pressures`,
                prompt: `Evalúa la sumergencia actual en pies de la bomba de ${selectedWell.name}. ¿Es suficiente para evitar problemas de gas o cavitación?`
            },
            {
                es: `Recomendar optimización de producción`,
                en: `Recommend production optimization`,
                prompt: `Recomienda una estrategia de optimización para el pozo ${selectedWell.name} basada en su caudal objetivo de ${selectedWell.targetRate || 0} BPD.`
            }
        ] : [
            {
                es: "Resumen de estado de la flota",
                en: "Fleet status summary",
                prompt: "Haz un resumen rápido del estado de toda la flota de pozos y dime cuáles tienen alertas o problemas críticos."
            },
            {
                es: "Pozos con mayor desviación de caudal",
                en: "Wells with highest flow rate deviation",
                prompt: "Identifica qué pozos de la flota tienen la mayor diferencia negativa entre su caudal actual y su caudal objetivo."
            },
            {
                es: "Problemas recurrentes en la flota",
                en: "Recurrent issues in the fleet",
                prompt: "Analiza el estado general de los sensores y componentes de la flota. ¿Cuáles son las fallas predictivas más comunes hoy?"
            }
        ];
    }, [selectedWell?.id, selectedWell?.name, selectedWell?.targetRate]);

    const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const greet = selectedWell
            ? (language === 'es' ? `Hola. Analizando el pozo **${selectedWell.name}**. ¿Qué te gustaría verificar de su telemetría o simulación VSD?` : `Hello. Analyzing well **${selectedWell.name}**. What would you like to review?`)
            : (language === 'es' ? `Hola. Monitoreando **${fleet.length}** pozos. ¿Cómo te puedo ayudar hoy?` : `Hello. Monitoring **${fleet.length}** wells. How can I help?`);
        setMsgs([{ role: 'model', text: greet }]);
    }, [selectedWell?.id, language]);

    useEffect(() => {
        if (activeTab === 'copilot') {
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [msgs, activeTab]);

    const wellHealth = selectedWell ? (wellHealthMap[selectedWell.id] || 0) : 0;

    const safeBhaResults = useMemo(() => {
        if (!selectedWell || !wellMatchParams) {
            return { fluidLevel: 0, fluidLevelMD: 0, submergenceFt: 0, pumpIntakePressure: 0, motorLoad: 0, pip: 0 };
        }
        const q = selectedWell.productionTest.rate || 0.1;
        const f = selectedWell.productionTest.freq || 60;
        const baseFreq = pump?.nameplateFrequency || 60;
        const ratio = f / baseFreq;
        const head = pump ? calculateBaseHead(q / ratio, pump) * Math.pow(ratio, 2) : 0;
        const hasMotorExact = !!wellMatchParams.selectedMotor;

        const liveBhaResults = pump
            ? (calculateSystemResults(q, head, wellMatchParams, pump, f) || {
                pip: selectedWell.productionTest.pip,
                motorLoad: hasMotorExact ? Math.abs(selectedWell.consumptionReal) : 0
            })
            : null;

        return liveBhaResults || { fluidLevel: 0, fluidLevelMD: 0, submergenceFt: 0, pumpIntakePressure: 0, motorLoad: 0, pip: 0 };
    }, [selectedWell?.id, pump?.id, wellMatchParams]);

    const physicalHealth = useMemo(() => {
        if (!selectedWell) return { pump: 'normal', motor: 'normal', seal: 'normal', cable: 'normal', vsd: 'normal' };
        return {
            pump: selectedWell.health.pump,
            motor: selectedWell.health.motor,
            seal: selectedWell.health.seal,
            cable: selectedWell.health.cable,
            vsd: (selectedWell.predictive.vsdStatus === 'alert') ? 'alert' : (selectedWell.predictive.vsdStatus === 'caution' ? 'caution' : 'normal')
        };
    }, [selectedWell]);

    const sendChatMessage = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading) return;
        setChatInput('');
        setChatLoading(true);
        setMsgs(p => [...p, { role: 'user', text }]);

        try {
            let contextData = "";
            if (selectedWell) {
                contextData = `POZO: ${selectedWell.name} (Health: ${wellHealth.toFixed(0)}%, Freq Campo: ${selectedWell.productionTest?.freq} Hz)`;
                const rawHistory = wellsHistoricalData[selectedWell.name] || wellsHistoricalData[selectedWell.name.toUpperCase()] || [];
                if (rawHistory && rawHistory.length > 0) {
                    const historySummary = rawHistory.map((h: any) => 
                        `- Fecha: ${h.date}, Freq: ${h.freq || 60}Hz, Caudal: ${h.rate} BPD, PIP: ${h.pip} psi, BSW: ${h.waterCut || 0}%, PDP: ${h.pdp || 0} psi`
                    ).join('\n');
                    contextData += `\n\n=== HISTORIAL DE PRUEBAS DE PRODUCCIÓN (HISTÓRICO) ===\n${historySummary}`;
                }
            } else {
                contextData = `Flota de ${fleet.length} pozos.`;
            }

            const userKey = localStorage.getItem('openrouter_api_key') || '';
            const headers: Record<string, string> = {
                "Content-Type": "application/json"
            };
            if (userKey && userKey !== 'null' && userKey !== 'undefined') {
                headers["Authorization"] = `Bearer ${userKey}`;
            }

            const res = await fetch("/api/copilot/stream", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    systemInstruction: `Responde en español de forma extremadamente concisa y directa. Eres un ingeniero experto en Levantamiento Artificial (ESP). Limítate a 2 párrafos máximos por respuesta para lectura rápida en celulares. Contexto actual: ${contextData}`,
                    messages: [
                        ...msgs.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.text })),
                        { role: 'user', content: text }
                    ]
                })
            });

            if (!res.ok) throw new Error("API error");

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No reader");

            const decoder = new TextDecoder();
            let done = false;
            let streamText = "";

            setMsgs(p => [...p, { role: 'model', text: '' }]);

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                streamText += chunk;

                setMsgs(p => {
                    const next = [...p];
                    if (next.length > 0) {
                        next[next.length - 1] = { role: 'model', text: streamText };
                    }
                    return next;
                });
            }
        } catch (err) {
            setMsgs(p => [...p, { role: 'model', text: 'Error de conexión con la IA.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    // ─── Score helpers ────────────────────────────────────────────────────────
    const getScoreColor = (score: number) => {
        if (score >= 90) return { bar: '#22c55e', text: 'text-emerald-400', ring: 'border-emerald-500/40', bg: 'bg-emerald-500/10', label: 'HEALTHY' };
        if (score >= 60) return { bar: '#f59e0b', text: 'text-amber-400', ring: 'border-amber-500/40', bg: 'bg-amber-500/10', label: 'CAUTION' };
        return { bar: '#ef4444', text: 'text-red-400', ring: 'border-red-500/40', bg: 'bg-red-500/10', label: 'CRITICAL' };
    };

    // ─── Tab definitions ──────────────────────────────────────────────────────
    const tabs = [
        { id: 'fleet', icon: Menu, label: 'Flota' },
        { id: 'copilot', icon: MessageSquare, label: language === 'es' ? 'Monitoreo IA' : 'AI Monitoring' },
        { id: 'analysis', icon: TrendingUp, label: 'Cotejo' },
        { id: 'bha', icon: Layers, label: 'BHA/3D' },
    ] as const;

    return (
        <div className="flex flex-col h-screen w-full bg-canvas text-txt-main overflow-hidden font-sans select-none pb-[64px]">

            {/* ══════════════════════════════════════════════════════
                TOP BAR — tira premium con acento de color
            ══════════════════════════════════════════════════════ */}
            <header className="relative h-14 bg-surface flex items-center justify-between px-3 shrink-0 overflow-hidden">
                {/* línea de acento top */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-txt-muted hover:text-white transition-colors active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Brand pill */}
                    <div className="flex flex-col leading-none min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
                            ESP STUDIO
                        </span>
                        {selectedWell ? (
                            <span className="text-[11px] font-bold text-txt-main truncate max-w-[150px] leading-tight">
                                {selectedWell.name}
                            </span>
                        ) : (
                            <span className="text-[10px] text-txt-muted font-semibold leading-tight">
                                {fleet.length} pozos monitoreados
                            </span>
                        )}
                    </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-1.5">
                    {selectedWell && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${getScoreColor(wellHealth).bg} ${getScoreColor(wellHealth).ring} ${getScoreColor(wellHealth).text}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                            {wellHealth.toFixed(0)}%
                        </div>
                    )}
                    <button
                        onClick={onForceSync}
                        disabled={isSyncingOneDrive}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-txt-muted hover:text-primary transition-all active:scale-95"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOneDrive ? 'animate-spin text-primary' : ''}`} />
                    </button>
                </div>

                {/* línea de acento bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5" />
            </header>

            {/* ══════════════════════════════════════════════════════
                TAB INDICATOR BAR — delgada pero visible
            ══════════════════════════════════════════════════════ */}
            <div className="flex h-0.5 shrink-0 bg-white/5">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className="flex-1 transition-all duration-300"
                        style={{ background: activeTab === tab.id ? 'rgb(var(--color-primary))' : 'transparent' }}
                    />
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════
                MAIN CONTENT
            ══════════════════════════════════════════════════════ */}
            <main className="flex-1 overflow-y-auto custom-scrollbar min-h-0">

                {/* ── FLOTA ───────────────────────────────────────── */}
                {activeTab === 'fleet' && (
                    <div className="animate-fadeIn">

                        {/* Action buttons removed for cleaner space-efficient mobile list */}

                        {/* Search + Filters */}
                        <div className="p-2 px-2.5 space-y-1.5 border-b border-white/5 bg-surface/40">
                            <DebouncedSearchInput
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar pozo..."
                            />

                            {/* Data filter */}
                            <div className="space-y-0.5">
                                <span className="text-[7px] font-black uppercase tracking-[0.15em] text-txt-muted/60 px-0.5">Datos</span>
                                <div className="flex gap-1">
                                    {(['all', 'complete', 'missing'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setDataFilter(f)}
                                            className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-wider transition-all ${dataFilter === f
                                                    ? f === 'all' ? 'bg-primary text-white shadow-sm'
                                                        : f === 'complete' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                    : 'bg-white/5 text-txt-muted hover:bg-white/10'
                                                }`}
                                        >
                                            {f === 'all' ? 'Todos' : f === 'complete' ? 'Completos' : 'Faltan'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Health filter */}
                            <div className="space-y-0.5">
                                <span className="text-[7px] font-black uppercase tracking-[0.15em] text-txt-muted/60 px-0.5">Salud</span>
                                <div className="flex gap-1">
                                    {(['all', 'healthy', 'caution', 'critical'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setHealthFilter(f)}
                                            className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-wider transition-all ${healthFilter === f
                                                    ? f === 'all' ? 'bg-primary text-white'
                                                        : f === 'healthy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : f === 'caution' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    : 'bg-white/5 text-txt-muted hover:bg-white/10'
                                                }`}
                                        >
                                            {f === 'all' ? 'Todos' : f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Status filter */}
                            <div className="space-y-0.5">
                                <span className="text-[7px] font-black uppercase tracking-[0.15em] text-txt-muted/60 px-0.5">Estado</span>
                                <div className="flex gap-1">
                                    {(['all', 'operativo', 'fallado', 'pendiente'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setStatusFilter(f)}
                                            className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-wider transition-all ${statusFilter === f
                                                    ? f === 'all' ? 'bg-primary text-white'
                                                        : f === 'operativo' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : f === 'fallado' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                                    : 'bg-white/5 text-txt-muted hover:bg-white/10'
                                                }`}
                                        >
                                            {f === 'all' ? 'Todos' : f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Well list */}
                        <div className="p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between px-1 mb-1">
                                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-txt-muted">
                                    Pozos de la Flota
                                </span>
                                <span className="text-[9px] font-black text-primary tabular-nums">
                                    {sortedFleet.length}
                                </span>
                            </div>

                            {sortedFleet.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-3 bg-surface/30 border border-white/5 rounded-xl">
                                    <Activity className="w-7 h-7 text-txt-muted/30" />
                                    <span className="text-[10px] text-txt-muted font-bold text-center px-6">
                                        No hay pozos que coincidan con los filtros.
                                    </span>
                                </div>
                            ) : (
                                sortedFleet.map(w => {
                                    const score = wellHealthMap[w.id] || 0;
                                    const sc = getScoreColor(score);
                                    const isSelected = selectedWell?.id === w.id;
                                    const freq = w.productionTest?.freq || 0;
                                    const rate = Math.round(w.currentRate || w.productionTest?.rate || 0);

                                    return (
                                        <div
                                            key={w.id}
                                            onClick={() => { setSelectedWell(w.id); setActiveTab('copilot'); }}
                                            className={`relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer active:scale-[0.98] overflow-hidden ${isSelected
                                                    ? 'bg-primary/8 border-primary/30'
                                                    : 'bg-surface/70 border-white/5 hover:border-white/10 hover:bg-surface'
                                                }`}
                                        >
                                            {/* Left accent bar */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${sc.bg.replace('/10', '')} rounded-l-xl`}
                                                style={{ background: sc.bar }} />

                                            {/* Compact status indicator dot */}
                                            <div className="shrink-0 flex items-center justify-center pl-1">
                                                <span className="w-3.5 h-3.5 rounded-full border-2 border-canvas shadow-lg" style={{ backgroundColor: sc.bar }} />
                                            </div>

                                            {/* Well info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-black text-txt-main tracking-tight uppercase truncate leading-tight">
                                                    {w.name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] text-txt-muted font-bold tabular-nums">{freq} Hz</span>
                                                    <span className="text-white/10">·</span>
                                                    <span className="text-[9px] text-txt-muted font-bold tabular-nums">{rate} BPD</span>
                                                </div>
                                            </div>

                                            {/* Status label */}
                                            <div className={`shrink-0 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${sc.bg} ${sc.text} border ${sc.ring}`}>
                                                {sc.label}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* ── ANÁLISIS / COTEJO ────────────────────────────── */}
                {activeTab === 'analysis' && (
                    <div className="animate-fadeIn">
                        {!selectedWell ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center border border-white/5">
                                    <TrendingUp className="w-6 h-6 text-txt-muted/40" />
                                </div>
                                <span className="text-xs text-txt-muted font-bold">
                                    Selecciona un pozo de la Flota para comenzar.
                                </span>
                            </div>
                        ) : (
                            <>
                                {/* Action toolbar — scroll horizontal si hace falta */}
                                <div className="flex gap-2 p-3 overflow-x-auto scrollbar-none border-b border-white/5 bg-surface/40">
                                    <button
                                        onClick={() => importDbRef.current?.click()}
                                        className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary/10 text-secondary border border-secondary/25 hover:bg-secondary/20 active:scale-95 transition-all text-[8px] font-black uppercase tracking-wider"
                                    >
                                        <Database className="w-3 h-3" />
                                        Subir Prueba
                                    </button>

                                    {onNavigateToDesign && (
                                        <button
                                            onClick={() => onNavigateToDesign(wellMatchParams, pump)}
                                            className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 active:scale-95 transition-all text-[8px] font-black uppercase tracking-wider"
                                        >
                                            <Settings className="w-3 h-3" />
                                            Diseño
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setWellViewMode(wellViewMode === 'history' ? 'monitoring' : 'history')}
                                        className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 active:scale-95 transition-all text-[8px] font-black uppercase tracking-wider"
                                    >
                                        <TrendingUp className="w-3 h-3" />
                                        {wellViewMode === 'history' ? 'Monitoreo' : 'Histórico'}
                                    </button>

                                    <a
                                        href="https://1drv.ms/x/c/06cc4035ad46ff97/IQClWg69qziUQZ4pcxlcyoF5AdzaFbqGWhkSVp1rxJKvfwQ?e=Zuk6P7"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 active:scale-95 transition-all text-[8px] font-black uppercase tracking-wider"
                                    >
                                        <FileSpreadsheet className="w-3 h-3" />
                                        Doc Diseño
                                    </a>

                                    <div className="flex items-center gap-1 ml-auto shrink-0">
                                        <button
                                            onClick={toggleLanguage}
                                            className="h-8 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[8px] font-black uppercase text-txt-muted flex items-center gap-1"
                                        >
                                            <Globe className="w-3 h-3" />
                                            {language}
                                        </button>
                                        <button
                                            onClick={cycleTheme}
                                            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-txt-muted hover:text-primary transition-colors"
                                        >
                                            <Palette className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Main chart area */}
                                <div className="px-3 pb-4 w-full overflow-x-auto min-w-0">
                                    {wellViewMode === 'history' ? (
                                        <MatchHistorico
                                            wellName={selectedWell.name}
                                            pump={pump}
                                            designParams={wellMatchParams}
                                            productionHistory={wellsHistoricalData[selectedWell.name]}
                                            onImport={() => importWellHistoryRef.current?.click()}
                                            onClose={() => setWellViewMode('monitoring')}
                                        />
                                    ) : (
                                        <Phase6
                                            key={selectedWell.id}
                                            params={wellMatchParams}
                                            syncParams={false}
                                            onHistoryMatchChange={onHistoryMatchChange}
                                            pump={pump}
                                            designFreq={selectedWell.productionTest.freq || 60}
                                            isMobile={true}
                                        />
                                    )}
                                </div>

                                {/* Predictive widget */}
                                <div className="p-3">
                                    <PredictiveWidget
                                        selectedWell={selectedWell}
                                        wellMatchParams={wellMatchParams}
                                        pump={pump}
                                        computeWellCapacity={computeWellCapacity}
                                        getOptimizationPath={getOptimizationPath}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── BHA / 3D ────────────────────────────────────── */}
                {activeTab === 'bha' && (
                    <div className="animate-fadeIn">
                        {!selectedWell ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center border border-white/5">
                                    <Layers className="w-6 h-6 text-txt-muted/40" />
                                </div>
                                <span className="text-xs text-txt-muted font-bold">
                                    Selecciona un pozo de la Flota para comenzar.
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-2.5 p-2.5">
                                {/* ESP BHA Stack */}
                                <section className="bg-surface/50 border border-white/8 rounded-xl overflow-hidden shadow-md">
                                    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/5 bg-surface/60">
                                        <div className="w-5.5 h-5.5 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20">
                                            <Layers className="w-3 h-3 text-primary" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-txt-main">Esquema BHA</span>
                                    </div>

                                    <div className="flex justify-center items-start bg-canvas/30 py-3 min-h-[380px] overflow-x-auto">
                                        {pump ? (
                                            <div className="scale-[0.7] origin-top">
                                                <VisualESPStack
                                                    pump={pump}
                                                    motor={wellMatchParams.selectedMotor || undefined}
                                                    params={wellMatchParams}
                                                    results={safeBhaResults}
                                                    frequency={selectedWell.productionTest.freq || 60}
                                                    health={physicalHealth as any}
                                                    selectedVSD={wellMatchParams.selectedVSD}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-6 opacity-50 gap-1.5">
                                                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                                </div>
                                                <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">Bomba no encontrada</span>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* 3D Trajectory */}
                                <section className="bg-surface/50 border border-white/8 rounded-xl overflow-hidden shadow-md">
                                    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/5 bg-surface/60">
                                        <div className="w-5.5 h-5.5 rounded-lg bg-secondary/15 flex items-center justify-center border border-secondary/20">
                                            <Compass className="w-3 h-3 text-secondary animate-[spin_10s_linear_infinite]" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-txt-main">Trayectoria y Desviación</span>
                                    </div>

                                    <div className="w-full h-[360px]">
                                        {wellMatchParams.survey && wellMatchParams.survey.length > 0 ? (
                                            <TrajectoryPlot
                                                survey={wellMatchParams.survey}
                                                params={wellMatchParams}
                                                isSidebar={false}
                                            />
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center gap-3 opacity-40">
                                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-txt-main">Sin Datos de Trayectoria</p>
                                                    <p className="text-[9px] text-txt-muted uppercase mt-1 px-6">
                                                        Asumiendo pozo vertical para el cálculo.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                            </div>
                        )}
                    </div>
                )}

                {/* ── COPILOT ─────────────────────────────────────── */}
                {activeTab === 'copilot' && (
                    <div className="flex flex-col animate-fadeIn" style={{ height: 'calc(100vh - 64px - 56px - 2px - 3px)' }}>

                        {/* IA Chat Header */}
                        <div className="shrink-0 px-4 py-3 border-b border-white/5 bg-surface/50 backdrop-blur-md flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm relative">
                                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-surface animate-[pulse_2s_infinite]" />
                                </div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-txt-main">
                                        {language === 'es' ? 'Monitoreo IA' : 'AI Monitoring'}
                                    </span>
                                    <span className="text-[8px] font-bold text-txt-muted uppercase tracking-widest mt-0.5">
                                        {language === 'es' ? 'Asistente Virtual ESP' : 'ESP Virtual Assistant'}
                                    </span>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => setShowKeyModal(true)}
                                className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-[9px] font-black uppercase text-txt-muted hover:text-primary transition-all flex items-center gap-1.5 active:scale-95"
                            >
                                <Settings className="w-3.5 h-3.5" />
                                <span>API Key</span>
                            </button>
                        </div>

                        {/* Messages area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-3.5 min-h-0 bg-canvas/20">
                            {msgs.map((m, idx) => {
                                const isUser = m.role === 'user';
                                return (
                                    <div key={idx} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        {!isUser && (
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary/20 to-secondary/15 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5 shadow-sm shadow-primary/10">
                                                <Sparkles className="w-4 h-4 text-primary" />
                                            </div>
                                        )}
                                        <div className={`max-w-[82%] px-4 py-3 text-xs leading-relaxed shadow-lg ${isUser
                                                ? 'bg-gradient-to-r from-primary to-secondary text-white rounded-2xl rounded-tr-sm shadow-primary/5'
                                                : 'bg-surface/75 border border-primary/10 rounded-2xl rounded-tl-sm text-txt-main shadow-black/20'
                                            }`}>
                                            {isUser ? (
                                                <div className="whitespace-pre-wrap">{m.text}</div>
                                            ) : (
                                                <div className="markdown-content">
                                                    <MarkdownRenderer content={m.text} isStreaming={chatLoading && idx === msgs.length - 1} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {chatLoading && (
                                <div className="flex items-center gap-2.5 pl-10.5">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <span
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                                                style={{ animationDelay: `${i * 0.12}s` }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-primary/60">
                                        {language === 'es' ? 'Monitoreo IA pensando' : 'AI Monitoring thinking'}
                                    </span>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Suggestion chips */}
                        {suggestions.length > 0 && msgs.length === 1 && (
                            <div className="px-3 pb-2.5 pt-1.5 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0 bg-canvas/20">
                                {suggestions.map((s, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setChatInput(s.prompt);
                                            sendChatMessage();
                                        }}
                                        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary/8 border border-primary/20 text-primary hover:bg-primary/15 active:scale-95 transition-all text-[9.5px] font-black uppercase tracking-wider"
                                    >
                                        <Sparkles className="w-2.5 h-2.5 animate-[pulse_1.5s_infinite]" />
                                        {language === 'es' ? s.es : s.en}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input bar */}
                        <div className="shrink-0 px-3 pb-3 pt-2.5 border-t border-white/5 bg-surface/90 backdrop-blur-md flex gap-2 items-center">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                placeholder={language === 'es' ? "Pregunta algo sobre el pozo..." : "Ask something about the well..."}
                                className="flex-1 bg-canvas border border-white/8 px-4 py-2.5 rounded-xl text-[11px] font-medium text-txt-main outline-none focus:border-primary/50 placeholder:text-txt-muted/40 transition-colors"
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="w-9 h-9 shrink-0 rounded-xl bg-primary text-white disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/20"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* ══════════════════════════════════════════════════════
                BOTTOM NAV — elevated, más limpia
            ══════════════════════════════════════════════════════ */}
            <nav className="fixed bottom-0 left-0 right-0 h-[64px] z-[110] bg-surface/96 backdrop-blur-xl border-t border-white/8 flex items-center px-2">
                {tabs.map(({ id, icon: Icon, label }) => {
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl mx-0.5 transition-all active:scale-95 ${isActive
                                    ? 'bg-primary/12 text-primary'
                                    : 'text-txt-muted hover:text-txt-main hover:bg-white/5'
                                }`}
                        >
                            <Icon className={`w-[18px] h-[18px] transition-transform ${isActive ? 'scale-110' : ''}`} />
                            <span className={`text-[7.5px] font-black uppercase tracking-widest transition-all ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                                {label}
                            </span>
                            {isActive && (
                                <span className="absolute bottom-2 w-1 h-1 rounded-full bg-primary" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ══════════════════════════════════════════════════════
                IMPORT PROGRESS OVERLAY
            ══════════════════════════════════════════════════════ */}
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
                    <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent pointer-events-none" />
                    <div className="flex flex-col items-center gap-10 max-w-sm w-full relative z-10">
                        <div className="relative animate-fadeIn">
                            <img
                                src="/LOGO.png"
                                alt="Loading..."
                                className="w-84 h-84 object-contain"
                                style={{ filter: 'drop-shadow(0 0 50px rgba(var(--color-primary), 0.4))' }}
                            />
                        </div>
                        <div className="w-full flex flex-col items-center gap-6 animate-fadeInUp">
                            <h3 className="text-xl font-bold text-primary uppercase tracking-[0.25em] text-center">
                                {importProgress.label.replace('...', '')}
                            </h3>
                            <div className="w-full px-8">
                                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_8px_rgba(var(--color-primary),0.4)]"
                                        style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PWA Install Shortcut Banner */}
            {showInstallPrompt && (
                <div className="fixed bottom-[80px] left-3 right-3 z-[9999] bg-surface/95 border border-primary/30 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-slideUp flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-primary/20 rounded-xl text-primary border border-primary/30 shrink-0">
                            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">
                                {language === 'es' ? 'Instalar App / Acceso Directo' : 'Install App / Desktop Shortcut'}
                            </h4>
                            <p className="text-[10px] text-txt-muted font-semibold mt-1 leading-normal">
                                {language === 'es' 
                                    ? 'Agrega esta app a tu pantalla de inicio o escritorio para abrirla al instante y usarla en pantalla completa.' 
                                    : 'Add this app to your home screen or desktop for instant access and full-screen experience.'}
                            </p>
                        </div>
                        <button 
                            onClick={() => {
                                sessionStorage.setItem('pwa-prompt-dismissed', 'true');
                                setShowInstallPrompt(false);
                            }}
                            className="p-1 text-txt-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button 
                            onClick={() => {
                                sessionStorage.setItem('pwa-prompt-dismissed', 'true');
                                setShowInstallPrompt(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase text-txt-muted transition-colors"
                        >
                            {language === 'es' ? 'Quizás más tarde' : 'Maybe Later'}
                        </button>
                        <button 
                            onClick={() => {
                                alert(language === 'es' 
                                    ? 'Para instalar: En Chrome presiona los tres puntos superiores y selecciona "Instalar aplicación" o "Agregar a pantalla principal". En Safari presiona el botón "Compartir" y selecciona "Agregar a Inicio".' 
                                    : 'To install: In Chrome tap the three dots menu and select "Install app" or "Add to Home screen". In Safari tap "Share" and select "Add to Home Screen".');
                                sessionStorage.setItem('pwa-prompt-dismissed', 'true');
                                setShowInstallPrompt(false);
                            }}
                            className="px-4 py-1.5 rounded-lg bg-primary text-white text-[9px] font-black uppercase shadow-glow-primary/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            {language === 'es' ? 'Cómo Instalar' : 'How to Install'}
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                API KEY CONFIGURATION MODAL (MOBILE)
            ══════════════════════════════════════════════════════ */}
            {showKeyModal && (
                <div className="fixed inset-0 z-[100000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-[320px] bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl animate-fadeIn flex flex-col gap-4 relative overflow-hidden">
                        {/* Glow effect */}
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/10 blur-2xl rounded-full" />
                        
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/25 shrink-0 text-primary">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                    {language === 'es' ? 'Configurar API Key' : 'Configure API Key'}
                                </h3>
                                <p className="text-[8px] font-bold text-txt-muted uppercase tracking-widest mt-0.5">
                                    OpenRouter Credentials
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-txt-muted uppercase tracking-wider block">
                                {language === 'es' ? 'OpenRouter API Key' : 'OpenRouter API Key'}
                            </label>
                            <input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="sk-or-v1-..."
                                className="w-full bg-canvas border border-white/10 px-3.5 py-2.5 rounded-xl text-xs font-medium text-white outline-none focus:border-primary/50 placeholder:text-txt-muted/20"
                            />
                            <p className="text-[7.5px] text-txt-muted font-medium mt-1.5 leading-normal uppercase">
                                {language === 'es' 
                                    ? 'La API Key se guarda localmente en el navegador de tu celular.' 
                                    : 'Your API Key is securely stored locally in your browser.'}
                            </p>
                        </div>

                        <div className="flex gap-2 justify-end mt-2">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('openrouter_api_key');
                                    setApiKeyInput('');
                                    setShowKeyModal(false);
                                }}
                                className="flex-1 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[9px] font-black uppercase transition-colors"
                            >
                                {language === 'es' ? 'Limpiar' : 'Clear'}
                            </button>
                            <button
                                onClick={() => setShowKeyModal(false)}
                                className="py-2 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-txt-muted hover:text-white text-[9px] font-black uppercase transition-colors"
                            >
                                {language === 'es' ? 'Cerrar' : 'Close'}
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.setItem('openrouter_api_key', apiKeyInput.trim());
                                    setShowKeyModal(false);
                                }}
                                className="py-2 px-4 rounded-xl bg-primary text-white text-[9px] font-black uppercase transition-all shadow-md shadow-primary/20 hover:scale-102 active:scale-98"
                            >
                                {language === 'es' ? 'Guardar' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
