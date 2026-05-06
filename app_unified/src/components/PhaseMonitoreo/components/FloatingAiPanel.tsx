import React, { useState, useEffect, useRef } from 'react';
import { WellFleetItem } from '@/types';
import { Download, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { getWellHealthScore } from '../utils/healthEngine';
import { genAI, getApiKey } from '../utils/aiService';
import { AiMemoryService } from '@/services/AiMemoryService';

interface FloatingAiPanelProps {
    fleet: WellFleetItem[];
    selectedWell?: WellFleetItem;
    language: string;
    t: any;
}

export const FloatingAiPanel: React.FC<FloatingAiPanelProps> = ({ fleet, selectedWell, language, t }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState<any>(null);
    const endRef = useRef<HTMLDivElement>(null);

    const [lastInteraction, setLastInteraction] = useState(Date.now());
    
    useEffect(() => {
        if (!isOpen) {
            setLastInteraction(Date.now());
            return;
        }
        const interval = setInterval(() => {
            if (Date.now() - lastInteraction >= 15000) setIsOpen(false);
        }, 1000);
        return () => clearInterval(interval);
    }, [isOpen, lastInteraction]);

    useEffect(() => {
        const apiKey = getApiKey();
        if (!apiKey) {
            setMsgs([{ role: 'model', text: language === 'es' ? "❌ Error: No se encontró la clave de API (GEMINI_API_KEY)." : "❌ Error: No API Key found (GEMINI_API_KEY)." }]);
            return;
        }

        try {
            let contextData = "";
            if (selectedWell) {
                const healthScore = getWellHealthScore(selectedWell);
                contextData = `ANALYSIS FOR SPECIFIC WELL: ${selectedWell.name}
                - Status: ${selectedWell.status.toUpperCase()} (${healthScore.toFixed(0)}/100)
                - Data: PIP=${selectedWell.productionTest.pip || 0} psi, Rate=${selectedWell.productionTest.rate || 0} BPD`;
            } else {
                contextData = `FLEET OVERVIEW: ${fleet.length} wells. Issues: ${fleet.filter(w => w.status !== 'normal').length}`;
            }

            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash-latest',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                },
                systemInstruction: `You are "Antigravity AI Co-Pilot", a Senior ESP Reliability Engineer.
                Provide diagnostics in ${language === 'es' ? 'SPANISH' : 'ENGLISH'}.
                CONTEXT:\n${contextData}`
            } as any);

            const s = model.startChat({ history: [] });
            setSession(s);

            const greet = selectedWell
                ? (language === 'es' ? `Listo. Analizando **${selectedWell.name}**. ¿Qué revisamos?` : `Ready. Analyzing **${selectedWell.name}**. What's next?`)
                : (language === 'es' ? `Hola. Monitoreando **${fleet.length}** pozos. ¿Cómo puedo ayudarte hoy?` : `Hello. Monitoring **${fleet.length}** wells. How can I help?`);

            setMsgs([{ role: 'model', text: greet }]);
        } catch (err: any) {
            console.error("AI Init Error:", err);
            setMsgs([{ role: 'model', text: "⚠️ Antigravity en modo offline o error de conexión. (Revisa tu API Key)" }]);
        }
    }, [selectedWell?.id, language]);

    useEffect(() => { if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, isOpen]);

    const send = async () => {
        if (!input.trim() || !session || loading) return;
        const txt = input; setInput(''); setLoading(true);
        setMsgs(p => [...p, { role: 'user', text: txt }]);
        try {
            const res = await session.sendMessage(txt);
            setMsgs(p => [...p, { role: 'model', text: res.response.text() }]);
        } catch (err: any) {
            console.error("Antigravity AI Send Error:", err);
            setMsgs(p => [...p, { role: 'model', text: `❌ Connection error: ${err.message || 'Unknown issue'}` }]);
        }
        setLoading(false);

        if (session && input && msgs.length > 0) {
            const signature = AiMemoryService.generateSignature(selectedWell ? {
                rate: selectedWell.currentRate,
                pip: selectedWell.productionTest.pip,
                frequency: selectedWell.productionTest.freq,
                model: selectedWell.status
            } : { fleetCount: fleet.length });

            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.role === 'model') {
                AiMemoryService.saveCase({
                    category: 'diagnosis',
                    wellName: selectedWell?.name,
                    technicalSignature: signature,
                    context: selectedWell || { fleetCount: fleet.length },
                    recommendation: lastMsg.text
                });
            }
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
            <div className={`transition-all duration-500 transform origin-bottom-right mb-4 ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none'}`}>
                <div
                    onMouseMove={() => setLastInteraction(Date.now())}
                    onKeyDown={() => setLastInteraction(Date.now())}
                    className="w-[380px] h-[520px] glass-surface border-primary/30 rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
                >
                    <div className="p-5 border-b border-surface-light flex items-center justify-between bg-primary/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary rounded-2xl shadow-[0_0_20px_rgba(var(--color-primary),0.4)] ring-4 ring-primary/20 animate-pulse">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-txt-main text-glow">ANTIGRAVITY AI</h4>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Monitoreo Co-Piloto</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => AiMemoryService.exportMemory()}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all group"
                                title={language === 'es' ? 'Exportar Memoria IA (Archivo .json)' : 'Export AI Memory (.json)'}
                            >
                                <Download className="w-4 h-4 text-txt-muted group-hover:text-primary" />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-surface-light rounded-xl transition-colors">
                                <X className="w-4 h-4 text-txt-muted" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-canvas/30">
                        {msgs.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[11px] leading-relaxed font-medium ${m.role === 'user' ? 'bg-primary text-white shadow-lg rounded-br-none' : 'bg-surface border border-surface-light text-txt-main shadow-sm rounded-bl-none'}`}>
                                    <div className="whitespace-pre-wrap">{m.text}</div>
                                </div>
                            </div>
                        ))}
                        {loading && <div className="flex justify-start"><div className="bg-surface px-4 py-2 rounded-2xl border border-surface-light"><RefreshCw className="w-3 h-3 animate-spin text-primary" /></div></div>}
                        <div ref={endRef} />
                    </div>

                    <div className="p-4 bg-surface border-t border-surface-light">
                        <div className="relative">
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={language === 'es' ? 'Escribe o pregunta...' : 'Ask about fleet/wells...'} className="w-full bg-canvas border border-surface-light rounded-2xl pl-4 pr-12 py-3 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-semibold placeholder:text-txt-muted/50" />
                            <button onClick={send} disabled={!input.trim() || loading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-30">
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <button onClick={() => setIsOpen(!isOpen)} className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_15px_35px_rgba(var(--color-primary),0.4)] transition-all duration-500 group border-4 border-canvas overflow-hidden ${isOpen ? 'bg-surface text-primary rotate-90 scale-90' : 'bg-primary text-white'}`}>
                {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {fleet.filter(w => w.status !== 'normal').length > 0 && !isOpen && (
                    <div className="absolute top-0 right-0 w-4 h-4 bg-danger rounded-full border-2 border-canvas shadow-glow-danger animate-pulse"></div>
                )}
            </button>
        </div>
    );
};
