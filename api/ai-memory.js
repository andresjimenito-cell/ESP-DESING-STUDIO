/**
 * API ROUTE: /api/ai-memory
 * 
 * Gestiona la memoria de la IA usando localStorage en el cliente.
 * En Vercel serverless, el filesystem es efímero, por lo que
 * este endpoint usa /tmp como caché temporal entre invocaciones.
 * El almacenamiento principal es localStorage del navegador.
 * 
 * GET  /api/ai-memory       → retorna la memoria guardada
 * POST /api/ai-memory       → guarda la memoria
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MEMORY_PATH = '/tmp/esp_ai_memory.json';

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
        if (!data.email || !data.email.toLowerCase().endsWith('@fronteraener.ca')) return false;
        return true;
    } catch (e) {
        return false;
    }
}

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const token = req.headers['x-session-token'];
    if (!verifyToken(token)) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    if (req.method === 'GET') {
        try {
            if (fs.existsSync(MEMORY_PATH)) {
                const data = fs.readFileSync(MEMORY_PATH, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).send(data);
            }
            return res.status(200).json([]);
        } catch (e) {
            return res.status(200).json([]);
        }
    }

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            fs.writeFileSync(MEMORY_PATH, body, 'utf-8');
            return res.status(200).send('OK');
        } catch (e) {
            console.error('[AI Memory] Error saving:', e);
            return res.status(500).send('Error saving memory');
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
