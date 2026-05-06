import React from 'react';

export const HealthTag = ({ score }: { score: number }) => {
    let colorClass = 'bg-success/20 text-success border-success/30';
    if (score < 40) colorClass = 'bg-danger/20 text-danger border-danger/30';
    else if (score < 75) colorClass = 'bg-warning/20 text-warning border-warning/30';

    return (
        <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border ${colorClass}`}>
            Health: {score}%
        </div>
    );
};

export const DiagnosticBadge = ({ status, label }: { status: 'optimal' | 'caution' | 'alert', label: string }) => {
    const config = {
        optimal: 'bg-success/10 text-success border-success/20 shadow-glow-success/10',
        caution: 'bg-warning/10 text-warning border-warning/20 shadow-glow-warning/10',
        alert: 'bg-danger/10 text-danger border-danger/20 shadow-glow-danger/10'
    };
    return (
        <span className={`px-2 py-0.5 rounded-[4px] border text-[7px] font-black uppercase tracking-widest ${config[status]}`}>
            {label}
        </span>
    );
};

export const PredictiveMiniWidget = ({ label, status, desc }: any) => {
    const statusConfig: any = {
        optimal: { color: 'text-success', bg: 'bg-success', glow: 'shadow-glow-success' },
        caution: { color: 'text-warning', bg: 'bg-warning', glow: 'shadow-glow-warning/30' },
        alert: { color: 'text-danger', bg: 'bg-danger', glow: 'shadow-glow-danger' }
    };
    const config = statusConfig[status] || statusConfig.optimal;
    return (
        <div className="flex items-center justify-between p-5 bg-canvas/40 backdrop-blur-md rounded-[1.5rem] border border-white/5 hover:border-primary/30 transition-all group cursor-default shadow-lg relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bg} opacity-50`}></div>
            <div className="flex items-center gap-5 relative z-10">
                <div className={`w-3 h-3 rounded-full ${config.bg} ${config.glow} shadow-sm transition-transform`}></div>
                <div>
                    <span className="text-[11px] font-black text-txt-main uppercase tracking-widest opacity-90">{label}</span>
                    <p className="text-[10px] font-bold text-txt-muted uppercase opacity-40 tracking-tighter mt-0.5 group-hover:opacity-80 transition-opacity">{desc}</p>
                </div>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${config.color} opacity-80 bg-white/5 px-3 py-1 rounded-lg border border-white/5`}>{status}</span>
        </div>
    );
};
