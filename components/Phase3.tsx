
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
    <div className="bg-surface border border-surface-light rounded-3xl p-6 flex flex-col justify-between relative group hover:border-txt-muted transition-all h-full">
        <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-bold text-txt-muted uppercase tracking-wider group-hover:text-txt-main transition-colors">{label}</label>
            {Icon && <Icon className={`w-6 h-6 text-primary opacity-70`} />}
        </div>
        <div className="flex items-baseline gap-3">
            <input
                type="number"
                step={step}
                value={value}
                onChange={onChange}
                className="w-full bg-transparent text-3xl font-black text-txt-main outline-none placeholder-surface-light font-mono"
            />
            <span className="text-xs font-bold text-txt-muted uppercase select-none px-2 py-1 rounded bg-canvas border border-surface-light">{unit}</span>
        </div>
    </div>
);

const ResultMetric = ({ label, value, unit, subtext, color = "emerald", icon: Icon }: any) => (
    <div className={`bg-canvas/50 rounded-3xl border border-surface-light p-6 flex items-center justify-between relative overflow-hidden group h-full`}>
        <div className={`absolute left-0 top-0 bottom-0 w-2 bg-${color}-500/50 group-hover:bg-${color}-500 transition-colors`}></div>
        <div>
            <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold text-txt-muted uppercase tracking-wider">{label}</span>
                {subtext && <span className="text-xs font-mono text-txt-muted bg-surface px-2 py-1 rounded border border-surface-light">{subtext}</span>}
            </div>
            <div className="flex items-baseline gap-3">
                <span className={`text-5xl font-black text-${color}-400 font-mono tracking-tight`}>{value}</span>
                <span className="text-base font-bold text-txt-muted">{unit}</span>
            </div>
        </div>
        {Icon && <div className={`p-4 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-500`}><Icon className="w-10 h-10" /></div>}
    </div>
);

