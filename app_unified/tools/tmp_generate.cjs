const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/Descargas/esp designe ultima version andres/app_unified/xlsx_preview.json', 'utf-8'));

let out = `import { EspPump, EspMotor } from './types';\n\n`;
out += `export const EXCEL_PUMPS: EspPump[] = [\n`;
const pumps = data.PUMP.slice(2);

for (const p of pumps) {
    if (!p['Required Pump data']) continue;
    try {
        const id = `${String(p['Required Pump data']).toLowerCase().substring(0,4).replace(/[^a-z]/g,'')}-${String(p['__EMPTY_1']).toLowerCase().replace(/[^a-z0-9]/g,'')}`;
        out += `  {
    id: '${id}',
    manufacturer: '${String(p['Required Pump data'] || '')}',
    series: '${String(p['__EMPTY'] || '')}',
    model: '${String(p['__EMPTY_1'] || '')}',
    minRate: ${parseFloat(p['__EMPTY_2']) || 0},
    bepRate: ${parseFloat(p['__EMPTY_3']) || 0},
    maxRate: ${parseFloat(p['__EMPTY_4']) || 0},
    maxEfficiency: ${parseFloat(p['__EMPTY_5']) || 0},
    maxHead: ${parseFloat(p['__EMPTY_6']) || 0},
    maxGraphRate: ${parseFloat(p['__EMPTY_7']) || 0},
    nameplateFrequency: ${parseFloat(p['__EMPTY_8']) || 60},
    h0: ${parseFloat(p['Head Coefficients\\r\\nReda & Alnas equipments require coefficients for 100 stages. All others require coefficient for 1 stage']) || 0},
    h1: ${parseFloat(p['__EMPTY_9']) || 0},
    h2: ${parseFloat(p['__EMPTY_10']) || 0},
    h3: ${parseFloat(p['__EMPTY_11']) || 0},
    h4: ${parseFloat(p['__EMPTY_12']) || 0},
    h5: ${parseFloat(p['__EMPTY_13']) || 0},
    h6: 0,
    p0: ${parseFloat(p['Brake HorsePower Coefficients\\r\\nReda & Alnas equipments require coefficients for 100 stages. All others require coefficient for 1 stage']) || 0},
    p1: ${parseFloat(p['__EMPTY_14']) || 0},
    p2: ${parseFloat(p['__EMPTY_15']) || 0},
    p3: ${parseFloat(p['__EMPTY_16']) || 0},
    p4: ${parseFloat(p['__EMPTY_17']) || 0},
    p5: ${parseFloat(p['__EMPTY_18']) || 0},
    p6: 0,
    stages: 1,
    minStages: ${parseFloat(p['Stages']) || 1},
    maxStages: ${parseFloat(p['__EMPTY_23']) || 400},
    stageIncrease: ${parseFloat(p['__EMPTY_24']) || 1}
  },\n`;
    } catch(e) {}
}
out += `];\n\n`;

out += `export const EXCEL_MOTORS: EspMotor[] = [\n`;
const motors = data.MOTORS.slice(2);
for (const m of motors) {
    if (!m['Required Motor data']) continue;
    try {
        const mf = String(m['Required Motor data']);
        const id = `${mf.toLowerCase().substring(0,4).replace(/[^a-z]/g,'')}-${String(m['__EMPTY'] || '').replace(/[^a-zA-Z0-9]/g,'')}-${String(m['__EMPTY_2'] || '').replace(/[^0-9]/g,'')}-${String(m['__EMPTY_3'] || '').replace(/[^0-9]/g,'')}`;
        out += `  {
    id: '${id}',
    manufacturer: '${mf.replace(/'/g, "\\'")}',
    series: '${String(m['__EMPTY'] || '').replace(/'/g, "\\'")}',
    model: '${String(m['__EMPTY_1'] || '').replace(/'/g, "\\'")}',
    hp: ${parseFloat(m['__EMPTY_2']) || 0},
    voltage: ${parseFloat(m['__EMPTY_3']) || 0},
    amps: ${parseFloat(m['__EMPTY_4']) || 0},
    // nameplateFrequency: 60, Note Excel doesn't always specify motor Hz, assume 60 standard
    r0: ${parseFloat(m['Slip %']) || 0}, r1: ${parseFloat(m['__EMPTY_13']) || 0}, r2: ${parseFloat(m['__EMPTY_14']) || 0}, r3: ${parseFloat(m['__EMPTY_15']) || 0}, r4: ${parseFloat(m['__EMPTY_16']) || 0}, r5: ${parseFloat(m['__EMPTY_17']) || 0},
    a0: ${parseFloat(m['AMPS %\\r\\nAll others expect SLB, Baker, Centrilift, Alnas and Alkhorayef  require coefficient for AMPs % at Np']) || 0}, a1: ${parseFloat(m['__EMPTY_21']) || 0}, a2: ${parseFloat(m['__EMPTY_22']) || 0}, a3: ${parseFloat(m['__EMPTY_23']) || 0}, a4: ${parseFloat(m['__EMPTY_24']) || 0}, a5: ${parseFloat(m['__EMPTY_25']) || 0},
    p0: ${parseFloat(m['PF\\r\\nAll others expect SLB, Baker, Centrilift, Alnas and Alkhorayef  require coefficient for PF at Np']) || 0}, p1: ${parseFloat(m['__EMPTY_29']) || 0}, p2: ${parseFloat(m['__EMPTY_30']) || 0}, p3: ${parseFloat(m['__EMPTY_31']) || 0}, p4: ${parseFloat(m['__EMPTY_32']) || 0}, p5: ${parseFloat(m['__EMPTY_33']) || 0},
    e0: ${parseFloat(m['Efficiency\\r\\nAll others expect SLB, Baker, Centrilift, Alnas and Alkhorayef require coefficient for EFF on Np']) || 0}, e1: ${parseFloat(m['__EMPTY_37']) || 0}, e2: ${parseFloat(m['__EMPTY_38']) || 0}, e3: ${parseFloat(m['__EMPTY_39']) || 0}, e4: ${parseFloat(m['__EMPTY_40']) || 0}, e5: ${parseFloat(m['__EMPTY_41']) || 0}
  },\n`;
    } catch(e) {}
}
out += `];\n`;

fs.writeFileSync('d:/Descargas/esp designe ultima version andres/app_unified/catalog.ts', out);
console.log('Saved catalog.ts!');
