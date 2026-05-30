/**
 * SCRIPT DE CONFIGURACIÓN INICIAL - Ejecutar UNA SOLA VEZ localmente
 * 
 * PASOS PREVIOS:
 * 1. Ve a https://portal.azure.com
 * 2. Busca "App registrations" → "New registration"
 * 3. Nombre: "ESP Design Studio"
 * 4. Supported account types: "Personal Microsoft accounts only"
 * 5. Redirect URI: Web → https://localhost
 * 6. Register → copia el "Application (client) ID"
 * 7. Certificates & secrets → New client secret → copia el valor
 * 8. API permissions → Add → Microsoft Graph → Delegated → Files.Read + offline_access
 * 9. Grant admin consent
 * 
 * Luego ejecuta: node scripts/onedrive-setup-auth.js
 */

const http = require('http');
const { URL } = require('url');
const readline = require('readline');

const CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3456';
const SCOPES = 'Files.Read offline_access';
const TENANT = 'consumers'; // Para cuentas Microsoft personales

async function main() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('\n❌ Debes proveer las variables de entorno:\n');
        console.error('  $env:ONEDRIVE_CLIENT_ID="tu-client-id"');
        console.error('  $env:ONEDRIVE_CLIENT_SECRET="tu-client-secret"\n');
        console.error('Luego vuelve a ejecutar: node scripts/onedrive-setup-auth.js\n');
        process.exit(1);
    }

    // 1. Construir URL de autorización
    const authUrl = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?` +
        `client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&response_mode=query`;

    console.log('\n🔐 ESP Design Studio - Configuración de OneDrive\n');
    console.log('Abre este enlace en tu navegador y acepta los permisos:');
    console.log('\n' + authUrl + '\n');

    // 2. Levantar servidor local para capturar el código de autorización
    const code = await new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, REDIRECT_URI);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

            if (error) {
                res.end(`<h2>❌ Error: ${error}</h2><p>${url.searchParams.get('error_description')}</p>`);
                server.close();
                reject(new Error(error));
                return;
            }

            if (code) {
                res.end(`
                    <h2>✅ ¡Autorización exitosa!</h2>
                    <p>Cierra esta ventana y vuelve a la terminal.</p>
                    <script>setTimeout(() => window.close(), 2000);</script>
                `);
                server.close();
                resolve(code);
            } else {
                res.end('<h2>Esperando código...</h2>');
            }
        });

        server.listen(3456, () => {
            console.log('Esperando tu autorización en el navegador...');
        });

        server.on('error', reject);
        setTimeout(() => { server.close(); reject(new Error('Timeout de 5 minutos')); }, 5 * 60 * 1000);
    });

    console.log('\n✅ Código recibido. Obteniendo tokens...\n');

    // 3. Intercambiar código por access_token + refresh_token
    const tokenRes = await fetch(
        `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                scope: SCOPES,
            }).toString(),
        }
    );

    const tokens = await tokenRes.json();

    if (tokens.error) {
        console.error('❌ Error obteniendo tokens:', tokens.error_description);
        process.exit(1);
    }

    // 4. Obtener los File IDs de los archivos de OneDrive
    console.log('Obteniendo información de tu OneDrive...\n');

    const driveRes = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const driveData = await driveRes.json();

    // 5. Buscar los archivos por nombre (intenta encontrar los Excel de la app)
    const searchRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/search(q='DATAS')`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const searchData = await searchRes.json();

    console.log('📁 Archivos encontrados en OneDrive que coinciden con "DATAS":');
    if (searchData.value && searchData.value.length > 0) {
        searchData.value.forEach((item, i) => {
            if (item.name.endsWith('.xlsx') || item.name.endsWith('.xls')) {
                console.log(`  ${i + 1}. "${item.name}"`);
                console.log(`     ID: ${item.id}`);
                console.log(`     Ruta: ${item.parentReference?.path || 'raíz'}`);
                console.log();
            }
        });
    } else {
        console.log('  No se encontraron archivos. Buscaremos por SharePoint links.\n');
    }

    // 6. Mostrar las variables de entorno que hay que configurar en Vercel
    console.log('\n' + '='.repeat(60));
    console.log('✅ COPIA ESTAS VARIABLES EN VERCEL (Settings → Environment Variables)');
    console.log('='.repeat(60));
    console.log(`\nONEDRIVE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`ONEDRIVE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`ONEDRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n(Para los ONEDRIVE_FILE_ID_*, ve los IDs listados arriba)');
    console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
