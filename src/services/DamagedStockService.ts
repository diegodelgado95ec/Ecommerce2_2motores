// src/services/DamagedStockService.ts
import { db } from '../lib/db';
import logger from '../lib/logger';
import type { DBSchema } from '../lib/db';

type Product = DBSchema['products'];

/**
 * Servicio para registrar stock dañado/perdido
 */
export class DamagedStockService {
  /**
   * Registra stock dañado para un producto
   */
  async registerDamagedStock(
    productId: number,
    quantity: number,
    reason: string,
    userId: string = 'admin'
  ): Promise<void> {
    try {
      // Obtener producto
      const product = await db.get('products', productId);
      if (!product) {
        throw new Error(`Producto ID ${productId} no encontrado`);
      }

      // Validar cantidad
      if (quantity <= 0) {
        throw new Error('La cantidad debe ser mayor a 0');
      }

      if (product.stock < quantity) {
        throw new Error(`Stock insuficiente. Disponible: ${product.stock}, Solicitado: ${quantity}`);
      }

      const stockAntes = product.stock;
      const newStock = product.stock - quantity;

      // Actualizar stock del producto
      await db.put('products', {
        ...product,
        stock: newStock,
        updatedAt: new Date().toISOString()
      } as any);

      // Registrar en stockMovements con nota de 'dañado'
      await db.add('stockMovements', {
        productId,
        quantity: -quantity,
        type: 'out',
        note: `Stock dañado: ${reason}`,
        createdAt: new Date().toISOString()
      } as any);

      // Registrar en stockAdjustments para tracking detallado
      await db.add('stockAdjustments', {
        productId,
        adjustmentType: 'manual',
        quantityBefore: stockAntes,
        quantityAfter: newStock,
        difference: -quantity,
        note: `Stock dañado: ${reason}`,
        userId,
        timestamp: new Date().toISOString()
      } as any);

      logger.log(
        `[DamagedStock] ✓ Registrado stock dañado: ${product.title} (-${quantity})`
      );
    } catch (error) {
      logger.error('[DamagedStock] ❌ Error:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de stock dañado
   */
  async getDamagedStockHistory(
    productId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: number;
    productId: number;
    productName: string;
    quantity: number;
    reason: string;
    userId: string;
    timestamp: string;
  }>> {
    try {
      const stockMovements = await db.getAll('stockMovements');
      const products = await db.getAll('products');
      
      const productsMap = new Map(products.map(p => [p.id!, p]));
      
      // Filtrar movimientos de stock dañado
      let damagedMovements = stockMovements.filter(m => 
        m.type === 'out' && 
        m.note && 
        m.note.toLowerCase().includes('dañ')
      );

      // Filtro por producto
      if (productId) {
        damagedMovements = damagedMovements.filter(m => m.productId === productId);
      }

      // Filtro por fecha
      if (startDate) {
        damagedMovements = damagedMovements.filter(m => 
          new Date(m.createdAt) >= new Date(startDate)
        );
      }
      if (endDate) {
        damagedMovements = damagedMovements.filter(m => 
          new Date(m.createdAt) <= new Date(endDate)
        );
      }

      // Mapear a formato legible
      return damagedMovements.map(m => {
        const product = productsMap.get(m.productId);
        return {
          id: m.id!,
          productId: m.productId,
          productName: product?.title || 'Producto desconocido',
          quantity: Math.abs(m.quantity),
          reason: m.note?.replace('Stock dañado: ', '') || '',
          userId: 'admin',
          timestamp: m.createdAt
        };
      });
    } catch (error) {
      logger.error('[DamagedStock] ❌ Error obteniendo historial:', error);
      throw error;
    }
  }
}

export const damagedStockService = new DamagedStockService();
export default damagedStockService;
