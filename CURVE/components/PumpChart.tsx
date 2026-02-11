
import React from 'react';
import {
  LineChart,
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
import { EspPump } from '../types';
import { calculateOperatingRange } from '../utils';

interface PumpChartProps {
  data: any[];
  pump: EspPump;
  currentFrequency: number;
  intersectionPoint?: { flow: number, head: number } | null;
  targetFlow?: number;
}

export const PumpChart: React.FC<PumpChartProps> = ({ data, pump, currentFrequency, intersectionPoint, targetFlow }) => {
  const range = calculateOperatingRange(pump, currentFrequency);
  
  const formatNumber = (val: number) => {
    return val.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    });
  };

  const hasData = pump.stages > 0 && (pump.maxHead > 0 || pump.maxGraphRate > 0);

  if (!hasData) {
      return (
          <div className="w-full h-[600px] flex flex-col p-4 bg-white rounded-xl relative justify-center items-center border border-slate-200">
              <h3 className="text-4xl font-black text-slate-300 tracking-widest uppercase select-none">
                  SIN DATOS
              </h3>
               <p className="text-slate-400 font-medium mt-2">Ingrese parámetros de bomba</p>
          </div>
      );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 p-4 border border-slate-300 shadow-2xl rounded-xl text-xs z-50 backdrop-blur-md">
          <p className="font-bold border-b border-slate-200 pb-2 mb-3 text-slate-800 flex justify-between gap-6 text-sm">
              <span>Flow Rate</span>
              <span className="font-mono text-blue-700">{formatNumber(label)} BPD</span>
          </p>
          <div className="space-y-2">
          {payload.map((entry: any, index: number) => {
             if (entry.value === null || entry.value === undefined) return null;
             if (entry.name === 'Rango Mín' || entry.name === 'Rango Máx') return null;
             
             const isEff = entry.dataKey === 'efficiency';
             const unit = isEff ? '%' : ' ft';
             const val = entry.value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

             return (
               <div key={index} className="flex justify-between gap-8 items-center">
                  <div className="flex items-center gap-2">
                      <div className="w-3 h-1 rounded-full" style={{backgroundColor: entry.color}}></div>
                      <span className="font-semibold text-slate-600">{entry.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                      {val}{unit}
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
    <div className="w-full h-[600px] flex flex-col p-4 bg-white rounded-xl">
      {/* Chart Header overlaid */}
      <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-lg pointer-events-none">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
          Performance Curves
        </h3>
        <p className="text-sm font-bold text-slate-500 uppercase mt-1 tracking-wide">
          {pump.manufacturer || 'Unknown'} <span className="text-slate-300 mx-1">|</span> {pump.series || '--'} <span className="text-slate-300 mx-1">|</span> <span className="text-blue-600">{pump.model || 'No Model'}</span>
        </p>
      </div>

      <div className="flex-1 min-h-0 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 40, left: 20, bottom: 40 }}
          >
            {/* DEFINITIONS FOR FILTERS */}
            <defs>
              <filter id="glow-blue" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563eb" floodOpacity="0.5" />
              </filter>
              <filter id="glow-purple" height="300%" width="300%" x="-100%" y="-100%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#9333ea" floodOpacity="0.4" />
              </filter>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" strokeWidth={1} vertical={false} />
            
            <XAxis 
              dataKey="flow" 
              type="number" 
              domain={[0, 'auto']}
              tick={{ fontSize: 12, fill: '#334155', fontWeight: 700 }}
              tickLine={{ stroke: '#94a3b8' }}
              axisLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
              allowDataOverflow={false}
            >
                <Label value="Flow Rate (BPD)" offset={-25} position="insideBottom" style={{fontSize: 13, fill: '#1e293b', fontWeight: 800, textTransform: 'uppercase'}} />
            </XAxis>
            
            <YAxis 
                yAxisId="left"
                domain={[0, 'auto']}
                tick={{ fontSize: 12, fill: '#334155', fontWeight: 700 }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={formatNumber}
            >
                <Label value="Head (ft)" angle={-90} position="insideLeft" style={{fontSize: 13, fill: '#1e293b', fontWeight: 800, textTransform: 'uppercase'}} />
            </YAxis>

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 2, strokeDasharray: '4 4' }} />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{fontSize: '12px', paddingBottom: '20px', right: 20, top: 0, fontWeight: 600}} />

            {/* Standard Frequency Curves (Head) - Darker and clearer grey */}
            <Line yAxisId="left" type="monotone" dataKey="hz70" stroke="#94a3b8" strokeWidth={2} dot={false} name="70 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.6} />
            <Line yAxisId="left" type="monotone" dataKey="hz60" stroke="#64748b" strokeWidth={2} dot={false} name="60 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.6} />
            <Line yAxisId="left" type="monotone" dataKey="hz50" stroke="#64748b" strokeWidth={2} dot={false} name="50 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.6} />
            <Line yAxisId="left" type="monotone" dataKey="hz40" stroke="#94a3b8" strokeWidth={2} dot={false} name="40 Hz" isAnimationActive={false} connectNulls={false} strokeOpacity={0.6} />

            {/* SYSTEM CURVE (Head) - SPECTACULAR PURPLE */}
            <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="systemCurve" 
                stroke="#d946ef" 
                strokeWidth={3} 
                dot={false} 
                name="System Curve"
                isAnimationActive={false}
                strokeDasharray="8 6"
                connectNulls={false}
                filter="url(#glow-purple)"
            />

            {/* Active User Pump Curve (Head) - SPECTACULAR BLUE */}
            <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="userHz" 
                stroke="#2563eb" 
                strokeWidth={4} 
                dot={false} 
                name={`Head (${currentFrequency} Hz)`}
                activeDot={{ r: 8, strokeWidth: 4, stroke: 'white', fill: '#2563eb' }}
                connectNulls={false}
                strokeLinecap="round"
                filter="url(#glow-blue)"
            />

            {/* Rango Limits - Warning Red - Thicker */}
            <Line yAxisId="left" type="monotone" dataKey="minLimit" stroke="#f87171" strokeDasharray="5 5" strokeWidth={2.5} dot={false} name="Min Range" isAnimationActive={false} connectNulls={false} />
            <Line yAxisId="left" type="monotone" dataKey="maxLimit" stroke="#f87171" strokeDasharray="5 5" strokeWidth={2.5} dot={false} name="Max Range" isAnimationActive={false} connectNulls={false} />

            {/* Target Flow Line */}
            {targetFlow && targetFlow > 0 && (
                 <ReferenceLine 
                    yAxisId="left"
                    x={targetFlow} 
                    stroke="#f97316" 
                    strokeDasharray="4 2"
                    strokeWidth={2}
                    label={{ position: 'insideTopLeft', value: 'TARGET', fill: '#f97316', fontSize: 12, fontWeight: '900' }} 
                 />
            )}

            {/* Intersection Point */}
            {intersectionPoint && (
                <ReferenceDot 
                    yAxisId="left"
                    x={intersectionPoint.flow} 
                    y={intersectionPoint.head} 
                    r={8} 
                    fill="#10b981" 
                    stroke="#fff" 
                    strokeWidth={4}
                />
            )}
            {intersectionPoint && (
                <Label
                    x={intersectionPoint.flow}
                    y={intersectionPoint.head}
                    content={({x, y}: any) => (
                        <g transform={`translate(${x},${y})`}>
                            <filter id="label-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.3" />
                            </filter>
                            <rect x="15" y="-35" width="70" height="28" rx="6" fill="#10b981" filter="url(#label-shadow)" />
                            <text x="50" y="-17" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">MATCH</text>
                        </g>
                    )}
                />
            )}

          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
