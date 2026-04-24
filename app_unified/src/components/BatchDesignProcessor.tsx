import React, { useState, useCallback } from 'react';
import { read, utils as xlsxUtils } from 'xlsx';
import {
    X, FileSpreadsheet, Search, ChevronRight, CheckCircle2, Upload, RefreshCw
} from 'lucide-react';
import { SystemParams, SurveyPoint, PipeData } from '../types';
import { CASING_CATALOG, TUBING_CATALOG } from '../data';

interface BatchDesignProcessorProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: (params: SystemParams) => void;
    pumpCatalog?: any[];
    motorCatalog?: any[];
    initialDesigns?: Record<string, any>[];
    initialSurveys?: Record<string, SurveyPoint[]>;
    initialFile?: string;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const n = (val: any): number => {
    if (val == null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    // Robust cleaning
    let s = String(val).trim().replace(/[^*0-9.,-]/g, '').replace(/\*.*$/, '');
    if (s.includes(',') && s.includes('.')) {
        if (s.indexOf(',') > s.indexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
    } else if (s.includes(',')) {
        if (s.split(',').pop()?.length === 3 && s.split(',').length > 1) s = s.replace(/,/g, '');
        else s = s.replace(',', '.');
    }
    const r = parseFloat(s);
    return isNaN(r) ? 0 : r;
};
const s = (val: any): string => (val == null ? '' : String(val).trim());
const d = (val: any): string => {
    if (val == null || val === '') return new Date().toISOString().split('T')[0];
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number' && val > 30000 && val < 60000) {
        const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
        return dateObj.toISOString().split('T')[0];
    }
    let str = String(val).trim().toLowerCase();
    const esMonths: Record<string, string> = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    str = str.replace(/\./g, '');
    for (const [abbr, num] of Object.entries(esMonths)) {
        if (str.includes(abbr)) { str = str.replace(abbr, num); break; }
    }
    str = str.replace(/[\/\s]/g, '-');
    const parts = str.split('-').filter(p => p.length > 0);
    if (parts.length === 3 && parts[0].length <= 2) {
        let day = parts[0], month = parts[1], year = parts[2];
        if (year.length === 2) year = '20' + year;
        if (day.length === 1) day = '0' + day;
        if (month.length === 1) month = '0' + month;
        const iso = `${year}-${month}-${day}`;
        if (!isNaN(new Date(iso).getTime())) return iso;
    }
    const finalD = new Date(str);
    return isNaN(finalD.getTime()) ? new Date().toISOString().split('T')[0] : finalD.toISOString().split('T')[0];
};

// Normalize string for comparison: strip accents, uppercase, keep only alphanum
const norm = (str: string) =>
    String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Find a value within an object (JSON row) by trying several possible header names
const get = (row: Record<string, any>, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    const normRowKeys = rowKeys.map(norm);

    // PRIORITY 1: Exact matches for any of the keys
    for (const key of keys) {
        const nk = norm(key);
        const idxExact = normRowKeys.indexOf(nk);
        if (idxExact !== -1) return row[rowKeys[idxExact]];
    }

    // PRIORITY 2: Partial matches only if no exact match was found for ANY key
    for (const key of keys) {
        const nk = norm(key);
        if (nk.length > 4) { // Only do partial for descriptive keys
            const idxPartial = normRowKeys.findIndex(nk2 => nk2.includes(nk) || nk.includes(nk2));
            if (idxPartial !== -1) return row[rowKeys[idxPartial]];
        }
    }
    return null;
};

const findPipeData = (catalog: any[], od: number, fallback: number): PipeData => {
    const opts = catalog.filter(c => Math.abs(c.od - od) < 0.05);
    const sel = opts[0] || catalog.find(c => Math.abs(c.od - fallback) < 0.05) || catalog[0];
    return { description: sel?.description || '', od: sel?.od || fallback, id: sel?.id || fallback * 0.8, weight: sel?.weight || 30, roughness: sel?.roughness || 0.0006 };
};

const rowToParams = (row: Record<string, any>, surveys: Record<string, SurveyPoint[]>): SystemParams => {
    const wellName  = s(get(row, ['POZO', 'WELL']));
    const testDate  = d(get(row, ['FECHA', 'DATE', 'FECHA DE PRUEBA', 'TIMESTAMP']));
    const pStatic   = n(get(row, ['P ESTATICA (PSI)', 'P ESTATICA', 'STATIC PRESSURE', 'PESTATICA']));
    const pipMin    = n(get(row, ['PIP MINIMA (PSI)', 'PIP MINIMA', 'PIPMINIMA', 'MIN PIP']));
    const ip        = n(get(row, ['IP (BFPD/PSI)', 'IP (BFP/PSI)', 'PRODUCTIVITY INDEX', 'PI (BFPD/PSI)']));
    const ipMin     = n(get(row, ['IP MÍN (BFPD/PSI)', 'IP MIN (BFPD/PSI)', 'IP MIN', 'IP MÍN', 'MIN IP']));
    const ipMax     = n(get(row, ['IP MÁX (BFPD/PSI)', 'IP MAX (BFPD/PSI)', 'IP MAX', 'IP MÁX', 'MAX IP']));
    const targetQ   = n(get(row, ['CAUDAL OBJETIVO (BFPD)', 'CAUDAL OBJETIVO', 'TARGET RATE (BFPD)', 'TARGET RATE', 'CAUDAL']));
    const bsw_raw   = n(get(row, ['BSW PRUEBA', 'BSW_PRUEBA', 'BSW (%)', 'WATER CUT (%)', 'BSW', 'CORTE DE AGUA', 'CORTE AGUA', 'CORTE_AGUA']));
    const bsw       = (bsw_raw > 0 && bsw_raw <= 1.0) ? bsw_raw * 100 : bsw_raw;
    const bswMinRaw = n(get(row, ['BSW MIN (%)', 'BSW MIN', 'BSW_MIN']));
    const bswMin    = (bswMinRaw > 0 && bswMinRaw <= 1.0) ? bswMinRaw * 100 : bswMinRaw;
    const bswMaxRaw = n(get(row, ['BSW MAX (%)', 'BSW MAX', 'BSW_MAX']));
    const bswMax    = (bswMaxRaw > 0 && bswMaxRaw <= 1.0) ? bswMaxRaw * 100 : bswMaxRaw;
    const gorTarget = n(get(row, ['GOR (SCF/STB)', 'GOR (SCFSTB)', 'GOR']));
    const gorMin    = n(get(row, ['GOR MIN']));
    const gorMax    = n(get(row, ['GOR MAX']));
    const intakeMD  = n(get(row, ['PROFUNDIDAD DE INTAKE MD (FT)', 'INTAKE MD', 'INTAKEMD']));
    const topePerf  = n(get(row, ['TOPE DE PERFORADOS MD (FT)', 'TOPE DE PERFORADOS']));
    const basePerf  = n(get(row, ['BASE DE PERFORADOS MD (FT)', 'BASE DE PERFORADOS']));
    const totalMD   = n(get(row, ['PROFUNDIDAD TOTAL MD (FT)', 'PROFUNDIDAD TOTAL MD']));
    const tht       = n(get(row, ['THT (°F)', 'THT']));
    const bht       = n(get(row, ['BHT (°F)', 'BHT']));
    const csgOd     = n(get(row, ['CSG OD (IN)', 'CSG OD']));
    const tbgOd     = n(get(row, ['TBG OD (IN)', 'TBG OD']));
    const tbgId     = n(get(row, ['TBG ID (IN)', 'TBG ID']));
    const pht       = n(get(row, ['THP (PSI)', 'THP']));
    const phc       = n(get(row, ['CHP (PSI)', 'CHP']));
    const api       = n(get(row, ['°API', 'API']));
    const geWater   = n(get(row, ['GE DEL AGUA', 'GE AGUA'])) || 1.05;
    const geGas     = n(get(row, ['GE DEL GAS', 'GE GAS'])) || 0.7;
    const sal       = n(get(row, ['SALINIDAD (PPM)', 'SALINIDAD']));
    const pb        = n(get(row, ['P BURBUJA (PSI)', 'PBURBUJA']));
    const campo     = s(get(row, ['CAMPO']));
    const resp      = s(get(row, ['RESPONSABLE DISENO PROVEEDOR', 'RESPONSABLE DISEÑO PROVEEDOR']));
    const formacion = s(get(row, ['FORMACION PRODUCTORA', 'FORMACION']));

    const midPerfs  = (topePerf + basePerf) / 2 || intakeMD + 200;
    const survey    = surveys[wellName] || [];
    // If no targetQ is provided, use 65% of potential drawdown for a more realistic "center" design
    const aof       = ip * pStatic;
    const rate      = (ipv: number) => {
        // PRIORITY A: Target Flow from Excel if exists
        if (targetQ > 0) return Number(Math.min(targetQ, aof * 0.90).toFixed(2)); // Cap at 90%
        
        // PRIORITY B: Geometric drawdown (User specified 65% for balance)
        const availableLift = Math.max(0, pStatic - pipMin);
        const calcVal = ipv * availableLift * 0.65;
        return Number(Math.max(100, calcVal).toFixed(2));
    };

    const casing = findPipeData(CASING_CATALOG, csgOd || 7, 7);
    const tubing = findPipeData(TUBING_CATALOG, tbgOd || 3.5, 3.5);
    if (tbgId > 0) tubing.id = tbgId;

    // Field Test Values for History Match
    const freqRaw = get(row, ['FRECUENCIA', 'HZ', 'FREQUENCY', 'FRECUENCIA DE OPERACION']);
    let testFreq = n(freqRaw) || 60;
    if (testFreq > 80) testFreq = testFreq / 2; // PMM normalization

    const testPip = n(get(row, ['PIP (PSI)', 'PIP', 'INTAKE PRESSURE', 'PRESION SUCCION']));
    const testPdp = n(get(row, ['PDP', 'PDESC', 'DISCHARGE PRESSURE']));

    return {
        metadata: { projectName: wellName, wellName, engineer: resp, company: campo, date: testDate, comments: `Batch | ${formacion}` },
        historyMatch: {
            rate: targetQ || rate(ip),
            frequency: testFreq,
            thp: pht || 50,
            pip: testPip,
            pdp: testPdp,
            waterCut: bsw,
            matchDate: testDate,
            startDate: testDate,
            tht: tht || 80,
            hp: 0, gor: gorTarget, pd: testPdp, fluidLevel: 0, submergence: 0,
            pStatic: pStatic
        },
        wellbore: { correlation: 'Hagedorn-Brown', casing, tubing, casingTop: 0, tubingTop: 0, casingBottom: totalMD, tubingBottom: intakeMD || totalMD * 0.85, midPerfsMD: midPerfs },
        fluids: {
            apiOil: api || 30, geGas, waterCut: bsw, geWater, salinity: sal, pb, gor: gorTarget,
            glr: gorTarget * (1 - bsw / 100), isDeadOil: pb <= 0,
            co2: n(get(row, ['CO2 % MOLAR', 'CO2'])), h2s: n(get(row, ['H2S % MOLAR', 'H2S'])), n2: n(get(row, ['N2 % MOLAR', 'N2'])),
            sandCut: n(get(row, ['PRODUCCION DE SOLIDOS (PTB)', 'PRODUCCION DE SOLIDOS'])), sandDensity: 2.65,
            pvtCorrelation: 'Lasater', viscosityModel: 'Total Fluid',
            correlations: { viscDeadOil: 'Beggs-Robinson', viscSatOil: 'Beggs-Robinson', viscUnsatOil: 'Vasquez-Beggs', viscGas: 'Lee', viscWater: 'Matthews & Russell', oilDensity: 'Katz', gasDensity: 'Beggs', waterDensity: 'Beggs', pbRs: 'Lasater', oilComp: 'Vasquez-Beggs', oilFvf: 'Vasquez-Beggs', waterFvf: 'HP41C', zFactor: 'Dranchuk-Purvis', surfaceTensionOil: 'Baker-Swerdloff', surfaceTensionWater: 'Hough' }
        },
        inflow: { model: 'Productivity Index', staticSource: 'BHP', pStatic, ip: ip || 1.0, staticLevel: 0 },
        pressures: { totalRate: rate(ip), pht: pht || 50, phc: phc || 50, pumpDepthMD: intakeMD || totalMD * 0.85 },
        targets: {
            min:    { rate: rate(ipMin  || ip * 0.8), ip: ipMin  || ip * 0.8, waterCut: bswMin || bsw,  gor: gorMin  || gorTarget, frequency: 50 },
            target: { rate: rate(ip),                 ip,                      waterCut: bsw,            gor: gorTarget,            frequency: 60 },
            max:    { rate: rate(ipMax  || ip * 1.25), ip: ipMax  || ip * 1.25, waterCut: bswMax || bsw,  gor: gorMax  || gorTarget * 1.2, frequency: 70 }
        },
        activeScenario: 'target',
        surfaceTemp: tht || 80, bottomholeTemp: bht || 200, totalDepthMD: totalMD,
        survey, motorHp: 0,
        simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0.12 },
        initialPumpName: s(get(row, ['BOMBA', 'PUMP', 'EQUIPO DE BOMBEO'])),
        initialStages: n(get(row, ['ETAPAS', 'ETAPAS DE LA BOMBA', '# ETAPAS', 'NUMERO DE ETAPAS'])),
        initialMotorName: s(get(row, ['MOTOR', 'MOTOR MODEL', 'EQUIPO DE MOTOR'])),
        initialMotorHp: n(get(row, ['MOTOR HP', 'HP MOTOR', 'POTENCIA MOTOR', 'RATED HP'])),
        initialCableName: s(get(row, ['CABLE', 'CABLE MODEL', 'TIPO DE CABLE'])),
        initialVSDName: s(get(row, ['VSD', 'VARIADOR', 'DRIVE']))
    };
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export const BatchDesignProcessor: React.FC<BatchDesignProcessorProps> = ({
    isOpen, onClose, onImported, initialDesigns, initialSurveys, initialFile
}) => {
    const [status, setStatus]           = useState<'idle' | 'loading' | 'list'>('idle');
    const [designs, setDesigns]         = useState<Record<string, any>[]>([]);
    const [surveys, setSurveys]         = useState<Record<string, SurveyPoint[]>>({});
    const [searchQ, setSearchQ]         = useState('');
    const [fileName, setFileName]       = useState('');
    const [selected, setSelected]       = useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen && initialDesigns && initialDesigns.length > 0) {
            setDesigns(initialDesigns);
            setSurveys(initialSurveys || {});
            setFileName(initialFile || 'Pre-cargado');
            setStatus('list');
        } else if (isOpen && (!initialDesigns || initialDesigns.length === 0)) {
            setStatus('idle');
            setDesigns([]);
            setSurveys({});
        }

        if (!isOpen) {
            setSelected(null);
        }
    }, [isOpen, initialDesigns, initialSurveys, initialFile]);

    // ── Parse uploaded file ────────────────────────────────────────────────
    const handleFile = useCallback(async (file: File) => {
        setStatus('loading');
        setDesigns([]);
        setSelected(null);
        setFileName(file.name);

        const buf = await file.arrayBuffer();
        const wb  = read(new Uint8Array(buf), { type: 'array' });

        // ── 1. Parse surveys ──────────────────────────────────────────────
        const surveyMap: Record<string, SurveyPoint[]> = {};
        const surveySheet = wb.SheetNames.find(n => n.toUpperCase().includes('SURVEY') || n.toUpperCase().includes('TRAYEC'));
        if (surveySheet) {
            const rows: any[] = xlsxUtils.sheet_to_json(wb.Sheets[surveySheet], { defval: '' });
            rows.forEach(row => {
                const well = s(get(row, ['POZO', 'WELL']));
                const md   = n(get(row, ['MEASURED DEPTH (FT)', 'MEASURED DEPTH', 'MD (FT)', 'MD']));
                const tvd  = n(get(row, ['VERTICAL DEPTH (FT)', 'VERTICAL DEPTH', 'TVD (FT)', 'TVD']));
                if (well && md > 0) {
                    if (!surveyMap[well]) surveyMap[well] = [];
                    surveyMap[well].push({ md, tvd });
                }
            });
            Object.keys(surveyMap).forEach(w => surveyMap[w].sort((a, b) => a.md - b.md));
        }

        // ── 2. Parse Data Diseño ──────────────────────────────────────────
        const designSheet = wb.SheetNames.find(n => {
            const u = n.toUpperCase();
            return u.includes('DATA DISE') || u.includes('DISE') || u.includes('DATA');
        }) || wb.SheetNames[0];

        // Use sheet_to_json with header:1 to get arrays, then find header row
        const rawAoA: any[][] = xlsxUtils.sheet_to_json(wb.Sheets[designSheet], { header: 1, defval: '' });

        // Find the row that contains "DISEÑO" or "POZO" or "CAMPO"  → that's the header row
        let hdrIdx = 0;
        for (let i = 0; i < Math.min(rawAoA.length, 15); i++) {
            const row = rawAoA[i] || [];
            const rowStr = row.map(c => norm(String(c))).join('|');
            if (rowStr.includes('POZO') || rowStr.includes('CAMPO') || rowStr.includes('DISENO')) {
                hdrIdx = i;
                break;
            }
        }

        const headers: string[] = (rawAoA[hdrIdx] || []).map((c: any) => s(c));

        // Convert remaining rows to objects using those headers
        const jsonRows: Record<string, any>[] = rawAoA.slice(hdrIdx + 1)
            .filter(row => row && row.some(c => c !== '' && c !== null && c !== undefined))
            .map(row => {
                const obj: Record<string, any> = {};
                headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ''; });
                return obj;
            })
            .filter(obj => {
                // Must have at least a well name or a Design #
                const hasWell    = s(get(obj, ['POZO'])) !== '';
                const hasDesignN = s(get(obj, ['DISEÑO #', 'DISENO #', 'DISEÑO', 'DISENO'])) !== '';
                return hasWell || hasDesignN;
            });

        setSurveys(surveyMap);
        setDesigns(jsonRows);
        setStatus('list');
    }, []);

    // ── Select & load one design ───────────────────────────────────────────
    const handleSelect = (row: Record<string, any>, key: string) => {
        setSelected(key);
        try {
            const params = rowToParams(row, surveys);
            setTimeout(() => {
                onImported(params); // load into main app
                onClose();
                setSelected(null); // Clear selection for next time
            }, 500);
        } catch {
            setSelected(null);
        }
    };

    if (!isOpen) return null;

    // Build display list filtered by search
    const filtered = designs.filter(row => {
        if (!searchQ) return true;
        const q = searchQ.toLowerCase();
        const well   = s(get(row, ['POZO'])).toLowerCase();
        const campo  = s(get(row, ['CAMPO'])).toLowerCase();
        const id     = s(get(row, ['ID POZO-FECHA', 'DISENO #', 'DISEÑO #'])).toLowerCase();
        const dNum   = s(get(row, ['DISEÑO #', 'DISENO #'])).toLowerCase();
        return well.includes(q) || campo.includes(q) || id.includes(q) || dNum.includes(q);
    });

    const surveyCount = Object.keys(surveys).length;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-xl animate-fadeIn">
            <div className="relative glass-surface border border-white/10 rounded-[2.5rem] w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">

                {/* accent */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

                {/* HEADER ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-2xl bg-primary/20 border border-primary/20">
                            <FileSpreadsheet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-txt-main uppercase tracking-tighter">
                                {status === 'idle' ? 'Cargar Base de Diseños' :
                                 status === 'loading' ? 'Leyendo archivo...' :
                                 'Seleccionar Diseño'}
                            </h2>
                            <p className="text-[9px] text-txt-muted font-black uppercase tracking-[0.2em] opacity-60 mt-0.5">
                                {status === 'idle'   ? 'Excel con hojas "Data Diseño" y "Survey"' :
                                 status === 'loading' ? fileName :
                                 `${designs.length} diseños en "${fileName}" · Haz clic en uno para cargarlo`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 glass-surface-light hover:bg-white/10 rounded-xl border border-white/5 transition-all group">
                        <X className="w-4 h-4 text-txt-muted group-hover:text-white" />
                    </button>
                </div>

                {/* BODY ───────────────────────────────────────────────── */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">

                    {/* ─ IDLE: upload area */}
                    {status === 'idle' && (
                        <div className="flex-1 flex items-center justify-center p-10">
                            <label className="w-full max-w-md flex flex-col items-center justify-center gap-5 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-500 p-16 group">
                                <input type="file" accept=".xlsx,.xls" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                                <Upload className="w-14 h-14 text-txt-muted group-hover:text-primary transition-colors duration-500" />
                                <div className="text-center space-y-1">
                                    <div className="text-sm font-black text-txt-main uppercase tracking-wider">Seleccionar archivo Excel</div>
                                    <div className="text-[9px] text-txt-muted font-bold uppercase opacity-60">Hojas: "Data Diseño" + "Survey" · .xlsx / .xls</div>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* ─ LOADING */}
                    {status === 'loading' && (
                        <div className="flex-1 flex items-center justify-center gap-4">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-[11px] font-black text-txt-muted uppercase tracking-widest animate-pulse">Procesando hoja...</span>
                        </div>
                    )}

                    {/* ─ LIST */}
                    {status === 'list' && (
                        <>
                            {/* Search + reload */}
                            <div className="flex gap-3 p-4 pb-2 shrink-0">
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 text-txt-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text" value={searchQ}
                                        onChange={e => setSearchQ(e.target.value)}
                                        placeholder="Buscar por Diseño #, pozo, campo..."
                                        className="w-full bg-canvas/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[10px] font-black text-txt-main outline-none focus:border-primary/40 uppercase placeholder:normal-case placeholder:tracking-normal"
                                    />
                                </div>
                                <label className="flex items-center gap-2 px-4 py-2 rounded-xl glass-surface-light border border-white/5 text-[9px] font-black text-txt-muted hover:text-white cursor-pointer transition-all shrink-0">
                                    <FileSpreadsheet className="w-3.5 h-3.5" /> Otro archivo
                                    <input type="file" accept=".xlsx,.xls" className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                                </label>
                            </div>

                            {/* Column headers */}
                            <div className="px-4 pb-1 shrink-0">
                                <div className="grid px-4 py-2 rounded-lg bg-white/5" style={{ gridTemplateColumns: '56px 1fr 130px 80px 80px 85px 28px' }}>
                                    {['DISEÑO #', 'POZO / CAMPO', 'ID DISEÑO', 'P ESTÁT.', 'IP', 'CAUDAL OBJ', ''].map(h => (
                                        <div key={h} className="text-[7px] font-black text-txt-muted uppercase tracking-widest">{h}</div>
                                    ))}
                                </div>
                            </div>

                            {/* Rows */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-1 min-h-0 pt-1">
                                {filtered.length === 0 && (
                                    <div className="text-center py-12 text-[10px] text-txt-muted font-black uppercase opacity-40">
                                        Sin resultados
                                    </div>
                                )}
                                {filtered.map((row, i) => {
                                    const wellName  = s(get(row, ['POZO']));
                                    const campo     = s(get(row, ['CAMPO']));
                                    const designNum = s(get(row, ['DISEÑO #', 'DISENO #']));
                                    const idPozo    = s(get(row, ['ID POZO-FECHA']));
                                    const pStat     = n(get(row, ['P ESTATICA (PSI)', 'P ESTATICA']));
                                    const pipMin    = n(get(row, ['PIP MINIMA (PSI)', 'PIP MINIMA']));
                                    const ip        = n(get(row, ['IP (BFPD/PSI)']));
                                    const rate      = Math.max(0, ip * Math.max(0, pStat - pipMin));
                                    const hasSvy    = !!surveys[wellName];
                                    const rowKey    = `${designNum}-${wellName}-${i}`;
                                    const isChosen  = selected === rowKey;

                                    return (
                                        <button
                                            key={rowKey}
                                            onClick={() => handleSelect(row, rowKey)}
                                            disabled={!!selected}
                                            className={`w-full grid px-4 py-3 rounded-2xl text-left transition-all duration-300 border ${
                                                isChosen
                                                    ? 'bg-primary/20 border-primary scale-[1.01] shadow-glow-primary/20'
                                                    : 'glass-surface-light border-white/5 hover:border-primary/30 hover:bg-white/5'
                                            }`}
                                            style={{ gridTemplateColumns: '56px 1fr 130px 80px 80px 85px 28px' }}
                                        >
                                            {/* Diseño # */}
                                            <div className={`text-sm font-black font-mono self-center ${isChosen ? 'text-primary' : 'text-txt-muted'}`}>
                                                {designNum || `#${i + 1}`}
                                            </div>

                                            {/* Pozo + campo */}
                                            <div className="self-center min-w-0 pr-2">
                                                <div className={`text-[10px] font-black uppercase truncate ${isChosen ? 'text-primary' : 'text-txt-main'}`}>
                                                    {wellName || '—'}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[7px] text-txt-muted opacity-50 font-bold uppercase truncate">{campo}</span>
                                                    {hasSvy && (
                                                        <span className="text-[6px] font-black text-secondary/80 border border-secondary/20 rounded px-1">SVY✓</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ID */}
                                            <div className="text-[8px] font-black text-txt-muted font-mono self-center truncate pr-2">{idPozo}</div>

                                            {/* Presión */}
                                            <div className="text-[9px] font-black text-txt-main font-mono self-center">
                                                {pStat > 0 ? `${pStat.toFixed(0)} psi` : <span className="opacity-30">—</span>}
                                            </div>

                                            {/* IP */}
                                            <div className="text-[9px] font-black text-txt-main font-mono self-center">
                                                {ip > 0 ? ip.toFixed(2) : <span className="opacity-30">—</span>}
                                            </div>

                                            {/* Caudal */}
                                            <div className={`text-[9px] font-black font-mono self-center ${rate > 0 ? 'text-primary' : 'text-txt-muted opacity-30'}`}>
                                                {rate > 0 ? `${rate.toFixed(0)} BPD` : '—'}
                                            </div>

                                            {/* Arrow/check */}
                                            <div className="self-center flex justify-end">
                                                {isChosen
                                                    ? <CheckCircle2 className="w-4 h-4 text-primary" />
                                                    : <ChevronRight className="w-4 h-4 text-txt-muted opacity-20 group-hover:opacity-100" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* FOOTER ─────────────────────────────────────────────── */}
                <div className="border-t border-white/5 p-4 flex items-center justify-between shrink-0">
                    <div className="text-[8px] font-black text-txt-muted opacity-40 uppercase tracking-widest">
                        {status === 'list'
                            ? `${filtered.length} / ${designs.length} diseños · ${surveyCount} surveys`
                            : 'ESP Designer · Diseño Masivo'}
                    </div>
                    <button onClick={onClose} className="px-5 py-2 rounded-xl glass-surface-light border border-white/5 text-[9px] font-black text-txt-muted hover:text-white uppercase tracking-widest transition-all">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
