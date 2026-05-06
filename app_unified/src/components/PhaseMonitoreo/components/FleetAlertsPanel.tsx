import React from 'react';
import { Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { WellFleetItem } from '@/types';
import { getWellHealthScore } from '../utils/healthEngine';

interface FleetAlertsPanelProps {
    fleet: WellFleetItem[];
    setSelectedWellId: (id: string) => void;
    customDesigns: any;
    providedPump: any;
}

export const FleetAlertsPanel: React.FC<FleetAlertsPanelProps> = ({ 
    fleet, setSelectedWellId, customDesigns, providedPump 
}) => {
    const alerts = fleet.filter(w => getWellHealthScore(w, customDesigns, providedPump) < 55);

    return (
        <div className="w-full h-full bg-surface/60 backdrop-blur-xl border border-surface-light rounded-[3rem] shadow-3xl relative overflow-hidden flex flex-col group/panel">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

            <div className="px-8 py-8 border-b border-surface-light flex items-center justify-between bg-surface-light/10">
                <div>
                    <h4 className="text-xl font-black text-txt-main uppercase tracking-tighter flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                        AI Alerts
                    </h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mt-1 opacity-70">Fleet Intelligence Radar</p>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black ${alerts.length > 0 ? 'bg-danger/10 text-danger border border-danger/30 animate-pulse shadow-glow-danger/20' : 'bg-success/10 text-success border border-success/30'} uppercase tracking-widest`}>
                    {alerts.length} Active Alarms
                </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-canvas/30">
                {alerts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20 animate-fadeIn">
                        <div className="p-8 bg-success/5 rounded-full mb-6 border border-success/10">
                            <ShieldCheck className="w-20 h-20 text-success" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.4em]">Global Fleet Status<br /><span className="text-success opacity-100">Optimal</span></p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {alerts.map(w => (
                            <div key={w.id} className="p-6 bg-surface/80 border border-white/5 rounded-[2.5rem] animate-fadeIn hover:border-danger/40 transition-all cursor-pointer shadow-xl relative overflow-hidden group/item" onClick={() => { setSelectedWellId(w.id); }}>
                                <div className="absolute inset-0 bg-gradient-to-tr from-danger/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                <div className="absolute left-0 top-8 bottom-8 w-1 bg-danger rounded-full shadow-glow-danger"></div>

                                <div className="flex items-center justify-between mb-4 relative z-10 pl-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-danger animate-ping"></div>
                                        <span className="text-[10px] font-black text-danger uppercase italic tracking-[0.2em]">Salud Crítica</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-txt-muted opacity-40">{(new Date(w.lastUpdate)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <h5 className="text-xl font-black text-txt-main uppercase tracking-tighter mb-2 relative z-10 pl-2">{w.name}</h5>
                                <p className="text-[10px] font-bold text-txt-muted leading-relaxed uppercase opacity-60 tracking-tight pl-2 mb-6">
                                    Análisis predictivo detecta degradación acelerada del {100 - getWellHealthScore(w, customDesigns, providedPump)}%. Posible interferencia de gas o desgaste mecánico.
                                </p>
                                <div className="flex justify-end relative z-10">
                                    <button className="px-6 py-2.5 bg-danger/10 text-danger text-[10px] font-black rounded-xl border border-danger/20 group-hover/item:bg-danger group-hover/item:text-white transition-all tracking-widest uppercase shadow-lg shadow-danger/5">
                                        Ver Diagnóstico
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
