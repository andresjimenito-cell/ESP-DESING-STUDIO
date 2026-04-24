
import React, { useState, useMemo, useEffect } from 'react';
import { PUMP_DATABASE } from './data';
import { generateMultiCurveData, calculateOperatingRange, findIntersection, calculateSystemResults } from './utils';
import { PumpChart } from './components/PumpChart';
import { 
    Settings, Droplets, Activity, RotateCcw, Layers, Clipboard, 
    ChevronDown, Construction, Target, ArrowRightLeft, Ruler, 
    Gauge, Zap, TrendingUp, Cpu, Sliders, Save, Info
} from 'lucide-react';
import { EspPump, SystemParams } from './types';

// Default initial state
const DEFAULT_PUMP: EspPump = {
  id: "custom",
  manufacturer: "",
  series: "",
  model: "",
  stages: 0,
  minRate: 0,
  bepRate: 0,
  maxRate: 0,
  maxEfficiency: 0,
  maxHead: 0,
  maxGraphRate: 0,
  nameplateFrequency: 60,
  h0: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0,
  p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0
};

const DEFAULT_SYSTEM: SystemParams = {
    thp: 0,       // psi
    intakeMD: 0,   // ft
    intakeTVD: 0,  // ft
    pmpTVD: 0,     // ft
    ge: 1.0,        // water default
    pStatic: 0,    // psi
    idTubing: 0,   // inches
    cte: 120,       // friction factor default
    ip: 0,         // bbl/d/psi
    targetFlow: 0, // Caudal Objetivo
    targetPip: 0,
    motorHp: 0     // Added Motor HP
};

/**
 * COMPONENT: NumericInput
 */
