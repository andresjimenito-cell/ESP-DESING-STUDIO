
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
  ReferenceLine
} from 'recharts';
import { useLanguage } from '../i18n';
import { calculateBaseHead } from '../utils';

interface Props {
  data: any[];
  currentFlow: number;
  pump: any;
  frequency: number;
  className?: string;
  minHeight?: number;
  trail?: any[];
}

export const PerformanceCurveMultiAxis: React.FC<Props> = ({ data, currentFlow, pump, frequency, className, minHeight, trail }) => {
  const { t } = useLanguage();

  // Theme Colors
  const colorHead = 'rgb(var(--color-primary))';    // Main Orange
  const colorPower = 'rgb(var(--color-secondary))'; // Technical Blue
  const colorEff = '#14b8a6';                      // Muted Teal (Eff)
  const colorSystem = '#a855f7';                   // Technical Purple (System)
  const colorTextMuted = 'rgb(var(--color-text-muted))';
  const colorGrid = 'rgba(255, 255, 255, 0.03)';

  const safeData = useMemo(() => {
    if (!data) return [];
    return data.map(d => {
      const flow = d.flow ?? 0;
      const sanitize = (v: any) => (v === null || v === undefined || (v <= 0 && flow > 0)) ? null : v;
      return {
        ...d,
        flow,
        headCurr: sanitize(d.headCurr),
        headNew: sanitize(d.headNew),
        effCurr: sanitize(d.effCurr),
        effNew: sanitize(d.effNew),
        pwrCurr: sanitize(d.pwrCurr),
        pwrNew: sanitize(d.pwrNew),
        systemCurve: sanitize(d.systemCurve),
        hz30: sanitize(d.hz30),
        hz40: sanitize(d.hz40),
        hz50: sanitize(d.hz50),
        hz60: sanitize(d.hz60),
        hz70: sanitize(d.hz70)
      };
    });
  }, [data]);

  const xDomain = useMemo<[number, number | 'auto']>(() => {
    if (safeData.length === 0) return [0, 'auto'];
    const valid = safeData.filter(d =>
      d.headCurr || d.effCurr || d.pwrCurr || d.systemCurve ||
      d.hz70 || d.hz60 || d.hz50 || d.hz40 || d.hz30
    );
    if (valid.length === 0) return [0, 'auto'];
    const maxFlow = Math.max(...valid.map(v => v.flow));
    return [0, maxFlow];
  }, [safeData]);

  const opPoint = useMemo(() => {
    if (!safeData || safeData.length === 0) return null;
    return safeData.reduce((prev, curr) => {
      const dCurr = Math.abs((curr.flow || 0) - currentFlow);
      const dPrev = Math.abs((prev.flow || 0) - currentFlow);
      return (dCurr < dPrev) ? curr : prev;
    }, safeData[0] || { flow: 0 });
  }, [safeData, currentFlow]);

  const yDomainHead = useMemo(() => {
    if (!pump) return [0, 'auto'] as any;
    const baseHeadShutIn = calculateBaseHead(0, pump);
    const maxFreq = Math.max(70, frequency || 0);
    const ratio = maxFreq / (pump.nameplateFrequency || 60);
    const maxH = baseHeadShutIn * Math.pow(ratio, 2);
    return [0, Math.ceil((maxH * 1.1) / 100) * 100] as [number, number];
  }, [pump, frequency]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface/95 p-4 border border-white/10 shadow-2xl rounded-2xl text-sm z-50 backdrop-blur-xl min-w-[220px]">
          <p className="font-bold border-b border-white/10 pb-2 mb-3 text-txt-muted flex justify-between gap-8 text-[10px] uppercase tracking-widest">
            <span>Resultados</span>
            <span className="text-secondary font-mono text-xs">{label} BPD</span>
          </p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => {
              if (entry.value === null || entry.value === undefined) return null;
              const isEff = entry.dataKey.toLowerCase().includes('eff');
              const isPwr = entry.dataKey.toLowerCase().includes('pwr');
              const unit = isEff ? '%' : (isPwr ? ' HP' : ' ft');
              return (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-tight opacity-70" style={{ color: entry.color }}>{entry.name}</span>
                  <span className="font-mono font-bold text-txt-main">
                    {entry.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    <span className="text-[10px] opacity-40 ml-0.5">{unit}</span>
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

  if (!pump) return null;

  return (
    <div className={`flex flex-col h-full w-full p-6 bg-surface rounded-[32px] border border-white/5 shadow-2xl overflow-hidden relative group ${className}`}>
      <div className="flex justify-between items-start mb-6 px-2 z-10">
        <div className="flex flex-col">
          <h3 className="text-xl font-black text-txt-main tracking-tight uppercase leading-none">{t('p5.sysPerfCurve')}</h3>
          <span className="text-[10px] font-bold text-txt-muted uppercase mt-1 tracking-[0.2em] opacity-60">Full Analytical Diagnostic HUD</span>
        </div>
        <div className="hidden lg:flex gap-5 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 select-none text-[9px] font-black tracking-widest uppercase">
          <span className="flex items-center gap-2" style={{ color: colorHead }}><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorHead }}></div> HEAD</span>
          <span className="flex items-center gap-2" style={{ color: colorEff }}><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorEff }}></div> EFF</span>
          <span className="flex items-center gap-2" style={{ color: colorPower }}><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorPower }}></div> POWER</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={safeData} margin={{ top: 20, right: 60, left: 30, bottom: 50 }}>
            <defs>
              <filter id="neon-h" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" /></filter>
              <filter id="neon-p" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" /></filter>
              <filter id="neon-e" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" /></filter>
              <filter id="neon-s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" /></filter>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} vertical={false} />

            <XAxis
              dataKey="flow"
              type="number"
              tick={{ fontSize: 10, fill: colorTextMuted, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              domain={xDomain}
            >
              <Label value="CAPACITY (BPD)" offset={-10} position="insideBottom" style={{ fontSize: 9, fill: colorTextMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
            </XAxis>

            <YAxis yAxisId="left" domain={yDomainHead} tick={{ fontSize: 10, fill: colorHead, fontWeight: 800 }} tickLine={false} axisLine={{ stroke: colorHead, strokeWidth: 2, opacity: 0.1 }} width={65} />
            <YAxis yAxisId="right_eff" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: colorEff, fontWeight: 800 }} tickLine={false} axisLine={{ stroke: colorEff, strokeWidth: 2, opacity: 0.1 }} width={45} />
            <YAxis yAxisId="right_pwr" orientation="right" domain={[0, 'auto']} tick={{ fontSize: 10, fill: colorPower, fontWeight: 800 }} tickLine={false} axisLine={false} width={45} dx={5} />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeDasharray: '4 4' }} />

            {[70, 60, 50, 40, 30].map(hz => (
              <Line key={hz} yAxisId="left" type="monotone" dataKey={`hz${hz}`} stroke={colorTextMuted} strokeWidth={1} dot={false} opacity={0.07} isAnimationActive={false} connectNulls={false} />
            ))}

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="systemCurve"
              stroke={colorSystem}
              strokeWidth={3}
              dot={false}
              name="Sistema Calibrado"
              opacity={0.9}
              connectNulls={false}
              filter="url(#neon-s)"
            />
            <Line yAxisId="left" type="monotone" dataKey="idealSystemCurve" stroke={colorSystem} strokeWidth={2} strokeDasharray="3 3" dot={false} name="Sistema Ideal (Mismo IP)" opacity={0.4} connectNulls={false} />

            <Line yAxisId="left" type="monotone" dataKey="headCurr" stroke={colorHead} strokeWidth={4} dot={false} name="Head (ft)" connectNulls={false} filter="url(#neon-p)" />
            <Line yAxisId="right_eff" type="monotone" dataKey="effCurr" stroke={colorEff} strokeWidth={3} dot={false} name="Efficiency (%)" connectNulls={false} opacity={0.8} />
            <Line yAxisId="right_pwr" type="monotone" dataKey="pwrCurr" stroke={colorPower} strokeWidth={3} dot={false} name="Power (HP)" connectNulls={false} opacity={0.8} />

            <Line yAxisId="left" type="monotone" dataKey="headNew" stroke={colorHead} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Design Head" opacity={0.4} connectNulls={false} />
            <Line yAxisId="right_eff" type="monotone" dataKey="effNew" stroke={colorEff} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Design Eff" opacity={0.4} connectNulls={false} />
            <Line yAxisId="right_pwr" type="monotone" dataKey="pwrNew" stroke={colorPower} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Design Power" opacity={0.4} connectNulls={false} />

            <Line yAxisId="left" type="monotone" dataKey="minLimit" stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="ROR Min" opacity={0.6} />
            <Line yAxisId="left" type="monotone" dataKey="maxLimit" stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="ROR Max" opacity={0.6} />

            {opPoint && (
              <>
                <ReferenceDot yAxisId="left" x={opPoint.flow} y={opPoint.headCurr} r={5} fill={colorHead} stroke="#333" strokeWidth={1.5} />
                <ReferenceDot yAxisId="right_eff" x={opPoint.flow} y={opPoint.effCurr} r={5} fill={colorEff} stroke="#333" strokeWidth={1.5} />
                <ReferenceDot yAxisId="right_pwr" x={opPoint.flow} y={opPoint.pwrCurr} r={5} fill={colorPower} stroke="#333" strokeWidth={1.5} />
                <ReferenceLine yAxisId="left" x={opPoint.flow} stroke="#333" strokeDasharray="3 3" strokeWidth={1} opacity={0.4} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black text-txt-muted uppercase tracking-[0.2em] opacity-40">
        <span>Engine Cluster v2.0.5</span>
        <span>Unit: Imperial (ft/HP/BPD)</span>
      </div>
    </div>
  );
};
