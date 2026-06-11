/**
 * TrajectoryPlot.tsx — Wellbore Trajectory Workstation (Estética Premium Integrada)
 */

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, Play, Pause } from 'lucide-react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { SystemParams, SurveyPoint } from '../types';
import { interpolateTVD } from '../utils';
import { useTheme } from '../theme';
import { TrajectoryMap } from './TrajectoryMap';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

interface TrajectoryPlotProps {
    survey: SurveyPoint[];
    params: SystemParams;
    isSidebar?: boolean;
}

interface ProcessedPoint {
    x: number;
    y: number;
    z: number;
    departure: number;
    tvd: number;
    md: number;
    inc: number;
    dogleg: number;
    azim: number;
    casedTvd: number | null;
}

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function computePlotBounds(data: ProcessedPoint[], sp3dX = 0, sp3dY = 0) {
    let minX = Math.min(0, sp3dX);
    let maxX = Math.max(0, sp3dX);
    let minY = Math.min(0, sp3dY);
    let maxY = Math.max(0, sp3dY);
    let minZ = 0, maxZ = -Infinity;
    let hasFinite = false;
    for (const pt of data) {
        if (![pt.x, pt.y, pt.z].every(Number.isFinite)) continue;
        hasFinite = true;
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
        if (pt.z > maxZ) maxZ = pt.z;
    }
    if (!hasFinite) {
        return { minX: -150, maxX: 150, minY: -150, maxY: 150, minZ: 0, maxZ: 1200, cX: 0, cY: 0, cZ: 600, maxRange: 1200, hasData: false };
    }
    const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2, cZ = (minZ + maxZ) / 2;
    const maxRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 200, 300, 300, 1200);
    return { minX, maxX, minY, maxY, minZ, maxZ, cX, cY, cZ, maxRange, hasData: true };
}

function computeDLS(inc1: number, az1: number, inc2: number, az2: number, dMD: number): number {
    if (dMD <= 0) return 0;
    const i1 = inc1 * DEG2RAD, i2 = inc2 * DEG2RAD;
    const a1 = az1 * DEG2RAD, a2 = az2 * DEG2RAD;
    const dot = Math.cos(i1) * Math.cos(i2) + Math.sin(i1) * Math.sin(i2) * Math.cos(a2 - a1);
    const doglegRad = Math.acos(Math.max(-1, Math.min(1, dot)));
    return (doglegRad * RAD2DEG / dMD) * 100;
}

// Nueva paleta estética estilizada (Estilo Cyber/Sutil)
function getEstheticColorRgb(t: number, mode: 'depth' | 'inc' | 'dogleg'): [number, number, number] {
    const v = Math.max(0, Math.min(1, t));
    if (mode === 'dogleg') {
        // Verde esmeralda tech -> Naranja suave -> Rojo alert
        if (v < 0.5) {
            const factor = v / 0.5;
            return [Math.round(16 + (245 - 16) * factor), Math.round(185 + (158 - 185) * factor), Math.round(129 + (11 - 129) * factor)];
        } else {
            const factor = (v - 0.5) / 0.5;
            return [Math.round(245 + (239 - 245) * factor), Math.round(158 + (68 - 158) * factor), Math.round(11 + (68 - 11) * factor)];
        }
    } else if (mode === 'inc') {
        // Azul profundo a cian eléctrico brillante
        return [Math.round(7 + (56 - 7) * v), Math.round(89 + (189 - 89) * v), Math.round(177 + (248 - 177) * v)];
    } else {
        // Estructura/Profundidad: Slate moderno a Violeta Tech
        return [Math.round(71 + (139 - 71) * v), Math.round(85 + (92 - 85) * v), Math.round(105 + (246 - 105) * v)];
    }
}

// Helper para dibujar segmentos cilíndricos en el canvas
function drawTubeSegment(
    ctx: CanvasRenderingContext2D,
    p0: { x: number; y: number; depth: number },
    p1: { x: number; y: number; depth: number },
    radiusPixels: number,
    colorGradientStart: string,
    colorGradientMid: string,
    colorGradientEnd: string,
    yaw: number,
    opacity = 1.0
) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return;
    const nx = -dy / len, ny = dx / len;
    const r = radiusPixels;
    const x0L = p0.x + nx * r, y0L = p0.y + ny * r;
    const x0R = p0.x - nx * r, y0R = p0.y - ny * r;
    const x1L = p1.x + nx * r, y1L = p1.y + ny * r;
    const x1R = p1.x - nx * r, y1R = p1.y - ny * r;
    const hlPos = Math.max(0.15, Math.min(0.85, 0.35 + 0.15 * Math.sin(yaw + Math.atan2(dy, dx))));
    const grad = ctx.createLinearGradient(x0L, y0L, x0R, y0R);
    grad.addColorStop(0.0, colorGradientStart);
    grad.addColorStop(hlPos, colorGradientMid);
    grad.addColorStop(Math.min(1, hlPos + 0.12), colorGradientMid);
    grad.addColorStop(1.0, colorGradientEnd);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0L, y0L); ctx.lineTo(x1L, y1L); ctx.lineTo(x1R, y1R); ctx.lineTo(x0R, y0R);
    ctx.closePath(); ctx.fill();
    ctx.restore();
}

// ─── Spooler Polar Chart ──────────────────────────────────────────────────────

