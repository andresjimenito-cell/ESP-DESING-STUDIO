/**
 * API ROUTE: /api/onedrive-fetch
 * 
 * Proxy seguro para descargar archivos Excel desde OneDrive.
 * Resuelve el problema de CORS del navegador haciendo la petición
 * desde el servidor (sin restricciones CORS).
 * 
 * GET /api/onedrive-fetch?url=<onedrive_share_url>
 */

export const config = {
    maxDuration: 60, // 60 segundos máximo (plan Pro) o 10s (Hobby)
};

export default async function handler(req, res) {
    // Solo GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Parámetro "url" requerido.' });
    }

    // Cabeceras CORS para el frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    try {
        // Convertir la URL compartida de OneDrive a formato base64 compatible con la API de Microsoft
        const base64Url = Buffer.from(url).toString('base64')
            .replace(/=/g, '')
            .replace(/\//g, '_')
            .replace(/\+/g, '-');
        
        const directUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Url}/root/content`;

        // ── FASE 2: Descargar el archivo Excel ──────────────────────────────────
        const fileRes = await fetch(directUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!fileRes.ok) {
            throw new Error(`La descarga del archivo falló con estado HTTP ${fileRes.status}.`);
        }

        const buffer = await fileRes.arrayBuffer();
        const contentType =
            fileRes.headers.get('content-type') ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        // ── FASE 3: Retornar el archivo al frontend ──────────────────────────────
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.byteLength);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(Buffer.from(buffer));

    } catch (error) {
        console.error('[OneDrive Fetch Error]', error.message);
        res.status(500).json({
            error: 'Error al descargar el archivo desde OneDrive.',
            detail: error.message,
        });
    }
}
