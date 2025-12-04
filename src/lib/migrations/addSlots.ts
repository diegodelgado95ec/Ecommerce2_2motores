// src/lib/migrations/addSlots.ts
/**
 * Migración para asignar slots automáticamente a productos existentes
 * Ejecutar una sola vez después de actualizar el schema
 */

import { db } from '../db';
import { logger } from '../../services/LoggerService';

export async function migrateProductsToSlots(): Promise<void> {
  try {
    logger.info('Iniciando migración de slots para productos existentes');
    
    const products = await db.getAll('products');
    let assignedCount = 0;
    let slot Position = 1;

    for (const product of products) {
      // Solo migrar productos que no tienen slot asignado
      if (!product.slotPosition) {
        const updatedProduct = {
          ...product,
          slotPosition: slotPosition++,
          bandDistance: 50, // Valor por defecto: 50cm
          isSlotActive: true,
          lastCalibration: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await db.put('products', updatedProduct);
        assignedCount++;

        logger.info('Slot asignado automáticamente', {
          productId: product.id,
          productName: product.title,
          slotPosition: updatedProduct.slotPosition
        });
      }
    }

    logger.info('Migración completada', {
      totalProducts: products.length,
      slotsAsignados: assignedCount
    });

    console.log(`✅ Migración completada: ${assignedCount} productos asignados a slots`);
  } catch (error) {
    logger.error('Error en migración de slots', { error });
    console.error('❌ Error en migración:', error);
    throw error;
  }
}

// Función para ejecutar desde la consola del navegador
if (typeof window !== 'undefined') {
  (window as any).migrateProductsToSlots = migrateProductsToSlots;
}
