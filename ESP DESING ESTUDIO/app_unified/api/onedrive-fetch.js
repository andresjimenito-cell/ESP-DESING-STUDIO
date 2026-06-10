/**
 * API ROUTE: /api/onedrive-fetch
 *
 * Proxy seguro para descargar archivos Excel desde OneDrive personal
 * usando Microsoft Graph API con OAuth2 (refresh_token → access_token).
 *
 * Variables de entorno requeridas en Vercel:
 *   ONEDRIVE_CLIENT_ID      - Application (client) ID de Azure
 *   ONEDRIVE_CLIENT_SECRET  - Client secret de Azure
 *   ONEDRIVE_REFRESH_TOKEN  - Refresh token obtenido con el script de setup
 *   ONEDRIVE_FILE_ID_DESIGNS - ID del archivo Excel de diseños en OneDrive
 *   ONEDRIVE_FILE_ID_SCADA   - ID del archivo Excel SCADA en OneDrive
 *
 * GET /api/onedrive-fetch?file=designs|scada
 */

import * as XLSX from 'xlsx';
import crypto from 'crypto';

export const config = {
    maxDuration: 60,
};

const TENANT = 'consumers'; // Cuentas Microsoft personales
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Standalone helpers for Node.js backend
const norm_ext = (str) => String(str || '').toLowerCase().replace(/[\s\-_#.]/g, '');

function parseDesignsExcel(buffer) {
    const tempWorkbook = XLSX.read(buffer, { bookSheets: true });
    const sheetsToParse = [];
    
    if (tempWorkbook.SheetNames.length > 0) {
        sheetsToParse.push(tempWorkbook.SheetNames[0]);
    }
    
    const mechSheetName = tempWorkbook.SheetNames.find(s => norm_ext(s) === 'estadosmecanicos');
    if (mechSheetName) {
        sheetsToParse.push(mechSheetName);
    }
    
    const surveySheetName = tempWorkbook.SheetNames.find(s => {
        const sn = String(s).toUpperCase();
        return sn.includes('SURVEY') || sn.includes('TRAYEC') || sn.includes('DESVIACI\u00d3N') || sn.includes('DESVIACION') || sn.includes('DESVIACI"N') || sn.includes('DESVIACI\"N');
    });
    if (surveySheetName) {
        sheetsToParse.push(surveySheetName);
    }

    const workbook = XLSX.read(buffer, {
        type: 'buffer',
        sheets: sheetsToParse,
        cellFormula: false,
        cellHTML: false,
        cellText: false,
        cellStyles: false,
        dense: true
    });

    const mainSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[mainSheetName];
    const json = XLSX.utils.sheet_to_json(sheet);

    let mechJson = [];
    if (mechSheetName) {
        const mechSheet = workbook.Sheets[mechSheetName];
        // Robust header detection for mechanical sheet
        const rows = XLSX.utils.sheet_to_json(mechSheet, { header: 1 });
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(20, rows.length); r++) {
            const rowArr = (rows[r] || []).map(c => norm_ext(String(c || '')));
            if (rowArr.includes('nick') || rowArr.includes('intakemd') || rowArr.includes('pest') || rowArr.includes('intake')) {
                headerRowIdx = r;
                break;
            }
        }
        mechJson = (headerRowIdx !== -1)
            ? XLSX.utils.sheet_to_json(mechSheet, { range: headerRowIdx })
            : XLSX.utils.sheet_to_json(mechSheet);
    }

    let jsonSurvey = [];
    if (surveySheetName) {
        const surveySheet = workbook.Sheets[surveySheetName];
        let headerRow = 0;
        let detectedWellName = '';
        for (let i = 0; i < 20; i++) {
            const temp = XLSX.utils.sheet_to_json(surveySheet, { range: i, header: 1 });
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
                    headerRow = i; 
                    break;
                }
            }
        }
        const rawSurvey = XLSX.utils.sheet_to_json(surveySheet, { range: headerRow });
        
        const surveyByWell = {};
        let lastWellName = detectedWellName || 'UNKNOWN';

        rawSurvey.forEach(row => {
            const wellKey = Object.keys(row).find(k => {
                const nk = norm_ext(k);
                return nk === 'pozo' || nk === 'well' || nk === 'wellname' || nk === 'nombrepozo' || nk === 'nombrewell' || nk === 'nick';
            });
            
            let well = '';
            if (wellKey) {
                well = String(row[wellKey] || '').trim().toUpperCase();
            }
            
            if (well && well !== 'UNKNOWN' && well.length > 1) {
                lastWellName = well;
            } else {
                well = lastWellName;
            }
            
            // Assign the resolved well name back to the row so that client can map it
            const targetKey = wellKey || 'POZO';
            row[targetKey] = well;

            if (!surveyByWell[well]) surveyByWell[well] = [];
            surveyByWell[well].push(row);
        });

        Object.values(surveyByWell).forEach(wellRows => {
            jsonSurvey.push(...wellRows);
        });
        console.log(`[OneDrive Backend] Imported full survey: ${jsonSurvey.length} rows.`);
    }

    return {
        data: json,
        survey: jsonSurvey,
        mech: mechJson
    };
}

