
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Cpu, Database, Sparkles, Zap, Printer, X, Save, FileText, TrendingUp, DollarSign, Calendar, AlertCircle, Filter, PieChart, Activity, Gauge, Server, UploadCloud, ChevronRight, CheckCircle2, BarChart3, Construction, Droplets, ArrowDown, Layers, Clock, TrendingDown, Eye, Settings, Target, Hammer, Battery, Cable, Flame, Download, Share2 } from 'lucide-react';
import { EspPump, EspMotor, SystemParams } from '../types';
import { calculateTDH, calculateSystemResults, generateMultiCurveData, findIntersection, calculateBaseHead, calculatePwf, calculatePDP } from '../utils';
import { PumpChart } from './PumpChart';
import { MotorChart } from './MotorChart';
import { VisualESPStack } from './VisualESPStack';
import { STANDARD_PUMPS, STANDARD_MOTORS } from '../data';
import { useLanguage } from '../i18n';

const getShaftLimitHp = (series: string): number => { if (series.includes("338")) return 140; if (series.includes("400")) return 250; if (series.includes("538")) return 580; if (series.includes("562")) return 650; if (series.includes("675")) return 950; return 300; };

const KPICard = ({ label, value, subValue, unit, icon: Icon, colorClass, highlight = false, glow = false }: any) => {
    // Detect if we are using a semantic theme color (primary/secondary) or a standard tailwind color (blue, emerald, etc)
    const isThemeColor = ['primary', 'secondary'].includes(colorClass);

    // Dynamic Class Generation based on color type
    const bgStyle = highlight 
        ? (isThemeColor ? `bg-${colorClass}/10 border-${colorClass}/50` : `bg-${colorClass}-500/10 border-${colorClass}-500/50`) 
        : 'bg-surface border-surface-light';
    
    const iconContainerStyle = highlight
        ? (isThemeColor ? `bg-${colorClass} text-white shadow-lg shadow-${colorClass}/40` : `bg-${colorClass}-500 text-white shadow-lg shadow-${colorClass}-500/40`)
        : (isThemeColor ? `bg-canvas text-${colorClass} border border-surface-light` : `bg-canvas text-${colorClass}-500 border border-surface-light`);

    const labelColor = highlight 
        ? (isThemeColor ? `text-${colorClass}` : `text-${colorClass}-300`)
        : 'text-txt-muted';

    const unitColor = highlight
        ? (isThemeColor ? `text-${colorClass}` : `text-${colorClass}-200`)
        : 'text-txt-muted';
        
    const subValueColor = highlight
        ? (isThemeColor ? `text-${colorClass}/80` : `text-${colorClass}-400/80`)
        : 'text-txt-muted';

    // Glow effect uses CSS variable for shadow color if it's a theme color
    const glowEffect = glow 
        ? (isThemeColor ? `shadow-[0_0_30px_-5px_rgba(var(--color-${colorClass}),0.3)] ring-1 ring-${colorClass}` : `shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] ring-1 ring-${colorClass}-400`)
        : '';

    return (
        <div className={`p-8 rounded-[32px] flex items-center gap-8 group hover:scale-[1.02] transition-all duration-500 border relative overflow-hidden ${bgStyle} ${glowEffect}`}>
            <div className={`p-5 rounded-3xl transition-all duration-500 ${iconContainerStyle}`}>
                {Icon && <Icon className={`w-8 h-8 ${glow ? 'animate-pulse' : ''}`} />}
            </div>
            <div>
                <span className={`text-sm font-bold uppercase tracking-wider block mb-2 ${labelColor}`}>{label}</span>
                <div className="flex items-baseline gap-3">
                    <span className={`text-4xl font-black font-mono tracking-tight ${glow ? 'text-txt-main drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-txt-main'}`}>{value}</span>
                    <span className={`text-sm font-bold ${unitColor}`}>{unit}</span>
                </div>
                {subValue && <div className={`text-xs font-bold mt-1 ${subValueColor}`}>{subValue}</div>}
            </div>
            {glow && (
                <div className="absolute top-0 right-0 p-4">
                    <div className={`w-3 h-3 rounded-full ${isThemeColor ? `bg-${colorClass}` : 'bg-emerald-400'} shadow-[0_0_10px_currentColor] animate-ping`}></div>
                </div>
            )}
        </div>
    );
};

interface AISourceModalProps { isOpen: boolean; onClose: () => void; onSelectSource: (source: 'standard' | 'imported') => void; }
const AISourceModal: React.FC<AISourceModalProps> = ({ isOpen, onClose, onSelectSource }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-canvas/80 backdrop-blur-sm p-4 animate-fadeIn">
             <div className="bg-surface p-8 rounded-[32px] max-w-lg w-full shadow-2xl border border-surface-light space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="text-center space-y-2 relative z-10"><div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30"><Sparkles className="w-8 h-8 text-primary" /></div><h3 className="text-2xl font-black text-txt-main uppercase tracking-tight">{t('p5.aiEngine')}</h3><p className="text-txt-muted font-medium text-sm">{t('p5.selectSource')}</p></div>
                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <button onClick={() => onSelectSource('standard')} className="bg-surface-light hover:bg-surface-light/80 border border-surface-light hover:border-primary p-6 rounded-2xl flex flex-col items-center gap-3 transition-all group"><Server className="w-8 h-8 text-txt-muted group-hover:text-primary" /><span className="text-xs font-black uppercase text-txt-muted group-hover:text-primary tracking-wider">{t('p5.standard')}</span></button>
                    <button onClick={() => onSelectSource('imported')} className="bg-surface-light hover:bg-surface-light/80 border border-surface-light hover:border-secondary p-6 rounded-2xl flex flex-col items-center gap-3 transition-all group"><UploadCloud className="w-8 h-8 text-txt-muted group-hover:text-secondary" /><span className="text-xs font-black uppercase text-txt-muted group-hover:text-secondary tracking-wider">{t('p5.imported')}</span></button>
                </div>
                <button onClick={onClose} className="w-full py-3 text-xs font-bold text-txt-muted hover:text-txt-main transition-colors relative z-10">{t('p5.cancel')}</button>
             </div>
        </div>
    );
};

