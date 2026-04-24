import fs from 'fs';
import xlsx from 'xlsx';

console.log("Iniciando pre-procesamiento agresivo a JSON...");

try {
    console.log("-> 1. Procesando PRUEBAS DE PRODUCCION UPME...");
    const workbookScada = xlsx.readFile('./public/PRUEBAS DE PRODUCCION.xlsx', {
        cellFormula: false, cellHTML: false, cellText: false, cellStyles: false
    });
    
    let jsonScada = [];
    for (const sheetName of workbookScada.SheetNames) {
        const sheet = workbookScada.Sheets[sheetName];
        
        // --- BUSCADOR DINÁMICO DE ENCABEZADOS ---
        const previewRows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0, blankrows: false });
        let headerRowIdx = -1;
        let dualHeaderRow = [];
        
        for (let i = 0; i < Math.min(40, previewRows.length); i++) {
            const row = (previewRows[i] || []).map(c => String(c || '').toUpperCase().trim());
            const hasPozo = row.includes('POZO');
            const hasFecha = row.includes('FECHA') || row.includes('DATE');
            const hasRate = row.includes('BFPD') || row.includes('BOPD') || row.includes('PRODUCCION');
            
            if (hasPozo && (hasFecha || hasRate)) {
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
                
                if (top) {
                    lastTopHeader = top;
                } else if (genericUnits.includes(main) || !main) {
                    top = lastTopHeader;
                }

                if (top && (genericUnits.includes(main) || !main)) {
                    return `${top}_${main}`.replace(/_$/, '');
                }
                return main || top;
            });

            const rows = rowsRaw.slice(1).map(row => {
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = row[idx]; });
                return obj;
            });

            // PIP Persistence and Cleaning
            const lastValidPipMap = {};
            jsonScada = rows.map(r => {
                const well = String(r['POZO'] || '').trim().toUpperCase();
                
                // Limpieza agresiva de PIP (maneja '*pip', comas, etc.)
                let rawPip = String(r['PIP_PSI'] || r['PIP'] || 0).trim();
                let cleanPip = rawPip.replace(/[^*0-9.,-]/g, '').replace(/\*.*$/, '');
                
                // Normalización de separadores
                if (cleanPip.includes(',') && !cleanPip.includes('.')) cleanPip = cleanPip.replace(',', '.');
                
                let pip = parseFloat(cleanPip) || 0;
                
                if (pip <= 0) pip = lastValidPipMap[well] || 0;
                else lastValidPipMap[well] = pip;
                
                return { ...r, PIP: pip };
            });

            if (jsonScada.length > 0) break;
        }
    }
    fs.writeFileSync('./public/scada_precalc.json', JSON.stringify(jsonScada));
    console.log(`✅ Éxito! scada_precalc.json creado con ${jsonScada.length} registros. Carga de app ahora instantánea.`);
} catch (e) {
    console.error("Error leyendo SCADA:", e.message);
}

try {
    console.log("-> 2. Procesando DATAS DE DISEÑO ALS...");
    const workbookDesigns = xlsx.readFile('./public/DATAS DE DISEÑO.xlsx', {
        cellFormula: false, cellHTML: false, cellText: false, cellStyles: false
    });
    
    const mainSheet = workbookDesigns.Sheets[workbookDesigns.SheetNames[0]];
    const jsonDesigns = xlsx.utils.sheet_to_json(mainSheet);
    
    let jsonSurvey = [];
    const surveySheetName = workbookDesigns.SheetNames.find(s => {
        const sn = String(s).toUpperCase();
        return sn.includes('SURVEY') || sn.includes('TRAYEC') || sn.includes('DESVIACIÓN');
    });
    
    if (surveySheetName) {
        const surveySheet = workbookDesigns.Sheets[surveySheetName];
        const previewRows = xlsx.utils.sheet_to_json(surveySheet, { header: 1, range: 0, blankrows: false });
        let headerRow = 0;
        for (let i = 0; i < Math.min(30, previewRows.length); i++) {
            if (previewRows[i] && previewRows[i].some(c => String(c || '').toUpperCase().includes('DEPTH'))) {
                headerRow = i; break;
            }
        }
        jsonSurvey = xlsx.utils.sheet_to_json(surveySheet, { range: headerRow });
    }

    fs.writeFileSync('./public/designs_precalc.json', JSON.stringify({ data: jsonDesigns, survey: jsonSurvey }));
    console.log(`✅ Éxito! designs_precalc.json creado con ${jsonDesigns.length} diseños y ${jsonSurvey.length} puntos direccionales.`);
} catch(e) {
    console.error("Error leyendo Diseños:", e.message);
}

console.log("-----------------------------------------");
console.log("Todo listo. Inicia o refresca la aplicación Web.");
