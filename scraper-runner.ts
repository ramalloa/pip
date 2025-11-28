import { hcdnApiScraper } from './server/hcdn-api-scraper';

(async () => {
  try {
    console.log('🚀 Iniciando extracción de expedientes desde API HCDN...\n');
    const expedientes = await hcdnApiScraper.scrapeAll2025();
    
    console.log('\n✅ SCRAPING COMPLETADO');
    console.log('Total expedientes:', expedientes.length);
    
    // Mostrar los primeros 15 expedientes
    console.log('\n📋 Primeros 15 expedientes:');
    expedientes.slice(0, 15).forEach((exp, idx) => {
      console.log(`  ${idx + 1}. ${exp.expediente}`);
    });
    
    // Buscar los expedientes específicos que el usuario mencionó
    const buscados = ['6514-D-2025', '6436-D-2025', '6416-D-2025', '6414-D-2025', '6395-D-2025', '6390-D-2025', '6342-D-2025'];
    console.log('\n🔍 Expedientes del listado proporcionado:');
    buscados.forEach(num => {
      const existe = expedientes.find(exp => exp.expediente === num);
      console.log(`  ${num}: ${existe ? '✓ EXISTE' : '✗ NO EXISTE'}`);
    });
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
