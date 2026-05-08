
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
    category: 'diagnosis' | 'design' | 'optimization' | 'alarm';
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

export const AiMemoryService = {
    /**
     * Inicializa la memoria cargando datos desde el servidor.
     */
    init: async () => {
        try {
            const resp = await fetch('/api/ai-memory');
            if (resp.ok) {
                const data = await resp.json();
                localMemoryCache = data;
                localStorage.setItem(MEMORY_KEY, JSON.stringify(data));
                console.log("[AI Memory] Sincronizado con el servidor exitosamente.");
            }
        } catch (e) {
            console.warn("[AI Memory] No se pudo conectar al servidor, usando caché local.");
            const local = localStorage.getItem(MEMORY_KEY);
            if (local) localMemoryCache = JSON.parse(local);
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

            const updatedMemory = [newCase, ...memory].slice(0, 500); // Aumentamos capacidad a 500
            
            // 1. Actualizar Cache y LocalStorage (Instantáneo)
            localMemoryCache = updatedMemory;
            localStorage.setItem(MEMORY_KEY, JSON.stringify(updatedMemory));

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
    }
};
