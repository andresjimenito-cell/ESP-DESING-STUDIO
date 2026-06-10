import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Calendar, TrendingUp, TrendingDown, Activity,
    Play, Pause, ChevronLeft, ChevronRight, Download,
    FileText, Zap, Gauge, Droplets, Target, ShieldCheck,
    History, Clock, Maximize2, Cpu, X
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, LineChart, Line, ComposedChart, Bar, ReferenceLine,
    ScatterChart, Scatter
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
            const actualIPVal = rate / Math.max(1, (designParams.inflow?.pStatic || 3000) - pwf);

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
                calculatedIP: actualIPVal,
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

        const parseToTimestamp = (val: any): number => {
            if (!val) return 0;
            if (typeof val === 'number') return val > 100000 ? val : new Date((val - 25569) * 86400 * 1000).getTime();
            if (typeof val !== 'string') return 0;

            const dateStr = val.trim();
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts[0].length === 4) return new Date(dateStr).getTime() || 0;
                if (parts[2] && parts[2].substring(0, 4).length === 4) {
                    const d = parseInt(parts[0]);
                    const m = parseInt(parts[1]) - 1;
                    const y = parseInt(parts[2].substring(0, 4));
                    return new Date(y, m, d).getTime() || 0;
                }
            }
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts[2] && parts[2].substring(0, 4).length === 4) {
                    const d = parseInt(parts[0]);
                    const m = parseInt(parts[1]) - 1;
                    const y = parseInt(parts[2].substring(0, 4));
                    return new Date(y, m, d).getTime() || 0;
                }
                if (parts[0].length === 4) {
                    const y = parseInt(parts[0]);
                    const m = parseInt(parts[1]) - 1;
                    const d = parseInt(parts[2]);
                    return new Date(y, m, d).getTime() || 0;
                }
            }
            const parsed = new Date(dateStr).getTime();
            return isNaN(parsed) ? 0 : parsed;
        };

        processed.sort((a, b) => parseToTimestamp(a.date) - parseToTimestamp(b.date));
        setHistory(processed);
        setCurrentIndex(0);
    };

    useEffect(() => {
        if (productionHistory && productionHistory.length > 0) {
            processRecords(productionHistory);
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
            const hFreq = h.frequency || 60;
            const ratio = hFreq / baseFreq;

            const flow = h.rate;

            const qBase = flow / Math.max(0.01, ratio);
            const hBase = calculateBaseHead(qBase, pump || {} as any);
            const purePumpHead = hBase * Math.pow(ratio, 2);

            return {
                flow: flow,
                head: purePumpHead > 0 ? purePumpHead : h.actualHead,
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
        const currentBatch = history.slice(currentIndex, history.length);
        if (currentBatch.length < 1) return "RECOPILANDO PUNTOS PARA ANÁLISIS...";

        let minIP = Infinity, maxIP = -Infinity;
        let minFreq = Infinity, maxFreq = -Infinity;
        let minRate = Infinity, maxRate = -Infinity;
        let minBSW = Infinity, maxBSW = -Infinity;
        let sumHealth = 0;

        currentBatch.forEach(h => {
            const ip = h.calculatedIP || 0;
            const freq = h.frequency || 0;
            const r = h.rate || 0;
            const bsw = h.waterCut || 0;

            if (ip < minIP) minIP = ip;
            if (ip > maxIP) maxIP = ip;

            if (freq < minFreq) minFreq = freq;
            if (freq > maxFreq) maxFreq = freq;

            if (r < minRate) minRate = r;
            if (r > maxRate) maxRate = r;

            if (bsw < minBSW) minBSW = bsw;
            if (bsw > maxBSW) maxBSW = bsw;

            sumHealth += (h.healthScore || 0);
        });

        const avgHealth = sumHealth / currentBatch.length;

        // Oldest and newest records in the current batch of the regression
        const oldest = currentBatch[currentBatch.length - 1];
        const newest = currentBatch[0];

        // Trends
        const freqDelta = newest.frequency - oldest.frequency;
        const rateDelta = newest.rate - oldest.rate;
        const bswDelta = (newest.waterCut || 0) - (oldest.waterCut || 0);

        const lines: string[] = [];

        // Header Summary
        lines.push(`📊 ANÁLISIS GLOBAL IA (${currentBatch.length} PUNTOS ANALIZADOS EN REGRESIÓN)`);

        // 1. IP Summary
        lines.push(`• ÍNDICE DE PRODUCTIVIDAD (IP): Varía en un rango entre ${minIP.toFixed(2)} y ${maxIP.toFixed(2)} STB/d/psi.`);

        // 2. Frequency
        let freqText = `• FRECUENCIA (Hz): Se ha mantenido estable entre ${minFreq.toFixed(1)} y ${maxFreq.toFixed(1)} Hz.`;
        if (freqDelta > 0.5) {
            freqText = `• FRECUENCIA (Hz): Ha aumentado un total de +${freqDelta.toFixed(1)} Hz a lo largo del tiempo (Rango: ${minFreq.toFixed(1)} - ${maxFreq.toFixed(1)} Hz).`;
        } else if (freqDelta < -0.5) {
            freqText = `• FRECUENCIA (Hz): Ha disminuido un total de ${freqDelta.toFixed(1)} Hz a lo largo del tiempo (Rango: ${minFreq.toFixed(1)} - ${maxFreq.toFixed(1)} Hz).`;
        }
        lines.push(freqText);

        // 3. Production Rate
        let rateText = `• PRODUCCIÓN (BFPD): Se encuentra entre ${minRate.toFixed(0)} y ${maxRate.toFixed(0)} BFPD.`;
        if (rateDelta > 10) {
            rateText = `• PRODUCCIÓN (BFPD): Ha incrementado en +${rateDelta.toFixed(0)} BFPD (Rango: ${minRate.toFixed(0)} - ${maxRate.toFixed(0)} BFPD).`;
        } else if (rateDelta < -10) {
            rateText = `• PRODUCCIÓN (BFPD): Ha caído en ${rateDelta.toFixed(0)} BFPD (Rango: ${minRate.toFixed(0)} - ${maxRate.toFixed(0)} BFPD).`;
        }
        lines.push(rateText);

        // 4. BSW
        let bswText = `• CORTE DE AGUA (BSW): Oscila en un rango del ${minBSW.toFixed(1)}% al ${maxBSW.toFixed(1)}%.`;
        if (bswDelta > 1) {
            bswText = `• CORTE DE AGUA (BSW): Ha aumentado un +${bswDelta.toFixed(1)}% a lo largo del tiempo (Rango: ${minBSW.toFixed(1)}% - ${maxBSW.toFixed(1)}%).`;
        } else if (bswDelta < -1) {
            bswText = `• CORTE DE AGUA (BSW): Ha bajado un ${bswDelta.toFixed(1)}% a lo largo del tiempo (Rango: ${minBSW.toFixed(1)}% - ${maxBSW.toFixed(1)}%).`;
        }
        lines.push(bswText);

        // 5. Overall evaluation
        lines.push("\n🔍 EVALUACIÓN GENERAL DE DESEMPEÑO:");
        if (avgHealth > 85) {
            lines.push("🟢 LA BOMBA HA TENIDO UN EXCELENTE DESEMPEÑO: Mantiene una salud promedio óptima del " + avgHealth.toFixed(1) + "%, operando dentro de los límites seguros y sin signos de degradación severa.");
        } else if (avgHealth >= 65) {
            lines.push("🟡 DESEMPEÑO REGULAR: Se detecta una salud promedio moderada del " + avgHealth.toFixed(1) + "%. Se evidencia un desgaste progresivo típico que requiere monitoreo continuo.");
        } else {
            lines.push("🔴 DESEMPEÑO DEFICIENTE O CRÍTICO: La bomba está operando con una salud promedio baja del " + avgHealth.toFixed(1) + "%. Presenta indicios de desgaste severo y posible degradación mecánica acelerada.");
        }

        return lines.join("\n");
    }, [history, currentIndex, pump, t]);

    if (history.length === 0) {
        return (
            <div className="flex flex-col gap-6 animate-fadeIn pb-20 items-center justify-center min-h-[400px] glass-surface-light rounded-[2.5rem] border border-white/5 p-12 text-center relative">
                <div className="p-6 rounded-full bg-primary/10 border border-primary/20 text-primary animate-pulse mb-4">
                    <History className="w-12 h-12" />
                </div>
                <h3 className="text-xl font-black text-txt-main tracking-tight uppercase">Sin Histórico de Pruebas</h3>
                <p className="text-sm text-txt-muted max-w-md">No hay datos históricos disponibles para este pozo. Por favor, suba el archivo SCADA con las pruebas de producción.</p>
                {onImport && (
                    <button
                        onClick={onImport}
                        className="mt-6 flex items-center gap-2.5 px-6 py-3.5 bg-secondary hover:bg-secondary/80 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-glow-secondary/20 active:scale-95 group shadow-2xl"
                    >
                        <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                        Cargar Datos Pozo
                    </button>
                )}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-3 glass-surface border border-white/10 rounded-2xl text-txt-muted hover:text-danger hover:scale-110 transition-all z-30 shadow-2xl"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
        );
    }

    if (!currentRecord) return null;

    return (
        <div className="flex flex-col gap-4 animate-fadeIn pb-20">
            {/* PLAYBACK HEADER */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 shrink-0">
                <div className="bg-surface border border-white/10 rounded-2xl p-2 px-3 shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[64px]">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><History className="w-10 h-10 text-primary" /></div>

                    <div className="flex flex-row justify-between items-center gap-2 relative z-10 w-full">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-xl bg-gradient-to-br shadow-glow-sm ${currentRecord.healthScore > 85 ? 'from-success/20 shadow-success/10' : 'from-danger/20 shadow-danger/10'}`}>
                                <Activity className={`w-3.5 h-3.5 ${currentRecord.healthScore > 85 ? 'text-success' : 'text-danger'}`} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-txt-main tracking-tighter uppercase leading-none">{wellName}</h2>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[7px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">{currentRecord.date}</span>
                                    <span className="text-[7px] font-black text-txt-muted uppercase tracking-widest opacity-60">REGISTRO {currentIndex + 1} / {history.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* PLAYBACK CONTROLS IN THE SAME ROW */}
                        <div className="flex items-center gap-1.5 bg-canvas/40 p-0.5 rounded-lg border backdrop-blur-xl shadow-inner transition-all border-white/10">
                            <button
                                onClick={() => {
                                    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                                    setIsPlaying(false);
                                }}
                                className="p-1 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-all active:scale-90 text-txt-main hover:text-[rgb(var(--color-secondary))]"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => {
                                    if (currentIndex >= history.length - 1) {
                                        setCurrentIndex(0);
                                    }
                                    setIsPlaying(!isPlaying);
                                }}
                                className="p-1.5 rounded-md shadow-md transform transition-all hover:scale-105 active:scale-95 text-white"
                                style={{ background: isPlaying ? 'rgb(var(--color-danger))' : 'linear-gradient(135deg, rgb(var(--color-secondary)), rgb(var(--color-secondary) / 0.75))' }}
                            >
                                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5 animate-pulse" />}
                            </button>
                            <button
                                onClick={() => {
                                    if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1);
                                    setIsPlaying(false);
                                }}
                                className="p-1 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-all active:scale-90 text-txt-main hover:text-[rgb(var(--color-secondary))]"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* IMPORT/CLOSE BUTTONS IN THE SAME ROW */}
                        <div className="flex items-center gap-2">
                            {onImport && (
                                <button
                                    onClick={onImport}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white border border-secondary/20 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all"
                                >
                                    <Download className="w-3 h-3" />
                                    Cargar
                                </button>
                            )}
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-txt-muted hover:text-danger transition-all shadow-2xl"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* TIMELINE */}
                    <div className="mt-1.5 relative">
                        <div className="h-1 w-full bg-canvas/80 rounded-full border border-white/10 shadow-inner overflow-hidden cursor-pointer group relative">
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
                                className="h-full relative z-10 transition-all duration-200"
                                style={{
                                    width: `${((currentIndex + 1) / history.length) * 100}%`,
                                    background: 'linear-gradient(90deg, rgb(var(--color-secondary)) 0%, rgb(var(--color-secondary) / 0.5) 100%)'
                                }}
                            >
                                <div className="absolute right-0 top-0 w-1 h-full bg-white shadow-[0_0_10px_2px_#ffffff] animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI ANALYSIS CARD */}
                <div className="bg-surface border border-white/10 rounded-2xl p-2 px-3 shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[64px]">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Cpu className="w-10 h-10 text-primary" /></div>
                    <div className="flex flex-row justify-between items-center gap-2 relative z-10">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 bg-primary/20 rounded-md text-primary border border-primary/30"><Cpu className="w-3 h-3" /></div>
                            <h3 className="text-[10px] font-black text-txt-main tracking-widest uppercase leading-none">Diagnostic Engine AI</h3>
                        </div>
                        <div className="flex items-center gap-1 relative z-10">
                            <div className="w-1 h-1 rounded-full bg-success animate-pulse shadow-glow-success"></div>
                            <span className="text-[7px] font-black text-txt-muted uppercase tracking-widest opacity-50">Trend analysis ({currentIndex + 1} pts)</span>
                        </div>
                    </div>
                    <div className="bg-canvas/30 rounded-lg p-1 border border-white/5 shadow-inner relative z-10 h-[36px] overflow-y-auto custom-scrollbar mt-1">
                        <div className="text-[9px] font-bold text-txt-main leading-tight space-y-0.5 whitespace-pre-wrap opacity-90 italic">
                            {aiAnalysis}
                        </div>
                    </div>
                </div>
            </div>

            {/* DUAL CHARTS CONTAINER */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* HISTORICAL FLOW RATE & PRODUCTIVITY INDEX DUAL-AXIS CHART */}
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl relative flex flex-col gap-2 relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h3 className="text-xs font-black text-txt-main tracking-widest uppercase flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" /> Tendencia Histórica: Caudal, IP y BSW
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <span className="text-[9px] font-mono text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-lg border border-secondary/20">
                                Caudal: {currentRecord.rate.toFixed(0)} BFPD
                            </span>
                            <span className="text-[9px] font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                                IP: {currentRecord.calculatedIP.toFixed(2)} STB/d/psi
                            </span>
                            <span className="text-[9px] font-mono text-warning font-bold bg-warning/10 px-2 py-0.5 rounded-lg border border-warning/20">
                                BSW: {(currentRecord.waterCut || 0).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    <div className="h-[220px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={history} margin={{ top: 10, right: -10, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorIP" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-text-muted))" strokeOpacity={0.1} />
                                <XAxis dataKey="date" tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 8 }} stroke="rgb(var(--color-text-muted))" strokeOpacity={0.2} />
                                <YAxis yAxisId="left" orientation="left" tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 8 }} stroke="rgb(var(--color-text-muted))" strokeOpacity={0.2} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 8 }} stroke="rgb(var(--color-text-muted))" strokeOpacity={0.2} />
                                <YAxis yAxisId="right-bsw" orientation="right" hide={true} domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    labelStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                    itemStyle={{ fontSize: '10px' }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }} />
                                <Area yAxisId="left" type="monotone" dataKey="rate" name="Caudal (BFPD)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
                                <Area yAxisId="right" type="monotone" dataKey="calculatedIP" name="IP (STB/d/psi)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIP)" />
                                <Line yAxisId="right-bsw" type="monotone" dataKey="waterCut" name="BSW (%)" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                <ReferenceLine x={currentRecord.date} yAxisId="left" stroke="rgb(var(--color-text-muted))" strokeOpacity={0.4} strokeDasharray="3 3" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* SCATTER CHART: Caudal vs IP */}
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl relative flex flex-col gap-2 relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h3 className="text-xs font-black text-txt-main tracking-widest uppercase flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" /> Relación Caudal vs IP (Histórico)
                        </h3>
                        <div className="flex gap-2">
                            <span className="text-[9px] font-mono text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-lg border border-secondary/20">
                                IP Act: {currentRecord.calculatedIP.toFixed(2)}
                            </span>
                            <span className="text-[9px] font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                                Q Act: {currentRecord.rate.toFixed(0)}
                            </span>
                        </div>
                    </div>
                    <div className="h-[220px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-text-muted))" strokeOpacity={0.1} />
                                <XAxis 
                                    type="number" 
                                    dataKey="calculatedIP" 
                                    name="IP" 
                                    unit=" STB/d/psi" 
                                    stroke="rgb(var(--color-text-muted))" 
                                    strokeOpacity={0.2} 
                                    tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 8 }}
                                />
                                <YAxis 
                                    type="number" 
                                    dataKey="rate" 
                                    name="Caudal" 
                                    unit=" BFPD" 
                                    stroke="rgb(var(--color-text-muted))" 
                                    strokeOpacity={0.2} 
                                    tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 8 }}
                                />
                                <Tooltip 
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    labelStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                    itemStyle={{ fontSize: '10px' }}
                                />
                                <Scatter name="Historial" data={history} fill="rgb(var(--color-primary))" fillOpacity={0.4} />
                                <Scatter name="Punto Actual" data={[currentRecord]} fill="rgb(var(--color-secondary))" shape="circle" r={8} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* INTEGRATED PHASE 6 (MATCH COMPONENT) */}
            <div className="relative group">
                <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                <div className="relative z-10">
                    <Phase6
                        params={dynamicParams}
                        syncParams={false}
                        pump={pump}
                        designFreq={currentRecord.frequency || designParams.targets?.target?.frequency || 60}
                        trail={historyTrail}
                    />
                </div>
            </div>
        </div>
    );
};
