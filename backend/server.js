import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Proxy Endpoint con soporte de Server-Sent Events (SSE) para Streaming
app.post('/api/copilot/stream', async (req, res) => {
    const { prompt, messages, systemInstruction } = req.body;

    // Determinar la API Key: usar la del header Authorization (proveída por el usuario) o la del .env
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

        // Cabeceras cruciales para forzar al navegador a mantener la tubería abierta
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
            // Mantener la última línea incompleta en el buffer
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
                        // Ignorar fragmentos parciales de líneas SSE malformadas
                    }
                }
            }

            if (done) break;
        }
        res.end(); // Cerrar el canal de comunicación fluidamente

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
