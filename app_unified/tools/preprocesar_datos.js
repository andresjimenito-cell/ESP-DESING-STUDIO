import fs from 'fs';
import xlsx from 'xlsx';

// --- CONFIGURACIÓN DE RUTAS ---
const FILES = [
    { excel: './public/PRUEBAS DE PRODUCCION.xlsx', json: './public/scada_precalc.json', name: 'SCADA' },
    { excel: './public/DATAS DE DISEÑO.xlsx', json: './public/designs_precalc.json', name: 'DISEÑOS' }
];

function needsUpdate(excelPath, jsonPath) {
    if (!fs.existsSync(jsonPath)) return true;
    const excelStats = fs.statSync(excelPath);
    const jsonStats = fs.statSync(jsonPath);
    return excelStats.mtime > jsonStats.mtime;
}

console.log("🚀 Iniciando Motor de Carga Inteligente...");

// --- PROCESAR SCADA ---
const scadaFile = FILES[0];
if (needsUpdate(scadaFile.excel, scadaFile.json)) {
    try {
        console.log(`-> 1. Actualizando ${scadaFile.name} (Cambios detectados)...`);
        const workbookScada = xlsx.readFile(scadaFile.excel, {
            cellFormula: false, cellHTML: false, cellText: false, cellStyles: false
        });
        
        let jsonScada = [];
        for (const sheetName of workbookScada.SheetNames) {
            const sheet = workbookScada.Sheets[sheetName];
            const previewRows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0, blankrows: false });
            let headerRowIdx = -1;
            let dualHeaderRow = [];
            
            for (let i = 0; i < Math.min(40, previewRows.length); i++) {
                const row = (previewRows[i] || []).map(c => String(c || '').toUpperCase().trim());
                if (row.includes('POZO') && (row.includes('FECHA') || row.includes('BFPD'))) {
                    headerRowIdx = i;
                    if (i > 0) dualHeaderRow = (previewRows[i-1] || []).map(c => String(c || '').toUpperCase().trim());
                    break;
                }
            }

            if (headerRowIdx !== -1) {
                const rowsRaw = xlsx.utils.sheet_to_json(sheet, { range: headerRowIdx, header: 1 });
                let lastTopHeader = '';
                const genericUnits = ['PSI', '°F', 'HZ', 'DIA', 'OPER', 'BPD', 'BFPD', 'BSW', '%'];
                const headers = (rowsRaw[0] || []).map((h, idx) => {
                    const main = String(h || '').toUpperCase().trim();
                    let top = dualHeaderRow[idx] || '';
                    if (top) lastTopHeader = top; else if (genericUnits.includes(main) || !main) top = lastTopHeader;
                    return (top && (genericUnits.includes(main) || !main)) ? `${top}_${main}`.replace(/_$/, '') : (main || top);
                });

                const rows = rowsRaw.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((h, idx) => { obj[h] = row[idx]; });
                    return obj;
                });

                const lastValidPipMap = {};
                jsonScada = rows.map(r => {
                    const well = String(r['POZO'] || '').trim().toUpperCase();
                    let rawPip = String(r['PIP_PSI'] || r['PIP'] || 0).trim();
                    let cleanPip = rawPip.replace(/[^*0-9.,-]/g, '').replace(/\*.*$/, '').replace(',', '.');
                    let pip = parseFloat(cleanPip) || 0;
                    if (pip <= 0) pip = lastValidPipMap[well] || 0; else lastValidPipMap[well] = pip;
                    return { ...r, PIP: pip };
                });
                if (jsonScada.length > 0) break;
            }
        }
        fs.writeFileSync(scadaFile.json, JSON.stringify(jsonScada));
        console.log(`✅ ${scadaFile.name} Sincronizado.`);
    } catch (e) {
        console.error(`Error en ${scadaFile.name}:`, e.message);
    }
} else {
    console.log(`⏩ ${scadaFile.name} al día. Saltando procesamiento.`);
}

// --- PROCESAR DISEÑOS ---
const designFile = FILES[1];
if (needsUpdate(designFile.excel, designFile.json)) {
    try {
        console.log(`-> 2. Actualizando ${designFile.name} (Cambios detectados)...`);
        const workbookDesigns = xlsx.readFile(designFile.excel, {
            cellFormula: false, cellHTML: false, cellText: false, cellStyles: false
        });
        const mainSheet = workbookDesigns.Sheets[workbookDesigns.SheetNames[0]];
        const jsonDesigns = xlsx.utils.sheet_to_json(mainSheet);
        
        let jsonSurvey = [];
        const surveySheetName = workbookDesigns.SheetNames.find(s => String(s).toUpperCase().includes('SURVEY'));
        if (surveySheetName) {
            const surveySheet = workbookDesigns.Sheets[surveySheetName];
            const previewRows = xlsx.utils.sheet_to_json(surveySheet, { header: 1, range: 0 });
            let headerRow = 0;
            for (let i = 0; i < Math.min(30, previewRows.length); i++) {
                if (previewRows[i] && previewRows[i].some(c => String(c || '').toUpperCase().includes('DEPTH'))) {
                    headerRow = i; break;
                }
            }
            jsonSurvey = xlsx.utils.sheet_to_json(surveySheet, { range: headerRow });
        }

        let jsonMech = [];
        const mechSheetName = workbookDesigns.SheetNames.find(s => {
            const sn = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, '');
            return sn === 'ESTADOSMECANICOS';
        });
        
        if (mechSheetName) {
            const mechSheet = workbookDesigns.Sheets[mechSheetName];
            const previewRows = xlsx.utils.sheet_to_json(mechSheet, { header: 1, range: 0 });
            let headerRow = -1;
            for (let i = 0; i < Math.min(30, previewRows.length); i++) {
                const row = (previewRows[i] || []).map(c => String(c || '').toUpperCase());
                if (row.includes('NICK') || row.includes('INTAKE') || row.includes('PEST')) {
                    headerRow = i; break;
                }
            }
            if (headerRow !== -1) {
                jsonMech = xlsx.utils.sheet_to_json(mechSheet, { range: headerRow });
            } else {
                jsonMech = xlsx.utils.sheet_to_json(mechSheet);
            }
        }

        fs.writeFileSync(designFile.json, JSON.stringify({ 
            data: jsonDesigns, 
            survey: jsonSurvey,
            mech: jsonMech 
        }));
        console.log(`✅ ${designFile.name} Sincronizado (incluye ${jsonMech.length} estados mecánicos).`);
    } catch(e) {
        console.error(`Error en ${designFile.name}:`, e.message);
    }
} else {
    console.log(`⏩ ${designFile.name} al día. Saltando procesamiento.`);
}

console.log("-----------------------------------------");
console.log("Estado: LISTO PARA OPERAR.");