function parseScadaExcel(buffer) {
    const tempWorkbook = XLSX.read(buffer, { bookSheets: true });

    let scadaJson = [];
    for (const sheetName of tempWorkbook.SheetNames) {
        const singleWorkbook = XLSX.read(buffer, {
            type: 'buffer',
            sheets: [sheetName],
            cellFormula: false,
            cellHTML: false,
            cellText: false,
            cellStyles: false,
            dense: true
        });
        const sheet = singleWorkbook.Sheets[sheetName];
        if (!sheet) continue;

        const previewRows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, blankrows: false });
        
        let headerRowIdx = -1;
        let dualHeaderRow = [];

        for (let i = 0; i < Math.min(40, previewRows.length); i++) {
            const row = (previewRows[i] || []).map(c => String(c || '').toUpperCase().trim());
            const hasPozo = row.includes('POZO') || row.includes('WELL');
            const hasFecha = row.includes('FECHA') || row.includes('DATE');
            const hasRate = row.includes('BFPD') || row.includes('BOPD') || row.includes('PRODUCCION');

            if (hasPozo && (hasFecha || hasRate)) {
                headerRowIdx = i;
                if (i > 0) {
                    dualHeaderRow = (previewRows[i - 1] || []).map(c => String(c || '').toUpperCase().trim());
                }
                break;
            }
        }

        if (headerRowIdx !== -1) {
            const rowsRaw = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, header: 1 });
            let lastTopHeader = '';
            const headers = (rowsRaw[0] || []).map((h, idx) => {
                const sub = String(h || '').toUpperCase().trim();
                const top = String(dualHeaderRow[idx] || '').toUpperCase().trim();

                if (top) lastTopHeader = top;
                const currentTop = top || lastTopHeader;

                if (sub && currentTop) {
                    if (['PSI', '°F', 'HZ', 'DIA', 'OPER', 'UNIT'].includes(sub)) return currentTop;
                    if (sub !== currentTop) return `${currentTop}_${sub}`;
                    return sub;
                }

                return sub || currentTop || `COL_${idx}`;
            });

            scadaJson = rowsRaw.slice(1).map(row => {
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = row[idx]; });
                return obj;
            });

            if (scadaJson.length > 0) break;
        }
    }

    return scadaJson;
}

/**
 * Intercambia el refresh_token por un access_token nuevo.
 * El refresh_token también se renueva en cada llamada.
 */
async function getAccessToken() {
    const {
        ONEDRIVE_CLIENT_ID: clientId,
        ONEDRIVE_CLIENT_SECRET: clientSecret,
        ONEDRIVE_REFRESH_TOKEN: refreshToken,
    } = process.env;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            'Faltan variables de entorno. Configura ONEDRIVE_CLIENT_ID, ' +
            'ONEDRIVE_CLIENT_SECRET y ONEDRIVE_REFRESH_TOKEN en Vercel.'
        );
    }

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'https://graph.microsoft.com/Files.Read offline_access',
        }).toString(),
    });

    const data = await res.json();

    if (data.error) {
        throw new Error(`OAuth error: ${data.error} - ${data.error_description}`);
    }

    return {
        accessToken: data.access_token,
        newRefreshToken: data.refresh_token, // Microsoft puede rotar el token
    };
}

/**
 * Descarga el contenido binario de un archivo de OneDrive
 * usando Microsoft Graph API.
 */
