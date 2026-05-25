import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// --- PROCESOS EN SEGUNDO PLANO Y CONTROLADOR DE CACHÉ ---
const rootDir = path.resolve(__dirname, '..');
const appUnifiedDir = path.join(rootDir, 'app_unified');

let isSyncing = false;
let clients = [];

// Helper para ejecutar comandos del sistema
const runCommand = (command, options = {}) => {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
};

// Sincronizador de OneDrive y preprocesador
const runBackgroundSync = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
        console.log(`\n[BACKGROUND SYNC] comprobando cambios en OneDrive...`);
        
        // 1. Ejecutar Python cloud_connector.py (valida ETags en OneDrive)
        const pythonEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };
        const pythonResult = await runCommand('python services/cloud_connector.py', {
            cwd: rootDir,
            env: pythonEnv
        });
        
        console.log(`[BACKGROUND SYNC] cloud_connector.py:\n${pythonResult.stdout}`);
        
        // 2. Ejecutar Node preprocesar_datos.js (genera JSON solo si hay cambios)
        const preprocessResult = await runCommand('node tools/preprocesar_datos.js', {
            cwd: appUnifiedDir
        });
        
        console.log(`[BACKGROUND SYNC] preprocesar_datos.js:\n${preprocessResult.stdout}`);
        
        // 3. Notificar cambios a los clientes conectados
        if (pythonResult.stdout.includes('[SINCRONIZADO]') || preprocessResult.stdout.includes('Actualizando')) {
            console.log(`[BACKGROUND SYNC] ¡Nuevos datos detectados! Enviando actualización a los clientes...`);
            clients.forEach(client => {
                client.res.write(`data: ${JSON.stringify({ type: 'update', timestamp: Date.now() })}\n\n`);
            });
        } else {
            console.log(`[BACKGROUND SYNC] Todo al día. No se requirieron cambios.`);
        }
    } catch (err) {
        console.error(`[BACKGROUND SYNC] Error en sincronización:`, err);
    } finally {
        isSyncing = false;
    }
};

// Iniciar worker en segundo plano (espera 5s al arrancar, luego corre cada 60s)
setTimeout(() => {
    runBackgroundSync();
    setInterval(runBackgroundSync, 60000);
}, 5000);

// Endpoint SSE para recibir notificaciones de actualización en tiempo real en el frontend
app.get('/api/data/live-updates', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Encabezado para evitar almacenamiento en búfer en algunos proxies
    res.setHeader('X-Accel-Buffering', 'no');
    
    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    console.log(`🔌 [SSE CONNECTED] Cliente registrado (${clientId}). Total clientes: ${clients.length}`);

    // Ping para mantener viva la conexión
    const keepAliveInterval = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(keepAliveInterval);
        clients = clients.filter(c => c.id !== clientId);
        console.log(`🔌 [SSE DISCONNECTED] Cliente desconectado (${clientId}). Total clientes: ${clients.length}`);
    });
});

// Endpoint para forzar una sincronización manual
app.post('/api/data/sync', async (req, res) => {
    if (isSyncing) {
        return res.status(409).json({ message: "Sincronización en curso actualmente." });
    }
    // Ejecutar de forma asíncrona sin bloquear la respuesta
    runBackgroundSync().catch(err => console.error("Error en sync manual:", err));
    res.json({ success: true, message: "Sincronización iniciada en segundo plano." });
});


// Proxy Endpoint con soporte de Server-Sent Events (SSE) para Streaming de IA
app.post('/api/copilot/stream', async (req, res) => {
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
        res.status(400).send("API Key de OpenRouter no configurada.");
        return;
    }

    try {
        const apiMessages = [];
        if (systemInstruction) {
            apiMessages.push({ role: "system", content: systemInstruction });
        }
        if (messages && Array.isArray(messages)) {
            apiMessages.push(...messages);
        } else if (prompt) {
            apiMessages.push({ role: "user", content: prompt });
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "ESP Design Studio",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openrouter/free",
                messages: apiMessages,
                stream: true,
                temperature: 0.1
            })
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
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.includes('[DONE]')) break;
                if (trimmed.startsWith('data: ')) {
                    try {
                        const jsonStr = trimmed.substring(6);
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed.choices[0]?.delta?.content || "";
                        if (content) {
                            res.write(content);
                        }
                    } catch (e) {
                        // Ignorar fragmentos parciales
                    }
                }
            }

            if (done) break;
        }
        res.end();

    } catch (error) {
        console.error("Error crítico de transmisión de datos de IA:", error);
        if (!res.headersSent) {
            res.status(500).send("ERROR_GENERATING_TECHNICAL_AUDIT");
        }
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ [ESP-CORE SERVER] Procesador de IA activo en el puerto ${PORT}`);
});
