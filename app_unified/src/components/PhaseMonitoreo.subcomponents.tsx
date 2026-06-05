import React, { useState, useMemo, useEffect } from 'react';
import { Activity, Gauge, Thermometer, ShieldCheck, Clock, AlertTriangle, Brain, Minimize2, Search } from 'lucide-react';
import { WellFleetItem, SystemParams, EspPump } from '@/types';
import { useLanguage } from '@/i18n';
import { getOptimizationPathLocalized, computeWellCapacity } from './PhaseMonitoreo.helpers';
import { HealthTagLabels } from './PhaseMonitoreo.constants';

export const WellListItem = React.memo(({ well, health, isActive, isMechVerified, onSelect }: any) => {
    const { language } = useLanguage();
    const isPendiente = well.estadoActual === 'pendiente';
    const isESP = !well.als || well.als.toUpperCase() === 'ESP';

    // Status color mapping based on operational state or health score
    const statusColor = isPendiente 
        ? 'bg-slate-500' 
        : (well.estadoActual === 'fallado' 
            ? 'bg-danger shadow-glow-danger animate-pulse' 
            : (health >= 90 ? 'bg-success shadow-glow-success' : health >= 60 ? 'bg-warning' : 'bg-danger shadow-glow-danger'));

    const getEstadoLabel = (estado: string) => {
        if (estado === 'operativo') return language === 'es' ? 'OPERATIVO' : 'OPERATIONAL';
        if (estado === 'fallado') return language === 'es' ? 'FALLADO' : 'FAILED';
        if (estado === 'pull') return 'PULL';
        if (estado === 'pendiente') return language === 'es' ? 'PENDIENTE' : 'PENDING';
        return estado ? estado.toUpperCase() : '';
    };

    const getEstadoClass = (estado: string) => {
        if (estado === 'operativo') return 'text-success border-success/25 bg-success/10';
        if (estado === 'fallado') return 'text-danger border-danger/25 bg-danger/10 animate-pulse font-black';
        if (estado === 'pull') return 'text-warning border-warning/25 bg-warning/10';
        return 'text-txt-muted border-white/10 bg-white/5';
    };

    const getHealthLabel = (h: number) => {
        if (h >= 90) return language === 'es' ? 'OPTIMO' : 'OPTIMAL';
        if (h >= 60) return language === 'es' ? 'PRECAUCION' : 'CAUTION';
        return language === 'es' ? 'CRITICO' : 'CRITICAL';
    };

    return (
        <button
            onClick={() => isESP && onSelect(well.id)}
            disabled={!isESP}
            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-none transition-all text-left mb-1.5 ${!isESP ? 'opacity-40 grayscale cursor-not-allowed' : (isActive
                ? 'bg-primary/15 border border-primary/35 border-l-2 border-l-primary shadow-[inset_0_0_20px_rgb(var(--color-primary)/0.06)]'
                : 'hover:bg-white/[0.06] border border-transparent border-l-2 border-l-transparent hover:border-l-white/15'
            )}`}
        >
            <div className={`w-3 h-3 rounded-none shrink-0 ${statusColor}`}></div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[13px] font-black uppercase tracking-tight truncate ${isActive ? 'text-primary' : 'text-txt-main'}`}>{well.name}</span>
                    {isMechVerified && (
                        <span className="bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest shrink-0">MECH</span>
                    )}
                    {well.als && (
                        <span className={`${isESP ? 'bg-primary/10 text-primary border-primary/30' : 'bg-warning/10 text-warning border-warning/30'} border px-2 py-0.5 text-[7px] font-black uppercase tracking-widest shrink-0`}>
                            {well.als} {!isESP && (language === 'es' ? '- NO SOPORTADO' : '- NOT SUPPORTED')}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-bold text-txt-muted uppercase tracking-widest mt-0.5 block">
                    {isPendiente 
                        ? (language === 'es' ? 'Pendiente por Instalación' : 'Pending Installation') 
                        : `${Math.round(well.currentRate)} BPD · ${well.productionTest.freq || 0} Hz`}
                </span>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`text-[8px] font-black tracking-widest px-2 py-0.5 border ${getEstadoClass(well.estadoActual)}`}>
                    {getEstadoLabel(well.estadoActual)}
                </span>
                {!isPendiente && (
                    <span className={`text-[8px] font-black tracking-widest px-2 py-0.5 border ${health >= 90 ? 'text-success border-success/25 bg-success/10' : health >= 60 ? 'text-warning border-warning/25 bg-warning/10' : 'text-danger border-danger/25 bg-danger/10'}`}>
                        {getHealthLabel(health)}
                    </span>
                )}
            </div>
        </button>
    );
});