async function downloadOneDriveFile(fileId, accessToken) {
    // Graph API: /me/drive/items/{item-id}/content redirige al blob
    const downloadUrl = `${GRAPH_BASE}/me/drive/items/${fileId}/content`;

    const res = await fetch(downloadUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        redirect: 'follow',
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Graph API ${res.status}: ${errText.substring(0, 200)}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const buffer = await res.arrayBuffer();

    // Verificar magic bytes de XLSX (ZIP: PK\x03\x04)
    const view = new Uint8Array(buffer);
    if (view[0] !== 0x50 || view[1] !== 0x4B) {
        throw new Error(`La respuesta no es un archivo XLSX válido (content-type: ${contentType})`);
    }

    return buffer;
}

export default async function handler(req, res) {
    // Solo GET / OPTIONS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Cabeceras CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');

    function verifyToken(token) {
        try {
            if (!token) return false;
            const parts = token.split('.');
            if (parts.length !== 2) return false;
            const JWT_SECRET = process.env.JWT_SECRET || 'frontera-secret-key-129847129';
            const payload = Buffer.from(parts[0], 'base64').toString('utf8');
            const signature = parts[1];
            const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
            if (signature !== expectedSignature) return false;
            const data = JSON.parse(payload);
            if (data.exp < Date.now()) return false;
            if (!data.email || !data.email.toLowerCase().endsWith('@fronteraenergy.ca')) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    const token = req.headers['x-session-token'];
    if (!verifyToken(token)) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    // Determinar qué archivo descargar
    const { file } = req.query;
    let fileId;

    if (file === 'designs') {
        fileId = process.env.ONEDRIVE_FILE_ID_DESIGNS;
    } else if (file === 'scada') {
        fileId = process.env.ONEDRIVE_FILE_ID_SCADA;
    } else if (req.query.url) {
        // Modo legacy: se pasó una URL, intentar extraer el file ID del share link
        return res.status(400).json({
            error: 'El modo URL ya no está soportado. Usa ?file=designs o ?file=scada',
            hint: 'Configura ONEDRIVE_FILE_ID_DESIGNS y ONEDRIVE_FILE_ID_SCADA en Vercel.',
        });
    } else {
        return res.status(400).json({
            error: 'Parámetro requerido: ?file=designs o ?file=scada',
        });
    }

    if (!fileId) {
        return res.status(500).json({
            error: `Variable de entorno no configurada: ${file === 'designs' ? 'ONEDRIVE_FILE_ID_DESIGNS' : 'ONEDRIVE_FILE_ID_SCADA'}`,
            hint: 'Ejecuta el script de setup y configura las variables en Vercel.',
        });
    }

    try {
        console.log(`[OneDrive] Descargando archivo: ${file} (ID: ${fileId})`);

        // 1. Obtener access token desde refresh token
        const { accessToken } = await getAccessToken();
        console.log(`[OneDrive] ✅ Token obtenido`);

        // 2. Descargar el archivo
        const buffer = await downloadOneDriveFile(fileId, accessToken);
        console.log(`[OneDrive] ✅ Archivo descargado: ${buffer.byteLength} bytes`);

        // 3. Retornar el archivo en formato solicitado
        const { format } = req.query;
        if (format === 'json') {
            console.log(`[OneDrive] Parseando archivo a JSON en el servidor...`);
            let parsedData;
            if (file === 'designs') {
                parsedData = parseDesignsExcel(buffer);
            } else {
                parsedData = parseScadaExcel(buffer);
            }
            console.log(`[OneDrive] ✅ Parseo completado exitosamente`);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return res.status(200).json(parsedData);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', buffer.byteLength);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(Buffer.from(buffer));

    } catch (err) {
        console.error('[OneDrive] Error:', err.message);

        // Dar error descriptivo según el tipo de fallo
        if (err.message.includes('OAuth') || err.message.includes('refresh_token')) {
            return res.status(401).json({
                error: 'Error de autenticación con OneDrive.',
                detail: err.message,
                hint: 'El refresh_token puede haber expirado. Vuelve a ejecutar el script de setup.',
            });
        }

        return res.status(502).json({
            error: 'Error al descargar desde OneDrive.',
            detail: err.message,
        });
    }
}
