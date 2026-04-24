
import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
  ReferenceDot,
  ReferenceLine
} from 'recharts';
import { EspMotor } from '../types';
import { calculateMotorPoly } from '../utils';
import { useLanguage } from '../i18n';

interface Props {
  motor: EspMotor | undefined;
  currentLoad: number; // Current Load % (Animated)
  startLoad?: number;  // Load at Month 0
  endLoad?: number;    // Load at Final Month
  className?: string;
}

export const MotorCurveMultiAxis: React.FC<Props> = ({ motor, currentLoad, startLoad, endLoad, className }) => {
  const { t } = useLanguage();

  // Theme Colors linked to CSS Variables
  const colorEff = '#10b981';      // Emerald (Efficiency)
  const colorPF = '#8b5cf6';       // Violet (Power Factor)
  const colorAmps = '#f59e0b';     // Amber (Amps)
  const colorRPM = 'rgb(var(--color-secondary))'; // Blue (RPM)

  const colorGrid = 'rgba(var(--color-text-muted), 0.2)';
  const colorText = 'rgb(var(--color-text-main))';
  const colorBg = 'rgb(var(--color-surface))';

  // Generate Curve Data based on Coefficients
  const data = useMemo(() => {
    if (!motor) return [];
    const points = [];
    // Calculate from 0% to 140% load
    for (let i = 0; i <= 140; i += 2) {
      const res = calculateMotorPoly(i, motor);
      points.push({
        load: i,
        eff: res.eff,
        pf: res.pf,
        amps: res.ampsPct,
        rpm: res.rpm
      });
    }
    return points;
  }, [motor]);

  // Calculate Points
  const opPoint = useMemo(() => motor ? calculateMotorPoly(currentLoad, motor) : null, [currentLoad, motor]);
  const startPoint = useMemo(() => (motor && startLoad !== undefined) ? calculateMotorPoly(startLoad, motor) : null, [startLoad, motor]);
  const endPoint = useMemo(() => (motor && endLoad !== undefined) ? calculateMotorPoly(endLoad, motor) : null, [endLoad, motor]);

  if (!motor) return <div className="flex items-center justify-center h-full text-txt-muted font-bold">NO MOTOR DATA</div>;

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {/* SVG Filters for Glow Effect */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="glow-motor" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>

      <div className="flex justify-between items-center mb-2 px-4 shrink-0">
        <div className="flex gap-4 text-[10px] font-bold bg-surface-light/30 p-2 rounded-lg border border-surface-light uppercase tracking-wider overflow-x-auto">
          <span className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded-full" style={{ background: colorEff }}></div> Eff</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded-full" style={{ background: colorPF }}></div> P.F.</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded-full" style={{ background: colorAmps }}></div> Amps</span>
        </div>
        <div className="flex gap-3 text-[9px] font-black uppercase">
          {startLoad !== undefined && <span className="flex items-center gap-1 text-emerald-500"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> START</span>}
          <span className="flex items-center gap-1 text-blue-500"><div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div> NOW</span>
          {endLoad !== undefined && <span className="flex items-center gap-1 text-red-500"><div className="w-2 h-2 bg-red-500 rounded-full"></div> END</span>}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} vertical={false} />

            <XAxis
              dataKey="load"
              type="number"
              tick={{ fontSize: 10, fill: colorText, fontWeight: 700 }}
              axisLine={{ stroke: colorGrid }}
              domain={[0, 140]}
            >
              <Label value="LOAD (%)" offset={-10} position="insideBottom" style={{ fontSize: 9, fill: colorText, fontWeight: 800, opacity: 0.6 }} />
            </XAxis>

            <YAxis
              yAxisId="left"
              orientation="left"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: colorText, fontWeight: 700 }}
              axisLine={{ stroke: colorGrid }}
            />

            <YAxis
              yAxisId="right_rpm"
              orientation="right"
              domain={['auto', 'auto']}
              tick={{ fontSize: 10, fill: colorText, fontWeight: 700 }}
              axisLine={{ stroke: colorGrid }}
            />

            <YAxis yAxisId="right_amps" hide domain={[0, 150]} />

            <Tooltip
              contentStyle={{ backgroundColor: colorBg, borderColor: colorGrid, borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
              itemStyle={{ padding: '2px 0' }}
            />

            <Line yAxisId="left" type="monotone" dataKey="eff" stroke={colorEff} strokeWidth={3} dot={false} name="Efficiency" isAnimationActive={false} />
            <Line yAxisId="left" type="monotone" dataKey="pf" stroke={colorPF} strokeWidth={2} strokeDasharray="5 5" dot={false} name="Power Factor" isAnimationActive={false} />
            <Line yAxisId="right_amps" type="monotone" dataKey="amps" stroke={colorAmps} strokeWidth={2} strokeDasharray="3 3" dot={false} name="Amps (%NP)" isAnimationActive={false} />
            <Line yAxisId="right_rpm" type="monotone" dataKey="rpm" stroke={colorRPM} strokeWidth={3} dot={false} name="RPM" isAnimationActive={false} />

            {/* --- REFERENCE DOTS AND LINES --- */}
            {startPoint && startLoad !== undefined && (
              <ReferenceDot yAxisId="left" x={startLoad} y={startPoint.eff} r={5} fill="#10b981" stroke="white" strokeWidth={1} />
            )}
            {endPoint && endLoad !== undefined && (
              <ReferenceDot yAxisId="left" x={endLoad} y={endPoint.eff} r={5} fill="#ef4444" stroke="white" strokeWidth={1} />
            )}

            {opPoint && (
              <>
                <ReferenceLine yAxisId="left" x={currentLoad} stroke={colorText} strokeDasharray="4 4" strokeWidth={3} isFront={true} label={{ value: 'NOW', position: 'top', fill: colorText, fontSize: 10, fontWeight: 900 }} />

                {/* Dots with highlight/glow effect */}
                <ReferenceDot yAxisId="left" x={currentLoad} y={opPoint.eff} r={7} fill={colorEff} stroke="white" strokeWidth={2} isFront={true} filter="url(#glow-motor)" />
                <ReferenceDot yAxisId="left" x={currentLoad} y={opPoint.pf} r={5} fill={colorPF} stroke="white" strokeWidth={2} isFront={true} />
                <ReferenceDot yAxisId="right_rpm" x={currentLoad} y={opPoint.rpm} r={6} fill={colorRPM} stroke="white" strokeWidth={2} isFront={true} />
                <ReferenceDot yAxisId="right_amps" x={currentLoad} y={opPoint.ampsPct} r={5} fill={colorAmps} stroke="white" strokeWidth={1} isFront={true} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
