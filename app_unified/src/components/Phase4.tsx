
import React from 'react';
import { SystemParams } from '../types';
import { calculateSystemResults } from '../utils';
import { Gauge, ArrowDown, Activity, Droplets, Layers, ChevronRight, Thermometer, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    results: any;
}

// --- SUB-COMPONENTS ---

const PressureCard = ({ label, value, unit, onChange, color = "primary", icon: Icon }: any) => (
    <div className={`bg-surface p-4 rounded-xl border border-white/5 shadow-md relative overflow-hidden group hover:border-${color}-500/50 transition-all`}>
        <div className={`absolute top-0 right-0 p-2 opacity-10 bg-${color}-500 rounded-bl-xl transition-opacity group-hover:opacity-20`}>
            {Icon && <Icon className={`w-6 h-6 text-${color}-400`} />}
        </div>
        <label className="text-[10px] font-black text-txt-muted uppercase tracking-widest block mb-1.5 group-hover:text-${color}-400 transition-colors">{label}</label>
        <div className="flex items-baseline gap-2 relative z-10">
            <input
                type="number"
                value={value}
                onChange={onChange}
                className={`w-full bg-transparent text-2xl font-black text-txt-main outline-none focus:text-${color}-400 transition-colors placeholder-surface-light font-mono`}
            />
            <span className="text-[10px] font-black text-txt-muted uppercase tracking-wider">{unit}</span>
        </div>
    </div>
);

const SchematicTag = ({ label, value, unit, color = "white", top, align = "right", alert = false }: { label: string, value: string, unit: string, color?: string, top: string, align?: 'left' | 'right', alert?: boolean }) => (
    <div
        className={`absolute ${align === 'right' ? 'left-[55%]' : 'right-[55%]'} transform -translate-y-1/2 transition-all duration-500 flex items-center z-20 group`}
        style={{ top: top }}
    >
        {/* Connector Line */}
        {align === 'right' && <div className={`w-6 h-px ${alert ? 'bg-red-500' : 'bg-surface-light group-hover:bg-' + color + '-500'} transition-colors`}></div>}

        {/* Tag */}
        <div className={`bg-surface border ${alert ? 'border-red-500 animate-pulse' : 'border-white/10'} p-3 ${align === 'right' ? 'pl-4 pr-5 rounded-r-xl rounded-bl-xl border-l-0' : 'pr-4 pl-5 rounded-l-xl rounded-br-xl text-right border-r-0'} shadow-lg flex flex-col min-w-[120px] group-hover:border-${color}-500 transition-colors relative`}>
            <div className={`absolute ${align === 'right' ? 'left-0' : 'right-0'} top-0 bottom-0 w-0.5 bg-${alert ? 'red' : color}-500`}></div>
            <div className="flex items-center gap-2 justify-end mb-0.5">
                {alert && <AlertCircle className="w-4 h-4 text-red-500" />}
                <span className={`text-[10px] font-black ${alert ? 'text-danger' : 'text-txt-muted'} uppercase tracking-widest`}>{label}</span>
            </div>
            <div className={`text-base font-black text-white font-mono`}>
                {value} <span className="text-[10px] font-bold text-txt-muted ml-0.5">{unit}</span>
            </div>
        </div>

        {/* Connector Line Left */}
        {align === 'left' && <div className={`w-6 h-px ${alert ? 'bg-red-500' : 'bg-surface-light group-hover:bg-' + color + '-500'} transition-colors`}></div>}
    </div>
);

