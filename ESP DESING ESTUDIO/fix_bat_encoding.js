const fs = require('fs');
const path = require('path');

const filesToFix = [
    path.join(__dirname, '..', 'INICIAR_ESP_STUDIO.bat'),
    path.join(__dirname, '..', 'ACTUALIZAR_ESP_STUDIO.bat')
];

filesToFix.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`Archivo no existe: ${filePath}`);
        return;
    }
    
    // Leer como buffer
    let buffer = fs.readFileSync(filePath);
    
    // Detectar y quitar BOM UTF-8 (EF BB BF)
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        console.log(`BOM detectado y removido de: ${filePath}`);
        buffer = buffer.subarray(3);
    }
    
    let content = buffer.toString('utf8');
    
    // Reemplazar saltos de linea LF a CRLF de forma segura
    content = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    
    // Escribir de vuelta con codificacion ascii (ANSI 7-bit)
    fs.writeFileSync(filePath, content, { encoding: 'ascii' });
    console.log(`Archivo corregido (CRLF y ASCII): ${filePath}`);
});
