// src/services/DispenseService.ts - VERSIÓN COMPLETA CORREGIDA

import { db } from '../lib/db';
import { ledService } from './LedService';

export interface DispenseResult {
  success: boolean;
  productId: number;
  quantity: number;
  message: string;
}

class DispenseService {
  // ✅ WHITELIST de productos dispensables (IDs válidos)
  private readonly DISPENSABLE_PRODUCTS = new Set([1, 2, 3, 4, 5, 6]);
  
  // ✅ LÍMITES DE SEGURIDAD
  private readonly MIN_QUANTITY = 1;

  /**
   * ✅ Valida si un producto tiene dispensador físico
   * IMPORTANTE: Debe estar ANTES de validateInput
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
    // ✅ VALIDACIÓN ASYNC
    try {
      await this.validateInput(productId, quantity);
    } catch (error) {
      console.error('[DispenseService] ❌ Validación fallida:', error);
      return {
        success: false,
        productId,
        quantity,
        message: error instanceof Error ? error.message : 'Error de validación'
      };
    }

    const result: DispenseResult = {
      success: false,
      productId,
      quantity,
      message: '',
    };

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
        result.message = `✗ No se pudo dispensar ${productTitle || 'el producto'}`;
        console.warn(`[DispenseService] ⚠️ Dispensación falló: ${result.message}`);
      }
    } catch (error) {
      result.success = false;
      result.message = `Error al dispensar: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      console.error(`[DispenseService] ❌ Error en dispensación:`, error);
    }

    return result;
  }

  /**
   * Dispensa múltiples productos de una orden
   */
  async dispenseMultiple(
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
    }

    const allSuccess = results.every((r) => r.success);
    console.log(
      `[DispenseService] ${allSuccess ? '✓' : '⚠️'} Dispensación completada para orden`
    );

    return results;
  }
}

export const dispenseService = new DispenseService();
