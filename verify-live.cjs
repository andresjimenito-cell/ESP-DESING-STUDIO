const XLSX = require('xlsx');

async function checkFile(file) {
    const url = `https://espdesing.vercel.app/api/onedrive-fetch?file=${file}`;
    console.log(`\n==========================================`);
    console.log(`Checking live endpoint for file: ${file}`);
    console.log(`URL: ${url}`);
    console.log(`==========================================`);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`HTTP Error: ${res.status}`);
            try {
                const json = await res.json();
                console.error('Response details:', json);
            } catch (e) {
                const txt = await res.text();
                console.error('Response body:', txt.substring(0, 500));
            }
            return;
        }

        const buf = await res.arrayBuffer();
        console.log(`Downloaded ${buf.byteLength} bytes.`);
        
        const workbook = XLSX.read(new Uint8Array(buf), { type: 'array' });
        console.log('Workbook Sheet Names:', workbook.SheetNames);
        
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        console.log(`First sheet "${firstSheetName}" has ${rows.length} rows.`);
        if (rows.length > 0) {
            console.log('First row columns/keys:', Object.keys(rows[0]));
        }
    } catch (e) {
        console.error('Error during fetch/parse:', e);
    }
}

async function run() {
    await checkFile('designs');
    await checkFile('scada');
}

run();

