import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw, Play, Pause, AlertTriangle, Shield, Maximize2, X } from 'lucide-react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
    Tooltip, ReferenceLine, ReferenceArea, Customized, ReferenceDot, Label
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
// Custom Tooltip for 2D View
// ─────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, colorSurface, colorSurfaceLight, colorTextMuted, params, pumpTVD, perfsTVD }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const isCased = d.md <= params.wellbore.casingBottom;
    const zoneName = isCased ? 'Cased Hole' : 'Open Hole';
    const zoneColor = isCased ? '#0040ffff' : '#fbbf24';
    let equipment = null;
    if (Math.abs(d.tvd - pumpTVD) < 30) equipment = { name: 'BOMBA ESP', color: '#0ea5e9' };
    else if (Math.abs(d.tvd - perfsTVD) < 50) equipment = { name: 'PERFORACIONES', color: '#f59e0b' };
    return (
        <div style={{
            background: `${colorSurface}f2`, border: `1px solid ${colorSurfaceLight}`,
            borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)',
            minWidth: 190, backdropFilter: 'blur(16px)', zIndex: 1000
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 5 }}>
                <span style={{ color: zoneColor, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em' }}>{zoneName}</span>
                {equipment && <span style={{ background: `${equipment.color}20`, color: equipment.color, fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>{equipment.name}</span>}
            </div>
            {[
                { label: 'TVD', value: `${Math.round(d?.tvd ?? 0)} ft`, color: '#38bdf8' },
                { label: 'MD', value: `${Math.round(d?.md ?? 0)} ft`, color: '#a78bfa' },
                { label: 'Departure', value: `${Math.round(d?.departure ?? 0)} ft`, color: '#34d399' },
            ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 4 }}>
                    <span style={{ color: colorTextMuted, fontSize: 9, fontWeight: 600 }}>{label}</span>
                    <span style={{ color, fontSize: 9, fontWeight: 800 }}>{value}</span>
                </div>
            ))}
        </div>
    );
};

