import React from 'react';
import * as XLSX from 'xlsx';
import { SystemParams, EspPump, WellFleetItem, ProductionTest, SurveyPoint, PipeData } from '@/types';
import { CASING_CATALOG, TUBING_CATALOG } from '@/data';
import {
    s_ext, d_ext, n_ext, norm_ext, fuzzyWellName, get_ext,
    smartMatchExt, exactMatchExt
} from './PhaseMonitoreo.helpers';
import { INITIAL_PARAMS } from './PhaseMonitoreo.constants';

export const usePhaseMonitoreoImport = (
    setFleet: React.Dispatch<React.SetStateAction<WellFleetItem[]>>,
    setCustomDesigns: React.Dispatch<React.SetStateAction<Record<string, SystemParams>>>,
    setWellsHistoricalData: React.Dispatch<React.SetStateAction<Record<string, ProductionTest[]>>>,
    setImportProgress: React.Dispatch<React.SetStateAction<any>>,
    setWellViewMode: React.Dispatch<React.SetStateAction<any>>,
    fleet: WellFleetItem[],
    selectedWellId: string | null,
    pumpCatalog: EspPump[],
    motorCatalog: any[],
    vsdCatalog: any[]
) => {
    const processExcelDesignsBuffer = async (data: any, isAutoLoad = false, isPrecalcJson = false) => {
        try {
            if (isAutoLoad && !isPrecalcJson) {
                setImportProgress({ current: 5, total: 100, label: 'Conectando Base de Datos Lenta (XLSX)...' });
                await new Promise(r => setTimeout(r, 500));
            }

            let json: any[] = [];
            let jsonSurvey: any[] = [];
            let bestDetectedWellName = '';
            const surveyDataByWell: Record<string, SurveyPoint[]> = {};
            const mechDataMap: Record<string, any> = {};

            if (isPrecalcJson) {
                json = data.data || [];
                jsonSurvey = data.survey || [];
                // Support mechanical data in JSON
                const mechData = data.mech || [];
                (mechData as any[]).forEach(row => {
                    const n = norm_ext(String(get_ext(row, ['NICK', 'POZO', 'WELL']) || ''));
                    if (n) mechDataMap[n] = row;
                });
            } else {
                // 1. Read sheet names first (extremely fast and memory efficient)
                const tempWorkbook = XLSX.read(data, { bookSheets: true });
                const sheetsToParse: string[] = [];
                
                if (tempWorkbook.SheetNames.length > 0) {
                    sheetsToParse.push(tempWorkbook.SheetNames[0]);
                }
                
                const mechSheetName = tempWorkbook.SheetNames.find(s => norm_ext(s) === 'ESTADOSMECANICOS');
                if (mechSheetName) {
                    sheetsToParse.push(mechSheetName);
                }
                
                const surveySheetNames = tempWorkbook.SheetNames.filter(s => {
                    const sn = String(s).toUpperCase();
                    return sn.includes('SURVEY') || sn.includes('TRAYEC') || sn.includes('DESVIACI\u00d3N') || sn.includes('DESVIACION') || sn.includes('DESVIACI\"N');
                });
                if (surveySheetNames.length > 0) {
                    surveySheetNames.forEach(s => sheetsToParse.push(s));
                }

                // 2. Parse only the target sheets
                const workbook = XLSX.read(data, {
                    type: 'array',
                    sheets: sheetsToParse,
                    cellFormula: false,
                    cellHTML: false,
                    cellText: false,
                    cellStyles: false
                });
                await new Promise(r => setTimeout(r, 200));

                const mainSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[mainSheetName];
                json = XLSX.utils.sheet_to_json(sheet) as any[];

                // --- NEW: Process Mechanical Status Sheet (ESTADOS MECANICOS) ---
                if (mechSheetName) {
                    const mechSheet = workbook.Sheets[mechSheetName];

                    // Robust header detection for mechanical sheet
                    const rows = XLSX.utils.sheet_to_json(mechSheet, { header: 1 }) as any[][];
                    let headerRowIdx = -1;
                    for (let r = 0; r < Math.min(20, rows.length); r++) {
                        const rowArr = (rows[r] || []).map(c => norm_ext(String(c || '')));
                        if (rowArr.includes('NICK') || rowArr.includes('INTAKEMD') || rowArr.includes('PEST') || rowArr.includes('INTAKE')) {
                            headerRowIdx = r;
                            break;
                        }
                    }

                    const mechJson = (headerRowIdx !== -1)
                        ? (XLSX.utils.sheet_to_json(mechSheet, { range: headerRowIdx }) as any[])
                        : (XLSX.utils.sheet_to_json(mechSheet) as any[]);

                    mechJson.forEach(row => {
                        const n = norm_ext(String(get_ext(row, ['NICK', 'POZO', 'WELL']) || ''));
                        if (n) mechDataMap[n] = row;
                    });
                    console.log("[Mechanical Status] Pozos indexados:", Object.keys(mechDataMap));
                }

                if (surveySheetNames.length > 0) {
                    let bestRawSurvey: any[] = [];
                    for (const sName of surveySheetNames) {
                        const surveySheet = workbook.Sheets[sName];
                        let headerRow = 0;
                        let detectedWellName = '';
                        for (let i = 0; i < 20; i++) {
                            const temp = XLSX.utils.sheet_to_json(surveySheet, { range: i, header: 1 }) as any[][];
                            if (temp.length > 0) {
                                const rowArr = temp[0];
                                for (let c = 0; c < rowArr.length; c++) {
                                    const cellVal = String(rowArr[c] || '').trim().toUpperCase();
                                    if (cellVal === 'POZO' || cellVal === 'WELL' || cellVal.includes('POZO:') || cellVal.includes('WELL:')) {
                                        const nextVal = String(rowArr[c + 1] || '').trim();
                                        if (nextVal && nextVal.length > 1) {
                                            detectedWellName = nextVal.toUpperCase();
                                        }
                                    }
                                }
                                if (rowArr.some(c => {
                                    const uc = String(c || '').toUpperCase();
                                    return uc.includes('DEPTH') || uc.includes('MD') || uc.includes('PROF') || uc.includes('MEASURED') || uc.includes('MEDIDA');
                                })) {
                                    headerRow = i; break;
                                }
                            }
                        }
                        const currentSurvey = XLSX.utils.sheet_to_json(surveySheet, { range: headerRow }) as any[];
                        if (currentSurvey.length > bestRawSurvey.length) {
                            bestRawSurvey = currentSurvey;
                            bestDetectedWellName = detectedWellName;
                        }
                    }
                    jsonSurvey = bestRawSurvey;
                }
            }

            // Resolvemos los mapeos de columnas una sola vez para maxima velocidad de analisis (evita la sobrecarga O(N) de buscar encabezados)
            let mdKey = '';
            let tvdKey = '';
            let incKey = '';
            let azimKey = '';
            let subSeaKey = '';
            let northingKey = '';
            let nsKey = '';
            let eastingKey = '';
            let ewKey = '';
            let northingMKey = '';
            let eastingMKey = '';
            let verticalSectionKey = '';
            let doglegKey = '';

            if (jsonSurvey.length > 0) {
                const firstRow = jsonSurvey[0];
                const keysOfRow = Object.keys(firstRow);

                // Helper rapido de resolucion unica
                const resolveKey = (targets: string[]): string => {
                    const normTargets = targets.map(norm_ext);
                    const normRowKeys = keysOfRow.map(norm_ext);
                    for (const t of normTargets) {
                        const idx = normRowKeys.indexOf(t);
                        if (idx !== -1) return keysOfRow[idx];
                    }
                    for (const t of normTargets) {
                        if (t.length > 3) {
                            const idx = normRowKeys.findIndex(r => r === t || r.startsWith(t + '_') || r.endsWith('_' + t));
                            if (idx !== -1) return keysOfRow[idx];
                        }
                    }
                    return '';
                };

                mdKey = resolveKey(['Measured Depth (ft)', 'MD (ft)', 'Measured Depth', 'MD', 'Measured Depth (m)', 'MD (m)']);
                tvdKey = resolveKey(['Vertical Depth (ft)', 'TVD (ft)', 'Vertical Depth', 'TVD', 'Vertical Depth (m)', 'TVD (m)']);
                incKey = resolveKey(['Inclination (deg)', 'Inc (deg)', 'Inc. (deg)', 'Inclination', 'Inc', 'INC', 'Inclination (deg.)']);
                azimKey = resolveKey(['Azimuth (deg)', 'Azim (deg)', 'Azim. (deg)', 'Azimuth', 'Azim', 'AZIM', 'Azimuth (deg.)']);
                subSeaKey = resolveKey(['Sub-Sea Depth (ft)', 'Sub-Sea Depth', 'SubSea Depth', 'SUBSEA', 'SubSea', 'SUB-SEA', 'Subsea (ft)', 'Subsea', 'Subsea Depth (ft)']);
                northingKey = resolveKey(['Northings (ft) - Latitude', 'Northings (ft)', 'Northing (ft)', 'Northings', 'Northing', 'NORTHINGS', 'Latitude (ft)', 'Latitude', 'Nothings (ft) - Latitude', 'Nothings (ft)', 'Nothing (ft)', 'Nothings', 'Nothing']);
                nsKey = resolveKey(['N/S', 'n/s', 'NS', 'ns', 'Dir N/S', 'N-S']);
                eastingKey = resolveKey(['Eastings (ft) - Longitude', 'Eastings (ft)', 'Easting (ft)', 'Eastings', 'Easting', 'EASTINGS', 'Longitude (ft)', 'Longitude', 'Eastings (ft) - Longitude']);
                ewKey = resolveKey(['E/W', 'e/w', 'EW', 'ew', 'Dir E/W', 'E-W']);
                northingMKey = resolveKey(['Northings (m)', 'Northing (m)', 'Northing m', 'Northings m', 'Nothings (m)', 'Nothing (m)', 'Nothings m']);
                eastingMKey = resolveKey(['Eastings (m)', 'Easting (m)', 'Easting m', 'Eastings m']);
                verticalSectionKey = resolveKey(['Vertical Section (ft)', 'Vertical Section', 'VS', 'vs', 'Vert.Section', 'Vertical Section (m)', 'VS (ft)']);
                doglegKey = resolveKey(['Dogleg Rate (deg/100ft)', 'Dogleg Rate', 'Dogleg', 'DLS', 'dls', 'Dogleg Rate (deg/30m)', 'Dogleg Rate (deg/100m)', 'Dogleg (deg/100ft)', 'Dogleg (deg/30m)']);
            }

            // Bucle para extraer de forma unificada e identificar campos de survey avanzados (en espanol)
            let lastWellName = bestDetectedWellName || 'UNKNOWN';
            jsonSurvey.forEach((row: any) => {
                const wellColRaw = get_ext(row, ['POZO', 'WELL', 'Pozo']);
                let rawName = String(wellColRaw || '').trim();
                let wName = fuzzyWellName(rawName);
                if (wName && wName !== 'UNKNOWN' && wName.length > 1) {
                    lastWellName = wName;
                } else {
                    wName = lastWellName;
                }

                // Acceso directo ultra veloz O(1)
                const md = mdKey ? row[mdKey] : null;
                const tvd = tvdKey ? row[tvdKey] : null;
                const inc = incKey ? row[incKey] : null;
                const azim = azimKey ? row[azimKey] : null;
                const subSea = subSeaKey ? row[subSeaKey] : null;
                const northing = northingKey ? row[northingKey] : null;
                const nsRaw = nsKey ? row[nsKey] : null;
                const easting = eastingKey ? row[eastingKey] : null;
                const ewRaw = ewKey ? row[ewKey] : null;
                const northingM = northingMKey ? row[northingMKey] : null;
                const eastingM = eastingMKey ? row[eastingMKey] : null;
                const verticalSection = verticalSectionKey ? row[verticalSectionKey] : null;
                const dogleg = doglegKey ? row[doglegKey] : null;

                const p = (v: any) => {
                    if (v === null || v === undefined || v === '') return null;
                    const raw = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : null);
                    return raw !== null && !isNaN(raw) ? Number(raw.toFixed(3)) : null;
                };

                const fm = p(md);
                const ft = p(tvd);

                if (fm !== null && !isNaN(fm)) {
                    if (!surveyDataByWell[wName]) surveyDataByWell[wName] = [];

                    const nsVal = nsRaw ? String(nsRaw).trim().toUpperCase().charAt(0) : undefined;
                    const ewVal = ewRaw ? String(ewRaw).trim().toUpperCase().charAt(0) : undefined;

                    surveyDataByWell[wName].push({
                        md: fm,
                        tvd: ft !== null && !isNaN(ft) ? ft : fm,
                        inc: p(inc) !== null ? p(inc) : undefined,
                        azim: p(azim) !== null ? p(azim) : undefined,
                        subSea: p(subSea) !== null ? p(subSea) : undefined,
                        northing: p(northing) !== null ? p(northing) : undefined,
                        ns: (nsVal === 'N' || nsVal === 'S') ? nsVal as 'N' | 'S' : undefined,
                        easting: p(easting) !== null ? p(easting) : undefined,
                        ew: (ewVal === 'E' || ewVal === 'W') ? ewVal as 'E' | 'W' : undefined,
                        northingM: p(northingM) !== null ? p(northingM) : undefined,
                        eastingM: p(eastingM) !== null ? p(eastingM) : undefined,
                        verticalSection: p(verticalSection) !== null ? p(verticalSection) : undefined,
                        dogleg: p(dogleg) !== null ? p(dogleg) : undefined
                    });
                }
            });

            // Ordenar los puntos del survey por MD para evitar inconsistencias
            Object.keys(surveyDataByWell).forEach(wName => {
                surveyDataByWell[wName].sort((a, b) => a.md - b.md);
            });

            if (!isPrecalcJson) await new Promise(r => setTimeout(r, 100)); // YIELD before json extract

            if (json.length === 0) return;

            const newDesigns: Record<string, SystemParams> = {};
            const wellsToAdd: WellFleetItem[] = [];
            let mechFoundCount = 0;
            let mechMissingCount = 0;

            setImportProgress({ current: 0, total: json.length, label: 'Iniciando analisis de flota...' });

            // Reducimos el chunkSize de 15 a 8 para maxima fluidez en la UI
            const chunkSize = 8;
            for (let i = 0; i < json.length; i += chunkSize) {
                const chunk = json.slice(i, i + chunkSize);

                setImportProgress({
                    current: i,
                    total: json.length,
                    label: `Analizando configuraciones: ${i} de ${json.length} pozos...`
                });

                // Aumentamos ligeramente el delay para asegurar repintado del navegador
                await new Promise(resolve => setTimeout(resolve, 5));

                chunk.forEach((row, idx) => {
                    const wellName = String(get_ext(row, ['POZO', 'WELL']) || `WELL-${i + idx}`).toUpperCase().trim();
                    if (!wellName) return;

                    // --- L"GICA DE RUNS (NICK) ---
                    const nickName = String(get_ext(row, ['NICK', 'NOMBRE_NICK']) || wellName).toUpperCase().trim();
                    let runNumber = 0;
                    if (nickName.includes('#')) {
                        const parts = nickName.split('#');
                        runNumber = parseInt(parts[parts.length - 1], 10) || 0;
                    } else if (wellName === nickName) {
                        // Si el Nick es igual al pozo y no tiene #, asumimos Run 0 o 1
                        runNumber = 1;
                    }

                    const mechRow = mechDataMap[norm_ext(nickName)];
                    if (mechRow) {
                        console.log(`%c[Mechanical Status] ¡MATCH EXITOSO! "${nickName}"`, "color: #22d3ee; font-weight: bold; border-left: 4px solid #22d3ee; padding-left: 8px;");
                    } else {
                        if (nickName.includes('AVISPA')) {
                            console.warn(`[Mechanical Status] No se encontro informacion para "${nickName}" en ESTADOS MECANICOS. Disponibles:`, Object.keys(mechDataMap).slice(0, 5));
                        }
                    }

                    // --- VALORES BASE DE LA HOJA DE DISEÑO ---
                    let pStatic = n_ext(get_ext(row, ['P ESTATICA (PSI)', 'P ESTATICA', 'STATIC PRESSURE', 'PESTATICA']));
                    let intakeMD = n_ext(get_ext(row, ['PROFUNDIDAD DE INTAKE MD (FT)', 'INTAKE MD', 'INTAKEMD']));
                    let fondoMD = n_ext(get_ext(row, ['PROFUNDIDAD TOTAL MD (FT)', 'PROFUNDIDAD TOTAL MD', 'FONDO MD', 'TOTAL DEPTH', 'PROFUNDIDADTOTALMD', 'PROFUNDIDAD TOTAL', 'PROFUNDIDAD TOTAL (FT)'])) || (intakeMD + 1000);
                    let topPerfs = n_ext(get_ext(row, ['TOPE DE PERFORADOS MD (FT)', 'TOPE DE PERFORADOS MD', 'TOPEDEPERFORADOS', 'TOPE DE PERFORADOS']));
                    let basePerfs = 0;
                    let isEMVerified = false;

                    // --- PRIORIZAR COLUMNAS EM EMBEBIDAS DIRECTAMENTE EN DATA DISEÑO ---
                    const emPest = n_ext(get_ext(row, ['EM PESTA', 'EM_PESTA', 'EM PESTATICA']));
                    const emIntake = n_ext(get_ext(row, ['EM Intake (MD)', 'EM INTAKE', 'EM_INTAKE']));
                    const emFondo = n_ext(get_ext(row, ['EM Fondo pozo (MD)', 'EM FONDO', 'EM_FONDO']));
                    const emTop = n_ext(get_ext(row, ['EM Tope Perf (MD)', 'EM TOPE', 'EM_TOPE']));
                    const emBase = n_ext(get_ext(row, ['EM Base Perf (MD)', 'EM BASE', 'EM_BASE']));
                    const emIdTbg = n_ext(get_ext(row, ['EM ID TBG', 'EM_ID_TBG']));
                    const emIdCsg = n_ext(get_ext(row, ['EM ID CSG', 'EM_ID_CSG']));

                    if (emPest > 0 || emIntake > 0 || emFondo > 0 || emTop > 0 || emBase > 0 || emIdTbg > 0 || emIdCsg > 0) {
                        isEMVerified = true;
                        if (emPest > 0) pStatic = emPest;
                        if (emIntake > 0) intakeMD = emIntake;
                        if (emFondo > 0) fondoMD = emFondo;
                        if (emTop > 0) topPerfs = emTop;
                        if (emBase > 0) basePerfs = emBase;
                    } 
                    // --- FALLBACK A LA PESTAÑA TRADICIONAL DE ESTADOS MECANICOS SI EXISTE ---
                    else if (mechRow) {
                        const mPest = n_ext(get_ext(mechRow, ['PEST', 'Pest', 'P ESTATICA']));
                        const mIntake = n_ext(get_ext(mechRow, ['INTAKE (MD)', 'Intake (MD)', 'INTAKEMD']));
                        const mFondo = n_ext(get_ext(mechRow, ['FONDO POZO (MD)', 'Fondo pozo (MD)', 'FONDOMD']));
                        const mTop = n_ext(get_ext(mechRow, ['TOPE PERF (MD)', 'Tope Perf (MD)']));
                        const mBase = n_ext(get_ext(mechRow, ['BASE PERF (MD)', 'Base Perf (MD)']));
                        const mIdTbg = n_ext(get_ext(mechRow, ['EM ID TBG', 'EM_ID_TBG', 'ID TBG']));
                        const mIdCsg = n_ext(get_ext(mechRow, ['EM ID CSG', 'EM_ID_CSG', 'ID CSG']));

                        if (mPest > 0 || mIntake > 0 || mFondo > 0 || mTop > 0 || mBase > 0 || mIdTbg > 0 || mIdCsg > 0) {
                            isEMVerified = true;
                            if (mPest > 0) pStatic = mPest;
                            if (mIntake > 0) intakeMD = mIntake;
                            if (mFondo > 0) fondoMD = mFondo;
                            if (mTop > 0) topPerfs = mTop;
                            if (mBase > 0) basePerfs = mBase;
                        }
                    }
                    const pipMin = n_ext(get_ext(row, ['PIP MINIMA (PSI)', 'PIP MINIMA', 'PIPMINIMA', 'MIN PIP']));
                    const ip = n_ext(get_ext(row, ['IP (BFPD/PSI)', 'IP (BFP/PSI)', 'PRODUCTIVITY INDEX', 'PI (BFPD/PSI)']));
                    const ipMin = n_ext(get_ext(row, ['IP MIN (BFPD/PSI)', 'IP MIN (BFPD/PSI)', 'IP MIN', 'IP MIN', 'MIN IP']));
                    const bsw_raw = get_ext(row, ['BSW (%)', 'WATER CUT (%)', 'BSW', 'CORTE DE AGUA', 'BSW PRUEBA', 'BSW_PRUEBA', 'CORTE AGUA', 'CORTE_AGUA']);
                    let bsw = n_ext(bsw_raw);
                    // Normalizacion: Si el dato viene como decimal (0.98) lo convertimos a porcentaje (98)
                    if (bsw > 0 && bsw <= 1.0) bsw = bsw * 100;
                    const gor = n_ext(get_ext(row, ['GOR (SCF/STB)', 'GOR (SCFSTB)', 'GOR']));

                    const bht = n_ext(get_ext(row, ['BHT (°F)', 'BHT']));
                    const tht = n_ext(get_ext(row, ['THT (°F)', 'THT']));
                    const api = n_ext(get_ext(row, ['°API', 'API']));
                    const rawStartDate = get_ext(row, ['FECHA DE ARRANQUE', 'FECHA ARRANQUE', 'START DATE', 'STARTUP DATE', 'FECHA_ARRANQUE']);
                    const startDate = rawStartDate ? d_ext(rawStartDate) : '';

                    // --- PUNTO MEDIO DE PERFORADOS ---
                    const midPerfsMD = (topPerfs > 0 && basePerfs > 0) ? (topPerfs + basePerfs) / 2 : (topPerfs || (intakeMD + 200));

                    const pbValue = n_ext(get_ext(row, ['P BURBUJA (PSI)', 'PBURBUJA', 'P BURBUJA', 'PB']));
                    const runLifeRaw = get_ext(row, ['RUN LIFE', 'RUNLIFE', 'RUN_LIFE', 'RUNTIME']);
                    const runLifeText = String(runLifeRaw ?? '').trim();

                    const rate = (ipv: number) => Number((Math.max(0, ipv * Math.max(0, pStatic - pipMin) * 0.60)).toFixed(1));
                    const cleanIp = (v: number) => Number((v).toFixed(1));

                    const mapPipe = (r: any, catalog: any[], descLabels: string[], odLabels: string[], defaultOD: number): PipeData => {
                        let odVal = n_ext(get_ext(r, odLabels));
                        if (odVal === 0) odVal = defaultOD;
                        const rawDesc = String(get_ext(r, descLabels) || '').toUpperCase();

                        const options = catalog.filter(p => Math.abs(p.od - odVal) < 0.05);
                        let selected = options.length > 0 ? options[0] : catalog.find(c => Math.abs(c.od - defaultOD) < 0.05) || catalog[0];

                        if (options.length > 1) {
                            let extractedWeight = 0;
                            const weightMatch = rawDesc.match(/(?:X|\s|#|^)(\d+(?:\.\d+)?)\s*(?:#|LB|LBS)/i) || rawDesc.match(/X\s*(\d+(?:\.\d+)?)/i);
                            if (weightMatch) extractedWeight = parseFloat(weightMatch[1]);

                            const grades = ['K55', 'J55', 'N80', 'L80', 'P110', 'C95', 'K-55', 'J-55', 'N-80', 'L-80', 'P-110', 'C-95'];
                            const foundGrade = grades.find(g => rawDesc.replace(/[-\s]/g, '').includes(g.replace(/[-\s]/g, '')));

                            let bestScore = -1;
                            let bestMatch = selected;
                            for (const opt of options) {
                                let score = 0;
                                if (extractedWeight > 0 && Math.abs(opt.weight - extractedWeight) < 0.2) score += 500;
                                if (foundGrade && opt.description.replace(/[-\s]/g, '').includes(foundGrade.replace(/[-\s]/g, ''))) score += 300;
                                if (score > bestScore) { bestScore = score; bestMatch = opt; }
                            }
                            selected = bestMatch;
                        }
                        return selected;
                    };

                    const casing = mapPipe((isEMVerified && emIdCsg > 0) ? row : (mechRow || row), CASING_CATALOG, ['EM ID CSG', 'EM_ID_CSG', 'DESCRIPCION CSG', 'CSG DESC', 'ID CSG'], ['EM ID CSG', 'EM_ID_CSG', 'CSG OD', 'CSG OD (IN)', 'ID CSG'], 7);
                    const tubing = mapPipe((isEMVerified && emIdTbg > 0) ? row : (mechRow || row), TUBING_CATALOG, ['EM ID TBG', 'EM_ID_TBG', 'DESCRIPCION TBG', 'TBG DESC', 'ID TBG'], ['EM ID TBG', 'EM_ID_TBG', 'TBG OD', 'TBG OD (IN)', 'ID TBG'], 3.5);

                    if (isEMVerified) {
                        mechFoundCount++;
                    } else {
                        mechMissingCount++;
                    }

                    const design: SystemParams = {
                        ...INITIAL_PARAMS,
                        metadata: { ...INITIAL_PARAMS.metadata, wellName, projectName: nickName, comments: `Run: ${runNumber}` },
                        historyMatch: {
                            ...(INITIAL_PARAMS as any).historyMatch,
                            startDate,
                            runLife: runLifeText
                        } as any,
                        wellbore: {
                            ...INITIAL_PARAMS.wellbore,
                            tubingBottom: intakeMD, casingBottom: fondoMD,
                            midPerfsMD,
                            casing, tubing
                        },
                        fluids: {
                            ...INITIAL_PARAMS.fluids,
                            apiOil: api || 30,
                            waterCut: bsw,
                            gor,
                            pb: pbValue,
                            isDeadOil: pbValue <= 0,
                            sandCut: n_ext(get_ext(row, ['PRODUCCION DE SOLIDOS (PTB)', 'PRODUCCION DE SOLIDOS', 'PRODUCCIONDESOLIDOS', 'SAND CUT', 'SAND_CUT', 'SOLIDOS', 'SOLIDS', 'VOLUMEN DE ARENA', 'VOLUMEN ARENA'])),
                            sandDensity: n_ext(get_ext(row, ['SG SOLIDOS', 'SG SÓLIDOS', 'SAND DENSITY', 'SAND_DENSITY', 'GRAVEDAD ESPECIFICA SOLIDOS', 'SG_SOLIDOS', 'SG SOLIDO', 'SG SÓLIDO'])) || 2.65
                        },
                        inflow: { ...INITIAL_PARAMS.inflow, pStatic, ip },
                        pressures: { ...INITIAL_PARAMS.pressures, totalRate: rate(ip), pumpDepthMD: intakeMD, pht: 80 },
                        survey: surveyDataByWell[fuzzyWellName(wellName)] || surveyDataByWell['UNKNOWN'] || [],
                        isMechVerified: isEMVerified,
                        targets: {
                            min: { rate: rate(ipMin || ip * 0.8), ip: cleanIp(ipMin || ip * 0.8), waterCut: bsw, gor, frequency: 50 },
                            target: { rate: rate(ip), ip: cleanIp(ip), waterCut: bsw, gor, frequency: 60 },
                            max: { rate: rate(ip * 1.25), ip: cleanIp(ip * 1.25), waterCut: bsw, gor, frequency: 70 }
                        },
                        bottomholeTemp: bht || 200, surfaceTemp: tht || 80
                    };

                    const pumpName = s_ext(get_ext(row, ['BOMBA', 'PUMP']));
                    const stages = n_ext(get_ext(row, ['ETAPAS']));
                    const motorName = s_ext(get_ext(row, ['MOTOR']));
                    const motorHp = n_ext(get_ext(row, ['MOTOR HP', 'HP MOTOR', 'HP']));
                    const motorVolts = n_ext(get_ext(row, ['VOL', 'VOLTAGE', 'VOLTS', 'V', 'VOLTIOS', 'MOTOR VOL', 'MOTOR VOLTAGE']));
                    const motorAmps = n_ext(get_ext(row, ['AMP', 'AMPERAGE', 'AMPERIOS', 'A', 'MOTOR AMP', 'MOTOR AMPERAGE']));
                    const vsdName = s_ext(get_ext(row, ['VARIADOR', 'VFD', 'VSD', 'VARIABLE SPEED DRIVE']));

                    // --- NEW: Estado Actual y ALS ---
                    const estadoActualRaw = s_ext(get_ext(row, ['ESTADO ACTUAL', 'ESTADOACTUAL', 'STATUS', 'CURRENT STATUS'])).toLowerCase();
                    let estadoActual: any = 'operativo';
                    if (estadoActualRaw.includes('falla') || estadoActualRaw.includes('fallado')) estadoActual = 'fallado';
                    else if (estadoActualRaw.includes('pull')) estadoActual = 'pull';
                    else if (estadoActualRaw.includes('pendiente')) estadoActual = 'pendiente';

                    const als = s_ext(get_ext(row, ['ALS', 'SISTEMA', 'SISTEMA DE LEVANTAMIENTO', 'TIPO']));

                    const foundPump = exactMatchExt(pumpCatalog, pumpName);
                    if (foundPump) {
                        (design as any).customPump = { ...foundPump, stages: stages || foundPump.stages || 100 };
                    }
                    const foundMotor = exactMatchExt(motorCatalog, motorName);
                    if (foundMotor) {
                        design.selectedMotor = foundMotor;
                        design.motorHp = foundMotor.hp;
                        (design as any).motorExactFound = true;
                    } else {
                        (design as any).motorExactFound = false;
                    }
                    const foundVsd = smartMatchExt(vsdCatalog, vsdName, false);
                    if (foundVsd) {
                        design.selectedVSD = foundVsd;
                    }

                    // Usamos nickName como llave primaria para evitar sobreescritura entre runs
                    newDesigns[nickName] = design;
                    wellsToAdd.push({
                        id: `EXCEL-${nickName}-${Date.now()}-${i + idx}`,
                        name: nickName,
                        status: estadoActual === 'fallado' ? 'failure' : (estadoActual === 'pendiente' ? 'caution' : 'normal'),
                        estadoActual,
                        als,
                        health: { pump: 'normal', motor: 'normal', seal: 'normal', sensor: 'active', cable: 'normal' },
                        predictive: { ttf: 365, vsdStatus: 'optimal', vsdAnalysis: 'Excel Import', transformerStatus: 'optimal', transformerAnalysis: 'Normal', ventBoxStatus: 'optimal', ventBoxAnalysis: 'Normal' },
                        lastUpdate: new Date().toISOString(),
                        currentRate: 0,
                        targetRate: design.targets.target.rate,
                        consumptionReal: 0, consumptionTheo: 0,
                        depthMD: intakeMD,
                        productionTest: {
                            date: new Date().toISOString().split('T')[0],
                            rate: 0, freq: 0, thp: 0, tht: 0, waterCut: 0, pip: 0, pdp: 0, gor: 0, hp: 0, hasMatchData: false
                        }
                    });
                });
            }

            setImportProgress({ current: json.length, total: json.length, label: 'Finalizando actualizacion de interfaz...' });

            setCustomDesigns(prev => ({ ...prev, ...newDesigns }));
            setFleet(prev => {
                const merged = [...prev];
                wellsToAdd.forEach(nw => {
                    // Usamos el nick completo para la busqueda exacta en la flota
                    const idx = merged.findIndex(w => w.name.toUpperCase() === nw.name.toUpperCase());
                    if (idx !== -1) merged[idx] = { ...merged[idx], ...nw };
                    else merged.push(nw);
                });
                return merged;
            });

            setImportProgress(null);
            setImportProgress(null);
            if (!isAutoLoad) {
                const summaryMsg = `?xito: Se procesaron ${json.length} pozos correctamente.\n\n` +
                    `- ${mechFoundCount} con Estado Mecanico preciso.\n` +
                    `- ${mechMissingCount} usando datos de diseno original.`;
                alert(summaryMsg);
            }

        } catch (err) {
            console.error("Error importing designs from Excel:", err);
            if (!isAutoLoad) alert("Error al procesar el archivo Excel de disenos.");
            setImportProgress(null);
        }
    };

    const handleImportExcelDesigns = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            await processExcelDesignsBuffer(data);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportDesign = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileList = Array.from(files) as any[];
        if (fileList.length === 1 && (fileList[0].name.endsWith('.xlsx') || fileList[0].name.endsWith('.xls'))) {
            handleImportExcelDesigns(e);
            return;
        }

        const newDesigns: Record<string, SystemParams> = {};
        const wellsToAdd: WellFleetItem[] = [];

        let processed = 0;
        fileList.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    if (!content) throw new Error("File empty");
                    const rawData = JSON.parse(content) as any;
                    if (!rawData || (typeof rawData !== 'object')) throw new Error("Invalid structure: Not an object");

                    let itemsToProcess: any[] = [];
                    if (Array.isArray(rawData)) {
                        itemsToProcess = rawData;
                    } else if (rawData.fleet && Array.isArray(rawData.fleet)) {
                        itemsToProcess = rawData.fleet;
                    } else if (rawData.data && Array.isArray(rawData.data)) {
                        itemsToProcess = rawData.data;
                    } else {
                        itemsToProcess = [rawData];
                    }

                    itemsToProcess.forEach((item, index) => {
                        const isProject = item.type === 'esp-studio-project';
                        const designPart = isProject && item.data?.params ? item.data.params : (item.params || item);
                        const pumpPart = isProject && item.data?.customPump ? item.data.customPump : (designPart.pump || item.pump || item.customPump);

                        // Extract well name safely and attempt deduplication using file.name
                        let rawName = designPart.metadata?.wellName || designPart.wellName || item.name;

                        // Fallbacks for default/empty names
                        if (!rawName || String(rawName).toUpperCase().includes('NUEVO_POZO') || rawName === 'WELL_NAME') {
                            rawName = file.name.replace('.json', '');
                        }

                        // If array inside a single file, append index
                        if (itemsToProcess.length > 1) {
                            rawName = `${rawName} (${index + 1})`;
                        }

                        let wellName = String(rawName).toUpperCase().trim();

                        // Deduplicate against other uploads in the same batch
                        let dedupCounter = 1;
                        let originalWellName = wellName;
                        while (newDesigns[wellName]) {
                            wellName = `${originalWellName}_${dedupCounter}`;
                            rawName = `${rawName} (${dedupCounter})`;
                            dedupCounter++;
                        }

                        const design: any = {
                            ...INITIAL_PARAMS,
                            ...designPart,
                            wellName: rawName
                        };
                        if (pumpPart) design.pump = pumpPart;

                        newDesigns[wellName] = design;

                        wellsToAdd.push({
                            id: `JSON-${wellName}-${Date.now()}-${processed}-${index}`,
                            name: rawName,
                            status: (design.historyMatch?.rate > 5) ? (design.healthStatus || 'normal') : 'inactive',
                            estadoActual: design.estadoActual || (design.historyMatch?.rate > 5 ? 'operativo' : 'fallado'),
                            als: design.als || 'ESP',
                            health: design.health || { pump: 'normal', motor: 'normal', seal: 'normal', sensor: 'active', cable: 'normal' },
                            predictive: design.predictive || { ttf: 365, vsdStatus: 'optimal', vsdAnalysis: 'Manual Import', transformerStatus: 'optimal', transformerAnalysis: 'Normal', ventBoxStatus: 'optimal', ventBoxAnalysis: 'Normal' },
                            lastUpdate: new Date(design.metadata?.date || Date.now()).toISOString(),
                            currentRate: design.historyMatch?.rate || 0,
                            targetRate: design.targets?.target?.rate || 0,
                            consumptionReal: design.powerReal || 0,
                            consumptionTheo: design.powerTheo || 0,
                            depthMD: design.pressures?.pumpDepthMD || design.wellbore?.midPerfsMD || design.depthMD || 0,

                            productionTest: {
                                date: design.historyMatch?.matchDate || new Date().toISOString().split('T')[0],
                                rate: design.historyMatch?.rate || 0,
                                freq: design.historyMatch?.frequency || 0,
                                pip: design.historyMatch?.pip || 0,
                                thp: design.historyMatch?.thp || 0,
                                waterCut: design.historyMatch?.waterCut || 0,
                                gor: design.historyMatch?.gor || 0,
                                hp: 0,
                                pdp: design.historyMatch?.pdp || 0,
                                tht: design.historyMatch?.tht || 0,
                                hasMatchData: !!(design.historyMatch?.rate > 5 || (design.historyMatch?.pip > 0 && design.historyMatch?.thp > 0))
                            }
                        });
                    });

                } catch (err) {
                    console.error("Error parsing design:", file.name, err);
                } finally {

                    processed++;
                    if (processed === fileList.length) {
                        setCustomDesigns(prev => ({ ...prev, ...newDesigns }));
                        setFleet(prev => {
                            const merged = [...prev];

                            wellsToAdd.forEach(nw => {
                                const normalizedNw = fuzzyWellName(nw.name);
                                const idx = merged.findIndex(w => fuzzyWellName(w.name) === normalizedNw);
                                if (idx !== -1) {
                                    // Update existing design
                                    merged[idx] = { ...merged[idx], ...nw };
                                } else {
                                    merged.push(nw);
                                }
                            });

                            // Silent update, no alert
                            return [...merged];
                        });

                        if (wellsToAdd.length > 0) {
                            // Non-blocking upload: don't automatically select the first one
                            // setSelectedWellId(wellsToAdd[0].id);
                        }

                    }
                }
            };
            reader.readAsText(file);
        });
    };

    const processScadaBuffer = async (data: any, isAutoLoad = false, isPrecalcJson = false) => {
        try {
            if (isAutoLoad && !isPrecalcJson) {
                setImportProgress({ current: 15, total: 100, label: 'Descomprimiendo Historicos... Lento...' });
                await new Promise(r => setTimeout(r, 500));
            }

            let json: any[] = [];

            if (isPrecalcJson) {
                json = data;
            } else {
                // 1. Read sheet names first (extremely fast and memory efficient)
                const tempWorkbook = XLSX.read(data as Uint8Array, { bookSheets: true });
                await new Promise(r => setTimeout(r, 50));

                setImportProgress({ current: 20, total: 100, label: 'Buscando hoja de telemetria...' });
                await new Promise(r => setTimeout(r, 50));

                for (const sheetName of tempWorkbook.SheetNames) {
                    // Parse only the single sheet under consideration
                    const singleWorkbook = XLSX.read(data as Uint8Array, {
                        type: 'array',
                        sheets: [sheetName],
                        cellFormula: false,
                        cellHTML: false,
                        cellText: false,
                        cellStyles: false
                    });
                    const sheet = singleWorkbook.Sheets[sheetName];

                    // --- BUSCADOR DINAMICO DE ENCABEZADOS ---
                    const previewRows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, blankrows: false }) as any[][];
                    let headerRowIdx = -1;
                    let dualHeaderRow: string[] = [];

                    for (let i = 0; i < Math.min(40, previewRows.length); i++) {
                        const row = (previewRows[i] || []).map(c => String(c || '').toUpperCase().trim());
                        const hasPozo = row.includes('POZO') || row.includes('WELL');
                        const hasFecha = row.includes('FECHA') || row.includes('DATE');
                        const hasRate = row.includes('BFPD') || row.includes('BOPD') || row.includes('PRODUCCION');

                        if (hasPozo && (hasFecha || hasRate)) {
                            headerRowIdx = i;
                            // Intentamos capturar la fila superior si parece ser un titulo de categoria (Dual Header)
                            if (i > 0) {
                                dualHeaderRow = (previewRows[i - 1] || []).map(c => String(c || '').toUpperCase().trim());
                            }
                            break;
                        }
                    }

                    if (headerRowIdx !== -1) {
                        // Si detectamos un dual header, combinamos las columnas para no perder informacion (ej: THP sobre psi)
                        const rowsRaw = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, header: 1 }) as any[][];
                        // Logica de "Forward Fill" inteligente y combinada
                        let lastTopHeader = '';
                        const headers = (rowsRaw[0] || []).map((h, idx) => {
                            const sub = String(h || '').toUpperCase().trim();
                            const top = String(dualHeaderRow[idx] || '').toUpperCase().trim();

                            if (top) lastTopHeader = top;
                            const currentTop = top || lastTopHeader;

                            // Casos de combinacion:
                            if (sub && currentTop) {
                                // Si sub es una unidad o generico, usamos el top
                                if (['PSI', '°F', 'HZ', 'DIA', 'OPER', 'UNIT'].includes(sub)) return currentTop;
                                // Si son nombres distintos, los combinamos para evitar duplicados (ej: PRUEBA_BFPD)
                                if (sub !== currentTop) return `${currentTop}_${sub}`;
                                return sub;
                            }

                            return sub || currentTop || `COL_${idx}`;
                        });

                        console.log("[Excel Mapping] Encabezados Finales:", headers);

                        // Convertimos el resto de filas a objetos usando los nuevos encabezados
                        json = rowsRaw.slice(1).map(row => {
                            const obj: any = {};
                            headers.forEach((h, idx) => { obj[h] = row[idx]; });
                            return obj;
                        });

                        console.log(`[SCADA Import] Found valid sheet: ${sheetName}`);
                        if (json.length > 0) break;
                    }
                }
            }

            if (json.length === 0) {
                setImportProgress(null);
                alert('El archivo Excel parece estar vacio o no se detectaron los encabezados (POZO, FECHA).');
                return;
            }

            setImportProgress({ current: 0, total: json.length, label: 'Sincronizando telemetria en tiempo real...' });
            const newProductionData: Record<string, ProductionTest[]> = {};

            const lastValidPipMap: Record<string, number> = {};

            // Bajamos chunkSize de 200 a 100 para evitar tirones
            const chunkSize = 100;
            for (let i = 0; i < json.length; i += chunkSize) {
                const chunk = json.slice(i, i + chunkSize);
                setImportProgress({ current: i, total: json.length, label: `Vinculando registros historicos: ${i} / ${json.length}...` });
                await new Promise(r => setTimeout(r, 5));

                chunk.forEach((row) => {
                    const name = String(get_ext(row, ['POZO', 'WELL', 'NAME', 'ID']) || '').trim();
                    if (!name) return;
                    const normName = fuzzyWellName(name);

                    const date = d_ext(get_ext(row, ['FECHA', 'DATE', 'DATE OF TEST', 'TIMESTAMP']));
                    const rate = n_ext(get_ext(row, ['BFPD', 'GROSS RATE', 'RATE', 'CAUDAL', 'TASA DE PRUEBA', 'TASAPRUEBA', 'BFPD TEST']));
                    const bsw_raw = get_ext(row, ['BSW PRUEBA', 'BSW_PRUEBA', 'BSW_DIA', 'BSW', 'WATER CUT', 'WATERCUT', 'CORTE DE AGUA', 'B S W', 'CORTE AGUA', 'CORTE_AGUA', 'WATER_CUT']);
                    let bsw = n_ext(bsw_raw);
                    // Normalizacion: Si el dato viene como decimal (0.98) lo convertimos a porcentaje (98)
                    if (bsw > 0 && bsw <= 1.0) bsw = bsw * 100;

                    // Mapeo exacto para THP/THT usando los encabezados combinados
                    const thp = n_ext(get_ext(row, ['THP_PSI', 'THP', 'PRESION CABEZA', 'P-SURFACE', 'PHT']));
                    const tht = n_ext(get_ext(row, ['THT_°F', 'THT', 'TEMP CABEZA', 'T-SURFACE']));

                    // Normalizacion de Frecuencia (Hz) con Logica PMM
                    const freqRaw = get_ext(row, ['FREC DE_OPER', 'FREC DE_DIA', 'FREC.PRUEBA', 'FRECUENCIA', 'FREQUENCY', 'H Z', 'HZ']);
                    let freq = n_ext(freqRaw) || 60;
                    if (freq > 80) freq = freq / 2; // Normalizacion PMM

                    // --- L"GICA PIP PERSISTENTE ---
                    let pip = n_ext(get_ext(row, ['PIP_PSI', 'PIP', 'INTAKE PRESSURE', 'PI P', 'PRESION SUCCION']));
                    if (pip <= 0) {
                        pip = lastValidPipMap[normName] || 0;
                    } else {
                        lastValidPipMap[normName] = pip;
                    }

                    const pdp = n_ext(get_ext(row, ['PDESC', 'DISCHARGE PRESSURE', 'PDP', 'P-DISCHARGE', 'PD']));

                    const amps = n_ext(get_ext(row, ['AMPS', 'AMP', 'AMPERAJE', 'CORRIENTE', 'AMPERIOS', 'CURRENT', 'MOTOR CURRENT', 'AMPS TEST', 'AMPERAJE PRUEBA']));
                    const volts = n_ext(get_ext(row, ['VOLTS', 'VOLT', 'VOLTAJE', 'MOTOR VOLTAGE', 'VOLTAGE', 'VOLTS TEST']));
                    const eff_raw = get_ext(row, ['EFF', 'EFFICIENCY', 'EFICIENCIA', 'PUMP EFF', 'PUMP EFFICIENCY', 'EFICIENCIA BOMBA']);
                    let efficiency = n_ext(eff_raw);
                    if (efficiency > 0 && efficiency <= 1.0) efficiency = efficiency * 100;

                    const pt: ProductionTest = {
                        date: date || new Date().toISOString().split('T')[0],
                        rate,
                        freq,
                        pip, thp,
                        tht: tht || 80,
                        waterCut: bsw,
                        gor: 0, hp: 0, pdp,
                        amps: amps || undefined,
                        volts: volts || undefined,
                        efficiency: efficiency || undefined,
                        hasMatchData: rate > 5 || (pip > 0 && thp > 0)
                    };

                    if (!newProductionData[normName]) newProductionData[normName] = [];
                    newProductionData[normName].push(pt);
                });
            }

            console.log("[SCADA Import] Distinct wells found in Excel:", Object.keys(newProductionData).length);

            let matchCount = 0;
            setFleet(prev => {
                const merged = [...prev];
                Object.entries(newProductionData).forEach(([wellName, tests]) => {
                    const latest = tests[tests.length - 1];
                    const normKey = fuzzyWellName(wellName);

                    // --- L"GICA DE RUTEO INTELIGENTE (RUN ACTUAL) ---
                    // Buscamos todos los candidatos que compartan el nombre base del pozo
                    const candidates = merged.filter(w => {
                        const baseName = w.name.split('#')[0].trim();
                        return fuzzyWellName(baseName) === normKey;
                    });

                    if (candidates.length > 0) {
                        // El "Run Actual" es aquel cuyo nick tiene el numero mas alto despues del #
                        let targetWell = candidates[0];
                        let maxRun = -1;

                        candidates.forEach(c => {
                            const parts = c.name.split('#');
                            const run = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) || 0 : 0;
                            if (run > maxRun) {
                                maxRun = run;
                                targetWell = c;
                            }
                        });

                        const idx = merged.findIndex(w => w.id === targetWell.id);
                        if (idx !== -1) {
                            merged[idx] = {
                                ...merged[idx],
                                currentRate: latest.rate,
                                productionTest: latest,
                                lastUpdate: latest.date
                            };
                            matchCount++;
                        }
                    }
                });
                console.log("[SCADA Import] Total fleet matches updated (Latest Run Only):", matchCount);
                return merged;
            });

            setCustomDesigns(prev => {
                const updated = { ...prev };
                Object.entries(newProductionData).forEach(([wellName, tests]) => {
                    const latest = tests[tests.length - 1];
                    const normKey = fuzzyWellName(wellName);

                    // Identificar el Run Actual en el diccionario de disenos
                    const allDesignKeys = Object.keys(updated);
                    const candidates = allDesignKeys.filter(k => fuzzyWellName(k.split('#')[0].trim()) === normKey);

                    if (candidates.length > 0) {
                        let targetKey = candidates[0];
                        let maxRun = -1;

                        candidates.forEach(k => {
                            const parts = k.split('#');
                            const run = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) || 0 : 0;
                            if (run > maxRun) {
                                maxRun = run;
                                targetKey = k;
                            }
                        });

                        updated[targetKey] = {
                            ...updated[targetKey],
                            metadata: {
                                ...updated[targetKey].metadata,
                                date: latest.date
                            },
                            historyMatch: {
                                ...updated[targetKey].historyMatch,
                                rate: latest.rate, frequency: latest.freq,
                                thp: latest.thp, pip: latest.pip, pdp: latest.pdp,
                                waterCut: latest.waterCut, matchDate: latest.date,
                                tht: latest.tht || 80,
                                hp: 0, gor: 0, pd: latest.pdp, fluidLevel: 0,
                                submergence: 0, pStatic: updated[targetKey].inflow.pStatic
                            }
                        };
                    }
                });
                return updated;
            });

            setWellsHistoricalData(prev => {
                const updated = { ...prev };
                Object.entries(newProductionData).forEach(([wellName, tests]) => {
                    // Sort tests by date ascending
                    const sortedTests = [...tests].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    // Keep at most last 150 tests to prevent OOM on mobile devices
                    updated[fuzzyWellName(wellName)] = sortedTests.slice(-150);
                });
                return updated;
            });

            if (!isAutoLoad) {
                if (matchCount > 0) {
                    alert(`?xito: Se sincronizaron datos para ${matchCount} pozos de la flota.`);
                } else {
                    const firstFound = Object.keys(newProductionData)[0] || 'Desconocido';
                    alert(`Atencion: No se encontraron coincidencias. El Excel tiene ${Object.keys(newProductionData).length} pozos (ej: "${firstFound}"), pero ninguno coincide con la flota actual. Verifique nombres.`);
                }
            }

            setImportProgress(null);

        } catch (err) {
            console.error("[SCADA Import] Error fatal:", err);
            if (!isAutoLoad) alert("Error tecnico al procesar el archivo SCADA. Revise la consola.");
            setImportProgress(null);
        }
    };

    const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            await processScadaBuffer(data);
            e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    // "?"? GESTI"N DE HISTORIAL DE PRODUCCI"N (MATCH HISTORICO) "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    const handleImportWellHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedWellId) return;

        console.log("[History Import] Process initiated for file:", file.name);
        const reader = new FileReader();
        const activeWell = fleet.find(w => w.id === selectedWellId);
        if (!activeWell) return;
        const normActiveName = norm_ext(activeWell.name);

        reader.onload = (event) => {
            const data = event.target?.result;
            let lines: string[] = [];

            try {
                let json: any[] = [];
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const workbook = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false, cellText: false, cellStyles: false });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    json = XLSX.utils.sheet_to_json(sheet);
                } else {
                    const content = new TextDecoder().decode(data as ArrayBuffer);
                    const workbook = XLSX.read(content, { type: 'string', cellFormula: false, cellHTML: false, cellText: false, cellStyles: false });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    json = XLSX.utils.sheet_to_json(sheet);
                }

                if (json.length === 0) {
                    alert("Archivo vacio o sin datos suficientes.");
                    return;
                }

                const rawTests: ProductionTest[] = json.map((row, i) => {
                    const rowWellNameRaw = get_ext(row, ['POZO', 'WELL', 'NOMBRES', 'NAME']);
                    const rowWellName = rowWellNameRaw ? String(rowWellNameRaw).trim() : '';

                    // If a well name is provided, it must match. If it's empty, we assume it belongs to the active well.
                    if (rowWellName && norm_ext(rowWellName) !== normActiveName) return null;

                    const date = d_ext(get_ext(row, ['FECHA', 'DATE', 'DATE OF TEST']));
                    const rate = n_ext(get_ext(row, ['BFPD', 'GROSS RATE', 'RATE', 'CAUDAL', 'TASA DE PRUEBA', 'TASAPRUEBA', 'BFPD TEST']));
                    const bsw_raw = get_ext(row, ['BSW PRUEBA', 'BSW_PRUEBA', 'BSW', 'WATER CUT', 'WATERCUT', 'CORTE DE AGUA', 'B S W', 'CORTE AGUA', 'CORTE_AGUA', 'WATER_CUT']);
                    let bsw = n_ext(bsw_raw);
                    // Normalizacion: Si el dato viene como decimal (0.98) lo convertimos a porcentaje (98)
                    if (bsw > 0 && bsw <= 1.0) bsw = bsw * 100;
                    const thp = n_ext(get_ext(row, ['THP', 'P-SURFACE', 'PHT', 'FHP', 'WHFP', 'PRESION CABEZA']));
                    const tht = n_ext(get_ext(row, ['THT', 'T-SURFACE', 'THT', 'WHT', 'TEMP CABEZA']));
                    const freq = n_ext(get_ext(row, ['FRECUENCIA', 'FREQUENCY', 'H Z', 'HZ', 'Hz']));
                    const pip = n_ext(get_ext(row, ['PIP', 'INTAKE PRESSURE', 'PI P', 'PRESION SUCCION', 'PIN']));
                    const pdp = n_ext(get_ext(row, ['PDESC', 'DISCHARGE PRESSURE', 'PDP', 'P-DISCHARGE', 'PD']));

                    const amps = n_ext(get_ext(row, ['AMPS', 'AMP', 'AMPERAJE', 'CORRIENTE', 'AMPERIOS', 'CURRENT', 'MOTOR CURRENT', 'AMPS TEST', 'AMPERAJE PRUEBA']));
                    const volts = n_ext(get_ext(row, ['VOLTS', 'VOLT', 'VOLTAJE', 'MOTOR VOLTAGE', 'VOLTAGE', 'VOLTS TEST']));
                    const eff_raw = get_ext(row, ['EFF', 'EFFICIENCY', 'EFICIENCIA', 'PUMP EFF', 'PUMP EFFICIENCY', 'EFICIENCIA BOMBA']);
                    let efficiency = n_ext(eff_raw);
                    if (efficiency > 0 && efficiency <= 1.0) efficiency = efficiency * 100;

                    return {
                        date: date || 'Unknown',
                        rate,
                        freq: freq || 60,
                        thp,
                        tht: tht || 80,
                        waterCut: bsw,
                        pip,
                        pdp,
                        amps: amps || undefined,
                        volts: volts || undefined,
                        efficiency: efficiency || undefined,
                        gor: 0, hp: 0,
                        hasMatchData: rate > 5 || (pip > 0 && thp > 0)
                    } as ProductionTest;
                }).filter(t => t !== null) as ProductionTest[];

                if (rawTests.length > 0) {
                    // Update historical records
                    const sortedRawTests = [...rawTests].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    setWellsHistoricalData(prev => ({ ...prev, [norm_ext(activeWell.name)]: sortedRawTests.slice(-150) }));

                    // Automatically sync the fleet item and design with the LATEST record in the history file
                    const latest = rawTests[rawTests.length - 1];
                    setFleet(prev => prev.map(w => w.id === selectedWellId ? {
                        ...w,
                        currentRate: latest.rate,
                        productionTest: latest,
                        lastUpdate: new Date().toISOString()
                    } : w));

                    setWellViewMode('history');
                    alert(`?xito: Se cargaron ${rawTests.length} registros historicos para ${activeWell.name}.`);
                } else {
                    console.log("[History Import] No matches found for:", activeWell.name);
                    alert(`Atencion: No se encontraron registros para el pozo "${activeWell.name}". Verifique que los nombres coincidan.`);
                }
            } catch (err) {
                console.error("Error cargando historial:", err);
                alert("Error al procesar el archivo. Verifique el formato.");
            }
            // Reset input value to allow re-loading the same file
            e.target.value = '';
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    return { processExcelDesignsBuffer, processScadaBuffer, handleImportDesign, handleImportDb, handleImportWellHistory };
};
