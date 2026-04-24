
import React, { useMemo } from 'react';
import { EspPump, EspMotor, SystemParams } from '../types';
import { useLanguage } from '../i18n';

interface Props {
    pump: EspPump | null;
    motor: EspMotor | undefined;
    params: SystemParams;
    results: any;
    frequency: number;
}

export const VisualESPStack: React.FC<Props> = ({ pump, motor, params, results, frequency }) => {
    const { t } = useLanguage();
    
    // --- CONFIG & SCALING ---
    const width = 400; // Ancho del canvas
    const center = width / 2;
    const casingW = 260;
    const tubingW = 30; // Slightly wider tubing
    const espW = 70; // WIDER COMPONENT WIDTH (Was 54)
    
    // Heights (Visual Schematic, not to scale)
    const dischargeH = 40;
    const housingCount = pump?.housingCount || 1;
    const totalPumpH = pump ? Math.min(240, Math.max(100, pump.stages * 1.5)) : 100;
    
    // Distribute height among bodies
    const bodyH = totalPumpH / housingCount;
    const gapH = 10;
    
    const intakeH = 50;
    const sealH = 90;
    const motorHp = motor?.hp || params.motorHp || 100;
    const motorH = Math.min(200, 100 + (motorHp * 0.3));
    const sensorH = 50;
    
    // Y-Positions
    const surfY = 20;
    const tubingLen = 80;
    const startY = surfY + tubingLen; // Top of Pump
    
    const dischargeY = startY;
    const pumpTopY = dischargeY + dischargeH;
    // Calculate total height occupied by pump bodies + gaps
    const pumpSectionHeight = (bodyH * housingCount) + (gapH * (housingCount - 1));
    const pumpBottomY = pumpTopY + pumpSectionHeight;
    
    const intakeY = pumpBottomY;
    const sealY = intakeY + intakeH;
    const motorY = sealY + sealH;
    const sensorY = motorY + motorH;
    const espBottomY = sensorY + sensorH;
    
    // Bottom Hole Config
    const ratHoleH = 180; // Space below sensor
    const casingBottomY = espBottomY + ratHoleH;
    
    // Perforations (Placed visually between sensor and TD)
    const perfsVisualY = espBottomY + (ratHoleH * 0.5);
    const perfsH = 60;

    // Fluid Level Calculation (Visual Ratio)
    const pumpDepthMD = params.pressures.pumpDepthMD;
    const fluidLevelMD = params.pressures.pumpDepthMD - results.fluidLevel; // Fluid level in MD
    // Visual mapping: map fluid level relative to pump intake
    const pixelsPerFt = 0.2; 
    const deltaFt = pumpDepthMD - fluidLevelMD; 
    
    let fluidY = intakeY - (deltaFt * pixelsPerFt);
    if (fluidY < surfY) fluidY = surfY;
    if (fluidY > casingBottomY) fluidY = casingBottomY;

    // Bubbles Animation Config
    const bubbleRiseDist = Math.max(0, perfsVisualY - fluidY);
    
    // Generate bubbles
    const bubbles = useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => ({
            id: i,
            // Position randomly in the annulus (left or right of tool)
            side: Math.random() > 0.5 ? 'left' : 'right',
            offset: 45 + Math.random() * 30, // Adjusted offset for wider tool
            size: 4 + Math.random() * 3,
            delay: Math.random() * 5,
            duration: 4 + Math.random() * 3
        }));
    }, []);

    // Temperature Calculations (Approximation)
    const intakeTemp = params.bottomholeTemp; 
    const motorRise = (results.motorLoad || 50) * 0.8; 
    const motorTemp = intakeTemp + motorRise;

    // --- SUB-COMPONENT: Context Tag (THEME AWARE) ---
    const SmartTag = ({ y, label, value, unit, side = 'right', color = 'blue' }: any) => {
        const lineLen = 45; 
        const tagWidth = 75;
        
        const xStart = side === 'right' ? center + espW/2 + 5 : center - espW/2 - 5;
        const xEnd = side === 'right' ? xStart + lineLen : xStart - lineLen;
        
        // Use standard hex for lines to ensure visibility against all backgrounds
        // These mid-tones work on both dark (slate-900) and light (white) backgrounds
        const lineColor = color === 'blue' ? '#3b82f6' : color === 'emerald' ? '#10b981' : color === 'amber' ? '#f59e0b' : color === 'red' ? '#ef4444' : '#64748b';
        
        return (
            <g>
                <path 
                    d={`M${xStart} ${y} L${xEnd} ${y}`} 
                    stroke={lineColor} 
                    strokeWidth="1" 
                    strokeDasharray="2 2"
                    opacity="0.8"
                />
                <circle cx={xStart} cy={y} r="2" fill={lineColor} />
                
                {/* Background Rect: Uses CSS Variable for dynamic fill */}
                <rect 
                    x={side === 'right' ? xEnd : xEnd - tagWidth} 
                    y={y - 12} 
                    width={tagWidth} 
                    height="24" 
                    rx="3" 
                    fill="rgb(var(--color-surface))" 
                    stroke={lineColor} 
                    strokeWidth="1" 
                    strokeOpacity="0.6"
                />
                <g transform={`translate(${side === 'right' ? xEnd + tagWidth/2 : xEnd - tagWidth/2}, ${y})`}>
                    {/* Label: Uses Muted Text Variable */}
                    <text y="-3" textAnchor="middle" fontSize="6.5" fill="rgb(var(--color-text-muted))" fontWeight="bold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</text>
                    
                    {/* Value: Uses Main Text Variable */}
                    <text y="7" textAnchor="middle" fontSize="9" fill="rgb(var(--color-text-main))" fontWeight="900" fontFamily="monospace">
                        {value} <tspan fontSize="6" fill={lineColor} fontWeight="normal">{unit}</tspan>
                    </text>
                </g>
            </g>
        );
    };

    // Equipment Visual Constants (Fixed Metallic Colors for machinery)
    const equipmentStroke = "#334155"; // Slate 700 - Visible on both Dark and Light backgrounds
    const equipmentStrokeWidth = 1;

    return (
        <div className="h-full w-full bg-canvas relative overflow-hidden flex flex-col items-center border-l border-surface-light select-none transition-colors duration-500">
            
            {/* Header Overlay */}
            <div className="absolute top-4 left-0 w-full text-center z-10 pointer-events-none">
                <div className="inline-block px-4 py-1 rounded-full bg-surface/80 border border-surface-light backdrop-blur-sm shadow-lg">
                    <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em]">{t('vis.bha')}</span>
                </div>
            </div>

            {/* Scrollable Canvas */}
            <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex justify-center">
                <svg 
                    viewBox={`0 0 ${width} ${casingBottomY + 40}`} 
                    style={{ maxHeight: '100%', width: 'auto', minWidth: '400px' }}
                    preserveAspectRatio="xMidYMin meet"
                    className="my-4"
                >
                    <defs>
                        {/* --- FIXED EQUIPMENT GRADIENTS (Metallic Look Preserved) --- */}
                        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#1e293b" /> {/* Dark Slate */}
                            <stop offset="30%" stopColor="#475569" /> {/* Slate 600 */}
                            <stop offset="50%" stopColor="#94a3b8" /> {/* Slate 400 (Highlight) */}
                            <stop offset="70%" stopColor="#475569" />
                            <stop offset="100%" stopColor="#1e293b" />
                        </linearGradient>
                        
                        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#0f172a" />
                            <stop offset="50%" stopColor="#334155" />
                            <stop offset="100%" stopColor="#0f172a" />
                        </linearGradient>
                        
                        {/* --- FLUID GRADIENT (Light Color / Brighter) --- */}
                        <linearGradient id="fluidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.4" /> {/* Sky 300 */}
                            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.3" /> {/* Sky 400 */}
                            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.4" />
                        </linearGradient>

                        <pattern id="meshPat" width="6" height="4" patternUnits="userSpaceOnUse">
                            <rect width="6" height="4" fill="#334155" />
                            <path d="M0 4 L6 0" stroke="#94a3b8" strokeWidth="1" />
                        </pattern>
                        <filter id="blueGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>

                        {/* ANIMATIONS */}
                        <style>{`
                            @keyframes rise {
                                0% { transform: translateY(0); opacity: 0; }
                                10% { opacity: 0.8; }
                                80% { opacity: 0.8; }
                                100% { transform: translateY(-${bubbleRiseDist}px); opacity: 0; }
                            }
                            .oil-bubble {
                                animation-name: rise;
                                animation-timing-function: linear;
                                animation-iteration-count: infinite;
                            }
                            @keyframes elec-flow {
                                0% { stroke-dashoffset: 20; }
                                100% { stroke-dashoffset: 0; }
                            }
                            .cable-electric {
                                animation: elec-flow 0.5s linear infinite;
                            }
                        `}</style>
                    </defs>

                    {/* --- CASING --- */}
                    {/* Fill transparent to allow bg-canvas to show, stroke adaptable */}
                    <line x1={center - casingW/2} y1={surfY} x2={center - casingW/2} y2={casingBottomY} stroke="#64748b" strokeWidth="6" />
                    <line x1={center + casingW/2} y1={surfY} x2={center + casingW/2} y2={casingBottomY} stroke="#64748b" strokeWidth="6" />
                    <path d={`M${center - casingW/2} ${casingBottomY} L${center} ${casingBottomY + 20} L${center + casingW/2} ${casingBottomY} Z`} fill="#475569" stroke="#64748b" strokeWidth="2" />

                    {/* --- FLUID LEVEL --- */}
                    <rect x={center - casingW/2 + 4} y={fluidY} width={casingW - 8} height={casingBottomY - fluidY} fill="url(#fluidGrad)" />
                    <line x1={center - casingW/2} y1={fluidY} x2={center + casingW/2} y2={fluidY} stroke="#0ea5e9" strokeWidth="2" strokeDasharray="6 4" strokeOpacity="0.8" />

                    {/* --- RISING OIL BUBBLES --- */}
                    <g>
                        {bubbles.map(b => (
                            <circle 
                                key={b.id}
                                cx={b.side === 'left' ? center - b.offset : center + b.offset}
                                cy={perfsVisualY}
                                r={b.size}
                                fill="#0ea5e9" // Bright Blue bubbles
                                className="oil-bubble"
                                style={{
                                    animationDuration: `${b.duration}s`,
                                    animationDelay: `${b.delay}s`
                                }}
                            />
                        ))}
                    </g>

                    {/* --- TUBING --- */}
                    <rect x={center - tubingW/2} y={surfY} width={tubingW} height={startY - surfY} fill="url(#bodyGrad)" stroke={equipmentStroke} />
                    
                    {/* --- CABLE WITH ELECTRICITY EFFECT --- */}
                    {/* Base Cable */}
                    <path 
                        d={`M${center + tubingW/2 + 2} ${surfY} L${center + tubingW/2 + 2} ${startY} L${center + espW/2 + 4} ${startY + 10} L${center + espW/2 + 4} ${motorY + 20}`} 
                        stroke="#b45309" strokeWidth="6" fill="none"
                    />
                    {/* Electric Animation Layer */}
                    <path 
                        d={`M${center + tubingW/2 + 2} ${surfY} L${center + tubingW/2 + 2} ${startY} L${center + espW/2 + 4} ${startY + 10} L${center + espW/2 + 4} ${motorY + 20}`} 
                        stroke="#fcd34d" strokeWidth="2" fill="none" strokeDasharray="4 6"
                        className="cable-electric"
                        opacity="0.8"
                    />
                    
                    {/* --- ESP COMPONENTS (Using Fixed Gradients for Metallic Look) --- */}
                    
                    {/* 1. Discharge */}
                    <rect x={center - espW/2} y={dischargeY} width={espW} height={dischargeH} fill="url(#bodyGrad)" stroke={equipmentStroke} strokeWidth={equipmentStrokeWidth} />
                    <text x={center} y={dischargeY + dischargeH/2 + 3} fontSize="9" textAnchor="middle" fill="#e2e8f0" fontWeight="bold">{t('vis.disch')}</text>

                    {/* 2. Pump Bodies (Loop for Tandem) */}
                    {Array.from({length: housingCount}).map((_, i) => {
                        const yPos = pumpTopY + i * (bodyH + gapH);
                        return (
                            <g key={`pump-body-${i}`}>
                                {/* The Body */}
                                <rect x={center - espW/2} y={yPos} width={espW} height={bodyH} fill="url(#bodyGrad)" stroke={equipmentStroke} strokeWidth={equipmentStrokeWidth} />
                                {/* Tech details on pump */}
                                <rect x={center - espW/2 + 4} y={yPos + 10} width={espW - 8} height={5} fill="rgba(0,0,0, 0.3)" />
                                <rect x={center - espW/2 + 4} y={yPos + bodyH - 15} width={espW - 8} height={5} fill="rgba(0,0,0, 0.3)" />
                                <text x={center - espW/2 - 8} y={yPos + bodyH/2} textAnchor="end" fontSize="10" fontWeight="bold" fill="rgba(var(--color-text-main), 1)">{i===0 ? (pump?.model || 'Pump') : ''}</text>
                                <text x={center - espW/2 - 8} y={yPos + bodyH/2 + 10} textAnchor="end" fontSize="8" fill="rgba(var(--color-text-muted), 1)">
                                    {Math.round((pump?.stages || 0) / housingCount)} {t('p5.stagesPerBody')}
                                </text>
                                
                                {/* Connector Gap (if not last) */}
                                {i < housingCount - 1 && (
                                    <rect x={center - espW/2 + 10} y={yPos + bodyH} width={espW - 20} height={gapH} fill="#64748b" stroke={equipmentStroke} strokeWidth={equipmentStrokeWidth} />
                                )}
                            </g>
                        );
                    })}

                    {/* 3. Intake */}
                    <rect x={center - espW/2 + 2} y={intakeY} width={espW - 4} height={intakeH} fill="url(#meshPat)" stroke={equipmentStroke} strokeWidth={equipmentStrokeWidth} />
                    <rect x={center - espW/2} y={intakeY} width={espW} height={5} fill="#475569" />
                    <rect x={center - espW/2} y={intakeY + intakeH - 5} width={espW} height={5} fill="#475569" />

                    {/* 4. Seal */}
                    <rect x={center - espW/2} y={sealY} width={espW} height={sealH} fill="url(#accentGrad)" stroke={equipmentStroke} strokeWidth={equipmentStrokeWidth} />
                    <path d={`M${center-espW/2} ${sealY+sealH/2} L${center+espW/2} ${sealY+sealH/2}`} stroke={equipmentStroke} strokeWidth="1" />
                    <text x={center} y={sealY + sealH/2 + 3} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="bold">{t('vis.seal')}</text>

                    {/* 5. Motor */}
                    <rect x={center - espW/2} y={motorY} width={espW} height={motorH} fill="url(#bodyGrad)" stroke={equipmentStroke} strokeWidth={equipmentStrokeWidth} />
                    {/* Cooling Fins visual */}
                    {Array.from({length: 6}).map((_, i) => (
                        <line key={i} x1={center-espW/2} y1={motorY + 20 + i*20} x2={center+espW/2} y2={motorY + 20 + i*20} stroke="rgba(0,0,0, 0.2)" strokeWidth="1" />
                    ))}
                    <text x={center - espW/2 - 8} y={motorY + motorH/2} textAnchor="end" fontSize="10" fontWeight="bold" fill="#f59e0b">{motorHp} HP</text>
                    
                    {/* Pothead Connection */}
                    <rect x={center + espW/2 - 2} y={motorY + 15} width={16} height={20} fill="#334155" stroke="#eab308" strokeWidth="1" />

                    {/* 6. Sensor */}
                    <rect x={center - espW/2 + 6} y={sensorY} width={espW - 12} height={sensorH} fill="#475569" stroke={equipmentStroke} strokeWidth={equipmentStrokeWidth} />
                    {/* Small Status LED */}
                    <circle cx={center} cy={sensorY + sensorH - 10} r="2" fill="#10b981" opacity="0.8" />

                    {/* --- PERFORATIONS --- */}
                    <g opacity="0.8">
                        <rect x={center - casingW/2 - 4} y={perfsVisualY - perfsH/2} width="8" height={perfsH} fill="#f59e0b" />
                        <rect x={center + casingW/2 - 4} y={perfsVisualY - perfsH/2} width="8" height={perfsH} fill="#f59e0b" />
                        {[0, 10, 20, 30, 40, 50].map(off => (
                            <React.Fragment key={off}>
                                <line x1={center - casingW/2} y1={perfsVisualY - perfsH/2 + off} x2={center - casingW/2 + 20} y2={perfsVisualY - perfsH/2 + off + 5} stroke="#f59e0b" strokeWidth="1" />
                                <line x1={center + casingW/2} y1={perfsVisualY - perfsH/2 + off} x2={center + casingW/2 - 20} y2={perfsVisualY - perfsH/2 + off + 5} stroke="#f59e0b" strokeWidth="1" />
                            </React.Fragment>
                        ))}
                    </g>

                    {/* --- CONTEXTUAL DATA TAGS --- */}
                    
                    {/* 1. PIP (Intake) */}
                    <SmartTag 
                        y={intakeY + intakeH/2} 
                        label={t('tele.pip')} 
                        value={results.pip?.toFixed(0)} 
                        unit="PSI" 
                        side="right" 
                        color="emerald"
                    />

                    {/* 2. INTAKE TEMP */}
                    <SmartTag 
                        y={intakeY + intakeH + 10} 
                        label={t('vis.intakeT')}
                        value={intakeTemp?.toFixed(0)} 
                        unit="°F" 
                        side="left" 
                        color="amber"
                    />

                    {/* 3. MOTOR TEMP */}
                    <SmartTag 
                        y={motorY + motorH/2} 
                        label={t('vis.motorT')} 
                        value={motorTemp?.toFixed(0)} 
                        unit="°F" 
                        side="right" 
                        color="red"
                    />

                    {/* 4. Fluid Level */}
                    <SmartTag 
                        y={fluidY} 
                        label={t('p4.fluidAbove')} 
                        value={(pumpDepthMD - results.fluidLevel).toFixed(0)} 
                        unit="ft (MD)" 
                        side="left" 
                        color="blue"
                    />

                    {/* 5. Perforations */}
                    <SmartTag 
                        y={perfsVisualY} 
                        label={t('vis.midPerfs')} 
                        value={params.wellbore.midPerfsMD} 
                        unit="ft" 
                        side="right" 
                        color="amber"
                    />

                    {/* 6. Total Depth */}
                    <SmartTag 
                        y={casingBottomY} 
                        label={t('vis.totalDepth')} 
                        value={params.totalDepthMD} 
                        unit="ft" 
                        side="right" 
                        color="slate"
                    />

                </svg>
            </div>
        </div>
    );
};
