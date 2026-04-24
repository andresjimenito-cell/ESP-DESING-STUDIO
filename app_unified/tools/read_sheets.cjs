const xlsx = require('xlsx'); 
const wb = xlsx.readFile('public/DATAS DE DISEÑO.xlsx');
console.log(wb.SheetNames);
