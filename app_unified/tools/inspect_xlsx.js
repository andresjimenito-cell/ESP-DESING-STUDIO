import pkg from 'xlsx';
const { readFile, utils } = pkg;
import path from 'node:path';

const filePath = path.join(process.cwd(), 'public', 'PUMPS (1).xlsx');
const workbook = readFile(filePath);
const pumpSheet = workbook.Sheets['PUMP'];
const json = utils.sheet_to_json(pumpSheet, { header: 1 });

const flex = json.find(r => r && String(r[2]).includes('FLEX47'));
if (flex) {
    console.log("FLEX47 Data:");
    flex.forEach((val, i) => console.log(`Col ${i}: ${val}`));
}
