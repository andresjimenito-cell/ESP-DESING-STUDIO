
import React, { useMemo } from 'react';
import { TrendingUp, Activity, Gauge, Zap, ArrowDownToLine, MousePointerClick, Layers, Droplets, ArrowDown, Settings2, Target, AlertTriangle } from 'lucide-react';
import { SystemParams } from '../types';
import { generateIPRData, calculateAOF } from '../utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Label, Tooltip, ReferenceLine, ReferenceDot } from 'recharts';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    results: any;
}

const CompactInput = ({ label, value, unit, onChange, step = "any", icon: Icon, colorClass = "primary" }: any) => (
    <div className="glass-surface border border-white/5 rounded-[2rem] p-5 flex flex-col justify-between relative group hover:border-primary/40 transition-all h-full overflow-hidden shadow-xl light-sweep">
        <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass === 'primary' ? 'bg-primary/10 shadow-glow-primary' : 'bg-secondary/10 shadow-glow-secondary'} rounded-full blur-3xl -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}></div>

        <div className="flex justify-between items-center mb-4 relative z-10">
            <label className="text-[10px] font-black text-txt-muted uppercase tracking-[0.2em] group-hover:text-primary transition-colors">{label}</label>
            {Icon && <Icon className={`w-6 h-6 ${colorClass === 'primary' ? 'text-primary shadow-glow-primary' : 'text-secondary shadow-glow-secondary'} opacity-70 group-hover:scale-110 transition-transform duration-500`} />}
        </div>
        <div className="flex items-baseline gap-2 relative z-10">
            <input
                type="number"
                step={step}
                value={value}
                onChange={onChange}
                className="w-full bg-transparent text-3xl font-black text-txt-main outline-none placeholder-surface-light/40 font-mono tracking-tighter"
            />
            <span className="text-[9px] font-black text-txt-muted uppercase select-none px-3 py-1.5 rounded-xl glass-surface-light border border-white/5 shadow-inner backdrop-blur-sm">{unit}</span>
        </div>
    </div>
);

// Variant map — safe static classes, no dynamic interpolation
const RESULT_METRIC_VARIANTS: Record<string, { bar: string; bg: string; text: string; icon: string }> = {
    primary: { bar: 'bg-primary', bg: 'bg-primary/10 border-primary/20', text: 'text-primary', icon: 'bg-primary/10 border-primary/20 text-primary' },
    secondary: { bar: 'bg-secondary', bg: 'bg-secondary/10 border-secondary/20', text: 'text-secondary', icon: 'bg-secondary/10 border-secondary/20 text-secondary' },
    muted: { bar: 'bg-txt-muted', bg: 'bg-surface-light border-surface-light', text: 'text-txt-main', icon: 'bg-surface-light border-surface-light text-txt-muted' },
};

