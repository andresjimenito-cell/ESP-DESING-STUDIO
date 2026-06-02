/**
 * ESP DESIGN STUDIO — Backend de Desarrollo Local
 * 
 * Este servidor es SOLO para desarrollo local con `npm run dev`.
 * En producción (Vercel), las rutas /api/* son manejadas por las
 * funciones serverless en app_unified/api/.
 * 
 * Endpoints replicados para dev local:
 *   GET  /api/onedrive-fetch?url=<shareUrl>   → Proxy OneDrive
 *   POST /api/copilot/stream                   → Proxy IA OpenRouter
 *   GET  /api/ai-memory                        → Memoria IA (fichero local)
 *   POST /api/ai-memory                        → Guardar memoria IA
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'frontera-secret-key-129847129';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'Frontera2026!';

function generateToken(email) {
    const payload = JSON.stringify({ email, exp: Date.now() + 24 * 60 * 60 * 1000 });
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    return Buffer.from(payload).toString('base64') + '.' + signature;
}

function verifyToken(token) {
    try {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        const payload = Buffer.from(parts[0], 'base64').toString('utf8');
        const signature = parts[1];
        const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
        if (signature !== expectedSignature) return null;
        const data = JSON.parse(payload);
        if (data.exp < Date.now()) return null;
        if (!data.email || !data.email.toLowerCase().endsWith('@fronteraenergy.ca')) return null;
        return data;
    } catch (e) {
        return null;
    }
}

const authMiddleware = (req, res, next) => {
    const token = req.headers['x-session-token'];
    if (!token || !verifyToken(token)) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }
    next();
};

const usersPath = path.join(__dirname, '..', 'app_unified', 'users.json');

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const emailStr = String(email || '').trim().toLowerCase();
    
    if (!emailStr || !emailStr.endsWith('@fronteraenergy.ca')) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    if (password !== '2026') {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    const token = generateToken(emailStr);
    res.json({ token });
});

// ── AI MEMORY (fichero local para dev) ─────────────────────────────────────
const memoryPath = path.join(__dirname, '..', 'app_unified', 'ai_memory.json');

app.get('/api/ai-memory', authMiddleware, (req, res) => {
    try {
        if (fs.existsSync(memoryPath)) {
            const data = fs.readFileSync(memoryPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.send(data);
        } else {
            res.json([]);
        }
    } catch (e) {
        res.json([]);
    }
});

app.post('/api/ai-memory', authMiddleware, (req, res) => {
    try {
        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2);
        fs.writeFileSync(memoryPath, body, 'utf-8');
        res.send('OK');
    } catch (e) {
        console.error('[AI Memory] Error saving:', e);
        res.status(500).send('Error');
    }
});

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
    
    const surveySheetNames = tempWorkbook.SheetNames.filter(s => {
        const sn = String(s).toUpperCase();
        return sn.includes('SURVEY') || sn.includes('TRAYEC') || sn.includes('DESVIACI\u00d3N') || sn.includes('DESVIACION') || sn.includes('DESVIACI"N') || sn.includes('DESVIACI\"N');
    });
    if (surveySheetNames.length > 0) {
        surveySheetNames.forEach(s => sheetsToParse.push(s));
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
    if (surveySheetNames.length > 0) {
        let bestRawSurvey = [];
        let bestDetectedWellName = '';
        
        for (const sName of surveySheetNames) {
            const surveySheet = workbook.Sheets[sName];
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
            const currentSurvey = XLSX.utils.sheet_to_json(surveySheet, { range: headerRow });
            if (currentSurvey.length > bestRawSurvey.length) {
                bestRawSurvey = currentSurvey;
                bestDetectedWellName = detectedWellName;
            }
        }
        
        const rawSurvey = bestRawSurvey;
        const surveyByWell = {};
        let lastWellName = bestDetectedWellName || 'UNKNOWN';

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
        console.log(`[OneDrive Proxy] Imported full survey: ${jsonSurvey.length} rows.`);
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

const TENANT = 'consumers';
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function getAccessToken() {
    const {
        ONEDRIVE_CLIENT_ID: clientId,
        ONEDRIVE_CLIENT_SECRET: clientSecret,
        ONEDRIVE_REFRESH_TOKEN: refreshToken,
    } = process.env;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            'Faltan variables de entorno. Configura ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET y ONEDRIVE_REFRESH_TOKEN.'
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
        newRefreshToken: data.refresh_token,
    };
}

async function downloadOneDriveFile(fileId, accessToken) {
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

    const buffer = await res.arrayBuffer();
    return buffer;
}

// ── ONEDRIVE PROXY (bypass CORS para dev local y unificado) ────────────────────────────
app.get('/api/onedrive-fetch', authMiddleware, async (req, res) => {
    const { file, format, url } = req.query;

    if (!file && !url) {
        return res.status(400).json({ error: 'Parámetro "file" o "url" requerido.' });
    }

    try {
        let buffer;
        if (url) {
            const base64Url = Buffer.from(url).toString('base64')
                .replace(/=/g, '')
                .replace(/\//g, '_')
                .replace(/\+/g, '-');
            
            const directUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Url}/root/content`;
            console.log(`[OneDrive Proxy] Descargando desde URL compartida: ${directUrl}`);
            const fileRes = await fetch(directUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });
            if (!fileRes.ok) throw new Error(`Descarga fallida: HTTP ${fileRes.status}`);
            buffer = await fileRes.arrayBuffer();
        } else {
            let fileId;
            if (file === 'designs') {
                fileId = process.env.ONEDRIVE_FILE_ID_DESIGNS;
            } else if (file === 'scada') {
                fileId = process.env.ONEDRIVE_FILE_ID_SCADA;
            }

            if (!fileId) {
                return res.status(500).json({
                    error: `Variable de entorno no configurada: ${file === 'designs' ? 'ONEDRIVE_FILE_ID_DESIGNS' : 'ONEDRIVE_FILE_ID_SCADA'}`
                });
            }

            console.log(`[OneDrive Proxy] Descargando por ID: ${file} (ID: ${fileId})`);
            const { accessToken } = await getAccessToken();
            buffer = await downloadOneDriveFile(fileId, accessToken);
        }

        if (format === 'json') {
            console.log(`[OneDrive Proxy] Parseando archivo a JSON en el servidor...`);
            let parsedData;
            if (file === 'designs' || url) {
                parsedData = parseDesignsExcel(buffer);
            } else {
                parsedData = parseScadaExcel(buffer);
            }
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return res.status(200).json(parsedData);
        }

        const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.byteLength);
        res.setHeader('Cache-Control', 'no-store');
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('[OneDrive Proxy] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ── AI COPILOT STREAM ──────────────────────────────────────────────────────
app.post('/api/copilot/stream', authMiddleware, async (req, res) => {
    const { prompt, messages, systemInstruction } = req.body;

    let apiKey = process.env.OPENROUTER_API_KEY;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const customKey = authHeader.substring(7).trim();
        if (customKey && customKey !== 'null' && customKey !== 'undefined' && customKey.length > 0) {
            apiKey = customKey;
        }
    }

    if (!apiKey) {
        res.status(400).send('API Key de OpenRouter no configurada.');
        return;
    }

    try {
        const apiMessages = [];
        if (systemInstruction) apiMessages.push({ role: 'system', content: systemInstruction });
        if (messages && Array.isArray(messages)) {
            apiMessages.push(...messages);
        } else if (prompt) {
            apiMessages.push({ role: 'user', content: prompt });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'ESP Design Studio',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: apiMessages,
                stream: true,
                temperature: 0.1,
            }),
        });

        if (!response.ok) throw new Error(`OpenRouter HTTP Error: ${response.status}`);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.includes('[DONE]')) break;
                if (trimmed.startsWith('data: ')) {
                    try {
                        const parsed = JSON.parse(trimmed.substring(6));
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) res.write(content);
                    } catch (e) { /* fragmento parcial */ }
                }
            }
            if (done) break;
        }
        res.end();

    } catch (error) {
        console.error('[Copilot Stream] Error:', error);
        if (!res.headersSent) res.status(500).send('ERROR_GENERATING_TECHNICAL_AUDIT');
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ [ESP DEV SERVER] Servidor de desarrollo activo en puerto ${PORT}`);
    console.log(`   Endpoints disponibles:`);
    console.log(`   - GET  http://localhost:${PORT}/api/onedrive-fetch?url=<shareUrl>`);
    console.log(`   - POST http://localhost:${PORT}/api/copilot/stream`);
    console.log(`   - GET  http://localhost:${PORT}/api/ai-memory`);
    console.log(`   - POST http://localhost:${PORT}/api/ai-memory`);
});