const InclinationTooltip = ({ active, payload, colorSurface, colorSurfaceLight, colorTextMuted }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
        <div style={{ background: `${colorSurface}f2`, border: `1px solid ${colorSurfaceLight}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)' }}>
            <div style={{ color: '#38bdf8', fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', marginBottom: 5 }}>INCLINACIÓN</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 4 }}>
                <span style={{ color: colorTextMuted, fontSize: 9, fontWeight: 600 }}>MD</span>
                <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>{Math.round(d.md)} ft</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 4 }}>
                <span style={{ color: colorTextMuted, fontSize: 9, fontWeight: 600 }}>Inc</span>
                <span style={{ color: '#38bdf8', fontSize: 9, fontWeight: 800 }}>{d.inc?.toFixed(2)}°</span>
            </div>
        </div>
    );
};

const DoglegTooltip = ({ active, payload, colorSurface, colorSurfaceLight, colorTextMuted }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const isDangerous = d.dogleg > 3;
    return (
        <div style={{ background: `${colorSurface}f2`, border: `1px solid ${colorSurfaceLight}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)' }}>
            <div style={{ color: isDangerous ? '#ef4444' : '#f59e0b', fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', marginBottom: 5 }}>DLS {isDangerous && '⚠'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 4 }}>
                <span style={{ color: colorTextMuted, fontSize: 9, fontWeight: 600 }}>MD</span>
                <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>{Math.round(d.md)} ft</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 4 }}>
                <span style={{ color: colorTextMuted, fontSize: 9, fontWeight: 600 }}>DLS</span>
                <span style={{ color: isDangerous ? '#ef4444' : '#f59e0b', fontSize: 9, fontWeight: 800 }}>{d.dogleg?.toFixed(2)}°/100ft</span>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Drilling Rig SVG (2D overlay)
// ─────────────────────────────────────────────────────────────────────────────
const DrillingRig = (props: any) => {
    const { xAxisMap, yAxisMap, theme } = props;
    const xKey = Object.keys(xAxisMap ?? {})[0];
    const yKey = Object.keys(yAxisMap ?? {})[0];
    const xScale = xAxisMap?.[xKey]?.scale;
    const yScale = yAxisMap?.[yKey]?.scale;
    if (!xScale || !yScale) return null;
    const isDark = theme === 'fusion' || theme === 'cyber';
    const rx = xScale(0);
    const ry = yScale(0);
    const scale = 0.45;
    return (
        <g transform={`translate(${rx - 25 * scale}, ${ry - 78 * scale}) scale(${scale})`} style={{ pointerEvents: 'none' }}>
            <path d="M 25 10 L 5 78 L 45 78 Z" fill="none" stroke={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"} strokeWidth={1.2} />
            <path d="M 25 10 L 25 78" stroke={isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)"} strokeWidth={1.5} />
            {[-12, 10, 32, 54].map(dy => (
                <line key={dy} x1={25 - (78 - dy) * 0.25} y1={dy} x2={25 + (78 - dy) * 0.25} y2={dy}
                    stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"} strokeWidth={1} />
            ))}
            <rect x={12} y={78} width={26} height={6} fill={isDark ? "#1e293b" : "#e2e8f0"} stroke={isDark ? "#475569" : "#cbd5e1"} strokeWidth={1} rx={1} />
            <circle cx={25} cy={10} r={2} fill={isDark ? "#ef4444" : "#dc2626"} />
        </g>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2D Wellbore Symbols
// ─────────────────────────────────────────────────────────────────────────────
const getSmoothAngleDeg = (mdVal: number, processedData: any[], xScale: (v: number) => number, yScale: (v: number) => number): number => {
    const idx = processedData.findIndex((d: any) => d.md >= mdVal);
    if (idx < 1) return 0;
    const p0 = processedData[idx - 1];
    const p1 = processedData[idx];
    const sdx = xScale(p1.departure) - xScale(p0.departure);
    const sdy = yScale(p1.tvd) - yScale(p0.tvd);
    const len = Math.sqrt(sdx * sdx + sdy * sdy);
    if (len < 0.001) return 0;
    return Math.atan2(sdx, sdy) * 180 / Math.PI;
};

const WellboreSymbols = ({ xAxisMap, yAxisMap, processedData, pumpDep, pumpTVD, pumpMD, perfsDep, perfsTVD, perfsMD, perfsTVDRange, colorPrimary, colorTextMuted, theme }: any) => {
    const xKey = Object.keys(xAxisMap ?? {})[0];
    const yKey = Object.keys(yAxisMap ?? {})[0];
    const xScale = xAxisMap?.[xKey]?.scale;
    const yScale = yAxisMap?.[yKey]?.scale;
    if (!xScale || !yScale) return null;
    const isDark = theme === 'fusion' || theme === 'cyber';
    const ac = colorPrimary;
    const perf = isDark ? '#D97706' : '#78350F';
    const ex = xScale(pumpDep); const ey = yScale(pumpTVD);
    const px = xScale(perfsDep); const py = yScale(perfsTVD);
    const eAngle = getSmoothAngleDeg(pumpMD, processedData, xScale, yScale);
    const pAngle = getSmoothAngleDeg(perfsMD, processedData, xScale, yScale);
    const rawPx = Math.abs(yScale(perfsTVD + perfsTVDRange) - yScale(perfsTVD));
    const halfInt = Math.max(16, Math.min(34, rawPx));
    const shots = [-halfInt * 0.85, -halfInt * 0.5, -halfInt * 0.2, 0, halfInt * 0.2, halfInt * 0.5, halfInt * 0.85];
    const PH = 13; const PW = 3;
    return (
        <g>
            <circle cx={ex} cy={ey} r={10} fill="none" stroke={ac} strokeWidth={1} strokeOpacity={0.2} />
            <g transform={`translate(${ex}, ${ey}) rotate(${eAngle})`}>
                <rect x={-PW - 1.5} y={-PH - 1.5} width={(PW + 1.5) * 2} height={(PH + 1.5) * 2} rx={3} fill={isDark ? "#0A1628" : "#EFF6FF"} stroke={ac} strokeWidth={1.2} />
                {[-PH * 0.55, 0, PH * 0.55].map((bandY, i) => (
                    <rect key={i} x={-PW - 0.5} y={bandY - 2.5} width={(PW + 0.5) * 2} height={4} rx={1} fill={ac} fillOpacity={0.35} stroke={ac} strokeWidth={0.5} />
                ))}
                <line x1={0} y1={-PH} x2={0} y2={PH} stroke={ac} strokeWidth={0.6} opacity={0.5} />
                <rect x={-1.5} y={-PH - 6} width={3} height={6} rx={1} fill={ac} fillOpacity={0.7} />
                <rect x={-2} y={PH} width={4} height={5} rx={1} fill={ac} fillOpacity={0.4} stroke={ac} strokeWidth={0.5} strokeDasharray="2 1" />
            </g>
            <circle cx={ex} cy={ey} r={2.5} fill={ac} />
            <g transform={`translate(${ex + 16}, ${ey - 20})`}>
                <rect x={0} y={0} width={80} height={36} rx={4} fill={isDark ? "rgba(10,20,35,0.88)" : "rgba(248,250,252,0.92)"} stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"} strokeWidth={1} />
                <rect x={0} y={0} width={2.5} height={36} fill={ac} />
                <text x={8} y={12} fill={ac} fontSize={8} fontWeight="900" fontFamily="monospace">ESP PUMP</text>
                <text x={8} y={23} fill={colorTextMuted} fontSize={7} fontFamily="monospace">MD: {Math.round(pumpMD)}'</text>
                <text x={8} y={32} fill={isDark ? "#fff" : "#000"} fontSize={7} fontWeight="800" fontFamily="monospace">TVD: {Math.round(pumpTVD)}'</text>
                <line x1={-10} y1={18} x2={0} y2={18} stroke={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)"} strokeWidth={0.5} />
            </g>
            <g transform={`translate(${px}, ${py}) rotate(${pAngle})`}>
                <rect x={-12} y={-halfInt} width={24} height={halfInt * 2} fill="url(#patRes)" fillOpacity={0.4} stroke={perf} strokeWidth={0.5} strokeOpacity={0.3} />
            </g>
            <g transform={`translate(${px}, ${py}) rotate(${pAngle})`}>
                {shots.map((offset, i) => (
                    <g key={i}>
                        <line x1={-15} y1={offset} x2={15} y2={offset} stroke={perf} strokeWidth={1} strokeOpacity={0.6} strokeDasharray="2 2" />
                        <rect x={-16} y={offset - 1} width={4} height={2} fill={perf} />
                        <rect x={12} y={offset - 1} width={4} height={2} fill={perf} />
                    </g>
                ))}
            </g>
            <g transform={`translate(${px + 24}, ${py - 10})`}>
                <rect x={0} y={0} width={88} height={36} rx={4} fill={isDark ? "rgba(20,15,10,0.92)" : "rgba(252,250,248,0.96)"} stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth={1} />
                <rect x={0} y={0} width={2.5} height={36} fill={perf} />
                <text x={8} y={12} fill={perf} fontSize={8} fontWeight="900" fontFamily="monospace">PERFORACIONES</text>
                <text x={8} y={23} fill={colorTextMuted} fontSize={7} fontFamily="monospace">MD: {Math.round(perfsMD)}'</text>
                <text x={8} y={32} fill={isDark ? "#fff" : "#000"} fontSize={7} fontWeight="800" fontFamily="monospace">TVD: {Math.round(perfsTVD)}'</text>
                <line x1={-20} y1={18} x2={0} y2={18} stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"} strokeWidth={0.5} />
            </g>
        </g>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN UNIFIED WORKSTATION COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const TrajectoryPlot: React.FC<TrajectoryPlotProps> = ({ survey, params }) => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const isDark = theme === 'fusion' || theme === 'cyber';

    const cv = (n: string) => `rgb(var(${n}))`;
    const colorPrimary = cv('--color-primary');
    const colorSecondary = cv('--color-secondary');
    const colorTextMuted = cv('--color-text-muted');
    const colorSurfaceLight = cv('--color-surface-light');
    const colorSurface = cv('--color-surface');

    // Expanded Panel state ('3d' | 'lithology' | 'inclination' | 'dls' | null)
    const [expandedPanel, setExpandedPanel] = useState<'3d' | 'lithology' | 'inclination' | 'dls' | null>(null);

    // 3D Color overlay
    const [colorOverlay3D, setColorOverlay3D] = useState<'structure' | 'inc' | 'dogleg'>('dogleg');
    const overlayOptions = [
        { mode: 'structure' as const, label: 'Estructura', color: colorPrimary },
        { mode: 'inc' as const, label: 'Inclinación', color: '#38bdf8' },
        { mode: 'dogleg' as const, label: 'DLS (Severidad)', color: '#fbbf24' }
    ];

    // 3D layers
    const [showGridCage3D, setShowGridCage3D] = useState(true);
    const [showShadows3D, setShowShadows3D] = useState(true);
    const [showGeologySlices, setShowGeologySlices] = useState(true);
    const [showRig3D, setShowRig3D] = useState(true);

    // 3D Camera
    const [yaw, setYaw] = useState(Math.PI / 4.5);
    const [pitch, setPitch] = useState(-Math.PI / 6.5);
    const [zoom, setZoom] = useState(1.05);
    const [isAutoRotating, setIsAutoRotating] = useState(true);
    const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const cameraStartRef = useRef<{ yaw: number; pitch: number } | null>(null);
    const animFrameRef = useRef<number>(0);

    const GEO = {
        soil: { pat: 'patSoil2', color: isDark ? '#855933' : '#a17a55' },
        limestone: { pat: 'patLimestone2', color: isDark ? '#64748b' : '#94a3b8' },
        shale: { pat: 'patShale2', color: isDark ? '#334155' : '#475569' },
        salt: { pat: 'patSalt2', color: isDark ? '#4b5563' : '#cbd5e1' },
        sand: { pat: 'patSand2', color: isDark ? '#b45309' : '#ca8a04' },
        granite: { pat: 'patGranite2', color: isDark ? '#3f3f46' : '#71717a' },
        res: { pat: 'patRes', color: '#ffea00' },
    };

    const hasAdv = useMemo(() => {
        return survey.some(s => (s.inc !== undefined && s.inc !== null && s.inc !== 0) || (s.dogleg !== undefined && s.dogleg !== null && s.dogleg !== 0));
    }, [survey]);

    const metrics = useMemo(() => {
        let maxDLS = 0; let maxInc = 0;
        survey.forEach(s => {
            if ((s.dogleg ?? 0) > maxDLS) maxDLS = s.dogleg;
            if ((s.inc ?? 0) > maxInc) maxInc = s.inc;
        });
        return { maxDLS, maxInc };
    }, [survey]);

    const { processedData, tubingData, pumpDep, pumpTVD, perfsDep, perfsTVD, maxTVD, kopPoint, stats } = useMemo(() => {
        let departure = 0;
        let data = survey.map((pt, i) => {
            if (i > 0) {
                const dMD = pt.md - survey[i - 1].md;
                const dTVD = pt.tvd - survey[i - 1].tvd;
                departure += Math.sqrt(Math.max(0, dMD ** 2 - dTVD ** 2));
            }
            return {
                x: pt.easting ?? departure,
                y: pt.northing ?? 0,
                z: pt.tvd,
                departure: Math.round(departure),
                tvd: pt.tvd,
                md: pt.md,
                casedTvd: pt.md <= params.wellbore.casingBottom ? pt.tvd : null,
                inc: pt.inc ?? 0,
                dogleg: pt.dogleg ?? 0,
            };
        });
        if (data.length > 0 && data[0].md > 0) {
            data = [{ x: 0, y: 0, z: 0, departure: 0, tvd: 0, md: 0, casedTvd: 0, inc: 0, dogleg: 0 }, ...data];
        }
        const pumpTVDVal = interpolateTVD(params.pressures.pumpDepthMD, survey);
        const pumpPt = data.find(d => d.tvd >= pumpTVDVal);
        const tubingMDLimit = params.pressures.pumpDepthMD;
        const tubingD = data.filter(d => d.md <= tubingMDLimit);
        if (tubingMDLimit > 0 && (!tubingD.length || tubingD[tubingD.length - 1].md < tubingMDLimit)) {
            const exactTVD = interpolateTVD(tubingMDLimit, survey);
            const lastD = tubingD.length > 0 ? tubingD[tubingD.length - 1].departure : 0;
            const lastMD = tubingD.length > 0 ? tubingD[tubingD.length - 1].md : 0;
            const dMD = tubingMDLimit - lastMD;
            const dTVD = exactTVD - (tubingD.length > 0 ? tubingD[tubingD.length - 1].tvd : 0);
            const dDep = Math.sqrt(Math.max(0, dMD ** 2 - dTVD ** 2));
            tubingD.push({ x: data.find(s => s.md >= tubingMDLimit)?.x ?? (lastD + dDep), y: 0, z: exactTVD, md: tubingMDLimit, tvd: exactTVD, departure: lastD + dDep, casedTvd: tubingMDLimit <= params.wellbore.casingBottom ? exactTVD : null, inc: survey.find(s => s.md >= tubingMDLimit)?.inc ?? 0, dogleg: survey.find(s => s.md >= tubingMDLimit)?.dogleg ?? 0 });
        }
        const perfsTVDVal = interpolateTVD(params.wellbore.midPerfsMD, survey);
        const perfsPt = data.find(d => d.tvd >= perfsTVDVal);
        const kop = data.find((d, i) => i > 0 && (d.departure - data[i - 1].departure) / Math.max(1, d.tvd - data[i - 1].tvd) > 0.035);
        const surveyMax = Math.max(...survey.map(s => s.tvd), 1000);
        const tdTVD = interpolateTVD(params.totalDepthMD, survey);
        return {
            processedData: data, tubingData: tubingD,
            pumpDep: pumpPt?.departure ?? 0, pumpTVD: pumpTVDVal,
            perfsDep: perfsPt?.departure ?? 0, perfsTVD: perfsTVDVal,
            maxTVD: Math.ceil(Math.max(surveyMax, tdTVD) / 1000) * 1000 + 500,
            kopPoint: kop,
            stats: { totalDeparture: Math.round(departure), maxMD: Math.round(Math.max(...survey.map(s => s.md))), maxTVD: Math.round(surveyMax) }
        };
    }, [survey, params]);

    const getIncColor = (inc: number) => { if (inc < 10) return '#10b981'; if (inc < 35) return '#38bdf8'; if (inc < 65) return '#f59e0b'; return '#ec4899'; };
    const getDlsColor = (dls: number) => { if (dls < 1.5) return '#10b981'; if (dls < 3.0) return '#eab308'; return '#ef4444'; };

    // ─────────────────────────────────────────────────────────────────────────
    // 3D Canvas Render
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const parent = canvas.parentElement;
        if (!parent) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = 0, maxZ = -Infinity;
        processedData.forEach(pt => { if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x; if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y; if (pt.z < minZ) minZ = pt.z; if (pt.z > maxZ) maxZ = pt.z; });
        const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2, centerZ = (minZ + maxZ) / 2;
        const rangeX = Math.max(maxX - minX, 300), rangeY = Math.max(maxY - minY, 300), rangeZ = Math.max(maxZ - minZ, 1200);
        const maxRange = Math.max(rangeX, rangeY, rangeZ, 150);

        const dpr = window.devicePixelRatio || 1;
        const w = parent.clientWidth;
        const h = Math.max(320, parent.clientHeight);
        canvas.width = w * dpr; canvas.height = h * dpr;
        canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        const project = (x3d: number, y3d: number, z3d: number) => {
            const tx = x3d - centerX, ty = y3d - centerY, tz = z3d - centerZ;
            const rx1 = tx * Math.cos(yaw) - ty * Math.sin(yaw);
            const ry1 = tx * Math.sin(yaw) + ty * Math.cos(yaw);
            const ry2 = ry1 * Math.cos(pitch) - tz * Math.sin(pitch);
            const rz2 = ry1 * Math.sin(pitch) + tz * Math.cos(pitch);
            const viewportScale = Math.min(w, h) * 0.72 / maxRange;
            return { x: w / 2 + rx1 * viewportScale * zoom, y: h / 2 + ry2 * viewportScale * zoom, depth: rz2 };
        };

        const projectedPoints = processedData.map(pt => ({ ...project(pt.x, pt.y, pt.z), pt }));

        function drawText(text: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'left') {
            ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
            ctx.strokeStyle = isDark ? '#020617' : '#ffffff'; ctx.lineWidth = 3.5; ctx.strokeText(text, x, y);
            ctx.fillStyle = fill; ctx.fillText(text, x, y); ctx.restore();
        }

        // Surface grid
        if (showRig3D) {
            ctx.lineWidth = 0.6;
            ctx.strokeStyle = isDark ? 'rgba(16,185,129,0.08)' : 'rgba(5,150,105,0.12)';
            const steps = 6;
            const xStep = (maxX - minX + 200) / steps, yStep = (maxY - minY + 200) / steps;
            for (let i = 0; i <= steps; i++) {
                const curX = minX - 100 + i * xStep;
                const p1 = project(curX, minY - 100, 0), p2 = project(curX, maxY + 100, 0);
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            }
            for (let i = 0; i <= steps; i++) {
                const curY = minY - 100 + i * yStep;
                const p1 = project(minX - 100, curY, 0), p2 = project(maxX + 100, curY, 0);
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            }
        }

        // Geology slices
        if (showGeologySlices) {
            const geoPlanes = [
                { z: maxZ * 0.2, color: isDark ? 'rgba(94,116,140,0.05)' : 'rgba(148,163,184,0.07)', label: 'Caliza / Lutita' },
                { z: maxZ * 0.5, color: isDark ? 'rgba(161,98,7,0.05)' : 'rgba(217,119,6,0.06)', label: 'Lutita / Arenisca' },
                { z: maxZ * 0.85, color: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.07)', label: 'Tope Reservorio' }
            ];
            geoPlanes.forEach(plane => {
                const c1 = project(minX - 100, minY - 100, plane.z), c2 = project(maxX + 100, minY - 100, plane.z);
                const c3 = project(maxX + 100, maxY + 100, plane.z), c4 = project(minX - 100, maxY + 100, plane.z);
                ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y); ctx.closePath();
                ctx.fillStyle = plane.color; ctx.fill();
                ctx.lineWidth = 0.5; ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; ctx.stroke();
                drawText(`${Math.round(plane.z)} ft`, c2.x + 8, c2.y, 'bold 7.5px monospace', isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)');
            });
        }

        // Grid cage
        if (showGridCage3D) {
            const cageVertices = [
                { x: minX, y: minY, z: minZ }, { x: maxX, y: minY, z: minZ }, { x: maxX, y: maxY, z: minZ }, { x: minX, y: maxY, z: minZ },
                { x: minX, y: minY, z: maxZ }, { x: maxX, y: minY, z: maxZ }, { x: maxX, y: maxY, z: maxZ }, { x: minX, y: maxY, z: maxZ }
            ].map(v => project(v.x, v.y, v.z));
            ctx.lineWidth = 0.8; ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
            ctx.beginPath(); ctx.moveTo(cageVertices[0].x, cageVertices[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(cageVertices[i].x, cageVertices[i].y); ctx.closePath(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cageVertices[4].x, cageVertices[4].y); for (let i = 5; i < 8; i++) ctx.lineTo(cageVertices[i].x, cageVertices[i].y); ctx.closePath(); ctx.stroke();
            for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cageVertices[i].x, cageVertices[i].y); ctx.lineTo(cageVertices[i + 4].x, cageVertices[i + 4].y); ctx.stroke(); }
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
            const divisions = 5;
            for (let i = 1; i < divisions; i++) {
                const curZ = minZ + (i / divisions) * (maxZ - minZ);
                const pL1 = project(minX, minY, curZ), pL2 = project(maxX, minY, curZ), pL3 = project(maxX, maxY, curZ), pL4 = project(minX, maxY, curZ);
                ctx.beginPath(); ctx.moveTo(pL1.x, pL1.y); ctx.lineTo(pL2.x, pL2.y); ctx.lineTo(pL3.x, pL3.y); ctx.lineTo(pL4.x, pL4.y); ctx.closePath(); ctx.stroke();
            }
            drawText(`N (${Math.round(minY)} ft)`, cageVertices[0].x - 10, cageVertices[0].y - 8, 'bold 8px monospace', isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)', 'right');
            drawText(`S (${Math.round(maxY)} ft)`, cageVertices[2].x + 10, cageVertices[2].y + 12, 'bold 8px monospace', isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)', 'left');
            drawText(`W (${Math.round(minX)} ft)`, cageVertices[3].x - 10, cageVertices[3].y + 12, 'bold 8px monospace', isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)', 'right');
            drawText(`E (${Math.round(maxX)} ft)`, cageVertices[1].x + 10, cageVertices[1].y - 8, 'bold 8px monospace', isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)', 'left');
            drawText(`TVD: ${Math.round(maxZ)} ft`, cageVertices[6].x + 10, cageVertices[6].y, 'bold 8.5px monospace', isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.65)', 'left');
        }

        // Shadows
        if (showShadows3D) {
            ctx.beginPath();
            projectedPoints.forEach((p, idx) => { const sh = project(p.pt.x, p.pt.y, maxZ); idx === 0 ? ctx.moveTo(sh.x, sh.y) : ctx.lineTo(sh.x, sh.y); });
            ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(56,189,248,0.12)'; ctx.stroke();
            ctx.beginPath();
            projectedPoints.forEach((p, idx) => { const sh = project(maxX, p.pt.y, p.pt.z); idx === 0 ? ctx.moveTo(sh.x, sh.y) : ctx.lineTo(sh.x, sh.y); });
            ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(245,158,11,0.12)'; ctx.stroke();
        }

        // Rig
        if (showRig3D) {
            const d1 = project(-18, -18, 0), d2 = project(18, -18, 0), d3 = project(18, 18, 0), d4 = project(-18, 18, 0), dTop = project(0, 0, -58);
            ctx.lineWidth = 1; ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.5)';
            ctx.beginPath(); ctx.moveTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y); ctx.lineTo(d3.x, d3.y); ctx.lineTo(d4.x, d4.y); ctx.closePath();
            ctx.fillStyle = isDark ? 'rgba(30,41,59,0.3)' : 'rgba(226,232,240,0.4)'; ctx.fill(); ctx.stroke();
            [d1, d2, d3, d4].forEach(leg => { ctx.beginPath(); ctx.moveTo(leg.x, leg.y); ctx.lineTo(dTop.x, dTop.y); ctx.stroke(); });
            [0.33, 0.66].forEach(ratio => {
                const subPts = [d1, d2, d3, d4].map(leg => ({ x: leg.x + (dTop.x - leg.x) * ratio, y: leg.y + (dTop.y - leg.y) * ratio }));
                ctx.beginPath(); ctx.moveTo(subPts[0].x, subPts[0].y); for (let k = 1; k < 4; k++) ctx.lineTo(subPts[k].x, subPts[k].y); ctx.closePath(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(subPts[0].x, subPts[0].y); ctx.lineTo(subPts[2].x, subPts[2].y); ctx.moveTo(subPts[1].x, subPts[1].y); ctx.lineTo(subPts[3].x, subPts[3].y); ctx.stroke();
            });
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(dTop.x, dTop.y, 2.5, 0, Math.PI * 2); ctx.fill();
            drawText('▲ TORRE', dTop.x, dTop.y - 11, 'bold 8px sans-serif', isDark ? '#fff' : '#0f172a', 'center');
        }

        // Wellbore glow
        ctx.beginPath();
        projectedPoints.forEach((p, idx) => { idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
        ctx.lineWidth = 12; ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.008)'; ctx.stroke();

        // Wellbore segments
        for (let i = 1; i < projectedPoints.length; i++) {
            const p0 = projectedPoints[i - 1], p1 = projectedPoints[i];
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
            if (colorOverlay3D === 'structure') {
                ctx.strokeStyle = p1.pt.md <= params.wellbore.casingBottom ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#d97706' : '#b45309');
            } else if (colorOverlay3D === 'inc') {
                ctx.strokeStyle = getIncColor(p1.pt.inc);
            } else {
                ctx.strokeStyle = getDlsColor(p1.pt.dogleg);
            }
            const depthFactor = (p1.depth + maxRange) / (maxRange * 2);
            ctx.lineWidth = Math.max(1.8, depthFactor * 4.5 + 2.2); ctx.stroke();
        }

        // ESP pump
        const pumpPtIdx = projectedPoints.findIndex(p => p.pt.md >= params.pressures.pumpDepthMD);
        if (pumpPtIdx !== -1) {
            const pumpPt = projectedPoints[pumpPtIdx];
            const idx = processedData.findIndex(d => d.md >= params.pressures.pumpDepthMD);
            let eAngle = 0;
            if (idx > 0) { const p0 = projectedPoints[idx - 1]; eAngle = Math.atan2(pumpPt.x - p0.x, pumpPt.y - p0.y); }
            ctx.save(); ctx.translate(pumpPt.x, pumpPt.y); ctx.rotate(eAngle);
            const scaleFac = Math.max(0.6, (pumpPt.depth + maxRange) / (maxRange * 2)), wS = 3 * scaleFac;
            ctx.fillStyle = '#d97706'; ctx.fillRect(-wS - 0.5, 9 * scaleFac, (wS + 0.5) * 2, 14 * scaleFac);
            ctx.fillStyle = '#94a3b8'; ctx.fillRect(-wS, 3 * scaleFac, wS * 2, 6 * scaleFac);
            ctx.fillStyle = '#1e293b'; ctx.fillRect(-wS, -1 * scaleFac, wS * 2, 4 * scaleFac);
            ctx.fillStyle = '#0ea5e9'; ctx.fillRect(-wS, -17 * scaleFac, wS * 2, 16 * scaleFac);
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 0.5; ctx.strokeRect(-wS, -17 * scaleFac, wS * 2, 16 * scaleFac);
            ctx.restore();
            const pulse = 9 + Math.sin(Date.now() / 150) * 2;
            const glowG = ctx.createRadialGradient(pumpPt.x, pumpPt.y, 1, pumpPt.x, pumpPt.y, pulse);
            glowG.addColorStop(0, 'rgba(14,165,233,0.4)'); glowG.addColorStop(1, 'rgba(14,165,233,0)');
            ctx.fillStyle = glowG; ctx.beginPath(); ctx.arc(pumpPt.x, pumpPt.y, pulse, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(14,165,233,0.6)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pumpPt.x, pumpPt.y); ctx.lineTo(pumpPt.x + 30, pumpPt.y - 18); ctx.lineTo(pumpPt.x + 85, pumpPt.y - 18); ctx.stroke();
            drawText('⚡ ESP', pumpPt.x + 33, pumpPt.y - 22, 'bold 9px monospace', isDark ? '#fff' : '#0f172a');
            drawText(`MD: ${Math.round(params.pressures.pumpDepthMD)} ft`, pumpPt.x + 33, pumpPt.y - 10, 'bold 8px monospace', isDark ? '#38bdf8' : '#0284c7');
        }

        // Perforations
        const perfTopIdx = projectedPoints.findIndex(p => p.pt.md >= params.wellbore.midPerfsMD - 90);
        const perfBottomIdx = projectedPoints.findIndex(p => p.pt.md >= params.wellbore.midPerfsMD + 90);
        if (perfTopIdx !== -1 && perfBottomIdx !== -1) {
            ctx.beginPath();
            for (let i = perfTopIdx; i <= perfBottomIdx; i++) { i === perfTopIdx ? ctx.moveTo(projectedPoints[i].x, projectedPoints[i].y) : ctx.lineTo(projectedPoints[i].x, projectedPoints[i].y); }
            ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(245,158,11,0.22)'; ctx.stroke();
            for (let i = perfTopIdx; i <= perfBottomIdx; i += 2) {
                const p = projectedPoints[i];
                ctx.strokeStyle = 'rgba(245,158,11,0.5)'; ctx.lineWidth = 0.7;
                for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2.5) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(angle) * 6, p.y + Math.sin(angle) * 6); ctx.stroke(); }
            }
            const midPt = projectedPoints[Math.floor((perfTopIdx + perfBottomIdx) / 2)];
            ctx.strokeStyle = 'rgba(245,158,11,0.6)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(midPt.x, midPt.y); ctx.lineTo(midPt.x - 28, midPt.y + 20); ctx.lineTo(midPt.x - 82, midPt.y + 20); ctx.stroke();
            drawText('🎯 PERFS', midPt.x - 80, midPt.y + 14, 'bold 9px monospace', isDark ? '#fff' : '#0f172a');
            drawText(`MD: ${Math.round(params.wellbore.midPerfsMD)} ft`, midPt.x - 80, midPt.y + 26, 'bold 8px monospace', '#f59e0b');
        }

        // KOP
        if (kopPoint) {
            const kopPt = projectedPoints.find(p => Math.abs(p.pt.md - kopPoint.md) < 6);
            if (kopPt) {
                ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(kopPt.x, kopPt.y, 7, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#c084fc'; ctx.beginPath(); ctx.arc(kopPt.x, kopPt.y, 3, 0, Math.PI * 2); ctx.fill();
                drawText(`KOP: ${Math.round(kopPoint.md)} ft`, kopPt.x + 10, kopPt.y + 3, 'bold 8.5px monospace', '#c084fc');
            }
        }

        // Compass
        const cx = w - 52, cy = 56, r = 24;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(8,15,30,0.75)' : 'rgba(255,255,255,0.8)'; ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.2; ctx.stroke();
        [{ label: 'N', angle: 0, color: '#ef4444' }, { label: 'E', angle: Math.PI / 2, color: isDark ? '#fff' : '#000' }, { label: 'S', angle: Math.PI, color: isDark ? '#666' : '#555' }, { label: 'W', angle: -Math.PI / 2, color: isDark ? '#fff' : '#000' }].forEach(d => {
            const dynamicAngle = d.angle - yaw - Math.PI / 2;
            const lx = cx + Math.cos(dynamicAngle) * (r - 7), ly = cy + Math.sin(dynamicAngle) * (r - 7);
            ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = d.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.label, lx, ly);
        });
        ctx.beginPath(); ctx.moveTo(cx - 2.5, cy); ctx.lineTo(cx + 2.5, cy); ctx.moveTo(cx, cy - 2.5); ctx.lineTo(cx, cy + 2.5); ctx.strokeStyle = '#38bdf8'; ctx.stroke();
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.5)'; ctx.font = '6.5px monospace'; ctx.textAlign = 'right';
        ctx.fillText(`YAW: ${(yaw * 180 / Math.PI).toFixed(0)}°`, cx - r - 6, cy - 5);
        ctx.fillText(`ZOOM: ${zoom.toFixed(2)}x`, cx - r - 6, cy + 5);

        // Hover
        if (hoveredPointIdx !== null && hoveredPointIdx < projectedPoints.length) {
            const hPt = projectedPoints[hoveredPointIdx];
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(hPt.x, hPt.y, 4.5, 0, Math.PI * 2); ctx.fill();
            const boxW = 160, boxH = 82, bx = hPt.x + 16 + boxW > w ? hPt.x - 16 - boxW : hPt.x + 16, by = hPt.y - 38;
            ctx.fillStyle = isDark ? 'rgba(8,16,36,0.94)' : 'rgba(255,255,255,0.97)';
            ctx.strokeStyle = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 10); ctx.fill(); ctx.stroke();
            ctx.fillStyle = getIncColor(hPt.pt.inc); ctx.fillRect(bx, by + 4, 3.5, boxH - 8);
            ctx.fillStyle = isDark ? '#fff' : '#0f172a'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(`MD: ${Math.round(hPt.pt.md)} ft`, bx + 10, by + 9);
            ctx.font = '8px monospace'; ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
            ctx.fillText(`TVD: ${Math.round(hPt.pt.tvd)} ft`, bx + 10, by + 23);
            ctx.fillText(`Inc: ${hPt.pt.inc.toFixed(2)}°`, bx + 10, by + 35);
            ctx.fillText(`DLS: ${hPt.pt.dogleg.toFixed(2)}°/100ft`, bx + 10, by + 47);
            ctx.fillText(`X,Y: (${Math.round(hPt.pt.x)}, ${Math.round(hPt.pt.y)}) ft`, bx + 10, by + 59);
        }

    }, [processedData, yaw, pitch, zoom, colorOverlay3D, hoveredPointIdx, params, showGridCage3D, showShadows3D, showGeologySlices, showRig3D, isDark, expandedPanel]);

    // Auto-rotate
    useEffect(() => {
        if (!isAutoRotating) { cancelAnimationFrame(animFrameRef.current); return; }
        const loop = () => { setYaw(prev => prev + 0.004); animFrameRef.current = requestAnimationFrame(loop); };
        animFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [isAutoRotating]);

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsAutoRotating(false);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        cameraStartRef.current = { yaw, pitch };
    };
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (dragStartRef.current && cameraStartRef.current) {
            const dx = e.clientX - dragStartRef.current.x, dy = e.clientY - dragStartRef.current.y;
            setYaw(cameraStartRef.current.yaw - dx * 0.0075);
            setPitch(Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraStartRef.current.pitch + dy * 0.0075)));
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = 0, maxZ = -Infinity;
        processedData.forEach(pt => { if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x; if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y; if (pt.z < minZ) minZ = pt.z; if (pt.z > maxZ) maxZ = pt.z; });
        const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2, centerZ = (minZ + maxZ) / 2;
        const maxRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 150);
        const w = rect.width, h = rect.height;
        const viewportScale = Math.min(w, h) * 0.72 / maxRange;
        let closestIdx: number | null = null, closestDist = 18;
        processedData.forEach((pt, idx) => {
            const tx = pt.x - centerX, ty = pt.y - centerY, tz = pt.z - centerZ;
            const rx1 = tx * Math.cos(yaw) - ty * Math.sin(yaw);
            const ry1 = tx * Math.sin(yaw) + ty * Math.cos(yaw);
            const ry2 = ry1 * Math.cos(pitch) - tz * Math.sin(pitch);
            const sx = w / 2 + rx1 * viewportScale * zoom, sy = h / 2 + ry2 * viewportScale * zoom;
            const dist = Math.sqrt((sx - mouseX) ** 2 + (sy - mouseY) ** 2);
            if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
        });
        setHoveredPointIdx(closestIdx);
    };
    const handleMouseUp = () => { dragStartRef.current = null; cameraStartRef.current = null; };
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => { e.preventDefault(); setZoom(prev => Math.max(0.4, Math.min(4.5, prev - e.deltaY * 0.0012))); };

    const isDlsCritical = metrics.maxDLS >= 3.0;
    const airGap = 400;
    const perfsTVDRange = maxTVD * 0.025;

    const layers = [
        { y1: 0, y2: maxTVD * 0.10, geo: GEO.soil },
        { y1: maxTVD * 0.10, y2: maxTVD * 0.25, geo: GEO.limestone },
        { y1: maxTVD * 0.25, y2: maxTVD * 0.45, geo: GEO.shale },
        { y1: maxTVD * 0.45, y2: maxTVD * 0.60, geo: GEO.salt },
        { y1: maxTVD * 0.60, y2: maxTVD * 0.75, geo: GEO.sand },
        { y1: maxTVD * 0.75, y2: maxTVD * 0.90, geo: GEO.granite },
        { y1: maxTVD * 0.90, y2: 30000, geo: GEO.res },
    ];

    // Overlay toggle pill
    const panelAJX = (
        <div
            className={`transition-all duration-300 ${expandedPanel === '3d'
                ? 'fixed inset-0 z-[99999] bg-surface/98 backdrop-blur-xl p-6 flex flex-col'
                : 'relative overflow-hidden bg-surface/30 w-full h-full'
                }`}
            style={expandedPanel === '3d' ? {} : { gridColumn: '1', gridRow: '1 / 2' }}
        >
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="w-full h-full cursor-grab active:cursor-grabbing block"
            />
            {/* 3D panel label */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-surface/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-surface-light/25 z-10 animate-in fade-in">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Modelo 3D Interactivo</span>
                {expandedPanel !== '3d' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpandedPanel('3d'); }}
                        className="ml-2 flex items-center justify-center hover:text-primary transition-all text-txt-muted hover:scale-110 active:scale-95 pointer-events-auto"
                        title="Pantalla Completa"
                    >
                        <Maximize2 className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>

            {/* Floating Close Button for Fullscreen */}
            {expandedPanel === '3d' && (
                <button
                    onClick={(e) => { e.stopPropagation(); setExpandedPanel(null); }}
                    className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-all active:scale-95 animate-in fade-in"
                >
                    <X className="w-3.5 h-3.5" /> Cerrar Pantalla Completa
                </button>
            )}

            {/* Layer toggles floating in 3D panel */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 bg-surface/55 backdrop-blur-md p-2.5 rounded-xl border border-surface-light/25 z-10">
                {[
                    { key: 'rig', label: 'Torre', val: showRig3D, set: setShowRig3D },
                    { key: 'geo', label: 'Geología', val: showGeologySlices, set: setShowGeologySlices },
                    { key: 'cage', label: 'Rejilla', val: showGridCage3D, set: setShowGridCage3D },
                ].map(({ key, label, val, set }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <div
                            onClick={() => set(!val)}
                            className={`w-6 h-3 rounded-full transition-all relative ${val ? 'bg-primary/70' : 'bg-surface-light/40'}`}
                        >
                            <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${val ? 'left-3.5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-[7.5px] font-bold text-txt-muted uppercase tracking-widest">{label}</span>
                    </label>
                ))}
            </div>

            {/* 3D Unified Controls (bottom-left) */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-surface/55 backdrop-blur-md p-1.5 rounded-xl border border-surface-light/25 z-10">
                <span className="text-[7.5px] font-black text-txt-muted uppercase tracking-widest px-1">Giro:</span>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsAutoRotating(!isAutoRotating); }}
                    className="text-[7.5px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-surface-light/25 text-txt-muted hover:text-primary transition-all bg-surface-light/10 flex items-center justify-center min-w-6"
                >
                    {isAutoRotating ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setYaw(Math.PI / 4.5); setPitch(-Math.PI / 6.5); setZoom(1.05); }}
                    className="text-[7.5px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-surface-light/25 text-txt-muted hover:text-txt-main transition-all bg-surface-light/10 flex items-center justify-center min-w-6"
                    title="Restaurar Cámara"
                >
                    <RotateCw className="w-2.5 h-2.5" />
                </button>

                <div className="w-px h-3.5 bg-surface-light/35 mx-1" />

                <span className="text-[7.5px] font-black text-txt-muted uppercase tracking-widest px-1">Overlay 3D:</span>
                {overlayOptions.map(({ mode, label, color }) => (
                    <button
                        key={mode}
                        onClick={(e) => { e.stopPropagation(); setColorOverlay3D(mode); }}
                        style={{
                            borderColor: colorOverlay3D === mode ? color : 'transparent',
                            color: colorOverlay3D === mode ? color : undefined
                        }}
                        className={`text-[7.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all ${colorOverlay3D === mode ? 'bg-surface-light/35 font-extrabold' : 'text-txt-muted hover:text-txt-main'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );

    const panelBJX = (
        <div
            className={`transition-all duration-300 ${expandedPanel === 'lithology'
                ? 'fixed inset-0 z-[99999] bg-surface/98 backdrop-blur-xl p-6 flex flex-col'
                : 'relative overflow-hidden bg-surface/30 w-full h-full'
                }`}
            style={expandedPanel === 'lithology' ? {} : { gridColumn: '3', gridRow: '1 / 2' }}
        >
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-surface/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-surface-light/25 z-10 animate-in fade-in">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Perfil Litológico 2D</span>
                {expandedPanel !== 'lithology' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpandedPanel('lithology'); }}
                        className="ml-2 flex items-center justify-center hover:text-primary transition-all text-txt-muted hover:scale-110 active:scale-95 pointer-events-auto"
                        title="Pantalla Completa"
                    >
                        <Maximize2 className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>

            {/* Floating Close Button for Fullscreen */}
            {expandedPanel === 'lithology' && (
                <button
                    onClick={(e) => { e.stopPropagation(); setExpandedPanel(null); }}
                    className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-all active:scale-95 animate-in fade-in"
                >
                    <X className="w-3.5 h-3.5" /> Cerrar Pantalla Completa
                </button>
            )}

            {/* Dual-pill premium overview metrics */}
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-surface/60 backdrop-blur-sm p-1.5 rounded-xl border border-surface-light/25 z-10 pointer-events-none">
                <div className="flex flex-col items-end gap-0.5 px-1.5">
                    <span className="text-[6.5px] font-black text-txt-muted uppercase tracking-wider leading-none">Inclinación Máx.</span>
                    <span className="text-[9px] font-black text-sky-400 leading-none mt-0.5">{metrics.maxInc.toFixed(1)}°</span>
                </div>
                <div className="w-px h-5 bg-surface-light/35" />
                <div className="flex flex-col items-end gap-0.5 px-1.5">
                    <span className="text-[6.5px] font-black text-txt-muted uppercase tracking-wider leading-none">DLS Máximo</span>
                    <span className={`text-[9px] font-black leading-none mt-0.5 ${isDlsCritical ? 'text-red-400' : 'text-amber-400'}`}>{metrics.maxDLS.toFixed(2)}°</span>
                </div>
            </div>
            <div className={expandedPanel === 'lithology' ? "absolute inset-0 pt-20 pb-4 px-6" : "absolute inset-0 pt-14 pb-3 px-2"}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={processedData} margin={{ top: 24, right: 12, left: 10, bottom: 8 }}>
                        <defs>
                            <pattern id="patSoil2" patternUnits="userSpaceOnUse" width="18" height="18" patternTransform="rotate(38)">
                                <rect width="18" height="18" fill={GEO.soil.color} fillOpacity="0.25" />
                                <line x1="0" y1="5" x2="18" y2="5" stroke={GEO.soil.color} strokeWidth="1" opacity="0.3" />
                                <circle cx="4" cy="9" r="1" fill={GEO.soil.color} opacity="0.2" />
                            </pattern>
                            <pattern id="patLimestone2" patternUnits="userSpaceOnUse" width="40" height="24">
                                <rect width="40" height="24" fill={GEO.limestone.color} fillOpacity="0.15" />
                                <line x1="0" y1="0" x2="40" y2="0" stroke={GEO.limestone.color} strokeWidth="1" opacity="0.3" />
                                <line x1="20" y1="0" x2="20" y2="12" stroke={GEO.limestone.color} strokeWidth="1" opacity="0.3" />
                                <line x1="0" y1="12" x2="40" y2="12" stroke={GEO.limestone.color} strokeWidth="1" opacity="0.3" />
                            </pattern>
                            <pattern id="patShale2" patternUnits="userSpaceOnUse" width="52" height="14">
                                <rect width="52" height="14" fill={GEO.shale.color} fillOpacity="0.15" />
                                <line x1="0" y1="4" x2="40" y2="4" stroke={GEO.shale.color} strokeWidth="1.5" opacity="0.3" />
                                <line x1="10" y1="10" x2="50" y2="10" stroke={GEO.shale.color} strokeWidth="0.8" opacity="0.2" />
                            </pattern>
                            <pattern id="patSalt2" patternUnits="userSpaceOnUse" width="30" height="30">
                                <rect width="30" height="30" fill={GEO.salt.color} fillOpacity="0.1" />
                                <path d="M 5,5 L 10,10 M 20,20 L 25,25" stroke={GEO.salt.color} strokeWidth="1" opacity="0.2" />
                                <path d="M 25,5 L 20,10 M 10,20 L 5,25" stroke={GEO.salt.color} strokeWidth="1" opacity="0.2" />
                            </pattern>
                            <pattern id="patSand2" patternUnits="userSpaceOnUse" width="14" height="14">
                                <rect width="14" height="14" fill={GEO.sand.color} fillOpacity="0.15" />
                                <circle cx="3" cy="3" r="1.2" fill={GEO.sand.color} opacity="0.4" />
                                <circle cx="11" cy="11" r="1" fill={GEO.sand.color} opacity="0.3" />
                            </pattern>
                            <pattern id="patGranite2" patternUnits="userSpaceOnUse" width="100" height="100">
                                <rect width="100" height="100" fill={GEO.granite.color} fillOpacity="0.15" />
                                <path d="M 10,10 L 20,20 M 60,70 L 80,90" stroke={GEO.granite.color} strokeWidth="2" opacity="0.2" />
                            </pattern>
                            <pattern id="patRes" patternUnits="userSpaceOnUse" width="22" height="22">
                                <rect width="22" height="22" fill={isDark ? "#011F17" : "#ECFDF5"} fillOpacity="0.9" />
                                <path d="M0 22 L22 0" stroke={GEO.res.color} strokeWidth="1.6" opacity={isDark ? 0.65 : 0.25} />
                                <circle cx="5" cy="5" r="2.2" fill={GEO.res.color} fillOpacity={isDark ? 0.5 : 0.2} />
                                <circle cx="17" cy="17" r="2.2" fill={GEO.res.color} fillOpacity={isDark ? 0.5 : 0.2} />
                            </pattern>
                            <linearGradient id="skyGrad2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={isDark ? "#040A14" : "#F8FAFC"} stopOpacity={0.12} />
                                <stop offset="100%" stopColor={isDark ? "#0D1E38" : "#F1F5F9"} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="payGrad2" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#fdf7afff" stopOpacity="0" />
                                <stop offset="20%" stopColor="#fff461ff" stopOpacity="0.07" />
                                <stop offset="80%" stopColor="#fff716ff" stopOpacity="0.07" />
                                <stop offset="100%" stopColor="#fffd94ff" stopOpacity="0" />
                            </linearGradient>
                            <filter id="glow2">
                                <feGaussianBlur stdDeviation="2.5" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>

                        <ReferenceArea y1={-airGap} y2={0} fill="url(#skyGrad2)" />
                        {layers.map((l, i) => <ReferenceArea key={i} y1={l.y1} y2={l.y2} fill={`url(#${l.geo.pat})`} fillOpacity={1} />)}
                        <ReferenceArea y1={perfsTVD - perfsTVDRange * 2.5} y2={perfsTVD + perfsTVDRange * 2.5} fill="url(#payGrad2)" />
                        <ReferenceLine y={0} stroke="#4B5563" strokeWidth={2} />
                        <CartesianGrid stroke={colorSurfaceLight} strokeDasharray="2 8" opacity={0.15} />

                        <XAxis dataKey="departure" type="number" orientation="top" domain={[-200, (max: number) => Math.max(max + 1200, 2800)]}
                            tick={{ fill: colorTextMuted, fontSize: 8, fontWeight: 700 }} tickFormatter={(v) => (v < 0 ? '' : v)}
                            axisLine={{ stroke: colorSurfaceLight }} tickLine={false} />
                        <YAxis dataKey="tvd" type="number" reversed domain={[-airGap, maxTVD]}
                            tick={{ fill: colorTextMuted, fontSize: 8, fontWeight: 700 }} tickFormatter={(v) => (v < 0 ? '' : v)}
                            axisLine={{ stroke: colorSurfaceLight }} tickLine={false} width={48} />

                        <Tooltip shared content={<CustomTooltip colorSurface={colorSurface} colorSurfaceLight={colorSurfaceLight} colorTextMuted={colorTextMuted} params={params} pumpTVD={pumpTVD} perfsTVD={perfsTVD} />} />

                        <ReferenceLine y={params.totalDepthMD} stroke="#EF4444" strokeWidth={1.2} strokeDasharray="4 3"
                            label={{ position: 'insideBottomRight', value: `TD: ${params.totalDepthMD}ft`, fill: '#EF4444', fontSize: 9, fontWeight: 'bold' }} />

                        <Line type="linear" dataKey="tvd" stroke={colorSurfaceLight} strokeWidth={16} dot={false} isAnimationActive={false} strokeOpacity={0.7} />
                        <Line type="linear" dataKey="tvd" stroke={colorSurface} strokeWidth={12} dot={false} isAnimationActive={false} />
                        <Line type="linear" data={tubingData} dataKey="tvd" stroke={colorPrimary} strokeWidth={2.5} dot={false} isAnimationActive={true} animationDuration={1800} filter="url(#glow2)" />

                        <Customized component={(props: any) => <DrillingRig {...props} theme={theme} />} />
                        <Customized component={(props: any) => (
                            <WellboreSymbols {...props} processedData={processedData}
                                pumpDep={pumpDep} pumpTVD={pumpTVD} pumpMD={params.pressures.pumpDepthMD}
                                perfsDep={perfsDep} perfsTVD={perfsTVD} perfsMD={params.wellbore.midPerfsMD}
                                perfsTVDRange={perfsTVDRange} colorPrimary={colorPrimary} colorTextMuted={colorTextMuted}
                                payZoneLabel={t('p1.pay_zone')} theme={theme} />
                        )} />

                        {kopPoint && (
                            <ReferenceDot x={kopPoint.departure} y={kopPoint.tvd} r={0}>
                                <Label content={({ viewBox }: any) => {
                                    const { x, y } = viewBox;
                                    return (
                                        <g transform={`translate(${x}, ${y})`}>
                                            <circle cx={0} cy={0} r={11} fill="none" stroke={colorSecondary} strokeWidth={1} opacity={0.3} />
                                            <circle cx={0} cy={0} r={6} fill="none" stroke={colorSecondary} strokeWidth={1.2} opacity={0.6} />
                                            <circle cx={0} cy={0} r={2.5} fill={colorSecondary} filter="url(#glow2)" />
                                            {[0, 90, 180, 270].map(a => (
                                                <line key={a} x1={Math.cos(a * Math.PI / 180) * 8} y1={Math.sin(a * Math.PI / 180) * 8} x2={Math.cos(a * Math.PI / 180) * 14} y2={Math.sin(a * Math.PI / 180) * 14} stroke={colorSecondary} strokeWidth={1.2} />
                                            ))}
                                            <rect x={16} y={-9} width={34} height={18} rx={4} fill={colorSecondary} fillOpacity={0.12} stroke={colorSecondary} strokeWidth={0.8} strokeOpacity={0.45} />
                                            <text x={33} y={3} textAnchor="middle" fill={colorSecondary} fontSize={9} fontWeight="800" fontFamily="monospace">KOP</text>
                                        </g>
                                    );
                                }} />
                            </ReferenceDot>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );

    const panelCJX = (
        <div
            className={`transition-all duration-300 ${expandedPanel === 'inclination'
                ? 'fixed inset-0 z-[99999] bg-surface/98 backdrop-blur-xl p-6 flex flex-col'
                : 'relative overflow-hidden bg-surface/30 w-full h-full'
                }`}
            style={expandedPanel === 'inclination' ? {} : { gridColumn: '1', gridRow: '3' }}
        >
            <div className="absolute top-2 left-3 flex items-center gap-1.5 bg-surface/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-surface-light/25 z-10 animate-in fade-in">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Inclinación vs MD</span>
                {expandedPanel !== 'inclination' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpandedPanel('inclination'); }}
                        className="ml-2 flex items-center justify-center hover:text-primary transition-all text-txt-muted hover:scale-110 active:scale-95 pointer-events-auto"
                        title="Pantalla Completa"
                    >
                        <Maximize2 className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>

            {/* Floating Close Button for Fullscreen */}
            {expandedPanel === 'inclination' && (
                <button
                    onClick={(e) => { e.stopPropagation(); setExpandedPanel(null); }}
                    className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-all active:scale-95 animate-in fade-in"
                >
                    <X className="w-3.5 h-3.5" /> Cerrar Pantalla Completa
                </button>
            )}
            {!hasAdv ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <span className="text-[9px] font-bold text-txt-muted uppercase tracking-wider">Sin datos avanzados de inclinación</span>
                </div>
            ) : (
                <div className={expandedPanel === 'inclination' ? "absolute inset-0 pt-20 pb-4 px-6" : "absolute inset-0 pt-14 pb-2 px-2"}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart layout="vertical" data={processedData} margin={{ top: 28, right: 16, left: 42, bottom: 8 }}>
                            <CartesianGrid stroke={colorSurfaceLight} strokeDasharray="3 3" opacity={0.12} />
                            <XAxis type="number" domain={[0, 90]}
                                tick={{ fill: colorTextMuted, fontSize: 8, fontWeight: 700 }} tickFormatter={(v) => `${v}°`}
                                axisLine={{ stroke: colorSurfaceLight }} tickLine={false} />
                            <YAxis type="number" dataKey="md" domain={[stats.maxMD, 0]}
                                tick={{ fill: colorTextMuted, fontSize: 8, fontWeight: 700 }}
                                axisLine={{ stroke: colorSurfaceLight }} tickLine={false} width={38} />
                            <Tooltip content={<InclinationTooltip colorSurface={colorSurface} colorSurfaceLight={colorSurfaceLight} colorTextMuted={colorTextMuted} />} />
                            <ReferenceLine y={params.pressures.pumpDepthMD} stroke={colorPrimary} strokeWidth={1.5} strokeDasharray="3 2"
                                label={{ position: 'insideBottomRight', value: 'ESP', fill: colorPrimary, fontSize: 8, fontWeight: 'bold' }} />
                            <ReferenceLine y={params.wellbore.midPerfsMD} stroke="#D97706" strokeWidth={1.5} strokeDasharray="3 2"
                                label={{ position: 'insideBottomRight', value: 'PERFS', fill: '#D97706', fontSize: 8, fontWeight: 'bold' }} />
                            <Line layout="vertical" type="monotone" dataKey="inc" stroke="#38bdf8" strokeWidth={2.5} dot={false} filter="url(#glow2)" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );

    const panelDJX = (
        <div
            className={`transition-all duration-300 ${expandedPanel === 'dls'
                ? 'fixed inset-0 z-[99999] bg-surface/98 backdrop-blur-xl p-6 flex flex-col'
                : 'relative overflow-hidden bg-surface/30 w-full h-full'
                }`}
            style={expandedPanel === 'dls' ? {} : { gridColumn: '3', gridRow: '3' }}
        >
            <div className="absolute top-2 left-3 flex items-center gap-1.5 bg-surface/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-surface-light/25 z-10 animate-in fade-in">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDlsCritical ? 'bg-red-400' : 'bg-amber-400'}`} />
                <span className="text-[8px] font-black text-txt-muted uppercase tracking-widest">Severidad DLS vs MD</span>
                {expandedPanel !== 'dls' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpandedPanel('dls'); }}
                        className="ml-2 flex items-center justify-center hover:text-primary transition-all text-txt-muted hover:scale-110 active:scale-95 pointer-events-auto"
                        title="Pantalla Completa"
                    >
                        <Maximize2 className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>

            {/* Floating Close Button for Fullscreen */}
            {expandedPanel === 'dls' && (
                <button
                    onClick={(e) => { e.stopPropagation(); setExpandedPanel(null); }}
                    className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-all active:scale-95 animate-in fade-in"
                >
                    <X className="w-3.5 h-3.5" /> Cerrar Pantalla Completa
                </button>
            )}
            {!hasAdv ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <span className="text-[9px] font-bold text-txt-muted uppercase tracking-wider">Sin datos de dogleg</span>
                </div>
            ) : (
                <div className={expandedPanel === 'dls' ? "absolute inset-0 pt-20 pb-4 px-6" : "absolute inset-0 pt-14 pb-2 px-2"}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart layout="vertical" data={processedData} margin={{ top: 28, right: 16, left: 42, bottom: 8 }}>
                            <CartesianGrid stroke={colorSurfaceLight} strokeDasharray="3 3" opacity={0.12} />
                            <XAxis type="number" domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax))]}
                                tick={{ fill: colorTextMuted, fontSize: 8, fontWeight: 700 }} tickFormatter={(v) => `${v}°`}
                                axisLine={{ stroke: colorSurfaceLight }} tickLine={false} />
                            <YAxis type="number" dataKey="md" domain={[stats.maxMD, 0]}
                                tick={{ fill: colorTextMuted, fontSize: 8, fontWeight: 700 }}
                                axisLine={{ stroke: colorSurfaceLight }} tickLine={false} width={38} />
                            <Tooltip content={<DoglegTooltip colorSurface={colorSurface} colorSurfaceLight={colorSurfaceLight} colorTextMuted={colorTextMuted} />} />
                            <ReferenceArea x1={3} x2={12} fill="#ef4444" fillOpacity={0.06} />
                            <ReferenceLine x={3} stroke="#ef4444" strokeWidth={1.2} strokeDasharray="4 3"
                                label={{ position: 'top', value: '3.0° crítico', fill: '#ef4444', fontSize: 7, fontWeight: 'bold' }} />
                            <ReferenceLine y={params.pressures.pumpDepthMD} stroke={colorPrimary} strokeWidth={1.5} strokeDasharray="3 2"
                                label={{ position: 'insideBottomRight', value: 'ESP', fill: colorPrimary, fontSize: 8, fontWeight: 'bold' }} />
                            <ReferenceLine y={params.wellbore.midPerfsMD} stroke="#D97706" strokeWidth={1.5} strokeDasharray="3 2"
                                label={{ position: 'insideBottomRight', value: 'PERFS', fill: '#D97706', fontSize: 8, fontWeight: 'bold' }} />
                            <Line layout="vertical" type="monotone" dataKey="dogleg" stroke="#f59e0b" strokeWidth={2.5} dot={false} filter="url(#glow2)" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col glass-surface rounded-[2rem] border border-surface-light shadow-2xl overflow-hidden relative group select-none">
            {/* Background grid texture */}
            <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--color-primary)/0.015)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--color-primary)/0.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none z-0" />

            {/* ── MAIN WORKSPACE: 4-panel symmetrical grid ── */}
            <div className="relative z-10 flex-1 min-h-0 grid" style={{ gridTemplateColumns: '1fr 1px 1fr', gridTemplateRows: '1fr 1px 1fr' }}>
                {expandedPanel === '3d' ? (
                    <div className="bg-surface/10 border border-surface-light/10 rounded-2xl flex flex-col items-center justify-center text-center p-4" style={{ gridColumn: '1', gridRow: '1 / 2' }}>
                        <span className="text-[10px] font-black text-primary/70 uppercase tracking-widest animate-pulse">Modelo 3D Maximizado</span>
                        <span className="text-[8px] text-txt-muted mt-1 uppercase">Visualizando en pantalla completa...</span>
                    </div>
                ) : panelAJX}

                {/* Vertical divider */}
                <div className="bg-surface-light/20" style={{ gridColumn: '2', gridRow: '1 / 4' }} />

                {expandedPanel === 'lithology' ? (
                    <div className="bg-surface/10 border border-surface-light/10 rounded-2xl flex flex-col items-center justify-center text-center p-4" style={{ gridColumn: '3', gridRow: '1 / 2' }}>
                        <span className="text-[10px] font-black text-sky-400/70 uppercase tracking-widest animate-pulse">Perfil Litológico Maximizado</span>
                        <span className="text-[8px] text-txt-muted mt-1 uppercase">Visualizando en pantalla completa...</span>
                    </div>
                ) : panelBJX}

                {/* Horizontal divider */}
                <div className="bg-surface-light/20" style={{ gridColumn: '1 / 4', gridRow: '2' }} />

                {expandedPanel === 'inclination' ? (
                    <div className="bg-surface/10 border border-surface-light/10 rounded-2xl flex flex-col items-center justify-center text-center p-4" style={{ gridColumn: '1', gridRow: '3' }}>
                        <span className="text-[10px] font-black text-sky-400/70 uppercase tracking-widest animate-pulse">Inclinación vs MD Maximizado</span>
                        <span className="text-[8px] text-txt-muted mt-1 uppercase">Visualizando en pantalla completa...</span>
                    </div>
                ) : panelCJX}

                {expandedPanel === 'dls' ? (
                    <div className="bg-surface/10 border border-surface-light/10 rounded-2xl flex flex-col items-center justify-center text-center p-4" style={{ gridColumn: '3', gridRow: '3' }}>
                        <span className={`text-[10px] font-black uppercase tracking-widest animate-pulse ${isDlsCritical ? 'text-red-400/70' : 'text-amber-400/70'}`}>DLS vs MD Maximizado</span>
                        <span className="text-[8px] text-txt-muted mt-1 uppercase">Visualizando en pantalla completa...</span>
                    </div>
                ) : panelDJX}
            </div>

            {/* ── PORTAL FOR MAXIMIZED PANELS ── */}
            {expandedPanel === '3d' && createPortal(panelAJX, document.body)}
            {expandedPanel === 'lithology' && createPortal(panelBJX, document.body)}
            {expandedPanel === 'inclination' && createPortal(panelCJX, document.body)}
            {expandedPanel === 'dls' && createPortal(panelDJX, document.body)}

            {/* ── FOOTER METRICS + SAFETY ── */}
            <div className="relative z-20 px-6 py-3.5 border-t border-surface-light/25 bg-surface/50 backdrop-blur-xl shrink-0 flex items-center gap-4">

                {/* Metrics grid */}
                <div className="flex-1 grid grid-cols-4 gap-4">
                    {[
                        { label: 'MD Total', value: `${stats.maxMD} ft`, sub: `TVD: ${stats.maxTVD} ft` },
                        { label: 'Desvío Lateral', value: `${stats.totalDeparture} ft`, sub: 'Desplazamiento horizontal' },
                        { label: 'Inc. Máxima', value: `${metrics.maxInc.toFixed(1)}°`, sub: 'Ángulo vs vertical' },
                        { label: 'DLS Máximo', value: `${metrics.maxDLS.toFixed(2)}°`, sub: '/100ft · límite: 3.0°', highlight: isDlsCritical }
                    ].map(({ label, value, sub, highlight }) => (
                        <div key={label} className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[8px] font-black text-txt-muted uppercase tracking-wider truncate">{label}</span>
                            <span className={`text-sm font-black tracking-tight leading-none ${highlight ? 'text-danger' : 'text-txt-main'}`}>{value}</span>
                            <span className="text-[7.5px] text-txt-muted font-bold tracking-wide truncate">{sub}</span>
                        </div>
                    ))}
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-surface-light/30 shrink-0" />

                {/* Safety badge */}
                {isDlsCritical ? (
                    <div className="flex items-center gap-2.5 bg-danger/8 border border-danger/20 rounded-xl px-4 py-2.5 shrink-0">
                        <AlertTriangle className="w-4 h-4 text-danger animate-bounce shrink-0" />
                        <div>
                            <span className="text-[8.5px] font-black text-danger uppercase tracking-wider block">DLS Crítico ⚠</span>
                            <span className="text-[7px] text-txt-muted font-bold">{metrics.maxDLS.toFixed(2)}° — riesgo mecánico ESP</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 bg-success/8 border border-success/20 rounded-xl px-4 py-2.5 shrink-0">
                        <Shield className="w-4 h-4 text-success shrink-0" />
                        <div>
                            <span className="text-[8.5px] font-black text-success uppercase tracking-wider block">Alineación Segura ✔</span>
                            <span className="text-[7px] text-txt-muted font-bold">DLS {metrics.maxDLS.toFixed(2)}° — parámetros nominales</span>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};