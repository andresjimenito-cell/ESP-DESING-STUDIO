import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { SystemParams, EspPump } from '../types';
import { useLanguage } from '../i18n';
import { AiMemoryService } from '../services/AiMemoryService';
import {
    generateMultiCurveData,
    findIntersection,
    calculateSystemResults,
    getShaftLimitHp
} from '../utils';

export interface ChatMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: Date;
    type?: 'analysis' | 'alert' | 'tip';
}

export const useEspCopilot = (params: SystemParams, results: any, activeStep: number, customPump: EspPump | null) => {
    const { language } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const alertCache = useRef<Set<string>>(new Set());

    // Initialize Chat Session with welcome message
    useEffect(() => {
        const welcomeMsg = language === 'es'
            ? "Ingeniería en línea. Mis cálculos están sincronizados con tu curva de rendimiento."
            : "Engineering Online. My calculations are synced with your performance curve.";

        setMessages([{
            id: 'init', role: 'model', text: welcomeMsg, timestamp: new Date(), type: 'tip'
        }]);
    }, [language]);

    // --- CONTEXT EXTRACTOR HELPER ---
    const getContextForPhase = (phaseIdx: number, scenarioScope: 'min' | 'target' | 'max' | 'all' = 'target') => {
        switch (phaseIdx) {
            case 0: // Wellbore
                return {
                    phase: "1: Wellbore",
                    data: { casing: params.wellbore.casing, tubing: params.wellbore.tubing, depths: { pump: params.pressures.pumpDepthMD, td: params.totalDepthMD } }
                };
            case 1: // Fluids
                return {
                    phase: "2: PVT & Fluids",
                    data: { api: params.fluids.apiOil, wc: params.fluids.waterCut, gor: params.fluids.gor, pb: params.fluids.pb }
                };
            case 2: // Inflow
                return {
                    phase: "3: Inflow (IPR)",
                    data: { model: params.inflow.model, pStatic: params.inflow.pStatic, ip: params.inflow.ip, pwf: results?.pwf }
                };
            case 3: // Scenarios
                return { phase: "4: Scenarios", data: params.targets };

            case 4: // Equipment (CRITICAL FIX HERE)
                let equipData: any = {
                    pump: customPump ? `${customPump.manufacturer} ${customPump.model} (${customPump.stages} stg)` : "None",
                    motor: params.selectedMotor ? `${params.selectedMotor.manufacturer} ${params.selectedMotor.hp} HP` : "Generic",
                };

                // --- PRE-CALCULATE CURVE STATUS FOR AI ---
                if (customPump && params.activeScenario) {
                    const currentRate = params.pressures.totalRate;
                    const freq = params.targets[params.activeScenario].frequency;
                    const baseFreq = customPump.nameplateFrequency || 60;
                    const ratio = freq / baseFreq;

                    // Affinity Laws
                    const minRateAtFreq = customPump.minRate * ratio;
                    const maxRateAtFreq = customPump.maxRate * ratio;
                    const bepRateAtFreq = customPump.bepRate * ratio;

                    // Logic Status
                    let status = "OPTIMAL_RANGE";
                    let issue = "None";

                    if (currentRate < minRateAtFreq * 0.95) {
                        status = "CRITICAL_DOWNTHRUST";
                        issue = "Flow is below Minimum Stable Rate. Risk of recirculation.";
                    } else if (currentRate > maxRateAtFreq * 1.05) {
                        status = "CRITICAL_UPTHRUST";
                        issue = "Flow is above Maximum Stable Rate. Risk of cavitation/floating.";
                    } else {
                        // Check proximity to BEP
                        const dev = Math.abs(currentRate - bepRateAtFreq) / bepRateAtFreq;
                        if (dev < 0.05) status = "PERFECT_BEP_MATCH";
                        else status = "IN_OPERATING_RANGE";
                    }

                    equipData.pumpPhysicsStatus = {
                        operatingPoint: `${currentRate.toFixed(0)} BPD @ ${freq} Hz`,
                        validRangeAtFreq: `${minRateAtFreq.toFixed(0)} - ${maxRateAtFreq.toFixed(0)} BPD`,
                        bepAtFreq: `${bepRateAtFreq.toFixed(0)} BPD`,
                        status: status,
                        calculatedIssue: issue,
                        pctOfBep: `${((currentRate / bepRateAtFreq) * 100).toFixed(1)}%`
                    };
                }

                return { phase: "5: Equipment Check", data: equipData };

            case 5: // Simulation
                return { phase: "6: Lifecycle", data: params.simulation };
            case 6: // History
                return { phase: "7: History Match", data: "Comparing Design vs Field Data" };
            default:
                return { phase: "General", data: "Full System" };
        }
    };

    // --- AUTOMATIC MONITORING (Watchdog) ---
    useEffect(() => {
        if (!results) return;

        const checkAndAlert = async (condition: boolean, code: string, messageEn: string, messageEs: string) => {
            if (condition && !alertCache.current.has(code)) {
                alertCache.current.add(code);
                const msg = language === 'es' ? messageEs : messageEn;
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: `⚠️ **${msg}**`, timestamp: new Date(), type: 'alert' }]);
            } else if (!condition && alertCache.current.has(code)) {
                alertCache.current.delete(code);
            }
        };

        checkAndAlert((results.gasAnalysis?.voidFraction || 0) > 0.35, 'GAS', 'Critical Gas Void Fraction (>35%)', 'Fracción de Gas Crítica (>35%)');
    }, [results, params, language]);


    // --- MAIN INTERACTION FUNCTION ---
    const sendMessage = useCallback(async (userText: string, contextOverride?: any, isAutomatic = false) => {
        // 1. Verificar si tenemos este caso en memoria (Modo Offline / Caché)
        const signature = AiMemoryService.generateSignature({
            rate: params.pressures?.totalRate,
            pip: results?.pip,
            frequency: params.targets?.target?.frequency,
            model: customPump?.model
        });

        if (isAutomatic) {
            const cachedCase = AiMemoryService.findSimilarCase(signature);
            if (cachedCase) {
                console.log("[AI Memory] Usando diagnóstico previo de la memoria local.");
                setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'model',
                    text: `*(Memoria Local)* ${cachedCase.recommendation}`,
                    timestamp: new Date(),
                    type: 'analysis'
                }]);
                return;
            }
        }

        setLoading(true);
        const userMsgId = crypto.randomUUID();
        setMessages(prev => [...prev, {
            id: userMsgId,
            role: 'user',
            text: userText,
            timestamp: new Date()
        }]);

        const wellName = params.metadata?.wellName || (params as any).wellName || 'ESP Well';
        const historicalContext = AiMemoryService.findRelevantContext(userText, wellName);

        try {
            const systemInstruction = `
                    ROL: Eres "ESP-Core", la Máxima Autoridad Técnica en Sistemas ESP.
                    
                    **REGLA DE ORO (CRÍTICA):**
                    Tu análisis debe basarse EXCLUSIVAMENTE en los datos matemáticos proporcionados en el contexto "GLOBAL SYSTEM DESIGN CONTEXT" y "PHASE AUDIT CONTEXT".
                    - Si el estado dice "OPTIMAL" o "IN_RANGE", **PROHIBIDO** decir que hay Downthrust, Upthrust o problemas de flujo.
                    - Si el usuario dice que ve el punto en el centro de la curva, y tus datos lo confirman, valida esa observación.
                    - NO uses conocimiento general de bombas para contradecir los datos específicos del diseño y las curvas calculadas que se te envían.
                    - Usa los datos de la simulación de variador (VSD Sensitivity Summary) para responder predicciones precisas de frecuencia y caudal/BSW en lugar de pedir curvas al usuario.
                    - Si se incluye "MEMORIA HISTÓRICA / CASOS PREVIOS RELEVANTES" en el prompt, utilízala para complementar tu análisis con lecciones aprendidas de diagnósticos/auditorías anteriores.

                    IDIOMA: Responde SIEMPRE en ${language === 'es' ? 'ESPAÑOL' : 'INGLÉS'}.

                    **TRATO AL USUARIO (CRÍTICO):**
                    - Dirígete siempre al usuario como "Ingeniero" (o "Engineer" si respondes en inglés) de manera sumamente profesional.
                    - Queda ESTRICTAMENTE PROHIBIDO usar nombres propios como "Andrés", "Andres" o cualquier otro. Bajo ninguna circunstancia uses o reveles nombres propios de personas en tus respuestas.

                    ESTRUCTURA DE RESPUESTA:
                    - Para preguntas generales de auditoría, organiza tu respuesta en:
                      1. **Estado Operativo:** (Basado estrictamente en el % BEP calculado u operando).
                      2. **Análisis Hidráulico:** Presiones, Cabezal y caudales.
                      3. **Recomendación:** Directa y técnica.
                    - Para preguntas directas (por ejemplo: predicciones de cambio de frecuencia, cálculos específicos de BSW, o datos puntuales del sistema), responde de forma directa, técnica y justificada utilizando los datos provistos en el contexto, sin necesidad de seguir la estructura rígida de auditoría si no aplica.
            `.trim();

            const langInstruction = language === 'es'
                ? "[SYSTEM: RESPONDE EN ESPAÑOL. Confía estrictamente en los datos del sistema. Responde de forma directa al usuario si es una consulta específica.] "
                : "[SYSTEM: RESPOND IN ENGLISH. Trust strictly the system data. Respond directly if it is a specific query.] ";

            let currentContext = contextOverride;
            if (!currentContext && activeStep !== undefined) {
                const ctx = getContextForPhase(activeStep, 'target');
                currentContext = ctx.data;
            }

            // Build a comprehensive global system design context
            let vsdSensitivitySummary: any[] = [];
            if (customPump) {
                try {
                    const freqsToSimulate = [30, 40, 50, 60, 70, 80];
                    const currentFreq = params.targets?.[params.activeScenario || 'target']?.frequency || 60;
                    if (currentFreq && !freqsToSimulate.includes(currentFreq)) {
                        freqsToSimulate.push(currentFreq);
                    }
                    freqsToSimulate.sort((a, b) => a - b);

                    vsdSensitivitySummary = freqsToSimulate.map(hz => {
                        const cData = generateMultiCurveData(customPump, params, hz, 60);
                        const m = findIntersection(cData);
                        let flow = m ? m.flow : 0;
                        let head = m ? m.head : 0;
                        if (flow <= 0) {
                            return { frequency_Hz: hz, status: "No intersection / Pump cannot overcome system head" };
                        }
                        const res = calculateSystemResults(flow, head, params, customPump, hz);
                        const shaftLimit = getShaftLimitHp(customPump?.series || '');
                        const bhp = res.hpTotal || 0;
                        const pumpShaftLoad = shaftLimit > 0 ? (bhp / shaftLimit) * 100 : 0;
                        const motorT = (params.bottomholeTemp || 150) + (res.motorLoad || 0) * 0.8;
                        const bopd = flow * (1 - (params.fluids?.waterCut || 0) / 100);
                        const bwpd = flow * ((params.fluids?.waterCut || 0) / 100);

                        return {
                            frequency_Hz: hz,
                            flowRate_BPD: Math.round(flow),
                            bopd: Math.round(bopd),
                            bwpd: Math.round(bwpd),
                            waterCut_BSW_pct: params.fluids?.waterCut,
                            pip_psi: Math.round(res.pip || 0),
                            pdp_psi: Math.round(res.pdp || 0),
                            pwf_psi: Math.round(res.pwf || 0),
                            tdh_ft: Math.round(res.tdh || 0),
                            amps: Number((res.electrical?.amps || 0).toFixed(1)),
                            motorLoad_pct: Math.round(res.motorLoad || 0),
                            pumpShaftLoad_pct: Math.round(pumpShaftLoad),
                            motorTemp_F: Math.round(motorT)
                        };
                    });
                } catch (e) {
                    console.error("Error generating VSD summary for context:", e);
                }
            }

            const globalContext = {
                projectInfo: {
                    projectName: params.metadata?.projectName || 'ESP Project',
                    wellName: params.metadata?.wellName || (params as any).wellName || 'ESP Well',
                    engineer: params.metadata?.engineer || '',
                    company: params.metadata?.company || '',
                    activeStepIndex: activeStep
                },
                wellbore: {
                    casingOD_in: params.wellbore?.casing?.od,
                    casingID_in: params.wellbore?.casing?.id,
                    tubingOD_in: params.wellbore?.tubing?.od,
                    tubingID_in: params.wellbore?.tubing?.id,
                    pumpDepthMD_ft: params.pressures?.pumpDepthMD,
                    totalDepthMD_ft: params.totalDepthMD
                },
                fluidsPVT: {
                    apiOil: params.fluids?.apiOil,
                    waterCut_BSW_pct: params.fluids?.waterCut,
                    gasGravity: params.fluids?.geGas,
                    waterGravity: params.fluids?.geWater,
                    gor_scf_stb: params.fluids?.gor,
                    pb_bubblePoint_psi: params.fluids?.pb,
                    salinity_ppm: params.fluids?.salinity,
                    isDeadOil: params.fluids?.isDeadOil
                },
                inflowIPR: {
                    model: params.inflow?.model,
                    staticPressure_pStatic_psi: params.inflow?.pStatic,
                    productivityIndex_IP_bpd_psi: params.inflow?.ip,
                    calculatedPwf_psi: results?.pwf
                },
                operatingScenarios: {
                    activeScenario: params.activeScenario,
                    min: params.targets?.min,
                    target: params.targets?.target,
                    max: params.targets?.max
                },
                equipmentSelected: {
                    pump: customPump ? {
                        manufacturer: customPump.manufacturer,
                        model: customPump.model,
                        stages: customPump.stages,
                        nameplateFrequency: customPump.nameplateFrequency,
                        stableFlowRange_BPD: `${customPump.minRate} - ${customPump.maxRate} @ ${customPump.nameplateFrequency}Hz`
                    } : "None",
                    motor: params.selectedMotor ? {
                        manufacturer: params.selectedMotor.manufacturer,
                        model: params.selectedMotor.model,
                        hp: params.selectedMotor.hp,
                        voltage: params.selectedMotor.voltage,
                        amps: params.selectedMotor.amps
                    } : "None",
                    cable: params.selectedCable ? {
                        manufacturer: params.selectedCable.manufacturer,
                        model: params.selectedCable.model,
                        type: params.selectedCable.type,
                        awg: params.selectedCable.awg
                    } : "None",
                    vsd: params.selectedVSD ? {
                        manufacturer: params.selectedVSD.manufacturer,
                        model: params.selectedVSD.model,
                        kvaRating: params.selectedVSD.kvaRating
                    } : "None"
                },
                resultsAtCurrentOperatingScenario: results ? {
                    totalFlowRate_BPD: results.flow || params.pressures?.totalRate,
                    intakePressure_PIP_psi: results.pip,
                    dischargePressure_PDP_psi: results.pdp,
                    flowingBHP_Pwf_psi: results.pwf,
                    tdh_ft: results.tdh,
                    fluidVelocityAtIntake_fts: results.fluidVelocity,
                    motorLoad_pct: results.motorLoad,
                    pumpEfficiency_pct: results.effEstimated || results.efficiency,
                    submergence_ft: params.pressures?.pumpDepthMD && results.fluidLevel ? Math.max(0, params.pressures.pumpDepthMD - results.fluidLevel) : results.submergenceFt
                } : null,
                vsdSensitivitySimulationSummary: vsdSensitivitySummary
            };

            let finalPrompt = langInstruction + userText;

            if (currentContext) {
                finalPrompt += `\n\n[PHASE AUDIT CONTEXT]:\n${JSON.stringify(currentContext, null, 2)}`;
            }
            if (globalContext) {
                finalPrompt += `\n\n[GLOBAL SYSTEM DESIGN CONTEXT]:\n${JSON.stringify(globalContext, null, 2)}`;
            }
            if (historicalContext) {
                finalPrompt += `\n\n[MEMORIA HISTÓRICA / CASOS PREVIOS RELEVANTES]:\n${historicalContext}`;
            }

            // Map current messages to OpenRouter history API structure
            const apiMessages = [
                ...messages.map(m => ({
                    role: m.role === 'model' ? 'assistant' : m.role,
                    content: m.text
                })),
                {
                    role: 'user',
                    content: finalPrompt
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
            if (!reader) {
                throw new Error("No reader found on response body");
            }

            const decoder = new TextDecoder();
            let done = false;
            let completeText = "";
            const modelMessageId = crypto.randomUUID();

            setMessages(prev => [...prev, {
                id: modelMessageId,
                role: 'model',
                text: '',
                timestamp: new Date(),
                type: 'analysis'
            }]);

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                completeText += chunk;
                
                setMessages(prev => prev.map(m => 
                    m.id === modelMessageId ? { ...m, text: completeText } : m
                ));
            }

            // 2. Guardar en memoria para el futuro
            if (completeText) {
                AiMemoryService.saveCase({
                    category: 'design',
                    technicalSignature: signature,
                    context: currentContext,
                    recommendation: completeText
                });
            }

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'model',
                text: language === 'es' ? "❌ Error de conexión al servidor de IA." : "❌ IA Server Connection Error.",
                timestamp: new Date(),
                type: 'alert'
            }]);
        } finally {
            setLoading(false);
        }
    }, [language, activeStep, customPump, params, results, messages]); // Added deps to ensure context is fresh

    // Wrapper for the Phase Analysis Button
    const analyzePhase = (phaseIdx: number, scenarioScope: 'min' | 'target' | 'max' | 'all' = 'target') => {
        const ctx = getContextForPhase(phaseIdx, scenarioScope);
        const prompt = language === 'es'
            ? `Realiza una auditoría técnica de la **${ctx.phase}**. Valida si el punto de operación está dentro del rango recomendado según los datos proporcionados.`
            : `Perform a technical audit of **${ctx.phase}**. Validate if the operating point is within the recommended range based on provided data.`;

        sendMessage(prompt, ctx.data);
    };

    const analysis = useMemo(() => {
        const lastAnalysisMsg = [...messages].reverse().find(m => m.type === 'analysis' && m.role === 'model');
        return lastAnalysisMsg ? lastAnalysisMsg.text : undefined;
    }, [messages]);

    return { messages, loading, sendMessage, analyzePhase, analysis };
};
