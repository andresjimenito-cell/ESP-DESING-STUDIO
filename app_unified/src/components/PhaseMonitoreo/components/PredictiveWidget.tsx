import React from 'react';
import { WellFleetItem, SystemParams, EspPump } from '@/types';
import { Activity, Sparkles, TrendingUp, Zap } from 'lucide-react';

interface PredictiveWidgetProps {
    selectedWell: WellFleetItem;
    wellMatchParams: SystemParams;
    pump: EspPump;
    computeWellCapacity: (well: WellFleetItem, params: SystemParams, pump: EspPump) => any;
    getOptimizationPath: (well: WellFleetItem, capacity: any, pump: EspPump) => { advice: string; warning: string };
}

export const PredictiveWidget: React.FC<PredictiveWidgetProps> = ({
    selectedWell,
    wellMatchParams,
    pump,
    computeWellCapacity,
    getOptimizationPath
}) => {
    const capacity = computeWellCapacity(selectedWell, wellMatchParams, pump);
    const { advice, warning } = getOptimizationPath(selectedWell, capacity, pump);

    return (
        <div className="relative group/ai">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-secondary/50 to-primary/50 rounded-[2.5rem] blur-2xl opacity-20 group-hover/ai:opacity-40 transition-opacity duration-1000 animate-pulse"></div>
            <div className="glass-surface rounded-[2.5rem] border border-primary/20 p-8 relative overflow-hidden shadow-[0_20px_50px_rgba(var(--color-primary),0.15)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -translate-y-1/2 translate-x-1/4"></div>

                <div className="flex items-start gap-8 relative z-10">
                    <div className="relative shrink-0">
                        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/30 shadow-glow-primary/20 group-hover/ai:scale-110 transition-transform duration-500">
                            <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-secondary text-white p-2 rounded-xl shadow-lg border-2 border-canvas">
                            <Zap className="w-4 h-4 fill-current" />
                        </div>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black text-txt-main tracking-tighter uppercase italic">Phase 7: AI Engineering Assistant</h3>
                                <div className="px-3 py-1 bg-primary text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-glow-primary">Live Diagnosis</div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40">System Efficiency</span>
                                    <span className="text-lg font-black text-primary italic">{(wellMatchParams as any).efficiency || 92.4}%</span>
                                </div>
                                <div className="w-px h-10 bg-white/5"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40">Predictive Match</span>
                                    <span className="text-lg font-black text-secondary italic">98.2%</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-canvas/40 backdrop-blur-md rounded-2xl p-6 border border-white/5 group-hover/ai:border-primary/20 transition-all">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 p-2 bg-primary/10 rounded-lg text-primary"><Activity className="w-4 h-4" /></div>
                                <div className="space-y-4 flex-1">
                                    <p className="text-sm font-bold text-txt-main leading-relaxed tracking-tight text-justify">
                                        {advice}
                                        {warning && <span className="text-danger ml-2 font-black">{warning}</span>}
                                    </p>

                                    {capacity && capacity.potentialGain > 0 && (
                                        <div className="flex items-center gap-4 bg-primary/10 p-4 rounded-xl border border-primary/20">
                                            <TrendingUp className="w-5 h-5 text-primary" />
                                            <div>
                                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Oportunidad de Producción</span>
                                                <p className="text-xs font-black text-txt-main uppercase">Ganancia estimada: <span className="text-primary">+{Math.round(capacity.potentialGain)} BPD</span> extras operando a {capacity.maxFreq} Hz</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
