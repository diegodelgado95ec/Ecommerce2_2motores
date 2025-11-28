import { ledService } from './LedService';

/**
 * DispenseService
 * ================
 * Servicio especializado para controlar la dispensación física de productos
 * 
 * CARACTERÍSTICAS:
 * - Solo dispensa productos ID 1 (Arroz) e ID 2 (Fideos)
 * - Maneja errores sin bloquear el flujo de compra
 * - Proporciona feedback visual al usuario
 * - Registra todas las dispensaciones para auditoría
 */

interface DispenseResult {
  success: boolean;
  productId: number;
  quantity: number;
  message: string;
  error?: string;
}

// ✓ IDs de productos que tienen dispensador físico
const DISPENSABLE_PRODUCT_IDS = [1, 2];

class DispenseService {
  private dispensationHistory: DispenseResult[] = [];

  /**
   * Verifica si un producto puede ser dispensado físicamente
   * 
   * @param productId - ID del producto a verificar
   * @returns true si el producto tiene dispensador físico
   */
  isDispensable(productId: number): boolean {
    return DISPENSABLE_PRODUCT_IDS.includes(productId);
  }

  /**
   * Intenta dispensar un producto
   * 
   * @param productId - ID del producto a dispensar
   * @param quantity - Cantidad a dispensar
   * @param productTitle - Título del producto (para logs)
   * @returns Promesa con resultado de la dispensación
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

    // ✓ PASO 1: Validar que el producto pueda dispensarse
    if (!this.isDispensable(productId)) {
      result.message = `⚠️ Producto ${productId} (${productTitle || 'desconocido'}) no tiene dispensador físico - Se procesará como compra normal`;
      console.log(`[DispenseService] ${result.message}`);
      this.dispensationHistory.push(result);
      return result;
    }

    console.log(`[DispenseService] 🔄 Iniciando dispensación: ${productTitle} (ID: ${productId}, Cantidad: ${quantity})`);

    try {
      // ✓ PASO 2: Enviar señal al LED Service
      const sent = await ledService.sendProductSignal(productId, quantity);

      if (sent) {
        result.success = true;
        result.message = `✓ ${productTitle} fue dispensado correctamente`;
        console.log(`[DispenseService] ✓ Dispensación exitosa: ${result.message}`);
      } else {
        result.success = false;
        result.message = `⚠️ No se pudo contactar el dispensador de ${productTitle} - Compra procesada sin dispensación`;
        result.error = 'ESP32 no respondió';
        console.warn(`[DispenseService] ${result.message}`);
      }
    } catch (error) {
      // ✓ PASO 3: Manejar errores sin bloquear la compra
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Error desconocido';
      result.message = `⚠️ Error dispensando ${productTitle}: ${result.error} - Compra procesada sin dispensación`;
      console.error(`[DispenseService] ✗ ${result.message}`);
    }

    // ✓ PASO 4: Registrar en historial
    this.dispensationHistory.push(result);

    return result;
  }

  /**
   * Procesa la dispensación de múltiples productos de una orden
   * 
   * @param items - Array de items de la orden con productId, quantity, y title
   * @returns Promesa con array de resultados
   */
  async dispenseOrder(
    items: Array<{ productId: number; quantity: number; title?: string }>
  ): Promise<DispenseResult[]> {
    console.log(`[DispenseService] 📦 Procesando dispensación para orden con ${items.length} producto(s)`);

    const results: DispenseResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // ✓ Solo procesar productos dispensables
      if (this.isDispensable(item.productId)) {
        console.log(`[DispenseService] Dispensando producto ${i + 1}/${items.length}: ${item.title}`);

        const result = await this.dispenseProduct(item.productId, item.quantity, item.title);
        results.push(result);

        // Esperar entre dispensaciones para evitar conflictos
        if (i < items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        // ✓ Registrar productos no dispensables
        const result: DispenseResult = {
          success: true, // No es un error, es esperado
          productId: item.productId,
          quantity: item.quantity,
          message: `Producto ${item.title} no requiere dispensación física`,
        };
        results.push(result);
      }
    }

    console.log(`[DispenseService] ✓ Dispensación completada para orden`);
    return results;
  }

  /**
   * Obtiene el historial de dispensaciones
   * 
   * @returns Array con todos los resultados de dispensación
   */
  getHistory(): DispenseResult[] {
    return [...this.dispensationHistory];
  }

  /**
   * Limpia el historial de dispensaciones
   */
  clearHistory(): void {
    console.log(`[DispenseService] Limpiando historial (${this.dispensationHistory.length} registros)`);
    this.dispensationHistory = [];
  }

  /**
   * Obtiene estadísticas de dispensación
   * 
   * @returns Objeto con estadísticas
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
