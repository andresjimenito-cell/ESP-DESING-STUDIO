
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  generateMultiCurveData, findIntersection, calculateSystemResults, calculateTDH, enforcePVTConsistency, calculateAOF
} from './utils';
import { PumpImportModal } from './components/PumpImportModal';
import { LandingPage } from './components/LandingPage';
import { Phase1 } from './components/Phase1';
import { Phase2 } from './components/Phase2';
import { Phase3 } from './components/Phase3';
import { PhaseScenarios } from './components/PhaseScenarios';
import { Phase5 } from './components/Phase5';
import { PhaseSimulations } from './components/PhaseSimulations';
import { Phase6 } from './components/Phase6';
import { TUBING_CATALOG, CASING_CATALOG } from './data';
import { 
  Activity, RotateCcw, Ruler, Droplets, Target, Hexagon, CheckCircle2, Clock, ClipboardCheck, Maximize, Minimize, Globe, AlertCircle, Sparkles, RefreshCw, Send, ChevronDown, ChevronRight, AlertTriangle, Layers
} from 'lucide-react';
import { EspPump, EspMotor, SystemParams, SurveyPoint } from './types';
import { useLanguage } from '../i18n';
import { useEspCopilot } from './hooks/useEspCopilot';

const INITIAL_SURVEY: SurveyPoint[] = [];

const INITIAL_PARAMS: SystemParams = {
  metadata: {
      projectName: 'New Design 001',
      wellName: 'Well-X',
      engineer: '',
      company: '',
      date: new Date().toISOString().split('T')[0],
      comments: ''
  },
  wellbore: {
    correlation: 'Hagedorn-Brown',
    casing: CASING_CATALOG[0], 
    tubing: TUBING_CATALOG[0],
    casingTop: 0, casingBottom: 0,
    tubingTop: 0, tubingBottom: 0,
    midPerfsMD: 0 
  },
  fluids: {
    apiOil: 0, geGas: 0, waterCut: 0, geWater: 1.0, salinity: 0, pb: 0, gor: 0, glr: 0, 
    isDeadOil: false, co2: 0, h2s: 0, n2: 0, sandCut: 0, sandDensity: 2.65,
    pvtCorrelation: 'Standing', viscosityModel: 'Total Fluid',
    correlations: {
      viscDeadOil: 'Beggs-Robinson', viscSatOil: 'Beggs-Robinson', viscUnsatOil: 'Vasquez-Beggs',
      viscGas: 'Lee', viscWater: 'Matthews & Russell', oilDensity: 'Katz', pbRs: 'Lasater',
      oilComp: 'Vasquez-Beggs', oilFvf: 'Vasquez-Beggs', zFactor: 'Dranchuk-Abu-Kassem'
    }
  },
  inflow: {
    model: 'Productivity Index', staticSource: 'BHP', pStatic: 0, staticLevel: 0, ip: 0
  },
  pressures: { totalRate: 0, pht: 0, phc: 0, pumpDepthMD: 0 },
  targets: {
      min: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 50 },
      target: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 60 },
      max: { rate: 0, ip: 0, waterCut: 0, gor: 0, frequency: 60 }
  },
  activeScenario: 'target',
  surfaceTemp: 0, bottomholeTemp: 0, totalDepthMD: 0, survey: INITIAL_SURVEY, motorHp: 0,
  simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0 }
};

