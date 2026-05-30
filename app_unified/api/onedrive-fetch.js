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

export const config = {
    maxDuration: 60,
};

const TENANT = 'consumers'; // Cuentas Microsoft personales
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

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
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Cabeceras CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

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

        // 3. Retornar el archivo al frontend
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
