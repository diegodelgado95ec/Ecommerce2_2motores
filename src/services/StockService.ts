// src/services/StockService.ts - Servicio de gestión de stock con initialStock y sales

import { db } from '../lib/db';
import logger from '../lib/logger';
import type { DBSchema } from '../lib/db';

type Product = DBSchema['products'];
type StockMovement = DBSchema['stockMovements'];

/**
 * StockService se encarga EXCLUSIVAMENTE de:
 * - Validar disponibilidad de stock
 * - Actualizar cantidades de stock
 * - Registrar movimientos de stock
 * - Gestionar initialStock (fijo) y sales (contador)
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
   * ✨ NUEVO: Actualiza el stock de un producto manejando initialStock y sales
   */
  async updateProductStock(
    product: Product,
    quantity: number,
    type: 'in' | 'out',
    note: string
  ): Promise<number> {
    let newStock: number;
    let newSales: number = product.sales || 0;
    
    if (type === 'out') {
      // ❌ VENTA: Reduce stock actual, incrementa contador de ventas
      newStock = product.stock - quantity;
      newSales = newSales + quantity;
      
      if (newStock < 0) {
        throw new Error(`Stock no puede ser negativo para ${product.title}`);
      }
    } else {
      // ✅ REABASTECIMIENTO: Incrementa stock actual, RESETEA ventas a 0
      newStock = product.stock + quantity;
      newSales = 0; // ✨ RESETEAR ventas en reabastecimiento
      
      // ✨ Si initialStock no existe, establecerlo al nuevo stock
      if (!product.initialStock) {
        product.initialStock = newStock;
      }
    }

    // Actualizar producto
    await db.put('products', {
      ...product,
      stock: newStock,
      sales: newSales,
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
      `[StockService]     ✓ Stock actualizado: ${product.stock} → ${newStock} | Ventas: ${product.sales || 0} → ${newSales}`
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
      // Al revertir, NO resetear ventas - solo devolver stock
      const newStock = product.stock + item.quantity;
      const newSales = Math.max(0, (product.sales || 0) - item.quantity);
      
      await db.put('products', {
        ...product,
        stock: newStock,
        sales: newSales,
        updatedAt: new Date().toISOString()
      } as any);
      
      await db.add('stockMovements', {
        productId: product.id!,
        quantity: item.quantity,
        type: 'in',
        note: `Reversión orden #${orderId}`,
        createdAt: new Date().toISOString()
      } as any);
    }
    
    logger.log('[StockService] ✓ Stock revertido exitosamente');
  }

  /**
   * ✨ NUEVO: Establece el initialStock para un producto
   */
  async setInitialStock(productId: number, initialStock: number): Promise<void> {
    const product = await db.get('products', productId);
    if (!product) {
      throw new Error(`Producto ID ${productId} no encontrado`);
    }

    await db.put('products', {
      ...product,
      initialStock,
      updatedAt: new Date().toISOString()
    } as any);

    logger.log(`[StockService] ✓ Stock inicial establecido: ${product.title} → ${initialStock}`);
  }

  /**
   * ✨ NUEVO: Calcula la diferencia de stock (stock actual - initialStock)
   */
  getStockDifference(product: Product): number {
    const initial = product.initialStock || product.stock;
    return product.stock - initial;
  }
}

export const stockService = new StockService();
export default stockService;
