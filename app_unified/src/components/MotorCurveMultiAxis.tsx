
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
  intakeTemp?: number; // Intake Temperature (°F)
  className?: string;
}

export const MotorCurveMultiAxis: React.FC<Props> = ({ motor, currentLoad, startLoad, endLoad, intakeTemp = 180, className }) => {
  const { t } = useLanguage();

  // Theme Colors
  const colorEff = '#10b981';      // Emerald (Efficiency)
  const colorAmps = '#f59e0b';     // Amber (Amps)
  const colorTemp = '#ef4444';     // Red (Temperature)

  const colorGrid = 'rgba(var(--color-text-muted), 0.1)';
  const colorText = 'rgb(var(--color-text-main))';
  const colorBg = 'rgb(var(--color-surface))';

  // Generate Curve Data based on Coefficients
  const data = useMemo(() => {
    if (!motor) return [];
    const points = [];
    for (let i = 0; i <= 140; i += 2) {
      const res = calculateMotorPoly(i, motor);
      // Thermal estimation: T_motor = T_intake + Load * factor
      const tempEst = intakeTemp + (i * 0.85); 
      points.push({
        load: i,
        eff: res.eff,
        amps: res.ampsPct,
        temp: tempEst
      });
    }
    return points;
  }, [motor, intakeTemp]);

  // Current operation points
  const opPoint = useMemo(() => motor ? calculateMotorPoly(currentLoad, motor) : null, [currentLoad, motor]);
  const currentTemp = intakeTemp + (currentLoad * 0.85);

  if (!motor) return <div className="flex items-center justify-center h-full text-txt-muted font-black opacity-20 tracking-[0.3em] uppercase">No Motor Data</div>;

  return (
    <div className={`flex flex-col h-full w-full p-6 bg-surface rounded-[32px] border border-white/5 shadow-2xl overflow-hidden relative group ${className}`}>
      <div className="flex justify-between items-center mb-4 px-2 shrink-0">
        <div className="flex gap-3 text-[8px] font-black uppercase tracking-widest p-1.5 px-0 rounded-full">
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ background: colorEff }}></div> Eff</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ background: colorAmps }}></div> Amps</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ background: colorTemp }}></div> Temp</span>
        </div>
        <div className="flex gap-2 text-[8px] font-black uppercase tracking-widest opacity-60">
           <span>0%</span>
           <div className="w-12 h-1 bg-white/5 rounded-full relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-primary" style={{ width: `${(currentLoad/140)*100}%` }}></div>
           </div>
           <span>140%</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 35, left: -20, bottom: 0 }}>

            <XAxis dataKey="load" type="number" hide domain={[0, 140]} />
            
            <YAxis yAxisId="left" domain={[0, 140]} hide />
            <YAxis yAxisId="temp" orientation="right" domain={['dataMin - 10', 'dataMax + 10']} hide />

            <Tooltip
              contentStyle={{ 
                backgroundColor: 'rgba(0,0,0,0.4)', 
                backdropFilter: 'blur(10px)',
                borderColor: 'rgba(255,255,255,0.1)', 
                borderRadius: '12px', 
                fontSize: '10px', 
                fontWeight: 'black', 
                textTransform: 'uppercase' 
              }}
              itemStyle={{ padding: '0px' }}
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
            />

            <Line yAxisId="left" type="monotone" dataKey="eff" stroke={colorEff} strokeWidth={3} dot={false} name="Eff %" isAnimationActive={false} />
            <Line yAxisId="left" type="monotone" dataKey="amps" stroke={colorAmps} strokeWidth={2} strokeDasharray="4 4" dot={false} name="Amps %" isAnimationActive={false} />
            <Line yAxisId="temp" type="monotone" dataKey="temp" stroke={colorTemp} strokeWidth={3} dot={false} name="Temp °F" isAnimationActive={false} />

            {opPoint && (
              <>
                <ReferenceLine yAxisId="left" x={currentLoad} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                <ReferenceDot yAxisId="left" x={currentLoad} y={opPoint.eff} r={4} fill={colorEff} stroke="white" strokeWidth={1} isFront={true} />
                <ReferenceDot yAxisId="temp" x={currentLoad} y={currentTemp} r={4} fill={colorTemp} stroke="white" strokeWidth={1} isFront={true} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* CUSTOM OVERLAY LABELS TO REDUCE NOISE */}
        <div className="absolute top-2 left-2 pointer-events-none flex flex-col gap-1">
           <div className="text-[14px] font-black text-txt-main tracking-tighter leading-none">{(opPoint?.eff || 0).toFixed(1)}% <span className="text-[8px] text-emerald-500 uppercase">Eff</span></div>
           <div className="text-[14px] font-black text-txt-main tracking-tighter leading-none">{currentTemp.toFixed(1)}°F <span className="text-[8px] text-red-500 uppercase">Temp</span></div>
        </div>
      </div>
    </div>
  );
};
