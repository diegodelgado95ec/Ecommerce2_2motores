// src/services/DispenseService.ts - VERSIÓN COMPLETA CON TODOS LOS MÉTODOS

import { db } from '../lib/db';
import { ledService } from './LedService';

export interface DispenseResult {
  success: boolean;
  productId: number;
  quantity: number;
  message: string;
  error?: string;
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
   * ✅ Valida parámetros de entrada
   */
  private async validateInput(productId: number, quantity: number): Promise<void> {
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

    // ✅ Validar contra stock real
    const product = await db.get('products', productId);
    
    if (!product) {
      throw new Error(`Producto ${productId} no encontrado en base de datos`);
    }

    if (quantity > product.stock) {
      throw new Error(
        `Stock insuficiente para producto "${product.title}". Disponible: ${product.stock}, solicitado: ${quantity}`
      );
    }
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

    // ✅ VALIDACIÓN ASYNC
    try {
      await this.validateInput(productId, quantity);
    } catch (error) {
      console.error('[DispenseService] ❌ Validación fallida:', error);
      result.message = error instanceof Error ? error.message : 'Error de validación';
      result.error = result.message;
      this.dispensationHistory.push(result);
      return result;
    }

    console.log(
      `[DispenseService] 🔄 Iniciando dispensación: ${productTitle || 'Producto'} (ID: ${productId}, Cantidad: ${quantity})`
    );

    try {
      const sent = await ledService.sendProductSignal(productId, quantity);

      if (sent) {
        result.success = true;
        result.message = `✓ ${productTitle || 'Producto'} fue dispensado correctamente`;
        console.log(`[DispenseService] ✓ Dispensación exitosa: ${result.message}`);
      } else {
        result.success = false;
        result.message = `⚠️ No se pudo contactar el dispensador de ${productTitle || 'el producto'} - Compra procesada sin dispensación`;
        result.error = 'ESP32 no respondió';
        console.warn(`[DispenseService] ${result.message}`);
      }
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Error desconocido';
      result.message = `⚠️ Error dispensando ${productTitle || 'producto'}: ${result.error} - Compra procesada sin dispensación`;
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
