const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./app_unified/public/designs_precalc.json', 'utf8'));
console.log('Keys in JSON:', Object.keys(data));
console.log('Sample entry in data:', data.data ? data.data[0] : 'N/A');
console.log('Mech length:', data.mech ? data.mech.length : 'N/A');
if (data.mech && data.mech.length > 0) {
    console.log('Sample mech entry:', data.mech[0]);
}
