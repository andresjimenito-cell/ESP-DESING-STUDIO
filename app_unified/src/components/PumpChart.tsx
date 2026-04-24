
import React, { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
  ReferenceDot,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { EspPump } from '@/types';
import { calculateOperatingRange, calculateBaseHead } from '@/utils';
import { useLanguage } from '@/i18n';

interface PumpChartProps {
  data: any[];
  pump: EspPump;
  currentFrequency: number;
  intersectionPoint?: { flow: number, head: number } | null;
  intersectionLabel?: string;
  referencePoints?: any[];
  secondaryPoint?: any;
  targetFlow?: number;
  className?: string;
  minHeight?: number;
  isDiagnosticMode?: boolean;
}

export const PumpChart: React.FC<PumpChartProps> = ({ data, pump, currentFrequency, intersectionPoint, intersectionLabel, referencePoints, targetFlow, className, minHeight, isDiagnosticMode }) => {
  const { t } = useLanguage();

  // Theme Colors linked to CSS Variables
  const colorPrimary = 'rgb(var(--color-primary))';
  const colorSecondary = 'rgb(var(--color-secondary))';
  const colorTextMuted = 'rgb(var(--color-text-muted))';
  const colorGrid = 'rgb(var(--color-surface-light))';
  const colorSurface = 'rgb(var(--color-surface))';

  // Calcular rangos para visualización si es necesario
  const range = calculateOperatingRange(pump, currentFrequency);

  const formatNumber = (val: number) => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const hasData = useMemo(() => {
    if (!pump) return false;
    // Extremely relaxed check: just need a pump and a non-zero h0 or maxRate
    return (pump.stages >= 1) || (pump.maxRate > 0) || (pump.maxHead > 0);
  }, [pump]);

  const safeData = useMemo(() => {
    if (!data || !pump) return [];

    const kMin = pump.minRate > 0 ? calculateBaseHead(pump.minRate, pump) / Math.pow(pump.minRate, 2) : 0;
    const kMax = pump.maxRate > 0 ? calculateBaseHead(pump.maxRate, pump) / Math.pow(pump.maxRate, 2) : 0;

    return data.map(d => {
      const flow = d.flow ?? 0;
      return {
        ...d,
        flow,
        coneMaskMin: kMin > 0 ? Number((kMin * Math.pow(flow, 2)).toFixed(1)) : 0,
        coneMaskMax: kMax > 0 ? Number((kMax * Math.pow(flow, 2)).toFixed(1)) : 0,
      };
    });
  }, [data, pump]);

  // Calculate intersection dots for limits (Red Dots)
  const limitDots = useMemo(() => {
    if (!hasData) return [];
    const baseFreq = pump.nameplateFrequency || 60;
    // Standard frequencies plotted + current user frequency
    const freqsToCheck = [30, 40, 50, 60, 70, currentFrequency];
    const uniqueFreqs = Array.from(new Set(freqsToCheck));

    return uniqueFreqs.flatMap(f => {
      const ratio = f / baseFreq;
      if (ratio <= 0) return [];

      // Min Limit Point
      const qMinBase = pump.minRate;
      const hMinBase = calculateBaseHead(qMinBase, pump);
      const qMinActual = qMinBase * ratio;
      const hMinActual = hMinBase * Math.pow(ratio, 2);

      // Max Limit Point
      const qMaxBase = pump.maxRate;
      const hMaxBase = calculateBaseHead(qMaxBase, pump);
      const qMaxActual = qMaxBase * ratio;
      const hMaxActual = hMaxBase * Math.pow(ratio, 2);

      return [
        { x: qMinActual, y: hMinActual },
        { x: qMaxActual, y: hMaxActual }
      ];
    });
  }, [pump, currentFrequency, hasData]);

  const yDomain = useMemo(() => {
    if (!pump) return [0, 'auto'] as [number, string];
    const baseHead0 = calculateBaseHead(0, pump);
    const maxHz = Math.max(70, currentFrequency || 0);
    const ratio = maxHz / (pump.nameplateFrequency || 60);
    const pumpMaxH = baseHead0 * Math.pow(ratio, 2);

    // Also consider system curve max (usually head at Q=0)
    let sysMaxH = 0;
    if (safeData && safeData.length > 0) {
      sysMaxH = Math.max(...safeData.map(d => d.systemCurve || 0));
    }

    const maxChartH = Math.max(pumpMaxH, sysMaxH);
    return [0, Math.ceil(maxChartH * 1.1 / 100) * 100] as [number, number];
  }, [pump, safeData, currentFrequency]);

  if (!hasData) {
    return (
      <div className={`w-full h-full flex flex-col p-6 bg-surface rounded-[32px] relative justify-center items-center border border-white/5 ${className}`}>
        <h3 className="text-4xl font-black text-txt-muted tracking-widest uppercase select-none opacity-50">
          {t('chart.noData')}
        </h3>
        <p className="text-txt-muted font-bold mt-4 text-xl">{t('chart.noDataSub')}</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface/95 p-4 border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.6)] rounded-2xl text-sm z-50 backdrop-blur-[16px] min-w-[240px] font-sans">
          <p className="font-bold border-b border-white/10 pb-2 mb-3 text-txt-muted flex justify-between gap-8 text-xs uppercase tracking-wider">
            <span className="opacity-70">{t('chart.flow')}</span>
            <span className="font-mono text-primary text-base">{formatNumber(label)} BPD</span>
          </p>
          <div className="space-y-1.5">
            {payload
              .filter((entry: any) => ['userHz', 'systemCurve', 'catalogPumpCurve', 'idealSystemCurve', 'manualSystemCurve'].includes(entry.dataKey))
              .map((entry: any, index: number) => {
              if (entry.value === null || entry.value === undefined) return null;

              // Rename keys for better readability in tooltip
              let name = entry.name;
              if (entry.dataKey === 'pumpMin') name = t('chart.rangeMin');
              if (entry.dataKey === 'sysMin') name = t('chart.sysMin');
              if (entry.dataKey === 'pumpMax') name = t('chart.rangeMax');
              if (entry.dataKey === 'sysMax') name = t('chart.sysMax');
              if (entry.dataKey === 'designPumpCurve') name = t('chart.design');
              if (entry.dataKey === 'userHz') name = isDiagnosticMode ? `${t('p5.pump')} Teórica @ ${currentFrequency}Hz` : `${t('p5.pump')} @ ${currentFrequency}Hz`;
              if (entry.dataKey === 'systemCurve') name = isDiagnosticMode ? 'Sistema Teórico' : t('chart.sysCurve');
              if (entry.dataKey === 'minLimit') name = t('chart.limitMin');
              if (entry.dataKey === 'manualSystemCurve') name = "Curva Escenario";

              // Standard frequencies
              if (entry.dataKey === 'hz30') name = '30 Hz';
              if (entry.dataKey === 'hz40') name = '40 Hz';
              if (entry.dataKey === 'hz50') name = '50 Hz';
              if (entry.dataKey === 'hz60') name = '60 Hz';
              if (entry.dataKey === 'hz70') name = '70 Hz';
              if (entry.dataKey === 'catalogPumpCurve') name = isDiagnosticMode ? `Bomba Ajustada (Kh)` : 'Catálogo (Bomba Nueva)';
              if (entry.dataKey === 'idealSystemCurve') name = isDiagnosticMode ? `Sistema Ajustado (Kf)` : 'Sistema Catálogo';

              const isEff = entry.dataKey === 'efficiency';
              const unit = isEff ? '%' : ' ft';
              const val = entry.value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

              return (
                <div key={index} className="flex justify-between gap-6 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: entry.color, color: entry.color }}></div>
                    <span className="font-bold text-txt-muted text-xs">{name}</span>
                  </div>
                  <span className="font-mono font-black text-txt-main text-sm drop-shadow-sm">
                    {val}<span className="opacity-70 text-xs ml-0.5">{unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: minHeight !== undefined ? `${minHeight}px` : '200px', position: 'relative', display: 'flex', flexDirection: 'column', padding: '0.4rem', borderRadius: '32px', backgroundColor: 'rgb(var(--color-surface))' }}>

      {/* Chart Header - Standard Flow */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 px-2 gap-4">
        <div>
          <h3 className="text-xl font-black text-txt-main tracking-tight leading-none uppercase drop-shadow-md">
            {t('p5.perfCurve')}
          </h3>
          <p className="text-[10px] font-bold text-txt-muted uppercase mt-1 tracking-wider">
            {pump.manufacturer} <span className="opacity-40 px-1">|</span> {pump.series} <span className="opacity-40 px-1">|</span> <span className="text-secondary font-black">{pump.model}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-[9px] font-black bg-surface-light/30 px-3 py-1.5 rounded-xl border border-white/[0.05] uppercase tracking-[0.1em] text-txt-muted shadow-sm select-none">
          <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: colorPrimary }}></span> {isDiagnosticMode ? 'BOMBA TEÓRICA' : 'PUMP'}</span>
          {isDiagnosticMode && <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: '#94a3b8' }}></span> BOMBA AJUSTADA (Kh)</span>}
          {isDiagnosticMode && <span className="flex items-center gap-1.5"><span className="w-4 h-[1px] border-t border-dotted" style={{ borderColor: colorTextMuted }}></span> 60 Hz REF</span>}
          <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: colorSecondary }}></span> {isDiagnosticMode ? 'SISTEMA TEÓRICO' : 'SYSTEM'}</span>
          {isDiagnosticMode && <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: colorSecondary, opacity: 0.4 }}></span> SISTEMA AJUSTADO (Kf)</span>}
          <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] border-t-2 border-dashed border-red-500"></span> LIMITS</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, marginTop: '0.2rem' }}>
        <ResponsiveContainer width="100%" height="99%" minHeight={minHeight !== undefined ? minHeight - 30 : 280}>
          <ComposedChart
            data={safeData}
            margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
          >
            <defs>
              <filter id="glow-primary" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={colorPrimary} floodOpacity="0.5" />
              </filter>
              <filter id="glow-secondary" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={colorSecondary} floodOpacity="0.4" />
              </filter>
              <filter id="glow-danger" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.8" />
              </filter>
              <filter id="glow-success" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#10b981" floodOpacity="0.9" />
              </filter>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} strokeWidth={1} vertical={false} />

            <XAxis
              dataKey="flow"
              type="number"
              domain={[0, 'auto']}
              tick={{ fontSize: 10, fill: colorTextMuted, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }}
              tickLine={false}
              axisLine={{ stroke: colorGrid, strokeWidth: 1.5 }}
              allowDataOverflow={false}
              height={25}
              tickMargin={4}
            >
              <Label value={`${t('chart.flow')} (BPD)`} offset={-2} position="insideBottom" style={{ fontSize: 8, fill: colorTextMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'Inter, system-ui, sans-serif' }} />
            </XAxis>

            <YAxis
              yAxisId="left"
              domain={yDomain}
              allowDataOverflow={true}
              tick={{ fontSize: 10, fill: colorTextMuted, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }}
              tickLine={false}
              axisLine={{ stroke: colorGrid, strokeWidth: 1.5 }}
              tickFormatter={formatNumber}
              width={50}
              tickMargin={4}
            >
              <Label value={`${t('chart.head')} (ft)`} angle={-90} position="insideLeft" offset={10} dx={-5} style={{ fontSize: 8, fill: colorTextMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'Inter, system-ui, sans-serif' }} />
            </YAxis>

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: colorTextMuted, strokeWidth: 2, strokeDasharray: '4 4' }} />

            {/* --- ZONE SHADING (MASTERY LAYERING) --- */}
            {/* 1. Entire Chart painted Red 0.04 (This handles the Downthrust zone above minLimit) */}
            <ReferenceArea yAxisId="left" y1={0} fill="#ef4444" fillOpacity={0.04} />

            {/* 2. Erase everything below minLimit up to x-axis, returning to surface color */}
            <Area yAxisId="left" type="monotone" dataKey="coneMaskMin" stroke="none" fill="rgb(var(--color-surface))" fillOpacity={1} isAnimationActive={false} connectNulls activeDot={false} />

            {/* 3. Paint the Cone zone Green 0.05 (from minLimit up to x-axis) */}
            <Area yAxisId="left" type="monotone" dataKey="coneMaskMin" stroke="none" fill="#10b981" fillOpacity={0.06} isAnimationActive={false} connectNulls activeDot={false} />

            {/* 4. Erase everything below maxLimit up to x-axis, returning to surface color */}
            <Area yAxisId="left" type="monotone" dataKey="coneMaskMax" stroke="none" fill="rgb(var(--color-surface))" fillOpacity={1} isAnimationActive={false} connectNulls activeDot={false} />

            {/* 5. Paint the Upthrust zone Red 0.04 (from maxLimit up to x-axis) */}
            <Area yAxisId="left" type="monotone" dataKey="coneMaskMax" stroke="none" fill="#ef4444" fillOpacity={0.04} isAnimationActive={false} connectNulls activeDot={false} />
            {/* -------------------------------------- */}

            {/* Legend has been visually replaced by the custom top-left block */}

            {/* --- Standard Frequency Curves (Originals) --- */}
            <Line yAxisId="left" type="monotone" dataKey="hz70" stroke={colorTextMuted} strokeWidth={1} dot={false} name="70 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz60" stroke={colorTextMuted} strokeWidth={1} dot={false} name="60 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz50" stroke={colorTextMuted} strokeWidth={1} dot={false} name="50 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz40" stroke={colorTextMuted} strokeWidth={1} dot={false} name="40 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz30" stroke={colorTextMuted} strokeWidth={1} dot={false} name="30 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.3} />

            {/* --- Adjusted Frequency Curves (Degraded Map) --- */}
            <Line yAxisId="left" type="monotone" dataKey="hz70Adj" stroke={colorTextMuted} strokeDasharray="3 3" strokeWidth={1.5} dot={false} name="70 Hz (Adj)" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz60Adj" stroke={colorTextMuted} strokeDasharray="3 3" strokeWidth={1.5} dot={false} name="60 Hz (Adj)" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz50Adj" stroke={colorTextMuted} strokeDasharray="3 3" strokeWidth={1.5} dot={false} name="50 Hz (Adj)" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz40Adj" stroke={colorTextMuted} strokeDasharray="3 3" strokeWidth={1.5} dot={false} name="40 Hz (Adj)" isAnimationActive={false} connectNulls={false} strokeOpacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="hz30Adj" stroke={colorTextMuted} strokeDasharray="3 3" strokeWidth={1.5} dot={false} name="30 Hz (Adj)" isAnimationActive={false} connectNulls={false} strokeOpacity={0.3} />

            {/* --- SYSTEM CURVES --- */}
            <Line yAxisId="left" type="monotone" dataKey="sysMin" stroke={colorSecondary} strokeWidth={1} dot={false} name={t('chart.sysMin')} isAnimationActive={false} connectNulls={false} opacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="sysMax" stroke={colorSecondary} strokeWidth={1} dot={false} name={t('chart.sysMax')} isAnimationActive={false} connectNulls={false} opacity={0.4} />
            <Line
              yAxisId="left"
              type="linear"
              dataKey="systemCurve"
              stroke={colorSecondary}
              strokeWidth={3}
              dot={false}
              name={t('chart.sysCurve')}
              isAnimationActive={false}
              strokeDasharray="8 6"
              connectNulls
              opacity={0.8}
            />

            {/* IDEAL SYSTEM CURVE (Catalog) */}
            {isDiagnosticMode && (
              <Line
                yAxisId="left"
                type="linear"
                dataKey="idealSystemCurve"
                stroke={colorSecondary}
                strokeWidth={2}
                dot={false}
                name="Sistema Catálogo"
                isAnimationActive={false}
                strokeDasharray="3 3"
                connectNulls
                opacity={0.4}
              />
            )}

            {/* PREDICTED / MANUAL SYSTEM CURVE (Sensitivity) */}
            <Line
              yAxisId="left"
              type="linear"
              dataKey="manualSystemCurve"
              stroke={colorPrimary}
              strokeWidth={2.5}
              dot={false}
              name="Predicción Escenario"
              isAnimationActive={false}
              strokeDasharray="4 3"
              connectNulls
              opacity={1}
            />

            {/* --- PUMP OPERATING LIMITS --- */}
            <Line yAxisId="left" type="monotone" dataKey="pumpMin" stroke={colorTextMuted} strokeWidth={1.5} dot={false} name={t('chart.rangeMin')} isAnimationActive={false} connectNulls={false} strokeDasharray="5 5" opacity={0.4} />
            <Line yAxisId="left" type="monotone" dataKey="pumpMax" stroke={colorTextMuted} strokeWidth={1.5} dot={false} name={t('chart.rangeMax')} isAnimationActive={false} connectNulls={false} strokeDasharray="5 5" opacity={0.4} />

            <Line yAxisId="left" type="monotone" dataKey="minLimit" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} dot={false} name={t('chart.limitMin')} isAnimationActive={false} connectNulls={false} opacity={0.9} />
            <Line yAxisId="left" type="monotone" dataKey="maxLimit" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} dot={false} name={t('chart.limitMax')} isAnimationActive={false} connectNulls={false} opacity={0.9} />

            {/* --- MAIN PUMP CURVE (User Hz) - DOTTED & THINNER --- */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="userHz"
              stroke={colorPrimary}
              strokeWidth={3}
              strokeDasharray="7 5"
              dot={false}
              name={`${t('chart.pumpCurve')} (${currentFrequency} Hz)`}
              activeDot={{ r: 5, strokeWidth: 2, fill: colorPrimary, stroke: '#fff' }}
              connectNulls={false}
              strokeLinecap="round"
              animationDuration={500}
            />

            {/* --- CATALOG PUMP CURVE (Diagnostic Only) --- */}
            {isDiagnosticMode && (
              <>
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="catalogPumpCurve"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                  name="Bomba Catálogo"
                  connectNulls={false}
                  strokeLinecap="round"
                  opacity={0.6}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="hz60"
                  stroke={colorTextMuted}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Referencia 60 Hz"
                  connectNulls={false}
                  opacity={0.3}
                />
              </>
            )}

            {/* --- LIMIT INTERSECTION DOTS (Red Points) --- */}
            {limitDots.map((dot, idx) => (
              <ReferenceDot
                key={`limit-dot-${idx}`}
                yAxisId="left"
                x={dot.x}
                y={dot.y}
                r={3}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={1}
              />
            ))}

            {/* --- REFERENCE LINES & DOTS --- */}

            {/* Target Flow Line - TRANSPARENT GRAY --- */}
            {targetFlow && targetFlow > 0 && (
              <ReferenceLine
                yAxisId="left"
                x={targetFlow}
                stroke={colorTextMuted}
                strokeDasharray="5 5"
                strokeWidth={1.5}
                opacity={0.5}
                label={{ position: 'insideTopLeft', value: t('chart.flow'), fill: colorTextMuted, fontSize: 10, fontWeight: '700', offset: 10 }}
              />
            )}

            {/* Intersection Point (Operating Point) */}
            {intersectionPoint && (
              <ReferenceDot
                yAxisId="left"
                x={intersectionPoint.flow}
                y={intersectionPoint.head}
                r={5}
                fill="#10b981"
                stroke="#333"
                strokeWidth={1.5}
              />
            )}

            {/* Reference Points (e.g., from History Match) */}
            {referencePoints && referencePoints.map((pt, i) => (
              <ReferenceDot
                key={i}
                yAxisId="left"
                x={pt.flow}
                y={pt.head}
                r={5}
                fill={pt.color || '#f59e0b'}
                stroke="#fff"
                strokeWidth={1.5}
              >
                <Label value={pt.label} position="top" fill={pt.color || '#f59e0b'} fontSize={9} fontWeight="bold" />
              </ReferenceDot>
            ))}

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
