// src/services/DispenseService.ts - CON INTEGRACIÓN DE SLOTS

import { db } from '../lib/db';
import { ledService } from './LedService';
import { logger } from './LoggerService';
import type { DBSchema } from '../lib/db';

export interface DispenseResult {
  success: boolean;
  productId: number;
  quantity: number;
  message: string;
  error?: string;
  slotPosition?: number;
  bandDistance?: number;
}

class DispenseService {
  // ✅ WHITELIST de productos dispensables (IDs válidos)
  private readonly DISPENSABLE_PRODUCTS = new Set([1, 2, 3, 4, 5, 6]);
  
  // ✅ LÍMITES DE SEGURIDAD
  private readonly MIN_QUANTITY = 1;
  
  // ✅ HISTORIAL de dispensaciones
  private dispensationHistory: DispenseResult[] = [];

  /**
   * ✅ Valida si un producto tiene dispensador físico
   */
  private isDispensable(productId: number): boolean {
    return this.DISPENSABLE_PRODUCTS.has(productId);
  }

  /**
   * ✅ Valida parámetros de entrada y slot físico
   */
  private async validateInput(productId: number, quantity: number): Promise<DBSchema['products']> {
    // Validar productId
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error(`ID de producto inválido: ${productId}`);
    }

    if (!this.isDispensable(productId)) {
      throw new Error(`Producto ${productId} no tiene dispensador físico asignado`);
    }

    // Validar quantity
    if (!Number.isInteger(quantity)) {
      throw new Error(`Cantidad debe ser un número entero: ${quantity}`);
    }

    if (quantity < this.MIN_QUANTITY) {
      throw new Error(`Cantidad mínima es ${this.MIN_QUANTITY}, recibido: ${quantity}`);
    }

    // ✅ Validar contra stock real y datos de slot
    const product = await db.get('products', productId);
    
    if (!product) {
      throw new Error(`Producto ${productId} no encontrado en base de datos`);
    }

    if (quantity > product.stock) {
      throw new Error(
        `Stock insuficiente para producto "${product.title}". Disponible: ${product.stock}, solicitado: ${quantity}`
      );
    }

    // ✨ NUEVO: Validar que el producto tenga slot asignado
    if (!product.slotPosition) {
      logger.warn('Producto dispensable sin slot asignado', {
        productId,
        productTitle: product.title
      });
      throw new Error(`Producto "${product.title}" no tiene slot físico asignado`);
    }

    // ✨ NUEVO: Validar que el slot esté activo
    if (product.isSlotActive === false) {
      logger.error('Intento de dispensar desde slot inactivo', {
        productId,
        slotPosition: product.slotPosition
      });
      throw new Error(`Slot ${product.slotPosition} está inactivo. No se puede dispensar.`);
    }

    // ✨ NUEVO: Validar que tenga distancia configurada
    if (!product.bandDistance) {
      logger.warn('Producto sin distancia de banda configurada', {
        productId,
        slotPosition: product.slotPosition
      });
      throw new Error(`Producto "${product.title}" no tiene distancia de banda configurada`);
    }

