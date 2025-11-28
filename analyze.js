const fs = require('fs');
const data = JSON.parse(fs.readFileSync('client/src/data/db_expedientes.json', 'utf-8'));
const expedientes2025 = data.filter(exp => exp.expediente.includes('-D-2025'));
const numeros = expedientes2025.map(exp => parseInt(exp.expediente.match(/(\d+)-/)?.[1] || '0')).sort((a, b) => a - b);
console.log('Total:', expedientes2025.length, '| Rango:', Math.min(...numeros), '-', Math.max(...numeros));
const buscados = [6514, 6436, 6416, 6414, 6395];
buscados.forEach(num => console.log(num + '-D-2025:', numeros.includes(num) ? 'OK' : 'FALTA'));
