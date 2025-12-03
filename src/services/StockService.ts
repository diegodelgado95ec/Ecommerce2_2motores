// src/services/StockService.ts - Servicio de gestión de stock (SRP)

import { db } from '../lib/db';
import logger from '../lib/logger';
import type { DBSchema } from '../lib/db';

type Product = DBSchema['products'];
type StockMovement = DBSchema['stockMovements'];

/**
 * ✅ OPTIMIZACIÓN #8: Separación de responsabilidades (SRP)
 * 
 * StockService se encarga EXCLUSIVAMENTE de:
 * - Validar disponibilidad de stock
 * - Actualizar cantidades de stock
 * - Registrar movimientos de stock
 */
export class StockService {
  /**
   * Valida que haya stock suficiente para todos los items
   * Retorna Map con productos cargados (para evitar queries adicionales)
   */
  async validateStockAvailability(
    items: { productId: number; quantity: number }[]
  ): Promise<Map<number, Product>> {
    logger.log('[StockService] ✓ Validando stock disponible...');
    
    // Cargar TODOS los productos de una vez (1 query en lugar de N)
    const allProducts = await db.getAll('products');
    const productsMap = new Map(allProducts.map(p => [p.id!, p]));
    
    logger.log(`[StockService] ✓ ${allProducts.length} productos cargados en memoria`);

    // Validar stock para cada item
    for (const item of items) {
      const product = productsMap.get(item.productId);
      
      if (!product) {
        throw new Error(`Producto ID ${item.productId} no encontrado`);
      }
      
      if (product.stock < item.quantity) {
        throw new Error(
          `Stock insuficiente para ${product.title}. ` +
          `Disponible: ${product.stock}, Solicitado: ${item.quantity}`
        );
      }
    }
    
    logger.log('[StockService] ✓ Stock validado correctamente');
    return productsMap;
  }

  /**
   * Actualiza el stock de un producto y registra el movimiento
   */
  async updateProductStock(
    product: Product,
    quantity: number,
    type: 'in' | 'out',
    note: string
  ): Promise<number> {
    const newStock = type === 'in' 
      ? product.stock + quantity 
      : product.stock - quantity;
    
    if (newStock < 0) {
      throw new Error(`Stock no puede ser negativo para ${product.title}`);
    }

    // Actualizar producto
    await db.put('products', {
      ...product,
      stock: newStock,
      updatedAt: new Date().toISOString()
    } as any);

    // Registrar movimiento de stock
    await db.add('stockMovements', {
      productId: product.id!,
      quantity,
      type,
      note,
      createdAt: new Date().toISOString()
    } as any);

    logger.log(
      `[StockService]     ✓ Stock actualizado: ${product.stock} → ${newStock}`
    );
    
    return newStock;
  }

  /**
   * Actualiza stock para múltiples productos (usado en órdenes)
   */
  async updateStockForOrder(
    orderId: number,
    itemsWithProducts: Array<{
      item: { productId: number; quantity: number };
      product: Product;
    }>
  ): Promise<void> {
    logger.log('[StockService] 📦 Actualizando stock de productos...');
    
    for (const { item, product } of itemsWithProducts) {
      logger.log(
        `[StockService]   • ${product.title} (ID: ${item.productId}, Qty: ${item.quantity})`
      );
      
      await this.updateProductStock(
        product,
        item.quantity,
        'out',
        `Orden #${orderId}`
      );
    }
    
    logger.log('[StockService] ✓ Stock actualizado correctamente');
  }

  /**
   * Reversa movimientos de stock (en caso de cancelación)
   */
  async reverseStockForOrder(
    orderId: number,
    itemsWithProducts: Array<{
      item: { productId: number; quantity: number };
      product: Product;
    }>
  ): Promise<void> {
    logger.warn(`[StockService] ⚠️ Revirtiendo stock para orden #${orderId}`);
    
    for (const { item, product } of itemsWithProducts) {
      await this.updateProductStock(
        product,
        item.quantity,
        'in',
        `Reversión orden #${orderId}`
      );
    }
    
    logger.log('[StockService] ✓ Stock revertido exitosamente');
  }
}

export const stockService = new StockService();
export default stockService;
