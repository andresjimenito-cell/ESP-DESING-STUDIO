import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Activity, ChevronLeft, RefreshCw, Download, Database, Trash2, 
    Monitor, Shield, Zap, Droplets, Thermometer, ShieldCheck, 
    TrendingUp, MessageSquare, Menu, X, Send, Sparkles, AlertTriangle,
    Layers, Compass, Target, Globe
} from 'lucide-react';
import { WellFleetItem, EspPump, SystemParams } from '@/types';
import { getWellHealthScore, isWellMatchComplete } from './PhaseMonitoreo.helpers';
import { generateMultiCurveData, findIntersection, calculateSystemResults, getShaftLimitHp, calculateTDH, calculateBaseHead } from '../utils';
import { AiMemoryService } from '../services/AiMemoryService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PerformanceCurveMultiAxis } from './PerformanceCurveMultiAxis';
import { VisualESPStack } from './VisualESPStack';
import { TrajectoryPlot } from './TrajectoryPlot';

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
    const [activeTab, setActiveTab] = useState<'fleet' | 'telemetry' | 'simulation' | 'bha' | 'copilot'>('fleet');
    const [simFreq, setSimFreq] = useState<number>(60);
    
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
        if (selectedWell?.productionTest?.freq) {
            setSimFreq(selectedWell.productionTest.freq);
        }
    }, [selectedWell?.id, language]);

    useEffect(() => {
        if (activeTab === 'copilot') {
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [msgs, activeTab]);

    // Active well health results
    const wellHealth = selectedWell ? getWellHealthScore(selectedWell) : 0;
    const isRunning = selectedWell ? (selectedWell.estadoActual === 'operativo' || (selectedWell.productionTest?.freq || 0) > 20) : false;

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

    // Dynamic curve data and intersection matching for the simulated slider frequency
    const { curveData, matchPoint, simResults } = useMemo(() => {
        if (!selectedWell || !pump || !wellMatchParams) return { curveData: [], matchPoint: null, simResults: null };

        const test = selectedWell.productionTest;
        const steps = 50;
        const maxQ = (pump.maxRate || (pump as any).maxFlow || 3000) * 1.5;
        const data: any[] = [];

        for (let i = 0; i <= steps; i++) {
            const q = (maxQ / steps) * i;
            const point: any = { flow: q };

            // Design Curve at 60Hz
            const dH = (pump.h0 + pump.h1 * q + pump.h2 * q ** 2 + pump.h3 * q ** 3 + pump.h4 * q ** 4 + pump.h5 * q ** 5 + pump.h6 * q ** 6) * pump.stages;
            point.headNew = dH > 0 ? dH : null;

            // Actual Curve at simulated frequency
            const fRatio = simFreq / 60;
            const qAdj = q / fRatio;
            const hBase = (pump.h0 + pump.h1 * qAdj + pump.h2 * qAdj ** 2 + pump.h3 * qAdj ** 3 + pump.h4 * qAdj ** 4 + pump.h5 * qAdj ** 5 + pump.h6 * qAdj ** 6) * pump.stages;
            const hActual = hBase * (fRatio ** 2);
            point.headCurr = hActual > 0 ? hActual : null;

            try {
                const sysH = calculateTDH(q, wellMatchParams);
                point.systemCurve = sysH;
            } catch (e) { }

            data.push(point);
        }

        const actualTDH = (test.pdp > 0 && test.pip > 0)
            ? (test.pdp - test.pip) / 0.43
            : (test.thp * 2.31 + selectedWell.depthMD * 0.43 - test.pip * 2.31) / 0.43;

        // Simulated intersection results
        let currentSim = null;
        try {
            const m = findIntersection(data);
            if (m && m.flow > 0) {
                currentSim = calculateSystemResults(m.flow, m.head, wellMatchParams, pump, simFreq);
            }
        } catch {}

        return {
            curveData: data,
            matchPoint: { flow: test.rate, head: actualTDH },
            simResults: currentSim
        };
    }, [selectedWell?.id, pump?.id, wellMatchParams, simFreq]);

    const sendChatMessage = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading) return;
        setChatInput('');
        setChatLoading(true);
        setMsgs(p => [...p, { role: 'user', text }]);

        try {
            let contextData = "";
            if (selectedWell && simResults) {
                contextData = `POZO: ${selectedWell.name} (Health: ${wellHealth.toFixed(0)}%, Freq Campo: ${selectedWell.productionTest?.freq} Hz)
                - Frecuencia Simulada: ${simFreq} Hz
                - Caudal Predicho: ${Math.round(simResults.rate || 0)} BPD
                - Presion Entrada PIP: ${Math.round(simResults.pip || 0)} psi
                - Presion Fondo Pwf: ${Math.round(simResults.pwf || 0)} psi
                - Sumergencia: ${Math.round(simResults.submergenceFt || 0)} ft
                - Carga Motor: ${Math.round(simResults.motorLoad || 0)}%`;
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
                                                setActiveTab('telemetry');
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

                {activeTab === 'telemetry' && (
                    <div className="space-y-4 animate-fadeIn">
                        {!selectedWell ? (
                            <div className="p-8 text-center bg-surface/30 border border-white/5 mt-4">
                                <Monitor className="w-8 h-8 mx-auto text-txt-muted/30 mb-2" />
                                <span className="text-xs text-txt-muted font-bold block">Selecciona un pozo de la Flota para comenzar.</span>
                            </div>
                        ) : (
                            <>
                                {/* Health Summary Widget */}
                                <div className="bg-surface/70 border border-white/5 p-4 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">Estado Operativo</span>
                                        <span className="text-base font-black text-txt-main mt-1 uppercase flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                                            {isRunning ? 'Operando' : 'Detenido'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">Salud</span>
                                        <span className={`text-lg font-black font-mono ${wellHealth >= 90 ? 'text-success' : wellHealth >= 60 ? 'text-warning' : 'text-danger'}`}>
                                            {wellHealth.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Metric Grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">PIP (Entrada)</span>
                                        <span className="text-base font-mono font-black text-txt-main">{Math.round(selectedWell.productionTest?.pip || 0)} <small className="text-[9px] opacity-40">psi</small></span>
                                    </div>
                                    <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">PDP (Descarga)</span>
                                        <span className="text-base font-mono font-black text-txt-main">{Math.round(selectedWell.productionTest?.pdp || 0)} <small className="text-[9px] opacity-40">psi</small></span>
                                    </div>
                                    <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Voltaje</span>
                                        <span className="text-base font-mono font-black text-txt-main">{Math.round(selectedWell.productionTest?.volts || 0)} <small className="text-[9px] opacity-40">V</small></span>
                                    </div>
                                    <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Corriente</span>
                                        <span className="text-base font-mono font-black text-txt-main">{(selectedWell.productionTest?.amps || 0).toFixed(1)} <small className="text-[9px] opacity-40">A</small></span>
                                    </div>
                                    <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Caudal Crudo</span>
                                        <span className="text-base font-mono font-black text-txt-main">{Math.round(selectedWell.currentRate || selectedWell.productionTest?.rate || 0)} <small className="text-[9px] opacity-40">BPD</small></span>
                                    </div>
                                    <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Corte de Agua (BS&W)</span>
                                        <span className="text-base font-mono font-black text-txt-main">{(selectedWell.productionTest?.waterCut || 0).toFixed(1)} <small className="text-[9px] opacity-40">%</small></span>
                                    </div>
                                </div>

                                {/* Component Statuses */}
                                <div className="bg-surface/50 border border-white/5 p-4 space-y-3">
                                    <h4 className="text-[9px] font-black text-txt-muted uppercase tracking-widest">Salud de Componentes</h4>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-black">
                                        <div className="flex items-center justify-between p-2 bg-canvas/30 border border-white/5">
                                            <span className="text-txt-muted uppercase">Bomba</span>
                                            <span className={selectedWell.health?.pump === 'normal' ? 'text-success' : 'text-danger'}>OPTIMAL</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 bg-canvas/30 border border-white/5">
                                            <span className="text-txt-muted uppercase">Motor</span>
                                            <span className={selectedWell.health?.motor === 'normal' ? 'text-success' : 'text-danger'}>OPTIMAL</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 bg-canvas/30 border border-white/5">
                                            <span className="text-txt-muted uppercase">Sello</span>
                                            <span className={selectedWell.health?.seal === 'normal' ? 'text-success' : 'text-danger'}>OPTIMAL</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 bg-canvas/30 border border-white/5">
                                            <span className="text-txt-muted uppercase">Cable</span>
                                            <span className={selectedWell.health?.cable === 'normal' ? 'text-success' : 'text-danger'}>OPTIMAL</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'simulation' && (
                    <div className="space-y-4 animate-fadeIn">
                        {!selectedWell ? (
                            <div className="p-8 text-center bg-surface/30 border border-white/5 mt-4">
                                <TrendingUp className="w-8 h-8 mx-auto text-txt-muted/30 mb-2" />
                                <span className="text-xs text-txt-muted font-bold block">Selecciona un pozo de la Flota para comenzar.</span>
                            </div>
                        ) : (
                            <>
                                {/* Slider Panel */}
                                <div className="bg-surface border border-white/5 p-4 rounded-none space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest">Frecuencia Simulada</span>
                                        <span className="text-xl font-mono font-black text-primary">{simFreq} Hz</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="30"
                                        max="80"
                                        step="1"
                                        value={simFreq}
                                        onChange={(e) => setSimFreq(parseInt(e.target.value))}
                                        className="w-full h-2 bg-primary/20 appearance-none rounded-none accent-primary cursor-pointer"
                                    />
                                    <div className="grid grid-cols-3 gap-1">
                                        <button onClick={() => setSimFreq(50)} className="py-1 bg-white/5 text-[9px] font-black uppercase text-txt-muted active:bg-white/10">50 Hz</button>
                                        <button onClick={() => setSimFreq(60)} className="py-1 bg-white/5 text-[9px] font-black uppercase text-txt-muted active:bg-white/10">60 Hz</button>
                                        <button onClick={() => setSimFreq(70)} className="py-1 bg-white/5 text-[9px] font-black uppercase text-txt-muted active:bg-white/10">70 Hz</button>
                                    </div>
                                </div>

                                {/* Simulation Results */}
                                {simResults ? (
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black text-txt-muted uppercase tracking-widest px-1">Comportamiento Proyectado</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Caudal Proyectado</span>
                                                <span className="text-base font-mono font-black text-success">{Math.round(simResults.rate || 0)} <small className="text-[9px] opacity-40">BPD</small></span>
                                            </div>
                                            <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">PIP Proyectado</span>
                                                <span className="text-base font-mono font-black text-success">{Math.round(simResults.pip || 0)} <small className="text-[9px] opacity-40">psi</small></span>
                                            </div>
                                            <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Carga Motor</span>
                                                <span className="text-base font-mono font-black text-txt-main">{Math.round(simResults.motorLoad || 0)}%</span>
                                            </div>
                                            <div className="bg-surface p-3 border border-white/5 flex flex-col justify-between h-20">
                                                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Carga Eje Bomba</span>
                                                <span className="text-base font-mono font-black text-txt-main">
                                                    {pump ? Math.round((simResults.hpTotal / (getShaftLimitHp(pump.series) || 1)) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-danger/5 border border-danger/25">
                                        <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-2 animate-bounce" />
                                        <span className="text-xs text-danger font-black uppercase block">Sin Convergencia</span>
                                        <span className="text-[10px] text-txt-muted mt-1 block">A la frecuencia simulada, la bomba no puede vencer la contrapresión del sistema.</span>
                                    </div>
                                )}

                                {/* Nodal & Performance Curve Chart - FULL INTERACTION ON MOBILE */}
                                {pump && (
                                    <div className="w-full h-[400px] mt-4 select-none">
                                        <PerformanceCurveMultiAxis
                                            data={curveData}
                                            currentFlow={selectedWell.productionTest.rate}
                                            pump={pump}
                                            frequency={simFreq}
                                            minHeight={360}
                                        />
                                    </div>
                                )}
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
                    onClick={() => setActiveTab('telemetry')}
                    className={`flex flex-col items-center gap-1 py-1 px-3 ${activeTab === 'telemetry' ? 'text-primary' : 'text-txt-muted'}`}
                >
                    <Monitor className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Telemetria</span>
                </button>
                <button 
                    onClick={() => setActiveTab('simulation')}
                    className={`flex flex-col items-center gap-1 py-1 px-3 ${activeTab === 'simulation' ? 'text-primary' : 'text-txt-muted'}`}
                >
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Nodal</span>
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
