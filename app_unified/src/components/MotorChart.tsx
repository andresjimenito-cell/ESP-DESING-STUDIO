
import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
  ReferenceDot,
  ReferenceLine,
  Area
} from 'recharts';
import { EspMotor } from '../types';
import { useLanguage } from '../i18n';

interface MotorChartProps {
  motor: EspMotor | undefined;
  currentLoadPct: number;
  motorEffNameplate?: number;
  className?: string;
  minHeight?: number;
}

export const MotorChart: React.FC<MotorChartProps> = ({ motor, currentLoadPct, motorEffNameplate = 88, className, minHeight }) => {
  const { t } = useLanguage();

  // Theme Colors linked to CSS Variables
  const colorPrimary = 'rgb(var(--color-primary))';
  const colorSecondary = 'rgb(var(--color-secondary))';
  const colorTextMuted = 'rgb(var(--color-text-muted))';
  const colorGrid = 'rgb(var(--color-surface-light))';
  const colorSurface = 'rgb(var(--color-surface))';

  const data = useMemo(() => {
    if (!motor) return [];
    const curve = [];
    // More detailed curve generation
    for (let load = 0; load <= 150; load += 2) {
      let eff = 0;
      if (load > 0) {
        // Logarithmic rise common for induction motors
        const rise = 1 - Math.exp(-load / 22);
        // Slight drop after 100% load due to heat / magnetic saturation
        const drop = load > 100 ? (load - 100) * 0.08 : 0;
        eff = (motorEffNameplate / 0.96) * rise - drop;
        // Cap slightly above nameplate
        if (eff > motorEffNameplate + 2) eff = motorEffNameplate + 2;
      }
      
      let pf = 0;
      if (load > 0) {
        // PF rises steeply and plateaus later than efficiency
        pf = 0.90 * (1 - Math.exp(-load / 35));
      }

      let ampsPct = 0;
      if (load > 0) {
        // Amps usually have a no-load component (magnetizing amps ~25-30%)
        ampsPct = 25 + (load * 0.75);
      }

      curve.push({
        load,
        efficiency: Math.max(0, Number(eff.toFixed(1))),
        pf: Math.max(0, Number((pf * 100).toFixed(1))),
        amps: Math.max(0, Number(ampsPct.toFixed(1))),
        // Helper for area shading
        safeZone: load <= 100 ? Number(eff.toFixed(1)) : 0,
        overloadZone: load > 100 ? Number(eff.toFixed(1)) : 0
      });
    }
    return curve;
  }, [motor, motorEffNameplate]);

  const formatNumber = (val: number) => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  if (!motor) {
    return (
      <div className={`w-full h-full flex flex-col p-6 bg-surface rounded-[32px] relative justify-center items-center border border-white/5 ${className}`}>
        <h3 className="text-2xl font-black text-txt-muted tracking-widest uppercase select-none opacity-50">
          {t('chart.noMotor')}
        </h3>
      </div>
    );
  }

  const operatingPoint = data.find(d => d.load >= currentLoadPct) || data[data.length - 1];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface/95 p-4 border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.6)] rounded-2xl text-sm z-50 backdrop-blur-[16px] min-w-[220px] font-sans">
          <p className="font-bold border-b border-white/10 pb-2 mb-3 text-txt-muted flex justify-between gap-8 text-xs uppercase tracking-wider">
            <span className="opacity-70">{t('chart.motorLoad')}</span>
            <span className="font-mono text-primary text-base">{label}%</span>
          </p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => {
              if (entry.dataKey === 'safeZone' || entry.dataKey === 'overloadZone') return null;
              
              let name = entry.name;
              let unit = '%';
              
              return (
                <div key={index} className="flex justify-between gap-6 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: entry.color, color: entry.color }}></div>
                    <span className="font-bold text-txt-muted text-xs uppercase tracking-tighter">{name}</span>
                  </div>
                  <span className="font-mono font-black text-txt-main text-sm drop-shadow-sm">
                    {entry.value.toFixed(1)}<span className="opacity-70 text-xs ml-0.5">{unit}</span>
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
    <div className={className} style={{ width: '100%', height: '100%', minHeight: minHeight !== undefined ? `${minHeight}px` : '300px', position: 'relative', display: 'flex', flexDirection: 'column', padding: '1.2rem', borderRadius: '32px', backgroundColor: colorSurface }}>
      
      {/* Header aligned with PumpChart style */}
      <div className="flex justify-between items-start mb-4 px-2">
        <div>
          <h3 className="text-xl font-black text-txt-main tracking-tight leading-none uppercase drop-shadow-md">
            {t('p5.motorCurve')}
          </h3>
          <p className="text-[10px] font-bold text-txt-muted uppercase mt-1 tracking-wider">
            {motor.manufacturer} <span className="opacity-40 px-1">|</span> <span className="text-secondary font-black">{motor.model}</span> <span className="opacity-40 px-1">|</span> {motor.hp} HP
          </p>
        </div>

        <div className="hidden md:flex gap-4 text-[9px] font-black bg-surface-light/30 px-3 py-1.5 rounded-xl border border-white/[0.05] uppercase tracking-[0.1em] text-txt-muted shadow-sm select-none">
          <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: colorPrimary }}></span> {t('chart.efficiency')}</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: colorSecondary }}></span> PF</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] border-t-2 border-dashed border-white/20"></span> {t('chart.ratedLoad')}</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="99%">
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <defs>
              <filter id="glow-primary-motor" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={colorPrimary} floodOpacity="0.5" />
              </filter>
              <filter id="glow-secondary-motor" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={colorSecondary} floodOpacity="0.4" />
              </filter>
               <linearGradient id="areaGradientMotor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorPrimary} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={colorPrimary} stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} strokeWidth={1} vertical={false} />

            <XAxis 
              dataKey="load" 
              type="number" 
              domain={[0, 150]}
              tick={{ fontSize: 10, fill: colorTextMuted, fontWeight: 800 }}
              tickLine={false}
              axisLine={{ stroke: colorGrid, strokeWidth: 1.5 }}
              height={30}
              tickMargin={6}
            >
              <Label value={`% ${t('chart.motorLoad')}`} offset={-8} position="insideBottom" style={{ fontSize: 9, fill: colorTextMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
            </XAxis>

            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: colorTextMuted, fontWeight: 800 }}
              tickLine={false}
              axisLine={{ stroke: colorGrid, strokeWidth: 1.5 }}
              width={45}
              tickMargin={6}
              tickFormatter={(v) => `${v}%`}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: colorTextMuted, strokeWidth: 2, strokeDasharray: '4 4' }} />

            {/* Area shading for better visual depth */}
            <Area type="monotone" dataKey="safeZone" stroke="none" fill="url(#areaGradientMotor)" isAnimationActive={false} />
            <Area type="monotone" dataKey="overloadZone" stroke="none" fill="#ef4444" fillOpacity={0.05} isAnimationActive={false} />

            <ReferenceLine x={100} stroke={colorTextMuted} strokeDasharray="5 5" strokeWidth={1.5} opacity={0.5}>
              <Label value={t('chart.ratedLoad')} position="insideTopLeft" angle={-90} fill={colorTextMuted} fontSize={8} fontWeight="900" offset={10} />
            </ReferenceLine>

            {/* PF Curve */}
            <Line 
              type="monotone" 
              dataKey="pf" 
              stroke={colorSecondary} 
              strokeWidth={2} 
              dot={false} 
              name="Power Factor"
              filter="url(#glow-secondary-motor)"
              isAnimationActive={true}
              animationDuration={1000}
            />

            {/* Efficiency Curve */}
            <Line 
              type="monotone" 
              dataKey="efficiency" 
              stroke={colorPrimary} 
              strokeWidth={4} 
              dot={false} 
              name={t('chart.efficiency')}
              filter="url(#glow-primary-motor)"
              isAnimationActive={true}
              animationDuration={800}
            />

            {/* Operating Point */}
            {operatingPoint && (
              <ReferenceDot 
                x={currentLoadPct} 
                y={operatingPoint.efficiency} 
                r={6} 
                fill={colorPrimary} 
                stroke="#fff" 
                strokeWidth={2}
                filter="url(#glow-primary-motor)"
              >
                <Label value={t('chart.opPoint')} position="top" fill={colorPrimary} fontSize={9} fontWeight="900" offset={10} />
              </ReferenceDot>
            )}

            {/* Amps Ghost Line (Optional visual reference) */}
             <Line 
              type="monotone" 
              dataKey="amps" 
              stroke={colorTextMuted} 
              strokeWidth={1} 
              strokeDasharray="3 3"
              dot={false} 
              name="Amps %"
              opacity={0.3}
              isAnimationActive={false}
            />

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
