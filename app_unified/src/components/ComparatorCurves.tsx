import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceDot, Label, Legend
} from 'recharts';
import {
    generateMultiCurveData,
    findIntersection,
    calculateSystemResults,
    calculatePIP,
    calculatePDP,
    calculateBaseHead,
    calculateSystemTDH,
    calculateAOF,
    calculateAffinityHead,
    calculateFluidProperties,
    calculateBhpAtPoint,
    calculateScenarioResults,
    getDesignStyle,
    getDownloadFilename
} from '../utils';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme';
import { BarChart3, Activity, Cpu, DollarSign, Droplets, Zap, Lightbulb, ShieldCheck, Thermometer, Gauge, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

// @ts-ignore
import analyzerHtmlStr from '../../public/analyzer.html?raw';

// ── PALETTE ──────────────────────────────────────────────────────────────────
const DEFAULT_DC = [
    { b: '#3b82f6', bg: 'rgba(59,130,246,0.07)', label: 'Design A' },
    { b: '#f59e0b', bg: 'rgba(245,158,11,0.07)', label: 'Design B' },
    { b: '#10b981', bg: 'rgba(16,185,129,0.07)', label: 'Design C' },
    { b: '#a855f7', bg: 'rgba(168,85,247,0.07)', label: 'Design D' },
];

export const DC = DEFAULT_DC; // Export for compatibility, but prefer dynamic styling inside hooks.

const HZ_DASH: Record<string, string | undefined> = {
    hz30: '2 4', hz40: '6 3', hz50: '4 2', hz60: undefined, hz70: '8 2',
};
const HZ_OPACITY: Record<string, number> = {
    hz30: 0.15, hz40: 0.2, hz50: 0.25, hz60: 0.35, hz70: 0.2,
};
const HZ_W: Record<string, number> = {
    hz30: 0.8, hz40: 0.8, hz50: 0.9, hz60: 1, hz70: 0.9,
};
const STD_HZ = ['hz30', 'hz40', 'hz50', 'hz60', 'hz70'];
const SCENARIO_KEYS = ['min', 'target', 'max'] as const;
type SK = typeof SCENARIO_KEYS[number];

const SC_META: Record<SK, { dash?: string; r: number; lbl: string }> = {
    min: { dash: '6 3', r: 4, lbl: 'MIN' },
    target: { dash: undefined, r: 7, lbl: 'TGT' },
    max: { dash: '3 2', r: 4, lbl: 'MAX' },
};

const f0 = (v: any) => (typeof v === 'number' && !isNaN(v) && isFinite(v) ? v.toFixed(0) : '—');
const f1 = (v: any) => (typeof v === 'number' && !isNaN(v) && isFinite(v) ? v.toFixed(1) : '—');

function getScenarioParams(params: any, sk: SK): any {
    if (!params) return {};
    const sc = params.targets?.[sk];
    const base = { ...params };
    if (!sc) return base;
    return {
        ...base,
        pressures: { ...base.pressures, totalRate: sc.rate ?? base.pressures?.totalRate ?? 0 },
        inflow: { ...base.inflow, ip: sc.ip ?? base.inflow?.ip ?? 0 },
        fluids: { ...base.fluids, waterCut: sc.waterCut ?? base.fluids?.waterCut ?? 0, gor: sc.gor ?? base.fluids?.gor ?? 0 },
    };
}

interface DesignSnapshot { id: string; fileName: string; params: any; pump: any; results: any; frequency: number; }

// ── TOOLTIP ───────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-surface p-5 text-xs font-bold shadow-2xl min-w-[200px] rounded-2xl border border-white/10">
            <p className="text-txt-muted mb-2 font-black tracking-widest">{Math.round(label)} BPD</p>
            {payload.map((p: any, i: number) => {
                if (p.value == null || isNaN(p.value) || !p.name) return null;
                const isEff = p.name.includes('Eff') || p.name.toLowerCase().includes('efficiency');
                const unit = isEff ? '%' : 'ft';
                return (
                    <div key={i} className="flex justify-between gap-4 py-0.5">
                        <span style={{ color: p.color }} className="truncate max-w-[140px] font-black">{p.name}</span>
                        <span className="text-txt-main font-bold">{Number(p.value).toFixed(isEff ? 1 : 0)} {unit}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ── RANGE LIMITS OVERLAY CHART ────────────────────────────────────────────────
// One chart, two designs, only minLimit and maxLimit lines.
// Each design has its own array from generateMultiCurveData.
// We align by INDEX (positional) — same length arrays (62 pts each).
// Keys: d0_flow, d0_minLimit, d0_maxLimit, d1_flow, d1_minLimit, d1_maxLimit
// XAxis uses d0_flow as scale reference.
// ─────────────────────────────────────────────────────────────────────────────
const RangeLimitsChart = ({ designs, activeSk }: { designs: DesignSnapshot[]; activeSk: SK }) => {
    const { language } = useLanguage();
    const colorText = '#1f2937'; // Charcoal as in user's manual code

    const { chartData, yMax } = useMemo(() => {
        if (!designs.length) return { chartData: [], yMax: 5000 };

        // 1. Setup master flow points based on first design or a fixed range
        // We'll use a range from 0 to 120% of the max BEP to ensure we see enough of the curve
        const maxBep = Math.max(...designs.map(d => d.pump?.bepRate || 3000));
        const limitFlow = maxBep * 1.5;
        const ptsCount = 100;
        const flowStep = limitFlow / ptsCount;

        const masterFlows = Array.from({ length: ptsCount + 1 }, (_, i) => i * flowStep);

        let globalYMax = 500;

        // Track states for truncation logic (once a series hits 0, it stays at null)
        const stopState = designs.map(() => ({ head: false, minLimit: false, maxLimit: false }));

        const finalized = masterFlows.map((f) => {
            const row: any = { flow: f };

            designs.forEach((d, di) => {
                if (!d.pump) return;
                const p = d.pump;
                const sp = getScenarioParams(d.params, activeSk);
                const freq = d.params.targets?.[activeSk]?.frequency ?? d.frequency ?? 60;
                const bf = p.nameplateFrequency || 60;

                const wc = sp.fluids.waterCut / 100;
                const mixSG = (sp.fluids.geWater * wc) + (141.5 / (131.5 + sp.fluids.apiOil) * (1 - wc));

                // 1. Pump Head
                if (!stopState[di].head) {
                    const hVal = calculateAffinityHead(f, freq, bf, p);
                    if (hVal !== null && hVal > 0) {
                        row[`head_${di}`] = hVal;
                        if (hVal > globalYMax) globalYMax = hVal;
                    } else if (f > 0) {
                        stopState[di].head = true; // Truncate from now on
                    }
                }

                // 2. Efficiency
                const bhp = calculateBhpAtPoint(f, freq, bf, p, mixSG);
                const headNow = calculateAffinityHead(f, freq, bf, p) || 0;
                const hhp = (f * headNow * mixSG) / 135770;
                let eff = (bhp > 0) ? (hhp / bhp) * 100 : 0;
                row[`eff_${di}`] = (eff > 0 && eff < 100) ? Number(eff.toFixed(1)) : 0;

                // 3. Min/Max Limits
                const hMinBase = calculateAffinityHead(p.minRate || 0, bf, bf, p) || 0;
                const hMaxBase = calculateAffinityHead(p.maxRate || 0, bf, bf, p) || 0;
                const kMin = p.minRate > 0 ? hMinBase / (p.minRate * p.minRate) : 0;
                const kMax = p.maxRate > 0 ? hMaxBase / (p.maxRate * p.maxRate) : 0;

                // We scale k-constants to friction curves
                const curMin = kMin * f * f;
                const curMax = (kMax > 0 && hMaxBase > 0) ? kMax * f * f : 0;

                // Truncation logic using the already calculated headNow

                if (!stopState[di].minLimit) {
                    const lMin = kMin * f * f;
                    // Truncate if above head
                    if ((lMin > 0 && lMin < headNow) || f === 0) row[`min_${di}`] = lMin;
                    else { stopState[di].minLimit = true; row[`min_${di}`] = null; }
                } else { row[`min_${di}`] = null; }

                if (!stopState[di].maxLimit) {
                    const lMax = kMax * f * f;
                    // Truncate if above head
                    if ((lMax > 0 && lMax < headNow) || f === 0) row[`max_${di}`] = lMax;
                    else { stopState[di].maxLimit = true; row[`max_${di}`] = null; }
                } else { row[`max_${di}`] = null; }
            });
            return row;
        });

        return {
            chartData: finalized,
            yMax: Math.min(10000, Math.ceil((globalYMax * 1.1) / 500) * 500)
        };
    }, [designs, activeSk]);

    if (!chartData.length) return null;

    return (
        <div className="rounded-[32px] border border-surface-light overflow-hidden shadow-2xl bg-surface/50 backdrop-blur-2xl mb-8">
            <div className="px-6 py-8 text-center border-b border-white/5 bg-canvas/40">
                <h1 className="text-3xl font-bold text-blue-500 uppercase tracking-tight mb-2">
                    {language === 'es' ? 'Analizador de Curvas de Bombeo' : 'Pump Curve Analyzer'}
                </h1>
                <h2 className="text-txt-muted text-sm font-medium">
                    {language === 'es' ? 'Doble Eje Y: Cabezal (Izquierda) vs Eficiencia (Derecha)' : 'Dual Y-Axis: Head (Left) vs Efficiency (Right)'}
                </h2>
                <p className="text-xs text-blue-400 mt-2 italic opacity-80">
                    {language === 'es' ? 'Nota: Las series de presión se truncan en 0; las de eficiencia permiten 0.' : 'Note: Head series truncate at 0; efficiency allows 0.'}
                </p>
            </div>

            <div style={{ height: 500, width: '100%', padding: '24px 16px 12px 12px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.07)" vertical={false} />

                        <XAxis
                            type="number"
                            dataKey="flow"
                            domain={[0, 'auto']}
                            tick={{ fontSize: 10, fill: colorText, fontWeight: 'bold' }}
                            tickLine={false} axisLine={false}
                            tickFormatter={f0}
                        >
                            <Label value="Flow (BPD)" position="insideBottom" offset={-10} fontSize={10} fill={colorText} fontWeight="bold" />
                        </XAxis>

                        <YAxis
                            yAxisId="head"
                            domain={[0, yMax]}
                            tick={{ fontSize: 10, fill: colorText, fontWeight: 'bold' }}
                            tickLine={false} axisLine={false}
                            label={{ value: 'Head (ft)', angle: -90, position: 'insideLeft', offset: 15, fill: colorText, fontSize: 10, fontWeight: 'bold' }}
                        />

                        <YAxis
                            yAxisId="eff"
                            orientation="right"
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: '#10b981', fontWeight: 'bold' }}
                            tickLine={false} axisLine={false}
                            label={{ value: 'Efficiency (%)', angle: 90, position: 'insideRight', offset: 15, fill: '#10b981', fontSize: 10, fontWeight: 'bold' }}
                        />


                        <Tooltip content={<CustomTooltip />} isAnimationActive={false} />

                        {designs.map((d, i) => {
                            const cfg = getDesignStyle(d.pump, i);
                            const color = cfg.b;
                            const fullLabel = cfg.label;
                            return (
                                <React.Fragment key={i}>
                                    <defs>
                                        <filter id={`glow_${i}`} x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="3" result="blur" />
                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                        </filter>
                                    </defs>
                                    {/* Main Head Curve */}
                                    <Line
                                        yAxisId="head"
                                        type="monotone"
                                        dataKey={`head_${i}`}
                                        stroke={color}
                                        strokeWidth={5}
                                        dot={false}
                                        connectNulls={false}
                                        isAnimationActive={false}
                                        name={`${fullLabel} Head`}
                                        style={{ filter: `url(#glow_${i})` }}
                                    />
                                    {/* Efficiency Curve */}
                                    <Line
                                        yAxisId="eff"
                                        type="monotone"
                                        dataKey={`eff_${i}`}
                                        stroke={color}
                                        strokeWidth={2.5}
                                        strokeDasharray="8 4"
                                        opacity={0.7}
                                        dot={false}
                                        connectNulls={false}
                                        isAnimationActive={false}
                                        name={`${fullLabel} Efficiency`}
                                    />
                                    {/* Range limits (subtle) */}
                                    <Line
                                        yAxisId="head"
                                        type="monotone"
                                        dataKey={`min_${i}`}
                                        stroke={color}
                                        strokeWidth={1}
                                        strokeDasharray="2 2"
                                        opacity={0.3}
                                        dot={false}
                                        connectNulls={false}
                                        isAnimationActive={false}
                                        legendType="none"
                                    />
                                    <Line
                                        yAxisId="head"
                                        type="monotone"
                                        dataKey={`max_${i}`}
                                        stroke={color}
                                        strokeWidth={1}
                                        strokeDasharray="2 2"
                                        opacity={0.3}
                                        dot={false}
                                        connectNulls={false}
                                        isAnimationActive={false}
                                        legendType="none"
                                    />
                                </React.Fragment>
                            );
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="px-6 py-4 bg-canvas/30 border-t border-white/5 flex flex-wrap gap-8">
                {designs.map((d, i) => {
                    const cfg = getDesignStyle(d.pump, i);
                    return (
                        <div key={i} className="flex items-center gap-3 font-black text-[10px] uppercase">
                            <div className="w-4 h-1 rounded-full" style={{ background: cfg.b }} />
                            <span className="text-txt-muted">{cfg.label}:</span>
                            <span className="text-txt-main">{d.pump?.model || '—'}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── PER-DESIGN MINI CHART ─────────────────────────────────────────────────────
const MiniDesignChart = ({ design, colorCfg, activeSkGlobal }: { design: DesignSnapshot; colorCfg: typeof DC[0]; activeSkGlobal?: SK }) => {
    const { language, t } = useLanguage();
    const [localSk, setLocalSk] = useState<SK>('target');
    const colorText = 'rgba(100,116,139,0.8)';
    const activeSk = activeSkGlobal || localSk;

    const { curveData, opPoint, allOps } = useMemo(() => {
        if (!design.pump || !design.params) return { curveData: [], opPoint: null, allOps: [] };
        const sp = getScenarioParams(design.params, activeSk);
        const freq = design.params.targets?.[activeSk]?.frequency ?? design.frequency ?? 60;
        const pts = generateMultiCurveData(design.pump, sp, freq, 62);
        const match = findIntersection(pts);

        const bf = design.pump.nameplateFrequency || 60;
        let op = null;
        if (match) {
            const res = calculateSystemResults(match.flow, match.head, sp, design.pump, freq);
            op = { flow: match.flow, head: match.head, ...res };
        }
        const ops = SCENARIO_KEYS.map(sk => {
            const spp = getScenarioParams(design.params, sk);
            const ff = design.params.targets?.[sk]?.frequency ?? design.frequency ?? 60;
            const dd = generateMultiCurveData(design.pump, spp, ff, 50);
            const mm = findIntersection(dd);
            return (mm && isFinite(mm.flow) && isFinite(mm.head)) ? { sk, flow: mm.flow, head: mm.head } : null;
        }).filter(Boolean);
        return { curveData: pts, opPoint: op, allOps: ops };
    }, [design, activeSk]);

    return (
        <div className="rounded-xl border border-surface-light overflow-hidden shadow-md bg-surface" style={{ borderColor: colorCfg.b + '40' }}>
            <div className="px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap" style={{ background: colorCfg.bg }}>
                <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full shadow-lg shadow-black/20" style={{ background: colorCfg.b }} />
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: colorCfg.b }}>{colorCfg.label}</span>
                    <span className="text-[11px] text-txt-main font-black tracking-tight">{design.pump?.model || '—'} · {design.pump?.stages || 0} stg</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-[10px] font-black bg-canvas/60 px-3 py-1 rounded-lg border border-white/5 uppercase text-txt-muted tracking-widest shadow-inner">
                        {activeSk}
                    </div>
                    <button
                        onClick={() => {
                            try {
                                if (!curveData || curveData.length === 0) {
                                    alert("No hay datos de curva para exportar.");
                                    return;
                                }
                                const ws = XLSX.utils.json_to_sheet(curveData.map(p => ({
                                    'Flow (BPD)': Math.round(p.flow),
                                    'Pump Head (ft)': p.userHz ? Math.round(p.userHz) : 0,
                                    'System Head (ft)': p.systemCurve ? Math.round(p.systemCurve) : 0,
                                    'Efficiency (%)': p.efficiency ? Number(p.efficiency).toFixed(1) : 0,
                                    '30Hz Head': p.hz30, '40Hz Head': p.hz40,
                                    '50Hz Head': p.hz50, '60Hz Head': p.hz60, '70Hz Head': p.hz70,
                                    'Min Range Limit (ft)': p.minLimit ? Math.round(p.minLimit) : null,
                                    'Max Range Limit (ft)': p.maxLimit ? Math.round(p.maxLimit) : null,
                                })));
                                const wsOps = XLSX.utils.json_to_sheet(allOps.map((op: any) => ({
                                    'Scenario': op.sk.toUpperCase(),
                                    'Flow (BPD)': Math.round(op.flow),
                                    'Head (ft)': Math.round(op.head)
                                })));
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Performance Curve");
                                XLSX.utils.book_append_sheet(wb, wsOps, "Operating Points");
                                XLSX.writeFile(wb, `ESP_Curve_${design.pump?.model || 'Design'}_${activeSk}.xlsx`);
                            } catch (err) {
                                console.error("Export Error:", err);
                                alert("Error al exportar Excel individual.");
                            }
                        }}
                        title={language === 'es' ? 'Descargar Excel' : 'Download Excel'}
                        className="p-1.5 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-all active:scale-90 border border-emerald-500/20"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {opPoint && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 bg-surface border-b border-white/5 shadow-inner">
                    {[
                        { l: t('p6.bfpd'), v: f0(opPoint.flow) },
                        { l: t('p6.tdh'), v: f0(opPoint.tdh || opPoint.head) + ' ft' },
                        { l: t('p6.pip'), v: f0(opPoint.pip) + ' psi' },
                        { l: t('p6.pumpEff'), v: `${f1(opPoint.effEstimated)}%` },
                        { l: t('p6.motorLoad'), v: `${f0(opPoint.motorLoad)}%` },
                        { l: t('p6.power'), v: f1(opPoint.electrical?.kw) + ' kW' },
                        { l: 'Hz', v: `${design.params?.targets?.[activeSk]?.frequency ?? design.frequency}` },
                    ].map((kv, i) => (
                        <div key={i} className="flex flex-col">
                            <span className="text-[9px] font-black text-txt-muted/70 uppercase tracking-widest mb-0.5">{kv.l}</span>
                            <span className="text-xs font-black text-txt-main tracking-tight font-mono">{kv.v}</span>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ height: '210px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={curveData} margin={{ top: 5, right: 30, left: -5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.08)" vertical={false} />
                        <XAxis dataKey="flow" type="number" tick={{ fontSize: 10, fill: colorText, fontWeight: 'bold' }} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} />
                        <YAxis yAxisId="head" domain={[0, 10000]} allowDataOverflow={true} tick={{ fontSize: 10, fill: colorText, fontWeight: 'bold' }} tickLine={false} axisLine={false} width={45} />
                        <YAxis yAxisId="eff" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#10b981', fontWeight: 'bold' }} tickLine={false} axisLine={false} width={35} />
                        <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                        {STD_HZ.map(hzk => (
                            <Line key={hzk} yAxisId="head" type="monotone" dataKey={hzk}
                                stroke={colorCfg.b} strokeWidth={HZ_W[hzk]}
                                strokeDasharray={HZ_DASH[hzk]} opacity={HZ_OPACITY[hzk]}
                                dot={false} connectNulls={false} isAnimationActive={false} legendType="none" />
                        ))}
                        <Line yAxisId="head" type="monotone" dataKey="userHz"
                            stroke={colorCfg.b} strokeWidth={5} dot={false} connectNulls={false} isAnimationActive={false}
                            style={{ filter: 'drop-shadow(0 0 8px ' + colorCfg.b + '80)' }} />
                        <Line yAxisId="eff" type="monotone" dataKey="efficiency"
                            stroke="#10b981" strokeWidth={2.5} strokeDasharray="8 4" dot={false} connectNulls={false} opacity={0.8} isAnimationActive={false} />
                        <Line yAxisId="head" type="monotone" dataKey="systemCurve"
                            stroke="#ef4444" strokeWidth={3} strokeDasharray="10 5" dot={false} connectNulls={false} opacity={0.9} isAnimationActive={false} />

                        <Line yAxisId="head" type="monotone" dataKey="minLimit" stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="2 3" dot={false} opacity={0.4} isAnimationActive={false} />
                        <Line yAxisId="head" type="monotone" dataKey="maxLimit" stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="2 3" dot={false} opacity={0.4} isAnimationActive={false} />
                        {allOps.map((op: any, i: number) => {
                            const isTgt = op.sk === 'target';
                            return <ReferenceDot key={i} yAxisId="head" x={op.flow} y={op.head}
                                r={isTgt ? 6 : 3.5} fill={colorCfg.b} stroke="white"
                                strokeWidth={isTgt ? 2 : 1} opacity={isTgt ? 1 : 0.6}
                            />;
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ── TABLES ────────────────────────────────────────────────────────────────────
const SR = ({ label, vals }: { label: string; vals: { v: string; c: string }[] }) => {
    const nums = vals.map(v => parseFloat(v.v)).filter(n => !isNaN(n) && isFinite(n));
    const mx = nums.length ? Math.max(...nums) : 0;
    const mn = nums.length ? Math.min(...nums) : 0;
    return (
        <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
            <td className="py-2.5 pr-4 text-xs font-black text-txt-muted/80 uppercase tracking-wider">{label}</td>
            {vals.map((v, i) => {
                const n = parseFloat(v.v);
                const isB = nums.length > 1 && n === mx && n !== mn;
                const isW = nums.length > 1 && n === mn && n !== mx;
                return (
                    <td key={i} className="py-2.5 px-3 text-center text-sm font-black border-l border-white/5 font-mono">
                        <span style={{ color: v.c }}>{v.v}</span>
                        {isB && <span className="ml-1 text-[9px] text-emerald-400">▲</span>}
                        {isW && <span className="ml-1 text-[9px] text-red-400">▼</span>}
                    </td>
                );
            })}
        </tr>
    );
};

const TlccReChart = ({ designs }: { designs: DesignSnapshot[] }) => {
    const { language } = useLanguage();
    const colorText = 'rgba(100,116,139,0.8)';

    const data = useMemo(() => {
        if (!designs || designs.length === 0) return [];
        const months = designs[0]?.params?.simulation?.simulationMonths ?? 36;
        const out = [];
        const cum = designs.map(() => 0);

        for (let m = 1; m <= months; m++) {
            const pt: any = { month: m };
            designs.forEach((d, i) => {
                const kw = d.results?.electrical?.kw || 0;
                const cpp = d.params?.simulation?.costPerKwh || 0.08;
                const wr = d.params?.simulation?.annualWearPercent || 0;
                const w = 1 - (wr / 100) * (m / 12);

                const monthlyCost = (kw / Math.max(0.1, w)) * (365 / 12 * 24) * cpp;
                cum[i] += monthlyCost;

                pt[`d${i}`] = Math.round(cum[i]);
                pt[`m${i}`] = Math.round(monthlyCost); // For tooltip context
            });
            out.push(pt);
        }
        return out;
    }, [designs]);

    if (!data.length) return null;

    return (
        <div style={{ height: '450px', width: '100%' }} className="relative">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                        {designs.map((d, i) => {
                            const cfg = getDesignStyle(d.pump, i);
                            return (
                                <linearGradient key={`grad_${i}`} id={`colorD${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={cfg.b} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={cfg.b} stopOpacity={0} />
                                </linearGradient>
                            );
                        })}
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" vertical={false} />

                    <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: colorText, fontWeight: 'bold' }}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: language === 'es' ? 'Meses de Operación' : 'Months of Operation', position: 'insideBottom', offset: -10, fontSize: 11, fontWeight: '900', fill: colorText }}
                    />

                    <YAxis
                        tick={{ fontSize: 11, fill: colorText, fontWeight: 'bold' }}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                        tickFormatter={v => `$${(v).toLocaleString()}`}
                        label={{ value: language === 'es' ? 'Costo Mensual ($)' : 'Monthly Cost ($)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fontWeight: '900', fill: colorText }}
                    />

                    <Tooltip
                        content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            return (
                                <div className="glass-surface p-4 rounded-2xl border border-white/10 shadow-2xl min-w-[200px]">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted mb-3 border-b border-white/5 pb-2">
                                        {language === 'es' ? 'Mes' : 'Month'} {label}
                                    </p>
                                    <div className="space-y-3">
                                        {payload.map((p: any, i: number) => {
                                            const designIdx = p.dataKey.replace('m', '');
                                            const cumulative = data[label - 1]?.[`d${designIdx}`];
                                            return (
                                                <div key={i} className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                        <span className="text-[11px] font-black text-txt-main uppercase">{getDesignStyle(designs[designIdx]?.pump, designIdx).label}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-bold text-txt-muted px-4">
                                                        <span>{language === 'es' ? 'Acumulado:' : 'Cumulative:'}</span>
                                                        <span>${cumulative?.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }}
                        isAnimationActive={false}
                    />

                    <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        formatter={(value: string) => {
                            const idx = value.replace('m', '');
                            const dIdx = Number(idx);
                            return <span className="text-[10px] font-black uppercase tracking-widest text-txt-main">{getDesignStyle(designs[dIdx]?.pump, dIdx).label}</span>;
                        }}
                    />

                    {designs.map((d, i) => {
                        const cfg = getDesignStyle(d.pump, i);
                        return (
                            <Area
                                key={i}
                                type="monotone"
                                dataKey={`m${i}`}
                                stroke={cfg.b}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill={`url(#colorD${i})`}
                                dot={false}
                                isAnimationActive={true}
                                animationDuration={1500}
                            />
                        );
                    })}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

// ── AI INSIGHTS ENGINE ────────────────────────────────────────────────────────
const AIInsights = ({ designs }: { designs: DesignSnapshot[] }) => {
    const { language, t } = useLanguage();
    const insights = useMemo(() => {
        const results: { type: 'success' | 'warning' | 'info'; text: string; title: string, icon: any, color: string, dIdx: number }[] = [];
        designs.forEach((d, i) => {
            const scs = ['min', 'target', 'max'].map(sk => calculateScenarioResults(d, sk as any)) as any[];
            const valid = scs.filter(r => r && isFinite(r.flow));
            if (valid.length < 3) return;
            const cfg = getDesignStyle(d.pump, i);
            const label = cfg.label;
            const color = cfg.b;
            const targetRes = scs[1];
            const maxRes = scs[2];
            const minRes = scs[0];
            const bep = d.pump?.bepRate || 1;
            const pb = d.params?.fluids?.pb || 0;
            const base = { color, dIdx: i % 4 };
            const ml = targetRes?.motorLoad || 0;
            if (ml > 100) {
                results.push({
                    ...base, type: 'warning', icon: Zap,
                    title: t('p6.overloadTitle', { label }),
                    text: t('p6.overloadText', { ml: f0(ml) })
                });
            } else if (ml < 45) {
                results.push({
                    ...base, type: 'info', icon: Thermometer,
                    title: t('p6.underloadTitle', { label }),
                    text: t('p6.underloadText', { ml: f0(ml) })
                });
            }
            const gvf = maxRes?.gasAnalysis?.voidFraction || 0;
            if (gvf > 0.35) {
                results.push({
                    ...base, type: 'warning', icon: Droplets,
                    title: t('p6.gasLockTitle', { label }),
                    text: t('p6.gasLockText', { gvf: f0(gvf * 100) })
                });
            }
            const pip = minRes?.pip || 0;
            if (pip < pb * 1.05) {
                results.push({
                    ...base, type: 'warning', icon: AlertTriangle,
                    title: t('p6.cavitationTitle', { label }),
                    text: t('p6.cavitationText', { pip: f0(pip), pb: f0(pb) })
                });
            }
            const ratio = (targetRes?.flow || 0) / bep;
            if (ratio >= 0.85 && ratio <= 1.15) {
                results.push({
                    ...base, type: 'success', icon: ShieldCheck,
                    title: t('p6.efficiencyTitle', { label }),
                    text: t('p6.efficiencyText', { ratio: f0(ratio * 100) })
                });
            } else if (ratio < 0.6 || ratio > 1.4) {
                results.push({
                    ...base, type: 'warning', icon: Activity,
                    title: t('p6.outOfRangeTitle', { label }),
                    text: t('p6.outOfRangeText', { ratio: f0(ratio * 100) })
                });
            }
        });
        if (designs.length >= 2) {
            const bestEff = designs.reduce((prev, curr) => (calculateScenarioResults(curr, 'target')?.effEstimated || 0) > (calculateScenarioResults(prev, 'target')?.effEstimated || 0) ? curr : prev);
            const bestIdx = designs.indexOf(bestEff);
            const cfg = getDesignStyle(bestEff.pump, bestIdx);
            results.push({
                color: cfg.b, dIdx: bestIdx,
                type: 'info', icon: Lightbulb,
                title: t('p6.economicWinnerTitle'),
                text: t('p6.economicWinnerText', { label: cfg.label })
            });
        }
        return results.sort((a, b) => (a.type === 'warning' ? -1 : 1)).slice(0, 6);
    }, [designs, language]);
    if (!insights.length) return null;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {insights.map((ins, i) => (
                <div key={i} className="group/card p-5 rounded-[32px] border glass-morphism card-shine shadow-xl transition-all duration-700 hover:shadow-primary/10 hover:-translate-y-2" style={{ borderColor: ins.color + '33' }}>
                    <div className="flex items-center gap-3 mb-2.5">
                        <div className="p-2 rounded-xl ring-2 ring-white/10 flex items-center justify-center" style={{ backgroundColor: ins.color }}>
                            <ins.icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-widest text-txt-main">{ins.title}</span>
                            <span className="text-[10px] font-black uppercase opacity-70 tracking-widest" style={{ color: ins.color }}>
                                {ins.type === 'success' ? t('p6.optimal') :
                                    ins.type === 'warning' ? t('p6.risk') :
                                        t('p6.notice')}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-txt-main/90 leading-relaxed font-bold">{ins.text}</p>
                </div>
            ))}
        </div>
    );
};

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export const ComparatorDashboard = ({ designs }: { designs: DesignSnapshot[] }) => {
    const { language, t } = useLanguage();
    const { theme } = useTheme();
    const [globalSk, setGlobalSk] = useState<SK>('target');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const sData = designs.map(d => {
        const sp = getScenarioParams(d.params, globalSk);
        const freq = d.params?.targets?.[globalSk]?.frequency ?? d.frequency ?? 60;
        const pts = generateMultiCurveData(d.pump, sp, freq, 60);
        const m = findIntersection(pts);
        let r = d.results;
        if (m && d.pump) r = calculateSystemResults(m.flow, m.head, sp, d.pump, freq);
        return { ...d, activeResults: r, activeFreq: freq, activeFlow: m?.flow ?? d.params?.pressures?.totalRate };
    });

    // ── SYNC AUTOMATICO CON EL ANALIZADOR HTML ──
    const syncWithIframe = () => {
        if (!iframeRef.current || !iframeRef.current.contentWindow || designs.length === 0) {
            console.warn("Iframe no listo para sincronización o no hay diseños.");
            return;
        }
        const maxBep = Math.max(...designs.map(d => d.pump?.bepRate || 3000));
        const limitFlow = maxBep * 2;
        const masterFlows = Array.from({ length: 81 }, (_, i) => i * (limitFlow / 80));
        const SCENARIOS: ("min" | "target" | "max")[] = ["min", "target", "max"];
        const designTargets = designs.map(d => ({
            min: calculateScenarioResults(d, 'min'),
            target: calculateScenarioResults(d, 'target'),
            max: calculateScenarioResults(d, 'max')
        }));

        const chartData = masterFlows.map(f => {
            const row: any = { flow: f };
            designs.forEach((d, di) => {
                if (!d.pump) return;
                const p = d.pump;
                const bf = p.nameplateFrequency || 60;

                SCENARIOS.forEach(sk => {
                    const currentFreq = d.params.targets?.[sk]?.frequency ?? d.frequency ?? 60;
                    const hNow = calculateAffinityHead(f, currentFreq, bf, p);
                    
                    row[`Pump Head (ft) _${di}_${sk}`] = (hNow !== null && hNow > 0) ? hNow : null;

                    const res = designTargets[di][sk];
                    if (res && res.flow > 0) {
                        const closestFlow = masterFlows.reduce((prev, curr) =>
                            Math.abs(curr - res.flow) < Math.abs(prev - res.flow) ? curr : prev
                        );
                        if (Math.abs(f - closestFlow) < (limitFlow / 160)) {
                            row[`Target Point _${di}_${sk}`] = res.tdh || res.head;
                        } else {
                            row[`Target Point _${di}_${sk}`] = null;
                        }
                    }

                    const hMinBase = calculateBaseHead(p.minRate || 0, p) || 0;
                    const hMaxBase = calculateBaseHead(p.maxRate || 0, p) || 0;
                    const kMin = p.minRate > 0 ? hMinBase / (p.minRate * p.minRate) : 0;
                    const kMax = p.maxRate > 0 ? hMaxBase / (p.maxRate * p.maxRate) : 0;
                    
                    row[`Min Range Limit (ft) _${di}_${sk}`] = (kMin * f * f) <= 50000 ? (kMin * f * f) : null;
                    row[`Max Range Limit (ft) _${di}_${sk}`] = (kMax * f * f) <= 50000 ? (kMax * f * f) : null;
                });
            });
            return row;
        });

        iframeRef.current.contentWindow?.postMessage({
            type: 'UPDATE_CHART',
            data: chartData,
            title: "UNIFIED MULTI-SCENARIO ANALYSIS",
            theme: (theme === 'executive' || theme === 'heritage') ? 'light' : 'dark',
            designColors: designs.map((d, i) => getDesignStyle(d.pump, i).b),
            designLabels: designs.map((d, i) => getDesignStyle(d.pump, i).label)
        }, '*');
    };

    // Monitor de sincronización con logs para debug
    useEffect(() => {
        console.log("Global Scenario changed to:", globalSk);
        const timer = setTimeout(() => {
            syncWithIframe();
        }, 300);
        return () => clearTimeout(timer);
    }, [globalSk, theme, designs]);

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/40 backdrop-blur-xl p-5 rounded-[32px] border border-surface-light shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-[18px]">
                        <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-txt-main uppercase tracking-[0.3em] mb-1">
                            {t('dc.perfDynamics')}
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] text-txt-muted font-black uppercase tracking-widest opacity-80 italic">
                                {t('dc.realTimeSim')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex p-1.5 bg-canvas/60 rounded-[20px] border border-surface-light shadow-inner relative z-10">
                        {/* Escenarios eliminados por redundancia con la leyenda del gráfico */}
                    </div>

                    <button
                        onClick={async () => {
                            console.log("Iniciando exportación Excel...");
                            if (designs.length === 0) {
                                console.warn("No hay diseños para exportar");
                                return;
                            }
                            try {
                                const d0 = designs[0];
                                if (!d0.pump) {
                                    alert("El Diseño 1 no tiene una bomba seleccionada.");
                                    return;
                                }
                                const sp0 = getScenarioParams(d0.params, globalSk);
                                const freq0 = d0.params?.targets?.[globalSk]?.frequency ?? d0.frequency ?? 60;
                                const pts0 = generateMultiCurveData(d0.pump, sp0, freq0, 80);

                                const d1 = designs[1];
                                let sp1: any, freq1: number, kMin1 = 0, kMax1 = 0, baseFreq1 = 60, mixSG1 = 1.0;
                                if (d1 && d1.pump) {
                                    sp1 = getScenarioParams(d1.params, globalSk);
                                    freq1 = d1.params?.targets?.[globalSk]?.frequency ?? d1.frequency ?? 60;
                                    baseFreq1 = d1.pump.nameplateFrequency > 0 ? d1.pump.nameplateFrequency : 60;
                                    const headAtMinBase1 = Math.max(0, calculateBaseHead(d1.pump.minRate, d1.pump));
                                    const headAtMaxBase1 = Math.max(0, calculateBaseHead(d1.pump.maxRate, d1.pump));
                                    if (d1.pump.minRate > 0) kMin1 = headAtMinBase1 / Math.pow(d1.pump.minRate, 2);
                                    if (d1.pump.maxRate > 0) kMax1 = headAtMaxBase1 / Math.pow(d1.pump.maxRate, 2);
                                    const wc1 = sp1.fluids.waterCut / 100;
                                    mixSG1 = (sp1.fluids.geWater * wc1) + (141.5 / (131.5 + sp1.fluids.apiOil) * (1 - wc1));
                                    if (sp1.fluids.sandCut > 0) {
                                        const sand = sp1.fluids.sandCut / 100;
                                        mixSG1 = mixSG1 * (1 - sand) + (sp1.fluids.sandDensity || 2.65) * sand;
                                    }
                                }

                                const otherStops = new Array(designs.length - 1).fill(false);
                                const rows = pts0.map((p0, ri) => {
                                    const f = p0.flow;
                                    const row = [
                                        Math.round(f),
                                        p0.userHz ? Math.round(p0.userHz) : 0,
                                        p0.systemCurve ? Math.round(p0.systemCurve) : 0,
                                        p0.efficiency ? Number(p0.efficiency).toFixed(1) : 0,
                                        p0.hz30 ? Math.round(p0.hz30) : null,
                                        p0.hz40 ? Math.round(p0.hz40) : null,
                                        p0.hz50 ? Math.round(p0.hz50) : null,
                                        p0.hz60 ? Math.round(p0.hz60) : null,
                                        p0.hz70 ? Math.round(p0.hz70) : null,
                                        p0.minLimit ? Math.round(p0.minLimit) : null,
                                        p0.maxLimit ? Math.round(p0.maxLimit) : null
                                    ];

                                    designs.slice(1).forEach((d, di) => {
                                        if (d && d.pump) {
                                            const sp = getScenarioParams(d.params, globalSk);
                                            const freq = d.params?.targets?.[globalSk]?.frequency ?? d.frequency ?? 60;
                                            const bf = d.pump.nameplateFrequency > 0 ? d.pump.nameplateFrequency : 60;

                                            // Add persistent truncation state for other designs in Excel
                                            const hUserRaw = calculateAffinityHead(f, freq, bf, d.pump);
                                            let hUser = null;
                                            if (!otherStops[di]) {
                                                if (hUserRaw !== null && hUserRaw > 0) {
                                                    hUser = Math.round(hUserRaw);
                                                } else if (f > 0) {
                                                    otherStops[di] = true;
                                                }
                                            }
                                            row.push(hUser);

                                            try {
                                                const sysHead = calculateSystemTDH(f, sp);
                                                row.push((isFinite(sysHead) && sysHead > 0) ? Math.round(sysHead) : 0);
                                            } catch { row.push(0); }

                                            if (hUser && hUser > 1 && f > 0) {
                                                const wc = sp.fluids.waterCut / 100;
                                                const mixSG = (sp.fluids.geWater * wc) + (141.5 / (131.5 + sp.fluids.apiOil) * (1 - wc));
                                                const bhp = calculateBhpAtPoint(f, freq, bf, d.pump, mixSG);
                                                const hhp = (f * hUser * mixSG) / 135770;
                                                let eff = 0; if (bhp > 0) eff = (hhp / bhp) * 100;
                                                row.push((eff > 0 && eff < 100) ? Number(eff.toFixed(1)) : 0);
                                            } else { row.push(0); }

                                            [30, 40, 50, 60, 70].forEach(hz => {
                                                const hVal = calculateAffinityHead(f, hz, bf, d.pump);
                                                row.push((hVal !== null && hVal > 1) ? Math.round(hVal) : null);
                                            });

                                            const hMinB = Math.max(0, calculateBaseHead(d.pump.minRate, d.pump));
                                            const hMaxB = Math.max(0, calculateBaseHead(d.pump.maxRate, d.pump));
                                            const kM = d.pump.minRate > 0 ? hMinB / Math.pow(d.pump.minRate, 2) : 0;
                                            const kX = d.pump.maxRate > 0 ? hMaxB / Math.pow(d.pump.maxRate, 2) : 0;

                                            row.push((kM > 0) ? Math.round(kM * f * f) : null);
                                            row.push((kX > 0) ? Math.round(kX * f * f) : null);
                                        } else {
                                            for (let i = 0; i < 11; i++) row.push(null);
                                        }
                                    });
                                    return row;
                                });

                                const templatePath = '/FORMATO COMPARATIVA DE BOMBAS.xlsx';
                                let res = await fetch(templatePath);
                                if (!res.ok) {
                                    // Fallback: try relative path
                                    res = await fetch('FORMATO COMPARATIVA DE BOMBAS.xlsx');
                                }
                                if (!res.ok) {
                                    throw new Error("No se pudo cargar la plantilla 'FORMATO COMPARATIVA DE BOMBAS.xlsx'. Verifique que esté en la carpeta public.");
                                }
                                const ab = await res.arrayBuffer();
                                const wb = XLSX.read(ab, { type: 'array' });

                                const wsName = "BOMBAS";
                                if (!wb.Sheets[wsName]) {
                                    alert("La hoja 'BOMBAS' no existe en la plantilla.");
                                    return;
                                }

                                XLSX.utils.sheet_add_aoa(wb.Sheets[wsName], rows, { origin: 'A2' });
                                const fname = getDownloadFilename(designs[0]?.params || { metadata: {} }, null, `Comparative_${globalSk.toUpperCase()}`);
                                XLSX.writeFile(wb, `${fname}.xlsx`);
                            } catch (err: any) {
                                console.error("Excel Error:", err);
                                alert(err.message || t('dc.fileError'));
                            }
                        }}
                        className="p-3.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-2xl border border-emerald-500/20 transition-all active:scale-95 shadow-lg group"
                        title={t('dc.downloadExcel')}
                    >
                        <FileSpreadsheet className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>

            {/* ── CENTRAL ANALYZER CHART (EMBEDDED HTML) ── */}
            <div className="rounded-[32px] border border-surface-light overflow-hidden shadow-2xl bg-white mb-8">
                <iframe
                    ref={iframeRef}
                    srcDoc={analyzerHtmlStr}
                    className="w-full h-[88vh] border-none"
                    title="Pump Curve Analyzer"
                    onLoad={syncWithIframe}
                />
            </div>

            <AIInsights designs={designs} />

            {/* ── INDIVIDUAL MINI CHARTS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {designs.map((d, i) => (
                    <MiniDesignChart key={d.id} design={d} colorCfg={getDesignStyle(d.pump, i)} activeSkGlobal={globalSk} />
                ))}
            </div>

            <div className="bg-surface/30 backdrop-blur-xl rounded-[32px] border border-surface-light p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase text-txt-main tracking-[0.25em]">
                        {t('dc.economicLife')}
                    </h4>
                </div>
                <div className="h-[500px]">
                    <TlccReChart designs={designs} />
                </div>
            </div>
        </div>
    );
};

export const ComparatorCurves = ComparatorDashboard;