const NumericInput = ({ 
    value, 
    onChange, 
    className, 
    placeholder,
    readOnly = false,
    label,
    unit,
    dark = false
}: { 
    value: number | string; 
    onChange?: (val: number) => void; 
    className?: string; 
    placeholder?: string;
    readOnly?: boolean;
    label?: string;
    unit?: string;
    dark?: boolean;
}) => {
    const [localStr, setLocalStr] = useState(value?.toString() || "");
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalStr(value?.toString() || "");
        } else {
             const currentNum = parseFloat(localStr);
             const incomingNum = typeof value === 'number' ? value : parseFloat(value as string);
             if (!isNaN(incomingNum) && !isNaN(currentNum) && Math.abs(incomingNum - currentNum) > 0.000000001) {
                  setLocalStr(value.toString());
             }
        }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (readOnly || !onChange) return;
        const raw = e.target.value;
        setLocalStr(raw); 

        if (raw.trim() === '') {
            onChange(0);
            return;
        }

        if (/^-?\d*\.?\d*(e[+-]?\d*)?$/i.test(raw)) {
             const num = parseFloat(raw);
             if (!isNaN(num)) {
                 onChange(num);
             }
        }
    };

    return (
        <div className="flex flex-col w-full relative">
            {label && (
                <label className={`text-[10px] font-bold mb-1.5 truncate uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`} title={label}>
                    {label}
                </label>
            )}
            <div className="relative group">
                <input 
                    type="text" 
                    inputMode="decimal"
                    className={`w-full py-2 pl-3 pr-8 rounded-lg text-sm font-mono outline-none transition-all shadow-sm border
                               ${dark 
                                 ? 'bg-slate-800/50 border-slate-600 text-sky-100 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50' 
                                 : 'bg-white border-slate-200 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 group-hover:border-slate-300'
                               }
                               ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}
                               ${className}`} 
                    value={localStr} 
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    readOnly={readOnly}
                    autoComplete="off"
                />
                {unit && (
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none select-none px-1 rounded
                        ${dark ? 'text-slate-400' : 'text-slate-400 bg-white/80'}
                    `}>
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
};

const SystemSection = ({ title, children, icon: Icon }: any) => (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-4 relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
        <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-blue-400 transition-colors"></div>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2 pl-2">
            <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-4 pl-2">
            {children}
        </div>
    </div>
);

const ResultCard = ({ title, icon: Icon, mainValue, subValue, subLabel, colorClass, highlight = false }: any) => (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-full shadow-sm transition-all duration-300 ${highlight ? 'ring-2 ring-offset-2 ring-green-100' : ''} ${colorClass}`}>
        <div className="flex items-center gap-2 mb-2 opacity-80">
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex flex-col items-start">
             {mainValue}
        </div>
        {(subValue || subLabel) && (
            <div className="mt-2 pt-2 border-t border-black/5 w-full flex justify-between items-center text-xs">
                <span className="opacity-70 font-medium">{subLabel}</span>
                <span className="font-bold opacity-90">{subValue}</span>
            </div>
        )}
    </div>
);

const App: React.FC = () => {
  const [customPump, setCustomPump] = useState<EspPump>(DEFAULT_PUMP);
  const [systemParams, setSystemParams] = useState<SystemParams>(DEFAULT_SYSTEM);
  const [frequency, setFrequency] = useState<number>(60);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'pump' | 'system'>('pump');
  
  const curveData = useMemo(() => 
    generateMultiCurveData(customPump, systemParams, frequency), 
  [customPump, systemParams, frequency]);

  const intersectionPoint = useMemo(() => 
    findIntersection(curveData), 
  [curveData]);

  const sysResults = useMemo(() => 
    calculateSystemResults(
        intersectionPoint ? intersectionPoint.flow : null, 
        intersectionPoint ? intersectionPoint.head : null,
        systemParams, 
        customPump, 
        frequency
    ),
  [intersectionPoint, systemParams, customPump, frequency]);

  const handleFrequencyChange = (val: number) => {
    let safeVal = val;
    if (safeVal > 120) safeVal = 120; 
    setFrequency(safeVal);
  };

  const handlePumpChange = (field: keyof EspPump, value: any) => {
    setCustomPump(prev => ({ ...prev, [field]: value }));
  };

  const handleSystemChange = (field: keyof SystemParams, value: number) => {
      setSystemParams(prev => {
          const updated = { ...prev, [field]: value };
          const hydrostatic = (updated.pmpTVD - updated.intakeTVD) * 0.433 * updated.ge;

          if (field === 'targetFlow') {
              const validIP = updated.ip !== 0 ? updated.ip : 1; 
              const pwf = updated.pStatic - (value / validIP);
              updated.targetPip = pwf - hydrostatic;
          } 
          else if (field === 'targetPip') {
              const pwf = value + hydrostatic;
              const q = (updated.pStatic - pwf) * updated.ip;
              updated.targetFlow = q > 0 ? q : 0;
          }
          else if (['pStatic', 'ip', 'ge', 'pmpTVD', 'intakeTVD'].includes(field)) {
             const validIP = updated.ip !== 0 ? updated.ip : 1; 
             const newHydro = (updated.pmpTVD - updated.intakeTVD) * 0.433 * updated.ge;
             const newPwf = updated.pStatic - (updated.targetFlow / validIP);
             updated.targetPip = newPwf - newHydro;
          }
          return updated;
      });
  };

  const handleFullRowPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('Text');
    if (!clipboardData) return;
    
    const cleanData = clipboardData.replace(/,/g, '.');
    const items = cleanData.split(/[\t]+/).map(i => i.trim());
    if (items.length < 10) return;

    const newPump: EspPump = { ...customPump };
    const safeParse = (str: string | undefined) => { 
        if (!str) return 0;
        const cleanStr = str.replace(/['"]/g, '');
        const n = parseFloat(cleanStr); 
        return isNaN(n) ? 0 : n; 
    };

    if (items[0]) newPump.manufacturer = items[0];
    if (items[1]) newPump.series = items[1];
    if (items[2]) newPump.model = items[2];
    newPump.minRate = safeParse(items[3]);
    newPump.bepRate = safeParse(items[4]);
    newPump.maxRate = safeParse(items[5]);
    newPump.maxEfficiency = safeParse(items[6]);
    newPump.maxHead = safeParse(items[7]);
    newPump.maxGraphRate = safeParse(items[8]);
    newPump.nameplateFrequency = safeParse(items[9]); 
    // Coeffs logic...
    newPump.h0 = safeParse(items[10]); newPump.h1 = safeParse(items[11]); newPump.h2 = safeParse(items[12]);
    newPump.h3 = safeParse(items[13]); newPump.h4 = safeParse(items[14]); newPump.h5 = safeParse(items[15]);
    newPump.p0 = safeParse(items[16]); newPump.p1 = safeParse(items[17]); newPump.p2 = safeParse(items[18]);
    newPump.p3 = safeParse(items[19]); newPump.p4 = safeParse(items[20]); newPump.p5 = safeParse(items[21]);

    if (newPump.h0 > 0.1 && newPump.maxHead > newPump.h0 * 1.5) {
        newPump.stages = Math.round(newPump.maxHead / newPump.h0);
    } else {
        newPump.stages = 1;
    }
    
    setCustomPump(newPump);
    setActiveTab('pump');
  };

  const resetPump = () => {
      setCustomPump(DEFAULT_PUMP);
      setSystemParams(DEFAULT_SYSTEM);
      setFrequency(60);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shrink-0 shadow-sm">
        <div className="w-full max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-blue-200 shadow-lg">
                <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">ESP <span className="text-blue-600">Master</span> Curve</h1>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Engineering Design Tool</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={resetPump} className="text-xs font-semibold bg-white hover:bg-red-50 text-slate-500 hover:text-red-500 px-4 py-2 rounded-lg border border-slate-200 hover:border-red-200 transition-all flex items-center gap-2">
                 <RotateCcw className="w-3 h-3" /> Reset
             </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-[1920px] mx-auto px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: CONTROLS & INPUTS */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            
            {/* VFD CONTROLLER - Modern Industrial Theme (Less "Loud") */}
            <div className="bg-slate-800 text-slate-200 p-6 rounded-2xl shadow-xl relative overflow-hidden group border border-slate-700">
                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity className="w-24 h-24" />
                </div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-2 text-sky-400">
                        <Sliders className="w-5 h-5" />
                        <h2 className="font-bold tracking-wide text-sm uppercase">VFD Controller</h2>
                    </div>
                    {/* Status Light - Less neon */}
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
                </div>
                
                <div className="space-y-6 relative z-10">
                    <div className="flex items-end gap-3">
                         <div className="flex-1">
                             <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Set Frequency</label>
                             <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex items-center justify-between shadow-inner inset-shadow">
                                <NumericInput 
                                    dark
                                    value={frequency}
                                    onChange={handleFrequencyChange}
                                    className="bg-transparent text-3xl font-mono font-bold text-sky-300 w-full p-0 border-none shadow-none focus:ring-0 text-right pr-2"
                                />
                                <span className="text-xs font-bold text-slate-500">Hz</span>
                             </div>
                         </div>
                    </div>
                    
                    <div>
                        <input 
                            type="range" 
                            min="30" 
                            max="90" 
                            step="0.1"
                            value={frequency}
                            onChange={(e) => setFrequency(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400 transition-all"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-2">
                            <span>30.0</span>
                            <span>60.0</span>
                            <span>90.0</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* INPUT PANEL */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 h-[calc(100vh-380px)] min-h-[500px]">
                {/* Tabs */}
                <div className="flex p-2 bg-slate-50/50 border-b border-slate-200 gap-2">
                    <button 
                        onClick={() => setActiveTab('pump')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'pump' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        <Settings className="w-3.5 h-3.5" /> Pump Data
                    </button>
                    <button 
                        onClick={() => setActiveTab('system')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'system' ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        <Construction className="w-3.5 h-3.5" /> System Data
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                     {activeTab === 'pump' ? (
                         <div className="p-5 space-y-5">
                             {/* Paste Utility */}
                             <div className="relative group">
                                <textarea 
                                    className="w-full h-8 py-1.5 pl-8 pr-2 text-[10px] border border-blue-200 rounded-lg bg-blue-50/30 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none font-mono resize-none text-blue-900 transition-all overflow-hidden focus:h-20"
                                    placeholder="Pegar fila excel..."
                                    onPaste={handleFullRowPaste}
                                ></textarea>
                                <Clipboard className="w-3.5 h-3.5 text-blue-400 absolute top-2.5 left-2.5" />
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <NumericInput label="Fabricante" value={customPump.manufacturer} onChange={(v: any) => handlePumpChange('manufacturer', v)} />
                                <NumericInput label="Modelo" value={customPump.model} onChange={(v: any) => handlePumpChange('model', v)} />
                             </div>

                             <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-amber-800">
                                    <Layers className="w-4 h-4"/>
                                    <span className="text-xs font-bold uppercase">Etapas</span>
                                </div>
                                <NumericInput 
                                    className="w-20 text-center font-bold text-amber-900 bg-white border-amber-200" 
                                    value={customPump.stages} 
                                    onChange={(val) => handlePumpChange('stages', val)} 
                                />
                             </div>

                             <div className="pt-2 border-t border-slate-200">
                                <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center justify-between w-full text-xs font-bold text-slate-500 hover:text-blue-600 mb-3 group">
                                    <span>ADVANCED PARAMETERS</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform group-hover:bg-slate-100 rounded ${showAdvanced ? 'rotate-180' : ''}`}/>
                                </button>
                                
                                {showAdvanced && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="col-span-2 grid grid-cols-3 gap-2">
                                                 <NumericInput label="Q Min" value={customPump.minRate} onChange={(v) => handlePumpChange('minRate', v)} />
                                                 <NumericInput label="Q BEP" value={customPump.bepRate} onChange={(v) => handlePumpChange('bepRate', v)} />
                                                 <NumericInput label="Q Max" value={customPump.maxRate} onChange={(v) => handlePumpChange('maxRate', v)} />
                                            </div>
                                            <NumericInput label="Max Head (Base)" value={customPump.maxHead} onChange={(v) => handlePumpChange('maxHead', v)} />
                                            <NumericInput label="Base Freq" value={customPump.nameplateFrequency} onChange={(v) => handlePumpChange('nameplateFrequency', v)} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                                <span className="text-[10px] font-bold text-blue-600 uppercase block mb-1 text-center">Head Coeffs</span>
                                                {[0, 1, 2, 3, 4, 5].map(i => (
                                                    <div key={`h${i}`} className="flex items-center gap-2">
                                                        <span className="text-[9px] font-mono font-bold text-blue-300 w-4">H{i}</span>
                                                        <NumericInput className="text-right text-[10px] py-1 h-7" value={customPump[`h${i}` as keyof EspPump] as number} onChange={(val) => handlePumpChange(`h${i}` as keyof EspPump, val)} />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-2 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                                <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1 text-center">Power Coeffs</span>
                                                {[0, 1, 2, 3, 4, 5].map(i => (
                                                    <div key={`p${i}`} className="flex items-center gap-2">
                                                        <span className="text-[9px] font-mono font-bold text-amber-300 w-4">P{i}</span>
                                                        <NumericInput className="text-right text-[10px] py-1 h-7" value={customPump[`p${i}` as keyof EspPump] as number} onChange={(val) => handlePumpChange(`p${i}` as keyof EspPump, val)} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </div>
                         </div>
                     ) : (
                         <div className="p-5">
                            <SystemSection title="Reservoir & Fluid" icon={Layers}>
                                <NumericInput label="P-Static" unit="psi" value={systemParams.pStatic} onChange={(v) => handleSystemChange('pStatic', v)} />
                                <NumericInput label="P.I." unit="bpd/psi" value={systemParams.ip} onChange={(v) => handleSystemChange('ip', v)} />
                                <NumericInput label="Sp. Gravity" unit="SG" value={systemParams.ge} onChange={(v) => handleSystemChange('ge', v)} />
                            </SystemSection>
                            
                            <SystemSection title="Well Geometry" icon={Ruler}>
                                <NumericInput label="Intake MD" unit="ft" value={systemParams.intakeMD} onChange={(v) => handleSystemChange('intakeMD', v)} />
                                <NumericInput label="Intake TVD" unit="ft" value={systemParams.intakeTVD} onChange={(v) => handleSystemChange('intakeTVD', v)} />
                                <NumericInput label="PMP TVD" unit="ft" value={systemParams.pmpTVD} onChange={(v) => handleSystemChange('pmpTVD', v)} />
                            </SystemSection>

                            <SystemSection title="Surface / Tubing" icon={Gauge}>
                                <NumericInput label="THP" unit="psi" value={systemParams.thp} onChange={(v) => handleSystemChange('thp', v)} />
                                <NumericInput label="Tbg ID" unit="in" value={systemParams.idTubing} onChange={(v) => handleSystemChange('idTubing', v)} />
                                <NumericInput label="Friction C" unit="" value={systemParams.cte} onChange={(v) => handleSystemChange('cte', v)} />
                            </SystemSection>

                            <SystemSection title="Equipment" icon={Zap}>
                                 <NumericInput label="Motor Rating" unit="HP" value={systemParams.motorHp} onChange={(v) => handleSystemChange('motorHp', v)} className="font-bold text-amber-700 bg-amber-50 border-amber-200" />
                            </SystemSection>

                            <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-200 rounded-xl p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-orange-700">
                                        <ArrowRightLeft className="w-4 h-4" /> 
                                        <span className="text-xs font-bold uppercase">Sync Calculator</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <NumericInput label="Target Flow" unit="bpd" className="font-bold border-orange-200" value={systemParams.targetFlow} onChange={(v) => handleSystemChange('targetFlow', v)} />
                                    <NumericInput label="Target PIP" unit="psi" className="font-bold border-orange-200" value={systemParams.targetPip} onChange={(v) => handleSystemChange('targetPip', v)} />
                                </div>
                            </div>
                         </div>
                     )}
                </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CHART & RESULTS */}
          <div className="lg:col-span-9 flex flex-col gap-6">
             
             {/* MAIN CHART CARD */}
             <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-1 relative min-h-[500px] flex flex-col">
                <PumpChart 
                    data={curveData} 
                    pump={customPump} 
                    currentFrequency={frequency} 
                    intersectionPoint={intersectionPoint}
                    targetFlow={systemParams.targetFlow}
                />
             </div>
             
             {/* DASHBOARD STATS */}
             <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 
                 {/* 1. MATCH POINT (Main Stat) */}
                 <div className="col-span-2">
                     <ResultCard 
                        highlight={!!intersectionPoint}
                        title="Operating Point"
                        icon={Target}
                        colorClass="bg-white border-green-200 text-green-800"
                        mainValue={
                            intersectionPoint ? (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black tracking-tight text-slate-800">{intersectionPoint.flow}</span>
                                    <span className="text-sm font-bold text-slate-500 uppercase">bpd</span>
                                </div>
                            ) : <span className="text-2xl font-bold text-slate-300">NO INTERSECTION</span>
                        }
                        subLabel="TDH Head"
                        subValue={`${intersectionPoint?.head || '--'} ft`}
                     />
                 </div>

                 {/* 2. PRESSURES */}
                 <ResultCard 
                    title="Pressures"
                    icon={Gauge}
                    colorClass="bg-white border-slate-200 text-slate-600"
                    mainValue={
                        <div className="space-y-1 w-full">
                            <div className="flex justify-between items-end">
                                <span className="text-2xl font-bold text-slate-700">{sysResults.pip?.toFixed(0) || '--'}</span>
                                <span className="text-[10px] font-bold text-slate-400 mb-1">PIP</span>
                            </div>
                        </div>
                    }
                    subLabel="Pwf (Flowing)"
                    subValue={`${sysResults.pwf?.toFixed(0) || '--'} psi`}
                 />

                 {/* 3. LIFT PER STAGE */}
                 <ResultCard 
                    title="Stage Lift"
                    icon={TrendingUp}
                    colorClass="bg-white border-blue-200 text-blue-700"
                    mainValue={
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-slate-800">{sysResults.headPerStage?.toFixed(2) || '--'}</span>
                            <span className="text-[10px] text-slate-400">ft</span>
                        </div>
                    }
                    subLabel="Total Stages"
                    subValue={customPump.stages}
                 />

                 {/* 4. MOTOR REQ */}
                 <ResultCard 
                    title="Motor Required"
                    icon={Cpu}
                    colorClass="bg-slate-50 border-purple-200 text-purple-700"
                    mainValue={
                         <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-purple-900">{sysResults.requiredMotorHp ? sysResults.requiredMotorHp.toFixed(0) : '--'}</span>
                            <span className="text-[10px] text-purple-400 font-bold">HP</span>
                        </div>
                    }
                    subLabel="Safety Factor"
                    subValue="1.10"
                 />
                 
                 {/* 5. EFFICIENCY & LOAD */}
                 <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-amber-700">
                             <Zap className="w-4 h-4" />
                             <span className="text-[10px] font-bold uppercase tracking-wider">Perf.</span>
                          </div>
                      </div>
                      <div className="space-y-3">
                          <div className="flex justify-between items-center">
                              <span className="text-xs text-amber-800 font-medium">BHP</span>
                              <span className="font-bold font-mono text-amber-900">{sysResults.hpTotal?.toFixed(1) || '--'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-xs text-amber-800 font-medium">Eff.</span>
                              <span className="font-bold font-mono text-green-600">{sysResults.effEstimated?.toFixed(1)}%</span>
                          </div>
                           <div className="flex justify-between items-center pt-2 border-t border-amber-200">
                              <span className="text-xs text-amber-800 font-bold">Load</span>
                              <span className={`font-bold font-mono ${sysResults.motorLoad && sysResults.motorLoad > 100 ? 'text-red-600' : 'text-slate-700'}`}>
                                  {sysResults.motorLoad?.toFixed(0) || '--'}%
                              </span>
                          </div>
                      </div>
                 </div>

             </div>
          </div>
      </main>
      
      <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
          .animate-fadeIn { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
