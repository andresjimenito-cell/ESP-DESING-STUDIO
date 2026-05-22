import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, RefreshCw, Download, Settings, Brain } from 'lucide-react';
import { WellFleetItem, EspPump, SystemParams } from '@/types';
import { getWellHealthScore } from './PhaseMonitoreo.helpers';
import { AiMemoryService } from '../services/AiMemoryService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AiMemoryManager } from './AiMemoryManager';
import { generateMultiCurveData, findIntersection, calculateSystemResults, getShaftLimitHp } from '../utils';

// 📊 TELEMETRY STATUS BAR COMPONENT 📊
const StatusBar = ({ well, language }: { well: WellFleetItem; language: string }) => {
    const healthScore = getWellHealthScore(well);
    const test = well.productionTest;
    
    // Determine running status
    const testFreq = test?.freq || 0;
    const testRate = test?.rate || well.currentRate || 0;
    const isRunning = well.estadoActual === 'operativo' || testFreq > 20 || testRate > 5;
    
    const ampsVal = test?.amps ? `${test.amps.toFixed(1)} A` : (isRunning ? '45.0 A' : '0.0 A');
    const voltsVal = test?.volts ? `${test.volts.toFixed(0)} V` : (isRunning ? '480 V' : '0 V');
    const effVal = test?.efficiency ? `${test.efficiency.toFixed(1)}%` : (isRunning ? '65.0%' : '0.0%');
    const rateVal = `${Math.round(testRate)} BPD`;
    const freqVal = `${testFreq} Hz`;
    const pressVal = `${Math.round(test?.pip || 0)} / ${Math.round(test?.pdp || 0)} psi`;
    
    const healthColor = well.status === 'normal' ? 'bg-emerald-500' : well.status === 'caution' ? 'bg-amber-500' : 'bg-rose-500';
    const statusText = well.estadoActual ? well.estadoActual.toUpperCase() : (isRunning ? 'OPERANDO' : 'DETENIDO');

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3.5 bg-canvas/65 border-b border-surface-light/85 backdrop-blur-md shrink-0">
            <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">
                    {language === 'es' ? 'Estado' : 'Status'}
                </span>
                <div className="flex items-center gap-1.5 mt-1 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${healthColor} shrink-0 animate-pulse`} />
                    <span className="text-[11px] font-black text-txt-main truncate font-mono">
                        {statusText} ({healthScore.toFixed(0)}%)
                    </span>
                </div>
            </div>
            
            <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">
                    {language === 'es' ? 'Frecuencia / Caudal' : 'Freq / Rate'}
                </span>
                <span className="text-[11px] font-black text-txt-main mt-1 truncate font-mono">
                    {freqVal} · {rateVal}
                </span>
            </div>

            <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">
                    Presión PIP / PDP
                </span>
                <span className="text-[11px] font-black text-txt-main mt-1 truncate font-mono">
                    {pressVal}
                </span>
            </div>

            <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-wider">
                    {language === 'es' ? 'Corriente / Efic.' : 'Current / Eff'}
                </span>
                <span className="text-[11px] font-black text-txt-main mt-1 truncate font-mono">
                    {ampsVal} · {effVal}
                </span>
            </div>
        </div>
    );
};

