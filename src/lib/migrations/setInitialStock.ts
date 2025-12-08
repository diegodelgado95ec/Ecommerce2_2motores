// src/lib/migrations/setInitialStock.ts

import { db } from '../db';

/**
 * Migración: Establecer initialStock en productos existentes
 * 
 * Esta migración se ejecuta UNA VEZ para:
 * - Establecer initialStock = stock actual (si no existe)
 * - Inicializar sales en 0 (si no existe)
 * 
 * Después de esta migración:
 * - initialStock permanece fijo (capacidad máxima del slot)
 * - stock cambia con ventas y reabastecimientos
 * - sales se resetea a 0 en cada reabastecimiento
 */
export async function migrateInitialStock(): Promise<void> {
  const migrationKey = 'migration_initialStock_v1';
  
  // Verificar si ya se ejecutó esta migración
  const migrationCompleted = localStorage.getItem(migrationKey);
  if (migrationCompleted === 'true') {
    console.log('✓ Migración de initialStock ya completada');
    return;
  }

  console.log('🔄 Iniciando migración de initialStock...');
  
  try {
    const products = await db.getAll('products');
    let updatedCount = 0;

    for (const product of products) {
      let needsUpdate = false;
      const updates: any = { ...product };

      // Establecer initialStock si no existe
      if (product.initialStock === undefined || product.initialStock === null) {
        updates.initialStock = product.stock;
        needsUpdate = true;
        console.log(`  • ${product.title}: initialStock establecido en ${product.stock}`);
      }

      // Inicializar sales si no existe
      if (product.sales === undefined || product.sales === null) {
        updates.sales = 0;
        needsUpdate = true;
        console.log(`  • ${product.title}: sales inicializado en 0`);
      }

      if (needsUpdate) {
        updates.updatedAt = new Date().toISOString();
        await db.put('products', updates);
        updatedCount++;
      }
    }

    console.log(`✓ Migración completada: ${updatedCount} productos actualizados`);
    
    // Marcar migración como completada
    localStorage.setItem(migrationKey, 'true');
  } catch (error) {
    console.error('❌ Error en migración de initialStock:', error);
    throw error;
  }
}

/**
 * Forzar re-ejecución de la migración (para testing)
 */
export function resetInitialStockMigration(): void {
  localStorage.removeItem('migration_initialStock_v1');
  console.log('✓ Migración de initialStock reseteada - se ejecutará nuevamente');
}

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).migrateInitialStock = migrateInitialStock;
  (window as any).resetInitialStockMigration = resetInitialStockMigration;
  console.log('🔧 Migraciones disponibles en window.migrateInitialStock() y window.resetInitialStockMigration()');
}
