import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Activity, ChevronLeft, RefreshCw, Download, Database, Trash2, 
    Monitor, Shield, Zap, Droplets, Thermometer, ShieldCheck, 
    TrendingUp, MessageSquare, Menu, X, Send, Sparkles, AlertTriangle,
    Layers, Compass, Target, Globe
} from 'lucide-react';
import { WellFleetItem, EspPump, SystemParams } from '@/types';
import { getWellHealthScore } from './PhaseMonitoreo.helpers';
import { calculateSystemResults, calculateBaseHead } from '../utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { VisualESPStack } from './VisualESPStack';
import { TrajectoryPlot } from './TrajectoryPlot';
import { Phase6 } from './Phase6';

interface Props {
    fleet: WellFleetItem[];
    selectedWell: WellFleetItem | null;
    setSelectedWell: (w: WellFleetItem | null) => void;
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
}

const suggestions = [
    { es: "Riesgo de Gas", en: "Gas Risk", prompt: "¿Cuál es el riesgo de gas en este pozo y el PIP actual?" },
    { es: "Optimización VSD", en: "VSD Opt", prompt: "¿Qué frecuencia sugieres para optimizar la producción?" },
    { es: "Salud Bomba", en: "Pump Health", prompt: "¿Cuál es el estado de degradación actual de la bomba?" }
];

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
    operationalResults
}) => {
    const [activeTab, setActiveTab] = useState<'fleet' | 'analysis' | 'bha' | 'copilot'>('fleet');
    
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
    const wellHealth = selectedWell ? getWellHealthScore(selectedWell) : 0;

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
        if (!selectedWell) return { pump: 'normal', motor: 'normal', seal: 'normal', cable: 'normal', vsd: 'normal' } as any;
        return {
            pump: selectedWell.health.pump,
            motor: selectedWell.health.motor,
            seal: selectedWell.health.seal,
            cable: selectedWell.health.cable,
            vsd: (selectedWell.predictive.vsdStatus === 'alert') ? 'alert' : (selectedWell.predictive.vsdStatus === 'caution' ? 'caution' : 'normal')
        } as any;
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

                <div className="flex items-center gap-1">
                    <button 
                        onClick={onForceSync}
                        disabled={isSyncingOneDrive}
                        className="p-2.5 bg-white/5 border border-white/5 hover:bg-white/10 rounded-lg text-txt-muted active:scale-95 transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncingOneDrive ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* TAB CONTENTS */}
            <main className="flex-1 overflow-y-auto p-3 min-h-0 custom-scrollbar pb-8">
                {activeTab === 'fleet' && (
                    <div className="space-y-4 animate-fadeIn">
                        {/* Fleet Actions */}
                        <div className="grid grid-cols-2 gap-2 bg-surface/50 p-2.5 border border-white/5">
                            <button 
                                onClick={() => importDesignRef.current?.click()}
                                className="flex items-center justify-center gap-2 py-3 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-wider active:bg-primary/20"
                            >
                                <Database className="w-3.5 h-3.5" />
                                Diseños
                            </button>
                            <button 
                                onClick={() => importDbRef.current?.click()}
                                className="flex items-center justify-center gap-2 py-3 bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-black uppercase tracking-wider active:bg-secondary/20"
                            >
                                <TrendingUp className="w-3.5 h-3.5" />
                                Historial
                            </button>
                        </div>

                        {/* Well List */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-txt-muted uppercase tracking-widest px-1">Pozos de la Flota ({fleet.length})</h3>
                            {fleet.length === 0 ? (
                                <div className="p-8 text-center bg-surface/30 border border-white/5">
                                    <Activity className="w-8 h-8 mx-auto text-txt-muted/30 mb-2" />
                                    <span className="text-xs text-txt-muted font-bold block">No hay pozos cargados. Usa los botones de arriba.</span>
                                </div>
                            ) : (
                                fleet.map(w => {
                                    const score = getWellHealthScore(w);
                                    const scoreColor = score >= 90 ? 'text-success border-success/30 bg-success/5' : score >= 60 ? 'text-warning border-warning/30 bg-warning/5' : 'text-danger border-danger/30 bg-danger/5';
                                    const isCurrentSelected = selectedWell?.id === w.id;

                                    return (
                                        <div 
                                            key={w.id}
                                            onClick={() => {
                                                setSelectedWell(w);
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
                            <div className="w-full overflow-x-auto min-w-0">
                                <Phase6
                                    key={selectedWell.id}
                                    params={wellMatchParams}
                                    syncParams={false}
                                    onHistoryMatchChange={onHistoryMatchChange}
                                    pump={pump}
                                    designFreq={selectedWell.productionTest.freq || 60}
                                />
                            </div>
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
                                                    health={physicalHealth}
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
        </div>
    );
};
