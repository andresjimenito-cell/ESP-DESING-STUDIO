/**
 * API ROUTE: /api/copilot/stream
 * 
 * Proxy de streaming para la IA (OpenRouter).
 * Migrado de backend/server.js a función Vercel serverless.
 * 
 * POST /api/copilot/stream
 * Body: { prompt?, messages?, systemInstruction? }
 * Headers: Authorization: Bearer <api_key> (opcional)
 */

import crypto from 'crypto';

export const config = {
    maxDuration: 60,
};

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

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    const sessionToken = req.headers['x-session-token'];
    if (!verifyToken(sessionToken)) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

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
        return res.status(400).send('API Key de OpenRouter no configurada.');
    }

    try {
        const apiMessages = [];
        if (systemInstruction) {
            apiMessages.push({ role: 'system', content: systemInstruction });
        }
        if (messages && Array.isArray(messages)) {
            apiMessages.push(...messages);
        } else if (prompt) {
            apiMessages.push({ role: 'user', content: prompt });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://esp-design-studio.vercel.app',
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

        if (!response.ok) {
            throw new Error(`OpenRouter HTTP Error: ${response.status}`);
        }

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
                        const jsonStr = trimmed.substring(6);
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            res.write(content);
                        }
                    } catch (e) {
                        // Ignorar fragmentos parciales de JSON
                    }
                }
            }

            if (done) break;
        }

        res.end();

    } catch (error) {
        console.error('[Copilot Stream Error]', error);
        if (!res.headersSent) {
            res.status(500).send('ERROR_GENERATING_TECHNICAL_AUDIT');
        }
    }
}