export const PredictiveWidget = React.memo(({ selectedWell, wellMatchParams, pump, computeWellCapacity, getOptimizationPath }: any) => {
    const { language } = useLanguage();
    const [isMinimized, setIsMinimized] = useState(false);

    // Solo calculamos si el widget esta expandido para ahorrar CPU
    const analysisData = useMemo(() => {
        if (isMinimized || !selectedWell || !pump) return null;

        const mp: SystemParams = {
            ...wellMatchParams,
            historyMatch: {
                ...wellMatchParams.historyMatch,
                rate: selectedWell.productionTest.rate || 0.1,
                frequency: selectedWell.productionTest.freq || 60,
                pip: selectedWell.productionTest.pip || 0,
                waterCut: selectedWell.productionTest.waterCut || 0,
                pStatic: wellMatchParams.inflow?.pStatic || 0,
            } as any
        };

        const capacity = computeWellCapacity(selectedWell, mp, pump);
        const { advice, warning } = getOptimizationPathLocalized(selectedWell, capacity, pump, language);

        const currentRate = selectedWell.productionTest.rate || 0.1;
        const currentFreq = selectedWell.productionTest.freq || 60;
        const ratio = currentFreq / (pump?.nameplateFrequency || 60);
        const isDownthrust = currentRate < (pump?.minRate || 0) * ratio * 0.95;
        const isUpthrust = currentRate > (pump?.maxRate || 2000) * ratio * 1.05;

        return { capacity, advice, warning, isDownthrust, isUpthrust };
    }, [isMinimized, selectedWell?.id, pump?.id, wellMatchParams?.inflow?.pStatic, language]);

    useEffect(() => {
        setIsMinimized(false);
        const timer = setTimeout(() => setIsMinimized(true), 10000);
        return () => clearTimeout(timer);
    }, [selectedWell?.id]);

    if (isMinimized) {
        return (
            <div className="relative lg:absolute lg:top-24 lg:right-8 z-50 pointer-events-auto flex justify-end mb-2 pr-1">
                <button
                    onClick={() => setIsMinimized(false)}
                    className="glass-surface border border-primary/30 bg-gradient-to-tr from-primary/20 to-transparent rounded-xl p-3 shadow-lg hover:bg-primary/20 transition-all flex items-center gap-2 animate-pulse text-[10px] font-black text-primary uppercase tracking-widest"
                >
                    <Brain className="w-4 h-4 text-primary drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                    <span>Ver Análisis IA</span>
                </button>
            </div>
        );
    }

    if (!analysisData) return null;

    const { capacity, advice, warning, isDownthrust, isUpthrust } = analysisData;
    const thrustMsg = (!isDownthrust && !isUpthrust) ? (language === 'es' ? 'en su Ventana Operativa' : 'within its Operating Window') : (isDownthrust ? (language === 'es' ? 'en Zona de Downthrust' : 'in Downthrust Zone') : (language === 'es' ? 'en Zona de Upthrust' : 'in Upthrust Zone'));

    return (
        <div className="relative lg:absolute lg:top-24 lg:right-8 z-40 pointer-events-none animate-slideUp w-full lg:w-auto">
            <div className="glass-surface border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface rounded-2xl p-4 md:p-6 shadow-2xl w-full lg:w-[420px] flex flex-col gap-3 group transition-all backdrop-blur-3xl relative pointer-events-auto">
                <button onClick={() => setIsMinimized(true)} className="absolute top-5 right-5 p-2 rounded-none hover:bg-white/10 text-primary border border-primary/20 bg-primary/5 transition-all z-10">
                    <Minimize2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-4 border-b border-white/5 pb-4 pr-10">
                    <div className="p-3 bg-primary/20 rounded-none ring-1 ring-primary/40 animate-[pulse_3s_ease-in-out_infinite]">
                        <Brain className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-black text-primary tracking-[0.2em] uppercase">{language === 'es' ? 'ANALISIS PREDICTIVO IA' : 'AI PREDICTIVE ANALYSIS'}</h3>
                        <div className="flex gap-2 mt-1">
                            {isDownthrust && <span className="px-2 py-0.5 bg-warning/20 border border-warning/40 rounded text-[10px] font-black text-warning tracking-widest uppercase animate-pulse">DOWNTHRUST</span>}
                            {isUpthrust && <span className="px-2 py-0.5 bg-danger/20 border border-danger/40 rounded text-[10px] font-black text-danger tracking-widest uppercase animate-pulse">UPTHRUST</span>}
                            <span className={`px-2 py-0.5 border rounded text-[10px] font-black tracking-widest uppercase ${(!isDownthrust && !isUpthrust) ? 'bg-success/20 border-success/40 text-success' : 'bg-white/5 border-white/10 text-txt-muted'}`}>
                                {(!isDownthrust && !isUpthrust) ? (language === 'es' ? 'OPTIMO' : 'OPTIMAL') : (language === 'es' ? 'ALERTA' : 'ALERT')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="text-[13px] text-txt-main/90 font-medium leading-relaxed">
                    {language === 'es' ? 'Bomba' : 'Pump'} <strong>{pump?.model}</strong> {language === 'es' ? 'opera' : 'operates'} <strong>{thrustMsg}</strong>.
                    <span className="block mt-2 text-primary/90 font-black text-sm">{advice}</span>
                    {warning && <span className="block mt-2.5 font-bold text-warning border-l-2 border-warning/40 pl-3 bg-warning/5 py-1.5 rounded-r-md">{warning}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 bg-canvas/30 -mx-6 -mb-6 p-5 rounded-b-[2rem]">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-txt-muted font-black opacity-60">Limite Seguro VSD</span>
                        <div className="text-2xl font-black text-white leading-none mt-1.5">{Math.round(capacity?.maxRate || 0)} <span className="text-[11px] text-txt-muted font-bold">BPD @ {Math.round(capacity?.maxFreq || 60)}Hz</span></div>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase tracking-widest text-txt-muted font-black opacity-60">Opt. Potencial</span>
                        <div className="text-2xl font-black text-success leading-none mt-1.5">+{Math.round(capacity?.potentialGain || 0)} <span className="text-[11px] text-success/60 font-bold">BPD</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const DebouncedSearchInput = React.memo(({ value, onChange, placeholder }: any) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        const t = setTimeout(() => onChange(localValue), 250);
        return () => clearTimeout(t);
    }, [localValue, onChange]);

    return (
        <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
            <input
                type="text"
                placeholder={placeholder}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                className="w-full bg-canvas/70 border border-white/10 rounded-none pl-11 pr-4 py-3 text-xs font-bold text-txt-main focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 uppercase tracking-wider placeholder:text-txt-muted/40"
            />
        </div>
    );
});

export const MetricCard = React.memo(({ label, value, unit, icon: Icon, color = 'primary', alert = false }: any) => (
    <div className={`glass-surface rounded-none border ${alert ? 'border-danger/50 shadow-glow-danger/20' : 'border-white/5'} p-4 flex flex-col justify-between h-28 relative overflow-hidden group transition-all`}>
        <div className={`absolute -right-4 -top-4 w-16 h-16 ${color === 'primary' ? 'bg-primary/5' : color === 'secondary' ? 'bg-secondary/5' : 'bg-danger/5'} blur-2xl rounded-none`}></div>
        <div className="flex justify-between items-start z-10">
            <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-60">{label}</span>
            <Icon className={`w-4 h-4 ${color === 'primary' ? 'text-primary' : color === 'secondary' ? 'text-secondary' : 'text-danger'} ${alert ? 'animate-pulse' : ''}`} />
        </div>
        <div className="mt-auto z-10">
            <div className={`text-2xl font-black ${alert ? 'text-danger' : 'text-txt-main'} tracking-tighter`}>{value} <small className="text-[10px] text-txt-muted uppercase">{unit}</small></div>
        </div>
    </div>
));

export const HealthTag = React.memo(({ status, label }: { status: string, label: string }) => {
    const colors: any = {
        normal: 'bg-success/20 text-success border-success/30 shadow-glow-success/10',
        caution: 'bg-warning/20 text-warning border-warning/30',
        alert: 'bg-danger/20 text-danger border-danger/30 shadow-glow-danger/10',
        failure: 'bg-magenta/20 text-magenta border-magenta/30',
        active: 'bg-primary/20 text-primary border-primary/30',
        inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        'ground-fault': 'bg-danger/40 text-danger border-danger/50 animate-pulse',
        error: 'bg-magenta/40 text-magenta border-magenta/50'
    };
    const displayLabel = HealthTagLabels[status] || status.toUpperCase();
    return (
        <div className="flex items-center justify-between gap-12 w-full">
            <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-60">{label}</span>
            <span className={`px-2 py-0.5 rounded-none text-[8px] font-black uppercase tracking-widest border ${colors[status] || colors.inactive}`}>
                {displayLabel}
            </span>
        </div>
    );
});

export const MetricSummaryCard = React.memo(({ label, value, unit, icon: Icon, color = 'primary' }: any) => {
    const glowClass = color === 'primary' ? 'group-hover:shadow-glow-primary/40' : color === 'secondary' ? 'group-hover:shadow-glow-secondary/40' : 'group-hover:shadow-glow-danger/40';
    const borderHover = color === 'primary' ? 'group-hover:border-primary/50' : color === 'secondary' ? 'group-hover:border-secondary/50' : 'group-hover:border-danger/50';

    return (
        <div className={`glass-surface rounded-none border border-white/5 p-6 flex items-center gap-6 shadow-2xl transition-all duration-700 flex-1 min-w-[220px] relative overflow-hidden group ${glowClass} ${borderHover}`}>
            {/* Ambient Background Gradient Glows */}
            <div className={`absolute -right-8 -top-8 w-40 h-40 ${color === 'primary' ? 'bg-primary/25' : color === 'secondary' ? 'bg-secondary/25' : 'bg-danger/25'} blur-[60px] rounded-none opacity-0 group-hover:opacity-100 transition-all duration-1000`}></div>
            <div className={`absolute -left-12 -bottom-12 w-32 h-32 ${color === 'primary' ? 'bg-primary/15' : color === 'secondary' ? 'bg-secondary/15' : 'bg-danger/15'} blur-[40px] rounded-none opacity-30 transition-transform duration-1000 delay-150`}></div>

            {/* Themed Internal Overlay Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${color === 'primary' ? 'from-primary/5 via-transparent to-primary/5' : color === 'secondary' ? 'from-secondary/5 via-transparent to-secondary/5' : 'from-danger/5 via-transparent to-danger/5'} opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>

            {/* Icon Container with Dynamic Theme Ring */}
            <div className={`p-4 rounded-none ${color === 'primary' ? 'bg-primary/15 text-primary border-primary/30 shadow-glow-primary/20' : color === 'secondary' ? 'bg-secondary/15 text-secondary border-secondary/30 shadow-glow-secondary/20' : 'bg-danger/15 text-danger border-danger/30 shadow-glow-danger/20'} border relative z-10 transition-all duration-500 group-hover:rotate-6`}>
                <Icon className="w-7 h-7" />
                {/* Micro pulse effect on icon ring */}
                <div className={`absolute inset-0 rounded-none border-2 ${color === 'primary' ? 'border-primary' : color === 'secondary' ? 'border-secondary' : 'border-danger'} opacity-0 group-hover:animate-ping opacity-20`}></div>
            </div>

            <div className="flex flex-col relative z-20">
                <span className={`text-[10px] font-black uppercase tracking-[0.25em] mb-1.5 transition-colors duration-500 ${color === 'primary' ? 'text-primary/70 group-hover:text-primary' : color === 'secondary' ? 'text-secondary/70 group-hover:text-secondary' : 'text-danger/70 group-hover:text-danger'}`}>{label}</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-txt-main tracking-tighter leading-none drop-shadow-sm">{value}</span>
                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest opacity-40 leading-none group-hover:opacity-100 group-hover:text-txt-main transition-all">{unit}</span>
                </div>
            </div>

            {/* Bottom Shine Line */}
            <div className={`absolute bottom-0 left-10 right-10 h-[2px] ${color === 'primary' ? 'bg-gradient-to-r from-transparent via-primary/60 to-transparent' : color === 'secondary' ? 'bg-gradient-to-r from-transparent via-secondary/60 to-transparent' : 'bg-gradient-to-r from-transparent via-danger/60 to-transparent'} opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
        </div>
    );
});

export const DiagnosticBadge = ({ well, health, normalWellCapacity }: { well: WellFleetItem, health: number, normalWellCapacity?: any }) => {
    const isRunning = well.currentRate > 5;
    if (!isRunning) return <div className="flex items-center gap-2 bg-surface-light/50 px-3 py-1 rounded-none text-txt-muted opacity-40 font-black text-[8px] uppercase tracking-widest border border-surface-light"><Clock className="w-2.5 h-2.5" /> Standby</div>;

    if (health >= 85) return <div className="flex items-center gap-2 bg-success/10 px-3 py-1 rounded-none text-success font-black text-[8px] uppercase tracking-widest border border-success/20 shadow-glow-success/5"><ShieldCheck className="w-2.5 h-2.5" /> Optimized</div>;

    // Identify Cause
    let cause = "Investigate";
    if (well.health.pump !== 'normal') cause = `Pump: ${well.health.pump.toUpperCase()}`;
    else if (well.health.motor !== 'normal') cause = `Motor: ${well.health.motor.toUpperCase()}`;
    else if (well.health.cable !== 'normal') cause = `Cable: ${well.health.cable.toUpperCase()}`;
    else if (well.productionTest.pip < 100) cause = "CRITICAL: PIP < 100";
    else if (well.productionTest.pip < 300) cause = "Approaching PIP Limit";
    else if (well.consumptionReal > well.consumptionTheo * 1.25) cause = "Overload";
    else if (well.currentRate < (well as any).minQ * 1.1) cause = "Near Downthrust";
    else if (well.currentRate > (well as any).maxQ * 0.9) cause = "Near Upthrust";

    return <div className={`flex items-center gap-2 ${health < 40 ? 'bg-danger/10 text-danger border-danger/20' : 'bg-warning/10 text-warning border-warning/20'} px-3 py-1 rounded-none font-black text-[8px] uppercase tracking-widest border animate-pulse`}>
        <AlertTriangle className="w-2.5 h-2.5" /> {cause}
    </div>;
};

export const PredictiveMiniWidget = React.memo(({ label, status, desc }: any) => {
    const statusConfig: any = {
        optimal: { color: 'text-success', bg: 'bg-success', glow: 'shadow-glow-success' },
        caution: { color: 'text-warning', bg: 'bg-warning', glow: 'shadow-glow-warning/30' },
        alert: { color: 'text-danger', bg: 'bg-danger', glow: 'shadow-glow-danger' }
    };
    const config = statusConfig[status] || statusConfig.optimal;
    return (
        <div className="flex items-center justify-between p-5 bg-canvas/40 backdrop-blur-md rounded-none border border-white/5 hover:border-primary/30 transition-all group cursor-default shadow-lg relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bg} opacity-50`}></div>
            <div className="flex items-center gap-5 relative z-10">
                <div className={`w-3 h-3 rounded-none ${config.bg} ${config.glow} shadow-sm transition-transform`}></div>
                <div>
                    <span className="text-[11px] font-black text-txt-main uppercase tracking-widest opacity-90">{label}</span>
                    <p className="text-[10px] font-bold text-txt-muted uppercase opacity-40 tracking-tighter mt-0.5 group-hover:opacity-80 transition-opacity">{desc}</p>
                </div>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${config.color} opacity-80 bg-white/5 px-3 py-1 rounded-lg border border-white/5`}>{status}</span>
        </div>
    );
});

export const CompValueCard = React.memo(({ label, design, actual, unit }: any) => {
    const diff = design !== 0 ? ((actual - design) / design) * 100 : 0;
    const isGood = Math.abs(diff) < 10;
    return (
        <div className="glass-surface p-7 rounded-none border border-white/5 group hover:border-primary/40 transition-all relative overflow-hidden shadow-2xl">
            <div className={`absolute top-0 right-0 w-24 h-24 ${isGood ? 'bg-success/5' : 'bg-danger/5'} blur-[30px] rounded-none`}></div>
            <div className="flex justify-between items-start mb-5 relative z-10">
                <span className="text-[11px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-50">{label}</span>
                <div className={`px-3 py-1 rounded-none text-[9px] font-black border ${isGood ? 'bg-success/10 text-success border-success/20 shadow-glow-success/10' : 'bg-danger/10 text-danger border-danger/20 shadow-glow-danger/10'}`}>
                    {Math.abs(diff).toFixed(1)}% {diff > 0 ? 'UP' : 'DN'}
                </div>
            </div>
            <div className="flex items-baseline gap-3 relative z-10">
                <span className="text-3xl font-black text-txt-main tracking-tighter drop-shadow-sm">{actual?.toFixed(0)}</span>
                <span className="text-[10px] font-black text-txt-muted uppercase opacity-40">{unit}</span>
            </div>
            <div className="mt-4 flex items-center gap-3 relative z-10 bg-canvas/40 p-2.5 rounded-none border border-white/5 w-fit">
                <span className="text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-30">Goal:</span>
                <span className="text-[11px] font-black text-primary font-mono">{design?.toFixed(0)}</span>
            </div>
        </div>
    );
});

export const DiagnosticRow = React.memo(({ label, unit, theoretical, real, lowIsBad = false, noDiff = false }: any) => {
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
                <div className={`inline-block w-4 h-4 rounded-none ${isBad ? 'bg-danger shadow-glow-danger/60 animate-pulse' : 'bg-success shadow-glow-success/40'} border-2 border-white/10 shadow-lg`}></div>
            </td>
        </tr>
    );
});

