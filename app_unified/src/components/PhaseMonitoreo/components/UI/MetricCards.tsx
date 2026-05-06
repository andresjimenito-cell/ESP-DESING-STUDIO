import React from 'react';

export const MetricCard = ({ label, value, unit, icon: Icon, colorClass = "text-primary" }: any) => (
    <div className="glass-surface p-6 rounded-[2.5rem] border border-white/5 group hover:border-primary/40 transition-all relative overflow-hidden shadow-2xl">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 blur-[50px] rounded-full group-hover:bg-primary/10 transition-all"></div>
        <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className={`p-3 bg-white/5 rounded-2xl border border-white/5 ${colorClass}`}>
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-50">{label}</span>
        </div>
        <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-black text-txt-main tracking-tighter drop-shadow-sm">{value}</span>
            <span className="text-[10px] font-black text-txt-muted uppercase opacity-40">{unit}</span>
        </div>
    </div>
);

export const MetricSummaryCard = ({ label, value, unit, trend, isGood, icon: Icon }: any) => (
    <div className="glass-surface p-7 rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:border-primary/40 transition-all shadow-3xl">
        <div className={`absolute top-0 right-0 w-32 h-32 ${isGood ? 'bg-success/5' : 'bg-danger/5'} blur-[60px] rounded-full`}></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 text-primary group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black border ${isGood ? 'bg-success/10 text-success border-success/20 shadow-glow-success/10' : 'bg-danger/10 text-danger border-danger/20 shadow-glow-danger/10'}`}>
                {trend}
            </div>
        </div>
        <div className="space-y-1 relative z-10">
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-txt-main tracking-tighter italic">{value}</span>
                <span className="text-[11px] font-black text-txt-muted uppercase tracking-widest opacity-40">{unit}</span>
            </div>
            <span className="block text-[11px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-40">{label}</span>
        </div>
    </div>
);

export const CompValueCard = ({ label, design, actual, unit }: any) => {
    const diff = design !== 0 ? ((actual - design) / design) * 100 : 0;
    const isGood = Math.abs(diff) < 10;
    return (
        <div className="glass-surface p-7 rounded-[2rem] border border-white/5 group hover:border-primary/40 transition-all relative overflow-hidden shadow-2xl">
            <div className={`absolute top-0 right-0 w-24 h-24 ${isGood ? 'bg-success/5' : 'bg-danger/5'} blur-[30px] rounded-full`}></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
                <span className="text-[11px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-50">{label}</span>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black border ${isGood ? 'bg-success/10 text-success border-success/20 shadow-glow-success/10' : 'bg-danger/10 text-danger border-danger/20 shadow-glow-danger/10'}`}>
                    {Math.abs(diff).toFixed(1)}% {diff > 0 ? 'UP' : 'DN'}
                </div>
            </div>
            <div className="flex items-baseline gap-3 relative z-10">
                <span className="text-3xl font-black text-txt-main tracking-tighter drop-shadow-sm">{actual?.toFixed(0)}</span>
                <span className="text-[10px] font-black text-txt-muted uppercase opacity-40">{unit}</span>
            </div>
            <div className="mt-4 flex items-center gap-3 relative z-10 bg-canvas/40 p-2.5 rounded-xl border border-white/5 w-fit">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-30">Goal:</span>
                <span className="text-[11px] font-black text-primary font-mono">{design?.toFixed(0)}</span>
            </div>
        </div>
    );
};
