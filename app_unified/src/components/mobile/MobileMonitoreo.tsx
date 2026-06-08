import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Activity, ChevronLeft, RefreshCw, Download, Database, Trash2,
    Monitor, Shield, Zap, Droplets, Thermometer, ShieldCheck,
    TrendingUp, MessageSquare, Menu, X, Send, Sparkles, AlertTriangle,
    Layers, Compass, Target, Globe, FileSpreadsheet, Settings, Palette,
    SlidersHorizontal
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
    const [isMobileVideoLoaded, setIsMobileVideoLoaded] = useState(false);

    // Zoom de app automático por celular
    const getAppZoom = () => {
        if (typeof window === 'undefined') return 1.0;
        const w = window.innerWidth;
        if (w < 360) return 0.78;
        if (w < 400) return 0.82;
        if (w < 480) return 0.88;
        return 0.95;
    };
    const [appZoom, setAppZoom] = useState(getAppZoom());

    // Filtros de flota colapsables
    const [showFilters, setShowFilters] = useState(false);

    // Sub-pestañas para BHA/3D
    const [bhaMode, setBhaMode] = useState<'bha' | '3d'>('bha');

    // Escalado automático de BHA exacto
    const [bhaScale, setBhaScale] = useState(0.45);

    const estimatedBhaHeight = useMemo(() => {
        const vsdBoxH = wellMatchParams?.selectedVSD ? 160 : 0;
        const treeHeight = 180;
        const surfY = vsdBoxH + (wellMatchParams?.selectedVSD ? 5 : 0) + treeHeight;
        const tubingLen = 250;
        const startY = surfY + tubingLen;
        const dischargeH = 55;
        const pumpStages = pump?.stages || 100;
        const totalPumpH = Math.min(350, Math.max(160, pumpStages * 2.2));
        const intakeH = 70;
        const sealH = 110;
        const motorHp = wellMatchParams?.selectedMotor ? (wellMatchParams.selectedMotor.hp || 0) : 0;
        const motorH = wellMatchParams?.selectedMotor ? Math.min(280, 130 + (motorHp * 0.4)) : 160;
        const sensorH = 100;
        const connH = 4;
        const gapH = 12;
        const housingCount = pump?.housingCount || 1;
        const pumpSectionHeight = totalPumpH + (gapH * (housingCount - 1));
        
        const espBottomY = startY + dischargeH + pumpSectionHeight + connH + intakeH + connH + sealH + connH + motorH + connH + sensorH;
        return espBottomY + 35 + 20; // casingBottomY + 20 margin
    }, [pump, wellMatchParams]);

    useEffect(() => {
        const handleResize = () => {
            setAppZoom(getAppZoom());
            const cardWidth = Math.min(window.innerWidth - 32, 500); // 32px padding
            setBhaScale(cardWidth / 800);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [wellMatchParams?.selectedVSD, pump]);

    useEffect(() => {
        if (!importProgress) {
            setIsMobileVideoLoaded(false);
        }
    }, [importProgress]);

    const handleProtectedLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
        e.preventDefault();
        const clave = prompt(language === 'es' ? 'Ingrese la clave de acceso:' : 'Enter access key:');
        if (clave?.trim().toUpperCase() === 'AJM') {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else if (clave !== null) {
            alert(language === 'es' ? 'Clave incorrecta.' : 'Incorrect key.');
        }
    };

    useEffect(() => {
        if (showKeyModal) {
            setApiKeyInput(localStorage.getItem('openrouter_api_key') || '');
        }
    }, [showKeyModal]);


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
                    const totalPoints = rawHistory.length;
                    const rates = rawHistory.map((h: any) => h.rate || 0);
                    const ips = rawHistory.map((h: any) => h.calculatedIP || 0).filter((v: number) => v > 0);
                    const pips = rawHistory.map((h: any) => h.pip || 0);
                    
                    const minRate = Math.min(...rates);
                    const maxRate = Math.max(...rates);
                    const avgRate = rates.reduce((a: number, b: number) => a + b, 0) / totalPoints;
                    
                    const minIP = ips.length > 0 ? Math.min(...ips) : 0;
                    const maxIP = ips.length > 0 ? Math.max(...ips) : 0;
                    const avgIP = ips.length > 0 ? ips.reduce((a: number, b: number) => a + b, 0) / ips.length : 0;
                    
                    const minPIP = Math.min(...pips);
                    const maxPIP = Math.max(...pips);
                    const avgPIP = pips.reduce((a: number, b: number) => a + b, 0) / totalPoints;
                    
                    const newest = rawHistory[rawHistory.length - 1];
                    const oldest = rawHistory[0];

                    let sampledPoints = rawHistory;
                    if (totalPoints > 15) {
                        sampledPoints = [];
                        const step = (totalPoints - 1) / 14;
                        for (let i = 0; i < 15; i++) {
                            const index = Math.round(i * step);
                            if (rawHistory[index]) {
                                sampledPoints.push(rawHistory[index]);
                            }
                        }
                    }
                    
                    const historySummary = sampledPoints.map((h: any) => 
                        `- Fecha: ${h.date}, Freq: ${h.freq || 60}Hz, Caudal: ${h.rate} BPD, PIP: ${h.pip} psi, BSW: ${h.waterCut || 0}%, PDP: ${h.pdp || 0} psi, IP: ${(h.calculatedIP || 0).toFixed(2)}`
                    ).join('\n');
                    
                    const statsText = `=== RESUMEN ESTADÍSTICO DE PRUEBAS HISTÓRICAS ===
- Total de Pruebas: ${totalPoints} registros.
- Rango de Fechas: Desde ${oldest.date} hasta ${newest.date}.
- Caudal de Producción (BFPD): Min = ${minRate.toFixed(0)}, Max = ${maxRate.toFixed(0)}, Promedio = ${avgRate.toFixed(0)}. Último = ${newest.rate.toFixed(0)}.
- Índice de Productividad (IP): Min = ${minIP.toFixed(2)}, Max = ${maxIP.toFixed(2)}, Promedio = ${avgIP.toFixed(2)}. Último = ${(newest.calculatedIP || 0).toFixed(2)}.
- Presión de Entrada (PIP): Min = ${minPIP.toFixed(0)} psi, Max = ${maxPIP.toFixed(0)} psi, Promedio = ${avgPIP.toFixed(0)} psi. Último = ${newest.pip.toFixed(0)} psi.
- Frecuencia (Hz): Desde ${oldest.freq || 60} Hz iniciales hasta ${newest.freq || 60} Hz finales.

=== HISTORIAL DE PRUEBAS DE PRODUCCIÓN (HISTÓRICO MUESTREADO A 15 PUNTOS CLAVE) ===
${historySummary}`;

                    contextData += `\n\n${statsText}`;
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
                    systemInstruction: `Responde en español de forma extremadamente concisa y directa. Eres un ingeniero experto en Levantamiento Artificial (ESP). Limítate a 2 párrafos máximos por respuesta para lectura rápida en celulares. Si el contexto incluye el bloque 'HISTORIAL DE PRUEBAS DE PRODUCCIÓN (HISTÓRICO)', contiene los registros históricos reales de campo del pozo. Úsalos para responder sobre tendencias e historial de caudal, IP, presiones y BSW. Contexto actual: ${contextData}`,
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
            <main className="flex-1 overflow-y-auto custom-scrollbar min-h-0" style={{ zoom: appZoom }}>

                {/* ── FLOTA ───────────────────────────────────────── */}
                {activeTab === 'fleet' && (
                    <div className="animate-fadeIn">

                        {/* Action buttons removed for cleaner space-efficient mobile list */}

                        {/* Search + Filters */}
                        <div className="p-2 px-2.5 space-y-1.5 border-b border-white/5 bg-surface/40">
                            <div className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <DebouncedSearchInput
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Buscar pozo..."
                                    />
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all active:scale-95 shrink-0 ${showFilters ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/8 text-txt-muted'}`}
                                >
                                    <SlidersHorizontal className="w-4 h-4" />
                                </button>
                            </div>

                            {showFilters && (
                                <div className="space-y-1.5 pt-1.5 border-t border-white/5 animate-fadeIn">
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
                            )}
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
                                    const pip = Math.round(w.productionTest?.pip || 0);

                                    return (
                                        <div
                                            key={w.id}
                                            onClick={() => { setSelectedWell(w.id); setActiveTab('copilot'); }}
                                            className={`relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] overflow-hidden ${isSelected
                                                    ? 'bg-primary/8 border-primary/30 shadow-lg shadow-primary/5'
                                                    : 'bg-surface/60 border-white/5 hover:border-white/10 hover:bg-surface/80'
                                                }`}
                                        >
                                            {/* Left accent bar */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                                                style={{ background: sc.bar }} />

                                            {/* Top Row: Name + Health Badge */}
                                            <div className="flex items-center justify-between gap-2 pl-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-2 h-2 rounded-full border border-canvas animate-pulse" style={{ backgroundColor: sc.bar }} />
                                                    <span className="text-[12px] font-black text-txt-main tracking-tight uppercase truncate">
                                                        {w.name}
                                                    </span>
                                                </div>
                                                <div className={`px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-wider ${sc.bg} ${sc.text} border ${sc.ring}`}>
                                                    {sc.label} · {score.toFixed(0)}%
                                                </div>
                                            </div>

                                            {/* Micro-grid stats */}
                                            <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-white/5 pl-1.5">
                                                <div className="flex flex-col">
                                                    <span className="text-[7.5px] font-black text-txt-muted uppercase tracking-wider">Frecuencia</span>
                                                    <span className="text-[11px] font-mono font-bold text-txt-main mt-0.5">{freq} Hz</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[7.5px] font-black text-txt-muted uppercase tracking-wider">Caudal</span>
                                                    <span className="text-[11px] font-mono font-bold text-txt-main mt-0.5">{rate} BPD</span>
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[7.5px] font-black text-txt-muted uppercase tracking-wider">Presión (PIP)</span>
                                                    <span className="text-[11px] font-mono font-bold text-primary mt-0.5">{pip} psi</span>
                                                </div>
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
                                        onClick={(e) => handleProtectedLink(e, "https://1drv.ms/x/c/06cc4035ad46ff97/IQClWg69qziUQZ4pcxlcyoF5AdzaFbqGWhkSVp1rxJKvfwQ?e=Zuk6P7")}
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
                                {/* Sub-tab selector */}
                                <div className="flex p-1 bg-surface/80 border border-white/8 rounded-xl mx-1 shadow-md">
                                    <button
                                        onClick={() => setBhaMode('bha')}
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center ${bhaMode === 'bha' ? 'bg-primary text-white shadow-sm font-black' : 'text-txt-muted hover:bg-white/5'}`}
                                    >
                                        Esquema BHA
                                    </button>
                                    <button
                                        onClick={() => setBhaMode('3d')}
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center ${bhaMode === '3d' ? 'bg-primary text-white shadow-sm font-black' : 'text-txt-muted hover:bg-white/5'}`}
                                    >
                                        Trayectoria 3D
                                    </button>
                                </div>

                                {bhaMode === 'bha' ? (
                                    /* ESP BHA Stack */
                                    <section className="bg-surface/50 border border-white/8 rounded-xl overflow-hidden shadow-md flex flex-col">
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/5 bg-surface/60">
                                            <div className="w-5.5 h-5.5 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20">
                                                <Layers className="w-3 h-3 text-primary" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-txt-main">Esquema BHA</span>
                                        </div>

                                        <div className="h-[520px] bg-canvas/30 overflow-auto custom-scrollbar flex justify-center items-start p-4">
                                            {pump ? (
                                                <div 
                                                    className="transition-all duration-200 ease-out origin-top-left"
                                                    style={{ 
                                                        width: `${800 * bhaScale}px`,
                                                        height: `${estimatedBhaHeight * bhaScale}px`
                                                    }}
                                                >
                                                    <div style={{ transform: `scale(${bhaScale})`, transformOrigin: 'top left' }}>
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
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-6 opacity-50 gap-1.5 w-full h-full">
                                                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                                    </div>
                                                    <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">Bomba no encontrada</span>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                ) : (
                                    /* 3D Trajectory */
                                    <section className="bg-surface/50 border border-white/8 rounded-xl overflow-hidden shadow-md">
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/5 bg-surface/60">
                                            <div className="w-5.5 h-5.5 rounded-lg bg-secondary/15 flex items-center justify-center border border-secondary/20">
                                                <Compass className="w-3 h-3 text-secondary animate-[spin_10s_linear_infinite]" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-txt-main">Trayectoria y Desviación</span>
                                        </div>

                                        <div className="w-full h-[520px]">
                                            {wellMatchParams.survey && wellMatchParams.survey.length > 0 ? (
                                                <TrajectoryPlot
                                                    survey={wellMatchParams.survey}
                                                    params={wellMatchParams}
                                                    isSidebar={true}
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
                                )}

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
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden animate-fadeIn"
                    style={{
                        backgroundColor: 'rgb(var(--color-canvas))',
                        backgroundImage: 'linear-gradient(rgb(var(--color-canvas) / 0.85), rgb(var(--color-canvas) / 0.85)), url(/main_bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent pointer-events-none" />
                    
                    {/* Premium Mobile Card Container */}
                    <div 
                        className="bg-surface/85 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 sm:p-8 rounded-[28px] w-[320px] max-w-[90vw] flex flex-col items-center gap-6 text-txt-main relative z-10 animate-scaleUp"
                        style={{
                            background: 'rgb(var(--color-surface-raised) / 85%)',
                        }}
                    >
                        {/* Logo - Sized nicely for mobile */}
                        <div className="relative flex items-center justify-center animate-fadeIn" style={{ width: '130px', height: '130px' }}>
                            <video
                                src="/logo%20animado.mp4"
                                autoPlay
                                loop
                                muted
                                playsInline
                                onLoadedData={() => setIsMobileVideoLoaded(true)}
                                className="w-28 h-28 object-contain"
                                style={{
                                    filter: 'drop-shadow(0 0 30px rgba(var(--color-primary), 0.35))',
                                    opacity: isMobileVideoLoaded ? 1 : 0,
                                    transition: 'opacity 0.6s ease-in-out'
                                }}
                            />
                            {!isMobileVideoLoaded && (
                                <img
                                    src="/LOGO.png"
                                    alt="Cargando..."
                                    className="absolute w-28 h-28 object-contain pointer-events-none"
                                    style={{
                                        filter: 'blur(10px) drop-shadow(0 0 30px rgba(var(--color-primary), 0.35))',
                                        opacity: 0.7
                                    }}
                                />
                            )}
                        </div>

                        {/* Progress Details */}
                        <div className="w-full flex flex-col items-center gap-4 animate-fadeInUp">
                            <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em] text-center leading-snug px-1">
                                {importProgress.label.replace('...', '')}
                            </h3>
                            
                            <div className="w-full px-2 space-y-2.5">
                                <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_8px_rgba(var(--color-primary),0.4)]"
                                        style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center px-0.5">
                                    <span className="text-[8px] font-black text-txt-muted/70 uppercase tracking-widest">
                                        ID: {importProgress.current} / {importProgress.total}
                                    </span>
                                    <span className="text-base font-light text-primary tracking-tighter font-mono">
                                        {Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%
                                    </span>
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
