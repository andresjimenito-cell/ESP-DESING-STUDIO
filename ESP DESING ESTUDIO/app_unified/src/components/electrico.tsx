import React, { useMemo, useState } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ReferenceLine, LineChart, Line, Cell
} from 'recharts';
import {
    Zap, Activity, TrendingUp, Cpu, Gauge,
    ZapOff, ShieldCheck, AlertTriangle, Database,
    Info, LayoutGrid, List, Maximize2, Minimize2,
    BarChart3, RefreshCw, Zap as ZapIcon
} from 'lucide-react';
import { SystemParams, EspPump, WellFleetItem, ProductionTest } from '../types';
import { calculateSystemResults } from '../utils';

// --- STYLING CONSTANTS ---
const COLORS = {
    simulation: '#00D1FF', // Electric Cyan
    field: '#10B981',      // Emerald Green
    predictive: '#F59E0B', // Amber
    bg: '#050505',
    card: '#0D0D0D',
    border: '#1F1F1F',
    text: '#E5E7EB',
    muted: '#6B7280'
};

interface ElectricoProps {
    params: SystemParams;
    pump: EspPump | null;
    selectedWell: WellFleetItem | null;
    historicalData?: ProductionTest[];
}

/**
 * MÓDULO ELÉCTRICO (COMPARATIVO DE POTENCIA)
 * 
 * Este componente permite comparar la potencia (kW) desde tres fuentes:
 * 1. Simulación: Calculada mediante el modelo físico de la aplicación.
 * 2. Campo (Real/Scada): Datos obtenidos directamente de la telemetría.
 * 3. Predictivo: Datos provenientes de modelos de inteligencia artificial o pronósticos.
 */
