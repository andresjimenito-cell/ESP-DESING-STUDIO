import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Calendar, TrendingUp, TrendingDown, Activity,
    Play, Pause, ChevronLeft, ChevronRight, Download,
    FileText, Zap, Gauge, Droplets, Target, ShieldCheck,
    History, Clock, Maximize2, Cpu, X
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, LineChart, Line, ComposedChart, Bar
} from 'recharts';
import { SystemParams, EspPump, ProductionTest } from '../types';
import {
    calculateSystemResults, calculateTDH, interpolateTVD,
    calculateFluidProperties, calculateBaseHead
} from '../utils';
import { useLanguage } from '../i18n';

import { Phase6 } from './Phase6';

interface HistoricalRecord extends ProductionTest {
    id: string;
    date: string;
    healthScore: number;
    degradation: number;
    efficiency: number;
    calculatedIP: number;
    actualHead: number;
    frequency: number; // For compatibility with HistoryMatchData
    pd: number;
    fluidLevel: number;
    submergence: number;
    pStatic: number;
    matchDate: string;
    startDate: string;
}

interface Props {
    wellName: string;
    pump: EspPump | null;
    designParams: SystemParams;
    productionHistory?: ProductionTest[];
    onImport?: () => void;
    onClose?: () => void;
}

export const MatchHistorico: React.FC<Props> = ({ wellName, pump, designParams, productionHistory, onImport, onClose }) => {
    const { t } = useLanguage();
    const [history, setHistory] = useState<HistoricalRecord[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const playTimerRef = useRef<NodeJS.Timeout | null>(null);

    const processRecords = (rawTests: any[]) => {
        const processed = rawTests.map((t, idx) => {
            const frequency = t.freq || 60;
            const rate = t.rate || 0;
            const pip = t.pip || 0;

            const survey = designParams.survey || [];
            const pumpDepth = designParams.pressures?.pumpDepthMD || 0;
            const perfsDepth = designParams.wellbore?.midPerfsMD || 0;

            const pumpTVD = survey.length > 0 ? interpolateTVD(pumpDepth, survey) : pumpDepth;
            const perfsTVD = survey.length > 0 ? interpolateTVD(perfsDepth, survey) : perfsDepth;
            const deltaTVD = Math.max(0, perfsTVD - pumpTVD);

            const props = calculateFluidProperties(pip || 10, designParams.bottomholeTemp || 150, designParams);
            const grad = Math.max(0.1, props.gradMix || 0.35);
            const pwf = pip + (deltaTVD * grad);

            // Nodal Synthesis: Ensure calculateTDH sees these exact conditions
            const pStaticForPoint = pwf + Math.max(200, rate / 1.5);
            const ipForPoint = rate / Math.max(1, pStaticForPoint - pwf);

            // Construct specific test params to ensure consistent results
            const testParams = {
                ...designParams,
                inflow: { ...designParams.inflow, ip: ipForPoint, pStatic: pStaticForPoint },
                pressures: { ...designParams.pressures, pht: t.thp || 0, totalRate: rate, pumpDepthMD: pumpDepth },
                wellbore: { ...designParams.wellbore, tubingBottom: pumpDepth, midPerfsMD: perfsDepth },
                fluids: { ...designParams.fluids, waterCut: t.waterCut || 0 }
            };

            // Calculate TDH observed by the system
            const actualHeadValue = calculateTDH(rate, testParams);

            // Calculate theoretical head from pump curve (Fresh state)
            const baseFreq = pump?.nameplateFrequency || 60;
            const ratio = frequency / baseFreq;
            const qBase = rate / Math.max(0.01, ratio);
            const hBase = calculateBaseHead(qBase, pump || {} as any);
            const hTheo = hBase * Math.pow(ratio, 2);

            // Results using test conditions
            const res = calculateSystemResults(rate, actualHeadValue, testParams, pump || {} as any, frequency);

            // Degradation is the loss relative to theoretical
            const degradation = hTheo > 0 ? Math.max(0, ((hTheo - actualHeadValue) / hTheo) * 100) : 0;
            const healthScore = Math.max(10, 100 - (degradation * 1.5));

            return {
                ...t,
                id: `rec-${idx}`,
                healthScore,
                degradation,
                efficiency: res.effEstimated || 0,
                calculatedIP: ipForPoint,
                actualHead: actualHeadValue,
                frequency, // Add this for compatibility with Phase6
                pd: t.pdp || 0,
                fluidLevel: res.fluidLevel || 0,
                submergence: res.submergenceFt || 0,
                pStatic: designParams.inflow?.pStatic || 0,
                matchDate: t.date || new Date().toISOString().split('T')[0],
                startDate: t.date || new Date().toISOString().split('T')[0],
                date: t.date || new Date().toISOString().split('T')[0]
            } as HistoricalRecord;
        });

        processed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setHistory(processed);
        setCurrentIndex(processed.length > 0 ? processed.length - 1 : 0);
    };

    useEffect(() => {
        if (productionHistory && productionHistory.length > 0) {
            processRecords(productionHistory);
        } else if (history.length === 0) {
            const mockHistory: any[] = Array.from({ length: 15 }).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (15 - i) * 15);
                return {
                    date: date.toISOString().split('T')[0],
                    rate: 1200 - (i * 20) + (Math.random() * 50),
                    freq: 60 - (i * 0.2),
                    pip: 400 - (i * 10) + (Math.random() * 20),
                    waterCut: 40 + (i * 1.5),
                    thp: 180 + (Math.random() * 10),
                    tht: 120,
                    hasMatchData: true
                };
            });
            processRecords(mockHistory);
        }
    }, [productionHistory]);

    useEffect(() => {
        if (isPlaying) {
            playTimerRef.current = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= history.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 800); // Improved playback speed
        } else if (playTimerRef.current) {
            clearInterval(playTimerRef.current);
        }
        return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
    }, [isPlaying, history.length]);

    const currentRecord = history[currentIndex] || null;

    const historyTrail = useMemo(() => {
        if (!currentRecord) return [];
        const baseFreq = pump?.nameplateFrequency || 60;

        return history.slice(0, currentIndex + 1).map(h => {
            // Se dibuja el punto fantasma en las coordenadas reales de su propio día.
            // Para que no brinque "más arriba" cuando se convierte en estela, la altura Y (Head)
            // se calcula usando la curva propia de la bomba en la frecuencia exacta de ese día.
            const hFreq = h.frequency || 60;
            const ratio = hFreq / baseFreq;

            const flow = h.rate;

            const qBase = flow / Math.max(0.01, ratio);
            const hBase = calculateBaseHead(qBase, pump || {} as any);
            const purePumpHead = hBase * Math.pow(ratio, 2);

            return {
                flow: flow,
                head: purePumpHead > 0 ? purePumpHead : h.actualHead, // Exactamente igual a actualPumpTDH en Phase6
                color: h.healthScore > 85 ? '#10b981' : h.healthScore > 60 ? '#f59e0b' : '#ef4444',
                label: ''
            };
        });
    }, [history, currentIndex, currentRecord, pump]);

    const dynamicParams = useMemo(() => {
        if (!currentRecord) return designParams;
        return {
            ...designParams,
            historyMatch: currentRecord
        } as SystemParams;
    }, [currentRecord, designParams]);

    const aiAnalysis = useMemo(() => {
        if (history.length < 2) return t('p6.noData');
        const currentBatch = history.slice(0, currentIndex + 1);
        if (currentBatch.length < 2) return "RECOPILANDO PUNTOS PARA ANÁLISIS...";

        const start = currentBatch[0];
        const prev = currentBatch[currentBatch.length - 2];
        const end = currentBatch[currentBatch.length - 1];

        // Long term
        const totalHealthChange = end.healthScore - start.healthScore;
        // Short term
        const deltaHealth = end.healthScore - prev.healthScore;
        const rateChange = ((end.rate - start.rate) / Math.max(1, start.rate)) * 100;
        const ipChange = ((end.calculatedIP - start.calculatedIP) / Math.max(0.1, start.calculatedIP)) * 100;
        const pipChange = end.pip - prev.pip;

        const lines = [];

        // 1. Mechanical State & Health Trend
        if (end.healthScore < 65) {
            lines.push("🔴 ESTADO CRÍTICO: El equipo presenta una degradación severa (" + (100 - end.healthScore).toFixed(1) + "%).");
            lines.push("   - DIAGNÓSTICO: Posible falla inminente por desgaste de etapas o rotura parcial.");
        } else if (deltaHealth < -5) {
            lines.push("🟠 ALERTA DE TENDENCIA: Caída súbita de salud en el último registro (" + deltaHealth.toFixed(1) + "%).");
            lines.push("   - ACCIÓN: Verificar eventos eléctricos o cambios bruscos en frecuencia.");
        } else if (totalHealthChange < -15) {
            lines.push("🟡 DESGASTE PROGRESIVO: Pérdida acumulada del " + Math.abs(totalHealthChange).toFixed(1) + "% desde el inicio.");
            lines.push("   - CONSEJO: Planificar intervención a mediano plazo.");
        } else {
            lines.push("✅ ESTABILIDAD MECÁNICA: La bomba mantiene una salud óptima del " + end.healthScore.toFixed(1) + "%.");
        }

        // 2. Reservoir & Inflow Analysis
        if (ipChange < -20) {
            lines.push("⚠️ DAÑO DE FORMACIÓN: El IP ha caído un " + Math.abs(ipChange).toFixed(0) + "% .");
            lines.push("   - CONSEJO: Evaluar limpieza mecánica o estimulación química.");
        } else if (pipChange > 50 && end.rate < prev.rate * 0.9) {
            lines.push("🔍 POSIBLE OBSTRUCCIÓN: Sube la presión de entrada (PIP) pero cae el caudal.");
            lines.push("   - DIAGNÓSTICO: Restricción en el intake o falla en el manejo de gas.");
        } else if (end.pip < 150) {
            lines.push("🌊 BAJA SUMERGENCIA: PIP crítico detectado (" + end.pip.toFixed(0) + " psi).");
            lines.push("   - ACCIÓN: Reducir Hz para proteger el enfriamiento del motor.");
        }

        // 3. Operating Range Analysis (BEP)
        const bepAtFreq = (pump?.bepRate || 1000) * (end.frequency / (pump?.nameplateFrequency || 60));
        const flowRatio = end.rate / Math.max(1, bepAtFreq);
        if (flowRatio > 1.20) {
            lines.push("🚀 ALTO CAUDAL (UPTHRUST): Operando 20% por encima del BEP teórico.");
            lines.push("   - RIESGO: Desgaste prematuro de arandelas de empuje superior.");
        } else if (flowRatio < 0.65) {
            lines.push("📉 BAJO CAUDAL (DOWNTHRUST): Flujo insuficiente detectado.");
            lines.push("   - RIESGO: Pobre enfriamiento y empuje descendente excesivo.");
        }

        return lines.join("\n");
    }, [history, currentIndex, pump, t]);

    if (!currentRecord) return null;

    return (
        <div className="flex flex-col gap-8 animate-fadeIn pb-20">
            {/* PLAYBACK HEADER */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 shrink-0">
                <div className="glass-surface-light rounded-[2.5rem] border border-white/5 p-8 shadow-2xl relative overflow-hidden bg-gradient-to-r from-canvas to-surface/40">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><History className="w-32 h-32 text-primary" /></div>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-3 glass-surface border border-white/10 rounded-2xl text-txt-muted hover:text-danger hover:scale-110 transition-all z-30 shadow-2xl"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className={`p-4 rounded-3xl bg-gradient-to-br shadow-glow-lg ${currentRecord.healthScore > 85 ? 'from-success/20 shadow-success/10' : 'from-danger/20 shadow-danger/10'}`}>
                                <Activity className={`w-8 h-8 ${currentRecord.healthScore > 85 ? 'text-success' : 'text-danger'}`} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-txt-main tracking-tighter uppercase">{wellName} — HISTORIAL MATCH</h2>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">{currentRecord.date}</span>
                                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-60">REGISTRO {currentIndex + 1} / {history.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {onImport && (
                                <button
                                    onClick={onImport}
                                    className="flex items-center gap-2.5 px-6 py-3.5 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white border border-secondary/20 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-glow-secondary/20 active:scale-95 group"
                                >
                                    <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                                    Cargar Datos Pozo
                                </button>
                            )}

                            <div className="flex items-center gap-4 bg-canvas/40 p-3 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-inner">
                                <button
                                    onClick={() => {
                                        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                                        setIsPlaying(false);
                                    }}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-90"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className={`p-6 rounded-full shadow-2xl transform transition-all active:scale-95 ${isPlaying ? 'bg-danger text-white hover:bg-danger/80' : 'bg-primary text-white hover:bg-primary/80 ring-8 ring-primary/10'}`}
                                >
                                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                                </button>
                                <button
                                    onClick={() => {
                                        if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1);
                                        setIsPlaying(false);
                                    }}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-90"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* TIMELINE */}
                    <div className="mt-10 relative">
                        <div className="h-3 w-full bg-canvas/60 rounded-full border border-white/5 shadow-inner overflow-hidden cursor-pointer group">
                            <input
                                type="range"
                                min="0"
                                max={history.length - 1}
                                value={currentIndex}
                                onChange={(e) => {
                                    setCurrentIndex(parseInt(e.target.value));
                                    setIsPlaying(false);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            />
                            <div
                                className="h-full bg-gradient-to-r from-primary to-primary-light relative z-10 transition-all"
                                style={{ width: `${((currentIndex + 1) / history.length) * 100}%` }}
                            >
                                <div className="absolute right-0 top-0 w-4 h-full bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-[8px] font-bold text-txt-muted opacity-40 uppercase">{history[0]?.date}</span>
                            <span className="text-[8px] font-bold text-txt-muted opacity-40 uppercase">{history[history.length - 1]?.date}</span>
                        </div>
                    </div>
                </div>

                {/* AI ANALYSIS CARD */}
                <div className="glass-surface-light rounded-[2.5rem] border border-primary/20 p-8 shadow-2xl relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent flex flex-col gap-4">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Cpu className="w-24 h-24 text-primary animate-pulse" /></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-2.5 bg-primary/20 rounded-xl text-primary border border-primary/30"><Cpu className="w-5 h-5" /></div>
                        <h3 className="text-sm font-black text-txt-main tracking-widest uppercase">Diagnostic Engine AI</h3>
                    </div>
                    <div className="flex-1 bg-canvas/30 rounded-3xl p-5 border border-white/5 shadow-inner relative z-10 h-[100px] overflow-y-auto custom-scrollbar">
                        <div className="text-[11px] font-bold text-txt-main leading-relaxed space-y-2 whitespace-pre-wrap opacity-90 italic">
                            {aiAnalysis}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 relative z-10 mt-auto">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-glow-success"></div>
                        <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest opacity-50">Análisis basado en tendencia de {currentIndex + 1} puntos</span>
                    </div>
                </div>
            </div>

            {/* INTEGRATED PHASE 6 (MATCH COMPONENT) */}
            <div className="relative group">
                <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                <div className="relative z-10">
                    <Phase6
                        params={dynamicParams}
                        setParams={() => { }} // Non-editable in playback mode
                        pump={pump}
                        designFreq={currentRecord.frequency || designParams.targets?.target?.frequency || 60}
                        trail={historyTrail}
                    />
                </div>
            </div>
        </div>
    );
};
