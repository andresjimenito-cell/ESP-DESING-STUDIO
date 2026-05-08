import React, { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Scatter,
    ReferenceArea,
    Label
} from 'recharts';
import { EspPump, SystemParams } from '../types';
import { calculateBaseHead, calculateTDH } from '../utils';

interface ComparativeChartProps {
    pump: EspPump | null;
    actualParams: SystemParams;
    actualFreq: number;
    fieldData: any;
    actualPumpTDH: number;
    sysCurveFrictionMultiplier: number;
}

export const ComparativeChart: React.FC<ComparativeChartProps> = ({
    pump,
    actualParams,
    actualFreq,
    fieldData,
    actualPumpTDH,
    sysCurveFrictionMultiplier
}) => {
    const data = useMemo(() => {
        if (!pump) return [];
        
        // Fallback to nameplate freq if actual is 0 to show at least something
        const baseFreq = pump.nameplateFrequency || 60;
        const calcFreq = actualFreq > 0 ? actualFreq : baseFreq;
        const ratio = calcFreq / baseFreq;
        const maxFlow = (pump.maxGraphRate || 5000) * ratio;
        const steps = 50;
        const stepSize = maxFlow / steps;

        const points = [];
        const hStat = calculateTDH(0.1, actualParams);

        for (let i = 0; i <= steps; i++) {
            const q = i * stepSize;
            const qBase = q / ratio;
            
            // 1. FRESH PUMP CURVE (CATALOG)
            const hCatalog = calculateBaseHead(qBase, pump) * ratio * ratio;

            // 2. CALIBRATED SYSTEM CURVE (REAL WELL)
            const hSystemRaw = calculateTDH(q, actualParams);
            const friction = hSystemRaw - hStat;
            const hSystemCalibrated = hStat + (friction * sysCurveFrictionMultiplier);

            points.push({
                flow: Math.round(q),
                catalogHead: hCatalog > 0 ? Number(hCatalog.toFixed(1)) : null,
                systemHead: hSystemCalibrated > 0 ? Number(hSystemCalibrated.toFixed(1)) : null,
            });
        }
        return points;
    }, [pump, actualFreq, actualParams, sysCurveFrictionMultiplier]);

    // Calculate Theoretical Intersection (Fresh Pump vs Calibrated System)
    const theoreticalPoint = useMemo(() => {
        if (data.length < 2) return null;
        for (let i = 0; i < data.length - 1; i++) {
            const p1 = data[i];
            const p2 = data[i+1];
            if (p1.catalogHead && p1.systemHead && p2.catalogHead && p2.systemHead) {
                const d1 = p1.catalogHead - p1.systemHead;
                const d2 = p2.catalogHead - p2.systemHead;
                if (d1 * d2 <= 0) {
                    const frac = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
                    return {
                        flow: p1.flow + (p2.flow - p1.flow) * frac,
                        head: p1.catalogHead + (p2.catalogHead - p1.catalogHead) * frac
                    };
                }
            }
        }
        return null;
    }, [data]);

    const actualPoint = {
        flow: fieldData.rate,
        head: actualPumpTDH
    };

    const minFlow = (pump?.minRate || 0) * (actualFreq / (pump?.nameplateFrequency || 60));
    const maxFlow = (pump?.maxRate || 5000) * (actualFreq / (pump?.nameplateFrequency || 60));

    return (
        <div className="w-full h-full min-h-[400px] flex flex-col bg-slate-900/40 rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary/50 via-primary/50 to-secondary/50 opacity-30"></div>
            
            <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                    <h3 className="text-lg font-black text-white tracking-tighter uppercase">Análisis Comparativo Nodal</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Catálogo vs. Realidad @ {actualFreq || (pump?.nameplateFrequency || 60)} Hz</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        <span className="text-[9px] font-black text-slate-300 uppercase">Catálogo (Bomba Nueva)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-secondary shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                        <span className="text-[9px] font-black text-slate-300 uppercase">Sistema (Pozo Calibrado)</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <defs>
                            <linearGradient id="colorCatalog" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis 
                            dataKey="flow" 
                            type="number" 
                            domain={[0, 'dataMax + 500']} 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickFormatter={(v) => `${v}`}
                            label={{ value: 'CAUDAL (BFPD)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                        />
                        <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            label={{ value: 'CABEZA (FT)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px', color: '#fff' }}
                            itemStyle={{ fontWeight: 'bold' }}
                        />
                        
                        {/* Operating Range Areas */}
                        <ReferenceArea x1={minFlow} x2={maxFlow} fill="#10b981" fillOpacity={0.03} />

                        {/* Catalog Pump Curve */}
                        <Line 
                            type="monotone" 
                            dataKey="catalogHead" 
                            stroke="#3b82f6" 
                            strokeWidth={4} 
                            dot={false} 
                            name="Curva Catálogo"
                            animationDuration={1500}
                        />

                        {/* Calibrated System Curve */}
                        <Line 
                            type="monotone" 
                            dataKey="systemHead" 
                            stroke="#2dd4bf" 
                            strokeWidth={3} 
                            strokeDasharray="5 5"
                            dot={false} 
                            name="Sistema Calibrado"
                        />

                        {/* Actual Operating Point */}
                        <Scatter 
                            name="Punto Real" 
                            data={[actualPoint]} 
                            fill="#f59e0b" 
                        >
                            {/* Custom dot for Actual OP */}
                            <circle cx={0} cy={0} r={8} fill="#f59e0b" stroke="#fff" strokeWidth={2} className="animate-pulse" />
                        </Scatter>

                        {/* Theoretical Operating Point */}
                        {theoreticalPoint && (
                            <Scatter 
                                name="Punto Teórico" 
                                data={[theoreticalPoint]} 
                                fill="#94a3b8"
                            >
                                <circle cx={0} cy={0} r={6} fill="#fff" stroke="#94a3b8" strokeWidth={2} />
                            </Scatter>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Diagnostics Overlay */}
            <div className="absolute bottom-12 right-12 flex flex-col gap-2 pointer-events-none">
                <div className="glass-surface p-3 rounded-2xl border border-white/10 shadow-xl bg-slate-900/60 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-secondary rounded-full"></div>
                        <div>
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Punto Teórico</div>
                            <div className="text-sm font-black text-white font-mono">{theoreticalPoint?.flow.toFixed(0)} <span className="text-[8px] text-slate-400">BFPD</span></div>
                        </div>
                    </div>
                </div>
                <div className="glass-surface p-3 rounded-2xl border border-white/10 shadow-xl bg-slate-900/60 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-amber-500 rounded-full"></div>
                        <div>
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Punto Real</div>
                            <div className="text-sm font-black text-white font-mono">{actualPoint.flow.toFixed(0)} <span className="text-[8px] text-slate-400">BFPD</span></div>
                        </div>
                    </div>
                </div>
                <div className="glass-surface p-3 rounded-2xl border border-white/10 shadow-xl bg-slate-900/60 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-cyan-500 rounded-full"></div>
                        <div>
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ajuste Fricción (Kf)</div>
                            <div className="text-sm font-black text-white font-mono">{sysCurveFrictionMultiplier.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