export const Phase3: React.FC<Props> = ({ params, setParams, results }) => {
    const { t } = useLanguage();
    const iprData = useMemo(() => generateIPRData(params), [params]);
    const aof = calculateAOF(params);
    const opPoint = { flow: params.pressures.totalRate, pwf: results.pwf || 0 };

    // Smart Warning
    const showPumpOffWarning = params.pressures.totalRate > aof;

    // Theme Variables
    const colorPrimary = 'rgb(var(--color-primary))';
    const colorSecondary = 'rgb(var(--color-secondary))';
    const colorTextMuted = 'rgb(var(--color-text-muted))';
    const colorGrid = 'rgb(var(--color-surface-light))';

    return (
        <div className="flex flex-col lg:flex-row gap-10 h-[calc(100vh-140px)] pb-6 overflow-hidden">
            
            {/* LEFT COLUMN */}
            <div className="flex-1 flex flex-col gap-8 min-w-0 bg-surface/50 rounded-[48px] border border-surface-light p-10 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-primary/20 rounded-2xl text-primary border border-primary/30"><Activity className="w-8 h-8" /></div>
                        <h3 className="text-2xl font-black text-txt-main uppercase tracking-wide">{t('p3.inflow')}</h3>
                    </div>
                    <div className="bg-canvas px-6 py-3 rounded-full border border-surface-light shadow-lg">
                        <span className="text-xs font-bold text-txt-muted uppercase">{t('p3.calcAof')}: <span className="text-txt-main font-mono ml-2 text-lg">{aof.toLocaleString(undefined, {maximumFractionDigits:0})} BPD</span></span>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                    <div className="col-span-2 bg-surface border border-surface-light rounded-3xl p-3 flex shadow-sm">
                        {['Productivity Index', 'Vogel'].map((m) => (
                            <button key={m} onClick={() => setParams({ ...params, inflow: { ...params.inflow, model: m as any } })} className={`flex-1 py-4 text-sm font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-3 ${params.inflow.model === m ? 'bg-primary text-white shadow-md' : 'text-txt-muted hover:text-txt-main hover:bg-surface-light'}`}>
                                {m === 'Productivity Index' ? t('p3.piModel') : t('p3.vogel')}
                            </button>
                        ))}
                    </div>
                    <CompactInput label={t('p3.resPres')} value={params.inflow.pStatic} unit="psi" step="10" icon={Gauge} colorClass="primary" onChange={(e: any) => setParams({ ...params, inflow: { ...params.inflow, pStatic: parseFloat(e.target.value) } })} />
                    <CompactInput label={t('p3.pi')} value={params.inflow.ip} unit="bpd/psi" step="0.1" icon={TrendingUp} colorClass="secondary" onChange={(e: any) => setParams({ ...params, inflow: { ...params.inflow, ip: parseFloat(e.target.value) } })} />
                </div>
                
                <div className="flex-1 min-h-[350px] bg-canvas rounded-3xl border border-surface-light shadow-inner relative overflow-hidden flex flex-col p-6">
                    <div className="absolute top-8 left-10 z-10 pointer-events-none opacity-60"><span className="text-sm font-black text-txt-muted uppercase">{t('p3.iprVis')}</span></div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={iprData} margin={{ top: 50, right: 40, left: 20, bottom: 40 }}>
                            <defs><linearGradient id="iprGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colorPrimary} stopOpacity={0.3} /><stop offset="95%" stopColor={colorPrimary} stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} vertical={false} opacity={0.5} />
                            <XAxis dataKey="flow" type="number" tick={{ fontSize: 14, fontWeight: 700, fill: colorTextMuted }} axisLine={{ stroke: colorGrid }} tickLine={false} />
                            <YAxis tick={{ fontSize: 14, fontWeight: 700, fill: colorTextMuted }} axisLine={false} tickLine={false} width={60} />
                            <Tooltip cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'rgba(var(--color-surface), 0.9)', borderColor: 'rgba(var(--color-surface-light), 1)', borderRadius: '16px', fontSize: '14px', fontWeight: 'bold' }} itemStyle={{ color: colorSecondary }} />
                            <Area type="monotone" dataKey="pressure" stroke={colorPrimary} strokeWidth={5} fillOpacity={1} fill="url(#iprGradient)" />
                            {opPoint.flow > 0 && <ReferenceDot x={opPoint.flow} y={opPoint.pwf} r={10} fill={colorSecondary} stroke="#fff" strokeWidth={3}><Label value="OP" position="top" fill={colorSecondary} fontSize={14} fontWeight="bold" offset={15} /></ReferenceDot>}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex-1 flex flex-col gap-8 min-w-0 bg-surface/50 rounded-[48px] border border-surface-light p-10 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-secondary/20 rounded-2xl text-secondary border border-secondary/30"><Settings2 className="w-8 h-8" /></div>
                        <h3 className="text-2xl font-black text-txt-main uppercase tracking-wide">{t('p3.ops')}</h3>
                    </div>
                </div>
                
                {showPumpOffWarning && (
                    <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-3xl flex items-center gap-4 animate-pulse">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                        <div>
                            <h4 className="text-sm font-black text-red-400 uppercase tracking-wider">{t('ai.critical')}</h4>
                            <p className="text-xs font-medium text-red-200/80">{t('ai.pumpOff')}</p>
                        </div>
                    </div>
                )}

                <div className="bg-surface border border-surface-light rounded-3xl p-8 shadow-lg">
                    <div className="flex justify-between items-center mb-6">
                        <label className="text-base font-bold text-txt-muted uppercase flex items-center gap-4"><Target className="w-6 h-6 text-primary" /> {t('p3.target')}</label>
                        <div className="bg-canvas px-6 py-3 rounded-2xl border border-surface-light flex items-baseline gap-3 shadow-inner">
                            <input type="number" value={params.pressures.totalRate || ''} onChange={e => { const val = e.target.value; setParams({ ...params, pressures: { ...params.pressures, totalRate: val === '' ? 0 : parseFloat(val) } }); }} className="bg-transparent w-40 text-right text-4xl font-black text-primary outline-none font-mono" />
                            <span className="text-sm font-bold text-txt-muted">BPD</span>
                        </div>
                    </div>
                    <input type="range" min="100" max="10000" step="100" value={params.pressures.totalRate || 0} onChange={e => setParams({ ...params, pressures: { ...params.pressures, totalRate: parseFloat(e.target.value) } })} className="w-full h-5 bg-surface-light rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary/80" />
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                    <CompactInput label={t('p3.thp')} value={params.pressures.pht} unit="psi" icon={ArrowDownToLine} colorClass="primary" onChange={(e: any) => setParams({ ...params, pressures: { ...params.pressures, pht: parseFloat(e.target.value) } })} />
                    <CompactInput label={t('p3.chp')} value={params.pressures.phc} unit="psi" icon={ArrowDownToLine} colorClass="secondary" onChange={(e: any) => setParams({ ...params, pressures: { ...params.pressures, phc: parseFloat(e.target.value) } })} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2 flex-1">
                    <ResultMetric label={t('p3.pip')} value={results.pip?.toFixed(0) || '--'} unit="psi" subtext="PIP" color="emerald" icon={ArrowDown} />
                    <ResultMetric label={t('tele.head')} value={results.tdh?.toFixed(0) || '--'} unit="ft" subtext="TDH" color="blue" icon={Layers} />
                    <ResultMetric label={t('p3.pwf')} value={results.pwf?.toFixed(0) || '--'} unit="psi" subtext="Pwf" color="amber" icon={Gauge} />
                    <ResultMetric label={t('p4.fluidAbove')} value={(params.pressures.pumpDepthMD - results.fluidLevel).toFixed(0)} unit="ft" subtext={t('tele.sub')} color="indigo" icon={Droplets} />
                </div>
            </div>
        </div>
    );
};