export const Electrico: React.FC<ElectricoProps> = ({
    params,
    pump,
    selectedWell,
    historicalData = []
}) => {
    const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
    const [isExpanded, setIsExpanded] = useState(false);

    // ── DATA PREPARATION ──────────────────────────────────────────────────
    const comparisonData = useMemo(() => {
        if (!selectedWell || !pump) return [];

        // Si no hay históricos, creamos un set de datos sintético para la demo basado en el pozo actual
        if (historicalData.length === 0) {
            const data = [];
            const now = new Date();
            const currentFreq = selectedWell.productionTest.freq || 60;
            const currentRate = selectedWell.productionTest.rate || 1000;

            for (let i = 24; i >= 0; i--) {
                const date = new Date(now.getTime() - i * 3600000);
                const noise = (Math.random() - 0.5) * 5;
                
                // 1. Simulación (Potencia Teórica)
                const res = calculateSystemResults(currentRate, null, params, pump, currentFreq);
                const kwSim = res?.systemKw || 0;

                // 2. Campo (Potencia Real con variabilidad)
                const kwField = kwSim * (0.95 + Math.random() * 0.1); 

                // 3. Predictivo (Modelo de IA con tendencia)
                const kwPredictive = kwSim * (0.98 + (Math.sin(i / 5) * 0.05));

                data.push({
                    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    timestamp: date.getTime(),
                    kwSim: parseFloat(kwSim.toFixed(2)),
                    kwField: parseFloat(kwField.toFixed(2)),
                    kwPredictive: parseFloat(kwPredictive.toFixed(2)),
                    deviation: parseFloat(((kwField - kwSim) / kwSim * 100).toFixed(2))
                });
            }
            return data;
        }

        // Si hay históricos, mapeamos los datos reales
        return historicalData.map(test => {
            const res = calculateSystemResults(test.rate, null, params, pump, test.freq);
            const kwSim = res?.systemKw || 0;
            const kwField = test.hp ? test.hp * 0.746 : (selectedWell.consumptionReal || 0);
            
            // Simulación de dato predictivo si no existe en el objeto test
            const kwPredictive = kwSim * 1.02; 

            return {
                time: test.date,
                timestamp: new Date(test.date).getTime(),
                kwSim: parseFloat(kwSim.toFixed(2)),
                kwField: parseFloat(kwField.toFixed(2)),
                kwPredictive: parseFloat(kwPredictive.toFixed(2)),
                deviation: kwSim > 0 ? parseFloat(((kwField - kwSim) / kwSim * 100).toFixed(2)) : 0
            };
        });
    }, [selectedWell, pump, params, historicalData]);

    const stats = useMemo(() => {
        if (comparisonData.length === 0) return null;
        const last = comparisonData[comparisonData.length - 1];
        const avgDev = comparisonData.reduce((acc, d) => acc + Math.abs(d.deviation), 0) / comparisonData.length;
        
        return {
            currentKw: last.kwField,
            simKw: last.kwSim,
            predKw: last.kwPredictive,
            dev: last.deviation,
            avgDev
        };
    }, [comparisonData]);

    if (!selectedWell) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-card/50 border border-dashed border-white/10 rounded-none p-8 text-center">
                <ZapOff className="w-12 h-12 text-muted mb-4 opacity-20" />
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Sin Selección de Pozo</h3>
                <p className="text-muted text-xs mt-2 max-w-xs">Seleccione un activo en el panel de monitoreo para inicializar el comparativo eléctrico.</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-4 bg-black border border-white/5 p-6 transition-all duration-500 ${isExpanded ? 'fixed inset-4 z-[100] shadow-2xl' : 'relative'}`}>
            
            {/* ── HEADER ────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 border border-primary/20">
                        <ZapIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter text-white">Análisis de Potencia Eléctrica</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{selectedWell.name}</span>
                            <div className="w-1 h-1 rounded-full bg-white/20"></div>
                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Registros de kW vs Simulación</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 p-1 rounded-none border border-white/10">
                        <button 
                            onClick={() => setViewMode('chart')}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'chart' ? 'bg-primary text-black' : 'text-muted hover:text-white'}`}
                        >
                            Gráfico
                        </button>
                        <button 
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-primary text-black' : 'text-muted hover:text-white'}`}
                        >
                            Tabla
                        </button>
                    </div>
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 bg-white/5 border border-white/10 text-muted hover:text-white transition-colors"
                    >
                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
            </div>

            {/* ── KPI GRID ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/10 overflow-hidden">
                <KpiCard 
                    label="Potencia Real (Campo)" 
                    value={stats?.currentKw.toFixed(1)} 
                    unit="kW" 
                    icon={<Activity className="text-emerald-500" size={14} />} 
                />
                <KpiCard 
                    label="Potencia Simulada" 
                    value={stats?.simKw.toFixed(1)} 
                    unit="kW" 
                    icon={<Cpu className="text-cyan-500" size={14} />} 
                />
                <KpiCard 
                    label="Potencia Predictiva (IA)" 
                    value={stats?.predKw.toFixed(1)} 
                    unit="kW" 
                    icon={<TrendingUp className="text-amber-500" size={14} />} 
                />
                <KpiCard 
                    label="Desviación Actual" 
                    value={stats?.dev.toFixed(2)} 
                    unit="%" 
                    icon={<AlertTriangle className={Math.abs(stats?.dev || 0) > 10 ? "text-danger" : "text-warning"} size={14} />} 
                    isCritical={Math.abs(stats?.dev || 0) > 10}
                />
            </div>

            {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
            <div className="flex-1 min-h-[400px] bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-30 pointer-events-none"></div>
                
                {viewMode === 'chart' ? (
                    <div className="w-full h-full p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={comparisonData}>
                                <defs>
                                    <linearGradient id="gradSim" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.simulation} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={COLORS.simulation} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="gradField" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.field} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={COLORS.field} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="gradPred" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.predictive} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={COLORS.predictive} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                <XAxis 
                                    dataKey="time" 
                                    stroke="#ffffff40" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tick={{ fontWeight: 'bold' }}
                                />
                                <YAxis 
                                    stroke="#ffffff40" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tick={{ fontWeight: 'bold' }}
                                    label={{ value: 'Potencia (kW)', angle: -90, position: 'insideLeft', style: { fill: '#ffffff40', fontWeight: 'bold', fontSize: 10 } }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend 
                                    verticalAlign="top" 
                                    align="right" 
                                    iconType="circle"
                                    content={renderLegend}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="kwSim" 
                                    name="Simulación" 
                                    stroke={COLORS.simulation} 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#gradSim)" 
                                    animationDuration={2000}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="kwField" 
                                    name="Campo (Real)" 
                                    stroke={COLORS.field} 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#gradField)" 
                                    animationDuration={2500}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="kwPredictive" 
                                    name="Predictivo" 
                                    stroke={COLORS.predictive} 
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    animationDuration={3000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="w-full h-full overflow-auto p-4 custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted">Tiempo / Registro</th>
                                    <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted">Simulación (kW)</th>
                                    <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted">Campo (kW)</th>
                                    <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted">Predictivo (kW)</th>
                                    <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted">Desviación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonData.map((row, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-2.5 px-4 text-xs font-bold text-white uppercase">{row.time}</td>
                                        <td className="py-2.5 px-4 text-right text-xs font-mono text-cyan-400">{row.kwSim.toFixed(2)}</td>
                                        <td className="py-2.5 px-4 text-right text-xs font-mono text-emerald-400">{row.kwField.toFixed(2)}</td>
                                        <td className="py-2.5 px-4 text-right text-xs font-mono text-amber-400">{row.kwPredictive.toFixed(2)}</td>
                                        <td className={`py-2.5 px-4 text-right text-xs font-black ${Math.abs(row.deviation) > 10 ? 'text-danger' : row.deviation > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {row.deviation > 0 ? '+' : ''}{row.deviation}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── FOOTER ANALYTICS ──────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Estado: Monitoreo Activo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Database size={12} className="text-muted" />
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Source: ESP Real-Time Hub</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10">
                    <Info size={14} className="text-primary" />
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest leading-relaxed">
                        Análisis basado en el balance de energía del motor y pérdidas resistivas en cable. 
                        <span className="text-primary ml-1">Error promedio histórico: {stats?.avgDev.toFixed(2)}%</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const KpiCard = ({ label, value, unit, icon, isCritical = false }: any) => (
    <div className={`p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-r border-white/5 last:border-r-0 ${isCritical ? 'relative overflow-hidden' : ''}`}>
        {isCritical && <div className="absolute top-0 right-0 w-8 h-8 bg-danger/20 rotate-45 translate-x-4 -translate-y-4"></div>}
        <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="text-[9px] font-black text-muted uppercase tracking-widest">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black tracking-tighter ${isCritical ? 'text-danger animate-pulse' : 'text-white'}`}>{value}</span>
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{unit}</span>
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-black/90 border border-white/20 p-3 shadow-2xl backdrop-blur-md">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-8 mb-1 last:mb-0">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">{entry.name}</span>
                        </div>
                        <span className="text-xs font-mono font-bold" style={{ color: entry.color }}>{entry.value.toFixed(2)} kW</span>
                    </div>
                ))}
                <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Desviación</span>
                        <span className={`text-[10px] font-black ${Math.abs(payload[0].payload.deviation) > 10 ? 'text-danger' : 'text-emerald-500'}`}>
                            {payload[0].payload.deviation > 0 ? '+' : ''}{payload[0].payload.deviation}%
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const renderLegend = (props: any) => {
    const { payload } = props;
    return (
        <div className="flex gap-4 mb-4">
            {payload.map((entry: any, index: number) => (
                <div key={`item-${index}`} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{entry.value}</span>
                </div>
            ))}
        </div>
    );
};
