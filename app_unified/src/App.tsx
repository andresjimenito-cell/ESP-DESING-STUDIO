
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    generateMultiCurveData, findIntersection, calculateSystemResults, calculateTDH, enforcePVTConsistency, calculateAOF, calculateBaseHead, exportProjectToExcel, getShaftLimitHp, getDownloadFilename
} from '@/utils';
import { read, utils as xlsxUtils } from 'xlsx';
import { PumpImportModal } from './components/PumpImportModal';
import { LandingPage } from './components/LandingPage';
import { Phase1 } from './components/Phase1';
import { Phase2 } from './components/Phase2';
import { Phase3 } from './components/Phase3';
import { PhaseScenarios } from './components/PhaseScenarios';
import { Phase5, ReportSelectorModal, DesignReport } from './components/Phase5';
import { PhaseSimulations } from './components/PhaseSimulations';
import { Phase6 } from './components/Phase6';
import { PhaseMonitoreo } from './components/PhaseMonitoreo';
import { DesignComparator } from './components/DesignComparator';
import { DesignDataImport } from './components/DesignDataImport';
import { BatchDesignProcessor } from './components/BatchDesignProcessor';
import { TUBING_CATALOG, CASING_CATALOG, STANDARD_PUMPS, STANDARD_MOTORS, CABLE_CATALOG, VSD_CATALOG } from '@/data';
import {
    Activity, RotateCcw, Ruler, Droplets, Target, Hexagon, CheckCircle2, Clock, ClipboardCheck, Maximize, Minimize, Globe, AlertCircle, Sparkles, RefreshCw, Send, ChevronDown, ChevronRight, AlertTriangle, Layers, Palette, FileSpreadsheet, Maximize2, Printer, GitCompareArrows, Zap, Settings, ArrowLeft
} from 'lucide-react';
import { EspPump, EspMotor, SystemParams, SurveyPoint } from '@/types';
import { useLanguage } from '@/i18n';
import { useTheme } from '@/theme';
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
        pvtCorrelation: 'Lasater', viscosityModel: 'Total Fluid',
        correlations: {
            viscDeadOil: 'Beggs-Robinson', viscSatOil: 'Beggs-Robinson', viscUnsatOil: 'Vasquez-Beggs',
            viscGas: 'Lee', viscWater: 'Matthews & Russell', oilDensity: 'Katz',
            gasDensity: 'Beggs', waterDensity: 'Beggs', pbRs: 'Lasater',
            oilComp: 'Vasquez-Beggs', oilFvf: 'Vasquez-Beggs', waterFvf: 'HP41C',
            zFactor: 'Dranchuk-Purvis', surfaceTensionOil: 'Baker-Swerdloff', surfaceTensionWater: 'Hough'
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
    surfaceTemp: 0, bottomholeTemp: 0,
    motorHp: 0,
    totalDepthMD: 0, survey: INITIAL_SURVEY,
    simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0 }
};