interface ReportViewProps { onClose: () => void; params: SystemParams; results: any; pump: EspPump | null; motor: EspMotor | undefined; freq: number; curveData: any[]; match: any; scenarioLabel?: string; }
const ReportView: React.FC<ReportViewProps> = ({ onClose, params, results, pump, motor, freq, curveData, match, scenarioLabel }) => {
    const { t } = useLanguage();
    
    const handlePrint = () => { 
        const originalTitle = document.title; 
        document.title = `ESP_Design_Report_${params.metadata?.projectName || 'New'}`; 
        window.print(); 
        setTimeout(() => { document.title = originalTitle; }, 500); 
    };

    const handleDownloadJSON = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ params, results, pump, motor }, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `esp_design_data_${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const sensitivityData = useMemo(() => { if (!pump) return []; const targetFreqs = [40, 50, 60, freq]; const uniqueFreqs = Array.from(new Set(targetFreqs)).sort((a,b) => a - b); return uniqueFreqs.map(f => { const curves = generateMultiCurveData(pump, params, f); const intersection = findIntersection(curves); const opFlow = intersection ? intersection.flow : 0; const opHead = intersection ? intersection.head : 0; const res = calculateSystemResults(opFlow, opHead, params, pump, f); const bsw = params.fluids.waterCut / 100; const bwpd = opFlow * bsw; const bopd = opFlow * (1 - bsw); const wc = params.fluids.waterCut / 100; const mixSG = (params.fluids.geWater * wc) + (141.5/(131.5+params.fluids.apiOil) * (1-wc)); const dischargeP = (res.pip || 0) + (opHead * 0.433 * mixSG); const drawdownPct = params.inflow.pStatic > 0 ? ((params.inflow.pStatic - (res.pwf || 0)) / params.inflow.pStatic) * 100 : 0; const tempRise = (res.motorLoad || 0) * 0.7; const tempMotor = params.bottomholeTemp + tempRise; const shaftLimit = getShaftLimitHp(pump.series || "400"); const loadPumpShaft = (res.hpTotal / shaftLimit) * 100; const loadProtShaft = loadPumpShaft; const loadMotorShaft = (res.hpTotal / (shaftLimit * 1.5)) * 100; const baseFreq = pump.nameplateFrequency || 60; const bepRate = pump.bepRate * (f/baseFreq); const devBep = bepRate > 0 ? Math.abs(opFlow - bepRate)/bepRate : 0; const loadThrust = 15 + (devBep * 60); const cableRating = 115; const mleRating = 140; const loadCable = (res.electrical.amps / cableRating) * 100; const loadMle = (res.electrical.amps / mleRating) * 100; const ratedHp = motor?.hp || params.motorHp || 0; const availableMotorHp = ratedHp * (f / baseFreq); return { hz: f, bfpd: opFlow, pip: res.pip, bsw: params.fluids.waterCut, bwpd, bopd, pStatic: params.inflow.pStatic, pDischarge: dischargeP, pwf: res.pwf, thp: params.pressures.pht, tdh: res.tdh, fluidLevel: params.pressures.pumpDepthMD - (res.fluidLevel || 0), pumpDepth: params.pressures.pumpDepthMD, drawdown: drawdownPct, bhp: res.hpTotal, motorHp: availableMotorHp, amps: res.electrical.amps, volts: res.electrical.volts, voltDrop: res.electrical.voltDrop, kva: res.electrical.kva, kw: res.electrical.kw, velocity: res.fluidVelocity, tempMotor: tempMotor, effPump: res.effEstimated, effMotor: res.electrical.motorEff, loadPumpShaft, loadProtShaft, loadMotorShaft, loadMotorHp: res.motorLoad, loadMotorAmp: (res.electrical.amps / (motor?.amps || 1)) * 100, loadThrust, loadCable, loadMle }; }); }, [pump, params, freq, motor]);
    
    const SensitivityRow = ({ label, field, unit, decimals = 0, section = false }: any) => { 
        if (section) { 
            return (
                <tr className="bg-slate-100 border-y-2 border-slate-300 break-inside-avoid">
                    <td colSpan={sensitivityData.length + 2} className="py-2 px-3 text-[10px] font-black uppercase text-slate-800 tracking-widest">{label}</td>
                </tr>
            ); 
        } 
        return (
            <tr className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors break-inside-avoid">
                <td className="py-1.5 px-3 font-bold text-slate-700 text-[10px] uppercase border-r border-slate-100">{label}</td>
                {sensitivityData.map((d: any) => { 
                    const isDesign = d.hz === freq; 
                    return (
                        <td key={d.hz} className={`py-1.5 px-3 text-right font-mono text-[10px] border-r border-slate-100 ${isDesign ? 'font-black text-blue-700 bg-blue-50/50' : 'text-slate-600'}`}>
                            {d.bfpd > 0 || field === 'pStatic' || field === 'motorHp' ? (typeof d[field] === 'number' ? d[field].toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '-') : '-'}
                        </td>
                    ); 
                })}
                <td className="py-1.5 px-3 text-right text-[9px] font-bold text-slate-400 uppercase">{unit}</td>
            </tr>
        ); 
    };
    
    return (
        <div className="fixed inset-0 z-[9999] bg-canvas overflow-hidden flex flex-col animate-fadeIn">
            {/* --- ACTION TOOLBAR (FIXED) --- */}
            <div className="h-16 bg-surface border-b border-surface-light flex items-center justify-between px-8 shadow-2xl shrink-0 no-print z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-2 rounded-lg text-white"><Printer className="w-5 h-5"/></div>
                    <div>
                        <h3 className="text-sm font-black text-txt-main uppercase tracking-wider">{t('p5.preview')}</h3>
                        <p className="text-xs text-txt-muted font-bold">{params.metadata?.projectName || 'Untitled Project'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleDownloadJSON} className="flex items-center gap-2 text-xs font-bold text-txt-muted hover:text-white px-4 py-2 rounded-xl hover:bg-surface-light transition-all">
                        <Download className="w-4 h-4" /> {t('p5.exportData')}
                    </button>
                    <div className="h-6 w-px bg-surface-light"></div>
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase shadow-lg shadow-primary/20 transition-all transform active:scale-95">
                        <Printer className="w-4 h-4" /> {t('p5.printPdf')}
                    </button>
                    <button onClick={onClose} className="p-2.5 bg-surface-light hover:bg-red-500/20 text-txt-muted hover:text-red-500 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* --- SCROLLABLE PAPER AREA --- */}
            <div className="flex-1 overflow-y-auto bg-canvas p-8 custom-scrollbar">
                <style>{`
                    @media print { 
                        @page { margin: 0.5cm; size: auto; } 
                        html, body, #root { height: auto !important; overflow: visible !important; background: white !important; } 
                        body * { visibility: hidden; } 
                        #report-paper, #report-paper * { visibility: visible; } 
                        #report-paper { 
                            position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; 
                            background: white !important; box-shadow: none !important; min-height: 0 !important;
                        } 
                        .no-print { display: none !important; } 
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}</style>
                
                {/* --- THE PAPER --- */}
                <div id="report-paper" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl rounded-sm p-10 md:p-12 text-slate-900 flex flex-col gap-8 relative">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-1">{t('p5.techReport')}</h1>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('p5.reportSubtitle')}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{t('p5.generatedOn')}</div>
                            <div className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* Meta & Summary */}
                    <div className="grid grid-cols-2 gap-8 break-inside-avoid">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest border-b border-slate-200 pb-1">{t('p5.projectMeta')}</h3>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span className="font-bold text-slate-500">{t('p5.project')}:</span> <span className="font-bold text-slate-900">{params.metadata?.projectName || '-'}</span></div>
                                <div className="flex justify-between text-xs"><span className="font-bold text-slate-500">{t('p5.well')}:</span> <span className="font-bold text-slate-900">{params.metadata?.wellName || '-'}</span></div>
                                <div className="flex justify-between text-xs"><span className="font-bold text-slate-500">{t('p5.company')}:</span> <span className="font-bold text-slate-900">{params.metadata?.company || '-'}</span></div>
                                <div className="flex justify-between text-xs"><span className="font-bold text-slate-500">{t('p5.engineer')}:</span> <span className="font-bold text-slate-900">{params.metadata?.engineer || '-'}</span></div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest border-b border-slate-200 pb-1">{t('p5.designTarget')} ({scenarioLabel})</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><span className="block text-[9px] font-bold text-slate-500 uppercase">{t('p5.targetFlow')}</span><span className="text-lg font-black text-slate-800">{params.pressures.totalRate} BPD</span></div>
                                <div><span className="block text-[9px] font-bold text-slate-500 uppercase">{t('p5.targetFreq')}</span><span className="text-lg font-black text-slate-800">{freq} Hz</span></div>
                                <div><span className="block text-[9px] font-bold text-slate-500 uppercase">{t('p5.intakePres')}</span><span className="text-lg font-black text-emerald-600">{results.pip?.toFixed(0)} psi</span></div>
                                <div><span className="block text-[9px] font-bold text-slate-500 uppercase">{t('p5.reqHead')}</span><span className="text-lg font-black text-blue-600">{results.tdh?.toFixed(0)} ft</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="break-inside-avoid">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">{t('p5.sysPerfCurve')}</h3>
                            <span className="text-[9px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">{t('p5.fixedAt')} {freq} Hz</span>
                        </div>
                        <div className="h-[350px] w-full border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
                            {pump && <PumpChart data={curveData} pump={pump} currentFrequency={freq} intersectionPoint={match} targetFlow={params.pressures.totalRate} className="w-full h-full bg-white" />}
                        </div>
                    </div>

                    {/* Sensitivity Matrix */}
                    <div className="break-inside-avoid">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">{t('p5.sensMatrix')}</h3>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{t('p5.varFreqAnalysis')}</span>
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-500 border-b border-slate-200">
                                        <th className="py-2 px-3 text-[9px] font-black uppercase tracking-wider border-r border-slate-200">{t('p6.param')}</th>
                                        {sensitivityData.map(d => (
                                            <th key={d.hz} className={`py-2 px-3 text-right text-[9px] font-black uppercase tracking-wider border-r border-slate-200 ${d.hz === freq ? 'text-blue-700 bg-blue-100/50' : ''}`}>{d.hz} Hz</th>
                                        ))}
                                        <th className="py-2 px-3 text-right text-[9px] font-black uppercase tracking-wider">{t('p6.unit')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    <SensitivityRow label={t('sens.production')} section />
                                    <SensitivityRow label="BFPD" field="bfpd" unit="BFPD" />
                                    <SensitivityRow label="PIP" field="pip" unit="PSI" />
                                    <SensitivityRow label="BSW" field="bsw" unit="%" decimals={1} />
                                    <SensitivityRow label="BWPD" field="bwpd" unit="BFPD" />
                                    <SensitivityRow label="BOPD" field="bopd" unit="BFPD" />
                                    
                                    <SensitivityRow label={t('sens.pressures')} section />
                                    <SensitivityRow label={t('sens.static')} field="pStatic" unit="PSI" />
                                    <SensitivityRow label="Pwf" field="pwf" unit="PSI" />
                                    <SensitivityRow label="THP" field="thp" unit="PSI" />
                                    <SensitivityRow label="TDH" field="tdh" unit="FT" />
                                    <SensitivityRow label={t('sens.fluidLevel')} field="fluidLevel" unit="Ft (MD)" />
                                    
                                    <SensitivityRow label={t('sens.power')} section />
                                    <SensitivityRow label="BHP" field="bhp" unit="HP" decimals={1} />
                                    <SensitivityRow label={t('p5.motorAmps')} field="amps" unit="AMP" decimals={1} />
                                    <SensitivityRow label={t('p5.motorVolts')} field="volts" unit="Volt" decimals={0} />
                                    <SensitivityRow label="KVA" field="kva" unit="KVA" decimals={1} />
                                    <SensitivityRow label={t('sens.sysEff')} field="effPump" unit="%" decimals={1} />
                                    
                                    <SensitivityRow label={t('sens.limits')} section />
                                    <SensitivityRow label={t('sens.shaftLoad')} field="loadPumpShaft" unit="%" decimals={0} />
                                    <SensitivityRow label={t('sens.motorLoad')} field="loadMotorHp" unit="%" decimals={0} />
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Equipment & Schematic Footer */}
                    <div className="flex gap-8 break-inside-avoid h-[280px]">
                        <div className="flex-1">
                            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-3 border-b border-slate-200 pb-2">{t('p5.equipSpec')}</h3>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t('p5.pumpMan')}</span>
                                    <span className="block text-sm font-bold text-slate-800 border-b border-slate-100 pb-1">{pump?.manufacturer || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t('p5.pumpModel')}</span>
                                    <span className="block text-sm font-bold text-slate-800 border-b border-slate-100 pb-1">{pump?.model || '-'} ({pump?.series})</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t('p5.stages')}</span>
                                    <span className="block text-sm font-bold text-slate-800 border-b border-slate-100 pb-1">{pump?.stages || 0}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t('p5.designFreq')}</span>
                                    <span className="block text-sm font-bold text-slate-800 border-b border-slate-100 pb-1">{freq} Hz</span>
                                </div>
                                <div className="col-span-2 pt-2">
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t('p5.selMotor')}</span>
                                    <span className="block text-sm font-bold text-slate-800 border-b border-slate-100 pb-1">
                                        {motor?.manufacturer || 'Generic'} - {motor?.model || 'Standard'} ({motor?.hp || params.motorHp} HP, {motor?.voltage || '-'}V)
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="w-[180px] bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col">
                            <div className="flex-1 relative bg-slate-900 rounded overflow-hidden">
                                 <VisualESPStack pump={pump} motor={motor} params={params} results={results} frequency={freq} />
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 text-center uppercase mt-1 tracking-wider">{t('p5.sysSchematic')}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export interface SolutionCandidate { pump: EspPump; stages: number; hz: number; requiredBrakeHp: number; motor?: EspMotor; score: number; efficiency: number; }

