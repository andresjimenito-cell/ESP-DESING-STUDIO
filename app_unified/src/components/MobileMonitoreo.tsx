import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Activity, ChevronLeft, RefreshCw, Download, Database, Trash2, 
    Monitor, Shield, Zap, Droplets, Thermometer, ShieldCheck, 
    TrendingUp, MessageSquare, Menu, X, Send, Sparkles, AlertTriangle,
    Layers, Compass, Target, Globe, FileSpreadsheet, Settings, Palette
} from 'lucide-react';
import { WellFleetItem, EspPump, SystemParams, HistoryMatchData } from '@/types';
import { getWellHealthScore, computeWellCapacity, getOptimizationPath } from './PhaseMonitoreo.helpers';
import { calculateSystemResults, calculateBaseHead } from '../utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { VisualESPStack } from './VisualESPStack';
import { TrajectoryPlot } from './TrajectoryPlot';
import { Phase6 } from './Phase6';
import { MatchHistorico } from './MatchHistorico';
import { PredictiveWidget, DebouncedSearchInput } from './PhaseMonitoreo.subcomponents';

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
    // Core Parity States & Functions from Parent:
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
    
    // Chat state
    const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Initial greeting when changing wells
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

    // Active well health results
    const wellHealth = selectedWell ? (wellHealthMap[selectedWell.id] || 0) : 0;

    // BHA calculations identical to PhaseMonitoreo
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
            } else {
                contextData = `Flota de ${fleet.length} pozos.`;
            }

            const res = await fetch("/api/copilot/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

    return (
        <div className="flex flex-col h-screen w-full bg-canvas text-txt-main overflow-hidden font-sans select-none pb-[64px]">
            {/* TOP BAR BRAND */}
            <header className="h-14 bg-surface border-b border-white/5 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-white/5 rounded-lg text-txt-muted hover:text-white"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-widest text-primary">ESP STUDIO MOBILE</span>
                        {selectedWell && <span className="text-[10px] text-txt-muted font-bold uppercase truncate max-w-[120px]">{selectedWell.name}</span>}
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button 
                        onClick={onForceSync}
                        disabled={isSyncingOneDrive}
                        className="p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-lg text-txt-muted active:scale-95 transition-all"
                        title="OneDrive Sync"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncingOneDrive ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* TAB CONTENTS */}
            <main className="flex-1 overflow-y-auto p-3 min-h-0 custom-scrollbar pb-8">
                {activeTab === 'fleet' && (
                    <div className="space-y-4 animate-fadeIn">
                        {/* Fleet Import Actions */}
                        <div className="flex gap-2 items-center bg-surface/50 p-2.5 border border-white/5">
                            <button 
                                onClick={() => importDesignRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-wider active:bg-primary/20"
                            >
                                <Database className="w-3.5 h-3.5" />
                                Diseños
                            </button>
                            <button 
                                onClick={() => importDbRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-black uppercase tracking-wider active:bg-secondary/20"
                            >
                                <TrendingUp className="w-3.5 h-3.5" />
                                SCADA
                            </button>
                            <button 
                                onClick={clearFleet}
                                className="p-3 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 active:scale-95 transition-all"
                                title="Limpiar Flota"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search and Filters */}
                        <div className="bg-surface/30 p-3 border border-white/5 space-y-2">
                            <DebouncedSearchInput
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar pozo..."
                            />
                            
                            {/* Filter Rows */}
                            <div className="flex items-center gap-1 bg-canvas/50 p-0.5 border border-white/5">
                                <button onClick={() => setDataFilter('all')} className={`h-7 px-2 rounded-md text-[7px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'all' ? 'bg-primary text-white' : 'text-txt-muted'}`}>Datos: Todos</button>
                                <button onClick={() => setDataFilter('complete')} className={`h-7 px-2 rounded-md text-[7px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'complete' ? 'bg-success/20 text-success' : 'text-txt-muted'}`}>Completos</button>
                                <button onClick={() => setDataFilter('missing')} className={`h-7 px-2 rounded-md text-[7px] font-black uppercase tracking-widest flex-1 ${dataFilter === 'missing' ? 'bg-warning/20 text-warning' : 'text-txt-muted'}`}>Faltan</button>
                            </div>
                            
                            <div className="flex items-center gap-1 bg-canvas/50 p-0.5 border border-white/5">
                                <button onClick={() => setHealthFilter('all')} className={`h-7 px-2 rounded-md text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'all' ? 'bg-primary text-white' : 'text-txt-muted'}`}>Salud: Todos</button>
                                <button onClick={() => setHealthFilter('healthy')} className={`h-7 px-2 rounded-md text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'healthy' ? 'bg-success/20 text-success' : 'text-txt-muted'}`}>Healthy</button>
                                <button onClick={() => setHealthFilter('caution')} className={`h-7 px-2 rounded-md text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'caution' ? 'bg-warning/20 text-warning' : 'text-txt-muted'}`}>Caution</button>
                                <button onClick={() => setHealthFilter('critical')} className={`h-7 px-2 rounded-md text-[7px] font-black uppercase tracking-widest flex-1 ${healthFilter === 'critical' ? 'bg-danger/20 text-danger' : 'text-txt-muted'}`}>Critical</button>
                            </div>

                            <div className="flex items-center gap-1 bg-canvas/50 p-0.5 border border-white/5">
                                <button onClick={() => setStatusFilter('all')} className={`h-7 px-1.5 rounded-md text-[6.5px] font-black uppercase tracking-wider flex-1 ${statusFilter === 'all' ? 'bg-primary text-white' : 'text-txt-muted'}`}>Estado: Todos</button>
                                <button onClick={() => setStatusFilter('operativo')} className={`h-7 px-1.5 rounded-md text-[6.5px] font-black uppercase tracking-wider flex-1 ${statusFilter === 'operativo' ? 'bg-success/20 text-success' : 'text-txt-muted'}`}>Operativo</button>
                                <button onClick={() => setStatusFilter('fallado')} className={`h-7 px-1.5 rounded-md text-[6.5px] font-black uppercase tracking-wider flex-1 ${statusFilter === 'fallado' ? 'bg-danger/20 text-danger' : 'text-txt-muted'}`}>Fallado</button>
                                <button onClick={() => setStatusFilter('pendiente')} className={`h-7 px-1.5 rounded-md text-[6.5px] font-black uppercase tracking-wider flex-1 ${statusFilter === 'pendiente' ? 'bg-slate-500/20 text-slate-400' : 'text-txt-muted'}`}>Pendiente</button>
                            </div>
                        </div>

                        {/* Well List */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-txt-muted uppercase tracking-widest px-1">Pozos de la Flota ({sortedFleet.length})</h3>
                            {sortedFleet.length === 0 ? (
                                <div className="p-8 text-center bg-surface/30 border border-white/5">
                                    <Activity className="w-8 h-8 mx-auto text-txt-muted/30 mb-2" />
                                    <span className="text-xs text-txt-muted font-bold block">No hay pozos que coincidan con los filtros.</span>
                                </div>
                            ) : (
                                sortedFleet.map(w => {
                                    const score = wellHealthMap[w.id] || 0;
                                    const scoreColor = score >= 90 ? 'text-success border-success/30 bg-success/5' : score >= 60 ? 'text-warning border-warning/30 bg-warning/5' : 'text-danger border-danger/30 bg-danger/5';
                                    const isCurrentSelected = selectedWell?.id === w.id;

                                    return (
                                        <div 
                                            key={w.id}
                                            onClick={() => {
                                                setSelectedWell(w.id);
                                                setActiveTab('analysis');
                                            }}
                                            className={`p-4 border transition-all flex items-center justify-between cursor-pointer ${isCurrentSelected ? 'bg-primary/5 border-primary/40' : 'bg-surface/60 border-white/5 active:bg-surface'}`}
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-black text-txt-main tracking-tight uppercase truncate">{w.name}</span>
                                                <span className="text-[10px] text-txt-muted font-bold uppercase mt-1">
                                                    {w.productionTest?.freq || 0} Hz · {Math.round(w.currentRate || w.productionTest?.rate || 0)} BPD
                                                </span>
                                            </div>
                                            <span className={`px-2.5 py-1 text-[10px] font-black font-mono border ${scoreColor}`}>
                                                {score.toFixed(0)}%
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="space-y-4 animate-fadeIn">
                        {!selectedWell ? (
                            <div className="p-8 text-center bg-surface/30 border border-white/5 mt-4">
                                <TrendingUp className="w-8 h-8 mx-auto text-txt-muted/30 mb-2" />
                                <span className="text-xs text-txt-muted font-bold block">Selecciona un pozo de la Flota para comenzar.</span>
                            </div>
                        ) : (
                            <>
                                {/* Action row for Cotejo */}
                                <div className="flex flex-wrap gap-1.5 bg-surface/40 p-2 border border-white/5">
                                    <button 
                                        onClick={() => importDbRef.current?.click()}
                                        className="h-8 px-2.5 bg-secondary/10 text-secondary border border-secondary/25 hover:bg-secondary/20 text-[8px] font-black uppercase tracking-wider flex items-center gap-1"
                                    >
                                        <Database className="w-3 h-3" />
                                        Subir Prueba
                                    </button>
                                    
                                    {onNavigateToDesign && (
                                        <button 
                                            onClick={() => onNavigateToDesign(wellMatchParams, pump)}
                                            className="h-8 px-2.5 bg-primary/10 text-primary border border-primary/25 hover:bg-primary text-[8px] font-black uppercase tracking-wider flex items-center gap-1"
                                        >
                                            <Settings className="w-3 h-3" />
                                            Diseño
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => setWellViewMode(wellViewMode === 'history' ? 'monitoring' : 'history')}
                                        className="h-8 px-2.5 bg-success/10 text-success border border-success/25 hover:bg-success/20 text-[8px] font-black uppercase tracking-wider flex items-center gap-1"
                                    >
                                        <TrendingUp className="w-3 h-3" />
                                        {wellViewMode === 'history' ? 'Monitoreo' : 'Histórico'}
                                    </button>

                                    <a
                                        href="https://1drv.ms/x/c/06cc4035ad46ff97/IQClWg69qziUQZ4pcxlcyoF5AdzaFbqGWhkSVp1rxJKvfwQ?e=Zuk6P7"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-8 px-2 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/25 text-[8px] font-black uppercase tracking-wider flex items-center gap-1"
                                    >
                                        <FileSpreadsheet className="w-3 h-3" />
                                        Doc Diseño
                                    </a>

                                    <button onClick={toggleLanguage} className="h-8 px-1.5 hover:bg-white/10 text-[8px] font-black uppercase flex items-center gap-1">
                                        <Globe className="w-3 h-3" /> {language}
                                    </button>

                                    <button onClick={cycleTheme} className="h-8 w-8 flex items-center justify-center hover:bg-white/10 text-txt-muted hover:text-primary">
                                        <Palette className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Predictive Widget AI comment */}
                                <PredictiveWidget
                                    selectedWell={selectedWell}
                                    wellMatchParams={wellMatchParams}
                                    pump={pump}
                                    computeWellCapacity={computeWellCapacity}
                                    getOptimizationPath={getOptimizationPath}
                                />

                                <div className="w-full overflow-x-auto min-w-0">
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
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'bha' && (
                    <div className="space-y-6 animate-fadeIn">
                        {!selectedWell ? (
                            <div className="p-8 text-center bg-surface/30 border border-white/5 mt-4">
                                <Layers className="w-8 h-8 mx-auto text-txt-muted/30 mb-2" />
                                <span className="text-xs text-txt-muted font-bold block">Selecciona un pozo de la Flota para comenzar.</span>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* ESP BHA Stack Visualization */}
                                <div className="bg-surface/50 border border-white/5 p-4 rounded-none">
                                    <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                                        <Layers className="w-4 h-4 text-primary" />
                                        <h3 className="text-xs font-black uppercase tracking-wider text-txt-main">Esquema BHA</h3>
                                    </div>
                                    <div className="w-full overflow-x-auto flex justify-center bg-canvas/30 py-4 min-h-[480px]">
                                        {pump ? (
                                            <div className="scale-[0.8] origin-top">
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
                                            <div className="flex flex-col items-center justify-center p-8 opacity-50">
                                                <AlertTriangle className="w-8 h-8 text-warning mb-2" />
                                                <span className="text-xs font-bold text-txt-muted uppercase">Bomba no encontrada</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3D Trajectory Plot */}
                                <div className="bg-surface/50 border border-white/5 p-4 rounded-none">
                                    <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                                        <Compass className="w-4 h-4 text-secondary animate-[spin_10s_linear_infinite]" />
                                        <h3 className="text-xs font-black uppercase tracking-wider text-txt-main">Trayectoria y Desviación</h3>
                                    </div>
                                    <div className="w-full h-[450px]">
                                        {wellMatchParams.survey && wellMatchParams.survey.length > 0 ? (
                                            <TrajectoryPlot 
                                                survey={wellMatchParams.survey} 
                                                params={wellMatchParams} 
                                                isSidebar={false} 
                                            />
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 bg-canvas/10 border border-white/5">
                                                <AlertTriangle className="w-10 h-10 text-warning mb-2" />
                                                <p className="text-xs font-black uppercase">Sin Datos de Trayectoria</p>
                                                <p className="text-[9px] text-txt-muted uppercase mt-1.5 px-6">
                                                    Asumiendo pozo vertical para el cálculo.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'copilot' && (
                    <div className="flex flex-col h-[520px] bg-surface-raised/40 border border-white/5 overflow-hidden animate-fadeIn rounded-none">
                        {/* Chat messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-0">
                            {msgs.map((m, idx) => {
                                const isUser = m.role === 'user';
                                return (
                                    <div key={idx} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        {!isUser && (
                                            <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0 mt-1">
                                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                            </div>
                                        )}
                                        <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed ${isUser ? 'bg-primary text-white rounded-tr-none' : 'bg-surface border border-white/5 rounded-tl-none'}`}>
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
                                <div className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-widest pl-8">
                                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                                    IA Pensando...
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Suggestions */}
                        {suggestions.length > 0 && msgs.length === 1 && (
                            <div className="p-2 border-t border-white/5 bg-canvas/30 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
                                {suggestions.map((s, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => {
                                            setChatInput(s.prompt);
                                            sendChatMessage();
                                        }}
                                        className="px-3 py-1.5 bg-white/5 border border-white/5 hover:bg-white/10 text-txt-muted hover:text-white rounded-full text-[9px] font-bold uppercase transition-all shrink-0"
                                    >
                                        {language === 'es' ? s.es : s.en}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Chat input */}
                        <div className="p-2 border-t border-white/5 bg-surface shrink-0 flex gap-2 items-center">
                            <input 
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                placeholder="Pregunta algo sobre el pozo..."
                                className="flex-1 bg-canvas border border-white/5 px-3 py-2 rounded-xl text-xs font-bold text-txt-main outline-none focus:border-primary/40 placeholder:text-txt-muted/30"
                            />
                            <button 
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="p-2.5 bg-primary text-white disabled:opacity-40 disabled:scale-100 active:scale-95 transition-all rounded-xl"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* BOTTOM NAV TABS */}
            <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-surface/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around z-[110] px-2">
                <button 
                    onClick={() => setActiveTab('fleet')}
                    className={`flex flex-col items-center gap-1 py-1 px-3 ${activeTab === 'fleet' ? 'text-primary' : 'text-txt-muted'}`}
                >
                    <Menu className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Flota</span>
                </button>
                <button 
                    onClick={() => setActiveTab('analysis')}
                    className={`flex flex-col items-center gap-1 py-1 px-3 ${activeTab === 'analysis' ? 'text-primary' : 'text-txt-muted'}`}
                >
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Cotejo</span>
                </button>
                <button 
                    onClick={() => setActiveTab('bha')}
                    className={`flex flex-col items-center gap-1 py-1 px-3 ${activeTab === 'bha' ? 'text-primary' : 'text-txt-muted'}`}
                >
                    <Layers className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">BHA/3D</span>
                </button>
                <button 
                    onClick={() => setActiveTab('copilot')}
                    className={`flex flex-col items-center gap-1 py-1 px-3 ${activeTab === 'copilot' ? 'text-primary' : 'text-txt-muted'}`}
                >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Copilot</span>
                </button>
            </nav>

            {/* FULL-SCREEN IMPORT PROGRESS OVERLAY FOR ONEDRIVE/CSV LOADS */}
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
                    <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent pointer-events-none"></div>
                    <div className="flex flex-col items-center gap-10 max-w-sm w-full relative z-10">
                        <div className="relative group animate-fadeIn">
                            <img
                                src="/LOGO.png"
                                alt="Loading..."
                                className="w-84 h-84 object-contain"
                                style={{ filter: 'drop-shadow(0 0 50px rgba(var(--color-primary), 0.4))' }}
                            />
                        </div>
                        <div className="w-full flex flex-col items-center gap-6 animate-fadeInUp">
                            <div className="text-center space-y-1">
                                <h3 className="text-xl font-bold text-primary uppercase tracking-[0.25em]">
                                    {importProgress.label.replace('...', '')}
                                </h3>
                            </div>
                            <div className="w-full space-y-3 px-8">
                                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_8px_rgba(var(--color-primary),0.4)]"
                                        style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
