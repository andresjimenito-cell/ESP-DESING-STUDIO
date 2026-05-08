import React, { useMemo } from 'react';
import { Box } from 'lucide-react';
import type { EspPump, EspMotor, EspVSD, SystemParams } from '../types';
import { useLanguage } from '@/i18n';
import { useTheme } from '@/theme';

interface Props {
    pump: EspPump | null;
    motor: EspMotor | undefined;
    params: SystemParams;
    results: any;
    frequency: number;
    cable?: any;
    selectedVSD?: EspVSD;
    mode?: 'ui' | 'report';
    health?: {
        pump?: 'normal' | 'caution' | 'alert' | 'failure';
        motor?: 'normal' | 'caution' | 'alert' | 'failure';
        seal?: 'normal' | 'caution' | 'alert' | 'failure';
        cable?: 'normal' | 'caution' | 'alert' | 'failure';
        vsd?: 'normal' | 'caution' | 'alert' | 'failure';
    };
}

export const VisualESPStack: React.FC<Props> = ({ pump, motor, params, results, frequency, cable, selectedVSD, mode = 'ui', health }) => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const isDark = theme === 'fusion' || theme === 'cyber';

    // --- CONFIG & SCALING ---
    const isReport = mode === 'report';
    // Se aumentó el ancho base (width) para crear más padding (alejar el dibujo) y se movió el centro correspondientemente.
    const width = isReport ? 1400 : 800;
    const center = isReport ? 700 : 400;
    const casingW = isReport ? 620 : 380;
    const tubingW = isReport ? 84 : 54;

    // --- COMPONENT WIDTHS ---
    const scaleFactor = isReport ? 2.8 : 1.6;
    const pumpW = 72 * scaleFactor;
    const flangeW = 78 * scaleFactor;
    const intakeW = 55 * scaleFactor;
    const sealW = 60 * scaleFactor;
    const motorW = 68 * scaleFactor;
    const sensorW = 42 * scaleFactor;
    const shaftW = 20 * scaleFactor;

    // --- HEIGHTS ---
    const dischargeH = 55;
    const housingCount = pump?.housingCount || 1;
    const totalPumpH = pump ? Math.min(350, Math.max(160, pump.stages * 2.2)) : 160;
    const bodyH = totalPumpH / housingCount;
    const gapH = 12;

    const intakeH = 70;
    const sealH = 110;

    const motorHp = motor?.hp || params.motorHp || 100;
    const motorH = Math.min(280, 130 + (motorHp * 0.4));
    const sensorH = 100;  // taller sensor

    // Y-Positions — VSD box space at top, then wellhead, then ESP string
    const vsdBoxH = selectedVSD ? (isReport ? 170 : 160) : 0;
    const vsdBoxW = isReport ? 480 : 250;
    const vsdBoxPad = selectedVSD ? (isReport ? 10 : 5) : 0;
    const treeHeight = isReport ? 260 : 180;                      // Taller Christmas Tree
    const surfY = vsdBoxH + vsdBoxPad + treeHeight;         // Surface ground line Y
    const tubingLen = isReport ? 180 : 250;                       // Tubing más largo
    const startY = surfY + tubingLen;

    const dischargeY = startY;
    const pumpTopY = dischargeY + dischargeH;
    const pumpSectionHeight = (bodyH * housingCount) + (gapH * (housingCount - 1));
    const pumpBottomY = pumpTopY + pumpSectionHeight;

    // connH reducido para mayor compacidad
    const connH = 4;

    const intakeY = pumpBottomY + connH;
    const sealY = intakeY + intakeH + connH;
    const motorY = sealY + sealH + connH;
    const sensorY = motorY + motorH + connH;
    const espBottomY = sensorY + sensorH;

    // ratHoleH moderado — suficiente para perforaciones y espacio inferior
    const ratHoleH = isReport ? 80 : 35;
    const casingBottomY = espBottomY + ratHoleH;

    const perfsVisualY = espBottomY + (ratHoleH * 0.5);
    const perfsH = 80;

    const bubbles = useMemo(() => {
        return Array.from({ length: 80 }).map((_, i) => ({
            id: i,
            side: Math.random() > 0.5 ? 'left' : 'right',
            offset: (isReport ? 35 : 50) + Math.random() * 80,
            size: 2.5 + Math.random() * 5,
            delay: Math.random() * 6,
            duration: 2.5 + Math.random() * 5
        }));
    }, [isReport]);

    const safeResults = {
        pip: results?.pip ?? 0,
        motorLoad: results?.motorLoad ?? 0,
        fluidLevel: results?.fluidLevel ?? 0,
        tdh: results?.tdh ?? 0,
        electrical: results?.electrical || { amps: 0, volts: 0, kva: 0, voltDrop: 0, kwLoss: 0 }
    };

    const intakeTemp = isNaN(params.bottomholeTemp) ? 150 : params.bottomholeTemp;
    const motorRise = (safeResults.motorLoad || 0) * 0.8;
    const motorTemp = intakeTemp + motorRise;

    const pumpDepthMD = params.pressures.pumpDepthMD || 0;
    // --- FLUID LEVEL VISUALIZATION ---
    // results.fluidLevel is depth from surface (MD)
    // submergence is the fluid column ABOVE the pump intake
    const submergenceFt = Math.max(0, pumpDepthMD - (results.fluidLevel || pumpDepthMD));
    const pixelsPerFt = isReport ? 0.25 : 0.4;

    let fluidY = intakeY - (submergenceFt * pixelsPerFt);
    if (isNaN(fluidY) || fluidY < surfY) fluidY = surfY;
    if (fluidY > casingBottomY) fluidY = casingBottomY;

    const getHealthColor = (type: keyof NonNullable<typeof health>) => {
        const status = health?.[type] || 'normal';
        const map = {
            normal: { main: 'rgb(var(--color-primary))', light: '#ffffff', glow: 'rgba(var(--color-primary), 0.3)' },
            caution: { main: '#fbbf24', light: '#fffbeb', glow: 'rgba(251, 191, 36, 0.4)' },
            alert: { main: '#ef4444', light: '#fef2f2', glow: 'rgba(239, 68, 68, 0.5)' },
            failure: { main: '#701a75', light: '#fdf4ff', glow: 'rgba(112, 26, 117, 0.6)' }
        };
        return map[status as keyof typeof map] || map.normal;
    };

    const pumpHealth = getHealthColor('pump');
    const motorHealth = getHealthColor('motor');
    const sealHealth = getHealthColor('seal');
    const vsdHealth = getHealthColor('vsd');

    // --- HELPER: Coupling neck (between pump tandem sections) ---
    const Coupling = ({ y, w = shaftW }: { y: number, w?: number }) => (
        <g>
            <rect x={center - w / 2 - 2} y={y - connH} width={w + 4} height={connH * 3} fill="url(#collarGrad)" stroke="#000" strokeWidth="0.5" />
            <rect x={center - w / 2 - 2} y={y - connH} width={w + 4} height={2} fill="rgb(var(--color-text-main))" opacity="0.1" />
        </g>
    );

    // --- HELPER: Realistic 2D Christmas Tree (Wellhead) ---
    const DetailedWellhead = ({ y }: { y: number }) => {
        const sc = isReport ? 0.55 : 0.3; // Escala más compacta para armonizar con el pozo
        const baseY = y;

        // Helper: Realistic Flange with Bolts
        const Flange = ({ cx, cy, w, h, vertical = false }: any) => (
            <g>
                <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={vertical ? "url(#treeRedH)" : "url(#treeRedCyl)"} rx="2" stroke="#221111" strokeWidth="1" />
                {vertical ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <circle key={i} cx={cx} cy={cy - h / 2 + (i + 0.5) * (h / 4)} r={2 * sc} fill="url(#boltGrad)" stroke="#111" strokeWidth="0.5" />
                    ))
                ) : (
                    Array.from({ length: 5 }).map((_, i) => (
                        <circle key={i} cx={cx - w / 2 + (i + 0.5) * (w / 5)} cy={cy} r={2 * sc} fill="url(#boltGrad)" stroke="#111" strokeWidth="0.5" />
                    ))
                )}
            </g>
        );

        // Helper: Realistic Industrial Valve Wheel (Black Finish)
        const IndustrialWheel = ({ r }: { r: number }) => (
            <g>
                {/* External Rim - Black/Charcoal with metallic highlight */}
                <circle r={r} fill="none" stroke="#0f172a" strokeWidth={r * 0.18} filter="url(#metalNoise)" />
                <circle r={r} fill="none" stroke="#334155" strokeWidth="1.2" opacity="0.4" />

                {/* Spokes - Dark Steel */}
                {[0, 45, 90, 135].map(deg => (
                    <line key={deg} x1={-r} y1="0" x2={r} y2="0" stroke="#1e293b" strokeWidth={r * 0.12} transform={`rotate(${deg})`} />
                ))}

                {/* Hub - Glossy Black */}
                <circle r={r * 0.22} fill="url(#blackHubGrad)" stroke="#000" strokeWidth="1" />
                <circle r={r * 0.08} fill="#64748b" opacity="0.5" />
            </g>
        );

        return (
            <g>
                {/* 10. LARGE BASE FLANGE (At Ground Level) */}
                <g transform={`translate(0, ${baseY - 18 * sc})`}>
                    <rect x={center - 110 * sc} y={0} width={220 * sc} height={35 * sc} fill="url(#treeRedCyl)" rx="4" filter="url(#deepShadow)" />
                    {Array.from({ length: 8 }).map((_, i) => (
                        <circle key={i} cx={center - 110 * sc + (i + 0.5) * (220 * sc / 8)} cy={17 * sc} r={8 * sc} fill="#111" opacity="0.6" />
                    ))}
                </g>

                {/* 9. BASE SPOOL */}
                <rect x={center - 65 * sc} y={baseY - 108 * sc} width={130 * sc} height={90 * sc} fill="url(#treeRedCyl)" />

                {/* 8. BASE FLANGE 1 */}
                <Flange cx={center} cy={baseY - 120 * sc} w={140 * sc} h={24 * sc} />

                {/* 7. LOWER MAIN VALVE */}
                <rect x={center - 55 * sc} y={baseY - 250 * sc} width={110 * sc} height={130 * sc} fill="url(#treeRedCyl)" />
                <g transform={`translate(${center}, ${baseY - 185 * sc})`}>
                    <IndustrialWheel r={60 * sc} />
                </g>

                {/* 6. LOWER CROSS FLANGE */}
                <Flange cx={center} cy={baseY - 262 * sc} w={140 * sc} h={24 * sc} />

                {/* 5. THE CROSS (CRUCETA) ASSEMBLY */}
                <g transform={`translate(${center}, ${baseY - 317 * sc})`}>
                    {/* Lateral Branches (Sequential Layout) */}
                    {[-1, 1].map(side => {
                        const startX = side * 55 * sc;
                        const pipeW = 40 * sc;
                        const flangeW = 24 * sc;
                        const valveW = 90 * sc;
                        const capW = 16 * sc;

                        return (
                            <g key={side}>
                                {/* Horizontal Pipe Segment */}
                                <rect x={side === 1 ? startX : startX - pipeW} y={-30 * sc} width={pipeW} height={60 * sc} fill="url(#treeRedH)" stroke="#221111" strokeWidth="1" />

                                {/* First Vertical Flange */}
                                <Flange cx={side * (55 + 40 + 12) * sc} cy={0} w={flangeW} h={110 * sc} vertical />

                                {/* Side Valve Block */}
                                <rect x={side === 1 ? (95 + 24) * sc : (-(95 + 24 + 90)) * sc} y={-45 * sc} width={valveW} height={90 * sc} fill="url(#treeRedCyl)" stroke="#221111" strokeWidth="1" />
                                <g transform={`translate(${side * (119 + 45) * sc}, 0) scale(0.8)`}>
                                    <IndustrialWheel r={45 * sc} />
                                </g>

                                {/* Second Vertical Flange */}
                                <Flange cx={side * (209 + 12) * sc} cy={0} w={flangeW} h={110 * sc} vertical />

                                {/* Blind End Cap (Only on right side, left connects to flow line) */}
                                {side === 1 && (
                                    <rect x={(233) * sc} y={-55 * sc} width={capW} height={110 * sc} fill="url(#treeRedCyl)" rx="2" stroke="#221111" strokeWidth="1" />
                                )}
                            </g>
                        );
                    })}

                    {/* Cross Center Block (Main Core) */}
                    <rect x={-55 * sc} y={-55 * sc} width={110 * sc} height={110 * sc} fill="url(#treeRedCyl)" stroke="#520500" strokeWidth="1.5" />
                    <circle r={35 * sc} fill="none" stroke="#fff" strokeWidth="1" opacity="0.1" />
                </g>

                {/* 4. CROSS FLANGE */}
                <Flange cx={center} cy={baseY - 372 * sc} w={140 * sc} h={24 * sc} />

                {/* 3. MAIN TOP VALVE */}
                <rect x={center - 55 * sc} y={baseY - 502 * sc} width={110 * sc} height={130 * sc} fill="url(#treeRedCyl)" />
                <g transform={`translate(${center}, ${baseY - 437 * sc})`}>
                    <IndustrialWheel r={60 * sc} />
                </g>

                {/* 2. TOP FLANGE */}
                <Flange cx={center} cy={baseY - 514 * sc} w={140 * sc} h={24 * sc} />

                {/* 1. TOP GAUGE ASSEMBLY */}
                <g transform={`translate(${center}, ${baseY - 559 * sc})`}>
                    <rect x={-13 * sc} y={-10 * sc} width={26 * sc} height={20 * sc} fill="url(#treeRedCyl)" rx="2" />
                    <rect x={-4 * sc} y={-25 * sc} width={8 * sc} height={15 * sc} fill="url(#cylinderMetal)" />
                    <rect x={-15 * sc} y={20 * sc} width={30 * sc} height={15 * sc} fill="url(#treeRedCyl)" />
                    <circle cy={-45 * sc} r={20 * sc} fill="url(#gaugeGrad)" stroke="#333" strokeWidth="3" />
                    <path d={`M ${-13 * sc} ${-45 * sc} A 13 13 0 0 1 ${13 * sc} ${-45 * sc}`} fill="none" stroke="#64748b" strokeWidth="0.5" strokeDasharray="1 1" />
                    <line x1="0" y1={-45 * sc} x2={10 * sc} y2={-55 * sc} stroke="#000" strokeWidth={2 * sc} strokeLinecap="round" />
                </g>
            </g>
        );
    };


    // --- HELPER: Tapered transition joint between two components ---
    const TransitionJoint = ({
        yTop, yBottom, topW, bottomW
    }: { yTop: number; yBottom: number; topW: number; bottomW: number }) => {
        const tl = center - topW / 2;
        const tr = center + topW / 2;
        const bl = center - bottomW / 2;
        const br = center + bottomW / 2;
        return (
            <g>
                <path
                    d={`M${tl} ${yTop} L${tr} ${yTop} L${br} ${yBottom} L${bl} ${yBottom} Z`}
                    fill="url(#collarGrad)"
                    stroke="#000"
                    strokeWidth="0.8"
                />
                {/* Left edge highlight */}
                <path d={`M${tl + 1.5} ${yTop} L${bl + 1.5} ${yBottom}`} stroke="rgb(var(--color-text-main))" strokeWidth="1.2" opacity="0.3" />
                {/* Right edge shadow */}
                <path d={`M${tr - 1.5} ${yTop} L${br - 1.5} ${yBottom}`} stroke="#000" strokeWidth="1.6" opacity="0.6" />
            </g>
        );
    };

    // --- HELPER: Unified Digital Twin Tag (Blueprint Style) ---
    // Uses fixed columns for a perfectly vertical "List" (Legend) look.
    const DigitalTwinTag = ({ y, label, value, unit, side = 'right', color = 'slate', hideLine = false, customOffsetX }: any) => {
        const isData = !!value;
        const colOffset = isReport ? 280 : 180;

        // Increased tag dimensions to accommodate multi-line text
        const tagWidth = isReport ? 280 : 180;
        const tagHeight = isReport ? 84 : 64; // Increased height for wrapping

        const xStart = side === 'right' ? center + (pumpW / 2) + 12 : center - (pumpW / 2) - 12;
        const xFixedColumn = side === 'right'
            ? center + (customOffsetX ?? colOffset)
            : center - (customOffsetX ?? colOffset);

        const accent = "#64748b";
        const guideColor = isDark ? "#94a3b8" : "#475569";

        // Logic for wrapping text:
        const mainContent = isData ? String(value) : label.toUpperCase();
        const charLimit = isReport ? 18 : 14;

        // Split content into lines manually for SVG
        const words = mainContent.split(' ');
        const lines: string[] = [];
        let currentLine = "";

        words.forEach(word => {
            if (word === '/' && currentLine) {
                currentLine += "/";
                return;
            }

            if ((currentLine + word).length > charLimit && currentLine !== "") {
                lines.push(currentLine.trim());
                currentLine = word + " ";
            } else {
                currentLine += word + " ";
            }
        });
        if (currentLine) lines.push(currentLine.trim());

        const mainFontSize = isReport ? 22 : 16;
        const lineHeight = isReport ? 22 : 16;

        return (
            <g>
                {!hideLine && (
                    <>
                        {/* Connection Line */}
                        <path
                            d={`M${xStart} ${y} L${xFixedColumn} ${y}`}
                            stroke={guideColor}
                            strokeWidth="1.5"
                            opacity={isDark ? 0.9 : 1}
                        />

                        {/* Terminal Point */}
                        <circle cx={xStart} cy={y} r="4" fill={isDark ? "#020617" : "#fff"} stroke={guideColor} strokeWidth="2" />
                        <circle cx={xStart} cy={y} r="1.5" fill={guideColor} />
                    </>
                )}

                <g transform={`translate(${side === 'right' ? xFixedColumn : xFixedColumn - tagWidth}, ${y - tagHeight / 2})`}>
                    <rect width={tagWidth} height={tagHeight} rx="2"
                        fill={isDark ? "#020617" : "#ffffff"}
                        stroke={isDark ? "#1e293b" : "#cbd5e1"}
                        strokeWidth={isDark ? 1 : 1.2}
                        opacity={isDark ? 0.95 : 1} />

                    <rect width={4} height={tagHeight} fill={accent} opacity={0.5} />

                    <text x={12} y={16} fontSize={isReport ? 11 : 9} fill={isDark ? "#94a3b8" : "#64748b"} fontWeight="800"
                        fontFamily="'Inter', sans-serif" letterSpacing="0.08em">
                        {label.toUpperCase()}
                    </text>

                    <text x={12} y={isReport ? 42 : 36}
                        fill={isDark ? "#f8fafc" : "#1e293b"}
                        fontWeight="950"
                        fontFamily="'JetBrains Mono', monospace">
                        {lines.map((line, i) => (
                            <tspan key={i} x={12} dy={i === 0 ? 0 : lineHeight} fontSize={mainFontSize}>
                                {line}
                            </tspan>
                        ))}
                        {isData && unit && (
                            <tspan fontSize={isReport ? 14 : 11} fill={isDark ? "#475569" : "#94a3b8"} fontWeight="600" dx="6">
                                {unit}
                            </tspan>
                        )}
                    </text>

                    <rect x={tagWidth - 10} y={8} width={4} height={4} fill={accent} opacity="0.4">
                        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite" />
                    </rect>
                </g>
            </g>
        );
    };






    // Real rendered Y positions accounting for connH transforms applied to each group
    const intakeRealTop = intakeY + connH;
    const intakeRealBottom = intakeRealTop + intakeH;
    const sealRealTop = intakeRealBottom + connH;
    const sealRealBottom = sealRealTop + sealH;
    const motorRealTop = sealRealBottom + connH;
    const motorRealBottom = motorRealTop + motorH;
    const sensorRealTop = motorRealBottom + connH;

    return (
        <div className={`h-full w-full bg-canvas relative overflow-hidden flex flex-col items-center ${isReport ? '' : 'border-l border-white/5'} select-none transition-colors duration-500`}>
            {/* Background geology texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 Q 25 10 50 20 T 100 20' fill='none' stroke='%23ffffff' stroke-width='2'/%3E%3Cpath d='M0 50 Q 25 40 50 50 T 100 50' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3Cpath d='M0 80 Q 25 70 50 80 T 100 80' fill='none' stroke='%23ffffff' stroke-width='3'/%3E%3C/svg%3E")`,
                backgroundSize: '200px 200px'
            }}></div>

            {/* Header badge removed as requested */}

            {/* Depth measures removed as requested */}

            <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex justify-center relative z-10">
                <svg viewBox={`0 0 ${width} ${casingBottomY + 20}`} style={{ maxHeight: '100%', width: 'auto', minWidth: mode === 'report' ? '280px' : '400px' }} preserveAspectRatio="xMidYMin meet">
                    <defs>
                        {/* ── GEOLOGY GRADIENTS ── */}
                        {/* ── GEOLOGY STRATA GRADIENTS ── */}
                        <linearGradient id="geology1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5d4037" />
                            <stop offset="100%" stopColor="#3e2723" />
                        </linearGradient>
                        <linearGradient id="geology2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#455a64" />
                            <stop offset="100%" stopColor="#263238" />
                        </linearGradient>
                        <linearGradient id="geology3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#212121" />
                            <stop offset="100%" stopColor="#000000" />
                        </linearGradient>
                        <pattern id="geologyTexture" width="200" height="200" patternUnits="userSpaceOnUse">
                            <filter id="geoNoise">
                                <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" stitchTiles="stitch" />
                                <feColorMatrix type="saturate" values="0" />
                            </filter>
                            <rect width="200" height="200" filter="url(#geoNoise)" opacity="0.1" />
                        </pattern>

                        {/* ── STEEL GRADIENTS ── Aspecto metálico sólido */}
                        <linearGradient id="cylinderMetal" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#0a0a0c" />
                            <stop offset="15%" stopColor="#374151" />
                            <stop offset="30%" stopColor="#9ca3af" />
                            <stop offset="50%" stopColor="#ffffff" />
                            <stop offset="70%" stopColor="#374151" />
                            <stop offset="100%" stopColor="#0a0a0c" />
                        </linearGradient>
                        <linearGradient id="vsdMainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#ffffff76" />
                            <stop offset="20%" stopColor="#f8fafc" />
                            <stop offset="100%" stopColor="#e2e8f09b" />
                        </linearGradient>
                        <linearGradient id="cylinderPump" x1="0%" y1="0%" x2="100%" y2="0%">
                            {isDark ? (
                                <>
                                    <stop offset="0%" stopColor="#020617" />
                                    <stop offset="35%" stopColor="#334155" />
                                    <stop offset="50%" stopColor="#94a3b8" />
                                    <stop offset="65%" stopColor="#334155" />
                                    <stop offset="100%" stopColor="#020617" />
                                </>
                            ) : (
                                <>
                                    <stop offset="0%" stopColor="#cbd5e1" />
                                    <stop offset="35%" stopColor="#e2e8f0" />
                                    <stop offset="50%" stopColor="#ffffff" />
                                    <stop offset="65%" stopColor="#e2e8f0" />
                                    <stop offset="100%" stopColor="#cbd5e1" />
                                </>
                            )}
                        </linearGradient>
                        <linearGradient id="motorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={isDark ? "#0f172a" : "#94a3b8"} />
                            <stop offset="50%" stopColor={isDark ? "#475569" : "#cbd5e1"} />
                            <stop offset="100%" stopColor={isDark ? "#0f172a" : "#94a3b8"} />
                        </linearGradient>
                        <linearGradient id="sealGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={isDark ? "#020617" : "#cbd5e1"} />
                            <stop offset="50%" stopColor={isDark ? "#1e293b" : "#f1f5f9"} />
                            <stop offset="100%" stopColor={isDark ? "#020617" : "#cbd5e1"} />
                        </linearGradient>
                        <linearGradient id="cylinderDark" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={isDark ? "#020617" : "#94a3b8"} />
                            <stop offset="50%" stopColor={isDark ? "#1e293b" : "#cbd5e1"} />
                            <stop offset="100%" stopColor={isDark ? "#020617" : "#94a3b8"} />
                        </linearGradient>
                        <linearGradient id="collarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={isDark ? "#0c1117" : "#64748b"} />
                            <stop offset="50%" stopColor={isDark ? "#ffffff" : "#f8fafc"} />
                            <stop offset="100%" stopColor={isDark ? "#0c1117" : "#64748b"} />
                        </linearGradient>

                        {/* --- NEW INDUSTRIAL RED TREE GRADIENTS --- */}
                        <linearGradient id="treeRedCyl" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#520500" />
                            <stop offset="10%" stopColor="#8c0d02" />
                            <stop offset="25%" stopColor="#c71b0c" />
                            <stop offset="50%" stopColor="#ff4736" />
                            <stop offset="75%" stopColor="#c71b0c" />
                            <stop offset="90%" stopColor="#8c0d02" />
                            <stop offset="100%" stopColor="#520500" />
                        </linearGradient>
                        <linearGradient id="treeRedH" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#520500" />
                            <stop offset="10%" stopColor="#8c0d02" />
                            <stop offset="25%" stopColor="#c71b0c" />
                            <stop offset="50%" stopColor="#ff4736" />
                            <stop offset="75%" stopColor="#c71b0c" />
                            <stop offset="90%" stopColor="#8c0d02" />
                            <stop offset="100%" stopColor="#520500" />
                        </linearGradient>
                        <linearGradient id="treeWheelGrad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ff857a" />
                            <stop offset="100%" stopColor="#8c0d02" />
                        </linearGradient>

                        <radialGradient id="boltGrad" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="40%" stopColor="#94a3b8" />
                            <stop offset="100%" stopColor="#1e293b" />
                        </radialGradient>

                        <radialGradient id="gaugeGrad" cx="50%" cy="50%" r="50%">
                            <stop offset="60%" stopColor="#ffffff" />
                            <stop offset="100%" stopColor="#cbd5e1" />
                        </radialGradient>

                        <radialGradient id="blackHubGrad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#475569" />
                            <stop offset="100%" stopColor="#020617" />
                        </radialGradient>
                        <linearGradient id="casingWallGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgb(var(--color-canvas))" />
                            <stop offset="30%" stopColor="rgb(var(--color-surface))" />
                            <stop offset="55%" stopColor="rgb(var(--color-surface-light))" />
                            <stop offset="65%" stopColor="rgb(var(--color-text-muted) / 0.3)" />
                            <stop offset="100%" stopColor="rgb(var(--color-canvas))" />
                        </linearGradient>
                        <linearGradient id="casingWallGradR" x1="100%" y1="0%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="rgb(var(--color-canvas))" />
                            <stop offset="30%" stopColor="rgb(var(--color-surface))" />
                            <stop offset="55%" stopColor="rgb(var(--color-surface-light))" />
                            <stop offset="65%" stopColor="rgb(var(--color-text-muted) / 0.3)" />
                            <stop offset="100%" stopColor="rgb(var(--color-canvas))" />
                        </linearGradient>
                        <linearGradient id="cylinderGold" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#78350f" />
                            <stop offset="20%" stopColor="#b45309" />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="80%" stopColor="#b45309" />
                            <stop offset="100%" stopColor="#78350f" />
                        </linearGradient>
                        <linearGradient id="orangeTreeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#9a3412" />
                            <stop offset="50%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#9a3412" />
                        </linearGradient>
                        <linearGradient id="valveRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#b91c1c" />
                            <stop offset="100%" stopColor="#7f1d1d" />
                        </linearGradient>
                        <linearGradient id="redOrangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#991b1b" />
                            <stop offset="45%" stopColor="#dc2626" />
                            <stop offset="50%" stopColor="#f97316" />
                            <stop offset="55%" stopColor="#dc2626" />
                            <stop offset="100%" stopColor="#991b1b" />
                        </linearGradient>
                        <linearGradient id="orangeTreeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#9a3412" />
                            <stop offset="50%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#9a3412" />
                        </linearGradient>

                        {/*
                          ── FLUID GRADIENT ──
                          Azul-gris translúcido apagado — ni muy azul ni muy oscuro.
                        */}
                        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            {isDark ? (
                                <>
                                    <stop offset="0%" stopColor="#020617" />
                                    <stop offset="50%" stopColor="#0f172a" />
                                    <stop offset="100%" stopColor="#1e293b" />
                                </>
                            ) : (
                                <>
                                    <stop offset="0%" stopColor="#ffffff" />
                                    <stop offset="100%" stopColor="#f1f5f9" />
                                </>
                            )}
                        </linearGradient>
                        <linearGradient id="fluidGrad" x1="0" y1="0" x2="0" y2="1">
                            {isDark ? (
                                <>
                                    <stop offset="0%" stopColor="#020617" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#1e293b" stopOpacity="0.85" />
                                </>
                            ) : (
                                <>
                                    <stop offset="0%" stopColor="#64748b" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.3" />
                                </>
                            )}
                        </linearGradient>

                        {/* Shimmer horizontal en la superficie del fluido */}
                        <linearGradient id="fluidSurface" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0" />
                            <stop offset="28%" stopColor="rgb(var(--color-primary))" stopOpacity="0.2" />
                            <stop offset="72%" stopColor="rgb(var(--color-primary))" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0" />
                        </linearGradient>

                        <linearGradient id="cylinder3d" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
                            <stop offset="25%" stopColor="#fff" stopOpacity="0.3" />
                            <stop offset="50%" stopColor="#fff" stopOpacity="0" />
                            <stop offset="75%" stopColor="#000" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
                        </linearGradient>
                        <linearGradient id="perfInterior" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#000" />
                            <stop offset="100%" stopColor="rgb(var(--color-warning))" stopOpacity="0.3" />
                        </linearGradient>
                        <pattern id="screenPat" width="5" height="5" patternUnits="userSpaceOnUse">
                            <rect width="5" height="5" fill="rgb(var(--color-surface))" />
                            <rect width="3.5" height="3.5" fill="rgb(var(--color-text-muted) / 0.3)" />
                            <rect x="0.5" y="0.5" width="1" height="1" fill="rgb(var(--color-primary))" opacity="0.4" />
                        </pattern>
                        <pattern id="cementPat" width="12" height="12" patternUnits="userSpaceOnUse">
                            <rect width="12" height="12" fill="rgb(var(--color-surface-light))" />
                            <circle cx="3" cy="3" r="1.2" fill="rgb(var(--color-canvas))" opacity="0.3" />
                            <circle cx="9" cy="7" r="0.8" fill="rgb(var(--color-canvas))" opacity="0.2" />
                            <circle cx="5" cy="10" r="1" fill="rgb(var(--color-canvas))" opacity="0.25" />
                        </pattern>
                        <pattern id="meshPat" width="4" height="4" patternUnits="userSpaceOnUse">
                            <path d="M 4 0 L 0 0 0 4" fill="none" stroke="#222" strokeWidth="0.5" />
                            <path d="M 0 0 L 4 4" fill="none" stroke="#444" strokeWidth="0.2" />
                        </pattern>
                        <pattern id="sandstonePat" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="0.8" fill="#a16207" opacity="0.3" />
                            <circle cx="10" cy="5" r="0.6" fill="#a16207" opacity="0.2" />
                            <circle cx="15" cy="12" r="1" fill="#713f12" opacity="0.25" />
                            <circle cx="5" cy="18" r="0.7" fill="#713f12" opacity="0.2" />
                        </pattern>
                        <pattern id="shalePat" width="40" height="8" patternUnits="userSpaceOnUse">
                            <line x1="0" y1="2" x2="40" y2="2" stroke="#1e293b" strokeWidth="0.5" opacity="0.4" />
                            <line x1="0" y1="6" x2="20" y2="6" stroke="#0f172a" strokeWidth="0.8" opacity="0.3" />
                        </pattern>
                        <pattern id="rockPat" width="30" height="30" patternUnits="userSpaceOnUse">
                            <path d="M0 0 L15 5 L30 0 M15 5 L15 30" stroke="#334155" strokeWidth="0.5" opacity="0.2" fill="none" />
                            <path d="M0 15 L30 15" stroke="#334155" strokeWidth="0.4" opacity="0.15" fill="none" />
                        </pattern>
                        <pattern id="diamondPlate" width="20" height="20" patternUnits="userSpaceOnUse">
                            <rect width="20" height="20" fill="#334155" />
                            <path d="M5 5 L15 5 M5 15 L15 15 M10 10 L10 10" stroke="#ffffff20" strokeWidth="2" strokeLinecap="round" />
                        </pattern>

                        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <filter id="deepShadow" x="-50%" y="-10%" width="200%" height="120%">
                            <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000" floodOpacity="0.75" />
                        </filter>
                        <filter id="softGlow">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <filter id="fluidLineGlow" x="-10%" y="-200%" width="120%" height="500%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>

                        {/* ── TEXTURE FILTERS ── */}
                        <filter id="metalNoise">
                            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="5" stitchTiles="stitch" />
                            <feColorMatrix type="saturate" values="0" />
                            <feComponentTransfer>
                                <feFuncA type="linear" slope="0.25" />
                            </feComponentTransfer>
                            <feBlend in="SourceGraphic" mode="multiply" />
                        </filter>
                        <filter id="brushedEffect">
                            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.5" numOctaves="3" result="noise" />
                            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
                            <feBlend in="SourceGraphic" mode="multiply" opacity="0.3" />
                        </filter>
                        <filter id="perfGlow">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <filter id="tagShadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.8" />
                        </filter>

                        <style>{`
                            @keyframes rise {
                                0%   { transform: translateY(0); opacity: 0; }
                                20%  { opacity: 0.45; }
                                100% { transform: translateY(-${Math.max(0, perfsVisualY - fluidY)}px); opacity: 0; }
                            }
                            .oil-bubble { animation: rise linear infinite; }
                            .cable-flow { 
                                stroke-dasharray: 8 16; 
                                stroke-dashoffset: 100; 
                                animation: flow 3s linear infinite; 
                            }
                            @keyframes flow { to { stroke-dashoffset: 0; } }
                            .component-hover:hover { filter: brightness(1.15); cursor: pointer; }
                            @keyframes fluidPulse {
                                0%, 100% { opacity: 0.9; }
                                50%       { opacity: 1; }
                            }
                            .fluid-layer { animation: fluidPulse 6s ease-in-out infinite; }
                            @keyframes flowIn {
                                0% { stroke-dashoffset: 100; opacity: 0; }
                                50% { opacity: 0.8; }
                                100% { stroke-dashoffset: 0; opacity: 0; }
                            }
                            .flow-line { stroke-dasharray: 20, 80; animation: flowIn 3s infinite linear; }
                        `}</style>
                    </defs>

                    {/* ── GEOLOGY STRATA: Dynamic Sketch ── */}
                    {/* Layer 1: Upper Sands */}
                    <rect x="0" y={surfY} width={width} height={400} fill={isDark ? "#1e293b" : "#f8fafc"} />
                    <rect x="0" y={surfY} width={width} height={400} fill="url(#sandstonePat)" opacity={isDark ? 0.6 : 0.2} />

                    {/* Layer 2: Intermediate Shales */}
                    <rect x="0" y={surfY + 400} width={width} height={500} fill={isDark ? "#0f172a" : "#f1f5f9"} />
                    <rect x="0" y={surfY + 400} width={width} height={500} fill="url(#shalePat)" opacity={isDark ? 0.5 : 0.15} />

                    {/* Layer 3: Deep Rocks / Pay Zone */}
                    <rect x="0" y={surfY + 900} width={width} height={casingBottomY - surfY} fill={isDark ? "#020617" : "#e2e8f0"} />
                    <rect x="0" y={surfY + 900} width={width} height={casingBottomY - surfY} fill="url(#rockPat)" opacity={isDark ? 0.6 : 0.2} />

                    {/* Global Grain/Detail */}
                    <rect x="0" y={surfY} width={width} height={casingBottomY - surfY + 200} fill="url(#geologyTexture)" />

                    {/* ── ATMOSPHERE: Industrial Night Sky ── */}
                    <rect x="0" y="0" width={width} height={surfY} fill="url(#skyGrad)" />
                    {/* Subtle aesthetic stars */}
                    {[100, 250, 450, 600, 800, 1000].map(sx => (
                        <circle key={sx} cx={sx} cy={Math.random() * 100} r="1" fill="#fff" opacity="0.3" />
                    ))}
                    <linearGradient id="vignetteSide" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
                        <stop offset="25%" stopColor="#000" stopOpacity="0" />
                        <stop offset="75%" stopColor="#000" stopOpacity="0" />
                        <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
                    </linearGradient>
                    <rect x="0" y={surfY} width={width} height={casingBottomY - surfY + 200} fill="url(#vignetteSide)" pointerEvents="none" />

                    {/* ── CEMENT SHEATH ── */}
                    <rect x={center - casingW / 2 - 18} y={surfY} width={casingW + 36} height={casingBottomY - surfY} fill="url(#cementPat)" stroke="rgb(var(--color-text-muted) / 0.6)" strokeWidth="1.2" />

                    {/* ── CASING WALLS ── */}
                    <rect x={center - casingW / 2 - 12} y={surfY} width={12} height={casingBottomY - surfY} fill="url(#casingWallGrad)" stroke="rgb(var(--color-text-muted) / 0.8)" strokeWidth="0.8" />
                    <rect x={center + casingW / 2} y={surfY} width={12} height={casingBottomY - surfY} fill="url(#casingWallGradR)" stroke="rgb(var(--color-text-muted) / 0.8)" strokeWidth="0.8" />
                    {/* Wellbore interior - Un poco más de cuerpo para resaltar el equipo */}
                    <rect x={center - casingW / 2} y={surfY} width={casingW} height={casingBottomY - surfY} fill="rgb(var(--color-surface) / 0.15)" />
                    <rect x={center - casingW / 2} y={surfY} width={8} height={casingBottomY - surfY} fill="rgb(var(--color-text-muted) / 0.2)" opacity="0.8" />
                    <rect x={center + casingW / 2 - 8} y={surfY} width={8} height={casingBottomY - surfY} fill="rgb(var(--color-text-muted) / 0.2)" opacity="0.8" />

                    {/* Casing coupling collars */}
                    {[100, 220, 340, 460, 580].map(offset => {
                        const cy = surfY + offset;
                        if (cy > casingBottomY - 20) return null;
                        return (
                            <g key={offset}>
                                <rect x={center - casingW / 2 - 16} y={cy} width={16} height={8} fill="url(#collarGrad)" stroke="rgb(var(--color-canvas))" strokeWidth="0.5" />
                                <rect x={center - casingW / 2 - 4} y={cy} width={tubingW + 8} height={2} fill="rgb(var(--color-text-main))" opacity="0.1" />
                                <rect x={center + casingW / 2} y={cy} width={16} height={8} fill="url(#collarGrad)" stroke="rgb(var(--color-canvas))" strokeWidth="0.5" />
                            </g>
                        );
                    })}

                    {/* Well shoe */}
                    <path d={`M${center - casingW / 2 - 12} ${casingBottomY} L${center} ${casingBottomY + 28} L${center + casingW / 2 + 12} ${casingBottomY} Z`} fill="url(#cylinderDark)" stroke="rgb(var(--color-canvas))" strokeWidth="1" />
                    <path d={`M${center - casingW / 2 - 8}  ${casingBottomY} L${center} ${casingBottomY + 18} L${center + casingW / 2 + 8}  ${casingBottomY} Z`} fill="rgb(var(--color-canvas) / 0.4)" />

                    {/* ── FLUID LEVEL ── Gris-azul translúcido, apagado */}
                    <rect
                        x={center - casingW / 2 + 1}
                        y={fluidY}
                        width={casingW - 2}
                        height={casingBottomY - fluidY}
                        fill="url(#fluidGrad)"
                        className="fluid-layer"
                    />
                    {/* Línea de nivel dinámico — tono del tema */}
                    <line
                        x1={center - casingW / 2} y1={fluidY}
                        x2={center + casingW / 2} y2={fluidY}
                        stroke="rgb(var(--color-primary))" strokeWidth="1.8"
                        filter="url(#fluidLineGlow)"
                    />
                    {/* Shimmer horizontal en la superficie */}
                    <rect
                        x={center - casingW / 2 + 1} y={fluidY}
                        width={casingW - 2} height={4}
                        fill="url(#fluidSurface)"
                        opacity="0.3"
                    />

                    {/* Bubbles - More and more visible */}
                    {bubbles.map(b => (
                        <circle key={b.id}
                            cx={b.side === 'left' ? center - b.offset : center + b.offset}
                            cy={perfsVisualY + 30} r={b.size}
                            fill="rgb(var(--color-text-main))" className="oil-bubble"
                            style={{ animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }}
                            opacity="0.8"
                        />
                    ))}

                    {/* ── VSD INDUSTRIAL CASETA (SHED ENCLOSURE) ── */}
                    {selectedVSD && (() => {
                        const vsdX = center + (casingW / 4) + (isReport ? 45 : 35);
                        const houseW = vsdBoxW + (isReport ? 30 : 15);
                        const houseH = vsdBoxH + (isReport ? 20 : 10);
                        const vsdY = surfY - houseH;

                        const mfgColor = (() => {
                            const m = selectedVSD.manufacturer.toLowerCase();
                            if (m === 'triol') return 'rgb(var(--color-secondary))';
                            if (m === 'clesus') return '#000000ff';
                            if (m === 'abb') return '#000000ff';
                            if (m === 'slb') return 'rgb(var(--color-primary))';
                            if (m === 'siemens') return '#000000ff';
                            if (m === 'baker hughes') return '#000000ff';
                            return 'rgb(var(--color-primary))';
                        })();

                        const cabW = houseW * 0.6;
                        const trafW = houseW * 0.35;
                        const cabX = vsdX;
                        const trafX = vsdX + houseW - trafW;
                        const cabH = houseH;
                        const trafH = houseH * 0.82;
                        const cabY = surfY - cabH - 5;
                        const trafY = surfY - trafH - 5;

                        return (
                            <g key="vsd-industrial-caseta" className="component-hover">
                                {/* ── ELECTRICAL EFFECTS (Lightning & Sparks - Theme Aware) ── */}
                                <g>
                                    <defs>
                                        <filter id="elec-glow-strong">
                                            <feGaussianBlur stdDeviation={isDark ? "4" : "2"} result="blur" />
                                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                        </filter>
                                    </defs>

                                    {(() => {
                                        const coreColor = isDark ? "#ffffff" : "#1d4ed8"; // Blanco en Dark, Azul Intenso en Light
                                        const glowColor = isDark ? "#60a5fa" : "#3b82f6";
                                        const sparkColor = isDark ? "#facc15" : "#ea580c"; // Amarillo en Dark, Naranja en Light

                                        return (
                                            <>
                                                {/* helper bolts around Transformer Bushings (Theme Aware) */}
                                                {[-trafW * 0.3, 0, trafW * 0.3].map((bOff, bi) => (
                                                    <g key={bi} transform={`translate(${trafX + trafW / 2 + bOff}, ${trafY - (isReport ? 30 : 25)})`}>
                                                        {/* Core Bolt */}
                                                        <path d="M -8 0 L 0 -20 L 8 -10 L 15 -30" fill="none" stroke={coreColor} strokeWidth="2.5" filter="url(#elec-glow-strong)">
                                                            <animate attributeName="opacity" values="0;1;0.2;1;0" dur="0.8s" repeatCount="indefinite" begin={`${bi * 0.2}s`} />
                                                            <animate attributeName="d" values="M -8 0 L 0 -20 L 8 -10 L 15 -30; M -4 -4 L 8 -15 L 0 -25 L 12 -40; M -8 0 L 0 -20 L 8 -10 L 15 -30" dur="0.15s" repeatCount="indefinite" />
                                                        </path>
                                                        {/* Outer Glow Path */}
                                                        <path d="M -8 0 L 0 -20 L 8 -10 L 15 -30" fill="none" stroke={glowColor} strokeWidth="5" opacity={isDark ? 0.3 : 0.5} filter="url(#elec-glow-strong)">
                                                            <animate attributeName="opacity" values="0;0.3;0" dur="0.8s" repeatCount="indefinite" begin={`${bi * 0.2}s`} />
                                                        </path>
                                                    </g>
                                                ))}

                                                {/* Sparks around the VSD Vents (Theme Aware) */}
                                                {Array.from({ length: 8 }).map((_, i) => (
                                                    <circle key={i} r="2.5" fill={sparkColor}>
                                                        <animateMotion
                                                            path={`M ${cabX + cabW * 0.6} ${cabY + 40} q 30 -40 60 0 t 60 0`}
                                                            dur={`${1.5 + i * 0.5}s`}
                                                            repeatCount="indefinite"
                                                        />
                                                        <animate attributeName="opacity" values="0;1;0" dur="0.4s" repeatCount="indefinite" />
                                                    </circle>
                                                ))}

                                                {/* High Voltage Arc (Transformer to VSD - Theme Aware) */}
                                                <path d={`M${trafX} ${trafY + 15} Q ${trafX - 30} ${trafY - 20}, ${cabX + cabW} ${cabY + 20}`} fill="none" stroke={glowColor} strokeWidth="3" strokeDasharray="8 4" filter="url(#elec-glow-strong)">
                                                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite" />
                                                </path>
                                            </>
                                        );
                                    })()}
                                </g>

                                {/* ── TRANSFORMER (right unit) ── */}
                                <rect x={trafX - 4} y={surfY - 5} width={trafW + 8} height={7} fill="#4b5563" stroke="#1e293b" strokeWidth="1" rx="1" />
                                <rect x={trafX - 4} y={surfY - 5} width={trafW + 8} height={2} fill="#9ca3af" opacity="0.4" />
                                {/* Transformer tank */}
                                <rect x={trafX} y={trafY} width={trafW} height={trafH} rx="3" fill="#374151" stroke="#1e293b" strokeWidth="1.5" />
                                <rect x={trafX + 2} y={trafY + 2} width={5} height={trafH - 4} rx="2" fill="#4b5563" opacity="0.5" />
                                <rect x={trafX + trafW - 7} y={trafY + 2} width={5} height={trafH - 4} rx="2" fill="#111827" opacity="0.5" />
                                {/* Cooling fins */}
                                {Array.from({ length: isReport ? 8 : 5 }).map((_, fi) => {
                                    const finY = trafY + trafH * 0.12 + fi * (trafH * 0.72 / (isReport ? 8 : 5));
                                    return (<g key={fi}>
                                        <rect x={trafX - 6} y={finY} width={6} height={isReport ? 7 : 5} rx="1" fill="#4b5563" stroke="#1e293b" strokeWidth="0.5" />
                                        <rect x={trafX + trafW} y={finY} width={6} height={isReport ? 7 : 5} rx="1" fill="#4b5563" stroke="#1e293b" strokeWidth="0.5" />
                                    </g>);
                                })}
                                {/* Top HV bushings (3) */}
                                {[-trafW * 0.3, 0, trafW * 0.3].map((bOff, bi) => (
                                    <g key={bi} transform={`translate(${trafX + trafW / 2 + bOff}, ${trafY})`}>
                                        <rect x={-3.5} y={-(isReport ? 22 : 16)} width={7} height={isReport ? 22 : 16} rx="2" fill="#d1d5db" stroke="#6b7280" strokeWidth="0.8" />
                                        {[0, 1, 2].map(sk => (
                                            <ellipse key={sk} cx={0} cy={-(isReport ? 7 : 5) * sk - (isReport ? 3 : 2)} rx={isReport ? 5.5 : 4} ry={isReport ? 1.8 : 1.3} fill="none" stroke="#9ca3af" strokeWidth="0.8" />
                                        ))}
                                        <circle cx={0} cy={-(isReport ? 22 : 16)} r={isReport ? 3 : 2} fill="#f59e0b" stroke="#92400e" strokeWidth="0.8" />
                                    </g>
                                ))}
                                {/* Nameplate */}
                                <rect x={trafX + trafW * 0.1} y={trafY + trafH * 0.38} width={trafW * 0.8} height={trafH * 0.28} rx="2" fill="#1f2937" stroke="#374151" strokeWidth="0.8" />
                                <text x={trafX + trafW / 2} y={trafY + trafH * 0.49} textAnchor="middle" fontSize={isReport ? 10 : 7} fill="#9ca3af" fontWeight="700" fontFamily="'Courier New', monospace">XFMR</text>
                                <text x={trafX + trafW / 2} y={trafY + trafH * 0.59} textAnchor="middle" fontSize={isReport ? 9 : 6.5} fill="#6b7280" fontWeight="600" fontFamily="'Courier New', monospace">{selectedVSD.kvaRating}kVA</text>
                                {/* Transformer-to-cabinet cable */}
                                <path d={`M${trafX} ${trafY + trafH * 0.35} L${cabX + cabW} ${trafY + trafH * 0.35}`} fill="none" stroke="#111827" strokeWidth={isReport ? 6 : 4} strokeLinecap="round" />
                                <path d={`M${trafX} ${trafY + trafH * 0.35} L${cabX + cabW} ${trafY + trafH * 0.35}`} fill="none" stroke="#374151" strokeWidth={isReport ? 3 : 2} strokeLinecap="round" />

                                {/* ── VSD CABINET (main left unit) ── */}
                                <rect x={cabX - 4} y={surfY - 5} width={cabW + 8} height={7} fill="#4b5563" stroke="#1e293b" strokeWidth="1" rx="1" />
                                <rect x={cabX - 4} y={surfY - 5} width={cabW + 8} height={2} fill="#9ca3af" opacity="0.4" />
                                {/* Cabinet body */}
                                <rect x={cabX} y={cabY} width={cabW} height={cabH} rx="2" fill="url(#vsdMainGrad)" stroke="#1e293b" strokeWidth="1.8" />
                                {/* Top cap/overhang */}
                                <rect x={cabX - 5} y={cabY - (isReport ? 6 : 4)} width={cabW + 10} height={isReport ? 8 : 6} rx="1" fill="#4b5563" stroke="#1e293b" strokeWidth="1" />
                                <rect x={cabX - 5} y={cabY - (isReport ? 6 : 4)} width={cabW + 10} height={isReport ? 2 : 1.5} fill="#9ca3af" opacity="0.5" />
                                {/* Brushed steel highlight */}
                                {Array.from({ length: isReport ? 18 : 12 }).map((_, si) => (
                                    <line key={si} x1={cabX + 1} y1={cabY + si * (cabH / (isReport ? 18 : 12))} x2={cabX + cabW - 1} y2={cabY + si * (cabH / (isReport ? 18 : 12))} stroke="#fff" strokeWidth="0.3" opacity="0.06" />
                                ))}
                                {/* Door seam center */}
                                <line x1={cabX + cabW * 0.5} y1={cabY + 4} x2={cabX + cabW * 0.5} y2={surfY - 7} stroke="#1e293b" strokeWidth={isReport ? 1.5 : 1} opacity="0.6" />
                                {/* Hinges */}
                                {[0.22, 0.62].map((hy, hi) => (
                                    <rect key={hi} x={cabX + cabW * 0.475} y={cabY + cabH * hy} width={isReport ? 9 : 6} height={isReport ? 18 : 12} rx="1" fill="#1f2937" stroke="#374151" strokeWidth="0.5" />
                                ))}
                                {/* Display panel */}
                                <rect x={cabX + cabW * 0.05} y={cabY + (isReport ? 12 : 9)} width={cabW * 0.44} height={isReport ? 115 : 82} rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                                <rect x={cabX + cabW * 0.06} y={cabY + (isReport ? 14 : 10)} width={cabW * 0.42} height={isReport ? 111 : 78} rx="2" fill="#0c1a2e" />
                                {/* Display readouts */}
                                <text x={cabX + cabW * 0.07 + (isReport ? 6 : 4)} y={cabY + (isReport ? 34 : 24)} fontSize={isReport ? 14 : 10} fill="#fff" fontWeight="800" fontFamily="'JetBrains Mono', monospace" opacity="0.9">{selectedVSD.model}</text>
                                <line x1={cabX + cabW * 0.07} y1={cabY + (isReport ? 42 : 30)} x2={cabX + cabW * 0.47} y2={cabY + (isReport ? 42 : 30)} stroke="#475569" strokeWidth="0.8" opacity="0.35" />
                                <text x={cabX + cabW * 0.07 + (isReport ? 6 : 4)} y={cabY + (isReport ? 58 : 40)} fontSize={isReport ? 10 : 8} fill="#94a3b8" fontWeight="600" fontFamily="'Inter', sans-serif">OUT FREQ</text>
                                <text x={cabX + cabW * 0.07 + (isReport ? 6 : 4)} y={cabY + (isReport ? 78 : 55)} fontSize={isReport ? 20 : 14} fill="#f8fafc" fontWeight="900" fontFamily="'JetBrains Mono', monospace">{frequency} Hz</text>
                                <text x={cabX + cabW * 0.07 + (isReport ? 6 : 4)} y={cabY + (isReport ? 98 : 70)} fontSize={isReport ? 10 : 8} fill="#94a3b8" fontWeight="600" fontFamily="'Inter', sans-serif">OUTPUT V</text>
                                <text x={cabX + cabW * 0.07 + (isReport ? 6 : 4)} y={cabY + (isReport ? 118 : 84)} fontSize={isReport ? 20 : 14} fill="#f8fafc" fontWeight="900" fontFamily="'JetBrains Mono', monospace">{selectedVSD.outputVoltage}</text>
                                {/* Right panel - louvers */}
                                <rect x={cabX + cabW * 0.53} y={cabY + (isReport ? 12 : 9)} width={cabW * 0.43} height={isReport ? 52 : 38} rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                                {Array.from({ length: isReport ? 8 : 6 }).map((_, li) => (
                                    <g key={li}>
                                        <rect x={cabX + cabW * 0.55} y={cabY + (isReport ? 16 : 12) + li * (isReport ? 6 : 5)} width={cabW * 0.37} height={isReport ? 3 : 2} rx="0.5" fill="#1e293b" />
                                        <rect x={cabX + cabW * 0.55} y={cabY + (isReport ? 15 : 11) + li * (isReport ? 6 : 5)} width={cabW * 0.37} height={1} fill="#334155" opacity="0.4" />
                                    </g>
                                ))}
                                {/* LED status row */}
                                {['#22c55e', '#22c55e', '#64748b'].map((col, li) => (
                                    <g key={li}>
                                        <circle cx={cabX + cabW * 0.56 + li * (isReport ? 20 : 14)} cy={cabY + (isReport ? 78 : 56)} r={isReport ? 4 : 3} fill={col} opacity={col === '#64748b' ? 0.4 : 0.8} />
                                    </g>
                                ))}
                                {/* Danger sign */}
                                <g transform={`translate(${cabX + cabW * 0.55}, ${cabY + (isReport ? 98 : 70)}) scale(${isReport ? 1.05 : 0.72})`}>
                                    <path d="M16 0 L32 28 L0 28 Z" fill="#facc15" stroke="#000" strokeWidth="1.5" />
                                    <text x="16" y="22" fontSize="14" fontWeight="950" textAnchor="middle" fill="#000">!</text>
                                </g>
                                {/* Brand bottom strip */}
                                <rect x={cabX} y={cabY + cabH - (isReport ? 26 : 18)} width={cabW} height={isReport ? 26 : 18} fill={mfgColor} opacity="0.88" />
                                <text x={cabX + cabW / 2} y={cabY + cabH - (isReport ? 9 : 6)} fontSize={isReport ? 10 : 7} fill="#fff" fontWeight="950"
                                    textAnchor="middle" fontFamily="system-ui" letterSpacing="0.12em" style={{ textTransform: 'uppercase' }}>
                                    {selectedVSD.manufacturer} · VFD
                                </text>
                                {/* Door handle */}
                                <rect x={cabX + cabW * 0.475} y={cabY + cabH * 0.44} width={isReport ? 5 : 3.5} height={isReport ? 22 : 16} rx="2" fill="#0f172a" stroke="#374151" strokeWidth="0.5" />

                                {/* ── Cable from cabinet to wellhead ── */}
                                <path d={`M${cabX + 10} ${surfY - 4} L${cabX - (isReport ? 40 : 25)} ${surfY - 4} L${center + tubingW / 2 + 4} ${surfY - 2} L${center + tubingW / 2 + 3} ${surfY}`}
                                    fill="none" stroke="#000" strokeWidth={isReport ? 10 : 7} strokeLinecap="round" opacity="0.4" />
                                <path d={`M${cabX + 10} ${surfY - 4} L${cabX - (isReport ? 40 : 25)} ${surfY - 4} L${center + tubingW / 2 + 4} ${surfY - 2} L${center + tubingW / 2 + 3} ${surfY}`}
                                    fill="none" stroke="rgb(var(--color-warning))" strokeWidth={isReport ? 5 : 3} strokeLinecap="round" />
                                <path d={`M${cabX + 10} ${surfY - 4} L${cabX - (isReport ? 40 : 25)} ${surfY - 4} L${center + tubingW / 2 + 4} ${surfY - 2} L${center + tubingW / 2 + 3} ${surfY}`}
                                    fill="none" stroke={mfgColor} strokeWidth={isReport ? 5 : 3} strokeLinecap="round" className="cable-flow" />
                            </g>
                        );
                    })()}

                    {/* ── GROUND / SURFACE LINE ── */}
                    <line x1={0} y1={surfY} x2={width} y2={surfY}
                        stroke="rgb(var(--color-text-muted))" strokeWidth="2" opacity="0.4" />
                    <rect x={0} y={surfY} width={width} height={50} fill="url(#cementPat)" opacity="0.2" />

                    {/* ── WELLHEAD (CABEZAL) ── */}
                    <DetailedWellhead y={surfY} />

                    {/* ── SURFACE FLOW LINE (Production Pipe) ── */}
                    <g>
                        {(() => {
                            const sc = isReport ? 0.55 : 0.3;
                            const targetX = center - 233 * sc;
                            const targetY = surfY - 317 * sc;
                            const groundY = surfY - 10;
                            const bendX = center - 350 * sc;

                            return (
                                <g>
                                    {/* Main Production Flow Line (Wider & Solid Metallic) */}
                                    <path d={`
                                        M 0 ${groundY}
                                        L ${bendX} ${groundY}
                                        Q ${bendX + 30 * sc} ${groundY}, ${bendX + 30 * sc} ${groundY - 30 * sc}
                                        L ${bendX + 30 * sc} ${targetY + 30 * sc}
                                        Q ${bendX + 30 * sc} ${targetY}, ${bendX + 60 * sc} ${targetY}
                                        L ${targetX} ${targetY}
                                    `} fill="none" stroke="url(#cylinderMetal)" strokeWidth={65 * sc} strokeLinecap="round" />

                                    {/* Flange at connect point (Matching Tubing Silver) */}
                                    <rect x={targetX - 8 * sc} y={targetY - 55 * sc} width={16 * sc} height={110 * sc} fill="url(#cylinderMetal)" rx="2" stroke="#475569" strokeWidth="1" />
                                </g>
                            );
                        })()}
                    </g>

                    <text x={isReport ? 16 : 14} y={surfY + (isReport ? 35 : 25)}
                        fontSize={isReport ? 11 : 7.5} fill="rgb(var(--color-text-muted))" fontWeight="700"
                        fontFamily="system-ui" letterSpacing="0.12em" style={{ textTransform: 'uppercase' }}>
                        SUPERFICIE / SURFACE
                    </text>

                    {/* ── TUBING STRING (Clean & Longer) ── */}
                    <rect x={center - tubingW / 2} y={surfY} width={tubingW} height={startY - surfY + 10} fill="url(#cylinderMetal)" stroke="rgb(var(--color-canvas))" strokeWidth="0.5" />
                    <rect x={center - tubingW / 2} y={surfY} width={2} height={startY - surfY + 10} fill="rgb(var(--color-text-main))" opacity="0.2" />
                    <rect x={center + tubingW / 2 - 2} y={surfY} width={2} height={startY - surfY + 10} fill="rgb(var(--color-text-main))" opacity="0.1" />

                    {/* ── POWER CABLE ── */}
                    <g>
                        <path d={`
                            M${center + tubingW / 2 + 3} ${surfY} 
                            L${center + tubingW / 2 + 3} ${startY - 10} 
                            C${center + pumpW / 2 + 20} ${startY}, ${center + pumpW / 2 + 20} ${pumpTopY}, ${center + pumpW / 2 + 10} ${pumpTopY + 20}
                            L${center + pumpW / 2 + 10} ${pumpBottomY}
                            L${center + intakeW / 2 + 15} ${intakeRealTop}
                            L${center + motorW / 2 + 8} ${motorRealTop + 30}
                        `} fill="none" stroke="rgb(var(--color-canvas))" strokeWidth="7" strokeLinecap="round" />
                        <path d={`
                            M${center + tubingW / 2 + 3} ${surfY} 
                            L${center + tubingW / 2 + 3} ${startY - 10} 
                            C${center + pumpW / 2 + 20} ${startY}, ${center + pumpW / 2 + 20} ${pumpTopY}, ${center + pumpW / 2 + 10} ${pumpTopY + 20}
                            L${center + pumpW / 2 + 10} ${pumpBottomY}
                            L${center + intakeW / 2 + 15} ${intakeRealTop}
                            L${center + motorW / 2 + 8} ${motorRealTop + 30}
                        `} fill="none" stroke="rgb(var(--color-warning))" strokeWidth="4.5" strokeLinecap="round" />
                        <path d={`
                            M${center + tubingW / 2 + 2} ${surfY} 
                            L${center + tubingW / 2 + 2} ${startY - 10}
                        `} fill="none" stroke="rgb(var(--color-warning) / 0.4)" strokeWidth="1.5" strokeLinecap="round" />
                        <path d={`
                            M${center + tubingW / 2 + 3} ${surfY} 
                            L${center + tubingW / 2 + 3} ${startY - 10} 
                            C${center + pumpW / 2 + 20} ${startY}, ${center + pumpW / 2 + 20} ${pumpTopY}, ${center + pumpW / 2 + 10} ${pumpTopY + 20}
                            L${center + pumpW / 2 + 10} ${pumpBottomY}
                            L${center + intakeW / 2 + 15} ${intakeRealTop}
                            L${center + motorW / 2 + 8} ${motorRealTop + 30}
                        `} fill="none" stroke="rgb(var(--color-primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" className="cable-flow" />
                        {[100, 220, 340].map(off => (
                            <g key={off}>
                                <rect x={center + tubingW / 2} y={surfY + off - 4} width={8} height={8} rx="1.5" fill="rgb(var(--color-surface))" stroke="rgb(var(--color-text-muted) / 0.4)" />
                            </g>
                        ))}
                    </g>

                    {/* ══════════════════════════════════════════════════════
                        ── TRANSITION CONNECTORS & CENTRAL PIPE ──
                        Forman juntas que unen los componentes.
                        ══════════════════════════════════════════════════════ */}

                    {/* ── MAIN TUBING STRING (Clean Profile) ── */}
                    <rect x={center - tubingW / 2} y={surfY} width={tubingW} height={pumpTopY - surfY}
                        fill="url(#cylinderMetal)" stroke="#000" strokeWidth="1.5" />
                    <rect x={center - tubingW / 2} y={surfY} width={tubingW} height={pumpTopY - surfY}
                        fill="url(#cylinder3d)" opacity="0.5" />

                    {/* tubing → discharge head (already naturally connected) */}

                    {/* pump flange bottom → intake cap top */}
                    <TransitionJoint
                        yTop={pumpBottomY}
                        yBottom={intakeRealTop}
                        topW={flangeW}
                        bottomW={intakeW + 10}
                    />

                    {/* intake cap bottom → seal top */}
                    <TransitionJoint
                        yTop={intakeRealBottom}
                        yBottom={sealRealTop}
                        topW={intakeW + 10}
                        bottomW={sealW}
                    />

                    {/* seal bottom → motor collar top */}
                    <TransitionJoint
                        yTop={sealRealBottom}
                        yBottom={motorRealTop}
                        topW={sealW}
                        bottomW={motorW + 6}
                    />

                    {/* motor collar bottom → sensor top */}
                    <TransitionJoint
                        yTop={motorRealBottom}
                        yBottom={sensorRealTop}
                        topW={motorW + 6}
                        bottomW={sensorW}
                    />

                    {/* ── ESP ASSEMBLY (componentes sobre los conectores) ── */}
                    <g filter="url(#deepShadow)">

                        {/* 1. DISCHARGE HEAD — Cylindrical body with expanding funnel */}
                        <g className="component-hover">
                            {/* Main cylinder body */}
                            <rect x={center - pumpW / 2} y={startY} width={pumpW} height={dischargeH - 14}
                                fill="url(#cylinderDark)" stroke="#000" strokeWidth="1.5" filter="url(#metalNoise)" />
                            <rect x={center - pumpW / 2} y={startY} width={pumpW} height={dischargeH - 14}
                                fill="url(#cylinder3d)" opacity="0.6" />
                            {/* Ribbed bands */}
                            {[8, 20, 32].map(ry => (
                                <rect key={ry} x={center - pumpW / 2} y={startY + ry} width={pumpW} height="3"
                                    fill="#000" opacity="0.35" />
                            ))}
                            {/* Expanding flange at bottom connecting to pump */}
                            <path d={`M${center - pumpW / 2} ${startY + dischargeH - 14}
                                      L${center + pumpW / 2} ${startY + dischargeH - 14}
                                      L${center + pumpW / 2 + 4} ${startY + dischargeH}
                                      L${center - pumpW / 2 - 4} ${startY + dischargeH} Z`}
                                fill="url(#collarGrad)" stroke="#000" strokeWidth="1.2" filter="url(#metalNoise)" />
                            {/* Top cap */}
                            <rect x={center - pumpW / 2 - 2} y={startY - 4} width={pumpW + 4} height={8}
                                fill="url(#collarGrad)" stroke="#000" strokeWidth="1" rx="2" />
                            {/* Label */}
                            <DigitalTwinTag y={startY + dischargeH / 2} label="Discharge Head" side="left" color="slate" />
                        </g>

                        {/* 2. PUMP SECTIONS */}
                        {Array.from({ length: housingCount }).map((_, i) => {
                            const y = pumpTopY + i * (bodyH + gapH);

                            // Lógica: cada cuerpo toma el maxStages, el último el resto
                            const totalStages = pump?.stages || 0;
                            const maxStagesPerBody = pump?.maxStages || 400; // Por defecto si no hay dato

                            let stagesThisBody = 0;
                            if (housingCount === 1) {
                                stagesThisBody = totalStages;
                            } else {
                                const assignedBefore = i * maxStagesPerBody;
                                stagesThisBody = Math.max(0, Math.min(maxStagesPerBody, totalStages - assignedBefore));
                            }

                            if (stagesThisBody <= 0 && i > 0) return null;

                            return (
                                <g key={i} className="component-hover">
                                    <rect x={center - pumpW / 2} y={y} width={pumpW} height={bodyH} fill="url(#cylinderPump)" stroke="#000" strokeWidth="0.8" filter="url(#metalNoise)" />
                                    <rect x={center - pumpW / 2} y={y} width={pumpW} height={bodyH} fill="url(#cylinder3d)" />
                                    <rect x={center - pumpW / 2} y={y} width={2} height={bodyH} fill="#000" opacity="0.2" />
                                    <rect x={center + pumpW / 2 - 2} y={y} width={2} height={bodyH} fill="#000" opacity="0.2" />
                                    {Array.from({ length: Math.min(14, Math.ceil(bodyH / 14)) }, (_, s) => (
                                        <line key={s}
                                            x1={center - pumpW / 2} y1={y + (s + 1) * (bodyH / (Math.min(14, Math.ceil(bodyH / 14)) + 1))}
                                            x2={center + pumpW / 2} y2={y + (s + 1) * (bodyH / (Math.min(14, Math.ceil(bodyH / 14)) + 1))}
                                            stroke="#000" strokeWidth="1.2" opacity="0.3" />
                                    ))}
                                    {[-pumpW / 2, pumpW / 2 - 3].map((nx, ni) => [10, 25, 40, 55, 70].map((off, oi) => {
                                        if (y + off + 4 > y + bodyH - 8) return null;
                                        return <rect key={`${ni}-${oi}`} x={center + nx} y={y + off} width={3} height={4} fill="#000" opacity="0.5" />;
                                    }))}
                                    <rect x={center - flangeW / 2} y={y} width={flangeW} height={8} fill="url(#collarGrad)" stroke="#000" strokeWidth="0.5" />
                                    <rect x={center - flangeW / 2} y={y} width={flangeW} height={2} fill="rgb(var(--color-text-main))" opacity="0.1" />
                                    <rect x={center - flangeW / 2} y={y + bodyH - 8} width={flangeW} height={8} fill="url(#collarGrad)" stroke="#000" strokeWidth="0.5" />
                                    {[1.5, 3, 4.5, 6, 7.5].map(b => (
                                        <g key={b}>
                                            <circle cx={center - flangeW / 2 + b * 10} cy={y + 4} r="1.8" fill="rgb(var(--color-surface))" stroke="rgb(var(--color-text-muted))" strokeWidth="0.5" />
                                            <circle cx={center - flangeW / 2 + b * 10} cy={y + bodyH - 4} r="1.8" fill="rgb(var(--color-surface))" stroke="rgb(var(--color-text-muted))" strokeWidth="0.5" />
                                        </g>
                                    ))}
                                    {i === 0 && (
                                        <DigitalTwinTag
                                            y={pumpTopY + (bodyH * housingCount) / 2}
                                            label={housingCount > 1 ? `Pump (${housingCount})` : "Pump Model"}
                                            value={pump?.model || "P-Series"}
                                            side="left"
                                            color="slate"
                                        />
                                    )}
                                    {i < housingCount - 1 && <Coupling y={y + bodyH + gapH / 2} />}
                                </g>
                            );
                        })}

                        <g transform={`translate(0, ${connH})`} className="component-hover">
                            <rect x={center - intakeW / 2 - 5} y={pumpBottomY} width={intakeW + 10} height={14} fill="url(#collarGrad)" stroke="#000" strokeWidth="1.2" filter="url(#metalNoise)" />
                            <rect x={center - intakeW / 2 - 5} y={pumpBottomY} width={intakeW + 10} height={14} fill="url(#cylinder3d)" opacity="0.6" />
                            {/* Bolts on top flange */}
                            {[0, 1, 2, 3, 4].map(b => (
                                <circle key={b} cx={center - intakeW / 2 + b * 11} cy={pumpBottomY + 7} r="2" fill="#111" opacity="0.7" />
                            ))}

                            {/* Hourglass Body with Slots (Ranurado) */}
                            <path d={`
                                M ${center - intakeW / 2} ${pumpBottomY + 14} 
                                L ${center + intakeW / 2} ${pumpBottomY + 14} 
                                Q ${center + intakeW / 2 * 0.7} ${pumpBottomY + intakeH / 2}, ${center + intakeW / 2} ${pumpBottomY + intakeH - 14}
                                L ${center - intakeW / 2} ${pumpBottomY + intakeH - 14}
                                Q ${center - intakeW / 2 * 0.7} ${pumpBottomY + intakeH / 2}, ${center - intakeW / 2} ${pumpBottomY + 14} 
                                Z`}
                                fill="url(#meshPat)" stroke="#000" strokeWidth="2" />

                            <path d={`
                                M ${center - intakeW / 2} ${pumpBottomY + 14} 
                                L ${center + intakeW / 2} ${pumpBottomY + 14} 
                                Q ${center + intakeW / 2 * 0.7} ${pumpBottomY + intakeH / 2}, ${center + intakeW / 2} ${pumpBottomY + intakeH - 14}
                                L ${center - intakeW / 2} ${pumpBottomY + intakeH - 14}
                                Q ${center - intakeW / 2 * 0.7} ${pumpBottomY + intakeH / 2}, ${center - intakeW / 2} ${pumpBottomY + 14} 
                                Z`}
                                fill="url(#cylinder3d)" opacity="0.4" />

                            {/* Vertical Slots (Ranurizado) */}
                            {Array.from({ length: 8 }).map((_, s) => {
                                const xPos = center - intakeW / 2 + 5 + s * (intakeW / 8);
                                return (
                                    <rect
                                        key={s}
                                        x={xPos}
                                        y={pumpBottomY + 20}
                                        width={2.5}
                                        height={intakeH - 40}
                                        rx="1"
                                        fill="#000"
                                        opacity="0.8"
                                        filter="url(#metalNoise)"
                                    />
                                );
                            })}

                            <rect x={center - intakeW / 2 - 5} y={pumpBottomY + intakeH - 14} width={intakeW + 10} height={14} fill="url(#collarGrad)" stroke="#000" strokeWidth="1.2" filter="url(#metalNoise)" />
                            {/* Bolts on bottom flange */}
                            {[0, 1, 2, 3, 4].map(b => (
                                <circle key={b} cx={center - intakeW / 2 + b * 11} cy={pumpBottomY + intakeH - 7} r="2" fill="#111" opacity="0.7" />
                            ))}

                            <DigitalTwinTag y={pumpBottomY + intakeH / 2} label="Intake / Gas Sep" side="left" color="slate" />
                        </g>

                        <g transform={`translate(0, ${connH * 2})`} className="component-hover">
                            <rect x={center - sealW / 2} y={intakeY + intakeH} width={sealW} height={sealH} fill="url(#sealGrad)" stroke="#000" strokeWidth="1" rx="3" filter="url(#metalNoise)" />
                            <rect x={center - sealW / 2} y={intakeY + intakeH} width={sealW} height={sealH} fill="url(#cylinder3d)" opacity="0.6" />
                            <rect x={center - sealW / 2} y={intakeY + intakeH} width={2} height={sealH} fill="#000" opacity="0.3" rx="1" />
                            <rect x={center + sealW / 2 - 2} y={intakeY + intakeH} width={2} height={sealH} fill="#000" opacity="0.3" rx="1" />
                            <ellipse cx={center} cy={intakeY + intakeH + sealH / 2} rx={sealW / 2 - 8} ry={sealH / 2 - 10} fill="none" stroke="rgb(var(--color-primary) / 0.2)" strokeWidth="1" strokeDasharray="3,2" />
                            <rect x={center - sealW / 2 - 2} y={intakeY + intakeH + sealH / 2 - 4} width={sealW + 4} height={8} fill="url(#collarGrad)" stroke="#000" strokeWidth="0.5" />
                            <path d={`M${center - 10} ${intakeY + intakeH + 38} L${center + 10} ${intakeY + intakeH + 52} M${center + 10} ${intakeY + intakeH + 38} L${center - 10} ${intakeY + intakeH + 52}`} stroke="rgb(var(--color-surface))" strokeWidth="1.2" opacity="0.4" />
                            <DigitalTwinTag y={intakeRealTop + intakeH + sealH / 2} label="Protector / Seal" side="left" color="slate" />
                        </g>

                        {/* 5. MOTOR */}
                        <g transform={`translate(0, ${connH * 3})`} className="component-hover">
                            <rect x={center - motorW / 2} y={sealY + sealH} width={motorW} height={motorH} fill="url(#motorGrad)" stroke="#000" strokeWidth="1.5" rx="2" filter="url(#metalNoise)" />
                            <rect x={center - motorW / 2} y={sealY + sealH} width={motorW} height={motorH} fill="url(#cylinder3d)" opacity="0.8" />
                            <rect x={center - motorW / 2} y={sealY + sealH} width={2} height={motorH} fill="#000" opacity="0.3" rx="1" />
                            <rect x={center + motorW / 2 - 2} y={sealY + sealH} width={2} height={motorH} fill="#000" opacity="0.3" rx="1" />
                            {Array.from({ length: Math.floor(motorH / 10) }).map((_, k) => (
                                <line key={k}
                                    x1={center - motorW / 2} y1={sealY + sealH + 8 + k * 10}
                                    x2={center + motorW / 2} y2={sealY + sealH + 8 + k * 10}
                                    stroke="#000" strokeWidth="1.2" opacity="0.4" />
                            ))}
                            <rect x={center - motorW / 2 - 3} y={sealY + sealH - 4} width={motorW + 6} height={8} fill="url(#collarGrad)" stroke="#000" rx="1" />
                            <rect x={center - motorW / 2 - 3} y={sealY + sealH + motorH - 4} width={motorW + 6} height={8} fill="url(#collarGrad)" stroke="#000" rx="1" />
                            {/* Pothead connector */}
                            <g transform={`translate(${center + motorW / 2 - 9}, ${sealY + sealH + 14})`}>
                                <rect width={16} height={28} rx="3" fill="rgb(var(--color-surface))" stroke="rgb(var(--color-text-muted) / 0.5)" strokeWidth="1.2" />
                                <rect x="2" y="-6" width="12" height="6" fill="rgb(var(--color-surface-light))" rx="2" stroke="rgb(var(--color-text-muted) / 0.5)" strokeWidth="0.8" />
                                {[-3, 0, 3].map(px => <circle key={px} cx={8 + px} cy={14} r="1.8" fill="rgb(var(--color-canvas))" stroke="rgb(var(--color-text-muted) / 0.5)" />)}
                            </g>
                            <DigitalTwinTag y={motorRealTop + motorH / 2} label="Motor Model" value={motor?.model || "Induction Motor"} side="left" color="slate" />
                        </g>

                        {/* 6. DOWNHOLE SENSOR — High-Fidelity Polished Metal Probe */}
                        <g transform={`translate(0, ${connH * 4})`} className="component-hover">
                            {/* Top machined flange */}
                            <rect x={center - sensorW / 2 - 4} y={motorY + motorH} width={sensorW + 8} height={12}
                                fill="url(#collarGrad)" stroke="#000" strokeWidth="1" filter="url(#metalNoise)" />

                            {/* Main Body - Polished Chrome effect - Flat bottomed cylinder */}
                            <rect x={center - sensorW / 2} y={motorY + motorH + 12} width={sensorW} height={sensorH - 12}
                                fill="url(#collarGrad)" stroke="#111" strokeWidth="1.2" rx="2" filter="url(#metalNoise)" />
                            <rect x={center - sensorW / 2} y={motorY + motorH + 12} width={sensorW} height={sensorH - 12}
                                fill="url(#cylinder3d)" opacity="0.3" />

                            {/* Detailed Machined Rings */}
                            {[20, 24, 45, 49, 70, 74].map(ry => (
                                <rect key={ry} x={center - sensorW / 2} y={motorY + motorH + 12 + ry} width={sensorW} height="1.5"
                                    fill="#000" opacity="0.6" />
                            ))}

                            {/* Port nubs with chrome finish */}
                            {[32, 58].map(ry => (
                                <g key={ry}>
                                    <rect x={center - sensorW / 2 - 5} y={motorY + motorH + 12 + ry} width={6} height={10} rx="1"
                                        fill="url(#collarGrad)" stroke="#000" strokeWidth="0.8" />
                                    <rect x={center + sensorW / 2 - 1} y={motorY + motorH + 12 + ry} width={6} height={10} rx="1"
                                        fill="url(#collarGrad)" stroke="#000" strokeWidth="0.8" />
                                </g>
                            ))}

                            <DigitalTwinTag y={motorY + motorH + 22} label="Downhole Sensor" side="left" color="slate" />
                        </g>


                    </g>
                    {/* ── PERFORATIONS ── Realistic Craters & Flow --- */}
                    <g key="perfs-realistic-group">
                        {/* Define a mini-helper for high-fidelity perfs */}
                        {(() => {
                            const PerfHole = ({ x, y, side }: any) => {
                                const flip = side === 'left' ? 1 : -1;
                                return (
                                    <g transform={`translate(${x}, ${y}) scale(${flip}, 1)`}>
                                        {/* 1. Fracture Crater in Formation */}
                                        <path d="M -5,-8 L 10,-12 L 18,-4 L 14,8 L 0,10 L -4,4 Z" fill="rgba(0,0,0,0.4)" filter="url(#metalNoise)" />
                                        <path d="M 12,-10 l 4 -4 M 18,2 l 5 3 M 6,10 l 2 6" stroke="#000" strokeWidth="0.5" opacity="0.3" />

                                        {/* 2. Perforation Tunnel (Depth) */}
                                        <path d="M -8,-5 L 12,-6 Q 16,0 12,6 L -8,5 Z" fill="#000" />
                                        <path d="M -8,-4 L 8,-4 Q 12,0 8,4 L -8,4 Z" fill="url(#perfInterior)" opacity="0.4" />

                                        {/* 3. Casing Exit Glow (The active 'eye') */}
                                        <ellipse cx="-8" cy="0" rx="3.5" ry="5.5" fill="#000" stroke="rgb(var(--color-warning))" strokeWidth="0.5" />
                                        <circle cx="-8" cy="0" r="2.5" fill="rgb(var(--color-warning))" filter="url(#softGlow)" />

                                        {/* 4. Fluid Wisp (Entry Flow) */}
                                        <path d="M 25,0 Q 15,0 0,0" fill="none" stroke="rgb(var(--color-primary))" strokeWidth="2.5"
                                            strokeDasharray="4 12" strokeLinecap="round" className="cable-flow" opacity="0.6" style={{ animationDuration: '1.5s' }} />
                                    </g>
                                );
                            };

                            return [20, 50, 80].map(yo => (
                                <g key={yo}>
                                    <PerfHole x={center - casingW / 2 - 4} y={perfsVisualY - 50 + yo} side="left" />
                                    <PerfHole x={center + casingW / 2 + 4} y={perfsVisualY - 50 + yo} side="right" />
                                    <circle cx={center - casingW / 2 - 25} cy={perfsVisualY - 50 + yo + 15} r="2" fill="#000" opacity="0.5" />
                                    <circle cx={center + casingW / 2 + 25} cy={perfsVisualY - 50 + yo - 10} r="1.5" fill="#000" opacity="0.4" />
                                </g>
                            ));
                        })()}

                        {/* Formation Fluid Flow Paths */}
                        {[-30, 0, 30].map((off, j) => (
                            <g key={`flow-${j}`}>
                                <path d={`M ${center - casingW / 2 - 60} ${perfsVisualY + off} Q ${center - casingW / 2 - 30} ${perfsVisualY + off + 15} ${center - casingW / 2 + 5} ${perfsVisualY + off}`}
                                    fill="none" stroke="#271105" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
                                <path d={`M ${center - casingW / 2 - 60} ${perfsVisualY + off} Q ${center - casingW / 2 - 30} ${perfsVisualY + off + 15} ${center - casingW / 2 + 5} ${perfsVisualY + off}`}
                                    fill="none" stroke="#fbbf24" strokeWidth="1.5" className="flow-line" />

                                <path d={`M ${center + casingW / 2 + 60} ${perfsVisualY + off} Q ${center + casingW / 2 + 30} ${perfsVisualY + off + 15} ${center + casingW / 2 - 5} ${perfsVisualY + off}`}
                                    fill="none" stroke="#271105" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
                                <path d={`M ${center + casingW / 2 + 60} ${perfsVisualY + off} Q ${center + casingW / 2 + 30} ${perfsVisualY + off + 15} ${center + casingW / 2 - 5} ${perfsVisualY + off}`}
                                    fill="none" stroke="#fbbf24" strokeWidth="1.5" className="flow-line" />
                            </g>
                        ))}

                        {/* Label zona cañoneada Blueprint style */}
                        <g>
                            <path d={`M${center + casingW / 2 + 10} ${perfsVisualY} L${center + casingW / 2 + 50} ${perfsVisualY}`} stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                            <g transform={`translate(${center + casingW / 2 + 50}, ${perfsVisualY - 20})`}>
                                <rect width={150} height={35} rx="1" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                                <rect width={3} height={35} fill="#475569" opacity="0.6" />
                                <text x={78} y={22} textAnchor="middle" fontSize={isReport ? 16 : 13} fill="#e2e8f0" fontWeight="950" fontFamily="'Inter', sans-serif" letterSpacing="0.08em">
                                    PERFORATIONS
                                </text>
                            </g>
                        </g>
                    </g>


                    {/* ── DATA TAGS ── Aligned to the RIGHT Sidebar */}
                    {selectedVSD && (
                        <>
                            <DigitalTwinTag
                                y={isReport ? 60 : 40}
                                label="VSD Frequency"
                                value={frequency}
                                unit="Hz"
                                side="right"
                                color="emerald"
                                hideLine={true}
                                customOffsetX={isReport ? 200 : 120}
                            />
                            <DigitalTwinTag
                                y={isReport ? 130 : 100}
                                label={selectedVSD.manufacturer}
                                value={selectedVSD.model}
                                side="right"
                                color="blue"
                                hideLine={true}
                                customOffsetX={isReport ? 200 : 120}
                            />
                        </>
                    )}
                    <DigitalTwinTag y={pumpTopY + (bodyH * housingCount) * 0.3} label="Generated Head" value={safeResults.tdh?.toFixed(0)} unit="FT" side="right" color="blue" />
                    <DigitalTwinTag y={intakeRealTop + intakeH / 2} label="Intake Pressure" value={safeResults.pip?.toFixed(0)} unit="PSI" side="right" color="emerald" />
                    <DigitalTwinTag y={motorRealTop + motorH * 0.3} label="Motor Load" value={safeResults.motorLoad?.toFixed(1)} unit="%" side="right" color="amber" />
                    <DigitalTwinTag y={fluidY - 20} label="Fluid Level" value={(results.fluidLevel || 0).toFixed(0)} unit="FT" side="right" color="blue" />
                    <DigitalTwinTag y={pumpTopY + bodyH * 0.75} label="Design Stages" value={pump?.stages || 0} unit="STG" side="right" color="slate" />
                    {isReport && (
                        <>
                            <DigitalTwinTag y={surfY + 45} label="Volt Drop" value={safeResults.electrical?.voltDrop?.toFixed(0)} unit="V Drop" side="right" color="red" />
                            <DigitalTwinTag y={surfY + 110} label="Power Loss" value={safeResults.electrical?.kwLoss?.toFixed(1)} unit="kW Loss" side="right" color="amber" />
                        </>
                    )}
                    <DigitalTwinTag y={casingBottomY - 18} label="Well TD" value={params.totalDepthMD || params.wellbore?.casingBottom || 0} unit="ft" side="right" color="slate" />

                </svg>
            </div>
        </div >
    );
};