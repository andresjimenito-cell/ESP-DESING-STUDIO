import React from 'react';

export const DiagnosticRow = ({ label, unit, theoretical, real, lowIsBad = false, noDiff = false }: any) => {
    const diff = noDiff ? 0 : theoretical > 0 ? ((real - theoretical) / theoretical) * 100 : 0;
    const isBad = noDiff ? false : lowIsBad ? diff < -10 : Math.abs(diff) > 10;
    return (
        <tr className="border-b border-white/5 group hover:bg-white/5 transition-all relative">
            <td className="py-6 px-4 font-black text-txt-main tracking-tight opacity-80 group-hover:opacity-100 group-hover:text-primary transition-colors">{label}</td>
            <td className="py-6 px-4 text-txt-muted uppercase text-[9px] font-bold opacity-40">{unit}</td>
            <td className="py-6 px-4 font-mono text-txt-muted opacity-60">{(theoretical || 0).toFixed(0)}</td>
            <td className={`py-6 px-4 font-mono font-black ${isBad ? 'text-danger' : 'text-primary'} text-lg`}>{(real || 0).toFixed(0)}</td>
            <td className={`py-6 px-4 font-mono ${isBad ? 'text-danger' : 'text-success'} font-bold opacity-80`}>
                {noDiff ? '-' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`}
            </td>
            <td className="py-6 px-4 text-right">
                <div className={`inline-block w-4 h-4 rounded-full ${isBad ? 'bg-danger shadow-glow-danger/60 animate-pulse' : 'bg-success shadow-glow-success/40'} border-2 border-white/10 shadow-lg`}></div>
            </td>
        </tr>
    );
};
