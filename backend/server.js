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
    if (!email || !password) {
        return res.status(400).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }
    
    const emailStr = String(email).trim().toLowerCase();
    if (!emailStr.endsWith('@fronteraenergy.ca')) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    let users = {};
    try {
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
    } catch (e) {
        users = {};
    }

    if (!users[emailStr]) {
        // First login: register user and password
        users[emailStr] = password;
        try {
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
        } catch (e) {
            console.error('Error guardando usuario:', e);
        }
    } else {
        // Subsequent login: check password
        if (users[emailStr] !== password) {
            return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
        }
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

// ── ONEDRIVE PROXY (bypass CORS para dev local) ────────────────────────────
app.get('/api/onedrive-fetch', authMiddleware, async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Parámetro "url" requerido.' });

    try {
        // Convertir la URL compartida de OneDrive a formato base64 compatible con la API de Microsoft
        const base64Url = Buffer.from(url).toString('base64')
            .replace(/=/g, '')
            .replace(/\//g, '_')
            .replace(/\+/g, '-');
        
        const directUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Url}/root/content`;

        // Descargar el archivo
        console.log(`[OneDrive Proxy] Descargando desde la API de OneDrive: ${directUrl}`);
        const fileRes = await fetch(directUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });

        if (!fileRes.ok) throw new Error(`Descarga fallida: HTTP ${fileRes.status}`);

        const buffer = await fileRes.arrayBuffer();
        const contentType = fileRes.headers.get('content-type') ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        console.log(`[OneDrive Proxy] ✅ Archivo descargado (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
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
