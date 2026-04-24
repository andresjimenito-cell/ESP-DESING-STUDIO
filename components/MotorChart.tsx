
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
  ReferenceLine,
  Area
} from 'recharts';
import { EspMotor } from '../types';
import { useLanguage } from '../i18n';

interface MotorChartProps {
  motor: EspMotor | undefined;
  currentLoadPct: number; // 0 to 100+
  motorEffNameplate?: number;
}

export const MotorChart: React.FC<MotorChartProps> = ({ motor, currentLoadPct, motorEffNameplate = 88 }) => {
  const { t } = useLanguage();
  
  const data = useMemo(() => {
    if (!motor) return [];
    const curve = [];
    for (let load = 0; load <= 130; load += 5) {
       let eff = 0;
       if (load > 0) {
           const rise = 1 - Math.exp(-load / 25);
           const drop = load > 100 ? (load - 100) * 0.05 : 0;
           eff = (motorEffNameplate / 0.95) * rise - drop; 
           if (eff > motorEffNameplate + 2) eff = motorEffNameplate + 2; 
       }
       let pf = 0;
       if (load > 0) {
           pf = 0.88 * (1 - Math.exp(-load / 40));
       }
       let ampsPct = 0;
       if (load > 0) {
            ampsPct = (load * 0.9) + 10; 
       }
       curve.push({
           load: load,
           efficiency: Math.max(0, eff),
           pf: Math.max(0, pf * 100), 
           amps: ampsPct
       });
    }
    return curve;
  }, [motor, motorEffNameplate]);

  if (!motor) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
              <h3 className="text-2xl font-black uppercase tracking-widest">{t('chart.noMotor')}</h3>
          </div>
      );
  }

  const operatingPoint = data.find(d => d.load >= currentLoadPct) || data[data.length-1];

  return (
    <div className="w-full h-[600px] flex flex-col p-1 relative">
      <div className="absolute top-4 left-6 z-10 pointer-events-none opacity-80">
        <h3 className="text-lg font-black text-slate-300 tracking-tight leading-none uppercase">{t('p5.motorCurve')}</h3>
        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wide">
          {motor.manufacturer} {motor.model} ({motor.hp} HP)
        </p>
      </div>

      <div className="flex-1 min-h-0 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={true} />
            
            <XAxis dataKey="load" type="number" domain={[0, 130]} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}>
                <Label value={`% ${t('chart.motorLoad')}`} offset={-25} position="insideBottom" style={{fontSize: 11, fill: '#475569', fontWeight: 800, textTransform: 'uppercase'}} />
            </XAxis>
            
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}>
                <Label value={`${t('chart.efficiency')} & PF (%)`} angle={-90} position="insideLeft" style={{fontSize: 11, fill: '#475569', fontWeight: 800, textTransform: 'uppercase'}} />
            </YAxis>

            <Tooltip 
                contentStyle={{backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', color: '#fff'}}
                itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
                labelStyle={{color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px'}}
                formatter={(value: number, name: string) => [value.toFixed(1), name === 'pf' ? `${t('chart.powerFactor')} %` : name === 'efficiency' ? `${t('chart.efficiency')} %` : name]}
            />
            
            <Legend verticalAlign="top" align="right" height={36} iconType="plainline" />

            <ReferenceLine x={100} stroke="#475569" strokeDasharray="3 3">
               <Label value={t('chart.ratedLoad')} position="insideTopLeft" angle={-90} fill="#64748b" fontSize={10} fontWeight={700} />
            </ReferenceLine>

            {/* Efficiency Curve */}
            <Line type="monotone" dataKey="efficiency" stroke="#10b981" strokeWidth={3} dot={false} name={`${t('chart.efficiency')} %`} filter="drop-shadow(0 0 4px rgba(16,185,129,0.3))" />
            
            {/* Power Factor Curve */}
            <Line type="monotone" dataKey="pf" stroke="#f59e0b" strokeWidth={3} dot={false} name={`${t('chart.powerFactor')} %`} filter="drop-shadow(0 0 4px rgba(245,158,11,0.3))" />

            {/* Operating Point */}
            <ReferenceDot x={currentLoadPct} y={operatingPoint.efficiency} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2}>
                 <Label value={t('chart.opPoint')} position="top" fill="#3b82f6" fontSize={10} fontWeight={900} />
            </ReferenceDot>

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
