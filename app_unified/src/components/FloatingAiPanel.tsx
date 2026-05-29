import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, RefreshCw, Download, Settings, Brain, Menu, Plus, Search, Trash2, Compass, MessageSquare } from 'lucide-react';
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
                className={`max-w-[85%] px-5 py-4 rounded-2xl text-[13.5px] leading-relaxed font-medium shadow-lg transition-all duration-300 ${isUser
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

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [memoryList, setMemoryList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const reloadMemoryList = () => {
        setMemoryList(AiMemoryService.getMemory());
    };

    useEffect(() => {
        if (isOpen) {
            reloadMemoryList();
        }
    }, [isOpen]);

    const handleNewChat = () => {
        const greet = selectedWell
            ? (language === 'es' ? `Listo. Analizando **${selectedWell.name}**. ¿Qué revisamos?` : `Ready. Analyzing **${selectedWell.name}**. What's next?`)
            : (language === 'es' ? `Hola. Monitoreando **${fleet.length}** pozos. ¿Cómo puedo ayudarte hoy?` : `Hello. Monitoring **${fleet.length}** wells. How can I help?`);
        setMsgs([{ role: 'model', text: greet }]);
        setInput('');
    };

    const handleSuggestionClick = (promptText: string) => {
        send(promptText);
    };

    const loadMemoryCase = (c: any) => {
        setMsgs([
            {
                role: 'user',
                text: language === 'es'
                    ? `Cargar registro histórico para pozo ${c.wellName || 'General'} (Firma Técnica: ${c.technicalSignature})`
                    : `Load historical record for well ${c.wellName || 'General'} (Technical Signature: ${c.technicalSignature})`
            },
            {
                role: 'model',
                text: c.recommendation
            }
        ]);
    };

    const handleDeleteMemoryItem = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const msg = language === 'es'
            ? '¿Estás seguro de que deseas eliminar este registro de la memoria?'
            : 'Are you sure you want to delete this memory record?';
        if (window.confirm(msg)) {
            await AiMemoryService.deleteCase(id);
            reloadMemoryList();
        }
    };

    const filteredMemory = memoryList.filter(c => {
        const matchesSearch =
            (c.wellName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.recommendation.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.technicalSignature.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const suggestions = selectedWell ? [
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

    // useEffect(() => {
    //     if (!isOpen) return;
    //     const interval = setInterval(() => {
    //         if (Date.now() - lastInteractionRef.current >= 30000) setIsOpen(false);
    //     }, 5000);
    //     return () => clearInterval(interval);
    // }, [isOpen]);

    useEffect(() => {
        const greet = selectedWell
            ? (language === 'es' ? `Listo. Analizando **${selectedWell.name}**. ¿Qué revisamos?` : `Ready. Analyzing **${selectedWell.name}**. What's next?`)
            : (language === 'es' ? `Hola. Monitoreando **${fleet.length}** pozos. ¿Cómo puedo ayudarte hoy?` : `Hello. Monitoring **${fleet.length}** wells. How can I help?`);

        setMsgs([{ role: 'model', text: greet }]);
    }, [selectedWell?.id, language]);

    useEffect(() => { if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, isOpen]);

    const send = async (overrideInput?: string) => {
        const txt = (overrideInput || input).trim();
        if (!txt || loading) return;
        setInput(''); setLoading(true);
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

                // Solid / Sand parameters
                const sandCutVal = wellParams?.fluids?.sandCut || 0;
                const sandDensityVal = wellParams?.fluids?.sandDensity || 2.65;

                contextData = `ANALYSIS FOR SPECIFIC WELL: ${selectedWell.name}
                - General Status: ${selectedWell.status.toUpperCase()} (Health Score: ${healthScore.toFixed(0)}/100, Estado Actual: ${selectedWell.estadoActual || 'N/A'})
                - System/ALS: ${selectedWell.als || 'ESP'}
                - Run Life (Días de Operación/Vida Útil): ${wellParams?.historyMatch?.runLife || wellParams?.runLife || 'No especificado'}
                
                - Measured/Computed Operational Point:
                  * Running Status (Operando): ${isRunning ? 'SÍ (Activo)' : 'NO (Apagado)'}
                  * Frequency (Frecuencia): ${testFreq} Hz
                  * Total Flow Rate (Caudal Total BFPD): ${testRate} BPD
                  * Oil Rate (Caudal Crudo BOPD): ${bopdVal} BOPD
                  * Water Rate (Caudal Agua BWPD): ${bwpdVal} BWPD
                  * Target Flow Rate (Caudal Objetivo): ${selectedWell.targetRate || 0} BPD
                  * Water Cut / BS&W: ${bswVal}%
                  * GOR (Gas Oil Ratio): ${selectedWell.productionTest?.gor || 0} scf/stb
                  * Sand Cut / Solids Volume (Volumen de Arena / Sólidos): ${sandCutVal}%
                  * Specific Gravity of Solids (SG Sólidos): ${sandDensityVal}
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
            Always address the user as "Ingeniero" (or "Engineer" if language is English). It is strictly forbidden to use proper names like "Andrés", "Andres", or any other name. Never assume or output person names.
            Do not request information from the user (such as pump curves, BS&W, frequency, or pressures) if it is already present in the CONTEXT below. Use the CONTEXT data directly to answer and make predictions.
            Aprovecha la "MEMORIA HISTÓRICA / CASOS PREVIOS RELEVANTES" si contiene información del pozo o de la situación técnica consultada.
            
            TECHNICAL DETAILS ON EROSION & SAND HANDLING:
            - If Sand Cut (Solids Volume) > 0%, evaluate the erosion wear risk. High sand concentration causes accelerated stage wear, leading to rapid degradation of head capacity (degradación de cabezal/bomba).
            - Recommend sand mitigation strategies (e.g., sand screens, specialized coating/hardened stages like tungsten carbide, or operation within a safe flow velocity to prevent solids settling or excessive abrasion).
            - When analyzing degradation, consider if solids could be a contributing factor if sand cut is elevated. Use the Specific Gravity of solids (SG Sólidos) and Sand Cut (Volumen de Arena) for wear/erosion assessments.
            
            REAL-WORLD ESP OPERATIONS & ECONOMIC CONSTRAINTS (COLOMBIA):
            - **No Preventive Pulling / No parar el pozo:** En el contexto de la industria de ESP en Colombia, realizar un "pulling" (extracción de la bomba) para "inspección preventiva" o "limpieza" de componentes (como el recubrimiento de carburo de tungsteno) es **inexistente e inviable** debido a los altos costos operativos y la pérdida directa de producción. NUNCA sugieras parar el pozo o hacer pulling para inspección de rutina o mantenimiento preventivo preventivo. El pulling es puramente reactivo (se realiza solo cuando el equipo falla o ya no produce).
            - **Mitigación Operativa In-Situ:** Enfoca tus recomendaciones en ajustes operativos continuos en superficie que no interrumpan la producción, como regulación de frecuencia con el variador (VSD), monitoreo de telemetría (amperaje, vibración, temperatura, PIP/PDP), y manejo de sólidos en superficie.
            - **Límite Económico y Pérdida de Producción:** Sé consciente del impacto económico. Reducir la frecuencia del VSD reduce el caudal total y puede significar pérdidas de producción de crudo. Analiza y compara la pérdida de producción a corto plazo por reducir Hz frente al beneficio de extender la vida útil (RUL) de la bomba para maximizar el valor económico neto para el Ingeniero.
            
            CHEMICAL TREATMENTS & ADVANCED SAND/SOLIDS CONTROL (ASPHALTENES, SCALES, SAND SURE):
            - **Experto en Tratamiento Químico y Sand Control:** Actúa como un experto de primer nivel en tratamientos químicos y procesos de control de sólidos (como resinas consolidantes tipo Sand Sure, empaques de grava, filtros de malla premium o tamices).
            - **Asfaltenos, Parafinas e Incrustaciones (Scales):** Si el Ingeniero menciona problemas de asfaltenos, parafinas o escamas (carbonato/sulfato de calcio/bario), recomienda e integra tratamientos químicos específicos (dispersantes/solventes de asfaltenos de inyección continua por capilar de fondo, batidos químicos de solventes, o inhibidores de incrustación/scale inhibitors por dosificación continua o mediante squeezes de fondo compatibles con la integridad metalúrgica y elastómeros del ESP).
            - **Mitigación Avanzada de Arena (Sand Sure & Fines Migration):** Si se reportan problemas de arena o sólidos finos, recomienda técnicas avanzadas como resinas consolidantes de matriz (ej: Sand Sure), empaques de grava in-situ, filtros de succión o aditivos químicos retenedores de finos en la formación, justificando su funcionamiento para no obstruir el paso del fluido hacia el intake de la bomba.
            - **Recomendaciones para Futuras Corridas (Completamiento y Limpieza):** Cuando el Ingeniero consulte sobre mejoras a largo plazo o para la siguiente corrida (run/completamiento), recomienda:
              1) **Limpiezas de pozo (wellbore cleanout):** Remoción física y lavado de arena depositada en el fondo antes de bajar la nueva completación.
              2) **Herramientas de completamiento con mallas (screens):** Uso de rejillas Wire-Wrapped Screens (WWS) o mallas Premium Mesh.
              3) **Estimación de Tamaño de Malla (Mesh/Slot Sizing):** Recomienda estimar la apertura de malla basada en la distribución de tamaño de partícula (PSD) del yacimiento. Menciona referencias estándar en Colombia para arenas finas (ej: aberturas de rejilla de 12 a 20 gauge o de 150 a 250 micrones según las reglas de Saucier / Coberly basados en D50 de los sólidos).
              4) **Equipos de Fondo Especializados:** Recomienda el uso de bombas tipo **Sand Lift** (diseñadas para manejar altas concentraciones de sólidos), desarenadores de fondo dinámicos/gravedad, desarenadores tipo vórtex o intakes avanzados con separadores de arena integrados.
            
            SCENARIO ANALYSIS & HIGH-QUALITY EXPLANATIONS:
            - **Análisis de Escenarios Obligatorio:** Siempre que sea posible ante una consulta de optimización, cambio de frecuencia o problemas de sólidos, presenta una comparación de escenarios:
              1) **Escenario Status Quo (Sin recomendaciones):** RUL estimado, velocidad, riesgo de falla prematura y costos asociados (intervención de rig y diferimiento).
              2) **Escenario Optimizado (Aplicando recomendaciones):** Nueva vida útil extendida, reducción de velocidad, mitigación y balance económico neto.
              3) **Tabla de Comparación:** Genera una tabla estructurada de forma impecable que compare ambos escenarios side-by-side.
            - **Explicación Clara y Estructurada:** Utiliza formato Markdown profesional, negritas para variables clave, tablas comparativas y listas ordenadas. Explica la física del desgaste (leyes de afinidad, velocidades de erosión) de forma didáctica pero con un rigor de ingeniería de excelencia.
            - **Formateo de Fórmulas y Unidades (SIN LaTeX Complejo):** NUNCA utilices sintaxis compleja de LaTeX o comandos como '\\text{}' o '\\text{...}' para escribir unidades y fórmulas (por ejemplo, evita '79,205 \\text{ STB} \\text{ vs } 446,748 \\text{ STB}'). En su lugar, exprésalo de forma legible en Markdown de texto plano y legible (ej: '79,205 STB vs 446,748 STB', o 'Desgaste = (N2 / N1)^3').
            
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

            await AiMemoryService.saveCase({
                category: 'diagnosis',
                wellName: selectedWell?.name,
                technicalSignature: signature,
                context: selectedWell || { fleetCount: fleet.length },
                recommendation: streamText
            });
            reloadMemoryList();
        } catch (err: any) {
            console.error("IA Monitoreo Send Error:", err);
            setMsgs(p => [...p, { role: 'model', text: `⚠️ Connection error: ${err.message || 'Unknown issue'}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end pointer-events-none">
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
                        width: 'min(95vw, 1100px)',
                        height: 'min(90vh, 880px)',
                        display: 'flex',
                        flexDirection: 'row',
                        overflow: 'hidden',
                        borderRadius: 28,
                        background: 'rgb(var(--color-surface) / 92%)',
                        border: '1px solid rgb(var(--color-primary) / 15%)',
                        boxShadow: '0 32px 64px rgba(0,0,0,0.45), 0 0 0 1px rgb(var(--color-primary) / 5%), inset 0 1px 0 rgb(var(--color-text-main) / 10%)',
                        backdropFilter: 'blur(32px) saturate(150%)',
                    }}
                >
                    {/* SIDEBAR */}
                    <div
                        className={`flex flex-col h-full border-r border-surface-light/40 transition-all duration-300 overflow-hidden shrink-0`}
                        style={{
                            width: isSidebarOpen ? 280 : 68,
                            background: 'rgb(var(--color-canvas) / 60%)',
                            backdropFilter: 'blur(16px)',
                        }}
                    >
                        {isSidebarOpen ? (
                            // EXPANDED SIDEBAR
                            <div className="flex flex-col h-full overflow-hidden p-4">
                                {/* Sidebar Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                                        <span className="text-[12px] font-black uppercase tracking-widest text-txt-main font-mono">
                                            IA Monitoreo
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setIsSidebarOpen(false)}
                                        className="p-1.5 hover:bg-surface-light rounded-lg text-txt-muted hover:text-txt-main transition-colors"
                                    >
                                        <Menu className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* New Conversation Button Removed */}

                                {/* Search Input */}
                                <div className="relative flex items-center bg-canvas/45 border border-surface-light rounded-xl px-3 py-2 mb-4">
                                    <Search className="w-3.5 h-3.5 text-txt-muted mr-2" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar en memoria..."
                                        className="bg-transparent w-full text-[11px] font-bold text-txt-main outline-none placeholder:text-txt-muted/40"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} className="text-txt-muted hover:text-txt-main">
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Scrollable Conversation List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                    <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest block mb-2 px-1">
                                        Recientes / Memoria
                                    </span>
                                    {filteredMemory.length === 0 ? (
                                        <div className="py-8 text-center opacity-30">
                                            <MessageSquare className="w-6 h-6 mx-auto mb-1 text-txt-muted" />
                                            <span className="text-[10px] font-bold block text-txt-muted">Sin registros</span>
                                        </div>
                                    ) : (
                                        filteredMemory.map((c) => {
                                            const dateStr = new Date(c.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                                            return (
                                                <div
                                                    key={c.id}
                                                    onClick={() => loadMemoryCase(c)}
                                                    className="group relative flex flex-col p-2.5 rounded-xl hover:bg-surface-light/45 cursor-pointer border border-transparent hover:border-surface-light transition-all text-[11px] font-bold text-txt-muted hover:text-txt-main"
                                                >
                                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                                        <span className="truncate pr-4 block font-extrabold text-txt-main text-[11.5px]">
                                                            {c.wellName || 'Caso General'}
                                                        </span>
                                                        <span className="text-[8px] opacity-60 font-mono shrink-0">
                                                            {dateStr}
                                                        </span>
                                                    </div>
                                                    <div className="text-[9px] opacity-75 truncate mt-1 text-txt-muted font-semibold">
                                                        {c.technicalSignature}
                                                    </div>
                                                    {/* Quick Delete Button on Hover */}
                                                    <button
                                                        onClick={(e) => handleDeleteMemoryItem(e, c.id)}
                                                        className="absolute right-2 top-2 p-1 hover:bg-danger/25 text-transparent group-hover:text-txt-muted hover:text-danger rounded-md transition-all"
                                                        title="Eliminar caso"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ) : (
                            // COLLAPSED SIDEBAR
                            <div className="flex flex-col h-full items-center p-3 py-4 space-y-4">
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="p-2 hover:bg-surface-light rounded-xl text-txt-muted hover:text-txt-main transition-colors"
                                    title="Expandir menú"
                                >
                                    <Menu className="w-5 h-5" />
                                </button>

                                {/* Collapsed New Conversation Button Removed */}

                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="p-2.5 hover:bg-surface-light rounded-xl text-txt-muted hover:text-txt-main transition-colors"
                                    title="Buscar en memoria"
                                >
                                    <Search className="w-5 h-5" />
                                </button>

                                <div className="flex-1" />

                                {/* Brain/Memory Manager Shortcut */}
                                <button
                                    onClick={() => setViewMode(v => v === 'chat' ? 'memory' : 'chat')}
                                    className="p-2.5 hover:bg-surface-light rounded-xl text-txt-muted hover:text-primary transition-colors"
                                    title="Administrar memoria"
                                >
                                    <Brain className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CENTRAL CHAT AREA */}
                    <div className="flex-1 h-full flex flex-col overflow-hidden bg-transparent">
                        {/* HEADER */}
                        <div className="p-4 border-b border-surface-light flex items-center justify-between bg-gradient-to-r from-primary/5 via-transparent to-transparent backdrop-blur-md shrink-0">
                            <div className="flex items-center gap-3">
                                {!isSidebarOpen && (
                                    <button
                                        onClick={() => setIsSidebarOpen(true)}
                                        className="p-1.5 hover:bg-surface-light rounded-lg text-txt-muted hover:text-txt-main transition-colors"
                                    >
                                        <Menu className="w-4 h-4" />
                                    </button>
                                )}
                                <div>
                                    <div style={{
                                        fontSize: 13, fontWeight: 800, letterSpacing: '0.08em',
                                        textTransform: 'uppercase',
                                        color: 'rgb(var(--color-text-main))',
                                        fontFamily: 'ui-monospace, "Cascadia Code", monospace',
                                    }}>
                                        {selectedWell
                                            ? <span>ia Monitoreo · <span style={{ color: 'rgb(var(--color-primary))' }}>{selectedWell.name}</span></span>
                                            : <span>ia Monitoreo · Flota</span>
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
                                            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                                            textTransform: 'uppercase', color: '#10b981',
                                            fontFamily: 'ui-monospace, monospace',
                                        }}>
                                            {language === 'es' ? 'Asistente Activo' : 'Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Header control buttons */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setViewMode(v => v === 'chat' ? 'memory' : 'chat')}
                                    className={`p-2 hover:bg-surface-light rounded-xl transition-all group ${viewMode === 'memory' ? 'text-primary' : 'text-txt-muted'}`}
                                    title={language === 'es' ? 'Gestionar Memoria IA' : 'Manage AI Memory'}
                                >
                                    <Brain className={`w-4 h-4 ${viewMode === 'memory' ? 'text-primary' : 'text-txt-muted group-hover:text-primary'}`} />
                                </button>
                                <button
                                    onClick={() => AiMemoryService.exportMemory()}
                                    className="p-2 hover:bg-surface-light rounded-xl transition-all group"
                                    title={language === 'es' ? 'Exportar Memoria IA (Archivo .json)' : 'Export AI Memory (.json)'}
                                >
                                    <Download className="w-4 h-4 text-txt-muted group-hover:text-primary" />
                                </button>
                                <button
                                    onClick={() => setShowKeyInput(!showKeyInput)}
                                    className={`p-2 hover:bg-surface-light rounded-xl transition-all group ${showKeyInput ? 'text-primary' : 'text-txt-muted'}`}
                                    title={language === 'es' ? 'Configurar API Key' : 'Configure API Key'}
                                >
                                    <Settings className="w-4 h-4 text-txt-muted group-hover:text-primary" />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-surface-light rounded-xl transition-colors ml-2">
                                    <X className="w-4 h-4 text-txt-muted" />
                                </button>
                            </div>
                        </div>

                        {/* TELEMETRY BAR */}
                        {selectedWell && <StatusBar well={selectedWell} language={language} />}

                        {/* SETTINGS OVERLAY */}
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

                        {/* FEED AND CHAT CONTENT */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-canvas/10 flex flex-col">
                            {msgs.length <= 1 ? (
                                // GEMINI STYLE WELCOME SCREEN
                                <div className="flex-1 flex flex-col justify-center items-center max-w-3xl mx-auto w-full py-8 text-center select-none animate-fadeIn">
                                    <div className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-3xl border border-primary/20">
                                        <Sparkles className="w-12 h-12 text-primary animate-pulse" />
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2" style={{ color: 'rgb(var(--color-primary))' }}>
                                        {language === 'es' ? 'Bienvenido, Ingeniero' : 'Welcome, Engineer'}
                                    </h1>
                                    <p className="text-txt-muted text-[13px] font-semibold max-w-md mb-8 leading-relaxed">
                                        {language === 'es'
                                            ? 'Analiza el comportamiento hidráulico, eléctrico y de simulación VSD de los pozos en tiempo real.'
                                            : 'Analyze hydraulic, electrical, and VSD simulation telemetry in real-time.'}
                                    </p>

                                    {/* Suggestions Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl px-4 mt-2">
                                        {suggestions.map((s, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => handleSuggestionClick(s.prompt)}
                                                className="p-4 rounded-2xl bg-surface-light/20 border border-surface-light/35 hover:border-primary/30 hover:bg-primary/5 cursor-pointer text-left transition-all duration-300 group hover:-translate-y-0.5"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 group-hover:scale-110 transition-transform">
                                                        <Compass className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[12.5px] font-bold text-txt-main mb-1 group-hover:text-primary transition-colors">
                                                            {language === 'es' ? s.es : s.en}
                                                        </h4>
                                                        <p className="text-[10px] text-txt-muted leading-relaxed truncate max-w-[260px] font-medium">
                                                            {s.prompt}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                // CONVERSATION MESSAGES
                                <div className="max-w-3xl mx-auto w-full space-y-5 flex-1 pb-4">
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
                                        <div className="flex gap-3 justify-start">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner mt-1">
                                                <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                                            </div>
                                            <div className="bg-surface/40 border border-surface-light/80 rounded-2xl rounded-tl-none px-5 py-4 backdrop-blur-md shadow-lg">
                                                <ThinkingDots />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={endRef} />
                                </div>
                            )}
                        </div>

                        {/* INPUT AREA */}
                        <div className="p-4 shrink-0 bg-surface/30 border-t border-surface-light/40 flex flex-col items-center">
                            <div className="w-full max-w-3xl relative flex items-center">
                                {/* Plus / Clear context button on Left */}
                                <button
                                    onClick={handleNewChat}
                                    className="absolute left-4 p-2 text-txt-muted hover:text-txt-main hover:bg-surface-light rounded-xl transition-all"
                                    title="Nueva conversación"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>

                                {/* Input field */}
                                <input
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && send()}
                                    placeholder={language === 'es' ? 'Pregunta a Gemini...' : 'Ask about fleet/wells...'}
                                    className="w-full bg-canvas/70 border border-surface-light rounded-[24px] pl-14 pr-24 py-4 text-sm text-txt-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all font-semibold placeholder:text-txt-muted/40 backdrop-blur-xl shadow-inner"
                                />

                                {/* Model Badge & Send button on Right */}
                                <div className="absolute right-3 flex items-center gap-2">
                                    <span className="text-[9px] font-black tracking-widest text-primary/80 uppercase font-mono px-2 py-1 bg-primary/10 rounded-md border border-primary/20 select-none">
                                        ESP COPILOT
                                    </span>
                                    <button
                                        onClick={() => send()}
                                        disabled={!input.trim() || loading}
                                        className="p-2 bg-gradient-to-r from-primary to-primary/90 text-canvas rounded-xl shadow-md hover:shadow-primary/25 hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Disclaimer Text */}
                            <span className="text-[9.5px] text-txt-muted/70 font-semibold mt-2 text-center block max-w-md leading-normal select-none">
                                {language === 'es'
                                    ? 'La IA Monitoreo puede cometer errores. Considera verificar la información importante.'
                                    : 'AI Monitoreo can make errors. Verify critical parameters.'}
                            </span>
                        </div>
                    </div>

                    {/* MEMORY MANAGER MODAL */}
                    {viewMode === 'memory' && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm animate-fadeIn pointer-events-auto">
                            <div 
                                style={{
                                    width: 'min(90vw, 750px)',
                                    height: 'min(85vh, 680px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: 24,
                                    border: '1.5px solid rgb(var(--color-surface-light))',
                                    background: 'rgb(var(--color-surface))',
                                    boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
                                    overflow: 'hidden',
                                    padding: 24
                                }}
                            >
                                <AiMemoryManager 
                                    language={language} 
                                    onClose={() => {
                                        setViewMode('chat');
                                        reloadMemoryList();
                                    }} 
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <button onClick={() => setIsOpen(!isOpen)} className={`pointer-events-auto relative flex items-center justify-center w-[72px] h-[72px] shadow-[0_15px_40px_rgba(0,0,0,0.6)] transition-all duration-500 group border-[1.5px] overflow-hidden ${isOpen ? 'bg-surface-raised text-primary rotate-90 scale-95 rounded-full border-surface-light/40' : 'rounded-[24px] border-white/20 hover:scale-110 hover:-translate-y-1'}`}
                style={!isOpen ? {
                    background: 'rgb(var(--color-primary))',
                    boxShadow: '0 15px 40px rgba(0,0,0,0.6), 0 0 20px rgb(var(--color-primary) / 0.4)',
                } : undefined}
            >
                {isOpen ? <X className="w-7 h-7" /> : (
                    <div className="relative flex items-center justify-center w-full h-full">
                        <Brain className="w-8 h-8 absolute text-white group-hover:scale-110 transition-transform duration-500 group-hover:rotate-[5deg]" />
                        <Sparkles className="w-4 h-4 absolute top-3 right-3 text-white/70 animate-pulse drop-shadow-md" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/30 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                    </div>
                )}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[24px]" />
                {fleet.filter(w => w.status !== 'normal').length > 0 && !isOpen && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full border-2 border-canvas shadow-glow-danger animate-pulse flex items-center justify-center">
                        <span className="text-[9px] font-black text-white">{fleet.filter(w => w.status !== 'normal').length}</span>
                    </div>
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