interface Phase5Props { params: SystemParams; setParams: React.Dispatch<React.SetStateAction<SystemParams>>; customPump: EspPump | null; setCustomPump: React.Dispatch<React.SetStateAction<EspPump | null>>; pumpCatalog: EspPump[]; motorCatalog: EspMotor[]; setShowPumpModal: (show: boolean) => void; curveData: any[]; match: any; results: any; }

export const Phase5: React.FC<Phase5Props> = ({ params, setParams, customPump, setCustomPump, pumpCatalog, motorCatalog, setShowPumpModal, curveData, match, results }) => {
    const { t } = useLanguage();
    const [showAIModal, setShowAIModal] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [activeChart, setActiveChart] = useState<'pump' | 'motor'>('pump');
    const [selectionTab, setSelectionTab] = useState<'ai' | 'manual' | 'motors'>('manual');
    const [useStandardPumps, setUseStandardPumps] = useState(true);
    const [useStandardLibrary, setUseStandardLibrary] = useState(true);
    const [pumpVendorFilter, setPumpVendorFilter] = useState('ALL');
    const [motorVendorFilter, setMotorVendorFilter] = useState('ALL');
    const [solutionList, setSolutionList] = useState<SolutionCandidate[]>([]);

    const frequency = params.targets[params.activeScenario].frequency;
    const reqTdh = calculateTDH(params.pressures.totalRate, params);
    const targetFlow = params.pressures.totalRate;
    const currentFlow = match?.flow || 0;
    const isFlowTargetMet = targetFlow > 0 ? Math.abs(currentFlow - targetFlow) / targetFlow < 0.025 : true;
    const targetHead = reqTdh;
    const currentHead = match?.head || 0;
    const isHeadTargetMet = targetHead > 0 ? Math.abs(currentHead - targetHead) / targetHead < 0.025 : true;

    // Turpin Status for Display
    const gasStatus = results.gasAnalysis?.status || 'Stable';
    const gasVoid = results.gasAnalysis?.voidFraction || 0;
    const isGasCritical = gasStatus !== 'Stable';

    const updateFrequency = (val: number) => { 
        let safeVal = Math.min(120, Math.max(30, val));
        setParams(prev => ({ ...prev, targets: { ...prev.targets, [prev.activeScenario]: { ...prev.targets[prev.activeScenario], frequency: safeVal } } })); 
    };
    const switchScenario = (scen: 'min' | 'target' | 'max') => { const data = params.targets[scen]; setParams(prev => ({ ...prev, activeScenario: scen, pressures: { ...prev.pressures, totalRate: data.rate }, inflow: { ...prev.inflow, ip: data.ip }, fluids: { ...prev.fluids, waterCut: data.waterCut, gor: data.gor, glr: data.gor * (1 - data.waterCut / 100) } })); };
    const handleExportProject = () => { const projectData = { type: "esp-studio-project", version: "1.0", timestamp: new Date().toISOString(), data: { params, customPump, frequency, results } }; const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `ESP_Design_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
    
    // --- EXPERT AI LOGIC ---
    const runAIOptimization = (source: 'standard' | 'imported') => { 
        const activePumpCatalog = source === 'standard' ? STANDARD_PUMPS : pumpCatalog; 
        const activeMotorCatalog = source === 'standard' ? STANDARD_MOTORS : motorCatalog; 
        const validPumps = activePumpCatalog.filter(p => p && p.id); 
        const validMotors = activeMotorCatalog.filter(m => m && m.id); 
        
        if (validPumps.length === 0) { alert("Empty database. Please import a catalog first."); setShowPumpModal(true); setShowAIModal(false); return; } 
        
        setShowAIModal(false); 
        setSelectionTab('ai'); 
        
        const targetFlow = params.pressures.totalRate; 
        const targetTDH = calculateTDH(targetFlow, params); 
        const solutions: SolutionCandidate[] = []; 
        const availableMotors = validMotors.length > 0 ? validMotors : [30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000].map(hp => ({ hp } as EspMotor)); 
        const sortedMotors = [...availableMotors].sort((a,b) => a.hp - b.hp); 
        
        // Casing Constraint
        const casingID = params.wellbore.casing.id;

        validPumps.forEach(pump => { 
            // 1. Casing Check (Generic Check if series provided)
            let pumpOD = 4.00; // Default
            if(pump.series.includes("338")) pumpOD = 3.38;
            if(pump.series.includes("400")) pumpOD = 4.00;
            if(pump.series.includes("538")) pumpOD = 5.38;
            if (pumpOD > casingID * 0.95) return; // Constraint check

            // 2. Flow Range Check
            if (targetFlow < pump.minRate * 0.4 || targetFlow > pump.maxRate * 1.6) return; 
            
            const baseFreq = pump.nameplateFrequency || 60; 
            
            // Loop through frequencies to find best match
            for (let f = 40; f <= 70; f += 1) { 
                const ratio = f / baseFreq; 
                const qBase = targetFlow / ratio; 
                const hBase = calculateBaseHead(qBase, pump);
                
                if (hBase <= 0) continue; 
                
                const requiredStages = Math.ceil(targetTDH / (hBase * Math.pow(ratio, 2))); 
                if (requiredStages < 1) continue; 
                
                // Ensure pump operates within ROR at this frequency
                const minQ = pump.minRate * ratio; 
                const maxQ = pump.maxRate * ratio; 
                if (targetFlow < minQ || targetFlow > maxQ) continue; 
                
                // Set default housing count based on limit
                const limit = pump.maxStagesPerBody || 100;
                const bodies = Math.ceil(requiredStages / limit);

                const tempPump = { ...pump, stages: requiredStages, housingCount: bodies }; 
                const res = calculateSystemResults(targetFlow, targetTDH, params, tempPump, f); 
                const requiredBrakeHp = res.hpTotal; 
                
                if (requiredBrakeHp <= 0) continue; 
                
                // Smart Motor Selection (1.15 Safety Factor)
                const requiredMotorHp = requiredBrakeHp * 1.15; 
                const suitableMotor = sortedMotors.find(m => m.hp >= requiredMotorHp); 
                if (!suitableMotor) continue; 
                
                // Scoring: Efficiency (60%) + Hz Closeness to 60 (40%)
                const bepScaled = pump.bepRate * ratio; 
                const distBep = Math.abs(targetFlow - bepScaled) / bepScaled; 
                let effScore = (1 - distBep) * 100; 
                if (effScore < 0) effScore = 0; 
                const hzDev = Math.abs(60 - f); 
                const hzScore = 100 - (hzDev * 4); 
                const totalScore = (effScore * 0.6) + (hzScore * 0.4); 
                
                solutions.push({ pump, stages: requiredStages, hz: f, requiredBrakeHp: requiredBrakeHp, motor: suitableMotor, score: totalScore, efficiency: res.effEstimated || 0 }); 
            } 
        }); 
        
        const topSolutions = solutions.sort((a,b) => b.score - a.score).slice(0, 10); 
        setSolutionList(topSolutions); 
        if (topSolutions.length > 0) applySolution(topSolutions[0]); 
    };

    const applySolution = (sol: SolutionCandidate) => { 
        const limit = sol.pump.maxStagesPerBody || 100;
        const bodies = Math.ceil(sol.stages / limit);
        setCustomPump({...sol.pump, stages: sol.stages, housingCount: bodies}); 
        updateFrequency(sol.hz); 
        setParams(p => ({ ...p, motorHp: sol.motor?.hp || 0, selectedMotor: sol.motor })); 
    };
    
    const handleManualSelect = (item: any) => { 
        const newStages = item.reqStages > 0 ? item.reqStages : 100; 
        const limit = item.pump.maxStagesPerBody || 100;
        const bodies = Math.ceil(newStages / limit);
        const tempPump = { ...item.pump, stages: newStages, housingCount: bodies }; 
        
        const res = calculateSystemResults(params.pressures.totalRate, calculateTDH(params.pressures.totalRate, params), params, tempPump, 60); 
        const reqHp = res.hpTotal * 1.15; 
        const sourceCatalog = useStandardLibrary ? STANDARD_MOTORS : (motorCatalog || []); 
        const validSourceCatalog = sourceCatalog.filter(m => m && m.id); 
        const motor = validSourceCatalog.find(m => m.hp >= reqHp) || validSourceCatalog[validSourceCatalog.length-1]; 
        
        setCustomPump(tempPump); 
        updateFrequency(60); 
        setParams(p => ({ ...p, motorHp: motor?.hp || p.motorHp, selectedMotor: motor })); 
    };
    
    const handleMotorSelect = (motor: EspMotor) => { setParams(p => ({ ...p, motorHp: motor.hp, selectedMotor: motor })); };
    const manualList = useMemo(() => { const targetFlow = params.pressures.totalRate; const targetTDH = calculateTDH(targetFlow, params); const activeList = useStandardPumps ? STANDARD_PUMPS : pumpCatalog; const filtered = activeList.filter(p => p && (pumpVendorFilter === 'ALL' || p.manufacturer === pumpVendorFilter)); return filtered.map(pump => { const baseFreq = pump.nameplateFrequency || 60; const minFreq = 40; const maxFreq = 70; const minCapacity = pump.minRate * (minFreq / baseFreq); const maxCapacity = pump.maxRate * (maxFreq / baseFreq); const isViable = targetFlow >= minCapacity && targetFlow <= maxCapacity; const ratio = 60 / baseFreq; const qBase = targetFlow / ratio; const hBase = pump.h0 + pump.h1*qBase + pump.h2*Math.pow(qBase,2) + pump.h3*Math.pow(qBase,3) + pump.h4*Math.pow(qBase,4) + pump.h5*Math.pow(qBase,5); let reqStages = 0; if (hBase > 0) reqStages = Math.ceil(targetTDH / (hBase * Math.pow(ratio, 2))); return { pump, isViable, minCap: minCapacity, maxCap: maxCapacity, reqStages }; }); }, [pumpCatalog, params.pressures.totalRate, params, useStandardPumps, pumpVendorFilter]);
    const motorList = useMemo(() => { let filtered = useStandardLibrary ? [...STANDARD_MOTORS] : [...(motorCatalog || [])].filter(m => m && m.id); if (motorVendorFilter !== 'ALL') filtered = filtered.filter(m => m.manufacturer === motorVendorFilter); return filtered.sort((a,b) => a.hp - b.hp); }, [motorCatalog, useStandardLibrary, motorVendorFilter]);
    const tabClass = (active: boolean, color: string) => `flex-1 py-5 text-sm font-black uppercase tracking-widest transition-all relative overflow-hidden group ${active ? 'text-' + color + '-400 bg-surface-light' : 'text-txt-muted hover:bg-surface-light/50 hover:text-txt-main'}`;
    const indicatorClass = (active: boolean, color: string) => `absolute bottom-0 left-0 w-full h-1.5 transition-all ${active ? 'bg-' + color + '-500' : 'bg-transparent'}`;

    const housingCount = customPump?.housingCount || 1;
    const stagesPerHousing = customPump?.stages ? Math.round(customPump.stages / housingCount) : 0;

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-8 animate-fadeIn pb-6">
            <AISourceModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} onSelectSource={runAIOptimization} />
            {showReport && <ReportView onClose={() => setShowReport(false)} params={params} results={results} pump={customPump} motor={params.selectedMotor} freq={params.targets[params.activeScenario].frequency} curveData={curveData} match={match} scenarioLabel={params.activeScenario.toUpperCase()} />}
            <div className="flex justify-between items-center bg-surface p-8 rounded-[40px] border border-surface-light shadow-lg">
                <div className="flex items-center gap-6"><div className="p-4 bg-purple-500/10 rounded-3xl border border-purple-500/20"><Cpu className="w-10 h-10 text-purple-500" /></div><div><h2 className="text-2xl font-black text-txt-main uppercase tracking-tight">{t('p5.equipped')}</h2><p className="text-base font-medium text-txt-muted">{t('p5.solver')}</p></div></div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowPumpModal(true)} className="bg-surface-light hover:bg-surface-light/80 text-txt-muted hover:text-white px-6 py-4 rounded-2xl text-sm font-bold uppercase transition-all flex items-center gap-3 border border-surface-light hover:border-surface-light/80"><Database className="w-6 h-6" /> {t('p5.loadDb')}</button>
                    <button onClick={handleExportProject} className="bg-surface-light hover:bg-surface-light/80 text-txt-muted hover:text-white px-6 py-4 rounded-2xl text-sm font-bold uppercase transition-all flex items-center gap-3 border border-surface-light hover:border-surface-light/80"><Save className="w-6 h-6" /> {t('p5.save')}</button>
                    <button onClick={() => setShowReport(true)} className="bg-surface-light hover:bg-surface-light/80 text-txt-main hover:text-white px-6 py-4 rounded-2xl text-sm font-bold uppercase flex items-center gap-3 border border-surface-light transition-all"><Printer className="w-6 h-6" /> {t('p5.report')}</button>
                    <div className="w-px h-12 bg-surface-light mx-2"></div>
                    <button onClick={() => setShowAIModal(true)} className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl text-sm font-bold uppercase flex items-center gap-3 shadow-lg shadow-primary/20 transition-all"><Sparkles className="w-6 h-6" /> {t('p5.auto')}</button>
                </div>
            </div>
            <div className="grid grid-cols-5 gap-8">
                {/* UPDATED: Uses 'primary' color logic for active match */}
                <KPICard label={t('kpi.activeProd')} value={match?.flow?.toLocaleString() || '-'} unit="BPD" subValue={`${t('kpi.target')}: ${params.pressures.totalRate} BPD`} icon={Droplets} colorClass={isFlowTargetMet ? "primary" : "blue"} highlight={true} glow={isFlowTargetMet} />
                <KPICard label={t('kpi.genHead')} value={match?.head?.toLocaleString() || '-'} unit="FT" subValue={`${t('kpi.required')}: ${reqTdh.toFixed(0)} FT`} icon={Activity} colorClass={isHeadTargetMet ? "primary" : "cyan"} highlight={true} glow={isHeadTargetMet} />
                
                <KPICard label={t('kpi.sysEff')} value={results.effEstimated?.toFixed(1) || '-'} unit="%" icon={Zap} colorClass="amber" />
                <KPICard label={t('kpi.power')} value={results.electrical?.kw?.toFixed(1) || '-'} unit="kW" subValue={`${results.electrical?.kva?.toFixed(1)} kVA`} icon={Cpu} colorClass="purple" />
                {/* GAS ANALYSIS CARD */}
                <KPICard 
                    label={t('kpi.gas')} 
                    value={(gasVoid * 100).toFixed(1)} 
                    unit="%" 
                    subValue={gasStatus} 
                    icon={Flame} 
                    colorClass={gasStatus === 'Stable' ? 'slate' : gasStatus === 'Gas Lock Risk' ? 'red' : 'yellow'} 
                    highlight={isGasCritical}
                    glow={isGasCritical}
                />
            </div>
            <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-3">
                    <div className="bg-surface p-8 rounded-[40px] border border-surface-light shadow-sm space-y-6 relative overflow-hidden group">
                         <div className="absolute top-0 left-0 w-2 h-full bg-secondary shadow-[0_0_10px_rgba(var(--color-secondary),0.5)]"></div>
                         <div className="flex justify-between items-center border-b border-surface-light pb-4"><h4 className="text-sm font-black text-txt-muted uppercase tracking-widest">{t('p5.equipped')}</h4><div className="flex bg-canvas p-1.5 rounded-xl border border-surface-light">{['min', 'target', 'max'].map((s) => (<button key={s} onClick={() => switchScenario(s as any)} className={`px-4 py-1.5 text-xs font-black uppercase rounded-lg transition-colors ${params.activeScenario === s ? 'bg-primary text-white' : 'text-txt-muted hover:text-txt-main'}`}>{s === 'min' ? 'MIN' : s === 'target' ? 'OBJ' : 'MAX'}</button>))}</div></div>
                         <div className="space-y-4"><div className="flex justify-between items-center bg-canvas p-4 rounded-2xl border border-surface-light"><div><span className="text-xs text-secondary font-bold uppercase block mb-1">{t('p5.pump')}</span><div className="text-base font-black text-txt-main truncate max-w-[160px]">{customPump?.model || 'None'}</div></div><div className="text-right"><span className="text-xs text-txt-muted font-bold block mb-1">{customPump?.stages || 0} Stgs</span><div className="text-base font-black text-txt-muted">{frequency.toFixed(1)} Hz</div></div></div><div className="flex justify-between items-center bg-canvas p-4 rounded-2xl border border-surface-light"><div><span className="text-xs text-amber-500 font-bold uppercase block mb-1">{t('p5.motor')}</span><div className="text-base font-black text-txt-main truncate max-w-[160px]">{params.selectedMotor?.model || 'Generic'}</div></div><div className="text-right"><span className="text-xs text-txt-muted font-bold block mb-1">{t('p5.rating')}</span><div className="text-base font-black text-txt-muted">{params.selectedMotor?.hp || params.motorHp} HP</div></div></div></div>
                         
                         {customPump && (
                             <div className="pt-4 border-t border-surface-light space-y-6 animate-fadeIn">
                                 {/* Frequency Control - MANUAL INPUT */}
                                 <div className="flex items-center gap-4 bg-canvas p-4 rounded-2xl border border-surface-light focus-within:border-secondary transition-colors">
                                     <div className="flex-1">
                                         <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block mb-1">{t('p5.freq')} (Hz)</label>
                                         <input 
                                            type="number" 
                                            min="30" max="90" step="0.1" 
                                            value={frequency} 
                                            onChange={(e) => updateFrequency(parseFloat(e.target.value))} 
                                            className="w-full bg-transparent text-xl font-black text-secondary outline-none font-mono"
                                         />
                                     </div>
                                     <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Activity className="w-5 h-5"/></div>
                                 </div>

                                 {/* Pump Config: Stages & Bodies Calculation */}
                                 <div className="bg-canvas p-4 rounded-2xl border border-surface-light space-y-4">
                                     <div className="flex flex-col gap-2">
                                         <label className="text-xs font-bold text-txt-muted uppercase tracking-wider">{t('p5.stages')}</label>
                                         <input 
                                            type="number" step="1" min="1" 
                                            value={customPump.stages} 
                                            onChange={(e) => {
                                                const s = parseInt(e.target.value) || 0;
                                                const limit = customPump.maxStagesPerBody || 100;
                                                const bodies = Math.ceil(s / limit);
                                                setCustomPump({...customPump, stages: s, housingCount: bodies});
                                            }} 
                                            className="w-full bg-surface border border-surface-light rounded-xl px-4 py-3 text-lg font-black text-txt-main outline-none focus:border-secondary" 
                                         />
                                     </div>
                                     
                                     <div className="flex gap-4">
                                         <div className="flex-1">
                                             <label className="text-[9px] font-bold text-txt-muted uppercase tracking-wider block mb-2">{t('p5.maxStagesBody')}</label>
                                             <div className="bg-surface p-2 rounded-xl border border-surface-light flex items-center">
                                                 <input 
                                                    type="number" 
                                                    value={customPump.maxStagesPerBody || 100}
                                                    onChange={(e) => {
                                                        const limit = parseInt(e.target.value) || 100;
                                                        const bodies = Math.ceil((customPump.stages || 0) / limit);
                                                        setCustomPump({...customPump, maxStagesPerBody: limit, housingCount: bodies});
                                                    }}
                                                    className="w-full bg-transparent text-sm font-black text-txt-main outline-none text-center"
                                                 />
                                             </div>
                                         </div>
                                         <div className="flex-1 border-l border-surface-light pl-4 flex flex-col justify-center">
                                             <label className="text-[9px] font-bold text-txt-muted uppercase tracking-wider block mb-1">{t('p5.bodiesReq')}</label>
                                             <div className="text-xl font-black text-secondary">{housingCount}</div>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         )}
                    </div>
                    <div className="bg-surface rounded-[40px] border border-surface-light shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="flex border-b border-surface-light bg-canvas/50"><button onClick={() => setSelectionTab('manual')} className={tabClass(selectionTab === 'manual', 'blue')}>{t('p5.pumps')}<div className={indicatorClass(selectionTab === 'manual', 'blue')}></div></button><button onClick={() => setSelectionTab('motors')} className={tabClass(selectionTab === 'motors', 'amber')}>{t('p5.motors')}<div className={indicatorClass(selectionTab === 'motors', 'amber')}></div></button><button onClick={() => setSelectionTab('ai')} className={tabClass(selectionTab === 'ai', 'indigo')}>AI<div className={indicatorClass(selectionTab === 'ai', 'indigo')}></div></button></div>
                        {(selectionTab === 'manual' || selectionTab === 'motors') && (<div className="px-4 py-4 border-b border-surface-light flex gap-4 bg-surface"><button onClick={() => selectionTab === 'manual' ? setUseStandardPumps(true) : setUseStandardLibrary(true)} className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-3 ${(selectionTab === 'manual' ? useStandardPumps : useStandardLibrary) ? 'bg-surface-light text-white shadow-sm border border-surface-light' : 'text-txt-muted hover:bg-surface-light/50'}`}><Server className="w-5 h-5" /> {t('p5.standard')}</button><button onClick={() => selectionTab === 'manual' ? setUseStandardPumps(false) : setUseStandardLibrary(false)} className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-3 ${!(selectionTab === 'manual' ? useStandardPumps : useStandardLibrary) ? 'bg-blue-900/30 text-blue-300 border border-blue-500/30 shadow-sm' : 'text-txt-muted hover:bg-surface-light/50'}`}><UploadCloud className="w-5 h-5" /> {t('p5.imported')} <span className="opacity-50">({selectionTab === 'manual' ? (pumpCatalog?.length || 0) : (motorCatalog?.length || 0)})</span></button></div>)}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-canvas/30 custom-scrollbar">
                            {selectionTab === 'manual' && manualList.map((item, idx) => (<button key={idx} onClick={() => handleManualSelect(item)} className={`w-full p-4 rounded-3xl border text-left transition-all group flex justify-between items-center ${item.pump.id === customPump?.id ? 'bg-primary/20 border-primary/50' : 'bg-surface border-surface-light hover:border-surface-light/80'}`}><div><div className={`font-black text-sm uppercase ${item.isViable ? 'text-txt-main' : 'text-txt-muted'}`}>{item.pump.model}</div><div className="text-xs text-txt-muted mt-1 font-medium">{item.pump.series} • {item.reqStages} Stgs</div></div><div className={`w-3 h-3 rounded-full ${item.isViable ? 'bg-emerald-500' : 'bg-red-500'}`}></div></button>))}
                            {selectionTab === 'motors' && motorList.map((motor, idx) => (<button key={idx} onClick={() => { handleMotorSelect(motor); setActiveChart('motor'); }} className={`w-full p-4 rounded-3xl border text-left transition-all group flex justify-between items-center ${params.selectedMotor?.id === motor.id ? 'bg-secondary/20 border-secondary/50' : 'bg-surface border-surface-light hover:border-surface-light/80'}`}><div><div className="font-black text-sm uppercase text-txt-main">{motor.model}</div><div className="text-xs text-txt-muted mt-1 font-medium">{motor.hp} HP • {motor.voltage}V</div></div><Zap className="w-5 h-5 text-amber-500 opacity-50" /></button>))}
                            {selectionTab === 'ai' && solutionList.map((sol, idx) => (<button key={idx} onClick={() => applySolution(sol)} className={`w-full p-4 rounded-3xl border text-left transition-all group flex justify-between items-center ${sol.pump.id === customPump?.id && sol.hz === frequency ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-surface border-surface-light hover:border-surface-light/80'}`}><div><div className="font-black text-sm uppercase text-txt-main">{sol.pump.model}</div><div className="text-xs text-txt-muted mt-1 font-medium">{sol.stages} Stgs • {sol.hz.toFixed(1)} Hz</div></div><div className="text-sm font-bold text-indigo-400">{sol.score.toFixed(0)}%</div></button>))}
                        </div>
                    </div>
                </div>
                <div className="col-span-12 lg:col-span-6 flex flex-col gap-8 h-full overflow-hidden">
                    <div className="flex bg-surface p-2 rounded-3xl border border-surface-light shrink-0"><button onClick={() => setActiveChart('pump')} className={`flex-1 py-3 rounded-2xl text-sm font-black uppercase transition-all flex items-center justify-center gap-3 ${activeChart === 'pump' ? 'bg-primary text-white shadow-lg' : 'text-txt-muted hover:text-txt-main'}`}><Activity className="w-6 h-6" /> {t('p5.perfCurve')}</button><button onClick={() => setActiveChart('motor')} className={`flex-1 py-3 rounded-2xl text-sm font-black uppercase transition-all flex items-center justify-center gap-3 ${activeChart === 'motor' ? 'bg-secondary text-white shadow-lg' : 'text-txt-muted hover:text-txt-main'}`}><Zap className="w-6 h-6" /> {t('p5.motorCurve')}</button></div>
                    <div className="flex-1 bg-surface rounded-[48px] border border-surface-light shadow-xl overflow-hidden p-4 relative flex flex-col min-h-[450px]">{activeChart === 'pump' && customPump ? (<PumpChart data={curveData} pump={customPump} currentFrequency={params.targets[params.activeScenario].frequency} intersectionPoint={match} targetFlow={params.pressures.totalRate} className="w-full h-full" />) : activeChart === 'motor' ? (<MotorChart motor={params.selectedMotor} currentLoadPct={results.motorLoad || 0} />) : (<div className="flex-1 flex items-center justify-center text-txt-muted font-bold uppercase tracking-widest text-lg">{t('p5.selectEq')}</div>)}</div>
                    <div className="h-40 bg-surface rounded-[40px] border border-surface-light p-8 grid grid-cols-4 gap-8 shadow-lg shrink-0">
                        <div className="flex flex-col justify-center border-r border-surface-light pr-6"><span className="text-sm font-bold text-txt-muted uppercase mb-2">{t('p5.motorAmps')}</span><div className="text-4xl font-black text-amber-400 font-mono">{results.electrical?.amps.toFixed(1)} <span className="text-sm text-txt-muted">A</span></div></div>
                        <div className="flex flex-col justify-center border-r border-surface-light pr-6"><span className="text-sm font-bold text-txt-muted uppercase mb-2">{t('p5.motorVolts')}</span><div className="text-4xl font-black text-yellow-400 font-mono">{results.electrical?.volts.toFixed(0)} <span className="text-sm text-txt-muted">V</span></div></div>
                        <div className="flex flex-col justify-center border-r border-surface-light pr-6"><span className="text-sm font-bold text-txt-muted uppercase mb-2">{t('p5.powerDraw')}</span><div className="text-4xl font-black text-purple-400 font-mono">{results.electrical?.kva.toFixed(1)} <span className="text-sm text-txt-muted">kVA</span></div></div>
                        <div className="flex flex-col justify-center"><span className="text-sm font-bold text-txt-muted uppercase mb-2">{t('p5.cableLoss')}</span><div className="text-4xl font-black text-red-400 font-mono">{results.electrical?.voltDrop.toFixed(0)} <span className="text-sm text-txt-muted">V</span></div></div>
                    </div>
                </div>
                <div className="col-span-12 lg:col-span-3 flex flex-col h-full overflow-hidden bg-surface rounded-[48px] border border-surface-light shadow-2xl relative">
                    <div className="absolute top-0 left-0 w-full p-6 z-20 flex justify-between items-start pointer-events-none"><div className="bg-surface/80 backdrop-blur border border-surface-light rounded-full px-5 py-2"><span className="text-xs font-black text-txt-main uppercase tracking-widest">{t('vis.bha')}</span></div><div className="bg-surface/80 backdrop-blur border border-surface-light rounded-2xl p-4 flex flex-col items-end"><span className="text-xs font-bold text-txt-muted uppercase">{t('vis.intakeT')}</span><span className="text-base font-black text-orange-400 font-mono">{(params.bottomholeTemp).toFixed(0)}°F</span></div></div>
                    <div className="flex-1 w-full relative"><VisualESPStack pump={customPump} motor={params.selectedMotor} params={params} results={results} frequency={params.targets[params.activeScenario].frequency} /></div>
                    <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-4 z-20">
                        <div className="bg-surface/90 backdrop-blur border border-surface-light p-5 rounded-3xl flex justify-between items-center shadow-lg"><div className="flex items-center gap-4"><div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-sm font-bold text-txt-main uppercase">PIP</span></div><span className="text-2xl font-black text-emerald-400 font-mono">{results.pip?.toFixed(0)} <span className="text-xs text-txt-muted">psi</span></span></div>
                        <div className="bg-surface/90 backdrop-blur border border-surface-light p-5 rounded-3xl flex justify-between items-center shadow-lg"><div className="flex items-center gap-4"><div className="w-3 h-3 rounded-full bg-secondary"></div><span className="text-sm font-bold text-txt-main uppercase">{t('tele.sub')}</span></div><span className="text-2xl font-black text-secondary font-mono">{(params.pressures.pumpDepthMD - results.fluidLevel).toFixed(0)} <span className="text-xs text-txt-muted">ft</span></span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