// 💬 MESSAGE BUBBLE COMPONENT 💬
const MessageBubble = ({
    role,
    text,
    isLastModel,
    isLoading
}: {
    role: string;
    text: string;
    isLastModel: boolean;
    isLoading: boolean;
}) => {
    const isUser = role === 'user';
    
    return (
        <div className={`flex w-full gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner mt-1">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
            )}
            <div
                className={`max-w-[85%] px-5 py-4 rounded-2xl text-[13.5px] leading-relaxed font-medium shadow-lg transition-all duration-300 ${
                    isUser 
                        ? 'bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white rounded-tr-none border-0 shadow-primary/15' 
                        : 'bg-surface/40 border border-surface-light/80 text-txt-main rounded-tl-none backdrop-blur-md'
                }`}
            >
                {isUser ? (
                    <div className="whitespace-pre-wrap selection:bg-white/20">{text}</div>
                ) : (
                    <div className="markdown-content select-text selection:bg-primary/20">
                        <MarkdownRenderer content={text} isStreaming={isLastModel && isLoading} />
                    </div>
                )}
            </div>
        </div>
    );
};

// ⏳ THINKING INDICATOR ⏳
const ThinkingDots = () => {
    return (
        <div className="flex items-center gap-2 py-1">
            <span className="text-[11px] font-black text-primary uppercase tracking-widest animate-pulse">
                IA Monitoreo
            </span>
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
        </div>
    );
};

// 🧠 FLOATING AI PANEL FOR MONITORING 🧠
export const FloatingAiPanel = ({
    fleet,
    selectedWell,
    language,
    t,
    wellParams,
    pump,
    operationalResults
}: {
    fleet: WellFleetItem[],
    selectedWell?: WellFleetItem,
    language: string,
    t: any,
    wellParams?: SystemParams,
    pump?: EspPump | null,
    operationalResults?: any
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'chat' | 'memory'>('chat');
    const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('openrouter_api_key') || '');
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const lastInteractionRef = useRef(Date.now());
    const touchActivity = () => { lastInteractionRef.current = Date.now(); };

    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            if (Date.now() - lastInteractionRef.current >= 30000) setIsOpen(false);
        }, 5000);
        return () => clearInterval(interval);
    }, [isOpen]);

    useEffect(() => {
        const greet = selectedWell
            ? (language === 'es' ? `Listo. Analizando **${selectedWell.name}**. ¿Qué revisamos?` : `Ready. Analyzing **${selectedWell.name}**. What's next?`)
            : (language === 'es' ? `Hola. Monitoreando **${fleet.length}** pozos. ¿Cómo puedo ayudarte hoy?` : `Hello. Monitoring **${fleet.length}** wells. How can I help?`);

        setMsgs([{ role: 'model', text: greet }]);
    }, [selectedWell?.id, language]);

    useEffect(() => { if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, isOpen]);

    const send = async () => {
        if (!input.trim() || loading) return;
        const txt = input; setInput(''); setLoading(true);
        setMsgs(p => [...p, { role: 'user', text: txt }]);
        try {
            let contextData = "";
            if (selectedWell) {
                const healthScore = getWellHealthScore(selectedWell);

                // Determine running status
                const testFreq = selectedWell.productionTest?.freq || 0;
                const testRate = selectedWell.productionTest?.rate || selectedWell.currentRate || 0;
                const isRunning = selectedWell.estadoActual === 'operativo' || testFreq > 20 || testRate > 5;

                // Extract or compute current operational parameters
                let amps = selectedWell.productionTest?.amps;
                let volts = selectedWell.productionTest?.volts;
                let efficiency = selectedWell.productionTest?.efficiency;
                let hp = selectedWell.productionTest?.hp;

                if (isRunning) {
                    if (!amps || amps === 0) {
                        amps = operationalResults?.electrical?.amps;
                        if (!amps || amps === 0) {
                            if (selectedWell.consumptionReal && selectedWell.consumptionReal > 0) {
                                amps = (selectedWell.consumptionReal * 1000) / (1.732 * 480 * 0.85);
                            } else {
                                amps = 45;
                            }
                        }
                    }
                    if (!volts || volts === 0) {
                        volts = operationalResults?.electrical?.volts || 480;
                    }
                    if (!efficiency || efficiency === 0) {
                        efficiency = operationalResults?.efficiency || operationalResults?.effEstimated;
                        if (!efficiency || efficiency === 0) {
                            efficiency = 65;
                        }
                    }
                    if (!hp || hp === 0) {
                        hp = operationalResults?.hpTotal || operationalResults?.hpActual || (amps * volts * 1.732 * 0.85 * 0.90) / 746 || 25;
                    }
                } else {
                    amps = amps || 0;
                    volts = volts || 0;
                    efficiency = efficiency || 0;
                    hp = hp || 0;
                }

                // Format values
                const ampsVal = Number(Number(amps).toFixed(1));
                const voltsVal = Number(Number(volts).toFixed(0));
                const effVal = Number(Number(efficiency).toFixed(1));
                const hpVal = Number(Number(hp).toFixed(1));

                // Derived parameters for the current operating point
                const bswVal = selectedWell.productionTest?.waterCut || 0;
                const bopdVal = Math.round(testRate * (1 - bswVal / 100));
                const bwpdVal = Math.round(testRate * (bswVal / 100));

                const pipVal = selectedWell.productionTest?.pip || 0;
                const pdpVal = selectedWell.productionTest?.pdp || 0;

                const pStatic = wellParams?.inflow?.pStatic || 0;
                const pwfVal = operationalResults?.pwf || 0;
                const drawdownVal = Math.max(0, pStatic - pwfVal);
                const tdhVal = operationalResults?.tdh || 0;
                const kvaVal = operationalResults?.electrical?.kva || (1.732 * voltsVal * ampsVal) / 1000 || 0;
                const motorKwVal = operationalResults?.electrical?.kw || (hpVal * 0.746) || 0;
                const systemKwVal = operationalResults?.electrical?.systemKw || (motorKwVal / 0.95) || 0;
                const motorLoadVal = operationalResults?.motorLoad || 0;
                const pumpShaftLoadVal = operationalResults?.pumpShaftLoad || 0;
                const fluidVelVal = operationalResults?.fluidVelocity || 0;

                const mixSG = operationalResults?.sgMixed || 1.0;
                const submergenceVal = Math.max(0, pipVal - (wellParams?.pressures?.phc || 0)) / (0.433 * mixSG);
                const thrustStatus = operationalResults?.thrustStatus || 'Normal';

                // Build VSD Sensitivity Matrix (30-80 Hz)
                let vsdSensitivitySummary: any[] = [];
                if (pump && wellParams) {
                    try {
                        const freqsToSimulate = [30, 40, 50, 60, 70, 80];
                        if (testFreq && !freqsToSimulate.includes(testFreq)) {
                            freqsToSimulate.push(testFreq);
                        }
                        freqsToSimulate.sort((a, b) => a - b);

                        vsdSensitivitySummary = freqsToSimulate.map(hz => {
                            const cData = generateMultiCurveData(pump, wellParams, hz, 60);
                            const m = findIntersection(cData);
                            let flow = m ? m.flow : 0;
                            let head = m ? m.head : 0;
                            if (flow <= 0) {
                                return { frequency_Hz: hz, status: "No intersection / Pump cannot overcome system head" };
                            }
                            const res = calculateSystemResults(flow, head, wellParams, pump, hz);
                            const shaftLimit = getShaftLimitHp(pump?.series || '');
                            const bhp = res.hpTotal || 0;
                            const pumpShaftLoad = shaftLimit > 0 ? (bhp / shaftLimit) * 100 : 0;

                            const bswVal = wellParams.fluids?.waterCut || 0;
                            const bopd = flow * (1 - bswVal / 100);
                            const bwpd = flow * (bswVal / 100);

                            const pStatic = wellParams.inflow?.pStatic || 0;
                            const pwf = res.pwf || 0;
                            const drawdown = Math.max(0, pStatic - pwf);

                            const mixSG = res.sgMixed || 1.0;
                            const submergenceFt = Math.max(0, (res.pip || 0) - (wellParams.pressures?.phc || 0)) / (0.433 * mixSG);

                            return {
                                frequency_Hz: hz,
                                flowRate_BFPD: Math.round(flow),
                                bopd_BOPD: Math.round(bopd),
                                bwpd_BWPD: Math.round(bwpd),
                                waterCut_BSW_pct: bswVal,
                                pip_psi: Math.round(res.pip || 0),
                                pdp_psi: Math.round(res.pdp || 0),
                                pwf_psi: Math.round(pwf),
                                drawdown_psi: Math.round(drawdown),
                                tdh_ft: Math.round(res.tdh || 0),
                                amps_A: Number((res.electrical?.amps || 0).toFixed(1)),
                                volts_V: Number((res.electrical?.volts || 0).toFixed(0)),
                                kva_kVA: Number((res.electrical?.kva || 0).toFixed(1)),
                                motorKw_kW: Number((res.electrical?.kw || 0).toFixed(1)),
                                systemKw_kW: Number((res.electrical?.systemKw || 0).toFixed(1)),
                                motorLoad_pct: Math.round(res.motorLoad || 0),
                                pumpShaftLoad_pct: Math.round(pumpShaftLoad),
                                pumpEfficiency_pct: Number((res.efficiency || 0).toFixed(1)),
                                fluidVelocity_fts: Number((res.fluidVelocity || 0).toFixed(2)),
                                submergence_ft: Math.round(submergenceFt),
                                thrustStatus: res.thrustStatus || 'Normal'
                            };
                        });
                    } catch (e) {
                        console.error("Error generating VSD summary for context:", e);
                    }
                }

                let vsdTableMarkdown = "";
                if (vsdSensitivitySummary.length > 0) {
                    vsdTableMarkdown = `\n### MATRIZ DE SENSIBILIDAD VSD (SIMULACIÓN 30-80 Hz)\n` +
                        `| Frecuencia | BFPD | BOPD | BWPD | PIP (psi) | PDP (psi) | Pwf (psi) | Abat. (psi) | TDH (ft) | Corriente (A) | Voltaje (V) | Potencia kVA | Potencia kW (Motor) | Carga Motor (%) | Carga Eje Bomba (%) | Eficiencia Bomba (%) | Vel. Fluido (ft/s) | Sumergencia (ft) | Thrust/Vibración |\n` +
                        `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n` +
                        vsdSensitivitySummary.map(row => {
                            if (row.status) {
                                return `| ${row.frequency_Hz} Hz | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | ${row.status} |`;
                            }
                            return `| ${row.frequency_Hz} Hz | ${row.flowRate_BFPD} | ${row.bopd_BOPD} | ${row.bwpd_BWPD} | ${row.pip_psi} | ${row.pdp_psi} | ${row.pwf_psi} | ${row.drawdown_psi} | ${row.tdh_ft} | ${row.amps_A} A | ${row.volts_V} V | ${row.kva_kVA} | ${row.motorKw_kW} | ${row.motorLoad_pct}% | ${row.pumpShaftLoad_pct}% | ${row.pumpEfficiency_pct}% | ${row.fluidVelocity_fts} | ${row.submergence_ft} | ${row.thrustStatus} |`;
                        }).join('\n');
                }

                contextData = `ANALYSIS FOR SPECIFIC WELL: ${selectedWell.name}
                - General Status: ${selectedWell.status.toUpperCase()} (Health Score: ${healthScore.toFixed(0)}/100, Estado Actual: ${selectedWell.estadoActual || 'N/A'})
                - System/ALS: ${selectedWell.als || 'ESP'}
                
                - Measured/Computed Operational Point:
                  * Running Status (Operando): ${isRunning ? 'SÍ (Activo)' : 'NO (Apagado)'}
                  * Frequency (Frecuencia): ${testFreq} Hz
                  * Total Flow Rate (Caudal Total BFPD): ${testRate} BPD
                  * Oil Rate (Caudal Crudo BOPD): ${bopdVal} BOPD
                  * Water Rate (Caudal Agua BWPD): ${bwpdVal} BWPD
                  * Target Flow Rate (Caudal Objetivo): ${selectedWell.targetRate || 0} BPD
                  * Water Cut / BS&W: ${bswVal}%
                  * GOR (Gas Oil Ratio): ${selectedWell.productionTest?.gor || 0} scf/stb
                  * PIP (Intake Pressure / Presión de Entrada): ${pipVal} psi
                  * PDP (Discharge Pressure / Presión de Descarga): ${pdpVal} psi
                  * Pwf (Presión de Fondo Fluyendo): ${Math.round(pwfVal)} psi
                  * Drawdown (Abatimiento): ${Math.round(drawdownVal)} psi
                  * TDH (Cabezal Dinámico Total): ${Math.round(tdhVal)} ft
                  * THP (Tubing Head Pressure / Presión de Cabezal): ${selectedWell.productionTest?.thp || 0} psi
                  * Operating Motor Power: ${hpVal} HP
                  * Operating Current (Amperaje): ${ampsVal} A
                  * Operating Voltage (Voltaje): ${voltsVal} V
                  * System kVA: ${kvaVal.toFixed(1)} kVA
                  * Motor Active Power (kW): ${motorKwVal.toFixed(1)} kW
                  * System Active Power (kW): ${systemKwVal.toFixed(1)} kW
                  * Motor Load (Carga de Motor): ${Math.round(motorLoadVal)}%
                  * Pump Shaft Load (Carga de Eje de Bomba): ${Math.round(pumpShaftLoadVal)}%
                  * Pump Efficiency (Eficiencia Bomba): ${effVal}%
                  * Fluid Velocity (Velocidad de Fluido): ${fluidVelVal.toFixed(2)} ft/s
                  * Submergence (Sumergencia): ${Math.round(submergenceVal)} ft
                  * Thrust Status (Vibraciones / Empuje): ${thrustStatus}
                  
                - Component Health:
                  * Pump: ${selectedWell.health?.pump || 'normal'}
                  * Motor: ${selectedWell.health?.motor || 'normal'}
                  * Seal: ${selectedWell.health?.seal || 'normal'}
                  * Sensor: ${selectedWell.health?.sensor || 'active'}
                  * Cable: ${selectedWell.health?.cable || 'normal'}
                - Predictive Indicators:
                  * Time to Failure (TTF): ${selectedWell.predictive?.ttf || 'N/A'} days
                  * VSD Status: ${selectedWell.predictive?.vsdStatus || 'optimal'} (${selectedWell.predictive?.vsdAnalysis || 'N/A'})
                  * Transformer Status: ${selectedWell.predictive?.transformerStatus || 'optimal'} (${selectedWell.predictive?.transformerAnalysis || 'N/A'})
                  * Vent Box Status: ${selectedWell.predictive?.ventBoxStatus || 'optimal'} (${selectedWell.predictive?.ventBoxAnalysis || 'N/A'})`;

                if (vsdTableMarkdown) {
                    contextData += `\n\n=== VSD SIMULATION RESULTS (30-80 Hz) ===\n${vsdTableMarkdown}`;
                }
            } else {
                contextData = `FLEET OVERVIEW:
                - Total Wells: ${fleet.length}
                - Wells with Issues/Alerts: ${fleet.filter(w => w.status !== 'normal').length}
                - Fleet List:
                ${fleet.map(w => `  * ${w.name}: Status=${w.status.toUpperCase()}, Rate=${w.currentRate} BPD, Target=${w.targetRate} BPD, Freq=${w.productionTest?.freq} Hz, BS&W=${w.productionTest?.waterCut}%`).join('\n')}`;
            }

            const historicalContext = AiMemoryService.findRelevantContext(txt, selectedWell?.name);
            const contextWithHistory = historicalContext
                ? `${contextData}\n\n=== MEMORIA HISTÓRICA / CASOS PREVIOS RELEVANTES ===\n${historicalContext}`
                : contextData;

            const systemInstruction = `You are "IA Monitoreo", a Senior ESP Reliability Engineer.
            Provide diagnostics and answer user questions in ${language === 'es' ? 'SPANISH (ESPAÑOL)' : 'ENGLISH'}.
            Do not request information from the user (such as pump curves, BS&W, frequency, or pressures) if it is already present in the CONTEXT below. Use the CONTEXT data directly to answer and make predictions.
            Aprovecha la "MEMORIA HISTÓRICA / CASOS PREVIOS RELEVANTES" si contiene información del pozo o de la situación técnica consultada.
            CONTEXT:\n${contextWithHistory}`.trim();

            const apiMessages = [
                ...msgs.map(m => ({
                    role: m.role === 'model' ? 'assistant' : m.role,
                    content: m.text
                })),
                {
                    role: 'user',
                    content: txt
                }
            ];

            const userKey = localStorage.getItem('openrouter_api_key') || '';
            const headers: Record<string, string> = {
                "Content-Type": "application/json"
            };
            if (userKey && userKey !== 'null' && userKey !== 'undefined') {
                headers["Authorization"] = `Bearer ${userKey}`;
            }

            const res = await fetch("http://127.0.0.1:4000/api/copilot/stream", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    systemInstruction,
                    messages: apiMessages
                })
            });

            if (!res.ok) {
                throw new Error(`OpenRouter Proxy Error: ${res.statusText}`);
            }

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

            const signature = AiMemoryService.generateSignature(selectedWell ? {
                rate: selectedWell.currentRate,
                pip: selectedWell.productionTest?.pip || 0,
                frequency: selectedWell.productionTest?.freq || 60,
                model: selectedWell.status
            } : { fleetCount: fleet.length });

            AiMemoryService.saveCase({
                category: 'diagnosis',
                wellName: selectedWell?.name,
                technicalSignature: signature,
                context: selectedWell || { fleetCount: fleet.length },
                recommendation: streamText
            });
        } catch (err: any) {
            console.error("IA Monitoreo Send Error:", err);
            setMsgs(p => [...p, { role: 'model', text: `⚠️ Connection error: ${err.message || 'Unknown issue'}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
            <div style={{
                marginBottom: 14,
                transformOrigin: 'bottom right',
                transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
                transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(16px)',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
            }}>
                <div
                    onMouseMove={touchActivity}
                    onKeyDown={touchActivity}
                    style={{
                        width: 'min(95vw, 760px)',
                        height: 'min(85vh, 760px)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderRadius: 28,
                        background: 'var(--color-canvas, #0f1117)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 32px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(24px)',
                    }}
                >
                    {/* CHAT HEADER */}
                    <div className="p-5 border-b border-surface-light/80 flex items-center justify-between bg-gradient-to-r from-primary/10 via-primary/5 to-transparent backdrop-blur-md">
                        <div>
                            <div style={{
                                fontSize: 14, fontWeight: 800, letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#ffffff',
                                fontFamily: 'ui-monospace, "Cascadia Code", monospace',
                            }}>
                                {selectedWell
                                    ? <span>ia Monitoreo · <span style={{ color: 'var(--color-primary, #3b82f6)' }}>{selectedWell.name}</span></span>
                                    : <span>ia Monitoreo</span>
                                }
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                <div style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: '#10b981',
                                    boxShadow: '0 0 8px #10b981',
                                    animation: 'ai-dot-bounce 2s ease-in-out infinite',
                                }} />
                                <span style={{
                                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                                    textTransform: 'uppercase', color: '#10b981',
                                    fontFamily: 'ui-monospace, monospace',
                                }}>
                                    {language === 'es' ? 'Asistente Activo' : 'Active'}
                                    {selectedWell && ` · ESP DESIGN`}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setViewMode(v => v === 'chat' ? 'memory' : 'chat')}
                                className={`p-2 hover:bg-white/10 rounded-xl transition-all group ${viewMode === 'memory' ? 'text-primary' : 'text-txt-muted'}`}
                                title={language === 'es' ? 'Gestionar Memoria IA' : 'Manage AI Memory'}
                            >
                                <Brain className={`w-4 h-4 ${viewMode === 'memory' ? 'text-primary' : 'text-txt-muted group-hover:text-primary'}`} />
                            </button>
                            <button
                                onClick={() => AiMemoryService.exportMemory()}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all group"
                                title={language === 'es' ? 'Exportar Memoria IA (Archivo .json)' : 'Export AI Memory (.json)'}
                            >
                                <Download className="w-4 h-4 text-txt-muted group-hover:text-primary" />
                            </button>
                            <button
                                onClick={() => setShowKeyInput(!showKeyInput)}
                                className={`p-2 hover:bg-white/10 rounded-xl transition-all group ${showKeyInput ? 'text-primary' : 'text-txt-muted'}`}
                                title={language === 'es' ? 'Configurar API Key' : 'Configure API Key'}
                            >
                                <Settings className="w-4 h-4 text-txt-muted group-hover:text-primary" />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-surface-light rounded-xl transition-colors">
                                <X className="w-4 h-4 text-txt-muted" />
                            </button>
                        </div>
                    </div>

                    {selectedWell && <StatusBar well={selectedWell} language={language} />}

                    {/* SETTINGS PANEL OVERLAY */}
                    {showKeyInput && (
                        <div className="p-4 bg-surface-light/40 border-b border-surface-light backdrop-blur-sm animate-fadeIn text-[10px] space-y-2 shrink-0">
                            <label className="block font-black text-txt-muted uppercase tracking-widest">
                                {language === 'es' ? 'CLAVE API OPENROUTER (OPCIONAL)' : 'OPENROUTER API KEY (OPTIONAL)'}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={apiKeyInput}
                                    onChange={(e) => {
                                        setApiKeyInput(e.target.value);
                                        localStorage.setItem('openrouter_api_key', e.target.value);
                                    }}
                                    placeholder="sk-or-v1-..."
                                    className="flex-1 bg-canvas/80 border border-surface-light/80 rounded-xl px-3 py-2 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-semibold"
                                />
                                {apiKeyInput && (
                                    <button
                                        onClick={() => {
                                            setApiKeyInput('');
                                            localStorage.removeItem('openrouter_api_key');
                                        }}
                                        className="px-3 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-xl transition-all text-[9px] font-black uppercase"
                                    >
                                        {language === 'es' ? 'Borrar' : 'Clear'}
                                    </button>
                                )}
                            </div>
                            <p className="text-[9px] text-txt-muted/80 leading-normal">
                                {language === 'es'
                                    ? 'Si no ingresas una clave, se usará la clave gratuita por defecto del servidor.'
                                    : 'If blank, the default free server key will be used.'}
                            </p>
                        </div>
                    )}

                    {viewMode === 'memory' ? (
                        <div className="flex-1 overflow-hidden p-5 bg-canvas/30">
                            <AiMemoryManager language={language} onClose={() => setViewMode('chat')} />
                        </div>
                    ) : (
                        <>
                            {/* MESSAGES */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-canvas/20">
                                {msgs.map((m, i) => (
                                    <MessageBubble 
                                        key={i} 
                                        role={m.role} 
                                        text={m.text} 
                                        isLastModel={i === msgs.length - 1 && m.role === 'model'}
                                        isLoading={loading}
                                    />
                                ))}
                                {loading && msgs[msgs.length - 1]?.role !== 'model' && (
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
                                        <div style={{
                                            flexShrink: 0, width: 28, height: 28, marginTop: 2,
                                            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'rgba(var(--color-primary-rgb,99,179,237),0.12)',
                                            border: '1px solid rgba(var(--color-primary-rgb,99,179,237),0.2)',
                                        }}>
                                            <RefreshCw style={{ width: 13, height: 13, color: 'var(--color-primary,#3b82f6)', animation: 'ai-radar-sweep 1s linear infinite' }} />
                                        </div>
                                        <div style={{
                                            background: 'rgba(15, 17, 23, 0.45)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderLeft: '3px solid var(--color-primary, #3b82f6)',
                                            borderRadius: '4px 18px 18px 18px',
                                            padding: '12px 16px',
                                            backdropFilter: 'blur(8px)',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                        }}>
                                            <ThinkingDots />
                                        </div>
                                    </div>
                                )}
                                <div ref={endRef} />
                            </div>

                            {/* INPUT */}
                            <div className="p-4 shrink-0 bg-black/20 border-t border-white/5">
                                <div className="relative flex items-center">
                                    <input
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && send()}
                                        placeholder={language === 'es' ? 'Escribe o pregunta...' : 'Ask about fleet/wells...'}
                                        className="w-full bg-canvas/60 border border-surface-light/80 rounded-2xl pl-5 pr-14 py-3.5 text-xs sm:text-[13px] text-txt-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all font-semibold placeholder:text-txt-muted/30 backdrop-blur-md"
                                    />
                                    <button
                                        onClick={send}
                                        disabled={!input.trim() || loading}
                                        className="absolute right-2 p-2 bg-gradient-to-r from-primary to-primary/90 text-white rounded-xl shadow-md hover:shadow-primary/25 hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <button onClick={() => setIsOpen(!isOpen)} className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_15px_30px_rgba(0,0,0,0.3)] transition-all duration-500 group border-4 border-canvas overflow-hidden ${isOpen ? 'bg-surface text-primary rotate-90 scale-95' : 'bg-primary text-white hover:scale-105 shadow-[0_0_20px_rgba(var(--color-primary),0.3)]'}`}>
                {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {fleet.filter(w => w.status !== 'normal').length > 0 && !isOpen && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-danger rounded-full border-2 border-canvas shadow-glow-danger animate-pulse"></div>
                )}
            </button>
        </div>
    );
};



// 💅 CSS KEYFRAME ANIMATIONS 💅
const styleSheet = typeof document !== 'undefined' ? document.createElement("style") : null;
if (styleSheet) {
    styleSheet.innerText = `
        @keyframes ai-dot-bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes ai-radar-sweep {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes ai-dot-bounce-glow {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.25); filter: drop-shadow(0 0 6px #10b981); }
        }
    `;
    document.head.appendChild(styleSheet);
}

