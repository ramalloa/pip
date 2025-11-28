import { hcdnDirectScraper } from './server/hcdn-direct-scraper';

(async () => {
  try {
    console.log('🚀 EXTRAYENDO TODOS LOS EXPEDIENTES FALTANTES 3730-6514\n');

    // Escanear desde el último expediente de la API (3729) hasta el más reciente conocido (6514)
    const startNum = 3730;
    const endNum = 6520; // Un poco más para asegurar que obtenemos todo
    
    const expedientesNuevos = await hcdnDirectScraper.scrapeRange(startNum, endNum, '2025');
    
    console.log(`\n✅ Extracción completada`);
    console.log(`   📋 Expedientes nuevos encontrados: ${expedientesNuevos.length}`);
    
    if (expedientesNuevos.length > 0) {
      console.log('\n=== Combinando con datos existentes ===\n');
      const todosCombinados = await hcdnDirectScraper.mergeWithExisting(expedientesNuevos);
      await hcdnDirectScraper.saveToFile(todosCombinados);
      
      console.log(`✅ Total expedientes en base de datos: ${todosCombinados.length}`);
      
      // Mostrar rango
      const numeros = todosCombinados
        .filter(exp => exp.expediente.includes('-D-2025'))
        .map(exp => parseInt(exp.expediente.match(/(\d+)-/)?.[1] || '0'));
      
      console.log(`   Rango: ${Math.min(...numeros)}-D-2025 hasta ${Math.max(...numeros)}-D-2025\n`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
