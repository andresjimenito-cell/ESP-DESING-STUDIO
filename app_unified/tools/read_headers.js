const xlsx = require('xlsx'); 
const wb = xlsx.readFile('public/DATAS DE DISEÑO.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]]; // Or find 'DATA'
const data = xlsx.utils.sheet_to_json(sheet, {header: 1});
let hdrIdx = 0;
for (let i = 0; i < Math.min(data.length, 15); i++) {
    const r = (data[i] || []).join('|').toUpperCase();
    if (r.includes('POZO')) { hdrIdx = i; break; }
}
console.log("HEADERS:", data[hdrIdx]);