// --- ADVANCED MARKDOWN RENDERER ---
const MarkdownRenderer = ({ content }: { content: string }) => {
    // Helper to process inline formatting (bold, math, code)
    const processInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\$.*?\$|`.*?`)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-txt-main font-black">{part.slice(2, -2)}</strong>;
            if (part.startsWith('$') && part.endsWith('$')) return <span key={i} className="text-secondary font-mono bg-secondary/10 px-1 rounded mx-1">{part.slice(1, -1)}</span>;
            if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="text-primary font-mono bg-surface-light px-1 rounded">{part.slice(1, -1)}</code>;
            return <span key={i}>{part}</span>;
        });
    };

    // Split by lines
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    const flushTable = (keyPrefix: string) => {
        if (tableBuffer.length === 0) return null;
        const rows = tableBuffer.map(row => row.split('|').filter(c => c.trim() !== '').map(c => c.trim()));
        const header = rows[0];
        const body = rows.slice(2); // Skip separator row
        
        const table = (
            <div key={keyPrefix} className="my-4 overflow-hidden rounded-xl border border-surface-light shadow-sm">
                <table className="w-full text-xs text-left">
                    <thead className="bg-surface-light text-txt-muted uppercase font-black">
                        <tr>{header.map((h, i) => <th key={i} className="px-4 py-3">{processInline(h)}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-surface-light bg-surface/50">
                        {body.map((row, i) => (
                            <tr key={i} className="hover:bg-surface-light/50 transition-colors">
                                {row.map((cell, j) => (
                                    <td key={j} className={`px-4 py-2 font-medium ${j===0 ? 'text-primary font-bold' : 'text-txt-muted'}`}>
                                        {processInline(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
        tableBuffer = [];
        inTable = false;
        return table;
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Handle Table Lines
        if (trimmed.startsWith('|')) {
            inTable = true;
            tableBuffer.push(trimmed);
            // If it's the last line, flush
            if (index === lines.length - 1) elements.push(flushTable(`tbl-${index}`));
            return;
        } else if (inTable) {
            elements.push(flushTable(`tbl-${index}`));
        }

        // Headers
        if (trimmed.startsWith('###')) {
            elements.push(<h4 key={index} className="text-sm font-black text-primary uppercase tracking-widest mt-6 mb-2 border-b border-surface-light pb-1">{trimmed.replace(/^###\s*/, '')}</h4>);
        } else if (trimmed.startsWith('##')) {
            elements.push(<h3 key={index} className="text-base font-black text-txt-main mt-8 mb-3 flex items-center gap-2"><div className="w-1 h-4 bg-primary rounded-full"></div>{trimmed.replace(/^##\s*/, '')}</h3>);
        } else if (trimmed.startsWith('#')) {
            elements.push(<h2 key={index} className="text-xl font-black text-txt-main mt-4 mb-4 tracking-tight">{trimmed.replace(/^#\s*/, '')}</h2>);
        }
        // Lists
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            elements.push(<div key={index} className="flex gap-3 ml-2 mb-1 text-txt-muted"><span className="text-primary font-bold mt-1.5">•</span><span className="leading-relaxed">{processInline(trimmed.substring(2))}</span></div>);
        }
        else if (/^\d+\./.test(trimmed)) {
             elements.push(<div key={index} className="flex gap-3 ml-2 mb-1 text-txt-muted"><span className="text-secondary font-bold mt-0.5 min-w-[20px]">{trimmed.split('.')[0]}.</span><span className="leading-relaxed">{processInline(trimmed.replace(/^\d+\.\s*/, ''))}</span></div>);
        }
        // Empty lines
        else if (trimmed === '') {
            elements.push(<div key={index} className="h-2"></div>);
        }
        // Paragraphs
        else {
            elements.push(<p key={index} className="text-txt-muted leading-relaxed mb-1 text-xs">{processInline(trimmed)}</p>);
        }
    });

    // Flush table if leftover
    if (inTable) elements.push(flushTable(`tbl-end`));

    return <div className="space-y-1">{elements}</div>;
};

const App: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [appMode, setAppMode] = useState<'landing' | 'main'>('landing');
  const [activeStep, setActiveStep] = useState(0);
  const [showPumpModal, setShowPumpModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // AI Controls
  const [aiScope, setAiScope] = useState<number | 'current'>('current');
  const [userInput, setUserInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [params, setParams] = useState<SystemParams>(INITIAL_PARAMS);
  const [customPump, setCustomPump] = useState<EspPump | null>(null);
  const [rawSurvey, setRawSurvey] = useState('');
  const [toast, setToast] = useState<{msg: string, show: boolean, type?: 'info'|'warning'}>({msg: '', show: false});
  const [pumpCatalog, setPumpCatalog] = useState<EspPump[]>([]); 
  const [motorCatalog, setMotorCatalog] = useState<EspMotor[]>([]); 

  // Calculations
  const currentFrequency = params.targets[params.activeScenario].frequency;
  const curveData = useMemo(() => customPump ? generateMultiCurveData(customPump, params, currentFrequency) : [], [customPump, params, currentFrequency]);
  const match = useMemo(() => findIntersection(curveData), [curveData]);
  
  const designResults = useMemo(() => calculateSystemResults(params.pressures.totalRate, null, params, customPump || { id:'tmp', stages:1, h0:0, h1:0, h2:0, h3:0, h4:0, h5:0, p0:0, p1:0, p2:0, p3:0, p4:0, p5:0, nameplateFrequency:60 } as any, currentFrequency), [params.pressures.totalRate, params, customPump, currentFrequency]);
  const matchResults = useMemo(() => calculateSystemResults(match?.flow || 0, match?.head || 0, params, customPump || { id:'tmp', stages:1, h0:0, h1:0, h2:0, h3:0, h4:0, h5:0, p0:0, p1:0, p2:0, p3:0, p4:0, p5:0, nameplateFrequency:60 } as any, currentFrequency), [match, params, customPump, currentFrequency]);

  // --- REAL AI INTEGRATION ---
  const { messages, loading: aiLoading, sendMessage, analyzePhase } = useEspCopilot(params, designResults, activeStep, customPump);

  // Auto-scroll chat
  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync active step with scope selector automatically
  useEffect(() => {
      setAiScope(activeStep);
  }, [activeStep]);

  const handleSendMessage = () => {
      if (!userInput.trim()) return;
      sendMessage(userInput);
      setUserInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSendMessage();
  };

  const handleRunAnalysis = (scenarioScope: 'min'|'target'|'max'|'all' = 'target') => {
      const targetPhase = aiScope === 'current' ? activeStep : aiScope;
      analyzePhase(targetPhase, scenarioScope);
  };

  // ... (Keep existing effects for PVT, Toast, Sync Targets) ...
  useEffect(() => { if (params.fluids.pb > 0) { const { updated, corrected, minGor } = enforcePVTConsistency(params); if (corrected) { setParams(updated); setToast({ show: true, msg: `PVT AI: GOR corrected to min ${minGor.toFixed(0)} scf/stb to match Bubble Point physics.`, type: 'info' }); } } }, [params.fluids.pb, params.fluids.apiOil, params.fluids.geGas, params.bottomholeTemp, params.fluids.gor]);
  useEffect(() => { if (toast.show) { const timer = setTimeout(() => setToast(prev => ({...prev, show: false})), 5000); return () => clearTimeout(timer); } }, [toast.show]);
  useEffect(() => { setParams(current => { if (current.activeScenario !== 'target') return current; const masterIP = current.inflow.ip; const masterWC = current.fluids.waterCut; const masterGOR = current.fluids.gor; const masterRate = current.pressures.totalRate; const t = current.targets; const isTargetSynced = t.target.ip === masterIP && t.target.waterCut === masterWC && t.target.gor === masterGOR && t.target.rate === masterRate; if (!isTargetSynced) { return { ...current, targets: { ...t, target: { ...t.target, ip: masterIP, waterCut: masterWC, gor: masterGOR, rate: masterRate } } }; } return current; }); }, [params.inflow.ip, params.fluids.waterCut, params.fluids.gor, params.pressures.totalRate, params.activeScenario]);

  const steps = [
    { id: 'wellbore', label: t('nav.wellbore'), sub: t('nav.wellbore.sub'), icon: Ruler },
    { id: 'fluid', label: t('nav.fluids'), sub: t('nav.fluids.sub'), icon: Droplets },
    { id: 'inflow', label: t('nav.inflow'), sub: t('nav.inflow.sub'), icon: Target },
    { id: 'scenarios', label: t('scen.title'), sub: t('scen.sub'), icon: Layers }, 
    { id: 'equipment', label: t('nav.equipment'), sub: t('nav.equipment.sub'), icon: Hexagon },
    { id: 'simulations', label: t('nav.simulations'), sub: t('nav.simulations.sub'), icon: Clock },
    { id: 'match', label: t('nav.match'), sub: t('nav.match.sub'), icon: ClipboardCheck },
  ];

  const handlePumpImport = (pump: EspPump | null, motorHp: number, fullPumpCatalog?: EspPump[], fullMotorCatalog?: EspMotor[]) => { if (fullPumpCatalog?.length) setPumpCatalog(fullPumpCatalog.filter(p => p && p.id)); if (fullMotorCatalog?.length) setMotorCatalog(fullMotorCatalog.filter(m => m && m.id)); if (pump) { setCustomPump(pump); setParams(p => ({...p, motorHp})); } setShowPumpModal(false); };
  const handleProjectImport = (data: { params: SystemParams, customPump: EspPump | null, frequency: number }) => { if (data.params) { const sanitizedParams = { ...data.params, metadata: data.params.metadata || { projectName: 'Imported Project', wellName: '', engineer: '', company: '', date: '', comments: '' } }; setParams(sanitizedParams); if (data.params.survey) setRawSurvey(data.params.survey.map(s => `${s.md}\t${s.tvd}`).join('\n')); } if (data.customPump) setCustomPump(data.customPump); if (data.frequency) setParams(prev => ({ ...prev, targets: { ...prev.targets, target: { ...prev.targets.target, frequency: data.frequency } } })); if (data.customPump && !pumpCatalog.some(p => p && p.id === data.customPump?.id)) setPumpCatalog(prev => [...prev, data.customPump!]); setShowPumpModal(false); };
  const handleLandingFileImport = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { try { const json = JSON.parse(event.target?.result as string); if (json.type === 'esp-studio-project' && json.data) { handleProjectImport(json.data); setAppMode('main'); } else alert("Invalid Project File"); } catch (err) { alert("Error reading file"); } }; reader.readAsText(file); };
  const toggleFullScreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err)); else if (document.exitFullscreen) document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error(err)); };
  const toggleLanguage = () => setLanguage(language === 'en' ? 'es' : 'en');

  // --- LANDING PAGE ---
  if (appMode === 'landing') {
    return (
        <LandingPage 
            onStart={() => setAppMode('main')}
            params={params}
            setParams={setParams}
            language={language}
            toggleLanguage={toggleLanguage}
            onImportFile={handleLandingFileImport}
        />
    );
  }

  // --- MAIN APP ---
  return (
    <div className="flex h-screen bg-canvas font-sans overflow-hidden text-txt-main selection:bg-primary/30 transition-colors duration-500">
      {toast.show && (
          <div className="fixed top-20 right-8 z-[100] animate-fadeIn">
              <div className="bg-surface/95 backdrop-blur-md border border-primary/50 shadow-[0_0_30px_rgba(var(--color-primary),0.3)] px-8 py-6 rounded-2xl flex items-start gap-4 max-w-md">
                  <div className="p-3 bg-primary/20 rounded-full text-primary shrink-0 mt-0.5"><AlertCircle className="w-6 h-6" /></div>
                  <div><h4 className="text-lg font-black text-txt-main uppercase tracking-wide mb-2">System Correction</h4><p className="text-sm font-medium text-txt-muted leading-relaxed">{toast.msg}</p></div>
                  <button onClick={() => setToast(prev => ({...prev, show: false}))} className="text-txt-muted hover:text-txt-main"><div className="w-2 h-2 rounded-full bg-slate-500"></div></button>
              </div>
          </div>
      )}

      <PumpImportModal isOpen={showPumpModal} onClose={() => setShowPumpModal(false)} onSave={handlePumpImport} onImportProject={handleProjectImport} initialPump={customPump} initialMotorHp={params.motorHp} />

      {/* SIDEBAR */}
      <aside className="w-96 bg-surface/50 backdrop-blur-xl border-r border-surface-light flex flex-col z-30 shadow-2xl relative transition-colors duration-500">
        <div className="p-8 border-b border-surface-light flex items-center gap-5">
          <div className="p-4 bg-primary/20 rounded-2xl border border-primary/30"><Activity className="text-primary w-10 h-10" /></div>
          <div><h1 className="font-black text-3xl tracking-tight text-txt-main uppercase leading-none">{t('app.title')}</h1><span className="text-sm font-bold text-txt-muted uppercase tracking-widest">{t('app.subtitle')}</span></div>
        </div>
        
        {/* Navigation */}
        <nav className="p-6 space-y-3 overflow-y-auto custom-scrollbar border-b border-surface-light h-1/3 shrink-0">
          {steps.map((step, idx) => {
            const isActive = activeStep === idx;
            const isCompleted = idx <= activeStep;
            return (
                <button key={step.id} onClick={() => setActiveStep(idx)} className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive ? 'bg-primary/20 border border-primary/50 shadow-[0_0_15px_rgba(var(--color-primary),0.3)]' : isCompleted ? 'bg-surface/80 border border-surface-light hover:bg-surface-light' : 'hover:bg-surface-light/50 border border-transparent opacity-60'}`}>
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                  <div className={`transition-colors ${isActive || isCompleted ? 'text-primary' : 'text-txt-muted group-hover:text-txt-main'}`}>{isCompleted && !isActive ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}</div>
                  <div className="text-left"><span className={`block font-bold text-sm ${isActive || isCompleted ? 'text-txt-main' : 'text-txt-muted group-hover:text-txt-main'}`}>{step.label}</span></div>
                </button>
            )
          })}
        </nav>
        
        {/* GEMINI CHAT INTERFACE */}
        <div className="flex-1 bg-canvas flex flex-col overflow-hidden relative border-t border-surface-light">
           
           <div className="p-6 bg-gradient-to-b from-surface to-canvas border-b border-surface-light/50 shadow-lg z-10 space-y-4">
               <div className="flex justify-between items-center">
                   <div className="flex items-center gap-3">
                       <div className="p-1.5 bg-gradient-to-br from-primary to-secondary rounded-lg shadow-lg shadow-primary/20">
                            <Sparkles className="w-4 h-4 text-white" />
                       </div>
                       <div>
                           <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary uppercase tracking-widest">Gemini</h3>
                           <p className="text-[10px] font-bold text-txt-muted">AI Engineering Assistant</p>
                       </div>
                   </div>
                   <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-surface-light">
                        {aiLoading && <RefreshCw className="w-3 h-3 text-primary animate-spin"/>}
                        <div className={`w-1.5 h-1.5 rounded-full ${aiLoading ? 'bg-primary' : 'bg-emerald-500'} animate-pulse`}></div>
                        <span className="text-[9px] font-bold text-txt-muted uppercase">{aiLoading ? 'Thinking' : 'Ready'}</span>
                   </div>
               </div>
               
               <div className="relative group">
                   <select 
                       value={aiScope} 
                       onChange={(e) => setAiScope(e.target.value === 'current' ? 'current' : parseInt(e.target.value))}
                       className="w-full bg-surface/50 text-[11px] font-bold text-txt-main border border-surface-light rounded-xl py-3 pl-3 pr-8 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer hover:bg-surface-light transition-all uppercase tracking-wide shadow-inner"
                   >
                       <option value="current">⚡ Current Phase Context</option>
                       <hr />
                       {steps.map((s, i) => <option key={s.id} value={i}>Phase {i+1}: {s.label}</option>)}
                   </select>
                   <ChevronDown className="w-3 h-3 text-txt-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-primary transition-colors" />
               </div>

               {/* Sub-Scenario Selector for Phase 5 */}
               {aiScope === 4 && (
                   <div className="flex gap-2 p-1 bg-surface rounded-lg border border-surface-light">
                       {['min', 'target', 'max', 'all'].map(s => (
                           <button 
                                key={s} 
                                onClick={() => handleRunAnalysis(s as any)}
                                className="flex-1 hover:bg-primary/20 text-[9px] font-black text-txt-muted hover:text-primary py-2 rounded-md uppercase transition-colors"
                           >
                               {s}
                           </button>
                       ))}
                   </div>
               )}
           </div>

           <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-canvas scroll-smooth bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-canvas to-canvas">
               {messages.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center opacity-40 space-y-4">
                       <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center border border-surface-light animate-pulse">
                            <Sparkles className="w-8 h-8 text-primary/50" />
                       </div>
                       <div className="text-center">
                           <p className="text-xs font-bold uppercase text-txt-muted tracking-widest">Gemini Ready</p>
                           <p className="text-[10px] text-txt-muted mt-1 max-w-[200px]">Ask about wellbore geometry, fluid properties, or pump selection.</p>
                       </div>
                   </div>
               )}
               
               {messages.map((msg) => (
                   <div key={msg.id} className={`flex flex-col gap-2 animate-fadeIn ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[92%] p-5 rounded-2xl text-xs font-medium leading-relaxed shadow-lg border ${
                            msg.type === 'alert' ? 'bg-red-950/30 border-red-500/30 text-red-100' :
                            msg.role === 'user' ? 'bg-primary text-white border-primary rounded-br-none shadow-primary/20' : 
                            'bg-surface text-txt-main border-surface-light rounded-bl-none shadow-black/40'
                        }`}>
                            {msg.type === 'alert' && <div className="flex items-center gap-2 mb-2 text-red-400 font-black uppercase tracking-wider text-[10px] border-b border-red-500/20 pb-1"><AlertTriangle className="w-3 h-3" /> Warning</div>}
                            <div className="markdown-content">
                                <MarkdownRenderer content={msg.text} />
                            </div>
                        </div>
                        <span className="text-[9px] font-bold text-txt-muted px-2 flex items-center gap-1">
                            {msg.role === 'user' ? 'You' : 'Gemini'} • {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                   </div>
               ))}
               <div ref={chatEndRef}></div>
           </div>

           <div className="p-6 bg-surface/80 backdrop-blur-md border-t border-surface-light">
               <div className="flex items-center gap-2 bg-canvas border border-surface-light rounded-2xl px-3 py-2.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
                   <input 
                        type="text" 
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder={language === 'es' ? "Pregunta a Gemini..." : "Ask Gemini..."}
                        className="bg-transparent w-full text-xs font-medium text-txt-main px-3 py-2 outline-none placeholder-surface-light"
                        disabled={aiLoading}
                   />
                   <button 
                        onClick={handleSendMessage} 
                        disabled={!userInput.trim() || aiLoading}
                        className="p-3 bg-primary hover:bg-primary/90 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 group transform active:scale-95"
                   >
                       <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                   </button>
               </div>
           </div>

        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <header className="h-24 bg-canvas/80 backdrop-blur-md border-b border-surface-light px-12 flex items-center justify-between z-20">
           <div className="flex items-center gap-8">
               <span className="text-txt-muted font-mono text-xl">{t('header.phase')} 0{activeStep + 1}</span>
               <div className="h-8 w-px bg-surface-light"></div>
               <h2 className="text-3xl font-black text-txt-main uppercase tracking-wider">{steps[activeStep].label}</h2>
           </div>
           
           {/* CENTER PROJECT NAME - HEAD UP DISPLAY STYLE */}
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group">
                <span className="text-[9px] font-bold text-primary uppercase tracking-[0.3em] mb-1 opacity-70 group-hover:opacity-100 transition-opacity">Active Session</span>
                <div className="relative">
                    <div className="absolute inset-0 bg-primary blur-xl opacity-10 group-hover:opacity-20 transition-opacity rounded-full"></div>
                    <h1 className="relative text-lg font-black text-txt-main uppercase tracking-widest bg-surface/80 px-8 py-2 rounded-xl border border-surface-light/50 backdrop-blur-md shadow-inner ring-1 ring-white/5">
                        {params.metadata.projectName || 'UNTITLED'}
                    </h1>
                </div>
           </div>
           
           <div className="flex items-center gap-6">
               <button onClick={toggleLanguage} className="text-base font-bold text-txt-muted hover:text-txt-main flex items-center gap-4 uppercase transition-colors px-6 py-3 rounded-2xl hover:bg-surface-light group">
                   <Globe className="w-6 h-6 group-hover:text-primary" />
                   <span>{language === 'en' ? 'ENGLISH' : 'ESPAÑOL'}</span>
               </button>
               <div className="h-8 w-px bg-surface-light"></div>
               <button onClick={toggleFullScreen} className="text-base font-bold text-txt-muted hover:text-primary flex items-center gap-4 uppercase transition-colors px-6 py-3 rounded-2xl hover:bg-surface-light">
                   {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                   <span className="hidden sm:inline">{t('header.fullscreen')}</span>
               </button>
               <div className="h-8 w-px bg-surface-light"></div>
               <button onClick={() => setAppMode('landing')} className="text-base font-bold text-txt-muted hover:text-red-400 flex items-center gap-4 uppercase transition-colors px-6 py-3 rounded-2xl hover:bg-surface-light">
                   <RotateCcw className="w-6 h-6" /> {t('header.exit')}
               </button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 md:p-10 relative">
          <div className="max-w-[1920px] mx-auto animate-fadeIn relative z-10 h-full">
            {activeStep === 0 && <Phase1 params={params} setParams={setParams} rawSurvey={rawSurvey} setRawSurvey={setRawSurvey} />}
            {activeStep === 1 && <Phase2 params={params} setParams={setParams} />}
            {activeStep === 2 && <Phase3 params={params} setParams={setParams} results={designResults} />}
            {activeStep === 3 && <PhaseScenarios params={params} setParams={setParams} results={designResults} />}
            {activeStep === 4 && <Phase5 params={params} setParams={setParams} customPump={customPump} setCustomPump={setCustomPump} pumpCatalog={pumpCatalog} motorCatalog={motorCatalog} setShowPumpModal={setShowPumpModal} curveData={curveData} match={match} results={matchResults} />}
            {activeStep === 5 && <PhaseSimulations params={params} setParams={setParams} pump={customPump} frequency={currentFrequency} />}
            {activeStep === 6 && <Phase6 params={params} pump={customPump} designFreq={currentFrequency} />}
          </div>
        </main>

        {/* FOOTER */}
        <div className="h-20 bg-surface/80 backdrop-blur border-t border-surface-light px-12 flex items-center justify-between z-20">
           <button onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0} className="text-lg font-black text-txt-muted hover:text-txt-main disabled:opacity-0 uppercase flex items-center gap-4 transition-colors">
               <ChevronRight className="w-8 h-8 rotate-180" /> {t('footer.prev')}
           </button>
           <div className="flex gap-3">
               {steps.map((_, idx) => (
                   <div key={idx} className={`h-3 rounded-full transition-all ${idx === activeStep ? 'bg-primary w-16' : 'bg-surface-light w-4'}`}></div>
               ))}
           </div>
           <button onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))} disabled={activeStep === steps.length - 1} className="bg-white hover:bg-primary text-slate-950 hover:text-white px-10 py-4 rounded-full font-black text-base uppercase flex items-center gap-4 transition-all shadow-lg shadow-white/10 hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed">
               {t('footer.next')} <ChevronRight className="w-6 h-6" />
           </button>
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-surface-light), 0.8); border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(var(--color-primary), 0.5); }`}</style>
    </div>
  );
};

export default App;