const SpoolerPolarChart: React.FC<{ processedData: ProcessedPoint[]; limitMD: number; isDark: boolean; }> = ({ processedData, limitMD, isDark }) => {
    const size = 360, cx = size / 2, cy = size / 2, R = 135;
    const toRad = (deg: number) => (deg - 90) * DEG2RAD;
    const getPt = (deg: number, radiusVal: number) => {
        const rad = toRad(deg);
        const rPix = (radiusVal / 100) * R;
        return { x: cx + Math.cos(rad) * rPix, y: cy + Math.sin(rad) * rPix };
    };

    const sector = useMemo(() => {
        const validPoints = processedData.filter(pt => pt.md > 0 && pt.md <= limitMD && pt.azim !== undefined);
        if (validPoints.length === 0) return { start: 0, end: 0, draw: false };
        let sumSin = 0, sumCos = 0, sumW = 0;
        validPoints.forEach(pt => {
            const w = Math.sin((pt.inc ?? 0) * DEG2RAD);
            sumSin += Math.sin((pt.azim ?? 0) * DEG2RAD) * w;
            sumCos += Math.cos((pt.azim ?? 0) * DEG2RAD) * w;
            sumW += w;
        });
        let avgAz = 0;
        if (sumW < 0.0001) {
            let simpleSin = 0, simpleCos = 0;
            validPoints.forEach(pt => {
                simpleSin += Math.sin((pt.azim ?? 0) * DEG2RAD);
                simpleCos += Math.cos((pt.azim ?? 0) * DEG2RAD);
            });
            avgAz = (Math.atan2(simpleSin, simpleCos) * RAD2DEG + 360) % 360;
        } else {
            avgAz = (Math.atan2(sumSin, sumCos) * RAD2DEG + 360) % 360;
        }
        let minDiff = 0, maxDiff = 0;
        validPoints.forEach(pt => {
            const w = Math.sin((pt.inc ?? 0) * DEG2RAD);
            if (sumW >= 0.0001 && w < 0.043) return;
            let diff = pt.azim - avgAz;
            while (diff < -180) diff += 360; while (diff > 180) diff -= 360;
            if (diff < minDiff) minDiff = diff; if (diff > maxDiff) maxDiff = diff;
        });
        return { start: (avgAz + minDiff - 2 + 360) % 360, end: (avgAz + maxDiff + 2 + 360) % 360, draw: true };
    }, [processedData, limitMD]);

    const concentricValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const degreeLabels = useMemo(() => { const l: number[] = []; for (let d = 0; d < 360; d += 4) if (d !== 0 && d !== 90 && d !== 180 && d !== 270) l.push(d); return l; }, []);

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] h-[280px] select-none overflow-visible">
            {sector.draw && (
                <path
                    d={`M ${cx} ${cy} L ${cx + Math.cos(toRad(sector.start)) * R} ${cy + Math.sin(toRad(sector.start)) * R} A ${R} ${R} 0 ${(sector.end - sector.start + 360) % 360 > 180 ? 1 : 0} 1 ${cx + Math.cos(toRad(sector.end)) * R} ${cy + Math.sin(toRad(sector.end)) * R} Z`}
                    fill="rgb(var(--color-primary) / 0.08)"
                    stroke="rgb(var(--color-primary))"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                />
            )}
            {concentricValues.map(val => <circle key={val} cx={cx} cy={cy} r={(val / 100) * R} fill="none" stroke="rgb(var(--color-text-main) / 0.05)" strokeWidth={val === 100 ? 1.0 : 0.5} />)}
            {degreeLabels.map(deg => { const p = getPt(deg, 105); return <text key={`l${deg}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="6.5" fontWeight="600" fill="rgb(var(--color-text-muted))">{deg}°</text>; })}
            <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="rgb(var(--color-text-main) / 0.15)" strokeWidth="1.0" />
            <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="rgb(var(--color-text-main) / 0.15)" strokeWidth="1.0" />
            <text x={cx} y={cy - R - 10} textAnchor="middle" fill="rgb(var(--color-danger))" fontSize="12" fontWeight="900">N</text>
            <text x={cx + R + 10} y={cy} textAnchor="start" dominantBaseline="middle" fill="rgb(var(--color-text-main))" fontSize="11" fontWeight="800">E</text>
            <text x={cx} y={cy + R + 18} textAnchor="middle" fill="rgb(var(--color-text-main))" fontSize="11" fontWeight="800">S</text>
            <text x={cx - R - 10} y={cy} textAnchor="end" dominantBaseline="middle" fill="rgb(var(--color-text-main))" fontSize="11" fontWeight="800">W</text>
            {processedData.map((pt, idx) => {
                if (pt.md === 0 || pt.md > limitMD || pt.azim === undefined) return null;
                const pT = getPt(pt.azim, (pt.md / limitMD) * 98);
                return <line key={`r${idx}`} x1={cx} y1={cy} x2={pT.x} y2={pT.y} stroke="rgb(var(--color-primary))" strokeWidth="2.0" strokeLinecap="round" opacity="0.8" />;
            })}
            <circle cx={cx} cy={cy} r={3} fill="rgb(var(--color-danger))" />
        </svg>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const TrajectoryPlot: React.FC<TrajectoryPlotProps> = ({ survey, params, isSidebar = false }) => {
    const { theme } = useTheme();
    const isDark = theme === 'fusion' || theme === 'cyber';
    const colorPrimary = `rgb(var(--color-primary))`;
    const colorSurfaceLight = `rgb(var(--color-surface-light))`;

    const pumpDepthTVD = useMemo(() => {
        return interpolateTVD(params.pressures.pumpDepthMD, survey || []);
    }, [params.pressures.pumpDepthMD, survey]);

    const casingBottomTVD = useMemo(() => {
        return interpolateTVD(params.wellbore.casingBottom, survey || []);
    }, [params.wellbore.casingBottom, survey]);

    const [expandedCanvas, setExpandedCanvas] = useState(false);
    const [colorOverlay3D, setColorOverlay3D] = useState<'depth' | 'inc' | 'dogleg'>('dogleg');
    const [isAutoRotating, setIsAutoRotating] = useState(true);
    const [viewMode, setViewMode] = useState<'3d' | 'map'>('3d');

    const yawRef = useRef(Math.PI / 4.5);
    const pitchRef = useRef(-Math.PI / 7.0);
    const getInitialZoom = () => {
        if (typeof window === 'undefined') return 1.0;
        const w = window.innerWidth;
        if (w < 360) return 0.52;
        if (w < 400) return 0.58;
        if (w < 480) return 0.65;
        if (w < 768) return 0.74;
        return 1.0;
    };
    const zoomRef = useRef(getInitialZoom());
    const hovIdxRef = useRef<number | null>(null);
    const isAutoRotRef = useRef(true);
    const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
    const canvasSizeRef = useRef({ w: 0, h: 0, dpr: 1 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boundsRef = useRef<ReturnType<typeof computePlotBounds> | null>(null);
    const needsRenderRef = useRef(true);
    const requestRenderRef = useRef<(() => void) | null>(null);

    const setView = useCallback((type: 'top' | 'bottom' | 'lateral') => {
        isAutoRotRef.current = false;
        setIsAutoRotating(false);
        if (type === 'top') { yawRef.current = 0; pitchRef.current = 0; }
        else if (type === 'bottom') { yawRef.current = Math.PI / 4.5; pitchRef.current = Math.PI / 7.0; }
        else if (type === 'lateral') { yawRef.current = Math.PI / 2; pitchRef.current = -Math.PI / 2; }
        needsRenderRef.current = true;
        requestRenderRef.current?.();
    }, []);

    // ── Survey Processing ──────────────────────────────────────────────────────

    const processedData = useMemo<ProcessedPoint[]>(() => {
        if (!survey || !Array.isArray(survey)) return [];

        let rawSurvey = [...survey];
        if (rawSurvey.length > 0 && rawSurvey[0].md > 0) {
            rawSurvey.unshift({ md: 0, tvd: 0, inc: 0, azim: rawSurvey[0].azim, dogleg: 0 });
        }

        // Use raw survey points directly without visual interpolation (fictitious data generation)

        let departure = 0; let curX = 0; let curY = 0;
        const raw = rawSurvey.map((pt, i) => {
            const prev = rawSurvey[i - 1];
            let dls = pt.dogleg ?? 0;
            if (i > 0) {
                const dMD = pt.md - prev.md;
                const dTVD = pt.tvd - prev.tvd;
                departure += Math.sqrt(Math.max(0, dMD ** 2 - dTVD ** 2));
                if (!pt.dogleg && pt.inc !== undefined && pt.azim !== undefined && prev.inc !== undefined && prev.azim !== undefined) {
                    dls = computeDLS(prev.inc, prev.azim, pt.inc, pt.azim, dMD);
                }
                const avgInc = ((prev.inc ?? 0) + (pt.inc ?? 0)) / 2 * DEG2RAD;
                const avgAz = ((prev.azim ?? 0) + (pt.azim ?? 0)) / 2 * DEG2RAD;
                curX += dMD * Math.sin(avgInc) * Math.sin(avgAz);
                curY += dMD * Math.sin(avgInc) * Math.cos(avgAz);
            }
            return {
                x: curX, y: curY, z: pt.tvd,
                departure: Math.round(departure), tvd: pt.tvd, md: pt.md,
                inc: pt.inc ?? 0, dogleg: dls, azim: pt.azim ?? 0,
                casedTvd: pt.md <= params.wellbore.casingBottom ? pt.tvd : null,
            } satisfies ProcessedPoint;
        });
        return raw;
    }, [survey, params.wellbore.casingBottom]);

    const { maxCurveDLS, maxDlsPoint } = useMemo(() => {
        let maxDLS = 0, maxCurveDLS = 0;
        let maxDlsPoint: ProcessedPoint = processedData[0];
        processedData.forEach(s => {
            if ((s.dogleg ?? 0) > maxDLS) maxDLS = s.dogleg;
            if (s.md <= params.pressures.pumpDepthMD && (s.dogleg ?? 0) > maxCurveDLS) {
                maxCurveDLS = s.dogleg; maxDlsPoint = s;
            }
        });
        return { maxCurveDLS, maxDlsPoint };
    }, [processedData, params.pressures.pumpDepthMD]);

    const { maxMD, maxTVD, kopPoint } = useMemo(() => {
        const safeSurvey = Array.isArray(survey) ? survey : [];
        const tdTVD = interpolateTVD(params.totalDepthMD, safeSurvey);
        const surveyMax = Math.max(...safeSurvey.map(s => s.tvd), 1000);
        const kop = processedData.find((d, i) =>
            i > 0 && (d.departure - processedData[i - 1].departure) / Math.max(1, d.tvd - processedData[i - 1].tvd) > 0.035
        );
        return { maxMD: Math.max(...safeSurvey.map(s => s.md), 100), maxTVD: Math.ceil(Math.max(surveyMax, tdTVD) / 1000) * 1000 + 400, kopPoint: kop };
    }, [survey, params.totalDepthMD, processedData]);

    const limitMD = useMemo(() => params.pressures.pumpDepthMD || maxMD, [params.pressures.pumpDepthMD, maxMD]);

    const avgAzimuth = useMemo(() => {
        const validPoints = processedData.filter(pt => pt.md > 0 && pt.md <= limitMD && pt.azim !== undefined);
        if (validPoints.length === 0) return 0;
        let sumSin = 0, sumCos = 0, sumW = 0;
        validPoints.forEach(pt => {
            const w = Math.sin((pt.inc ?? 0) * DEG2RAD);
            sumSin += Math.sin((pt.azim ?? 0) * DEG2RAD) * w;
            sumCos += Math.cos((pt.azim ?? 0) * DEG2RAD) * w;
            sumW += w;
        });
        if (sumW < 0.0001) {
            let simpleSin = 0, simpleCos = 0;
            validPoints.forEach(pt => { simpleSin += Math.sin((pt.azim ?? 0) * DEG2RAD); simpleCos += Math.cos((pt.azim ?? 0) * DEG2RAD); });
            return (Math.atan2(simpleSin, simpleCos) * RAD2DEG + 360) % 360;
        }
        return (Math.atan2(sumSin, sumCos) * RAD2DEG + 360) % 360;
    }, [processedData, limitMD]);

    const spoolerAzimuth = useMemo(() => Math.round(avgAzimuth), [avgAzimuth]);

    const chartData = useMemo(() => {
        return processedData.filter(pt => Number.isFinite(pt.tvd) && Number.isFinite(pt.inc) && Number.isFinite(pt.dogleg));
    }, [processedData]);

    const maxDLS = useMemo(() => {
        if (!chartData || chartData.length === 0) return 5;
        const dlsVals = chartData.map(d => d.dogleg).filter(Number.isFinite);
        if (dlsVals.length === 0) return 5;
        return Math.max(5, Math.ceil(Math.max(...dlsVals)));
    }, [chartData]);

    const safeMaxTVD = useMemo(() => {
        const limitVal = Number.isFinite(maxTVD) ? maxTVD : 1000;
        return Math.max(limitVal, 100);
    }, [maxTVD]);

    // ── Single RAF-based Canvas Loop ───────────────────────────────────────────

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        let rafId: number | null = null;

        let rawMinX = 0, rawMaxX = 0, rawMinY = 0, rawMaxY = 0;
        processedData.forEach(pt => {
            if (Number.isFinite(pt.x)) { rawMinX = Math.min(rawMinX, pt.x); rawMaxX = Math.max(rawMaxX, pt.x); }
            if (Number.isFinite(pt.y)) { rawMinY = Math.min(rawMinY, pt.y); rawMaxY = Math.max(rawMaxY, pt.y); }
        });
        const rawHorizExtent = Math.max(Math.abs(rawMaxX - rawMinX), Math.abs(rawMaxY - rawMinY), 100);
        const spRadius3D = Math.max(80, rawHorizExtent * 0.35);

        const bounds = computePlotBounds(processedData, spRadius3D * Math.sin(spoolerAzimuth * DEG2RAD), spRadius3D * Math.cos(spoolerAzimuth * DEG2RAD));
        boundsRef.current = bounds;
        const { minX, maxX, minY, maxY, minZ, maxZ, cX, cY, cZ, maxRange, hasData } = bounds;
        const globalMaxDLS = Math.max(...processedData.map(p => p.dogleg), 2);
        const baseTubingRadius = 4.0;

        // Función para extraer y generar opacidades de los colores del tema actual
        const getCssVarAlpha = (cssVarName: string, alpha: number, fallbackRgb: string) => {
            if (typeof window === 'undefined') return `rgba(${fallbackRgb}, ${alpha})`;
            try {
                const bodyStyle = window.getComputedStyle(document.body);
                let rawVal = bodyStyle.getPropertyValue(cssVarName).trim();
                if (!rawVal) {
                    rawVal = window.getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
                }
                if (rawVal) {
                    const formatted = rawVal.replace(/\s+/g, ', ');
                    return `rgba(${formatted}, ${alpha})`;
                }
            } catch (err) {
                // ignore
            }
            return `rgba(${fallbackRgb}, ${alpha})`;
        };

        const colorPrimaryAlpha = (alpha: number) => getCssVarAlpha('--color-primary', alpha, '6, 182, 212');
        const colorAccentAlpha = (alpha: number) => getCssVarAlpha('--color-accent', alpha, '148, 163, 184');
        const colorSecondaryAlpha = (alpha: number) => getCssVarAlpha('--color-secondary', alpha, '15, 45, 65');
        const colorGlowAlpha = (alpha: number) => getCssVarAlpha('--color-glow', alpha, '147, 197, 253');

        const drawFrame = () => {
            const yaw = yawRef.current; const pitch = pitchRef.current; const zoom = zoomRef.current;
            const hoveredPointIdx = hovIdxRef.current; const isLookingFromBelow = pitch > 0.05;

            // Resize Control
            const parent = canvas.parentElement; if (!parent) return;
            const dpr = window.devicePixelRatio || 1;
            const w = parent.clientWidth; const h = Math.max(380, parent.clientHeight);
            if (canvas.width !== w * dpr || canvas.height !== h * dpr || dpr !== canvasSizeRef.current.dpr) {
                canvas.width = w * dpr; canvas.height = h * dpr;
                canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
                ctx.scale(dpr, dpr); canvasSizeRef.current = { w, h, dpr };
            }
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';

            // Proyección 3D Básica Estilizada
            const project = (x3d: number, y3d: number, z3d: number) => {
                const tx = x3d - cX, ty = y3d - cY, tz = z3d - cZ;
                const rx1 = tx * Math.cos(yaw) - ty * Math.sin(yaw);
                const ry1 = -(tx * Math.sin(yaw) + ty * Math.cos(yaw));
                const ry2 = ry1 * Math.cos(pitch) - tz * Math.sin(pitch);
                const rz2 = ry1 * Math.sin(pitch) + tz * Math.cos(pitch);
                const vScale = Math.min(w, h) * 0.72 / maxRange;
                return { x: w / 2 + rx1 * vScale * zoom, y: h / 2 + ry2 * vScale * zoom, depth: rz2 };
            };

            const projectedPoints = processedData.map(pt => ({ ...project(pt.x, pt.y, pt.z), pt }));
            const pWell = projectedPoints[0];

            const drawText = (text: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'left') => {
                ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
                ctx.strokeStyle = isDark ? '#090d16' : '#ffffff'; ctx.lineWidth = 3.5; ctx.strokeText(text, x, y);
                ctx.fillStyle = fill; ctx.fillText(text, x, y); ctx.restore();
            };

            // ── MEJORA 1: Fondo Transparente Integrado ────
            ctx.clearRect(0, 0, w, h);

            if (!hasData || processedData.length === 0) return;

            // ── MEJORA 3: Formaciones Geológicas Holográficas 3D (Afinidad Total al Tema) ──
            const drawGeologyBlock = (
                zStart: number,
                zEnd: number,
                fillColor: string,
                lineColor: string,
                drawGridPattern = true
            ) => {
                const offset = 140;
                const p = [
                    project(minX - offset, minY - offset, zStart),
                    project(maxX + offset, minY - offset, zStart),
                    project(maxX + offset, maxY + offset, zStart),
                    project(minX - offset, maxY + offset, zStart),
                    project(minX - offset, minY - offset, zEnd),
                    project(maxX + offset, minY - offset, zEnd),
                    project(maxX + offset, maxY + offset, zEnd),
                    project(minX - offset, maxY + offset, zEnd)
                ];

                // Draw faces
                const drawFace = (v1: typeof p[0], v2: typeof p[0], v3: typeof p[0], v4: typeof p[0], faceFill: string) => {
                    ctx.save();
                    ctx.fillStyle = faceFill;
                    ctx.beginPath();
                    ctx.moveTo(v1.x, v1.y);
                    ctx.lineTo(v2.x, v2.y);
                    ctx.lineTo(v3.x, v3.y);
                    ctx.lineTo(v4.x, v4.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                };

                // Fill translucent faces
                drawFace(p[3], p[0], p[4], p[7], fillColor); // Left
                drawFace(p[0], p[1], p[5], p[4], fillColor); // Back
                drawFace(p[1], p[2], p[6], p[5], fillColor); // Right

                ctx.save();
                ctx.globalAlpha = 0.03;
                drawFace(p[2], p[3], p[7], p[6], fillColor); // Front
                ctx.restore();

                // Relleno de la placa superior (superficie)
                if (zStart === minZ) {
                    ctx.save();
                    ctx.fillStyle = colorSecondaryAlpha(0.12); // Placa superior más visible
                    ctx.beginPath();
                    ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.lineTo(p[2].x, p[2].y); ctx.lineTo(p[3].x, p[3].y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                ctx.save();
                // Draw wireframe borders
                ctx.strokeStyle = lineColor;

                // Borde superior (placa superior) es más grueso (2.2) y el resto más tenue (0.6)
                ctx.lineWidth = (zStart === minZ) ? 2.2 : 0.6;
                ctx.beginPath();
                ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.lineTo(p[2].x, p[2].y); ctx.lineTo(p[3].x, p[3].y);
                ctx.closePath();
                ctx.stroke();

                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(p[4].x, p[4].y); ctx.lineTo(p[5].x, p[5].y); ctx.lineTo(p[6].x, p[6].y); ctx.lineTo(p[7].x, p[7].y);
                ctx.closePath();
                ctx.stroke();

                for (const idx of [0, 1, 2, 3]) {
                    ctx.beginPath();
                    ctx.moveTo(p[idx].x, p[idx].y);
                    ctx.lineTo(p[idx + 4].x, p[idx + 4].y);
                    ctx.stroke();
                }
                ctx.restore();

                // Scan lines inside the block
                if (drawGridPattern) {
                    ctx.save();
                    ctx.strokeStyle = lineColor;
                    ctx.lineWidth = 0.25;
                    ctx.globalAlpha = ctx.globalAlpha * 0.55; // Hacer las líneas de escaneo interno un 45% más tenues
                    const stepZ = (zEnd - zStart) / 4;
                    for (let sz = zStart + stepZ; sz < zEnd; sz += stepZ) {
                        const s0 = project(minX - offset, minY - offset, sz);
                        const s1 = project(maxX + offset, minY - offset, sz);
                        const s2 = project(maxX + offset, maxY + offset, sz);
                        const s3 = project(minX - offset, maxY + offset, sz);

                        ctx.beginPath();
                        ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(s2.x, s2.y); ctx.lineTo(s3.x, s3.y); ctx.lineTo(s0.x, s0.y);
                        ctx.stroke();
                    }

                    // Vertical grid stripes on left face
                    const stepsX = 4;
                    for (let i = 1; i < stepsX; i++) {
                        const t = i / stepsX;
                        const xVal = (minX - offset) + (maxX - minX + 2 * offset) * t;
                        const sl0 = project(xVal, minY - offset, zStart);
                        const sl1 = project(xVal, minY - offset, zEnd);
                        ctx.beginPath();
                        ctx.moveTo(sl0.x, sl0.y);
                        ctx.lineTo(sl1.x, sl1.y);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            };

            const maxGeologyZ = maxZ * 1.15;

            // Dibujo de las capas con un degradé del color secundario del tema (sin textos de formación)
            drawGeologyBlock(minZ, maxGeologyZ * 0.25, colorSecondaryAlpha(0.03), colorSecondaryAlpha(0.08));
            drawGeologyBlock(maxGeologyZ * 0.25, maxGeologyZ * 0.62, colorSecondaryAlpha(0.07), colorSecondaryAlpha(0.15));
            drawGeologyBlock(maxGeologyZ * 0.62, maxGeologyZ * 0.88, colorSecondaryAlpha(0.12), colorSecondaryAlpha(0.24));
            drawGeologyBlock(maxGeologyZ * 0.88, maxGeologyZ, colorSecondaryAlpha(0.18), colorSecondaryAlpha(0.36));

            // ── Jaula de Rejilla Tecnológica (Cage) ──
            const verts = [
                { x: minX, y: minY, z: minZ }, { x: maxX, y: minY, z: minZ }, { x: maxX, y: maxY, z: minZ }, { x: minX, y: maxY, z: minZ },
                { x: minX, y: minY, z: maxGeologyZ }, { x: maxX, y: minY, z: maxGeologyZ }, { x: maxX, y: maxY, z: maxGeologyZ }, { x: minX, y: maxY, z: maxGeologyZ }
            ].map(v => project(v.x, v.y, v.z));

            ctx.lineWidth = 0.45; ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)';
            ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(verts[i].x, verts[i].y); ctx.closePath(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(verts[4].x, verts[4].y); for (let i = 5; i < 8; i++) ctx.lineTo(verts[i].x, verts[i].y); ctx.closePath(); ctx.stroke();
            for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(verts[i].x, verts[i].y); ctx.lineTo(verts[i + 4].x, verts[i + 4].y); ctx.stroke(); }

            // Marcas de profundidad laterales
            for (let i = 1; i <= 4; i++) {
                const zd = (i / 4) * maxGeologyZ, p = project(minX, minY, zd);
                drawText(`${Math.round(zd)} ft`, p.x - 8, p.y, '600 7.5px monospace', isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.4)', 'right');
            }

            // ── Compass de Superficie Metálico ─────────────────────────────────
            {
                ctx.save(); if (isLookingFromBelow) { ctx.globalAlpha = 0.08; ctx.filter = 'blur(2px)'; }
                const rings = [spRadius3D * 0.5, spRadius3D];
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.09)'; ctx.lineWidth = 1.0;
                rings.forEach(r => {
                    ctx.beginPath();
                    for (let theta = 0; theta <= 2 * Math.PI + 0.1; theta += Math.PI / 18) {
                        const p = project(r * Math.sin(theta), r * Math.cos(theta), 0);
                        if (theta === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                    }
                    ctx.stroke();
                });

                // Cardinal direction axes
                const dirs = [
                    { dx: 0, dy: 1, label: 'N', color: '#ef4444' },
                    { dx: 1, dy: 0, label: 'E', color: isDark ? '#38bdf8' : '#0284c7' },
                    { dx: 0, dy: -1, label: 'S', color: isDark ? '#94a3b8' : '#475569' },
                    { dx: -1, dy: 0, label: 'W', color: isDark ? '#94a3b8' : '#475569' }
                ];
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'; ctx.lineWidth = 0.8;
                dirs.forEach(d => {
                    const pStart = project(0, 0, 0); const pEnd = project(d.dx * spRadius3D, d.dy * spRadius3D, 0);
                    ctx.beginPath(); ctx.moveTo(pStart.x, pStart.y); ctx.lineTo(pEnd.x, pEnd.y); ctx.stroke();
                });
                dirs.forEach(d => {
                    const pLabel = project(d.dx * spRadius3D * 1.15, d.dy * spRadius3D * 1.15, 0);
                    drawText(d.label, pLabel.x, pLabel.y, 'bold 9px system-ui, sans-serif', d.color, 'center');
                });
                ctx.restore();
            }

            // Sombra del Wellpath en el fondo Z=maxGeologyZ
            for (let i = 1; i < projectedPoints.length; i++) {
                const shPrev = project(projectedPoints[i - 1].pt.x, projectedPoints[i - 1].pt.y, maxGeologyZ);
                const shCurr = project(projectedPoints[i].pt.x, projectedPoints[i].pt.y, maxGeologyZ);
                const pt = projectedPoints[i].pt;
                let sT = 0;
                if (colorOverlay3D === 'depth') sT = pt.tvd / Math.max(maxZ, 1);
                else if (colorOverlay3D === 'inc') sT = pt.inc / 90;
                else sT = pt.dogleg / globalMaxDLS;
                const [sr, sg, sb] = getEstheticColorRgb(sT, colorOverlay3D);
                ctx.beginPath(); ctx.moveTo(shPrev.x, shPrev.y); ctx.lineTo(shCurr.x, shCurr.y);
                ctx.lineWidth = 3.0; ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.08)`; ctx.stroke();
            }

            // ── Torre de Perforación Estructurada en 3D Real ────────────────────
            const rigH_3d = Math.max(120, maxRange * 0.08);
            const rigS_3d = rigH_3d * 0.12;
            const rigTopW_3d = rigS_3d * 0.35;

            const pBase = [
                project(-rigS_3d, -rigS_3d, 0),
                project(rigS_3d, -rigS_3d, 0),
                project(rigS_3d, rigS_3d, 0),
                project(-rigS_3d, rigS_3d, 0)
            ];

            const pTop = [
                project(-rigTopW_3d, -rigTopW_3d, -rigH_3d),
                project(rigTopW_3d, -rigTopW_3d, -rigH_3d),
                project(rigTopW_3d, rigTopW_3d, -rigH_3d),
                project(-rigTopW_3d, rigTopW_3d, -rigH_3d)
            ];

            const pCrown = project(0, 0, -rigH_3d);

            ctx.save();
            if (isLookingFromBelow) { ctx.globalAlpha = 0.05; ctx.filter = 'blur(3px)'; }

            // Subestructura (Plataforma Base) en 3D
            const pPlat = [
                project(-rigS_3d * 1.3, -rigS_3d * 1.3, 0),
                project(rigS_3d * 1.3, -rigS_3d * 1.3, 0),
                project(rigS_3d * 1.3, rigS_3d * 1.3, 0),
                project(-rigS_3d * 1.3, rigS_3d * 1.3, 0)
            ];
            ctx.fillStyle = isDark ? 'rgba(51,65,85,0.75)' : 'rgba(203,213,225,0.75)';
            ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.85)' : 'rgba(51,65,85,0.85)';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(pPlat[0].x, pPlat[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(pPlat[i].x, pPlat[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Relleno translúcido para las caras laterales de la torre
            ctx.fillStyle = isDark ? 'rgba(100,116,139,0.18)' : 'rgba(148,163,184,0.15)';
            for (let i = 0; i < 4; i++) {
                const nextI = (i + 1) % 4;
                ctx.beginPath();
                ctx.moveTo(pBase[i].x, pBase[i].y);
                ctx.lineTo(pBase[nextI].x, pBase[nextI].y);
                ctx.lineTo(pTop[nextI].x, pTop[nextI].y);
                ctx.lineTo(pTop[i].x, pTop[i].y);
                ctx.closePath();
                ctx.fill();
            }

            // Bordes principales de la torre (Piernas)
            ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.9)' : 'rgba(51,65,85,0.9)';
            ctx.lineWidth = 1.5 * zoom;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(pBase[i].x, pBase[i].y);
                ctx.lineTo(pTop[i].x, pTop[i].y);
                ctx.stroke();
            }

            // Corona/Techo de la torre
            ctx.fillStyle = isDark ? 'rgba(71,85,105,0.85)' : 'rgba(148,163,184,0.85)';
            ctx.beginPath();
            ctx.moveTo(pTop[0].x, pTop[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(pTop[i].x, pTop[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Vigas transversales (Cruces) y anillos horizontales de la celosía en 3D
            const numSections = 4;
            ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(51,65,85,0.55)';
            ctx.lineWidth = 0.7 * zoom;

            for (let s = 1; s <= numSections; s++) {
                const zVal = -rigH_3d * (s / numSections);
                const prevZVal = -rigH_3d * ((s - 1) / numSections);

                const rW = rigS_3d + (rigTopW_3d - rigS_3d) * (s / numSections);
                const prevRW = rigS_3d + (rigTopW_3d - rigS_3d) * ((s - 1) / numSections);

                const corners = [
                    project(-rW, -rW, zVal),
                    project(rW, -rW, zVal),
                    project(rW, rW, zVal),
                    project(-rW, rW, zVal)
                ];

                const prevCorners = [
                    project(-prevRW, -prevRW, prevZVal),
                    project(prevRW, -prevRW, prevZVal),
                    project(prevRW, prevRW, prevZVal),
                    project(-prevRW, prevRW, prevZVal)
                ];

                // Anillo horizontal
                if (s < numSections) {
                    ctx.beginPath();
                    ctx.moveTo(corners[0].x, corners[0].y);
                    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
                    ctx.closePath();
                    ctx.stroke();
                }

                // Cruces en cada cara
                for (let i = 0; i < 4; i++) {
                    const nextI = (i + 1) % 4;
                    ctx.beginPath();
                    ctx.moveTo(prevCorners[i].x, prevCorners[i].y);
                    ctx.lineTo(corners[nextI].x, corners[nextI].y);
                    ctx.moveTo(prevCorners[nextI].x, prevCorners[nextI].y);
                    ctx.lineTo(corners[i].x, corners[i].y);
                    ctx.stroke();
                }
            }

            // Bloque viajero y línea de perforación
            const pBlock = project(0, 0, -rigH_3d * 0.55);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(pBlock.x, pBlock.y, 2.5 * zoom, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)';
            ctx.lineWidth = 0.5 * zoom;
            ctx.beginPath();
            ctx.moveTo(pCrown.x, pCrown.y);
            ctx.lineTo(pBlock.x, pBlock.y);
            ctx.stroke();

            // Luces de advertencia (balizas)
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(pCrown.x, pCrown.y - 3 * zoom, 2 * zoom, 0, Math.PI * 2);
            ctx.fill();

            // BOP / Wellhead simplificado en base
            ctx.fillStyle = isDark ? '#1e293b' : '#64748b';
            ctx.fillRect(pWell.x - 3.5 * zoom, pWell.y - 7 * zoom, 7 * zoom, 7 * zoom);
            ctx.fillStyle = isDark ? '#334155' : '#475569';
            ctx.fillRect(pWell.x - 5.5 * zoom, pWell.y - 4 * zoom, 11 * zoom, 2 * zoom);

            ctx.restore();

            // ── SPOOLER Detallado con Cable Aéreo en 3D ──
            {
                const spAngle = spoolerAzimuth * DEG2RAD;
                const sp3dX = spRadius3D * Math.sin(spAngle);
                const sp3dY = spRadius3D * Math.cos(spAngle);

                // Dimensiones 3D del Spooler en pies (escala realista)
                const spW_3d = Math.max(8, maxRange * 0.005);
                const spH_3d = spW_3d * 0.9;
                const spD_3d = spW_3d * 0.7;

                const drumRadius = spH_3d * 0.35;
                const flangeRadius = spH_3d * 0.55;

                const projectSp = (lx: number, ly: number, lz: number) => {
                    const cosA = Math.cos(spAngle);
                    const sinA = Math.sin(spAngle);
                    const rx = sp3dX + lx * cosA - ly * sinA;
                    const ry = sp3dY + lx * sinA + ly * cosA;
                    return project(rx, ry, lz);
                };

                const pSpBase = projectSp(0, 0, 0);
                const pSpoolerCableAnchor = projectSp(0, 0, -spH_3d * 0.9);

                const pPlatSp = [
                    projectSp(-spW_3d * 1.2, -spD_3d * 1.2, 0),
                    projectSp(spW_3d * 1.2, -spD_3d * 1.2, 0),
                    projectSp(spW_3d * 1.2, spD_3d * 1.2, 0),
                    projectSp(-spW_3d * 1.2, spD_3d * 1.2, 0)
                ];

                const pFrameL = [
                    projectSp(-spW_3d * 0.9, -spD_3d * 0.8, 0),
                    projectSp(-spW_3d * 0.9, spD_3d * 0.8, 0),
                    projectSp(-spW_3d * 0.9, 0, -spH_3d * 0.9)
                ];

                const pFrameR = [
                    projectSp(spW_3d * 0.9, -spD_3d * 0.8, 0),
                    projectSp(spW_3d * 0.9, spD_3d * 0.8, 0),
                    projectSp(spW_3d * 0.9, 0, -spH_3d * 0.9)
                ];

                const pAxleL = projectSp(-spW_3d * 0.9, 0, -spH_3d * 0.9);
                const pAxleR = projectSp(spW_3d * 0.9, 0, -spH_3d * 0.9);

                ctx.save();
                if (isLookingFromBelow) { ctx.globalAlpha = 0.05; ctx.filter = 'blur(3px)'; }

                // Huella de anclaje
                ctx.save();
                const footW = (pAxleR.x - pAxleL.x) * 1.3;
                const footGrad = ctx.createRadialGradient(pSpBase.x, pSpBase.y, 0, pSpBase.x, pSpBase.y, footW);
                footGrad.addColorStop(0, isDark ? 'rgba(148,163,184,0.25)' : 'rgba(71,85,105,0.18)');
                footGrad.addColorStop(0.6, isDark ? 'rgba(148,163,184,0.08)' : 'rgba(71,85,105,0.06)');
                footGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = footGrad; ctx.beginPath(); ctx.ellipse(pSpBase.x, pSpBase.y, footW, Math.max(3, 4 * zoom), 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();

                // Cable Aéreo suspendido en 3D
                ctx.save();
                const cableGrad = ctx.createLinearGradient(pCrown.x, pCrown.y, pSpoolerCableAnchor.x, pSpoolerCableAnchor.y);
                cableGrad.addColorStop(0.0, 'rgba(244,63,94,0.90)'); cableGrad.addColorStop(0.5, 'rgba(251,113,133,0.70)'); cableGrad.addColorStop(1.0, 'rgba(244,63,94,0.55)');
                ctx.strokeStyle = cableGrad; ctx.lineWidth = 1.2 * zoom; ctx.setLineDash([4, 2]);
                const cpX = (pCrown.x + pSpoolerCableAnchor.x) / 2, cpY = Math.min(pCrown.y, pSpoolerCableAnchor.y) - 15 * zoom;
                ctx.beginPath(); ctx.moveTo(pCrown.x, pCrown.y); ctx.quadraticCurveTo(cpX, cpY, pSpoolerCableAnchor.x, pSpoolerCableAnchor.y); ctx.stroke();
                ctx.setLineDash([]); ctx.restore();

                // Guía del pozo al spooler en superficie
                ctx.save();
                ctx.strokeStyle = isDark ? 'rgba(245,158,11,0.22)' : 'rgba(120,53,15,0.18)'; ctx.lineWidth = 0.6; ctx.setLineDash([2, 4]);
                ctx.beginPath(); ctx.moveTo(pWell.x, pWell.y); ctx.lineTo(pSpBase.x, pSpBase.y); ctx.stroke();
                ctx.setLineDash([]); ctx.restore();

                // Placa Base en 3D
                ctx.fillStyle = isDark ? 'rgba(51,65,85,0.85)' : 'rgba(203,213,225,0.90)';
                ctx.strokeStyle = isDark ? '#475569' : '#94a3b8'; ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(pPlatSp[0].x, pPlatSp[0].y);
                for (let i = 1; i < 4; i++) ctx.lineTo(pPlatSp[i].x, pPlatSp[i].y);
                ctx.closePath();
                ctx.fill(); ctx.stroke();

                // Patas estructurales del marco (A-Frames)
                ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.90)' : 'rgba(51,65,85,0.85)'; ctx.lineWidth = 1.1 * zoom;
                ctx.beginPath();
                ctx.moveTo(pFrameL[0].x, pFrameL[0].y); ctx.lineTo(pFrameL[2].x, pFrameL[2].y); ctx.lineTo(pFrameL[1].x, pFrameL[1].y);
                ctx.moveTo(pFrameR[0].x, pFrameR[0].y); ctx.lineTo(pFrameR[2].x, pFrameR[2].y); ctx.lineTo(pFrameR[1].x, pFrameR[1].y);
                ctx.stroke();

                // Helpers para dibujar tambor en 3D
                const drawSpoolerCircle = (lx: number, radius: number) => {
                    ctx.beginPath();
                    for (let theta = 0; theta <= 2 * Math.PI + 0.1; theta += Math.PI / 12) {
                        const ly = radius * Math.cos(theta);
                        const lz = -spH_3d * 0.9 + radius * Math.sin(theta);
                        const p = projectSp(lx, ly, lz);
                        if (theta === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    }
                    ctx.stroke();
                };

                const fillSpoolerCylinder = (lxStart: number, lxEnd: number, radius: number, fillColor: string) => {
                    ctx.fillStyle = fillColor;
                    ctx.beginPath();
                    for (let theta = 0; theta <= 2 * Math.PI + 0.1; theta += Math.PI / 12) {
                        const ly = radius * Math.cos(theta);
                        const lz = -spH_3d * 0.9 + radius * Math.sin(theta);
                        const p = projectSp(lxStart, ly, lz);
                        if (theta === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    }
                    for (let theta = 2 * Math.PI; theta >= 0; theta -= Math.PI / 12) {
                        const ly = radius * Math.cos(theta);
                        const lz = -spH_3d * 0.9 + radius * Math.sin(theta);
                        const p = projectSp(lxEnd, ly, lz);
                        ctx.lineTo(p.x, p.y);
                    }
                    ctx.closePath();
                    ctx.fill();
                };

                // Cilindro del Tambor (Cable enrollado)
                fillSpoolerCylinder(-spW_3d * 0.65, spW_3d * 0.65, drumRadius, isDark ? '#92400e' : '#b45309');

                // Vueltas del cable enrolladas (Detalle visual 3D)
                ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706'; ctx.lineWidth = 0.5 * zoom;
                for (let lx = -spW_3d * 0.55; lx <= spW_3d * 0.55; lx += spW_3d * 0.15) {
                    drawSpoolerCircle(lx, drumRadius);
                }

                // Bridas laterales del tambor
                ctx.strokeStyle = isDark ? '#94a3b8' : '#475569';
                ctx.fillStyle = isDark ? 'rgba(71,85,105,0.92)' : 'rgba(148,163,184,0.95)';
                ctx.lineWidth = 0.7 * zoom;

                // Brida Izquierda
                drawSpoolerCircle(-spW_3d * 0.7, flangeRadius);
                ctx.fill();
                // Brida Derecha
                drawSpoolerCircle(spW_3d * 0.7, flangeRadius);
                ctx.fill();

                // Eje central
                ctx.strokeStyle = isDark ? '#e2e8f0' : '#0f172a'; ctx.lineWidth = 1.3 * zoom;
                ctx.beginPath();
                ctx.moveTo(pAxleL.x, pAxleL.y); ctx.lineTo(pAxleR.x, pAxleR.y);
                ctx.stroke();

                // Panel flotante
                const labelY = pSpBase.y + 4 * zoom;
                const panelW = Math.max(30, 48 * zoom), panelH = Math.max(10, 14 * zoom);
                ctx.fillStyle = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.90)';
                ctx.strokeStyle = isDark ? 'rgba(245,158,11,0.30)' : 'rgba(146,64,14,0.25)'; ctx.lineWidth = 0.6;
                ctx.beginPath(); ctx.roundRect(pSpBase.x - panelW / 2, labelY, panelW, panelH, 3); ctx.fill(); ctx.stroke();
                ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                const fs1 = Math.max(5, 5.5 * zoom);
                ctx.font = `bold ${fs1}px monospace`;
                ctx.strokeStyle = isDark ? 'rgba(2,6,23,0.9)' : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.0;
                ctx.strokeText('SPOOLER', pSpBase.x, labelY + 2.5); ctx.fillStyle = isDark ? '#fbbf24' : '#92400e'; ctx.fillText('SPOOLER', pSpBase.x, labelY + 2.5);
                ctx.restore();
            }

            // ── Casing con Depth Cueing (Atenuación por Distancia) ──
            for (let i = 1; i < projectedPoints.length; i++) {
                const p0 = projectedPoints[i - 1], p1 = projectedPoints[i];
                if (p1.pt.md <= params.wellbore.casingBottom) {
                    const df = (p1.depth + maxRange) / (maxRange * 2);
                    const depthRatio = (p1.depth + maxRange) / (maxRange * 2);
                    const visualOpacity = Math.max(0.25, Math.min(1.0, 0.3 + depthRatio * 0.7));
                    drawTubeSegment(ctx, p0, p1, 9.0 * 1.2 * zoom * df + 2.5, 'rgba(148,163,184,0.32)', 'rgba(241,245,249,0.75)', 'rgba(71,85,105,0.42)', yaw, 0.72 * visualOpacity);
                }
            }
            const casingShoeIdx = projectedPoints.findIndex(p => p.pt.md >= params.wellbore.casingBottom);
            if (casingShoeIdx > 0) {
                const sp = projectedPoints[casingShoeIdx], pp = projectedPoints[casingShoeIdx - 1];
                const df = (sp.depth + maxRange) / (maxRange * 2);
                const depthRatio = (sp.depth + maxRange) / (maxRange * 2);
                const visualOpacity = Math.max(0.25, Math.min(1.0, 0.3 + depthRatio * 0.7));
                drawTubeSegment(ctx, pp, sp, 9.0 * 1.2 * zoom * df + 3.8, 'rgba(148,163,184,0.70)', 'rgba(241,245,249,0.95)', 'rgba(71,85,105,0.75)', yaw, 0.95 * visualOpacity);
                drawText('ZAPATA CASING', sp.x + 14, sp.y, 'bold 7.5px monospace', isDark ? '#cbd5e1' : '#475569');
            }

            // ── Tubing con Depth Cueing (Atenuación por Distancia) ──
            for (let i = 1; i < projectedPoints.length; i++) {
                const p0 = projectedPoints[i - 1], p1 = projectedPoints[i];
                if (p1.pt.md <= params.pressures.pumpDepthMD) {
                    const df = (p1.depth + maxRange) / (maxRange * 2);
                    const depthRatio = (p1.depth + maxRange) / (maxRange * 2);
                    const visualOpacity = Math.max(0.25, Math.min(1.0, 0.3 + depthRatio * 0.7));
                    drawTubeSegment(ctx, p0, p1, baseTubingRadius * zoom * df + 0.8, 'rgba(180,83,9,0.95)', 'rgba(251,191,36,1.0)', 'rgba(124,45,18,0.95)', yaw, 1.0 * visualOpacity);
                }
            }

            // ── Wellpath Principal con Color Overlay y Depth Cueing ──
            for (let i = 1; i < projectedPoints.length; i++) {
                const p0 = projectedPoints[i - 1], p1 = projectedPoints[i];
                const ptData = p1.pt;

                let colorT = 0;
                if (colorOverlay3D === 'depth') colorT = ptData.tvd / Math.max(maxZ, 1);
                else if (colorOverlay3D === 'inc') colorT = ptData.inc / 90;
                else colorT = ptData.dogleg / globalMaxDLS;

                const [cr, cg, cb] = getEstheticColorRgb(colorT, colorOverlay3D);
                const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.sqrt(dx * dx + dy * dy);
                if (len < 0.2) continue;

                const df = (p1.depth + maxRange) / (maxRange * 2);
                const tubeR = 2.5 * zoom * df + 0.8;
                const nx = -dy / len, ny = dx / len;
                const hl = Math.max(0.12, Math.min(0.88, 0.30 + 0.20 * Math.sin(yaw + Math.atan2(dy, dx))));

                const dr = Math.round(cr * 0.22), dg = Math.round(cg * 0.22), db = Math.round(cb * 0.22);
                const sR = Math.min(255, Math.round(cr + (255 - cr) * 0.55)), sG = Math.min(255, Math.round(cg + (255 - cg) * 0.55)), sB = Math.min(255, Math.round(cb + (255 - cb) * 0.55));

                const depthRatio = (p1.depth + maxRange) / (maxRange * 2);
                const visualOpacity = Math.max(0.25, Math.min(1.0, 0.3 + depthRatio * 0.7));

                const tGrad = ctx.createLinearGradient(p0.x + nx * tubeR, p0.y + ny * tubeR, p0.x - nx * tubeR, p0.y - ny * tubeR);
                tGrad.addColorStop(0.00, `rgba(${dr},${dg},${db},${0.92 * visualOpacity})`);
                tGrad.addColorStop(hl, `rgba(${cr},${cg},${cb},${visualOpacity})`);
                tGrad.addColorStop(1.00, `rgba(${dr},${dg},${db},${0.92 * visualOpacity})`);

                ctx.fillStyle = tGrad;
                ctx.beginPath();
                ctx.moveTo(p0.x + nx * tubeR, p0.y + ny * tubeR); ctx.lineTo(p1.x + nx * tubeR, p1.y + ny * tubeR);
                ctx.lineTo(p1.x - nx * tubeR, p1.y - ny * tubeR); ctx.lineTo(p0.x - nx * tubeR, p0.y - ny * tubeR);
                ctx.closePath(); ctx.fill();

                ctx.strokeStyle = `rgba(${sR},${sG},${sB},${0.28 * visualOpacity})`; ctx.lineWidth = 0.45;
                ctx.beginPath(); ctx.moveTo(p0.x + nx * tubeR, p0.y + ny * tubeR); ctx.lineTo(p1.x + nx * tubeR, p1.y + ny * tubeR); ctx.stroke();
            }

            // ── ALS Pump Stack Detallada con Depth Cueing ──
            {
                const espStackLen = Math.min(60, maxMD * 0.04);
                const pumpMD = params.pressures.pumpDepthMD;
                const motorBotMD = pumpMD + espStackLen * 0.40;
                const sealBotMD = motorBotMD + espStackLen * 0.15;
                const pumpBotMD = sealBotMD + espStackLen * 0.45;
                const projAtMD = (md: number) => {
                    for (let i = 1; i < projectedPoints.length; i++) {
                        const a = projectedPoints[i - 1], b = projectedPoints[i];
                        if (b.pt.md >= md) {
                            const t = (md - a.pt.md) / Math.max(0.001, b.pt.md - a.pt.md);
                            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, depth: a.depth + (b.depth - a.depth) * t };
                        }
                    }
                    return projectedPoints[projectedPoints.length - 1];
                };
                const pMT = projAtMD(pumpMD), pMB = projAtMD(motorBotMD), pSB = projAtMD(sealBotMD), pPB = projAtMD(pumpBotMD);
                const df = (pMT.depth + maxRange) / (maxRange * 2);
                const baseRad = 8.5 * zoom * Math.max(0.35, df);
                const depthRatio = (pMT.depth + maxRange) / (maxRange * 2);
                const visualOpacity = Math.max(0.25, Math.min(1.0, 0.3 + depthRatio * 0.7));

                drawTubeSegment(ctx, pMT, pMB, baseRad, '#1e293b', '#475569', '#0f172a', yaw, visualOpacity);
                for (let bi = 0.25; bi < 1.0; bi += 0.25) {
                    const bx = pMT.x + (pMB.x - pMT.x) * bi, by = pMT.y + (pMB.y - pMT.y) * bi;
                    const bdx = pMB.x - pMT.x, bdy = pMB.y - pMT.y, blen = Math.sqrt(bdx * bdx + bdy * bdy);
                    if (blen > 0.5) { const bnx = -bdy / blen, bny = bdx / blen; ctx.strokeStyle = isDark ? `rgba(148,163,184,${0.4 * visualOpacity})` : `rgba(30,41,59,${0.3 * visualOpacity})`; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(bx + bnx * baseRad, by + bny * baseRad); ctx.lineTo(bx - bnx * baseRad, by - bny * baseRad); ctx.stroke(); }
                }
                drawTubeSegment(ctx, pMB, pSB, baseRad * 0.88, '#713f12', '#d97706', '#854d0e', yaw, visualOpacity);
                drawTubeSegment(ctx, pSB, pPB, baseRad, '#164e63', '#0891b2', '#083344', yaw, visualOpacity);
                for (let bi = 0.2; bi < 1.0; bi += 0.2) {
                    const bx = pSB.x + (pPB.x - pSB.x) * bi, by = pSB.y + (pPB.y - pSB.y) * bi;
                    const bdx = pPB.x - pSB.x, bdy = pPB.y - pSB.y, blen = Math.sqrt(bdx * bdx + bdy * bdy);
                    if (blen > 0.5) { const bnx = -bdy / blen, bny = bdx / blen; ctx.strokeStyle = `rgba(6,182,212,${0.5 * visualOpacity})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(bx + bnx * (baseRad + 2.5), by + bny * (baseRad + 2.5)); ctx.lineTo(bx - bnx * (baseRad + 2.5), by - bny * (baseRad + 2.5)); ctx.stroke(); }
                }
                const lox = pMT.x > w / 2 ? -90 : 12;
                ctx.strokeStyle = `rgba(6,182,212,${0.5 * visualOpacity})`; ctx.lineWidth = 0.9;
                ctx.beginPath(); ctx.moveTo(pMT.x, pMT.y); ctx.lineTo(pMT.x + lox, pMT.y - 14); ctx.lineTo(pMT.x + lox + (lox > 0 ? 60 : -60), pMT.y - 14); ctx.stroke();
                drawText('SISTEMA ALS (ESP)', pMT.x + lox + (lox > 0 ? 0 : -60), pMT.y - 21, 'bold 8px monospace', isDark ? '#e0f2fe' : '#0f172a', lox > 0 ? 'left' : 'right');
                drawText(`${Math.round(pumpMD)} ft`, pMT.x + lox + (lox > 0 ? 0 : -60), pMT.y - 9, 'bold 7px monospace', isDark ? '#38bdf8' : '#0284c7', lox > 0 ? 'left' : 'right');
            }

            // ── ESP Cable con Depth Cueing ──
            for (let i = 1; i < projectedPoints.length; i++) {
                const p0 = projectedPoints[i - 1], p1 = projectedPoints[i];
                if (p1.pt.md <= params.pressures.pumpDepthMD) {
                    const df = (p1.depth + maxRange) / (maxRange * 2);
                    const rad = (baseTubingRadius * zoom * df + 0.8) + 1.2;
                    const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.sqrt(dx * dx + dy * dy);
                    if (len > 0.1) {
                        const nx = -dy / len, ny = dx / len;
                        const depthRatio = (p1.depth + maxRange) / (maxRange * 2);
                        const visualOpacity = Math.max(0.25, Math.min(1.0, 0.3 + depthRatio * 0.7));
                        ctx.beginPath(); ctx.moveTo(p0.x + nx * rad, p0.y + ny * rad); ctx.lineTo(p1.x + nx * rad, p1.y + ny * rad);
                        ctx.strokeStyle = `rgba(248,113,113,${visualOpacity})`; ctx.lineWidth = 1.35; ctx.stroke();
                    }
                }
            }

            // ── Perforaciones con Depth Cueing ──
            const perfTopIdx = projectedPoints.findIndex(p => p.pt.md >= params.wellbore.midPerfsMD - 70);
            const perfBotIdx = projectedPoints.findIndex(p => p.pt.md >= params.wellbore.midPerfsMD + 70);
            if (perfTopIdx !== -1 && perfBotIdx !== -1) {
                const midPt = projectedPoints[Math.floor((perfTopIdx + perfBotIdx) / 2)];
                const depthRatio = (midPt.depth + maxRange) / (maxRange * 2);
                const visualOpacity = Math.max(0.25, Math.min(1.0, 0.3 + depthRatio * 0.7));

                ctx.strokeStyle = `rgba(245,158,11,${0.42 * visualOpacity})`; ctx.lineWidth = 0.8;
                for (let i = perfTopIdx; i <= perfBotIdx; i += 3) {
                    const p = projectedPoints[i];
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5); ctx.stroke(); }
                }
                ctx.strokeStyle = `rgba(245,158,11,${0.55 * visualOpacity})`; ctx.lineWidth = 0.9;
                ctx.beginPath(); ctx.moveTo(midPt.x, midPt.y); ctx.lineTo(midPt.x + 30, midPt.y + 16); ctx.lineTo(midPt.x + 85, midPt.y + 16); ctx.stroke();
                drawText('PERFORACIONES', midPt.x + 32, midPt.y + 11, 'bold 8px monospace', '#fb923c');
                drawText(`MD: ${Math.round(params.wellbore.midPerfsMD)} ft`, midPt.x + 32, midPt.y + 22, 'bold 7px monospace', '#f59e0b');
            }

            // ── Mini Brújula de Orientación en la Esquina Superior Izquierda ───
            const compX = 45, compY = 45, compR = 24;
            const angleN = -yaw - Math.PI / 2;
            ctx.save();
            ctx.beginPath(); ctx.arc(compX, compY, compR, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.92)';
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; ctx.lineWidth = 1.0; ctx.fill(); ctx.stroke();

            const tx = compX + Math.cos(angleN) * (compR - 7), ty = compY + Math.sin(angleN) * (compR - 7);
            drawText('N', tx, ty, 'bold 8px sans-serif', '#ef4444', 'center');
            ctx.restore();

            // ── Color Scale Legend ──
            {
                const lgX = w - 50, lgY = Math.round(h / 2 - 75), lgH = 150, lgW = 12;
                const overlayLabel = colorOverlay3D === 'dogleg' ? 'DLS (°/100ft)' : colorOverlay3D === 'inc' ? 'Inc (°)' : 'TVD (ft)';
                const overlayMax = colorOverlay3D === 'dogleg' ? globalMaxDLS : colorOverlay3D === 'inc' ? 90 : Math.round(maxZ);
                ctx.save();
                ctx.fillStyle = isDark ? 'rgba(15,23,42,0.80)' : 'rgba(255,255,255,0.86)';
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.roundRect(lgX - 10, lgY - 24, lgW + 45, lgH + 42, 8); ctx.fill(); ctx.stroke();
                ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b'; ctx.fillText(overlayLabel, lgX + lgW / 2 + 8, lgY - 8);
                for (let py = 0; py < lgH; py++) {
                    const [r, g, b] = getEstheticColorRgb(1 - py / lgH, colorOverlay3D);
                    ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(lgX, lgY + py, lgW, 1.5);
                }
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.7; ctx.strokeRect(lgX, lgY, lgW, lgH);
                ctx.font = '6.5px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
                for (let ti = 0; ti <= 5; ti++) {
                    const tVal = ti / 5, tPy = lgY + tVal * lgH, tNum = (1 - tVal) * overlayMax;
                    ctx.beginPath(); ctx.moveTo(lgX + lgW, tPy); ctx.lineTo(lgX + lgW + 4, tPy); ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.5; ctx.stroke();
                    ctx.fillText(tNum.toFixed(colorOverlay3D === 'dogleg' ? 1 : 0), lgX + lgW + 6, tPy);
                }
                ctx.restore();
            }

            // ── Hover Tooltip Estilizado ──
            if (hoveredPointIdx !== null && hoveredPointIdx < projectedPoints.length) {
                const hPt = projectedPoints[hoveredPointIdx];
                ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(hPt.x, hPt.y, 4, 0, Math.PI * 2); ctx.fill();
                const boxW = 135, boxH = 62, bx = hPt.x + 15 + boxW > w ? hPt.x - 15 - boxW : hPt.x + 15, by = hPt.y - 31;
                ctx.save();
                ctx.fillStyle = isDark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.96)';
                ctx.strokeStyle = isDark ? 'rgba(56,189,248,0.25)' : 'rgba(15,23,42,0.12)'; ctx.lineWidth = 1.0;
                ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 6); ctx.fill(); ctx.stroke();
                ctx.fillStyle = isDark ? '#fff' : '#0f172a'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(`MD: ${Math.round(hPt.pt.md)} ft`, bx + 8, by + 6);
                ctx.font = '7px monospace'; ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
                ctx.fillText(`TVD: ${Math.round(hPt.pt.tvd)} ft`, bx + 8, by + 17);
                ctx.fillText(`Inc: ${hPt.pt.inc.toFixed(1)}° | Az: ${hPt.pt.azim.toFixed(0)}°`, bx + 8, by + 28);
                ctx.fillText(`DLS: ${hPt.pt.dogleg.toFixed(2)} °/100ft`, bx + 8, by + 39);
                ctx.restore();
            }
        };

        const tick = () => {
            rafId = null;
            let shouldContinue = false;
            if (isAutoRotRef.current) {
                yawRef.current = (yawRef.current + 0.0025) % (Math.PI * 2);
                shouldContinue = true;
                needsRenderRef.current = true;
            }
            if (needsRenderRef.current) {
                drawFrame();
                needsRenderRef.current = false;
            }
            if (shouldContinue) {
                rafId = requestAnimationFrame(tick);
            }
        };

        const triggerRender = () => {
            if (rafId === null) {
                rafId = requestAnimationFrame(tick);
            }
        };
        requestRenderRef.current = triggerRender;

        const resizeObserver = new ResizeObserver(() => {
            needsRenderRef.current = true;
            triggerRender();
        });
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }

        needsRenderRef.current = true;
        triggerRender();

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            resizeObserver.disconnect();
            requestRenderRef.current = null;
            canvasSizeRef.current = { w: 0, h: 0, dpr: 1 };
        };
    }, [processedData, colorOverlay3D, params, spoolerAzimuth, isDark, maxMD, colorPrimary, viewMode]);

    // ── Event Handlers ────────────────────────────────────────────────────────

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        isAutoRotRef.current = false; setIsAutoRotating(false);
        dragRef.current = { x: e.clientX, y: e.clientY, yaw: yawRef.current, pitch: pitchRef.current };
        needsRenderRef.current = true;
        requestRenderRef.current?.();
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragRef.current) {
            const dx = e.clientX - dragRef.current.x, dy = e.clientY - dragRef.current.y;
            yawRef.current = (dragRef.current.yaw - dx * 0.005 + Math.PI * 2) % (Math.PI * 2);
            pitchRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, dragRef.current.pitch + dy * 0.005));
            needsRenderRef.current = true;
            requestRenderRef.current?.();
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas || processedData.length === 0) {
            if (hovIdxRef.current !== null) {
                hovIdxRef.current = null;
                needsRenderRef.current = true;
                requestRenderRef.current?.();
            }
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
        const bounds = boundsRef.current || computePlotBounds(processedData);
        const { cX, cY, cZ, maxRange } = bounds;
        const vScale = Math.min(rect.width, rect.height) * 0.75 / maxRange;
        const yaw = yawRef.current, pitch = pitchRef.current, zoom = zoomRef.current;

        let closestIdx: number | null = null, closestDist = 12;
        processedData.forEach((pt, idx) => {
            const tx = pt.x - cX, ty = pt.y - cY, tz = pt.z - cZ;
            const rx1 = tx * Math.cos(yaw) - ty * Math.sin(yaw);
            const ry1 = -(tx * Math.sin(yaw) + ty * Math.cos(yaw));
            const ry2 = ry1 * Math.cos(pitch) - tz * Math.sin(pitch);
            const sx = rect.width / 2 + rx1 * vScale * zoom, sy = rect.height / 2 + ry2 * vScale * zoom;
            const dist = Math.sqrt((sx - mouseX) ** 2 + (sy - mouseY) ** 2);
            if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
        });
        if (hovIdxRef.current !== closestIdx) {
            hovIdxRef.current = closestIdx;
            needsRenderRef.current = true;
            requestRenderRef.current?.();
        }
    }, [processedData]);

    const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        zoomRef.current = Math.max(0.4, Math.min(3.5, zoomRef.current - e.deltaY * 0.0008));
        needsRenderRef.current = true;
        requestRenderRef.current?.();
    }, []);

    const resetCamera = useCallback(() => {
        yawRef.current = Math.PI / 4.5;
        pitchRef.current = -Math.PI / 7.0;
        zoomRef.current = getInitialZoom();
        needsRenderRef.current = true;
        requestRenderRef.current?.();
    }, []);

    const toggleAutoRotate = useCallback(() => {
        const next = !isAutoRotRef.current; isAutoRotRef.current = next; setIsAutoRotating(next);
        needsRenderRef.current = true;
        requestRenderRef.current?.();
    }, []);

    const [activeMobileView, setActiveMobileView] = useState<'canvas' | 'polar'>('canvas');
    const isMobileLayout = typeof window !== 'undefined' && window.innerWidth < 1024;

    return (
        <div className="h-full flex flex-col glass-surface rounded-[1.5rem] border border-surface-light shadow-xl overflow-hidden relative select-none">
            {isMobileLayout && (
                <div className="flex p-1 bg-surface-light/25 border-b border-white/5 gap-1 z-20 shrink-0">
                    <button
                        onClick={() => {
                            setActiveMobileView('canvas');
                            needsRenderRef.current = true;
                            requestRenderRef.current?.();
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center ${activeMobileView === 'canvas' ? 'bg-primary text-white shadow-md' : 'text-txt-muted hover:bg-white/5'}`}
                    >
                        Visualización 3D
                    </button>
                    <button
                        onClick={() => {
                            setActiveMobileView('polar');
                            needsRenderRef.current = true;
                            requestRenderRef.current?.();
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center ${activeMobileView === 'polar' ? 'bg-primary text-white shadow-md' : 'text-txt-muted hover:bg-white/5'}`}
                    >
                        Optimización Azimut
                    </button>
                </div>
            )}
            <div className={`relative z-10 flex-1 min-h-0 grid grid-cols-1 ${isSidebar ? '' : 'lg:grid-cols-2'}`}>

                {/* ── LEFT: 3D Canvas Estilizado o Mapa ── */}
                <div className={`relative flex flex-col min-w-0 bg-canvas/40 transition-all duration-300 ${isMobileLayout && activeMobileView !== 'canvas' ? 'hidden' : 'flex'} ${expandedCanvas ? 'fixed inset-0 z-50 bg-surface' : (isSidebar ? 'h-[380px] border-b border-surface-light/30' : 'border-r border-surface-light/30')}`}>

                    {/* Selector de Modo de Visualización Principal: 3D vs Mapa */}
                    <div className="absolute top-4 left-4 flex items-center gap-1 bg-surface/80 backdrop-blur-md p-1 rounded-xl border border-surface-light/30 z-[1001]">
                        <button
                            onClick={() => {
                                setViewMode('3d');
                                needsRenderRef.current = true;
                                requestRenderRef.current?.();
                            }}
                            className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all border ${viewMode === '3d' ? 'bg-primary/20 border-primary/40 text-primary' : 'border-transparent text-txt-muted hover:text-txt-main'}`}
                        >
                            Visualización 3D
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('map');
                            }}
                            className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all border ${viewMode === 'map' ? 'bg-primary/20 border-primary/40 text-primary' : 'border-transparent text-txt-muted hover:text-txt-main'}`}
                        >
                            Ubicación en Mapa
                        </button>
                    </div>

                    {viewMode === '3d' ? (
                        <>
                            {/* Botones de Control Flotantes Estilizados */}
                            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-surface/80 backdrop-blur-md p-1 rounded-xl border border-surface-light/30 z-20">
                                <button onClick={toggleAutoRotate} className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1 bg-white/5">
                                    {isAutoRotating ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                                </button>
                                <button onClick={resetCamera} className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1 bg-white/5">
                                    <RotateCw className="w-2.5 h-2.5" />
                                </button>
                                <div className="h-3 w-px bg-white/10 mx-0.5" />
                                <button onClick={() => setView('top')} className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg text-slate-400 hover:text-white transition-all bg-white/5">Planta</button>
                                <button onClick={() => setView('lateral')} className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg text-slate-400 hover:text-white transition-all bg-white/5">Perfil</button>
                            </div>

                            {/* Selector de Modo de Visualización */}
                            <div className="absolute top-4 right-4 flex items-center gap-1 bg-surface/80 backdrop-blur-md p-1 rounded-xl border border-surface-light/30 z-20">
                                {[
                                    { mode: 'depth' as const, label: 'Estructura' },
                                    { mode: 'inc' as const, label: 'Inc (°)' },
                                    { mode: 'dogleg' as const, label: 'DLS (Severidad)' }
                                ].map(({ mode, label }) => (
                                    <button
                                        key={mode}
                                        onClick={() => {
                                            setColorOverlay3D(mode);
                                            needsRenderRef.current = true;
                                            requestRenderRef.current?.();
                                        }}
                                        className={`text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${colorOverlay3D === mode ? 'bg-primary/20 border border-primary/40 text-primary' : 'border border-transparent text-txt-muted hover:text-txt-main'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Overlay del Gráfico de Perfil Hidráulico de Trayectoria vs TVD */}
                            <div className="absolute left-2 top-12 bottom-12 w-[130px] bg-surface/15 backdrop-blur-sm border border-surface-light/10 rounded-[1.5rem] p-2.5 z-20 flex flex-col pointer-events-auto shadow-none">
                                <h2 className="text-[8px] font-bold text-txt-muted uppercase tracking-widest mb-2 text-center">
                                    Perfil Hidráulico
                                </h2>
                                <div className="flex-1 min-h-0 flex items-center justify-center">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart layout="vertical" data={chartData} margin={{ top: 10, right: 2, left: -32, bottom: 10 }}>
                                                <CartesianGrid stroke={colorSurfaceLight} strokeDasharray="3 3" opacity={0.06} horizontal={false} />
                                                <XAxis type="number" domain={[0, 90]} orientation="top" tick={{ fill: 'rgb(var(--color-primary))', fontSize: 7 }} tickLine={false} />
                                                <XAxis xAxisId="dls" type="number" domain={[0, maxDLS]} orientation="bottom" tick={{ fill: 'rgb(var(--color-warning))', fontSize: 7 }} tickLine={false} />
                                                <YAxis dataKey="tvd" type="number" domain={[safeMaxTVD, 0]} tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 7 }} tickLine={false} />
                                                <Line type="monotone" dataKey="inc" stroke="rgb(var(--color-primary))" strokeWidth={2.0} dot={false} />
                                                <Line xAxisId="dls" type="stepAfter" dataKey="dogleg" stroke="rgb(var(--color-warning))" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
                                                {Number.isFinite(pumpDepthTVD) && (
                                                    <ReferenceLine y={pumpDepthTVD} stroke="rgb(var(--color-primary))" strokeWidth={1.2} strokeDasharray="3 3" />
                                                )}
                                                {Number.isFinite(casingBottomTVD) && (
                                                    <ReferenceLine y={casingBottomTVD} stroke="rgb(var(--color-danger))" strokeWidth={1.2} strokeDasharray="3 3" />
                                                )}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="text-[10px] font-bold text-txt-muted uppercase">No hay datos de trayectoria válidos</div>
                                    )}
                                </div>
                            </div>

                            <canvas
                                ref={canvasRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onWheel={handleWheel}
                                className="w-full h-full cursor-grab active:cursor-grabbing block relative z-10"
                            />
                        </>
                    ) : (
                        <div className="flex-1 w-full h-full min-h-[380px] p-2 relative z-10 bg-canvas/30">
                            <TrajectoryMap survey={survey} params={params} spoolerAzimuth={spoolerAzimuth} />
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Charts & Analytics ── */}
                <div className={`flex flex-col bg-canvas/40 p-6 gap-6 justify-center items-center ${isMobileLayout && activeMobileView !== 'polar' ? 'hidden' : 'flex'} ${isSidebar ? 'border-t border-surface-light/30' : 'border-l border-surface-light/30'} ${isMobileLayout ? 'overflow-y-auto' : ''}`}>
                    <div className="flex flex-col items-center justify-center border border-surface-light/30 rounded-[2rem] p-6 bg-surface/40 backdrop-blur-md w-full max-w-[420px] shadow-xl">
                        <h2 className="text-[12px] font-black text-primary tracking-[0.2em] text-center mb-4 uppercase">
                            Optimización de Azimut - Spooler ALS
                        </h2>
                        <SpoolerPolarChart processedData={processedData} limitMD={limitMD} isDark={isDark} />

                        <div className="mt-6 w-full border-t border-white/5 pt-4 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-txt-muted uppercase">Dirección Promedio:</span>
                                <span className="font-mono font-black text-txt-main">{spoolerAzimuth}°</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-txt-muted uppercase">Límite de Profundidad MD:</span>
                                <span className="font-mono font-black text-txt-main">{Math.round(limitMD)} ft</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-txt-muted uppercase">Severidad Máxima (DLS):</span>
                                <span className="font-mono font-black text-warning">{maxCurveDLS.toFixed(2)} °/100ft</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};