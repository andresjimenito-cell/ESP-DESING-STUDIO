
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SystemParams, EspPump } from '../types';
import { useLanguage } from '../i18n';

// Initialize Gemini Client
// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");

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

    // Persistent Chat Session (Memory)
    // Persistent Chat Session (Memory)
    const chatSession = useRef<any>(null);
    const alertCache = useRef<Set<string>>(new Set());

    // Initialize Chat Session
    useEffect(() => {
        if (!chatSession.current && process.env.API_KEY && process.env.API_KEY !== "PLACEHOLDER_API_KEY") {
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-pro',
                systemInstruction: `
                    ROL: Eres "ESP-Core", la Máxima Autoridad Técnica en Sistemas ESP.
                    
                    **REGLA DE ORO (CRÍTICA):**
                    Tu análisis debe basarse EXCLUSIVAMENTE en los datos matemáticos proporcionados en el contexto "pumpPhysicsStatus".
                    - Si el estado dice "OPTIMAL" o "IN_RANGE", **PROHIBIDO** decir que hay Downthrust, Upthrust o problemas de flujo.
                    - Si el usuario dice que ve el punto en el centro de la curva, y tus datos lo confirman, valida esa observación.
                    - NO uses conocimiento general de bombas para contradecir los datos específicos de la curva calculada que se te envían.

                    IDIOMA: Responde SIEMPRE en ${language === 'es' ? 'ESPAÑOL' : 'INGLÉS'}.

                    ESTRUCTURA DE RESPUESTA:
                    1. **Estado Operativo:** (Basado estrictamente en el % BEP calculado).
                    2. **Análisis Hidráulico:** Presiones y Cabezal.
                    3. **Recomendación:** Directa y técnica.
                `,
            });
            chatSession.current = model.startChat({
                history: [],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 4096,
                },
            });

            const welcomeMsg = language === 'es'
                ? "Ingeniería en línea. Mis cálculos están sincronizados con tu curva de rendimiento."
                : "Engineering Online. My calculations are synced with your performance curve.";

            setMessages([{
                id: 'init', role: 'model', text: welcomeMsg, timestamp: new Date(), type: 'tip'
            }]);
        }
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

                    if (currentRate < minRateAtFreq) {
                        status = "CRITICAL_DOWNTHRUST";
                        issue = "Flow is below Minimum Stable Rate. Risk of recirculation.";
                    } else if (currentRate > maxRateAtFreq) {
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
        if (!results || !chatSession.current) return;

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
    const sendMessage = useCallback(async (userText: string, contextOverride?: any) => {
        if (!chatSession.current) return;

        setLoading(true);
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'user',
            text: userText,
            timestamp: new Date()
        }]);

        try {
            const langInstruction = language === 'es'
                ? "[SYSTEM: RESPONDE EN ESPAÑOL. Confía estrictamente en 'pumpPhysicsStatus'. Si dice IN_RANGE, el diseño es correcto.] "
                : "[SYSTEM: RESPOND IN ENGLISH. Strictly trust 'pumpPhysicsStatus'.] ";

            // Always inject the CURRENT phase context if not explicitly provided
            // This ensures Gemini always knows the current pump status even if the user just asks "Is this okay?"
            let currentContext = contextOverride;
            if (!currentContext && activeStep === 4) {
                const ctx = getContextForPhase(4, 'target');
                currentContext = ctx.data;
            }

            let finalPrompt = langInstruction + userText;

            if (currentContext) {
                finalPrompt += `\n\n[LIVE SYSTEM DATA]:\n${JSON.stringify(currentContext, null, 2)}`;
            }

            const result = await chatSession.current.sendMessage(finalPrompt);
            const response = await result.response;
            const text = response.text();

            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'model',
                text: text || "...",
                timestamp: new Date(),
                type: 'analysis'
            }]);

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'model',
                text: "❌ Error de conexión.",
                timestamp: new Date(),
                type: 'alert'
            }]);
        } finally {
            setLoading(false);
        }
    }, [language, activeStep, customPump, params, results]); // Added deps to ensure context is fresh

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
