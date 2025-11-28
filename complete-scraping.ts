import { hcdnDirectScraper } from './server/hcdn-direct-scraper';
import fs from 'fs/promises';

(async () => {
  try {
    console.log('🚀 COMPLETANDO EXTRACCIÓN DE EXPEDIENTES FALTANTES\n');

    // Verificar qué tenemos actualmente
    const existing = await hcdnDirectScraper.loadFromFile();
    const numeros = existing
      .filter(exp => exp.expediente.includes('-D-2025'))
      .map(exp => parseInt(exp.expediente.match(/(\d+)-/)?.[1] || '0'));
    
    const maxActual = Math.max(...numeros);
    console.log(`📊 Estado actual: ${existing.length} expedientes (hasta ${maxActual}-D-2025)\n`);

    // Escanear desde el máximo actual + 1 hasta 6520 en chunks de 200
    const startNum = maxActual + 1;
    const endNum = 6520;
    const chunkSize = 200;
    
    let allNewExpedientes = [];
    
    for (let i = startNum; i <= endNum; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize - 1, endNum);
      console.log(`\n📥 Escaneando chunk ${i}-${chunkEnd}...`);
      
      try {
        const chunkExpedientes = await hcdnDirectScraper.scrapeRange(i, chunkEnd, '2025');
        allNewExpedientes.push(...chunkExpedientes);
        console.log(`✅ Chunk completado: ${chunkExpedientes.length} expedientes encontrados`);
        
        // Guardar progreso después de cada chunk
        if (chunkExpedientes.length > 0) {
          const combined = await hcdnDirectScraper.mergeWithExisting(allNewExpedientes);
          await hcdnDirectScraper.saveToFile(combined);
          console.log(`💾 Progreso guardado: ${combined.length} expedientes totales`);
        }
        
      } catch (error: any) {
        console.error(`❌ Error en chunk ${i}-${chunkEnd}:`, error.message);
      }
      
      // Pausa entre chunks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n✅ EXTRACCIÓN COMPLETADA`);
    console.log(`   📋 Nuevos expedientes agregados: ${allNewExpedientes.length}`);
    
    const final = await hcdnDirectScraper.loadFromFile();
    const finalNumeros = final
      .filter(exp => exp.expediente.includes('-D-2025'))
      .map(exp => parseInt(exp.expediente.match(/(\d+)-/)?.[1] || '0'));
    
    console.log(`   📊 Total final: ${final.length} expedientes`);
    console.log(`   📈 Rango: ${Math.min(...finalNumeros)}-D-2025 hasta ${Math.max(...finalNumeros)}-D-2025\n`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
