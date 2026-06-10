const XLSX = require('xlsx');

async function checkFile(file) {
    const url = `https://espdesing.vercel.app/api/onedrive-fetch?file=${file}&format=json`;
    console.log(`\n==========================================`);
    console.log(`Checking live endpoint for file: ${file} (JSON)`);
    console.log(`URL: ${url}`);
    console.log(`==========================================`);
    const start = Date.now();
    try {
        const res = await fetch(url);
        const duration = Date.now() - start;
        console.log(`Request completed in ${duration}ms.`);
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

        const data = await res.json();
        if (file === 'designs') {
            console.log(`Designs Data structure keys:`, Object.keys(data));
            console.log(`Designs rows count:`, data.data?.length);
            console.log(`Survey rows count:`, data.survey?.length);
            console.log(`Mech rows count:`, data.mech?.length);
        } else {
            console.log(`SCADA rows count:`, data?.length);
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