    return product;
  }

  /**
   * Dispensa un producto específico
   */
  async dispenseProduct(
    productId: number,
    quantity: number,
    productTitle?: string
  ): Promise<DispenseResult> {
    const result: DispenseResult = {
      success: false,
      productId,
      quantity,
      message: '',
    };

    let product: DBSchema['products'];

    // ✅ VALIDACIÓN ASYNC
    try {
      product = await this.validateInput(productId, quantity);
      result.slotPosition = product.slotPosition;
      result.bandDistance = product.bandDistance;
    } catch (error) {
      console.error('[DispenseService] ❌ Validación fallida:', error);
      result.message = error instanceof Error ? error.message : 'Error de validación';
      result.error = result.message;
      this.dispensationHistory.push(result);
      
      logger.error('Validación de dispensación fallida', {
        productId,
        quantity,
        error: result.error
      });
      
      return result;
    }

    console.log(
      `[DispenseService] 🔄 Iniciando dispensación: ${product.title} (ID: ${productId}, Slot: ${product.slotPosition}, Distancia: ${product.bandDistance}cm, Cantidad: ${quantity})`
    );

    logger.info('Iniciando dispensación', {
      productId,
      productTitle: product.title,
      slotPosition: product.slotPosition,
      bandDistance: product.bandDistance,
      quantity
    });

    try {
      // ✨ NUEVO: Enviar señal al ESP32 con datos de slot
      // TODO: Actualizar ledService.sendProductSignal para aceptar slotPosition y bandDistance
      // Por ahora usa el método existente
      const sent = await ledService.sendProductSignal(productId, quantity);

      if (sent) {
        result.success = true;
        result.message = `✓ ${product.title} fue dispensado correctamente desde Slot ${product.slotPosition}`;
        
        logger.info('Dispensación exitosa', {
          productId,
          slotPosition: product.slotPosition,
          quantity
        });
        
        console.log(`[DispenseService] ✓ Dispensación exitosa: ${result.message}`);
      } else {
        result.success = false;
        result.message = `⚠️ No se pudo contactar el dispensador de ${product.title} (Slot ${product.slotPosition}) - Compra procesada sin dispensación`;
        result.error = 'ESP32 no respondió';
        
        logger.warn('Dispensación fallida - ESP32 no respondió', {
          productId,
          slotPosition: product.slotPosition
        });
        
        console.warn(`[DispenseService] ${result.message}`);
      }
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Error desconocido';
      result.message = `⚠️ Error dispensando ${product.title} desde Slot ${product.slotPosition}: ${result.error} - Compra procesada sin dispensación`;
      
      logger.error('Error en dispensación', {
        productId,
        slotPosition: product.slotPosition,
        error: result.error
      });
      
      console.error(`[DispenseService] ❌ Error en dispensación:`, error);
    }

    // ✅ Registrar en historial
    this.dispensationHistory.push(result);

    return result;
  }

  /**
   * ✅ Dispensa múltiples productos de una orden
   * NOTA: Usa dispenseOrder para coincidir con inventory.ts
   */
  async dispenseOrder(
    items: Array<{
      productId: number;
      quantity: number;
      title?: string;
    }>
  ): Promise<DispenseResult[]> {
    console.log(`[DispenseService] 📦 Procesando dispensación para orden con ${items.length} producto(s)`);
    
    logger.info('Procesando orden de dispensación', {
      itemCount: items.length,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity }))
    });

    const results: DispenseResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // ✅ Solo procesar productos dispensables
      if (this.isDispensable(item.productId)) {
        console.log(`[DispenseService] Dispensando producto ${i + 1}/${items.length}: ${item.title || item.productId}`);

        const result = await this.dispenseProduct(
          item.productId,
          item.quantity,
          item.title
        );

        results.push(result);

        // Pequeña pausa entre dispensaciones para no saturar el ESP32
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else {
        // ✅ Registrar productos no dispensables
        const result: DispenseResult = {
          success: true, // No es un error, es esperado
          productId: item.productId,
          quantity: item.quantity,
          message: `Producto ${item.title || item.productId} no requiere dispensación física`,
        };
        results.push(result);
      }
    }

    const allSuccess = results.every((r) => r.success);
    console.log(
      `[DispenseService] ${allSuccess ? '✓' : '⚠️'} Dispensación completada para orden`
    );
    
    logger.info('Orden de dispensación completada', {
      allSuccess,
      successCount: results.filter(r => r.success).length,
      totalCount: results.length
    });

    return results;
  }

  /**
   * ✅ Obtiene el historial de dispensaciones
   */
  getHistory(): DispenseResult[] {
    return [...this.dispensationHistory];
  }

  /**
   * ✅ Limpia el historial de dispensaciones
   */
  clearHistory(): void {
    console.log(`[DispenseService] Limpiando historial (${this.dispensationHistory.length} registros)`);
    this.dispensationHistory = [];
  }

  /**
   * ✅ Obtiene estadísticas de dispensación
   */
  getStats() {
    const successful = this.dispensationHistory.filter(r => r.success).length;
    const failed = this.dispensationHistory.filter(r => !r.success && this.isDispensable(r.productId)).length;
    const skipped = this.dispensationHistory.filter(r => !this.isDispensable(r.productId)).length;

    return {
      total: this.dispensationHistory.length,
      successful,
      failed,
      skipped,
      successRate: this.dispensationHistory.length > 0 
        ? Math.round((successful / this.dispensationHistory.length) * 100) 
        : 0,
    };
  }
}

export const dispenseService = new DispenseService();