// --- ADVANCED MARKDOWN RENDERER ---
const MarkdownRenderer = ({ content }: { content: string }) => {
    const processInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\$.*?\$|`.*?`)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-txt-main font-black">{part.slice(2, -2)}</strong>;
            if (part.startsWith('$') && part.endsWith('$')) return <span key={i} className="text-secondary font-mono bg-secondary/10 px-1 rounded mx-1">{part.slice(1, -1)}</span>;
            if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="text-primary font-mono bg-surface-light px-1 rounded">{part.slice(1, -1)}</code>;
            return <span key={i}>{part}</span>;
        });
    };

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    const flushTable = (keyPrefix: string) => {
        if (tableBuffer.length === 0) return null;
        const rows = tableBuffer.map(row => row.split('|').filter(c => c.trim() !== '').map(c => c.trim()));
        const header = rows[0];
        const body = rows.slice(1).filter(r => r.length > 0 && !r.every(c => c.includes('---')));

        const table = (
            <div key={keyPrefix} className="my-6 overflow-hidden rounded-2xl border border-surface-light shadow-md">
                <table className="w-full text-sm text-left">
                    <thead className="bg-surface-light text-txt-muted uppercase font-black tracking-widest">
                        <tr>{header.map((h, i) => <th key={i} className="px-5 py-4">{processInline(h)}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-surface-light bg-surface">
                        {body.map((row, i) => (
                            <tr key={i} className="hover:bg-surface-light/50 transition-colors">
                                {row.map((cell, j) => (
                                    <td key={j} className={`px-5 py-3 font-medium ${j === 0 ? 'text-primary font-black' : 'text-txt-muted'}`}>
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
        if (trimmed.startsWith('|')) {
            inTable = true;
            tableBuffer.push(trimmed);
            if (index === lines.length - 1) elements.push(flushTable(`tbl-${index}`));
            return;
        } else if (inTable) {
            elements.push(flushTable(`tbl-${index}`));
        }

        if (trimmed.startsWith('###')) {
            elements.push(<h4 key={index} className="text-base font-black text-primary uppercase tracking-widest mt-8 mb-3 border-b-2 border-surface-light pb-2">{trimmed.replace(/^###\s*/, '')}</h4>);
        } else if (trimmed.startsWith('##')) {
            elements.push(<h3 key={index} className="text-lg font-black text-txt-main mt-10 mb-4 flex items-center gap-3"><div className="w-1.5 h-6 bg-primary rounded-full"></div>{trimmed.replace(/^##\s*/, '')}</h3>);
        } else if (trimmed.startsWith('#')) {
            elements.push(<h2 key={index} className="text-2xl font-black text-txt-main mt-6 mb-6 tracking-tighter">{trimmed.replace(/^#\s*/, '')}</h2>);
        }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            elements.push(<div key={index} className="flex gap-3 ml-2 mb-1 text-txt-muted"><span className="text-primary font-bold mt-1.5">•</span><span className="leading-relaxed">{processInline(trimmed.substring(2))}</span></div>);
        }
        else if (/^\d+\./.test(trimmed)) {
            elements.push(<div key={index} className="flex gap-3 ml-2 mb-1 text-txt-muted"><span className="text-secondary font-bold mt-0.5 min-w-[20px]">{trimmed.split('.')[0]}.</span><span className="leading-relaxed">{processInline(trimmed.replace(/^\d+\.\s*/, ''))}</span></div>);
        }
        else if (trimmed === '') {
            elements.push(<div key={index} className="h-2"></div>);
        }
        else {
            elements.push(<p key={index} className="text-txt-muted leading-relaxed mb-2 text-sm font-medium">{processInline(trimmed)}</p>);
        }
    });

    if (inTable) elements.push(flushTable(`tbl-end`));
    return <div className="space-y-1">{elements}</div>;
};

const App: React.FC = () => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, cycleTheme } = useTheme();
    const [appState, setAppState] = useState<{ appMode: 'landing' | 'main' | 'comparator' | 'monitoring' }>({ appMode: 'landing' });

    const [activeStep, setActiveStep] = useState(0);
    const [initialDesignForComparator, setInitialDesignForComparator] = useState<any>(null);
    const [showPumpModal, setShowPumpModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isChatMinimized, setIsChatMinimized] = useState(true);
    const [cameFromMonitoring, setCameFromMonitoring] = useState(false);

    const [landingMenuLevel, setLandingMenuLevel] = useState<'main' | 'design'>('main');





    // AI Controls
    const [aiScope, setAiScope] = useState<number | 'current'>('current');
    const [userInput, setUserInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [params, setParams] = useState<SystemParams>(INITIAL_PARAMS);
    const [customPump, setCustomPump] = useState<EspPump | null>(null);
    const [rawSurvey, setRawSurvey] = useState('');
    const [toast, setToast] = useState<{ msg: string, show: boolean, type?: 'info' | 'warning' }>({ msg: '', show: false });
    const [pumpCatalog, setPumpCatalog] = useState<EspPump[]>(STANDARD_PUMPS);
    const [showGlobalReportSelector, setShowGlobalReportSelector] = useState(false);
    const [globalReportConfig, setGlobalReportConfig] = useState<any>({ isOpen: false, type: 'target' });

    const [motorCatalog, setMotorCatalog] = useState<EspMotor[]>(STANDARD_MOTORS);

    // Persistent Batch State for Landing Page
    const [batchView, setBatchView] = useState<'idle' | 'loading' | 'list'>('idle');
    const [batchDesigns, setBatchDesigns] = useState<Record<string, any>[]>([]);
    const [batchSurveys, setBatchSurveys] = useState<Record<string, SurveyPoint[]>>({});
    const [batchFile, setBatchFile] = useState('');

    // Calculations
    const currentFrequency = params.targets[params.activeScenario].frequency;
    const curveData = useMemo(() => customPump ? generateMultiCurveData(customPump, params, currentFrequency) : [], [customPump, params, currentFrequency]);
    const match = useMemo(() => findIntersection(curveData), [curveData]);

    const designResults = useMemo(() => calculateSystemResults(params.pressures.totalRate, null, params, customPump || { id: 'tmp', stages: 1, h0: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, nameplateFrequency: 60 } as any, currentFrequency), [params.pressures.totalRate, params, customPump, currentFrequency]);
    const matchResults = useMemo(() => calculateSystemResults(match?.flow || 0, match?.head || 0, params, customPump || { id: 'tmp', stages: 1, h0: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, nameplateFrequency: 60 } as any, currentFrequency), [match, params, customPump, currentFrequency]);

    const { messages, loading: aiLoading, sendMessage, analyzePhase } = useEspCopilot(params, designResults, activeStep, customPump);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => { setAiScope(activeStep); }, [activeStep]);

    const handleSendMessage = () => { if (!userInput.trim()) return; sendMessage(userInput); setUserInput(''); };
    const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSendMessage(); };

    const handleExportAll = () => {
        if (!customPump) { alert("No pump selected."); return; }
        const designFreqs = [30, 40, 50, 60, 70];
        if (!designFreqs.includes(currentFrequency)) designFreqs.push(currentFrequency);
        designFreqs.sort((a, b) => a - b);
        const designVsdData = designFreqs.map(hz => {
            const cData = generateMultiCurveData(customPump, params, hz, 60);
            const m = findIntersection(cData);
            let flow = m ? m.flow : 0;
            let head = m ? m.head : 0;
            const res = calculateSystemResults(flow, head, params, customPump, hz);
            const shaftLimit = getShaftLimitHp(customPump?.series);
            const bhp = res.hpTotal || 0;
            const pumpShaftLoad = shaftLimit > 0 ? (bhp / shaftLimit) * 100 : 0;
            const intakeT = params.bottomholeTemp;
            const motorT = intakeT + (res.motorLoad || 0) * 0.8;
            return {
                Frequency_Hz: hz, RPM: hz * 60, Flow_BPD: flow, Head_ft: res.tdh?.toFixed(0),
                PIP_psi: res.pip?.toFixed(0), PDP_psi: res.pdp?.toFixed(0), Pwf_psi: res.pwf?.toFixed(0),
                Motor_Amps: res.electrical.amps?.toFixed(1), Motor_Volts: res.electrical.volts?.toFixed(0),
                Surf_Volts: res.electrical.surfaceVolts?.toFixed(0), Power_kVA: res.electrical.kva?.toFixed(1),
                Power_kW: res.electrical.kw?.toFixed(1), Pump_Eff_Pct: res.effEstimated?.toFixed(1),
                Motor_Eff_Pct: res.electrical.motorEff?.toFixed(1), Motor_Load_Pct: res.motorLoad?.toFixed(0),
                Pump_Shaft_Load_Pct: pumpShaftLoad.toFixed(0), Motor_Temp_F: motorT.toFixed(0)
            };
        });
        exportProjectToExcel(params, customPump, params.selectedMotor, designResults, designVsdData, []);
    };

    useEffect(() => { if (params.fluids.pb > 0) { const { updated, corrected, minGor } = enforcePVTConsistency(params); if (corrected) { setParams(updated); setToast({ show: true, msg: `PVT AI: GOR corrected to min ${minGor.toFixed(0)} scf/stb to match Bubble Point physics.`, type: 'info' }); } } }, [params.fluids.pb, params.fluids.apiOil, params.fluids.geGas, params.bottomholeTemp, params.fluids.gor]);
    useEffect(() => { if (toast.show) { const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000); return () => clearTimeout(timer); } }, [toast.show]);
    useEffect(() => { setParams(current => { if (current.activeScenario !== 'target') return current; const masterIP = current.inflow.ip; const masterWC = current.fluids.waterCut; const masterGOR = current.fluids.gor; const masterRate = current.pressures.totalRate; const t = current.targets; const isTargetSynced = t.target.ip === masterIP && t.target.waterCut === masterWC && t.target.gor === masterGOR && t.target.rate === masterRate; if (!isTargetSynced) { return { ...current, targets: { ...t, target: { ...t.target, ip: masterIP, waterCut: masterWC, gor: masterGOR, rate: masterRate } } }; } return current; }); }, [params.inflow.ip, params.fluids.waterCut, params.fluids.gor, params.pressures.totalRate, params.activeScenario]);

    const loadCatalog = async (silent = false) => {
        try {
            const response = await fetch(`/PUMPS (1).xlsx?v=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) {
                if (!silent) setToast({ show: true, msg: "No se pudo cargar el archivo PUMPS (1).xlsx de la carpeta public.", type: 'warning' });
                return;
            }
            const buffer = await response.arrayBuffer();
            const data = new Uint8Array(buffer);
            const workbook = read(data, { type: 'array' });
            const normalizeKey = (key: string) => String(key).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s\-_]/g, '').replace(/[^a-z0-9]/g, '');

            const DEFAULT_PUMP: any = {
                id: 'default', manufacturer: '', series: '', model: '', stages: 0, housingCount: 1, minStages: 1, maxStages: 100,
                stageIncrease: 1, minRate: 0, bepRate: 0, maxRate: 0, maxEfficiency: 0, maxHead: 0, maxGraphRate: 0, nameplateFrequency: 60,
                h0: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0
            };

            let pumpSheetName = workbook.SheetNames.find(n => {
                const name = n.toLowerCase();
                return name.includes('pump') || name.includes('bomba') || name.includes('catalog');
            }) || workbook.SheetNames[0];

            const pumpSheet = workbook.Sheets[pumpSheetName];
            const pumpJson = xlsxUtils.sheet_to_json(pumpSheet, { header: 1 }) as any[][];
            const pumps: EspPump[] = [];
            let pHeaderIdx = -1;

            for (let i = 0; i < Math.min(pumpJson.length, 30); i++) {
                const row = (pumpJson[i] || []).map(c => normalizeKey(String(c)));
                const hasModel = row.some(c => c.includes('model') || c.includes('name') || c.includes('nombre'));
                const hasHeadCurve = row.some(c => c.includes('h0') || c.includes('curva') || c.includes('head'));
                const hasFlow = row.some(c => c.includes('rate') || c.includes('caudal') || c.includes('bpd'));

                if (hasModel && (hasHeadCurve || hasFlow)) {
                    pHeaderIdx = i;
                    break;
                }
            }

            if (pHeaderIdx !== -1) {
                const headers = pumpJson[pHeaderIdx].map(c => normalizeKey(String(c)));
                for (let i = pHeaderIdx + 1; i < pumpJson.length; i++) {
                    const row = pumpJson[i];
                    if (!row || row.length === 0) continue;
                    const p: any = { ...DEFAULT_PUMP, id: crypto.randomUUID() };
                    let valid = false;
                    headers.forEach((key, col) => {
                        const val = row[col];
                        if (val === undefined || val === null || val === '') return;

                        const k = key.toLowerCase();
                        if (k.includes('manufacturer') || k.includes('fabricante') || k.includes('brand') || k.includes('marca')) p.manufacturer = String(val);
                        else if (k.includes('series') || k.includes('serie')) p.series = String(val);
                        else if (k.includes('model') || k.includes('modelo') || k.includes('nombre') || (k === 'name')) p.model = String(val);
                        else if (k.includes('minrate') || k.includes('caudalmin') || k.includes('minbpd')) p.minRate = Number(val);
                        else if (k.includes('beprate') || k === 'bep' || k.includes('optim') || k.includes('bepbpd')) p.bepRate = Number(val);
                        else if (k.includes('maxrate') || k.includes('caudalmax') || k.includes('maxbpd')) p.maxRate = Number(val);
                        else if (k.includes('efficiency') || k.includes('eficiencia')) p.maxEfficiency = Number(val);
                        else if (k.includes('frequency') || k === 'hz' || k.includes('frecuencia')) p.nameplateFrequency = Number(val);
                        else if (k.includes('minstage') || k.includes('etapasmin')) p.minStages = Number(val);
                        else if (k.includes('maxstage') || k.includes('etapasmax')) p.maxStages = Number(val);
                        else if (k.includes('stageincrease') || k.includes('incremento')) p.stageIncrease = Number(val);
                        else if (['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'].some(c => k === c)) {
                            p[k] = Number(val);
                            if (Number(val) !== 0) valid = true;
                        }
                    });
                    if (p.model && valid) {
                        if (!p.stages) p.stages = 1;
                        if (!p.maxRate && p.minRate) p.maxRate = p.minRate * 2;
                        if (!p.bepRate) p.bepRate = (p.minRate + p.maxRate) / 2;
                        if (!p.maxEfficiency) p.maxEfficiency = 70;
                        if (!p.maxGraphRate) p.maxGraphRate = p.maxRate * 1.2;
                        if (!p.nameplateFrequency) p.nameplateFrequency = 60;
                        if (!p.maxStages) p.maxStages = 100;
                        if (!p.minStages) p.minStages = 1;
                        if (!p.stageIncrease) p.stageIncrease = 1;
                        p.housingCount = Math.ceil(p.stages / p.maxStages);
                        pumps.push(p as EspPump);
                    }
                }
            }

            const motors: EspMotor[] = [];
            let motorSheetName = workbook.SheetNames.find(n => {
                const name = n.toLowerCase();
                return name.includes('motor') || name.includes('maquina') || name.includes('power');
            });
            if (motorSheetName) {
                const motorSheet = workbook.Sheets[motorSheetName];
                const motorJson = xlsxUtils.sheet_to_json(motorSheet, { header: 1 }) as any[][];
                let mHeaderIdx = -1;
                for (let i = 0; i < Math.min(motorJson.length, 20); i++) {
                    const row = motorJson[i].map(c => normalizeKey(String(c)));
                    if (row.includes('nameplatehp') || row.includes('hp') || row.includes('potencia') || row.includes('nameplatevoltage')) { mHeaderIdx = i; break; }
                }
                if (mHeaderIdx !== -1) {
                    const mHeaders = motorJson[mHeaderIdx].map(c => normalizeKey(String(c)));
                    for (let i = mHeaderIdx + 1; i < motorJson.length; i++) {
                        const row = motorJson[i];
                        if (!row || row.length === 0) continue;
                        const m: any = { id: crypto.randomUUID(), manufacturer: 'Generic', series: 'STD', model: 'Motor', hp: 0, voltage: 0, amps: 0 };
                        mHeaders.forEach((key, col) => {
                            const val = row[col];
                            if (val === undefined || val === null) return;
                            if (['nameplatehp', 'hp', 'potencia'].includes(key)) m.hp = Number(val);
                            else if (['nameplatevoltage', 'voltios', 'voltaje'].includes(key)) m.voltage = Number(val);
                            else if (['nameplatecurrent', 'amperios', 'corriente'].includes(key)) m.amps = Number(val);
                            else if (['manufacturer', 'fabricante', 'marca'].includes(key)) m.manufacturer = String(val);
                            else if (['series', 'serie'].includes(key)) m.series = String(val);
                            else if (['type', 'model', 'modelo', 'tipo'].includes(key)) m.model = String(val);
                            else if (['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'e0', 'e1', 'e2', 'e3', 'e4', 'e5'].includes(key)) {
                                m[key] = Number(val);
                            }
                        });
                        if (m.hp > 0) motors.push(m as EspMotor);
                    }
                }
            }

            if (pumps.length > 0) setPumpCatalog(pumps);
            if (motors.length > 0) setMotorCatalog(motors);
            else if (motors.length === 0) {
                const fallbackMotors: any[] = [];
                [30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000].forEach(hp => {
                    fallbackMotors.push({
                        id: `std-${hp}`, manufacturer: 'Generic', series: '456', model: `${hp}HP-STD`,
                        hp: hp, voltage: hp * 10, amps: (hp * 746) / (Math.sqrt(3) * (hp * 10) * 0.85 * 0.85)
                    });
                });
                setMotorCatalog(fallbackMotors);
            }

            if (!silent) setToast({ show: true, msg: `Catálogo actualizado: ${pumps.length} bombas y ${motors.length} motores cargados.`, type: 'info' });

        } catch (err) {
            console.error("Error loading database:", err);
            if (!silent) setToast({ show: true, msg: "Error crítico leyendo el archivo Excel. Revisa el formato.", type: 'warning' });
        }
    };

    useEffect(() => {
        loadCatalog(true);
    }, []);

    const steps = [
        { id: 'wellbore', label: t('nav.wellbore'), sub: t('nav.wellbore.sub'), icon: Ruler },
        { id: 'fluid', label: t('nav.fluids'), sub: t('nav.fluids.sub'), icon: Droplets },
        { id: 'inflow', label: t('nav.inflow'), sub: t('nav.inflow.sub'), icon: Target },
        { id: 'scenarios', label: t('scen.title'), sub: t('scen.sub'), icon: Layers },
        { id: 'equipment', label: t('nav.equipment'), sub: t('nav.equipment.sub'), icon: Hexagon },
        { id: 'simulations', label: t('nav.simulations'), sub: t('nav.simulations.sub'), icon: Clock },
        { id: 'match', label: t('nav.match'), sub: t('nav.match.sub'), icon: ClipboardCheck },
    ];

    const handlePumpImport = (pump: EspPump | null, motorHp: number, fullPumpCatalog?: EspPump[], fullMotorCatalog?: EspMotor[]) => { if (fullPumpCatalog?.length) setPumpCatalog(fullPumpCatalog.filter(p => p && p.id)); if (fullMotorCatalog?.length) setMotorCatalog(fullMotorCatalog.filter(m => m && m.id)); if (pump) { setCustomPump(pump); setParams(p => ({ ...p, motorHp })); } setShowPumpModal(false); };
    const handleProjectImport = (data: { params: SystemParams, customPump: EspPump | null, frequency: number }) => {
        if (data.params) {
            const sanitizedParams = { ...INITIAL_PARAMS, ...data.params, metadata: data.params.metadata || INITIAL_PARAMS.metadata, simulation: data.params.simulation || INITIAL_PARAMS.simulation, targets: data.params.targets || INITIAL_PARAMS.targets };
            setParams(sanitizedParams);
            if (data.params.survey) setRawSurvey(data.params.survey.map(s => `${s.md}\t${s.tvd}`).join('\n'));
        }
        if (data.customPump) {
            setCustomPump(data.customPump);
            if (!pumpCatalog.some(p => p && p.id === data.customPump?.id)) setPumpCatalog(prev => [...prev, data.customPump!]);
        }
        if (data.frequency) {
            setParams(prev => ({ ...prev, targets: { ...prev.targets, target: { ...prev.targets.target, frequency: data.frequency } } }));
        }
        setShowPumpModal(false);
    };
    const handleLandingFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const handleData = (json: any) => { if (json.type === 'esp-studio-project' && json.data) { handleProjectImport(json.data); setAppState({ appMode: 'main' }); } else alert("Invalid Project File"); };
        if (file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (event) => { try { handleData(JSON.parse(event.target?.result as string)); } catch (err) { alert("Error reading file"); } };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = read(data, { type: 'array' });
                    const sheet = workbook.Sheets['APP_DATA'];
                    if (sheet) {
                        const jsonData = xlsxUtils.sheet_to_json(sheet, { header: 1 }) as any[][];
                        const jsonStr = jsonData[1]?.[0] as string;
                        if (jsonStr) { handleData(JSON.parse(jsonStr)); return; }
                    }
                    alert("No valid project data found in Excel file");
                } catch (err) { alert("Error reading Excel file"); }
            };
            reader.readAsArrayBuffer(file);
        }
    };
    const toggleFullScreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err)); else if (document.exitFullscreen) document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error(err)); };
    const toggleLanguage = () => setLanguage(language === 'en' ? 'es' : 'en');

    const handleQuickDesignImport = (importedParams: SystemParams) => {
        // --- 1. SET BASE PARAMS ---
        let p = { ...importedParams };

        // --- 2. AUTO-FILL EQUIPMENT (SMART MATCHING) ---

        const smartMatch = (catalog: any[], searchString: string, isMotor: boolean = false, targetHp: number = 0) => {
            if (!searchString || !catalog || catalog.length === 0) return null;
            const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const rawSearch = String(searchString).toUpperCase();
            // Create words from alphanumerics
            const tokens = rawSearch.split(/[\s\-_,;()\u00A0]/).filter(t => t.length > 0);
            if (tokens.length === 0 && targetHp === 0) return null;

            let bestMatch = null;
            let maxScore = -999;

            // Extract HP from string (common patterns: "200 HP", "200HP")
            let searchHp = 0;
            if (isMotor) {
                const hpMatch = rawSearch.match(/(\d+)\s*HP/);
                if (hpMatch) searchHp = parseInt(hpMatch[1], 10);
            }

            for (const item of catalog) {
                let score = 0;
                const itemTokens = [
                    String(item.model || '').toUpperCase(),
                    String(item.series || '').toUpperCase(),
                    String(item.manufacturer || '').toUpperCase(),
                    String(item.brand || '').toUpperCase(),
                    String(item.id || '').toUpperCase()
                ].map(s => s.split(/[\s\-_,;()\u00A0]/)).flat().filter(t => t.length > 0);

                const itemStr = itemTokens.join(' ');
                const normItem = norm(itemStr);
                const normSearch = norm(rawSearch);

                // --- 1. HP CHECK (PRIMARY FOR MOTORS) ---
                if (isMotor && item.hp) {
                    if (targetHp > 0 && item.hp === targetHp) {
                        score += 300; // Max priority to explicitly reported HP
                    } else if (searchHp > 0 && item.hp === searchHp) {
                        score += 150;
                    } else if (normSearch.includes(String(item.hp))) {
                        score += 80; // If HP number is buried in string (e.g., PM200)
                    } else if (targetHp > 0 || searchHp > 0) {
                        score -= 50; // Heavy penalty for mismatch
                    }
                }

                // --- 2. TOKEN MATCHING ---
                for (const t of tokens) {
                    const nt = norm(t);
                    if (nt.length < 2) continue;
                    if (itemTokens.includes(t)) score += 40;
                    else if (normItem.includes(nt)) score += 15;
                }

                // --- 3. EXACT IDENTITY ---
                if (normItem === normSearch) score += 100;
                else if (normItem.includes(normSearch) || normSearch.includes(normItem)) score += 30;

                if (score > maxScore) {
                    maxScore = score;
                    bestMatch = item;
                }
            }
            return maxScore > 20 ? bestMatch : null;
        };

        // PUMP Matching
        if (p.initialPumpName) {
            const foundPump = smartMatch(pumpCatalog, p.initialPumpName, false);
            if (foundPump) {
                const updatedPump = { ...foundPump, stages: p.initialStages || foundPump.stages || 100 };
                setCustomPump(updatedPump);
            }
        }

        // MOTOR Matching
        if (p.initialMotorName || p.initialMotorHp) {
            const foundMotor = smartMatch(motorCatalog, p.initialMotorName, true, p.initialMotorHp);
            if (foundMotor) {
                p.selectedMotor = foundMotor;
                p.motorHp = foundMotor.hp;
            } else if (p.initialMotorHp > 0) {
                const fallbackMotor = motorCatalog.find(m => m.hp >= p.initialMotorHp) || motorCatalog[0];
                if (fallbackMotor) {
                    p.selectedMotor = fallbackMotor;
                    p.motorHp = fallbackMotor.hp;
                }
            }
        }

        // CABLE Matching
        if (p.initialCableName) {
            const foundCable = smartMatch(CABLE_CATALOG, p.initialCableName, false);
            if (foundCable) p.selectedCable = foundCable;
        }

        // VSD Matching
        if (p.initialVSDName) {
            const foundVSD = smartMatch(VSD_CATALOG, p.initialVSDName, false);
            if (foundVSD) p.selectedVSD = foundVSD;
        }

        // --- 3. APPLY STATES ---
        setParams(p);
        if (p.survey) {
            setRawSurvey(p.survey.map(s => `${s.md}\t${s.tvd}`).join('\n'));
        }
        setAppState({ appMode: 'main' });
        // Jump directly to Phase 5 (Equipment)
        setActiveStep(4);
    };

    const persistentBatch = useMemo(() => ({
        view: batchView, setView: setBatchView,
        designs: batchDesigns, setDesigns: setBatchDesigns,
        surveys: batchSurveys, setSurveys: setBatchSurveys,
        file: batchFile, setFile: setBatchFile
    }), [batchView, batchDesigns, batchSurveys, batchFile]);

    let mainContent;
    if (appState.appMode === 'comparator') {
        mainContent = <DesignComparator initialDesign={initialDesignForComparator} onBack={() => { setInitialDesignForComparator(null); setCameFromMonitoring(false); setAppState({ appMode: 'landing' }); }} />;
    } else if (appState.appMode === 'landing') {
        mainContent = (
            <LandingPage
                onStart={() => setAppState({ appMode: 'main' })}
                onCompare={() => setAppState({ appMode: 'comparator' })}
                onMonitoring={() => setAppState({ appMode: 'monitoring' })}


                menuLevel={landingMenuLevel}
                setMenuLevel={setLandingMenuLevel}
                params={params}
                setParams={setParams}
                language={language}
                toggleLanguage={toggleLanguage}
                onImportFile={handleLandingFileImport}
                onQuickImport={handleQuickDesignImport}
                // Persistent state
                batchState={persistentBatch}
            />
        );
    } else if (appState.appMode === 'monitoring') {

        mainContent = (
            <PhaseMonitoreo
                params={params}
                pump={customPump}
                pumpCatalog={pumpCatalog}
                motorCatalog={motorCatalog}
                vsdCatalog={VSD_CATALOG}
                onBack={() => setAppState({ appMode: 'landing' })}

                onNavigateToDesign={(wellParams, wellPump) => {
                    setParams(wellParams);
                    if (wellPump) {
                        setCustomPump(wellPump);
                        if (!pumpCatalog.some(p => p && p.id === wellPump.id)) {
                            setPumpCatalog(prev => [...prev, wellPump]);
                        }
                    }
                    if (wellParams.survey) {
                        setRawSurvey(wellParams.survey.map(s => `${s.md}\t${s.tvd}`).join('\n'));
                    }
                    setActiveStep(4); // Phase 5 = Equipment/Design
                    setCameFromMonitoring(true);
                    setAppState({ appMode: 'main' });
                }}
            />
        );
    }

    // ── GLOBAL BACKGROUND (shared across ALL modes) ──
    const globalBackground = (
        <div className="aurora-bg">
            {/* Background Image Layer */}
            <div
                className="absolute inset-0 bg-center no-repeat opacity-25 filter blur-sm brightness-110 pointer-events-none"
                style={{
                    backgroundImage: "url('/main_bg.png')",
                    backgroundSize: "100% 100%"
                }}
            ></div>
            <div className="aurora-1 opacity-60"></div>
            <div className="aurora-2 opacity-40"></div>
            <div className="blueprint-grid absolute inset-0 opacity-10"></div>
            <div className="absolute top-[-10%] left-[20%] w-[30vw] h-[30vw] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[20%] w-[30vw] h-[30vw] bg-secondary/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        </div>
    );

    if (mainContent) return (
        <div className="relative min-h-screen">
            {globalBackground}
            {mainContent}
        </div>
    );

    return (
        <div className="flex h-screen font-sans overflow-hidden text-txt-main selection:bg-primary/30 transition-colors duration-500 relative">
            {globalBackground}

            {toast.show && (
                <div className="fixed top-20 right-8 z-[100] animate-fadeIn">
                    <div className="glass-morphism backdrop-blur-md border border-primary/50 shadow-[0_0_30px_rgba(var(--color-primary),0.3)] px-8 py-6 rounded-2xl flex items-start gap-4 max-w-md">
                        <div className="p-3 bg-primary/20 rounded-full text-primary shrink-0 mt-0.5"><AlertCircle className="w-6 h-6" /></div>
                        <div><h4 className="text-lg font-black text-txt-main uppercase tracking-wide mb-2">System Correction</h4><p className="text-sm font-medium text-txt-muted leading-relaxed">{toast.msg}</p></div>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="text-txt-muted hover:text-txt-main"><div className="w-2 h-2 rounded-full bg-slate-500"></div></button>
                    </div>
                </div>
            )}

            <PumpImportModal isOpen={showPumpModal} onClose={() => setShowPumpModal(false)} onSave={handlePumpImport} onImportProject={handleProjectImport} initialPump={customPump} initialMotorHp={params.motorHp} />
            <BatchDesignProcessor
                isOpen={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                pumpCatalog={pumpCatalog}
                motorCatalog={motorCatalog}
                initialDesigns={batchDesigns}
                initialSurveys={batchSurveys}
                initialFile={batchFile}
                onImported={(importedParams) => {
                    handleQuickDesignImport(importedParams);
                    setShowBatchModal(false);
                }}
            />

            <aside className="w-[300px] flex-none border-r border-white/5 bg-canvas/80 backdrop-blur-3xl flex flex-col z-30 shadow-[10px_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                {/* Brillo de borde lateral */}
                <div className="absolute right-0 top-0 w-[1px] h-full bg-gradient-to-b from-white/10 via-white/5 to-transparent"></div>
                <div className="p-8 pb-6 bg-gradient-to-b from-surface/40 to-transparent shrink-0 relative z-10">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-14 h-14 flex items-center justify-center group/logo transition-all duration-500">
                            <img src="/app-logo.svg" alt="Icono" className="w-full h-full object-contain filter drop-shadow-xl brightness-110 group-hover/logo:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="flex-1 flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-black text-txt-main uppercase tracking-tighter leading-none">{t('app.title')}</h1>
                                <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] mt-1 opacity-80">{t('app.subtitle')}</p>
                            </div>
                            <button
                                onClick={() => {
                                    const msg = language === 'es'
                                        ? "¿Estás seguro de volver al menú principal? Se perderán los cambios no guardados."
                                        : "Are you sure you want to return to the main menu? Unsaved changes will be lost.";
                                    if (window.confirm(msg)) {
                                        setAppState({ appMode: 'landing' });
                                    }
                                }}
                                title="Volver al Menú"
                                className="w-10 h-10 rounded-full glass-surface hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 flex items-center justify-center transition-all duration-500 group/back active:scale-90 shadow-lg"
                            >
                                <ArrowLeft className="w-5 h-5 text-txt-muted group-hover:text-red-500 group-hover:-translate-x-1 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 overflow-y-auto p-5 space-y-3.5 custom-scrollbar relative z-10">
                    <div className="text-[10px] font-black text-txt-muted uppercase tracking-[0.3em] mb-4 flex justify-between items-center px-2">
                        <span>{t('app.workflow')}</span>
                        <span className="text-primary font-mono">{activeStep + 1} / {steps.length}</span>
                    </div>
                    {steps.map((step, idx) => {
                        const isActive = activeStep === idx;
                        const isCompleted = idx < activeStep;
                        return (
                            <button key={step.id} onClick={() => setActiveStep(idx)} className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all duration-500 group relative overflow-hidden light-sweep ${isActive ? 'bg-gradient-to-r from-primary/20 to-secondary/10 border border-primary/40 shadow-glow-primary scale-[1.02] z-10' : isCompleted ? 'bg-surface/40 border border-surface-light/30 hover:bg-surface/80 text-txt-muted grayscale' : 'hover:bg-surface/50 border border-transparent opacity-60 grayscale hover:grayscale-0'}`}>
                                <div className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-primary text-white shadow-glow-primary' : isCompleted ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-light text-txt-muted group-hover:text-txt-main'}`}>
                                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <step.icon className="w-3.5 h-3.5" />}
                                </div>
                                <div className="text-left flex-1">
                                    <span className={`block font-black text-xs uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-txt-main scale-[1.02] origin-left' : 'text-txt-muted group-hover:text-txt-main'}`}>{step.label}</span>
                                </div>
                                {isActive && <ChevronRight className="w-4 h-4 text-primary animate-pulse" />}
                            </button>
                        )
                    })}
                    <div className="h-px w-full bg-gradient-to-r from-surface-light/50 to-transparent my-6"></div>


                </nav>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden relative">
                <header className="relative h-14 bg-canvas/60 backdrop-blur-md border-b border-surface-light/30 px-6 flex items-center justify-between z-20">
                    <div className="flex items-center gap-4">
                        {cameFromMonitoring && (
                            <button
                                onClick={() => {
                                    setCameFromMonitoring(false);
                                    setAppState({ appMode: 'monitoring' });
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white rounded-xl border border-secondary/20 transition-all text-[10px] font-black uppercase tracking-widest hover:shadow-glow-secondary/30 active:scale-95"
                            >
                                <Activity className="w-4 h-4" />
                                Volver a Flota
                            </button>
                        )}
                        <span className="text-txt-muted font-mono text-[10px] font-black tracking-widest opacity-60">P0{activeStep + 1}</span>
                        <div className="h-4 w-px bg-surface-light/50"></div>
                        <h2 className="text-[11px] font-black text-txt-main uppercase tracking-[0.2em]">{steps[activeStep].label}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={toggleLanguage} className="bg-surface/50 hover:bg-surface-light rounded-full w-10 h-10 flex items-center justify-center transition-all group relative cursor-pointer"><Globe className="w-4 h-4 text-txt-muted group-hover:text-primary" /></button>
                        <button onClick={cycleTheme} className="bg-surface/50 hover:bg-surface-light rounded-full w-10 h-10 flex items-center justify-center transition-all group relative cursor-pointer"><Palette className="w-4 h-4 text-txt-muted group-hover:text-primary" /></button>
                        <button onClick={toggleFullScreen} className="bg-surface/50 hover:bg-surface-light rounded-full w-10 h-10 flex items-center justify-center transition-all group relative cursor-pointer">{isFullscreen ? <Minimize className="w-4 h-4 text-txt-muted group-hover:text-primary" /> : <Maximize className="w-4 h-4 text-txt-muted group-hover:text-primary" />}</button>
                        <div className="w-px h-6 bg-surface-light mx-1"></div>

                        <div className="w-px h-6 bg-surface-light mx-1"></div>
                        <div className="relative group">
                            <button
                                className="bg-surface/50 hover:bg-surface-light rounded-full w-10 h-10 flex items-center justify-center transition-all group relative cursor-pointer"
                            >
                                <RotateCcw className="w-4 h-4 text-txt-muted group-hover:text-primary" />
                            </button>
                            {/* Exit Menu */}
                            <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-canvas border border-surface-light rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                <button
                                    onClick={() => setShowBatchModal(true)}
                                    className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-txt-muted hover:text-primary hover:bg-primary/5 transition-all"
                                >
                                    Ver Lista de Pozos
                                </button>
                                <button
                                    onClick={() => {
                                        setBatchView('idle');
                                        setBatchDesigns([]);
                                        setCameFromMonitoring(false);
                                        setAppState({ appMode: 'landing' });
                                    }}
                                    className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-txt-muted hover:text-secondary hover:bg-secondary/5 transition-all border-t border-surface-light/30"
                                >
                                    Salir al Menú Principal
                                </button>
                                {cameFromMonitoring && (
                                    <button
                                        onClick={() => {
                                            setCameFromMonitoring(false);
                                            setAppState({ appMode: 'monitoring' });
                                        }}
                                        className="w-full text-left px-4 py-2 text-[10px] font-black uppercase text-secondary hover:text-white hover:bg-secondary/20 transition-all border-t border-surface-light/30"
                                    >
                                        ⚡ Volver a Flota
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 relative">
                    <div className="max-w-[1920px] mx-auto animate-fadeIn relative z-10 min-h-full">
                        {activeStep === 0 && <Phase1 params={params} setParams={setParams} rawSurvey={rawSurvey} setRawSurvey={setRawSurvey} />}
                        {activeStep === 1 && <Phase2 params={params} setParams={setParams} />}
                        {activeStep === 2 && <Phase3 params={params} setParams={setParams} results={designResults} />}
                        {activeStep === 3 && <PhaseScenarios params={params} setParams={setParams} results={designResults} />}
                        {activeStep === 4 && <Phase5 params={params} setParams={setParams} customPump={customPump} setCustomPump={setCustomPump} pumpCatalog={pumpCatalog} motorCatalog={motorCatalog} setShowPumpModal={setShowPumpModal} curveData={curveData} match={match} results={matchResults} onCompare={(snapshot: any) => { setInitialDesignForComparator(snapshot); setAppState({ appMode: 'comparator' }); }} onReloadCatalog={() => loadCatalog()} />}
                        {activeStep === 5 && <PhaseSimulations params={params} setParams={setParams} pump={customPump} frequency={currentFrequency} />}
                        {activeStep === 6 && <Phase6 params={params} setParams={setParams} pump={customPump} designFreq={currentFrequency} />}
                    </div>
                </main>

                <footer className="h-12 bg-surface border-t border-surface-light px-8 flex items-center justify-between z-20">
                    <button onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0} className="text-xs font-black text-txt-muted hover:text-txt-main disabled:opacity-0 uppercase flex items-center gap-3 transition-all tracking-[0.2em]"><ChevronRight className="w-4 h-4 rotate-180" /> {t('footer.prev')}</button>
                    <div className="flex gap-4 items-center">
                        <div className="flex gap-2">{steps.map((_, idx) => <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === activeStep ? 'bg-primary w-8' : 'bg-surface-light w-2.5'}`}></div>)}</div>
                        <div className="ml-4 border-l-2 border-surface-light/50 pl-4 flex items-center gap-2">
                            <button onClick={() => setShowGlobalReportSelector(true)} className="flex items-center gap-3 text-[10px] font-black text-primary hover:text-white bg-primary/10 hover:bg-primary px-4 py-2 rounded-lg transition-all border border-primary/20 shadow-sm"><Printer className="w-3.5 h-3.5" /><span className="uppercase tracking-widest">{t('p5.designReport')}</span></button>
                            <button onClick={handleExportAll} className="flex items-center gap-3 text-[10px] font-black text-secondary hover:text-txt-main bg-secondary/10 hover:bg-secondary/20 px-4 py-2 rounded-lg transition-all border border-secondary/20 shadow-sm"><FileSpreadsheet className="w-3.5 h-3.5" /><span className="uppercase tracking-widest">{t('p5.report')}</span></button>
                        </div>
                    </div>
                    <button onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))} disabled={activeStep === steps.length - 1} className="bg-primary hover:bg-primary/80 text-white px-6 py-2.5 rounded-full font-black text-[10px] uppercase flex items-center gap-3 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 tracking-[0.2em]">{t('footer.next')} <ChevronRight className="w-3.5 h-3.5" /></button>
                </footer>
            </div>

            <aside className={`${isChatMinimized ? 'w-[64px]' : 'w-[400px]'} flex-none glass-surface flex flex-col overflow-hidden relative border-l border-surface-light/30 transition-all duration-500 ease-in-out shadow-glow-primary z-10`}>
                <div className="p-4 bg-gradient-to-b from-surface/40 to-transparent border-b border-surface-light/20 shadow-lg z-10 space-y-3 backdrop-blur-md shrink-0">
                    {isChatMinimized ? (
                        /* ── MINIMIZED: vertical icon + expand button ── */
                        <div className="flex flex-col items-center gap-3 py-1">
                            <div className="p-2.5 bg-gradient-to-br from-primary via-primary to-secondary rounded-[10px] shadow-glow-primary ring-2 ring-white/5">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <button
                                onClick={() => setIsChatMinimized(false)}
                                title="Abrir Asistente IA"
                                className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl border border-primary/30 transition-all active:scale-95 shadow-sm"
                            >
                                <Maximize2 className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        /* ── EXPANDED: full header ── */
                        <>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="p-2.5 bg-gradient-to-br from-primary via-primary to-secondary rounded-[10px] shadow-glow-primary ring-2 ring-white/5"><Sparkles className="w-5 h-5 text-white" /></div>
                                    <div onClick={() => setIsChatMinimized(true)} className="cursor-pointer group flex flex-col gap-0.5">
                                        <h3 className="text-sm font-black text-txt-main uppercase tracking-widest flex items-center gap-2 group-hover:text-primary transition-colors">ANTIGRAVITY AI <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span></h3>
                                        <p className="text-xs font-black text-primary tracking-widest opacity-80 uppercase leading-none">{t('ai.copilot')}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsChatMinimized(true)} className="p-2 hover:bg-surface-light rounded-xl text-txt-muted hover:text-primary transition-all active:scale-95"><ChevronDown className="w-5 h-5" /></button>
                            </div>
                            <div className="relative group">
                                <select value={aiScope} onChange={(e) => setAiScope(e.target.value === 'current' ? 'current' : parseInt(e.target.value))} className="w-full bg-surface/50 text-sm font-black text-txt-main border border-surface-light rounded-xl py-3 pl-4 pr-10 outline-none focus:border-primary/50 appearance-none cursor-pointer hover:bg-surface-light transition-all uppercase tracking-widest">
                                    <option value="current">⚡ Current Phase</option>
                                    <hr />
                                    {steps.map((s, i) => <option key={s.id} value={i}>Phase {i + 1}: {s.label}</option>)}
                                </select>
                                <ChevronDown className="w-5 h-5 text-txt-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-primary transition-colors" />
                            </div>
                        </>
                    )}
                </div>


                {!isChatMinimized && (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-canvas scroll-smooth text-sm">
                            {messages.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-40 space-y-2 py-8"><div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center border border-surface-light animate-pulse"><Sparkles className="w-6 h-6 text-primary/50" /></div><p className="text-[10px] font-black uppercase text-txt-muted tracking-widest">{t('ai.ready')}</p></div>}
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex flex-col gap-1.5 animate-fadeIn ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[95%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm border ${msg.role === 'user' ? 'bg-primary text-white border-primary/20 rounded-br-none' : 'bg-surface text-txt-main border-surface-light rounded-bl-none'}`}>
                                        <div className="markdown-content"><MarkdownRenderer content={msg.text} /></div>
                                    </div>
                                    <span className="text-[10px] font-black text-txt-muted px-3 uppercase opacity-60 tracking-widest">{msg.role === 'user' ? t('ai.user') : t('ai.ai')} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef}></div>
                        </div>
                        <div className="p-3 bg-surface border-t border-surface-light mt-auto">
                            <div className="flex items-center gap-2 bg-canvas border border-surface-light rounded-xl px-3 py-1.5 focus-within:border-primary/50 transition-all shadow-inner">
                                <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={handleKeyPress} placeholder={language === 'es' ? "Pregunte..." : "Ask..."} className="bg-transparent w-full text-xs font-bold text-txt-main outline-none placeholder:text-txt-muted/50" disabled={aiLoading} />
                                <button onClick={handleSendMessage} disabled={!userInput.trim() || aiLoading} className="p-2 bg-primary hover:bg-primary/90 text-white rounded-lg disabled:opacity-50 transition-all active:scale-95"><Send className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    </>
                )}
            </aside>
            {showGlobalReportSelector && <ReportSelectorModal isOpen={showGlobalReportSelector} onClose={() => setShowGlobalReportSelector(false)} onSelect={(type: string) => { setShowGlobalReportSelector(false); setGlobalReportConfig({ isOpen: true, type }); }} />}
            {globalReportConfig.isOpen && <DesignReport onClose={() => setGlobalReportConfig({ isOpen: false, type: 'target' })} type={globalReportConfig.type} params={params} pump={customPump} results={designResults} frequency={currentFrequency} motor={params.selectedMotor} cable={params.selectedCable} />}
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-surface-light), 0.8); border-radius: 3px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(var(--color-primary), 0.5); }`}</style>
        </div>
    );
};

export default App;
