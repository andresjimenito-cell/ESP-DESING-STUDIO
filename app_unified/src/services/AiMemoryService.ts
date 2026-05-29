
/**
 * AI MEMORY SERVICE (Local Knowledge Base)
 * 
 * Este servicio actúa como el "Cerebro Local" de la aplicación.
 * Permite guardar diagnósticos, auditorías y recomendaciones técnicas
 * para que la aplicación pueda consultarlas incluso sin conexión a internet.
 */

export interface AiCase {
    id: string;
    timestamp: string;
    category: 'diagnosis' | 'design' | 'optimization' | 'alarm' | 'summary';
    wellName?: string;
    technicalSignature: string; // Hash o string único basado en parámetros clave
    context: any;              // Los parámetros técnicos que generaron el caso
    recommendation: string;    // Lo que la IA (o el experto) dijo
    userRating?: number;       // Para "refuerzo" (aprendizaje)
}

const MEMORY_KEY = 'ESP_STUDIO_AI_MEMORY';

// Cache local para acceso instantáneo
let localMemoryCache: AiCase[] = [];
let isSyncing = false;
let isConsolidating = false;

export const AiMemoryService = {
    /**
     * Inicializa la memoria cargando datos desde el servidor.
     */
    init: async () => {
        try {
            const resp = await fetch('/api/ai-memory');
            if (resp.ok) {
                const data = await resp.json();
                
                // Verificar si la base de datos descargada del servidor es gigante
                let memString = JSON.stringify(data);
                let loadedData = data;
                if (memString.length > 4.5 * 1024 * 1024) {
                    console.warn("[AI Memory] La memoria del servidor excede 4.5MB en el inicio. Recortando a los 100 más recientes.");
                    loadedData = data.slice(0, 100);
                    memString = JSON.stringify(loadedData);
                    // Actualizar en el servidor también para mantener sincronía
                    fetch('/api/ai-memory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: memString
                    });
                }
                
                localMemoryCache = loadedData;
                localStorage.setItem(MEMORY_KEY, memString);
                console.log("[AI Memory] Sincronizado con el servidor exitosamente.");
            }
        } catch (e) {
            console.warn("[AI Memory] No se pudo conectar al servidor, usando caché local.");
            const local = localStorage.getItem(MEMORY_KEY);
            if (local) {
                try {
                    let parsed = JSON.parse(local);
                    let memStr = local;
                    if (memStr.length > 4.5 * 1024 * 1024) {
                        console.warn("[AI Memory] La memoria local excede 4.5MB en el inicio. Recortando a los 100 más recientes.");
                        parsed = parsed.slice(0, 100);
                        localStorage.setItem(MEMORY_KEY, JSON.stringify(parsed));
                    }
                    localMemoryCache = parsed;
                } catch (parseErr) {
                    console.error("[AI Memory] Error al parsear memoria local:", parseErr);
                }
            }
        }
    },

    /**
     * Guarda un nuevo aprendizaje en la memoria local y lo sube al servidor.
     */
    saveCase: async (data: Omit<AiCase, 'id' | 'timestamp'>) => {
        try {
            const memory = AiMemoryService.getMemory();
            const newCase: AiCase = {
                ...data,
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString()
            };
            
            // Evitar duplicados exactos en corto tiempo
            const lastCase = memory[0];
            if (lastCase && lastCase.technicalSignature === newCase.technicalSignature) return;

            let updatedMemory = [newCase, ...memory].slice(0, 500); // Aumentamos capacidad a 500
            
            // --- CONTROL DE TAMAÑO FÍSICO DE LA MEMORIA (MÁX ~4.5MB) ---
            let memString = JSON.stringify(updatedMemory);
            if (memString.length > 4.5 * 1024 * 1024) {
                console.warn(`[AI Memory] Límite de 4.5MB excedido en guardado (${(memString.length / (1024 * 1024)).toFixed(2)}MB). Reseteando/Recortando preventivamente los registros más antiguos.`);
                // Mantenemos solo los 100 casos más recientes para garantizar espacio
                updatedMemory = updatedMemory.slice(0, 100);
                memString = JSON.stringify(updatedMemory);
            }

            // 1. Actualizar Cache y LocalStorage (Instantáneo)
            localMemoryCache = updatedMemory;
            try {
                localStorage.setItem(MEMORY_KEY, memString);
            } catch (storageError) {
                console.error("[AI Memory] Error de QuotaExceeded al guardar en localStorage. Forzando reseteo agresivo a los 50 más recientes.", storageError);
                updatedMemory = updatedMemory.slice(0, 50);
                localMemoryCache = updatedMemory;
                localStorage.setItem(MEMORY_KEY, JSON.stringify(updatedMemory));
            }

            // 2. Sincronizar con el Servidor (Segundo plano)
            if (!isSyncing) {
                isSyncing = true;
                fetch('/api/ai-memory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedMemory)
                }).finally(() => isSyncing = false);
            }

            console.log(`[AI Memory] Nuevo conocimiento guardado: ${newCase.category}`);

            // 3. Auto-consolidación si superamos el límite (40 casos detallados)
            const detailedCases = updatedMemory.filter(c => c.category !== 'summary');
            if (detailedCases.length >= 40) {
                // Ejecutar consolidación en segundo plano sin bloquear
                AiMemoryService.consolidateMemory().catch(err => {
                    console.error("[AI Memory] Error en auto-consolidación de memoria:", err);
                });
            }
        } catch (e) {
            console.error("Error saving to AI Memory:", e);
        }
    },

    /**
     * Recupera toda la memoria guardada.
     */
    getMemory: (): AiCase[] => {
        if (localMemoryCache.length > 0) return localMemoryCache;
        try {
            const data = localStorage.getItem(MEMORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    /**
     * Elimina un caso de la memoria local y lo sincroniza con el servidor.
     */
    deleteCase: async (id: string) => {
        try {
            const memory = AiMemoryService.getMemory();
            const updatedMemory = memory.filter(c => c.id !== id);
            
            localMemoryCache = updatedMemory;
            localStorage.setItem(MEMORY_KEY, JSON.stringify(updatedMemory));

            if (!isSyncing) {
                isSyncing = true;
                fetch('/api/ai-memory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedMemory)
                }).finally(() => isSyncing = false);
            }
            console.log(`[AI Memory] Caso eliminado: ${id}`);
        } catch (e) {
            console.error("Error deleting from AI Memory:", e);
        }
    },

    /**
     * Actualiza un caso existente de la memoria local y lo sincroniza con el servidor.
     */
    updateCase: async (updated: AiCase) => {
        try {
            const memory = AiMemoryService.getMemory();
            const updatedMemory = memory.map(c => c.id === updated.id ? updated : c);

            localMemoryCache = updatedMemory;
            localStorage.setItem(MEMORY_KEY, JSON.stringify(updatedMemory));

            if (!isSyncing) {
                isSyncing = true;
                fetch('/api/ai-memory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedMemory)
                }).finally(() => isSyncing = false);
            }
            console.log(`[AI Memory] Caso actualizado: ${updated.id}`);
        } catch (e) {
            console.error("Error updating AI Memory case:", e);
        }
    },

    /**
     * Busca y formatea el contexto histórico relevante basado en una consulta y pozo.
     */
    findRelevantContext: (query: string, wellName?: string): string => {
        const memory = AiMemoryService.getMemory();
        let relevant: AiCase[] = [];

        // 1. Filtrar por pozo específico si se provee
        if (wellName) {
            const wellCases = memory.filter(c => c.wellName && c.wellName.toUpperCase() === wellName.toUpperCase());
            relevant.push(...wellCases);
        }

        // 2. Filtrar por coincidencia de texto en la consulta (búsqueda simple de palabras clave)
        const qNormalized = query.toLowerCase();
        const keywords = qNormalized.split(/\s+/).filter(w => w.length > 3);
        
        if (keywords.length > 0) {
            const keywordMatches = memory.filter(c => {
                // Evitar duplicar si ya se agregó por pozo
                if (relevant.some(r => r.id === c.id)) return false;
                
                const rec = c.recommendation.toLowerCase();
                const wn = (c.wellName || '').toLowerCase();
                const cat = c.category.toLowerCase();
                
                return keywords.some(k => rec.includes(k) || wn.includes(k) || cat.includes(k));
            });
            relevant.push(...keywordMatches);
        }

        // Limitar a máximo 3 casos más relevantes
        const finalCases = relevant.slice(0, 3);
        if (finalCases.length === 0) return "";

        return finalCases.map(c => {
            return `### CASO HISTÓRICO DE MEMORIA: Pozo ${c.wellName || 'General'} (${c.category.toUpperCase()})
- Firma Técnica: ${c.technicalSignature}
- Recomendación Histórica:
${c.recommendation}
---`;
        }).join('\n\n');
    },

    /**
     * Busca un caso similar basado en una firma técnica.
     * Esto es lo que permite el funcionamiento "Offline".
     */
    findSimilarCase: (signature: string): AiCase | null => {
        const memory = AiMemoryService.getMemory();
        // Buscamos una coincidencia exacta o muy cercana (esto podría mejorarse con lógica difusa)
        return memory.find(c => c.technicalSignature === signature) || null;
    },

    /**
     * Genera una firma técnica única para un escenario.
     */
    generateSignature: (params: any): string => {
        // Creamos un string con variables críticas (Caudal, PIP, Frecuencia, Bomba)
        // Si estos varían poco, se considera el "mismo caso"
        const q = Math.round((params.rate || params.totalRate || 0) / 10) * 10;
        const pip = Math.round((params.pip || 0) / 20) * 20;
        const f = params.frequency || 60;
        const pump = params.pumpModel || params.model || 'unknown';
        
        return `${pump}|Q:${q}|PIP:${pip}|F:${f}`;
    },

    /**
     * Exporta la memoria a un archivo descargable.
     */
    exportMemory: () => {
        const memory = AiMemoryService.getMemory();
        const blob = new Blob([JSON.stringify(memory, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MEMORIA_IA_ESP_STUDIO_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    },

    /**
     * Consolida y compacta los 25 registros de diagnóstico más antiguos en un único
     * resumen estructurado para ahorrar espacio en disco/localStorage.
     */
    consolidateMemory: async () => {
        if (isConsolidating) return;
        isConsolidating = true;
        console.log("[AI Memory] Iniciando compactación y consolidación de registros antiguos...");
        try {
            const memory = AiMemoryService.getMemory();
            const detailedCases = memory.filter(c => c.category !== 'summary');
            
            // Requerimos al menos 40 casos detallados para consolidar
            if (detailedCases.length < 40) {
                isConsolidating = false;
                return;
            }

            // Tomamos los 25 casos más antiguos de los casos detallados
            // Los más antiguos están al final del array
            const casesToConsolidate = detailedCases.slice(-25);
            
            const casesText = casesToConsolidate.map((c, idx) => {
                return `--- CASO ${idx + 1} ---
Fecha: ${c.timestamp}
Pozo: ${c.wellName || 'General'}
Firma Técnica: ${c.technicalSignature}
Categoría: ${c.category}
Recomendación de la IA:
${c.recommendation}`;
            }).join('\n\n');

            const apiKey = localStorage.getItem('openrouter_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey && apiKey !== 'null' && apiKey !== 'undefined') {
                headers.Authorization = `Bearer ${apiKey}`;
            }

            const sysInstruction = 
                "Eres el motor de compactación y consolidación de memoria técnica de ESP Design Studio. " +
                "Recibirás una lista de diagnósticos técnicos de pozos petroleros con sistema de levantamiento ESP. " +
                "Tu objetivo es consolidar y resumir TODOS estos casos en un único informe Markdown compacto y de alta densidad de información. " +
                "Agrupa los hallazgos por pozo. Para cada pozo, crea un resumen técnico estructurado que describa: " +
                "1) Los problemas o fallas comunes detectados en el historial (ej. baja eficiencia, downthrust, upthrust, falta de corriente). " +
                "2) Frecuencias operacionales promedio e impacto observado en caudal (BFPD) e hidráulica (PIP/PDP/Pwf). " +
                "3) Las recomendaciones técnicas recurrentes sugeridas. " +
                "Sé sumamente conciso, puramente técnico y directo. Utiliza listas de viñetas y tablas compactas si ayuda a reducir espacio. " +
                "Evita saludos, introducciones o explicaciones sobre tu rol. Comienza directamente con el informe Markdown.";

            const userPrompt = 
                "Por favor, consolida y compacta los siguientes 25 diagnósticos históricos en un resumen técnico de alta densidad:\n\n" + 
                casesText;

            const response = await fetch("/api/copilot/stream", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    systemInstruction: sysInstruction,
                    messages: [
                        { role: 'user', content: userPrompt }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Error en el proxy de OpenRouter: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No se pudo obtener el stream reader.");
            }

            const decoder = new TextDecoder();
            let done = false;
            let finalSummaryText = '';

            while (!done) {
                const { value, done: isDone } = await reader.read();
                done = isDone;
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
                finalSummaryText += chunk;
            }

            if (!finalSummaryText.trim()) {
                throw new Error("El resumen consolidado retornado está vacío.");
            }

            // Creamos el nuevo caso consolidado
            const summaryCase: AiCase = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                category: 'summary',
                wellName: 'CONSOLIDADO',
                technicalSignature: `summary|date:${new Date().toISOString().split('T')[0]}|count:${casesToConsolidate.length}`,
                context: { 
                    consolidatedCaseIds: casesToConsolidate.map(c => c.id),
                    range: {
                        start: casesToConsolidate[0]?.timestamp,
                        end: casesToConsolidate[casesToConsolidate.length - 1]?.timestamp
                    }
                },
                recommendation: finalSummaryText
            };

            // Removemos los casos consolidados del historial
            const consolidatedIds = new Set(casesToConsolidate.map(c => c.id));
            const prunedMemory = memory.filter(c => !consolidatedIds.has(c.id));

            // Insertamos el caso resumen al inicio de la memoria
            const newMemory = [summaryCase, ...prunedMemory];

            // Guardamos localmente
            localMemoryCache = newMemory;
            localStorage.setItem(MEMORY_KEY, JSON.stringify(newMemory));

            // Sincronizamos con el servidor
            await fetch('/api/ai-memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMemory)
            });

            console.log(`%c[AI Memory] ¡CONSOLIDACIÓN COMPLETADA EXITOSAMENTE! Se resumieron ${casesToConsolidate.length} casos.`, "color: #10b981; font-weight: bold;");
        } catch (err) {
            console.error("[AI Memory] Falló la consolidación de memoria:", err);
            
            // Fallback de seguridad extrema: si la memoria excede 4.5 MB en JSON string (cerca del límite de localStorage)
            // y la consolidación por IA está fallando (ej. sin internet), hacemos un recorte físico (pruning) de los 25 casos más antiguos
            // para evitar que la aplicación falle al intentar guardar en LocalStorage
            try {
                const currentMemory = AiMemoryService.getMemory();
                const memString = JSON.stringify(currentMemory);
                if (memString.length > 4.5 * 1024 * 1024) {
                    console.warn("[AI Memory] Memoria excede 4.5MB y falló la consolidación por IA. Aplicando recorte duro de seguridad.");
                    const pruned = currentMemory.slice(0, 100); // Forzar a dejar solo los 100 más recientes
                    localMemoryCache = pruned;
                    localStorage.setItem(MEMORY_KEY, JSON.stringify(pruned));
                    fetch('/api/ai-memory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(pruned)
                    });
                }
            } catch (e) {
                console.error("[AI Memory] Falló el fallback de recorte duro:", e);
            }
        } finally {
            isConsolidating = false;
        }
    }
};