const ResultMetric = ({ label, value, unit, subtext, variant = "primary", icon: Icon }: any) => {
    const v = RESULT_METRIC_VARIANTS[variant] ?? RESULT_METRIC_VARIANTS.primary;
    const isPrimary = variant === 'primary';
    const isSecondary = variant === 'secondary';

    return (
        <div className={`glass-surface rounded-[2rem] border border-white/5 p-5 flex items-center justify-between relative overflow-hidden group h-full shadow-2xl transition-all duration-700 hover:border-primary/30 light-sweep`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${v.bar} opacity-40 group-hover:opacity-100 transition-all duration-700 ${isPrimary ? 'shadow-glow-primary' : isSecondary ? 'shadow-glow-secondary' : ''}`}></div>
            <div className={`absolute inset-0 bg-gradient-to-r ${isPrimary ? 'from-primary/5' : isSecondary ? 'from-secondary/5' : 'from-white/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}></div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-[0.2em]">{label}</span>
                    {subtext && <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-lg glass-surface border border-white/10 ${v.text}`}>{subtext}</span>}
                </div>
                <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black ${v.text} font-mono tracking-tighter drop-shadow-md`}>{value}</span>
                    <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest">{unit}</span>
                </div>
            </div>
            {Icon && <div className={`p-4 rounded-2xl ${v.icon} shadow-glow-primary group-hover:scale-110 transition-transform duration-700 relative z-10`}><Icon className="w-8 h-8" /></div>}
        </div>
    );
};

export const Phase3: React.FC<Props> = ({ params, setParams, results }) => {
    const { t } = useLanguage();
    const iprData = useMemo(() => generateIPRData(params), [params]);
    const aof = calculateAOF(params);
    const opPoint = { flow: params.pressures.totalRate, pwf: results.pwf || 0 };

    const showPumpOffWarning = params.pressures.totalRate > aof;

    const colorPrimary = 'rgb(var(--color-primary))';
    const colorSecondary = 'rgb(var(--color-secondary))';
    const colorTextMuted = 'rgb(var(--color-text-muted))';
    const colorGrid = 'rgb(var(--color-surface-light))';

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] pb-4 overflow-hidden relative">

            {/* LEFT COLUMN */}
            <div className="flex-1 flex flex-col gap-6 min-w-0 glass-surface rounded-[2.5rem] border border-white/5 p-8 overflow-y-auto custom-scrollbar shadow-2xl animate-fadeIn relative overflow-hidden" style={{ animationDelay: '0.1s' }}>
                <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--color-primary)/0.02)_1px,transparent_1px)] bg-[size:100%_40px] pointer-events-none"></div>
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/20 rounded-xl text-primary border border-primary/30 shadow-sm"><Activity className="w-6 h-6" /></div>
                        <h3 className="text-lg font-black text-txt-main uppercase tracking-wide">{t('p3.inflow')}</h3>
                    </div>
                    <div className="bg-canvas px-4 py-2 rounded-full border border-white/5 shadow-md">
                        <span className="text-xs font-bold text-txt-muted uppercase tracking-widest">{t('p3.calcAof')}: <span className="text-txt-main font-black font-mono ml-2 text-lg">{aof.toLocaleString(undefined, { maximumFractionDigits: 0 })} BPD</span></span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 bg-surface border border-white/10 rounded-2xl p-2 flex shadow-inner">
                        {['Productivity Index', 'Vogel'].map((m) => (
                            <button key={m} onClick={() => setParams({ ...params, inflow: { ...params.inflow, model: m as any } })} className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${params.inflow.model === m ? 'bg-primary text-white shadow-md' : 'text-txt-muted hover:text-txt-main hover:bg-surface-light/50'}`}>
                                {m === 'Productivity Index' ? t('p3.piModel') : t('p3.vogel')}
                            </button>
                        ))}
                    </div>
                    <CompactInput label={t('p3.resPres')} value={params.inflow.pStatic} unit="psi" step="10" icon={Gauge} colorClass="primary" onChange={(e: any) => setParams({ ...params, inflow: { ...params.inflow, pStatic: parseFloat(e.target.value) } })} />
                    <CompactInput label={t('p3.pi')} value={params.inflow.ip} unit="bpd/psi" step="0.1" icon={TrendingUp} colorClass="secondary" onChange={(e: any) => setParams({ ...params, inflow: { ...params.inflow, ip: parseFloat(e.target.value) } })} />
                </div>

                <div className="flex-1 min-h-[350px] glass-surface-light rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col p-6 group">
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(var(--color-primary),0.15) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(var(--color-primary),0.02)_50%)] bg-[size:100%_4px] pointer-events-none opacity-40"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none"></div>
                    <div className="absolute top-6 left-8 z-10 pointer-events-none"><span className="text-[10px] font-black text-txt-muted uppercase tracking-[0.3em] opacity-60">IPR PERFORMANCE MATRIX</span></div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={iprData} margin={{ top: 40, right: 30, left: 10, bottom: 30 }}>
                            <defs>
                                <linearGradient id="iprGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colorPrimary} stopOpacity={0.4} /><stop offset="95%" stopColor={colorPrimary} stopOpacity={0} /></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} vertical={false} opacity={0.2} />
                            <XAxis dataKey="flow" type="number" tick={{ fontSize: 11, fontWeight: 700, fill: colorTextMuted }} axisLine={{ stroke: colorGrid }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: colorTextMuted }} axisLine={false} tickLine={false} width={45} />
                            <Tooltip cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'rgb(var(--color-surface) / 0.9)', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', backdropFilter: 'blur(12px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }} itemStyle={{ color: colorSecondary }} />
                            <Area type="monotone" dataKey="pressure" stroke={colorPrimary} strokeWidth={4} fillOpacity={1} fill="url(#iprGradient)" animationDuration={1000} />
                            {opPoint.flow > 0 && <ReferenceDot x={opPoint.flow} y={opPoint.pwf} r={6} fill={colorSecondary} stroke="#fff" strokeWidth={2}><Label value="OP" position="top" fill={colorSecondary} fontSize={11} fontWeight="bold" offset={10} /></ReferenceDot>}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex-1 flex flex-col gap-4 min-w-0 glass-surface rounded-[40px] border border-white/5 p-6 overflow-y-auto custom-scrollbar shadow-2xl animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-secondary/20 rounded-xl text-secondary border border-secondary/30 shadow-sm"><Settings2 className="w-6 h-6" /></div>
                        <h3 className="text-lg font-black text-txt-main uppercase tracking-wide">{t('p3.ops')}</h3>
                    </div>
                </div>

                {showPumpOffWarning && (
                    <div className="bg-danger/10 border border-danger/20 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                        <AlertTriangle className="w-6 h-6 text-danger" />
                        <div>
                            <h4 className="text-xs font-black text-danger uppercase tracking-widest mb-0.5">{t('ai.critical')}</h4>
                            <p className="text-[11px] font-bold text-txt-muted">{t('ai.pumpOff')}</p>
                        </div>
                    </div>
                )}

                <div className="bg-surface border border-white/5 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-5 relative z-10">
                        <label className="text-base font-black text-txt-muted uppercase flex items-center gap-4 tracking-widest"><Target className="w-6 h-6 text-primary" /> {t('p3.target')}</label>
                        <div className="bg-canvas px-4 py-2 rounded-xl border border-white/5 flex items-baseline gap-2 shadow-inner">
                            <input type="number" value={params.pressures.totalRate || ''} onChange={e => { const val = e.target.value; setParams({ ...params, pressures: { ...params.pressures, totalRate: val === '' ? 0 : parseFloat(val) } }); }} className="bg-transparent w-28 text-right text-3xl font-black text-primary outline-none font-mono" />
                            <span className="text-xs font-black text-txt-muted tracking-widest">BPD</span>
                        </div>
                    </div>
                    <input type="range" min="100" max="10000" step="100" value={params.pressures.totalRate || 0} onChange={e => setParams({ ...params, pressures: { ...params.pressures, totalRate: parseFloat(e.target.value) } })} className="w-full h-3 bg-surface-light rounded-full appearance-none cursor-pointer accent-primary" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <CompactInput label={t('p3.thp')} value={params.pressures.pht} unit="psi" icon={ArrowDownToLine} colorClass="primary" onChange={(e: any) => setParams({ ...params, pressures: { ...params.pressures, pht: parseFloat(e.target.value) } })} />
                    <CompactInput label={t('p3.chp')} value={params.pressures.phc} unit="psi" icon={ArrowDownToLine} colorClass="secondary" onChange={(e: any) => setParams({ ...params, pressures: { ...params.pressures, phc: parseFloat(e.target.value) } })} />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2 flex-1">
                    <ResultMetric label={t('p3.pip')} value={results.pip?.toFixed(0) || '--'} unit="psi" subtext="PIP" variant="primary" icon={ArrowDown} />
                    <ResultMetric label={t('tele.head')} value={results.tdh?.toFixed(0) || '--'} unit="ft" subtext="TDH" variant="secondary" icon={Layers} />
                    <ResultMetric label={t('p3.pwf')} value={results.pwf?.toFixed(0) || '--'} unit="psi" subtext="Pwf" variant="muted" icon={Gauge} />
                    <ResultMetric label={t('p4.fluidAbove')} value={(params.pressures.pumpDepthMD - results.fluidLevel).toFixed(0)} unit="ft" subtext={t('tele.sub')} variant="muted" icon={Droplets} />
                </div>
            </div>
        </div>
    );
};
