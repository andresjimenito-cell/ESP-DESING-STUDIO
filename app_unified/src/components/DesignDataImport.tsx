import React, { useState } from 'react';
import { read, utils as xlsxUtils } from 'xlsx';
import { FileSpreadsheet, RefreshCw, FileCheck, AlertCircle, ArrowUpRight } from 'lucide-react';
import { SystemParams, SurveyPoint, PipeData } from '../types';
import { CASING_CATALOG, TUBING_CATALOG } from '../data';

interface DesignDataImportProps {
    onImported: (params: SystemParams) => void;
    language: string;
}

export const DesignDataImport: React.FC<DesignDataImportProps> = ({ onImported, language }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [msg, setMsg] = useState('');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setStatus('loading');
        setMsg('');

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const buffer = event.target?.result as ArrayBuffer;
                const workbook = read(new Uint8Array(buffer), { type: 'array' });
                const sheetNames = workbook.SheetNames;

                const designSheetName = sheetNames.find(s => {
                    const sn = String(s).toUpperCase();
                    return sn.includes('SLA') || sn.includes('DISEÑO') || sn.includes('DATOS');
                }) || sheetNames[0];

                const surveySheetName = sheetNames.find(s => {
                    const sn = String(s).toUpperCase();
                    return sn.includes('SURVEY') || sn.includes('TRAYEC') || sn.includes('DESVIACIÓN');
                });

                const surveyPoints: SurveyPoint[] = [];
                if (surveySheetName) {
                    const surveySheet = workbook.Sheets[surveySheetName];
                    let foundHeaderRow = 0;
                    for (let i = 0; i < 20; i++) {
                        const temp = xlsxUtils.sheet_to_json(surveySheet, { range: i, header: 1 }) as any[][];
                        if (temp.length > 0 && temp[0].some(c => String(c || '').toUpperCase().includes('DEPTH'))) {
                            foundHeaderRow = i;
                            break;
                        }
                    }
                    const jsonSurvey = xlsxUtils.sheet_to_json(surveySheet, { range: foundHeaderRow }) as any[];
                    jsonSurvey.forEach(row => {
                        const md = row['Measured Depth (ft)'] || row['MD (ft)'] || row['Measured Depth'] || row['MD'];
                        const tvd = row['Vertical Depth (ft)'] || row['TVD (ft)'] || row['Vertical Depth'] || row['TVD'];
                        const p = (v: any) => {
                            const raw = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : null);
                            return raw !== null && !isNaN(raw) ? Number(raw.toFixed(1)) : null;
                        };
                        const fm = p(md); const ft = p(tvd);
                        if (fm !== null && ft !== null && !isNaN(fm)) surveyPoints.push({ md: fm, tvd: ft });
                    });
                }

                const dataSheet = workbook.Sheets[designSheetName];
                const aoa = xlsxUtils.sheet_to_json(dataSheet, { header: 1 }) as any[][];

                const n = (val: any) => {
                    if (val == null || val === '') return 0;
                    if (typeof val === 'number') return isNaN(val) ? 0 : val;
                    let s = String(val).trim().replace(/\s+/g, ' ');
                    
                    // Handle fractions like 3 1/2 or 3-1/2
                    if (s.includes('/')) {
                        const match = s.match(/(\d+)?[\s-]?(\d+)\/(\d+)/);
                        if (match) {
                            const whole = parseFloat(match[1] || '0');
                            const num = parseFloat(match[2]);
                            const den = parseFloat(match[3]);
                            return Number((whole + (num / den)).toFixed(3));
                        }
                    }

                    let clean = s.replace(/[^*0-9.,-]/g, '').replace(/\*.*$/, '');
                    if (clean.includes(',') && clean.includes('.')) {
                        if (clean.indexOf(',') > clean.indexOf('.')) clean = clean.replace(/\./g, '').replace(',', '.');
                        else clean = clean.replace(/,/g, '');
                    } else if (clean.includes(',')) {
                        if (clean.split(',').pop()?.length === 3 && clean.split(',').length > 1) clean = clean.replace(/,/g, '');
                        else clean = clean.replace(',', '.');
                    }
                    const res = parseFloat(clean);
                    return isNaN(res) ? 0 : Number(res.toFixed(3));
                };

                const d = (val: any): string => {
                    if (val == null || val === '') return new Date().toISOString().split('T')[0];
                    if (val instanceof Date) return val.toISOString().split('T')[0];
                    if (typeof val === 'number' && val > 30000 && val < 60000) {
                        const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
                        return dateObj.toISOString().split('T')[0];
                    }
                    let s = String(val).trim().toLowerCase();
                    const esMonths: Record<string, string> = {
                        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
                        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
                    };
                    s = s.replace(/\./g, '');
                    for (const [abbr, num] of Object.entries(esMonths)) {
                        if (s.includes(abbr)) { s = s.replace(abbr, num); break; }
                    }
                    s = s.replace(/[\/\s]/g, '-');
                    const parts = s.split('-').filter(p => p.length > 0);
                    if (parts.length === 3 && parts[0].length <= 2) {
                        let day = parts[0], month = parts[1], year = parts[2];
                        if (year.length === 2) year = '20' + year;
                        if (day.length === 1) day = '0' + day;
                        if (month.length === 1) month = '0' + month;
                        const iso = `${year}-${month}-${day}`;
                        if (!isNaN(new Date(iso).getTime())) return iso;
                    }
                    const finalD = new Date(s);
                    return isNaN(finalD.getTime()) ? new Date().toISOString().split('T')[0] : finalD.toISOString().split('T')[0];
                };

                const getVal = (labels: string[]) => {
                    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, '');
                    const cleanLabels = labels.map(l => normalize(l));
                    for (let r = 0; r < Math.min(aoa.length, 300); r++) {
                        for (let c = 0; c < (aoa[r] || []).length; c++) {
                            const rawCell = normalize(String(aoa[r][c] || ''));
                            if (rawCell === '') continue;
                            for (const l of cleanLabels) {
                                if (rawCell === l || (rawCell.includes(l) && l.length >= 4)) {
                                    for (let rOff = 1; rOff <= 20; rOff++) {
                                        const v = aoa[r + rOff] ? aoa[r + rOff][c] : null;
                                        if (v !== null && v !== undefined && String(v).trim() !== '') return v;
                                    }
                                    const rightVal = aoa[r][c + 1];
                                    if (rightVal !== null && rightVal !== undefined && String(rightVal).trim() !== '') return rightVal;
                                }
                            }
                        }
                    }
                    return null;
                };

                const findKV = (labels: string[], offset: number = 1) => {
                    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, '');
                    const clean = labels.map(l => normalize(l));
                    for (let r = 0; r < aoa.length; r++) {
                        for (let c = 0; c < aoa[r].length; c++) {
                            const txt = normalize(String(aoa[r][c] || ''));
                            if (clean.some(l => txt !== '' && txt.includes(l))) return aoa[r][c + offset];
                        }
                    }
                    return null;
                };

                const mapToPipeData = (catalog: any[], descLabels: string[], odLabels: string[], idLabels: string[], defaultOD: number): PipeData => {
                    let odVal = n(getVal(odLabels));
                    if (odVal === 0) odVal = defaultOD;
                    const idVal = n(getVal(idLabels));
                    const rawDesc = String(getVal(descLabels) || '').toUpperCase();

                    // 1. Precise Match by OD
                    const options = catalog.filter(p => Math.abs(p.od - odVal) < 0.05);
                    let selected = options.length > 0 ? options[0] : catalog.find(c => Math.abs(c.od - defaultOD) < 0.05) || catalog[0];

                    if (options.length > 1) {
                        // Extract Weight using regex (Look for number followed by #, lb, or after x)
                        let extractedWeight = 0;
                        const weightMatch = rawDesc.match(/(?:X|\s|#|^)(\d+(?:\.\d+)?)\s*(?:#|LB|LBS)/i) || rawDesc.match(/X\s*(\d+(?:\.\d+)?)/i);
                        if (weightMatch) extractedWeight = parseFloat(weightMatch[1]);

                        // Extract Grade
                        const grades = ['K55', 'J55', 'N80', 'L80', 'P110', 'C95', 'K-55', 'J-55', 'N-80', 'L-80', 'P-110', 'C-95'];
                        const foundGrade = grades.find(g => rawDesc.replace(/[-\s]/g, '').includes(g.replace(/[-\s]/g, '')));

                        let bestScore = -1;
                        let bestMatch = selected;

                        for (const opt of options) {
                            let score = 0;
                            // Weight match (High priority)
                            if (extractedWeight > 0 && Math.abs(opt.weight - extractedWeight) < 0.2) score += 500;
                            
                            // Grade match
                            if (foundGrade && opt.description.replace(/[-\s]/g, '').includes(foundGrade.replace(/[-\s]/g, ''))) score += 300;

                            // ID match
                            if (idVal > 0 && Math.abs((opt.id_in || opt.id) - idVal) < 0.01) score += 200;

                            if (score > bestScore) {
                                bestScore = score;
                                bestMatch = opt;
                            }
                        }
                        selected = bestMatch;
                    }

                    return {
                        description: selected.description,
                        od: selected.od,
                        id: selected.id,
                        weight: selected.weight,
                        roughness: selected.roughness || 0.0006
                    };
                };

                const casing = mapToPipeData(CASING_CATALOG, ['DESCRIPCION CSG'], ['CSG OD (IN)', 'CSG OD'], ['CSG ID (IN)', 'CSG ID'], 7);
                const tubing = mapToPipeData(TUBING_CATALOG, ['DESCRIPCION TBG'], ['TBG OD (IN)', 'TBG OD'], ['TBG ID (IN)', 'TBG ID'], 3.5);

                const wellName = String(getVal(['POZO', 'WELL']) || 'NUEVO_POZO').trim();
                const testDate = d(getVal(['FECHA', 'DATE', 'FECHA DE PRUEBA', 'FECHA PRUEBA', 'DATE OF TEST']));

                const bfpdLabel = ['BFPD @ PIP MINIMA'];
                const bfpdObj = parseFloat(n(findKV(bfpdLabel, 1)).toFixed(1));
                const bfpdMin = parseFloat(n(findKV(bfpdLabel, 2)).toFixed(1));
                const bfpdMax = parseFloat(n(findKV(bfpdLabel, 3)).toFixed(1));

                const pStatic = n(getVal(['PESTATICA', 'P ESTATICA']));
                const pipMinima = n(getVal(['PIPMINIMA', 'PIP MINIMA']));
                const calculateRate = (idx: number) => {
                    const res = idx * (pStatic - pipMinima);
                    return res > 0 ? Number(res.toFixed(1)) : 0;
                };

                // Field Test Values (for history match)
                const freqRaw = getVal(['FRECUENCIA', 'HZ', 'FREQUENCY', 'FRECUENCIA DE OPERACION']);
                let testFreq = n(freqRaw) || 60;
                if (testFreq > 80) testFreq = testFreq / 2; // PMM normalization

                const testThp = n(getVal(['PRESION CABEZAL THP', 'PRESION CABEZAL (THP)', 'PRESION CABEZAL', 'THP (PSI)', 'THP', 'FTHP']));
                const testPip = n(getVal(['PIP (PSI)', 'PIP', 'INTAKE PRESSURE', 'PRESION SUCCION']));
                const testPdp = n(getVal(['PDP', 'PDESC', 'DISCHARGE PRESSURE', 'P-DISCHARGE']));

                const importedParams: SystemParams = {
                    metadata: {
                        projectName: wellName, wellName,
                        engineer: '', company: String(getVal(['TIPO DE POZO', 'TIPO']) || ''),
                        date: testDate,
                        comments: `IMPORTADO: ${String(getVal(['FORMACION']) || '')}`
                    },
                    historyMatch: {
                        rate: bfpdObj,
                        frequency: testFreq,
                        thp: testThp,
                        pip: testPip,
                        pdp: testPdp,
                        waterCut: (() => {
                            const raw = n(getVal(['BSW PRUEBA', 'BSW_PRUEBA', 'BSW', 'BSW (%)', 'WATER CUT (%)', 'CORTE DE AGUA', 'CORTE AGUA', 'CORTE_AGUA']));
                            return (raw > 0 && raw <= 1.0) ? raw * 100 : raw;
                        })(),
                        matchDate: testDate,
                        startDate: testDate,
                        tht: n(getVal(['THT', 'T-SURFACE'])) || 80,
                        hp: 0, gor: 0, pd: testPdp, fluidLevel: 0, submergence: 0,
                        pStatic: pStatic
                    },
                    wellbore: {
                        correlation: 'Hagedorn-Brown', casing, tubing,
                        casingTop: 0, tubingTop: 0,
                        casingBottom: n(getVal(['PROFUNDIDADTOTALMD', 'TOTALDEPTH', 'PROFUNDIDAD TOTAL'])),
                        tubingBottom: n(getVal(['INTAKEMD', 'INTAKE MD', 'PROFUNDIDAD DE INTAKE'])),
                        midPerfsMD: n(getVal(['TOPE DE PERFORADOS MD (FT)', 'TOPEDEPERFORADOS', 'TOPE DE PERFORADOS'])) || 8000
                    },
                    fluids: {
                        apiOil: n(getVal(['API', '°API'])),
                        geGas: n(getVal(['GEDELGAS'])),
                        waterCut: (() => {
                            const raw = n(getVal(['BSW', 'BSW (%)', 'WATER CUT (%)', 'CORTE DE AGUA', 'BSW PRUEBA', 'BSW_PRUEBA']));
                            return (raw > 0 && raw <= 1.0) ? raw * 100 : raw;
                        })(),
                        geWater: n(getVal(['GEDELAGUA'])),
                        salinity: n(getVal(['SALINIDAD'])),
                        pb: n(getVal(['P BURBUJA (PSI)', 'PBURBUJA'])),
                        gor: n(getVal(['GORSCFSTB', 'GOR'])),
                        glr: 0,
                        isDeadOil: n(getVal(['P BURBUJA (PSI)', 'PBURBUJA'])) <= 0,
                        co2: n(getVal(['CO2'])), h2s: n(getVal(['H2S'])), n2: n(getVal(['N2'])),
                        sandCut: n(getVal(['PRODUCCIONDESOLIDOS'])),
                        sandDensity: 2.65, pvtCorrelation: 'Lasater', viscosityModel: 'Total Fluid',
                        correlations: {
                            viscDeadOil: 'Beggs-Robinson', viscSatOil: 'Beggs-Robinson', viscUnsatOil: 'Vasquez-Beggs',
                            viscGas: 'Lee', viscWater: 'Matthews & Russell', oilDensity: 'Katz',
                            gasDensity: 'Beggs', waterDensity: 'Beggs', pbRs: 'Lasater',
                            oilComp: 'Vasquez-Beggs', oilFvf: 'Vasquez-Beggs', waterFvf: 'HP41C',
                            zFactor: 'Dranchuk-Purvis', surfaceTensionOil: 'Baker-Swerdloff', surfaceTensionWater: 'Hough'
                        }
                    },
                    inflow: {
                        model: 'Productivity Index', staticSource: 'BHP',
                        pStatic: pStatic,
                        ip: n(getVal(['IPBFPDPSI', 'IP(BFPD/PSI)'])) || 1.0, staticLevel: 0
                    },
                    pressures: {
                        totalRate: bfpdObj,
                        pht: n(getVal(['PRESION CABEZAL THP', 'PRESION CABEZAL (THP)', 'PRESION CABEZAL', 'THP (PSI)', 'THP (', 'THP', 'FTHP'])),
                        phc: n(getVal(['PRESION CASING CHP', 'PRESION CASING (CHP)', 'PRESION CASING', 'CHP (PSI)', 'CHP (', 'CHP'])),
                        pumpDepthMD: n(getVal(['INTAKE MD', 'INTAKE']))
                    },
                    targets: {
                        min: {
                            rate: calculateRate(n(getVal(['IPMINBFPDPSI', 'IPMIN(BFPD/PSI)']))) || bfpdMin,
                            ip: n(getVal(['IPMINBFPDPSI', 'IPMIN(BFPD/PSI)'])) || 1.0,
                            waterCut: (() => {
                                const raw = n(getVal(['BSWMIN', 'BSW MIN (%)', 'BSW MIN', 'BSW_MIN']));
                                return (raw > 0 && raw <= 1.0) ? raw * 100 : raw;
                            })() || 0,
                            gor: n(getVal(['GOR MIN'])) || 0,
                            frequency: 50
                        },
                        target: {
                            rate: bfpdObj,
                            ip: n(getVal(['IPBFPDPSI', 'IP(BFPD/PSI)'])) || 1.0,
                            waterCut: (() => {
                                const raw = n(getVal(['BSW (%)', 'BSW', 'WATER CUT (%)', 'CORTE DE AGUA', 'BSW PRUEBA', 'BSW_PRUEBA']));
                                return (raw > 0 && raw <= 1.0) ? raw * 100 : raw;
                            })(),
                            gor: n(getVal(['GOR (', 'GOR'])),
                            frequency: 60
                        },
                        max: {
                            rate: calculateRate(n(getVal(['IPMAXBFPDPSI', 'IPMAX(BFPD/PSI)']))) || bfpdMax,
                            ip: n(getVal(['IPMAXBFPDPSI', 'IPMAX(BFPD/PSI)'])) || 1.0,
                            waterCut: (() => {
                                const raw = n(getVal(['BSW MAX', 'BSW MAX (%)', 'BSW_MAX']));
                                return (raw > 0 && raw <= 1.0) ? raw * 100 : raw;
                            })() || 100,
                            gor: n(getVal(['GOR MAX'])) || 1000,
                            frequency: 70
                        }
                    },
                    activeScenario: 'target',
                    surfaceTemp: n(getVal(['THT'])), bottomholeTemp: n(getVal(['BHT'])),
                    totalDepthMD: n(getVal(['PROFUNDIDADTOTAL'])),
                    survey: surveyPoints, motorHp: 0, simulation: { annualWearPercent: 0, simulationMonths: 36, costPerKwh: 0.12 }
                };

                setStatus('success');
                setTimeout(() => { onImported(importedParams); setStatus('idle'); setLoading(false); }, 1000);

            } catch (err: any) {
                console.error("IMPORT ERROR:", err);
                setStatus('error');
                setMsg(err.message);
                setLoading(false);
                setTimeout(() => setStatus('idle'), 6000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <>
            <label className={`
                group relative flex items-center justify-between w-full h-16 rounded-2xl px-6
                font-black uppercase tracking-[0.2em] text-[11px] cursor-pointer
                transition-all duration-500 shadow-xl active:scale-[0.98] border border-white/10
                ${status === 'success' ? 'bg-success text-white' :
                    status === 'error' ? 'bg-danger text-white' :
                        'bg-white/5 hover:bg-white/10 text-txt-muted hover:text-white'}
            `}>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${status === 'idle' ? 'bg-primary/10 text-primary' : 'bg-white/20'}`}>
                        {status === 'loading' ? <RefreshCw className="w-5 h-5 animate-spin" /> :
                            status === 'success' ? <FileCheck className="w-5 h-5" /> :
                                status === 'error' ? <AlertCircle className="w-5 h-5 animate-shake" /> :
                                    <FileSpreadsheet className="w-5 h-5" />}
                    </div>
                    <span className="leading-tight">
                        {status === 'loading' ? 'Procesando...' :
                            status === 'success' ? '¡Todo Listo!' :
                                status === 'error' ? 'Error Detectado' :
                                    'Diseño Automático'}
                    </span>
                </div>
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={loading} />
                <ArrowUpRight className="w-4 h-4 opacity-30 group-hover:opacity-100" />
            </label>
            {status === 'error' && <span className="text-[9px] text-danger font-black uppercase tracking-widest mt-2">{msg}</span>}
        </>
    );
};
