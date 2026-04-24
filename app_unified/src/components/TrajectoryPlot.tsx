import React, { useMemo } from 'react';
import { Map } from 'lucide-react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
    Label, ReferenceDot, Tooltip, ReferenceLine, ReferenceArea, Customized
} from 'recharts';
import { SystemParams } from '../types';
import { interpolateTVD } from '../utils';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme';

interface TrajectoryPlotProps {
    survey: any[];
    params: SystemParams;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geological formation label — right edge of each layer
// ─────────────────────────────────────────────────────────────────────────────
const FormationLabel = ({ viewBox, name, color }: any) => {
    if (!viewBox) return null;
    const { x, y, width, height } = viewBox;
    const cy = y + height / 2;
    return (
        <g transform={`translate(${x + width - 82}, ${cy})`}>
            <rect x={0} y={-11} width={78} height={22} rx={4}
                fill={color} fillOpacity={0.12}
                stroke={color} strokeOpacity={0.35} strokeWidth={1} />
            <text x={39} y={4} textAnchor="middle" fill={color}
                fontSize={9} fontWeight="700" fontFamily="monospace" letterSpacing="0.08em">
                {name}
            </text>
        </g>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, colorSurface, colorSurfaceLight, colorTextMuted }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
        <div style={{
            background: colorSurface, border: `1px solid ${colorSurfaceLight}`,
            borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: 150, backdropFilter: 'blur(8px)',
        }}>
            <p style={{
                color: colorTextMuted, fontSize: 9, fontFamily: 'monospace', marginBottom: 6,
                letterSpacing: '0.12em', textTransform: 'uppercase'
            }}>Survey Point</p>
            {[
                { label: 'TVD', value: `${Math.round(d?.tvd ?? 0)} ft`, color: '#38bdf8' },
                { label: 'MD', value: `${Math.round(d?.md ?? 0)} ft`, color: '#a78bfa' },
                { label: 'DEP', value: `${Math.round(d?.departure ?? 0)} ft`, color: '#34d399' },
            ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 3 }}>
                    <span style={{ color: colorTextMuted, fontSize: 10, fontFamily: 'monospace' }}>{label}</span>
                    <span style={{ color, fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Drilling Rig — anchored exactly at screen TVD=0
// ─────────────────────────────────────────────────────────────────────────────
const DrillingRig = (props: any) => {
    const { xAxisMap, yAxisMap, theme } = props;
    const xKey = Object.keys(xAxisMap ?? {})[0];
    const yKey = Object.keys(yAxisMap ?? {})[0];
    const xScale = xAxisMap?.[xKey]?.scale;
    const yScale = yAxisMap?.[yKey]?.scale;
    if (!xScale || !yScale) return null;

    const isDark = theme === 'fusion' || theme === 'cyber';
    const sx = xScale(0);
    const sy = yScale(0);
    const W = 14;
    const H = 65;
    const braces = [-H * 0.72, -H * 0.47, -H * 0.24];
    const towerCol = isDark ? "#4B5563" : "#64748B";
    const baseCol = isDark ? "#1F2937" : "#CBD5E1";

    return (
        <g transform={`translate(${sx}, ${sy})`}>
            <rect x={-W - 5} y={1} width={(W + 5) * 2} height={8} rx={2} fill={baseCol} stroke={towerCol} strokeWidth={1} />
            <rect x={-W - 9} y={8} width={(W + 9) * 2} height={5} rx={1} fill={isDark ? "#111827" : "#94A3B8"} stroke={towerCol} strokeWidth={1} />
            <line x1={-W} y1={0} x2={0} y2={-H} stroke={towerCol} strokeWidth={2.5} />
            <line x1={W} y1={0} x2={0} y2={-H} stroke={towerCol} strokeWidth={2.5} />
            {braces.map((by, i) => {
                const frac = (H + by) / H;
                const bw = W * frac;
                const nextBy = braces[i + 1];
                const nextBw = nextBy !== undefined ? W * ((H + nextBy) / H) : undefined;
                return (
                    <g key={i}>
                        <line x1={-bw} y1={by} x2={bw} y2={by} stroke={towerCol} strokeWidth={1.5} />
                        {nextBw !== undefined && <>
                            <line x1={-bw} y1={by} x2={-nextBw} y2={nextBy!} stroke={towerCol} strokeWidth={0.8} opacity={0.5} />
                            <line x1={bw} y1={by} x2={nextBw} y2={nextBy!} stroke={towerCol} strokeWidth={0.8} opacity={0.5} />
                        </>}
                    </g>
                );
            })}
            <rect x={-4} y={-H - 5} width={8} height={7} rx={2} fill={towerCol} />
            <line x1={0} y1={-H} x2={0} y2={0} stroke={isDark ? "#CBD5E1" : "#475569"} strokeWidth={0.8} opacity={0.45} strokeDasharray="3 3" />
            <rect x={-4} y={-H * 0.4} width={8} height={12} rx={2} fill={baseCol} stroke={towerCol} strokeWidth={1} />
            <circle cx={0} cy={-H - 5} r={3}
                fill="rgb(var(--color-primary))"
                style={{ filter: 'drop-shadow(0 0 6px rgb(var(--color-primary)))' }} />
        </g>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// ► SMOOTH WELLBORE ANGLE  ◄
//   Uses weighted average of screen-space tangents over ±4 survey points.
//   This prevents the jittery / perpendicular look caused by noisy single-step
//   differences between consecutive survey stations.
// ─────────────────────────────────────────────────────────────────────────────
const getSmoothAngleDeg = (
    tvdVal: number,
    processedData: any[],
    xScale: (v: number) => number,
    yScale: (v: number) => number,
): number => {
    const idx = processedData.findIndex((d: any) => d.tvd >= tvdVal);
    if (idx < 1) return 0;

    const HALF_WIN = 4;
    let sumSin = 0, sumCos = 0;

    for (let i = Math.max(1, idx - HALF_WIN); i <= Math.min(processedData.length - 1, idx + HALF_WIN); i++) {
        const p0 = processedData[i - 1];
        const p1 = processedData[i];
        const sdx = xScale(p1.departure) - xScale(p0.departure);
        const sdy = yScale(p1.tvd) - yScale(p0.tvd);
        const len = Math.sqrt(sdx * sdx + sdy * sdy);
        if (len < 0.001) continue;
        const dist = Math.abs(i - idx);
        const weight = HALF_WIN + 1 - dist;
        sumSin += weight * (sdx / len);
        sumCos += weight * (sdy / len);
    }

    if (Math.abs(sumSin) < 0.001 && Math.abs(sumCos) < 0.001) return 0;
    return Math.atan2(sumSin, sumCos) * 180 / Math.PI;
};

// ─────────────────────────────────────────────────────────────────────────────
// ESP Pump + Perforations — Customized, screen-space angle corrected
// ─────────────────────────────────────────────────────────────────────────────
interface WellboreSymbolsProps {
    xAxisMap?: any;
    yAxisMap?: any;
    processedData: any[];
    pumpDep: number;
    pumpTVD: number;
    perfsDep: number;
    perfsTVD: number;
    perfsTVDRange: number;
    colorPrimary: string;
    colorTextMuted: string;
    payZoneLabel: string;
    theme: string;
}

const WellboreSymbols = ({
    xAxisMap, yAxisMap,
    processedData,
    pumpDep, pumpTVD,
    perfsDep, perfsTVD, perfsTVDRange,
    colorPrimary, colorTextMuted,
    payZoneLabel, theme,
}: WellboreSymbolsProps) => {
    const xKey = Object.keys(xAxisMap ?? {})[0];
    const yKey = Object.keys(yAxisMap ?? {})[0];
    const xScale = xAxisMap?.[xKey]?.scale;
    const yScale = yAxisMap?.[yKey]?.scale;
    if (!xScale || !yScale) return null;

    const isDark = theme === 'fusion' || theme === 'cyber';
    const ac = colorPrimary;
    const perf = '#10B981';

    // ── Screen coordinates ──────────────────────────────────────────────────
    const ex = xScale(pumpDep);
    const ey = yScale(pumpTVD);
    const px = xScale(perfsDep);
    const py = yScale(perfsTVD);

    // ── Smooth angles along the wellbore ───────────────────────────────────
    const eAngle = getSmoothAngleDeg(pumpTVD, processedData, xScale, yScale);
    const pAngle = getSmoothAngleDeg(perfsTVD, processedData, xScale, yScale);

    // ── Perf interval size in screen pixels ────────────────────────────────
    const rawPx = Math.abs(yScale(perfsTVD + perfsTVDRange) - yScale(perfsTVD));
    const halfInt = Math.max(16, Math.min(34, rawPx));
    const shots = [-halfInt * 0.72, -halfInt * 0.33, 0, halfInt * 0.33, halfInt * 0.72];

    // ── ESP Pump body dimensions — compact to sit cleanly inside the wellbore ──
    //    PH: half-height along wellbore axis  |  PW: half-width across
    const PH = 13;   // reduced from 20 → fits tighter inside wellbore
    const PW = 3;    // reduced from 4  → slimmer profile

    return (
        <g>
            {/* ═══════════════════════════════════════════════════════
                ESP — body rotated along wellbore, label always horizontal
                ═══════════════════════════════════════════════════════ */}

            {/* Outer glow ring (not rotated, stays circular) */}
            <circle cx={ex} cy={ey} r={10}
                fill="none" stroke={ac} strokeWidth={1} strokeOpacity={0.2}
                style={{ filter: 'drop-shadow(0 0 5px rgb(var(--color-primary)/0.35))' }} />

            {/* Body — rotated along wellbore */}
            <g transform={`translate(${ex}, ${ey}) rotate(${eAngle})`}>
                {/* Outer casing of pump */}
                <rect x={-PW - 1.5} y={-PH - 1.5} width={(PW + 1.5) * 2} height={(PH + 1.5) * 2} rx={3}
                    fill={isDark ? "#0A1628" : "#EFF6FF"} stroke={ac} strokeWidth={1.2} />
                {/* Stage bands — 3 stripes (reduced from 4) */}
                {[-PH * 0.55, 0, PH * 0.55].map((bandY, i) => (
                    <rect key={i}
                        x={-PW - 0.5} y={bandY - 2.5} width={(PW + 0.5) * 2} height={4} rx={1}
                        fill={ac} fillOpacity={0.35} stroke={ac} strokeWidth={0.5} />
                ))}
                {/* Center shaft line */}
                <line x1={0} y1={-PH} x2={0} y2={PH}
                    stroke={ac} strokeWidth={0.6} opacity={0.5} />
                {/* Top connection stub */}
                <rect x={-1.5} y={-PH - 6} width={3} height={6} rx={1} fill={ac} fillOpacity={0.7} />
                {/* Bottom intake */}
                <rect x={-2} y={PH} width={4} height={5} rx={1}
                    fill={ac} fillOpacity={0.4} stroke={ac} strokeWidth={0.5} strokeDasharray="2 1" />
            </g>

            {/* Dot at center (stays at exact pump position) */}
            <circle cx={ex} cy={ey} r={2.5} fill={ac}
                style={{ filter: 'drop-shadow(0 0 4px rgb(var(--color-primary)))' }} />

            {/* Label badge — always horizontal, offset to the right */}
            <g transform={`translate(${ex + 14}, ${ey - 15})`}>
                <rect x={0} y={0} width={50} height={30} rx={5}
                    fill={isDark ? "#060E1E" : "#EFF6FF"}
                    stroke={ac} strokeWidth={1.2}
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.45))' }} />
                <text x={25} y={12} textAnchor="middle" fill={ac}
                    fontSize={10} fontWeight="900" fontFamily="monospace">ESP</text>
                <text x={25} y={23} textAnchor="middle" fill={colorTextMuted}
                    fontSize={7.5} fontFamily="monospace">PUMP</text>
                {/* Connector line from badge to center dot */}
                <line x1={-12} y1={15} x2={0} y2={15} stroke={ac} strokeWidth={1} opacity={0.5} />
                <circle cx={-14} cy={15} r={1.5} fill={ac} opacity={0.6} />
            </g>

            {/* ═══════════════════════════════════════════════════════
                PERFORATIONS — only the glowing bullet tips, no inner body/casing
                ═══════════════════════════════════════════════════════ */}

            {/* Subtle ambient glow around interval */}
            <g transform={`translate(${px}, ${py}) rotate(${pAngle})`}>
                <rect x={-14} y={-halfInt - 4} width={28} height={(halfInt + 4) * 2} rx={10}
                    fill={perf} fillOpacity={0.05}
                    style={{ filter: 'blur(5px)' }} />
            </g>

            {/* Perforations — only external glowing shot tips */}
            <g transform={`translate(${px}, ${py}) rotate(${pAngle})`}>
                {shots.map((offset, i) => (
                    <g key={i}>
                        {/* Left shot — short stub + glowing tip */}
                        <line x1={0} y1={offset} x2={-18} y2={offset}
                            stroke={perf} strokeWidth={1} opacity={0.4} />
                        <circle cx={-20} cy={offset} r={3}
                            fill={perf}
                            style={{ filter: 'drop-shadow(0 0 5px #39ff6aff)' }} />
                        {/* Right shot — short stub + glowing tip */}
                        <line x1={0} y1={offset} x2={18} y2={offset}
                            stroke={perf} strokeWidth={1} opacity={0.4} />
                        <circle cx={20} cy={offset} r={3}
                            fill={perf}
                            style={{ filter: 'drop-shadow(0 0 5px #39ff6aff)' }} />
                    </g>
                ))}
            </g>

        </g>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export const TrajectoryPlot: React.FC<TrajectoryPlotProps> = ({ survey, params }) => {
    const { t } = useLanguage();

    const cv = (n: string) => `rgb(var(${n}))`;
    const colorPrimary = cv('--color-primary');
    const colorSecondary = cv('--color-secondary');
    const colorTextMuted = cv('--color-text-muted');
    const colorSurfaceLight = cv('--color-surface-light');
    const colorSurface = cv('--color-surface');

    const { theme } = useTheme();
    const isDark = theme === 'fusion' || theme === 'cyber';

    const GEO = {
        soil: { pat: 'patSoil', label: 'TOPSOIL', color: isDark ? '#A07850' : '#8B5E3C' },
        limestone: { pat: 'patLimestone', label: 'LIMESTONE', color: isDark ? '#94A3B8' : '#64748B' },
        shale: { pat: 'patShale', label: 'SHALE', color: isDark ? '#475569' : '#334155' },
        sand: { pat: 'patSand', label: 'SANDSTONE', color: isDark ? '#CA8A04' : '#B45309' },
        salt: { pat: 'patSalt', label: 'SALT DOME', color: isDark ? '#E2E8F0' : '#CBD5E1' },
        granite: { pat: 'patGranite', label: 'GRANITE', color: isDark ? '#6B7280' : '#4B5563' },
        res: { pat: 'patRes', label: 'RESERVOIR', color: '#ffff20ff' },
    };

    const { processedData, tubingData, pumpDep, pumpTVD, perfsDep, perfsTVD, maxTVD, kopPoint } = useMemo(() => {
        let departure = 0;
        const data = survey.map((pt, i) => {
            if (i > 0) {
                const dMD = pt.md - survey[i - 1].md;
                const dTVD = pt.tvd - survey[i - 1].tvd;
                departure += Math.sqrt(Math.max(0, dMD ** 2 - dTVD ** 2));
            }
            return {
                departure: Math.round(departure),
                tvd: pt.tvd,
                md: pt.md,
                casedTvd: pt.md <= params.wellbore.casingBottom ? pt.tvd : null,
            };
        });

        const pumpTVDVal = interpolateTVD(params.pressures.pumpDepthMD, survey);
        const pumpPt = data.find(d => d.tvd >= pumpTVDVal);

        // --- NEW: Filter data for tubing line ---
        const tubingMDLimit = params.pressures.pumpDepthMD;
        const tubingD = data.filter(d => d.md <= tubingMDLimit);
        // Add exact end point for tubing if it falls between survey stations
        if (tubingMDLimit > 0 && (!tubingD.length || tubingD[tubingD.length - 1].md < tubingMDLimit)) {
            const exactTVD = interpolateTVD(tubingMDLimit, survey);
            const lastD = tubingD.length > 0 ? tubingD[tubingD.length - 1].departure : 0;
            const lastMD = tubingD.length > 0 ? tubingD[tubingD.length - 1].md : 0;
            const dMD = tubingMDLimit - lastMD;
            // Estimate departure change (simplified)
            const dTVD = exactTVD - (tubingD.length > 0 ? tubingD[tubingD.length - 1].tvd : 0);
            const dDep = Math.sqrt(Math.max(0, dMD ** 2 - dTVD ** 2));
            tubingD.push({
                md: tubingMDLimit,
                tvd: exactTVD,
                departure: lastD + dDep,
                casedTvd: tubingMDLimit <= params.wellbore.casingBottom ? exactTVD : null
            });
        }

        const perfsTVDVal = interpolateTVD(params.wellbore.midPerfsMD, survey);
        const perfsPt = data.find(d => d.tvd >= perfsTVDVal);
        const kop = data.find((d, i) =>
            i > 0 &&
            (d.departure - data[i - 1].departure) / Math.max(1, d.tvd - data[i - 1].tvd) > 0.035
        );
        return {
            processedData: data,
            tubingData: tubingD,
            pumpDep: pumpPt?.departure ?? 0,
            pumpTVD: pumpTVDVal,
            perfsDep: perfsPt?.departure ?? 0,
            perfsTVD: perfsTVDVal,
            maxTVD: Math.ceil(Math.max(...survey.map(s => s.tvd), 1000) / 1000) * 1000,
            kopPoint: kop,
        };
    }, [survey, params.wellbore.casingBottom, params.pressures.pumpDepthMD, params.wellbore.midPerfsMD]);

    const airGap = 400;
    const perfsTVDRange = maxTVD * 0.025;

    const layers = [
        { y1: 0, y2: maxTVD * 0.10, geo: GEO.soil },
        { y1: maxTVD * 0.10, y2: maxTVD * 0.25, geo: GEO.limestone },
        { y1: maxTVD * 0.25, y2: maxTVD * 0.45, geo: GEO.shale },
        { y1: maxTVD * 0.45, y2: maxTVD * 0.60, geo: GEO.salt },
        { y1: maxTVD * 0.60, y2: maxTVD * 0.75, geo: GEO.sand },
        { y1: maxTVD * 0.75, y2: maxTVD * 0.90, geo: GEO.granite },
        { y1: maxTVD * 0.90, y2: maxTVD * 1.5, geo: GEO.res },
    ];

    return (
        <div className="h-full flex flex-col glass-surface rounded-[2rem] border border-surface-light shadow-2xl overflow-hidden relative group select-none">
            <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--color-primary)/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--color-primary)/0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0" />

            {/* ── Header ── */}
            <div className="relative z-20 flex justify-between items-center px-8 py-5 border-b border-surface-light/30 bg-surface/40 backdrop-blur-xl shrink-0">
                <h3 className="text-sm font-black text-txt-main uppercase tracking-[0.3em] flex items-center gap-4">
                    <Map className="w-5 h-5 text-primary shadow-glow-primary" />
                    {t('p1.trajectory')}
                </h3>
                <div className="flex gap-3 flex-wrap">
                    {[
                        { dot: 'bg-slate-400', label: t('p1.casing_label') },
                        { dot: 'bg-secondary', label: t('p1.tubing_label') },
                    ].map(({ dot, label }) => (
                        <div key={label} className="flex items-center gap-2.5 px-4 py-2 rounded-xl glass-surface-light border border-white/5 shadow-inner">
                            <div className={`w-2 h-2 rounded-full ${dot}`} />
                            <span className="text-[10px] font-black text-txt-muted uppercase tracking-widest">{label}</span>
                        </div>
                    ))}

                </div>
            </div>

            {/* ── Chart ── */}
            <div className="relative z-10 flex-1 min-h-0 bg-canvas/50">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/20 blur-sm animate-scan z-0 pointer-events-none" />

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <defs>
                            {/* ─── TOPSOIL ─── */}
                            <pattern id="patSoil" patternUnits="userSpaceOnUse" width="18" height="18" patternTransform="rotate(38)">
                                <rect width="18" height="18" fill={GEO.soil.color} fillOpacity="0.25" />
                                <line x1="0" y1="5" x2="18" y2="5" stroke={GEO.soil.color} strokeWidth="1" opacity="0.3" />
                                <circle cx="4" cy="9" r="1" fill={GEO.soil.color} opacity="0.2" />
                            </pattern>
                            {/* ─── LIMESTONE ─── */}
                            <pattern id="patLimestone" patternUnits="userSpaceOnUse" width="40" height="24">
                                <rect width="40" height="24" fill={GEO.limestone.color} fillOpacity={0.15} />
                                <line x1="0" y1="0" x2="40" y2="0" stroke={GEO.limestone.color} strokeWidth="1" opacity="0.3" />
                                <line x1="20" y1="0" x2="20" y2="12" stroke={GEO.limestone.color} strokeWidth="1" opacity="0.3" />
                                <line x1="0" y1="12" x2="40" y2="12" stroke={GEO.limestone.color} strokeWidth="1" opacity="0.3" />
                                <line x1="0" y1="12" x2="0" y2="24" stroke={GEO.limestone.color} strokeWidth="1" opacity="0.3" />
                            </pattern>
                            {/* ─── SHALE ─── */}
                            <pattern id="patShale" patternUnits="userSpaceOnUse" width="52" height="14">
                                <rect width="52" height="14" fill={GEO.shale.color} fillOpacity="0.15" />
                                <line x1="0" y1="4" x2="40" y2="4" stroke={GEO.shale.color} strokeWidth="1.5" opacity="0.3" />
                                <line x1="10" y1="10" x2="50" y2="10" stroke={GEO.shale.color} strokeWidth="0.8" opacity="0.2" />
                            </pattern>
                            {/* ─── SALT DOME ─── */}
                            <pattern id="patSalt" patternUnits="userSpaceOnUse" width="30" height="30">
                                <rect width="30" height="30" fill={GEO.salt.color} fillOpacity={0.1} />
                                <path d="M 5,5 L 10,10 M 20,20 L 25,25" stroke={GEO.salt.color} strokeWidth="1" opacity="0.2" />
                                <path d="M 25,5 L 20,10 M 10,20 L 5,25" stroke={GEO.salt.color} strokeWidth="1" opacity="0.2" />
                            </pattern>
                            {/* ─── SANDSTONE ─── */}
                            <pattern id="patSand" patternUnits="userSpaceOnUse" width="14" height="14">
                                <rect width="14" height="14" fill={GEO.sand.color} fillOpacity="0.15" />
                                <circle cx="3" cy="3" r="1.2" fill={GEO.sand.color} opacity="0.4" />
                                <circle cx="11" cy="11" r="1" fill={GEO.sand.color} opacity="0.3" />
                            </pattern>
                            {/* ─── GRANITE ─── */}
                            <pattern id="patGranite" patternUnits="userSpaceOnUse" width="100" height="100">
                                <rect width="100" height="100" fill={GEO.granite.color} fillOpacity={0.15} />
                                <path d="M 10,10 L 20,20 M 60,70 L 80,90" stroke={GEO.granite.color} strokeWidth="2" opacity="0.2" />
                            </pattern>
                            {/* ─── RESERVOIR ─── */}
                            <pattern id="patRes" patternUnits="userSpaceOnUse" width="22" height="22">
                                <rect width="22" height="22" fill={isDark ? "#011F17" : "#ECFDF5"} fillOpacity="0.9" />
                                <path d="M0 22 L22 0" stroke={GEO.res.color} strokeWidth="1.6" opacity={isDark ? 0.65 : 0.25} />
                                <circle cx="5" cy="5" r="2.2" fill={GEO.res.color} fillOpacity={isDark ? 0.5 : 0.2} />
                                <circle cx="17" cy="17" r="2.2" fill={GEO.res.color} fillOpacity={isDark ? 0.5 : 0.2} />
                            </pattern>

                            {/* ─── Sky ─── */}
                            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={isDark ? "#040A14" : "#F8FAFC"} stopOpacity={0.1} />
                                <stop offset="100%" stopColor={isDark ? "#0D1E38" : "#F1F5F9"} stopOpacity={0} />
                            </linearGradient>
                            {/* ─── Casing metallic ─── */}
                            <linearGradient id="casingGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#1E293B" />
                                <stop offset="28%" stopColor="#64748B" />
                                <stop offset="52%" stopColor="#E2E8F0" />
                                <stop offset="72%" stopColor="#94A3B8" />
                                <stop offset="100%" stopColor="#1E293B" />
                            </linearGradient>
                            {/* ─── Pay zone glow ─── */}
                            <linearGradient id="payGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#fdf7afff" stopOpacity="0" />
                                <stop offset="20%" stopColor="#fff461ff" stopOpacity="0.07" />
                                <stop offset="80%" stopColor="#fff716ff" stopOpacity="0.07" />
                                <stop offset="100%" stopColor="#fffd94ff" stopOpacity="0" />
                            </linearGradient>
                            {/* ─── Filters ─── */}
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>

                        <ReferenceArea y1={-airGap} y2={0} fill="url(#skyGrad)" />

                        {layers.map((l, i) => (
                            <ReferenceArea key={i} y1={l.y1} y2={l.y2}
                                fill={`url(#${l.geo.pat})`} fillOpacity={1} />
                        ))}

                        <ReferenceArea
                            y1={perfsTVD - perfsTVDRange * 2.5}
                            y2={perfsTVD + perfsTVDRange * 2.5}
                            fill="url(#payGrad)" />

                        <ReferenceLine y={0} stroke="#4B5563" strokeWidth={2.5} />
                        <CartesianGrid stroke={colorSurfaceLight} strokeDasharray="2 8" opacity={0.18} />

                        <XAxis
                            dataKey="departure"
                            type="number"
                            orientation="top"
                            domain={[0, (max: number) => Math.max(max + 1800, 3500)]}
                            tick={{ fill: colorTextMuted, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
                            axisLine={{ stroke: colorSurfaceLight }}
                            tickLine={false}
                        />
                        <YAxis
                            dataKey="tvd"
                            type="number"
                            reversed
                            domain={[-airGap, maxTVD]}
                            tick={{ fill: colorTextMuted, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
                            axisLine={{ stroke: colorSurfaceLight }}
                            tickLine={false}
                            width={62}
                        />

                        <Tooltip content={
                            <CustomTooltip
                                colorSurface={colorSurface}
                                colorSurfaceLight={colorSurfaceLight}
                                colorTextMuted={colorTextMuted}
                            />
                        } />

                        <ReferenceLine y={params.totalDepthMD} stroke="#EF4444" strokeWidth={1.5} strokeDasharray="5 4"
                            label={{ position: 'insideBottomRight', value: `▼ ${t('p1.td')}`, fill: '#EF4444', fontSize: 11, fontWeight: 'bold' }} />

                        {kopPoint && (
                            <ReferenceDot x={kopPoint.departure} y={kopPoint.tvd} r={0}>
                                <Label content={({ viewBox }: any) => {
                                    const { x, y } = viewBox;
                                    return (
                                        <g transform={`translate(${x}, ${y})`}>
                                            <circle cx={0} cy={0} r={13} fill="none" stroke={colorSecondary} strokeWidth={1} opacity={0.35} />
                                            <circle cx={0} cy={0} r={7} fill="none" stroke={colorSecondary} strokeWidth={1.5} opacity={0.65} />
                                            <circle cx={0} cy={0} r={3} fill={colorSecondary} filter="url(#glow)" />
                                            {[0, 90, 180, 270].map(a => (
                                                <line key={a}
                                                    x1={Math.cos(a * Math.PI / 180) * 9} y1={Math.sin(a * Math.PI / 180) * 9}
                                                    x2={Math.cos(a * Math.PI / 180) * 16} y2={Math.sin(a * Math.PI / 180) * 16}
                                                    stroke={colorSecondary} strokeWidth={1.5} />
                                            ))}
                                            <rect x={18} y={-11} width={40} height={22} rx={5}
                                                fill={colorSecondary} fillOpacity={0.15}
                                                stroke={colorSecondary} strokeWidth={1} strokeOpacity={0.5} />
                                            <text x={38} y={4} textAnchor="middle" fill={colorSecondary}
                                                fontSize={10} fontWeight="800" fontFamily="monospace">
                                                {t('p1.kop')}
                                            </text>
                                        </g>
                                    );
                                }} />
                            </ReferenceDot>
                        )}

                        {/* Wellbore lines */}
                        <Line type="monotone" dataKey="tvd" stroke="#000" strokeWidth={20}
                            dot={false} isAnimationActive={false} strokeOpacity={0.28} />

                        {/* CASING */}
                        <Line type="monotone" dataKey="casedTvd" stroke="url(#casingGrad)" strokeWidth={10}
                            dot={false} isAnimationActive={true} connectNulls={false} strokeLinecap="round" />
                        <Line type="monotone" dataKey="casedTvd" stroke="#030712" strokeWidth={3}
                            dot={false} isAnimationActive={false} connectNulls={false} strokeOpacity={0.75} />

                        {/* OPEN HOLE / BOREHOLE */}
                        <Line type="monotone" dataKey="tvd" stroke="#374151" strokeWidth={5}
                            dot={false} isAnimationActive={false} strokeOpacity={0.55} strokeDasharray="5 4" />

                        {/* TUBING (Inner String) — Now correctly stops at Pump Depth */}
                        <Line
                            type="monotone"
                            data={tubingData}
                            dataKey="tvd"
                            stroke={colorPrimary}
                            strokeWidth={3}
                            dot={false}
                            strokeDasharray="10 5"
                            isAnimationActive={true}
                            animationDuration={2000}
                            filter="url(#glow)"
                        />

                        <Customized component={(props: any) => <DrillingRig {...props} theme={theme} />} />

                        <Customized component={(props: any) => (
                            <WellboreSymbols
                                {...props}
                                processedData={processedData}
                                pumpDep={pumpDep}
                                pumpTVD={pumpTVD}
                                perfsDep={perfsDep}
                                perfsTVD={perfsTVD}
                                perfsTVDRange={perfsTVDRange}
                                colorPrimary={colorPrimary}
                                colorTextMuted={colorTextMuted}
                                payZoneLabel={t('p1.pay_zone')}
                                theme={theme}
                            />
                        )} />

                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};