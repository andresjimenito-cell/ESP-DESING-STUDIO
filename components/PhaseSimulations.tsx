
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Activity, Clock, Layers, Play, Pause, RotateCcw, AlertTriangle, Settings, Zap, Droplets, ArrowDown, Gauge, Cpu, TrendingDown } from 'lucide-react';
import { EspPump, SystemParams } from '../types';
import { calculateTDH, calculateBaseHead, findIntersection, calculateSystemResults } from '../utils';
import { PumpChart } from './PumpChart'; 
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, ReferenceLine, ReferenceDot, AreaChart, Label, Legend } from 'recharts';
import { useLanguage } from '../i18n';

interface Props {
    params: SystemParams;
    setParams: React.Dispatch<React.SetStateAction<SystemParams>>;
    pump: EspPump | null;
    frequency: number;
}

// Telemetry Card Component - UPDATED FOR VISIBILITY (Larger Fonts)
const TelemetryItem = ({ label, value, unit, icon: Icon, color = 'blue' }: any) => (
    <div className={`bg-canvas/50 p-6 rounded-3xl border border-surface-light flex items-center justify-between hover:border-${color}-500/30 transition-all group shadow-md`}>
        <div>
            {/* Label size increased */}
            <span className={`text-sm font-black text-txt-muted uppercase tracking-wider block mb-2 group-hover:text-${color}-400 transition-colors`}>{label}</span>
            <div className="flex items-baseline gap-3">
                {/* Value size increased significantly */}
                <span className={`text-4xl font-black text-${color}-400 font-mono tracking-tight`}>{value}</span>
                <span className="text-sm font-bold text-txt-muted uppercase">{unit}</span>
            </div>
        </div>
        <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-500 border border-${color}-500/20`}>
            {Icon && <Icon className="w-8 h-8" />}
        </div>
    </div>
);

export const PhaseSimulations: React.FC<Props> = ({ params, setParams, pump, frequency }) => {
    const { t } = useLanguage();
    
    // Theme Colors
    const colorPrimary = 'rgb(var(--color-primary))';
    const colorSecondary = 'rgb(var(--color-secondary))';
    const colorTextMuted = 'rgb(var(--color-text-muted))';
    const colorGrid = 'rgb(var(--color-surface-light))';
    const colorTextMain = 'rgb(var(--color-text-main))';
    const colorCanvas = 'rgba(var(--color-canvas), 0.9)';

    // Animation State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(200); 
    const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const handleSwitchScenario = (scenario: 'min' | 'target' | 'max') => {
        const data = params.targets[scenario];
        setParams(prev => ({
            ...prev,
            activeScenario: scenario,
            pressures: { ...prev.pressures, totalRate: data.rate },
            inflow: { ...prev.inflow, ip: data.ip },
            fluids: { ...prev.fluids, waterCut: data.waterCut, gor: data.gor, glr: data.gor * (1 - data.waterCut/100) }
        }));
        // Reset simulation on scenario change
        setCurrentMonth(0);
        setIsPlaying(false);
    };

    // 1. CALCULATE STATIC DATA
    // UPDATED: Use rigorous hydraulic calculation for each step to ensure consistency with Phase 5/Report
    const simulationData = useMemo(() => {
        if (!pump) return { timeData: [], startFlow: 0, endFlow: 0, totalCost: 0, startOP: {flow:0, head:0} };

        const { annualWearPercent, simulationMonths, costPerKwh } = params.simulation;
        const timeData = [];
        let totalCumulativeCost = 0;
        
        const baseFreq = pump.nameplateFrequency || 60;
        const ratio = frequency / baseFreq;
        
        // Max Flow Iteration Limit
        const maxIterFlow = (pump.maxGraphRate || 6000) * ratio * 1.5;

        for (let m = 0; m <= simulationMonths; m++) {
            // Apply Wear Factors
            const headWearFactor = 1 - ((annualWearPercent / 100) / 12 * m);
            // Efficiency degradation heuristic
            const effWearFactor = 1 - (((annualWearPercent * 1.2)/100)/12 * m); 

            // Create a temporary "degraded pump" object for calculation
            // We scale the head coefficients down by the wear factor
            const degradedPump = {
                ...pump,
                h0: pump.h0 * headWearFactor,
                h1: pump.h1 * headWearFactor,
                h2: pump.h2 * headWearFactor,
                h3: pump.h3 * headWearFactor,
                h4: pump.h4 * headWearFactor,
                h5: pump.h5 * headWearFactor,
            };

            // Find Intersection: Degraded Pump Curve vs System Curve
            let low = 0, high = maxIterFlow;
            let opFlow = 0;
            
            // Binary search for operating point
            for(let k=0; k<20; k++) { 
                const mid = (low+high)/2;
                const qBase = mid / ratio;
                const hBase = calculateBaseHead(qBase, degradedPump);
                const hPump = hBase * Math.pow(ratio, 2);
                const hSys = calculateTDH(mid, params);
                if(hPump > hSys) low = mid; else high = mid;
            }
            opFlow = (low+high)/2;
            
            const res = calculateSystemResults(opFlow, null, params, degradedPump, frequency);
            const wornBhp = res.hpTotal / effWearFactor;
            const wornKw = (wornBhp * 0.746) / (res.electrical.motorEff / 100);
            const wornEff = res.effEstimated * effWearFactor;

            const monthlyCost = wornKw * 24 * 30 * costPerKwh;
            totalCumulativeCost += monthlyCost;

            timeData.push({ 
                month: m, 
                cumulativeCost: totalCumulativeCost, 
                monthlyCost, 
                flow: Math.round(opFlow),
                head: Math.round(res.tdh),
                efficiency: wornEff,
                bhp: wornBhp,
                kw: wornKw,
                op: { flow: Math.round(opFlow), head: Math.round(res.tdh) }
            });
        }

        return { 
            timeData, 
            startFlow: timeData[0].flow, 
            endFlow: timeData[timeData.length-1].flow, 
            totalCost: totalCumulativeCost,
            startOP: timeData[0].op
        };
    }, [pump, params, frequency]);


    // 2. GENERATE DATA FOR PumpChart
    const pumpChartData = useMemo(() => {
        if (!pump) return [];

        const baseFreq = pump.nameplateFrequency || 60;
        const ratio = frequency / baseFreq;
        const headWearFactor = 1 - ((params.simulation.annualWearPercent / 100) / 12 * currentMonth);
        
        const data = [];
        const maxFlow = (pump.maxGraphRate || pump.maxRate * 1.2 || 6000) * ratio * 1.2;
        const step = maxFlow / 60;
        
        for(let i=0; i<=60; i++) {
            const q = i * step;
            const qBase = q / ratio;
            const hBase = calculateBaseHead(qBase, pump);
            const hOrig = hBase * Math.pow(ratio, 2);
            const hCurr = hOrig * headWearFactor;
            const hSys = calculateTDH(q, params);

            if (hOrig > 0) {
                data.push({
                    flow: Math.round(q),
                    userHz: Number(hCurr.toFixed(1)),
                    designPumpCurve: Number(hOrig.toFixed(1)),
                    systemCurve: (hSys > 0 && !isNaN(hSys)) ? Number(hSys.toFixed(1)) : null,
                });
            }
        }
        return data;
    }, [pump, params, frequency, currentMonth]);

    const currentOP = useMemo(() => findIntersection(pumpChartData), [pumpChartData]);

    useEffect(() => {
        if (isPlaying) {
            simulationRef.current = setInterval(() => {
                setCurrentMonth(prev => {
                    if (prev >= params.simulation.simulationMonths) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, playbackSpeed);
        } else if (simulationRef.current) {
            clearInterval(simulationRef.current);
        }
        return () => { if (simulationRef.current) clearInterval(simulationRef.current); };
    }, [isPlaying, params.simulation.simulationMonths, playbackSpeed]);

    const handleReset = () => {
        setIsPlaying(false);
        setCurrentMonth(0);
    };

    const currentStats = simulationData.timeData[currentMonth];
    
    if (!pump) return <div className="p-10 text-center text-txt-muted font-bold uppercase flex flex-col items-center gap-4"><AlertTriangle className="w-12 h-12 text-txt-muted"/><span>Please select a pump first.</span></div>;

    return (
        <div className="h-full flex flex-col gap-8 animate-fadeIn pb-6">
            
            {/* --- TOP ROW: CONFIG & CONTROLS --- */}
            <div className="grid grid-cols-12 gap-8">
                
                {/* 1. SIMULATION SETTINGS & SCENARIO */}
                <div className="col-span-12 lg:col-span-3 bg-surface rounded-[32px] border border-surface-light p-8 flex flex-col justify-between shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10"><Settings className="w-20 h-20 text-blue-500" /></div>
                    
                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                                <Clock className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-black text-txt-main uppercase tracking-widest">{t('sim.lab')}</h3>
                        </div>
                        <div className="flex bg-canvas p-1.5 rounded-xl border border-surface-light">
                            {['min', 'target', 'max'].map((scen) => (
                                <button 
                                    key={scen} 
                                    onClick={() => handleSwitchScenario(scen as any)}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-colors ${params.activeScenario === scen ? 
                                        scen === 'min' ? 'bg-blue-600 text-white' : scen === 'target' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white' 
                                        : 'text-txt-muted hover:text-txt-main'}`}
                                >
                                    {scen === 'min' ? t('scen.min') : scen === 'target' ? t('scen.target') : t('scen.max')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-txt-muted uppercase">{t('sim.wear')}</label>
                            <div className="bg-canvas border border-surface-light rounded-2xl p-4 flex items-center focus-within:border-blue-500 transition-colors">
                                <input 
                                    type="number" step="0.5" 
                                    value={params.simulation.annualWearPercent} 
                                    onChange={(e) => setParams({...params, simulation: {...params.simulation, annualWearPercent: parseFloat(e.target.value)}})} 
                                    className="w-full bg-transparent text-lg font-bold text-txt-main outline-none"
                                />
                                <span className="text-sm font-bold text-txt-muted">%</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-txt-muted uppercase">{t('sim.energy')}</label>
                            <div className="bg-canvas border border-surface-light rounded-2xl p-4 flex items-center focus-within:border-emerald-500 transition-colors">
                                <span className="text-sm font-bold text-emerald-500 mr-2">$</span>
                                <input 
                                    type="number" step="0.01" 
                                    value={params.simulation.costPerKwh} 
                                    onChange={(e) => setParams({...params, simulation: {...params.simulation, costPerKwh: parseFloat(e.target.value)}})} 
                                    className="w-full bg-transparent text-lg font-bold text-txt-main outline-none"
                                />
                                <span className="text-sm font-bold text-txt-muted">/kWh</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-txt-muted uppercase">{t('sim.time')}</label>
                            <div className="bg-canvas border border-surface-light rounded-2xl p-4 flex items-center focus-within:border-blue-500 transition-colors">
                                <input 
                                    type="number" step="1" 
                                    value={params.simulation.simulationMonths} 
                                    onChange={(e) => setParams({...params, simulation: {...params.simulation, simulationMonths: parseFloat(e.target.value)}})} 
                                    className="w-full bg-transparent text-lg font-bold text-txt-main outline-none"
                                />
                                <span className="text-sm font-bold text-txt-muted">{t('sim.months')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. PLAYER & TIMELINE */}
                <div className="col-span-12 lg:col-span-6 bg-surface rounded-[32px] border border-surface-light p-10 shadow-lg flex flex-col justify-center gap-10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none"></div>
                    
                    <div className="flex justify-between items-end relative z-10">
                        <div>
                            <span className="text-sm font-bold text-txt-muted uppercase tracking-widest block mb-2">{t('sim.elapsed')}</span>
                            <div className="flex items-baseline gap-4">
                                <span className="text-9xl font-black text-txt-main tracking-tighter">{currentMonth}</span>
                                <span className="text-2xl font-bold text-txt-muted uppercase tracking-wider">{t('sim.months')}</span>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setIsPlaying(!isPlaying)} 
                                className={`h-20 w-20 rounded-3xl flex items-center justify-center transition-all shadow-xl ${isPlaying ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50' : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 shadow-blue-600/30'}`}
                            >
                                {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1.5" />}
                            </button>
                            <button 
                                onClick={handleReset} 
                                className="h-20 w-20 rounded-3xl bg-canvas border border-surface-light text-txt-muted hover:text-txt-main flex items-center justify-center hover:bg-surface-light transition-all"
                            >
                                <RotateCcw className="w-10 h-10" />
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <input 
                            type="range" 
                            min="0" 
                            max={params.simulation.simulationMonths} 
                            value={currentMonth} 
                            onChange={(e) => { setIsPlaying(false); setCurrentMonth(parseInt(e.target.value)); }}
                            className="w-full h-6 bg-canvas rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-surface-light"
                        />
                        <div className="flex justify-between mt-4 text-xs font-bold text-txt-muted uppercase tracking-widest">
                            <span>{t('sim.start')}</span>
                            <span>{t('sim.months')} {Math.round(params.simulation.simulationMonths/2)}</span>
                            <span>{t('sim.end')}</span>
                        </div>
                    </div>
                </div>

                {/* 3. LIVE TELEMETRY (FIXED) - SCALED TEXT */}
                <div className="col-span-12 lg:col-span-3 grid grid-cols-2 gap-5 h-full">
                    <TelemetryItem 
                        label={t('tele.flow')}
                        value={(currentStats?.flow || 0).toFixed(0)} 
                        unit="BPD" 
                        icon={Droplets} 
                        color="blue"
                    />
                    <TelemetryItem 
                        label={t('tele.head')}
                        value={(currentStats?.head || 0).toFixed(0)} 
                        unit="FT" 
                        icon={ArrowDown} 
                        color="cyan"
                    />
                    <TelemetryItem 
                        label="Pump Efficiency"
                        value={(currentStats?.efficiency || 0).toFixed(1)} 
                        unit="%" 
                        icon={Zap} 
                        color={(currentStats?.efficiency || 0) < 40 ? 'red' : 'emerald'}
                    />
                    <TelemetryItem 
                        label={t('p5.loadFactor')}
                        value={((currentStats?.bhp / params.motorHp)*100 || 0).toFixed(0)} 
                        unit="%" 
                        icon={Gauge} 
                        color="amber"
                    />
                    <TelemetryItem 
                        label={t('p5.powerDraw')}
                        value={(currentStats?.kw || 0).toFixed(1)} 
                        unit="kW" 
                        icon={Cpu} 
                        color="purple"
                    />
                    <div className="bg-canvas/50 p-6 rounded-3xl border border-surface-light flex flex-col justify-between shadow-md">
                        <span className="text-sm font-bold text-txt-muted uppercase tracking-widest">{t('sim.monthlyCost')}</span>
                        <span className="text-4xl font-black text-txt-main font-mono mt-2">${(currentStats?.monthlyCost || 0).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                    </div>
                </div>

            </div>

            {/* --- ROW 2: CHARTS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-[400px]">
                
                {/* 1. PERFORMANCE CURVE (PumpChart) */}
                <div className="bg-surface rounded-[32px] border border-surface-light shadow-xl flex flex-col overflow-hidden relative">
                    <div className="p-8 border-b border-surface-light bg-canvas/30 flex justify-between items-center">
                        <h3 className="text-base font-black text-txt-main uppercase tracking-widest flex items-center gap-3">
                            <Activity className="w-6 h-6 text-blue-500" /> Wear Simulation (Head Drop)
                        </h3>
                        <span className="text-sm font-bold text-txt-muted uppercase">Fixed {frequency.toFixed(1)} Hz | Wear: {((1 - (1 - ((params.simulation.annualWearPercent / 100) / 12 * currentMonth))) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex-1 p-4 relative bg-surface/50 rounded-b-3xl">
                        <PumpChart 
                            data={pumpChartData} 
                            pump={pump} 
                            currentFrequency={frequency} 
                            intersectionPoint={currentOP}
                            referencePoints={simulationData.startOP ? [{
                                flow: simulationData.startOP.flow,
                                head: simulationData.startOP.head,
                                label: 'NEW',
                                color: colorTextMuted
                            }] : []}
                            className="w-full h-full bg-transparent"
                        />
                    </div>
                </div>

                {/* 2. DERATING FORECAST (TIME SERIES CHART) - NEW */}
                <div className="bg-surface rounded-[32px] border border-surface-light shadow-xl flex flex-col overflow-hidden relative">
                    <div className="p-8 border-b border-surface-light bg-canvas/30 flex justify-between items-center">
                        <h3 className="text-base font-black text-txt-main uppercase tracking-widest flex items-center gap-3">
                            <TrendingDown className="w-6 h-6 text-emerald-500" /> Performance Derating over Time
                        </h3>
                    </div>
                    <div className="flex-1 p-6 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={simulationData.timeData} margin={{top: 20, right: 30, left: 10, bottom: 20}}>
                                <CartesianGrid strokeDasharray="3 3" stroke={colorGrid} vertical={true} opacity={0.3} />
                                
                                <XAxis 
                                    dataKey="month" 
                                    tick={{fontSize: 14, fill: colorTextMuted, fontWeight: 800, fontFamily: 'monospace'}} 
                                    axisLine={{stroke: colorGrid, strokeWidth: 1}} 
                                    tickLine={{stroke: colorGrid}}
                                >
                                    <Label value="Elapsed Time (Months)" position="insideBottom" offset={-10} fill={colorTextMuted} fontSize={14} fontWeight={900} style={{textTransform: 'uppercase'}} />
                                </XAxis>
                                
                                {/* Y1: Head & Eff */}
                                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{fontSize: 14, fill: colorTextMuted, fontWeight: 800, fontFamily: 'monospace'}} axisLine={false} tickLine={false}>
                                    <Label value="Head (ft) / Eff (%)" angle={-90} position="insideLeft" fill={colorSecondary} fontSize={14} fontWeight={900} style={{textTransform: 'uppercase'}} />
                                </YAxis>
                                
                                {/* Y2: Flow */}
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{fontSize: 14, fill: colorTextMuted, fontWeight: 800, fontFamily: 'monospace'}} axisLine={false} tickLine={false}>
                                    <Label value="Flow Rate (BPD)" angle={90} position="insideRight" fill={colorPrimary} fontSize={14} fontWeight={900} style={{textTransform: 'uppercase'}} />
                                </YAxis>

                                <RechartsTooltip 
                                    contentStyle={{backgroundColor: colorCanvas, borderColor: colorGrid, borderRadius:'16px', color: colorTextMain, fontSize:'14px', fontWeight: 'bold'}}
                                    labelFormatter={(v) => `Month ${v}`}
                                />
                                <Legend verticalAlign="top" height={40} iconType="plainline" wrapperStyle={{fontSize: '14px', fontWeight: 700, color: colorTextMuted}} />
                                
                                {/* Current Time Indicator */}
                                <ReferenceLine x={currentMonth} stroke="#f59e0b" strokeDasharray="3 3" />

                                {/* Flow Curve (Right Axis) - Theme Primary */}
                                <Line yAxisId="right" type="monotone" dataKey="flow" stroke={colorPrimary} strokeWidth={4} dot={false} name="Flow Rate (BPD)" animationDuration={0} filter="drop-shadow(0 0 4px rgba(var(--color-primary), 0.5))" />
                                
                                {/* Head Curve (Left Axis) - Theme Secondary */}
                                <Line yAxisId="left" type="monotone" dataKey="head" stroke={colorSecondary} strokeWidth={3} dot={false} name="Head (ft)" animationDuration={0} />

                                {/* Efficiency Curve (Left Axis) - Muted/Green */}
                                <Line yAxisId="left" type="monotone" dataKey="efficiency" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={false} name="Pump Efficiency %" animationDuration={0} />

                                {/* Current Points Dots */}
                                {currentStats && (
                                    <>
                                        <ReferenceDot yAxisId="right" x={currentMonth} y={currentStats.flow} r={8} fill={colorPrimary} stroke="white" />
                                        <ReferenceDot yAxisId="left" x={currentMonth} y={currentStats.head} r={8} fill={colorSecondary} stroke="white" />
                                        <ReferenceDot yAxisId="left" x={currentMonth} y={currentStats.efficiency} r={8} fill="#10b981" stroke="white" />
                                    </>
                                )}

                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* --- ROW 3: COST CHART (Forecast) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 h-[250px] min-h-[250px]">
                <div className="bg-surface rounded-[32px] border border-surface-light shadow-xl flex flex-col p-8 h-full">
                    <div className="mb-6 flex justify-between items-center">
                        <h3 className="text-base font-black text-txt-main uppercase tracking-widest flex items-center gap-3">
                            <Layers className="w-6 h-6 text-emerald-400" /> {t('p5.costForecast')}
                        </h3>
                        <span className="text-4xl font-black text-emerald-400">${simulationData.totalCost.toLocaleString('en-US', {maximumFractionDigits:0})}</span>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={simulationData.timeData} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colorPrimary} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={colorPrimary} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colorGrid} opacity={0.3} />
                                <XAxis dataKey="month" tick={{fontSize: 14, fill: colorTextMuted, fontWeight: 'bold', fontFamily: 'monospace'}} axisLine={{stroke: colorGrid}} tickLine={false} />
                                <YAxis tick={{fontSize: 14, fill: colorTextMuted, fontWeight: 'bold', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                                <RechartsTooltip contentStyle={{backgroundColor: colorCanvas, borderColor: colorGrid, borderRadius:'16px', color: colorTextMain}} itemStyle={{fontSize:'14px', color: colorPrimary}} formatter={(val:number) => `$${val.toLocaleString()}`} />
                                <Area type="monotone" dataKey="cumulativeCost" stroke={colorPrimary} fill="url(#colorCost)" strokeWidth={4} name="Total Cost" animationDuration={0} />
                                <ReferenceLine x={currentMonth} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'NOW', fill: '#f59e0b', fontSize: 13, fontWeight: 'bold', position: 'insideTopRight' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