export const Phase4: React.FC<Props> = ({ params, setParams, results }) => {
    const { t } = useLanguage();
    const totalDepth = params.totalDepthMD || 5000;

    // Scale Logic
    const getPct = (md: number) => {
        const pct = (md / totalDepth) * 90; // Uses 90% of height
        return `${5 + pct}%`;
    };

    const fluidLvl = results.fluidLevel ?? (params.pressures.pumpDepthMD - 500);
    const fluidPct = getPct(fluidLvl);
    const pumpPct = getPct(params.pressures.pumpDepthMD);
    const perfsPct = getPct(params.wellbore.midPerfsMD);

    // Temperature Estimation
    const intakeTemp = params.bottomholeTemp;
    const motorRise = (results.motorLoad || 50) * 0.8;
    const motorTemp = intakeTemp + motorRise;
    const isMotorHot = motorTemp > 300; // Smart Alert Threshold

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-160px)] animate-fadeIn pb-2">

            {/* LEFT COLUMN: CONTROL DECK */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-y-auto pr-2 custom-scrollbar">

                {/* 1. MASTER CONTROL */}
                <div className="bg-surface p-5 rounded-3xl border border-white/5 shadow-md space-y-3">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-primary text-white shadow-sm">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-widest leading-none">{t('p4.prodTarget')}</h3>
                            <p className="text-xs font-bold text-txt-muted uppercase mt-0.5 tracking-wider">{t('p4.desiredFlow')}</p>
                        </div>
                    </div>

                    <div className="bg-canvas rounded-xl border border-white/5 p-3 flex flex-col items-center justify-center gap-1 relative group focus-within:border-primary transition-colors">
                        <div className="flex items-baseline justify-center gap-1 w-full">
                            <input
                                type="number"
                                value={params.pressures.totalRate || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    setParams({
                                        ...params,
                                        pressures: {
                                            ...params.pressures,
                                            totalRate: val === '' ? 0 : parseFloat(val)
                                        }
                                    });
                                }}
                                className="w-full bg-transparent text-5xl font-black text-primary text-center outline-none placeholder-surface-light z-10 font-mono"
                                placeholder="0"
                            />
                        </div>
                        <span className="text-[10px] font-black text-txt-muted uppercase tracking-[0.4em]">{t('p4.bpdTotal')}</span>
                    </div>

                    <div className="px-1">
                        <input
                            type="range"
                            min="100" max="10000" step="100"
                            value={params.pressures.totalRate || 0}
                            onChange={e => setParams({ ...params, pressures: { ...params.pressures, totalRate: parseFloat(e.target.value) } })}
                            className="w-full h-1.5 bg-surface-light rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between mt-1 text-[10px] font-bold text-txt-muted font-mono">
                            <span>100</span>
                            <span>10,000</span>
                        </div>
                    </div>
                </div>

                {/* 2. SURFACE PRESSURES */}
                <div className="grid grid-cols-2 gap-4">
                    <PressureCard
                        label={t('p3.thp')}
                        value={params.pressures.pht}
                        unit="psi"
                        color="primary"
                        icon={Gauge}
                        onChange={(e: any) => setParams({ ...params, pressures: { ...params.pressures, pht: parseFloat(e.target.value) } })}
                    />
                    <PressureCard
                        label={t('p3.chp')}
                        value={params.pressures.phc}
                        unit="psi"
                        color="secondary"
                        icon={Gauge}
                        onChange={(e: any) => setParams({ ...params, pressures: { ...params.pressures, phc: parseFloat(e.target.value) } })}
                    />
                </div>

                {/* 3. KEY METRICS SUMMARY */}
                <div className="bg-canvas rounded-3xl p-5 text-white flex-1 flex flex-col justify-start relative overflow-hidden shadow-xl border border-white/5 min-h-[300px]">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                    <h4 className="text-[10px] font-black text-txt-muted uppercase tracking-widest mb-4 border-b border-white/10 pb-2 z-10">{t('p4.calcMetrics')}</h4>

                    <div className="space-y-4 z-10 overflow-y-auto custom-scrollbar pr-2">

                        {/* Hydraulics */}
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
                                    <ArrowDown className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-txt-muted uppercase group-hover:text-primary transition-colors tracking-widest">{t('p3.pip')}</div>
                                    <div className="text-[10px] text-primary/60 font-bold">{t('p4.pipDesc')}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-black text-primary tracking-tighter font-mono">{results.pip?.toFixed(0)}</span>
                                <span className="text-[10px] text-txt-muted font-black uppercase">PSI</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 shadow-inner">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-txt-muted uppercase group-hover:text-primary transition-colors tracking-widest">{t('tele.head')}</div>
                                    <div className="text-[10px] text-primary/70 font-bold">{t('p4.tdhDesc')}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-black text-secondary tracking-tighter font-mono">{results.tdh?.toFixed(0)}</span>
                                <span className="text-[10px] text-txt-muted font-black uppercase">FT</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-surface-light text-txt-muted border border-surface-light shadow-inner">
                                    <Droplets className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-txt-muted uppercase group-hover:text-txt-main transition-colors tracking-widest">{t('p4.fluidAbove')}</div>
                                    <div className="text-[10px] text-txt-muted/60 font-bold">{t('tele.sub')}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-black text-txt-main tracking-tighter font-mono">{(params.pressures.pumpDepthMD - results.fluidLevel).toFixed(0)}</span>
                                <span className="text-[10px] text-txt-muted font-black uppercase">FT</span>
                            </div>
                        </div>

                        {/* Thermal Status Section */}
                        <div className="border-t border-surface-light pt-4 mt-2">
                            <h5 className="text-[10px] font-black text-txt-muted uppercase tracking-widest mb-3">{t('p4.thermal')}</h5>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-surface p-3 rounded-xl border border-surface-light flex items-center justify-between shadow-inner">
                                    <div className="flex items-center gap-2">
                                        <Thermometer className="w-4 h-4 text-orange-500" />
                                        <span className="text-[10px] font-black text-txt-muted uppercase tracking-wider">{t('p4.intake')}</span>
                                    </div>
                                    <div className="font-mono text-base font-black text-white">{intakeTemp.toFixed(0)}°F</div>
                                </div>
                                <div className={`bg-surface p-3 rounded-xl border ${isMotorHot ? 'border-red-500/50 bg-red-900/20' : 'border-surface-light'} flex items-center justify-between transition-colors shadow-inner`}>
                                    <div className="flex items-center gap-2">
                                        <Thermometer className={`w-4 h-4 ${isMotorHot ? 'text-danger animate-pulse' : 'text-danger/60'}`} />
                                        <span className="text-[10px] font-black text-txt-muted uppercase tracking-wider">{t('p4.motor')}</span>
                                    </div>
                                    <div className={`font-mono text-base font-black ${isMotorHot ? 'text-red-500' : 'text-red-400'}`}>{motorTemp.toFixed(0)}°F</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* RIGHT COLUMN: VISUAL WELLBORE (FIXED SCHEMATIC) */}
            <div className="lg:col-span-8 bg-canvas rounded-[40px] border border-surface-light shadow-2xl relative overflow-hidden flex flex-col h-full">

                <div className="absolute top-0 left-0 w-full z-10 px-6 py-4 flex justify-between items-start pointer-events-none">
                    <div className="bg-surface px-5 py-2.5 rounded-full border border-surface-light shadow-lg">
                        <span className="text-xs font-black text-txt-muted uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4 text-secondary" /> {t('p4.schematic')}
                        </span>
                    </div>
                    <div className="text-xs font-mono font-bold text-txt-muted bg-surface px-3 py-1.5 rounded border border-surface-light">
                        TD: {totalDepth} ft
                    </div>
                </div>

                {/* THE SCHEMATIC CANVAS (100% Height, No Scroll) */}
                <div className="relative w-full h-full bg-[#020617] flex justify-center">

                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

                    {/* Central Wellbore Column */}
                    <div className="relative w-32 h-full bg-surface border-x border-surface-light">

                        {/* 1. SURFACE (Top) */}
                        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-64 border-b-2 border-slate-700 flex justify-center items-end pb-2">
                            <span className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{t('p4.surface')} (0 ft)</span>
                        </div>

                        {/* 2. CASING (Full length implied, but visually distinct) */}
                        <div className="absolute top-[5%] bottom-[5%] left-0 right-0 border-x-2 border-slate-700 bg-black/20"></div>

                        {/* 3. FLUID LEVEL (Annulus Fill) */}
                        <div
                            className="absolute left-0 right-0 bg-gradient-to-b from-blue-900/40 to-blue-900/10 transition-all duration-700 border-t border-blue-500/50"
                            style={{ top: fluidPct, bottom: '5%' }}
                        >
                            <div className="w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
                        </div>

                        {/* 4. TUBING (Inner Pipe) */}
                        <div
                            className="absolute left-1/2 -translate-x-1/2 w-4 bg-slate-700 border-x border-slate-600 z-10"
                            style={{ top: '5%', bottom: `calc(100% - ${pumpPct})` }}
                        ></div>

                        {/* 5. PUMP (Icon) */}
                        <div
                            className="absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-700 w-16 flex items-center justify-center group"
                            style={{ top: pumpPct, transform: 'translate(-50%, -50%)' }}
                        >
                            <div className="bg-slate-800 border border-slate-600 rounded w-6 h-16 shadow-lg flex flex-col justify-evenly items-center relative hover:border-blue-500 hover:shadow-blue-500/20 transition-all">
                                <div className="w-full h-px bg-slate-700"></div>
                                <div className="w-full h-px bg-slate-700"></div>
                                <div className="w-full h-px bg-slate-700"></div>
                                {/* Label */}
                                <span className="absolute left-full ml-4 text-sm font-black text-slate-500 uppercase tracking-widest whitespace-nowrap bg-surface px-3 py-1.5 rounded-xl border border-surface-light shadow-xl">ESP Pump</span>
                            </div>
                        </div>

                        {/* 6. PERFORATIONS (Bottom) */}
                        <div
                            className="absolute left-0 right-0 z-0 flex flex-col gap-1 px-0.5 opacity-60"
                            style={{ top: perfsPct, transform: 'translateY(-50%)' }}
                        >
                            <div className="h-1 w-3 bg-black/50 border border-slate-600 rounded-r self-start"></div>
                            <div className="h-1 w-3 bg-black/50 border border-slate-600 rounded-l self-end"></div>
                            <div className="h-1 w-3 bg-black/50 border border-slate-600 rounded-r self-start"></div>
                            <div className="h-1 w-3 bg-black/50 border border-slate-600 rounded-l self-end"></div>
                        </div>

                        {/* 7. TD Line (Bottom) */}
                        <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-32 border-t-2 border-slate-700 border-dashed flex justify-center pt-2.5">
                            <span className="text-sm font-mono font-black text-slate-600">TD</span>
                        </div>

                    </div>

                    {/* TAGS (Absolute positioning relative to container) */}
                    <SchematicTag
                        top={fluidPct}
                        align="left"
                        label={t('tele.sub')}
                        value={`${fluidLvl.toFixed(0)}`}
                        unit="ft"
                        color="blue"
                    />

                    <SchematicTag
                        top={pumpPct}
                        align="right"
                        label={t('tele.pip')}
                        value={`${results.pip?.toFixed(0)}`}
                        unit="PSI"
                        color="emerald"
                    />

                    <SchematicTag
                        top={perfsPct}
                        align="left"
                        label={t('p3.pwf')}
                        value={`${results.pwf?.toFixed(0)}`}
                        unit="PSI"
                        color="amber"
                    />

                </div>
            </div>
        </div>
    );
};
