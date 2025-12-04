// src/services/SlotService.ts
import { db } from '../lib/db';
import type { DBSchema } from '../lib/db';
import { logger } from '../services/LoggerService';

export interface SlotInfo {
  slotPosition: number;
  productId?: number;
  productName?: string;
  bandDistance?: number;
  isActive: boolean;
  lastCalibration?: string;
}

export interface SlotAssignment {
  productId: number;
  slotPosition: number;
  bandDistance: number;
  previousSlot?: number;
}

class SlotService {
  private readonly MAX_SLOTS = 20; // Máximo de slots físicos disponibles
  private readonly MIN_DISTANCE = 5; // cm mínimo
  private readonly MAX_DISTANCE = 200; // cm máximo

  /**
   * Obtener todos los slots disponibles con su estado actual
   */
  async getAllSlots(): Promise<SlotInfo[]> {
    try {
      const products = await db.getAll('products');
      const slots: SlotInfo[] = [];

      // Crear mapa de slots ocupados
      const occupiedSlots = new Map<number, DBSchema['products']>();
      products.forEach(product => {
        if (product.slotPosition) {
          occupiedSlots.set(product.slotPosition, product);
        }
      });

      // Generar lista completa de slots
      for (let i = 1; i <= this.MAX_SLOTS; i++) {
        const product = occupiedSlots.get(i);
        slots.push({
          slotPosition: i,
          productId: product?.id,
          productName: product?.title,
          bandDistance: product?.bandDistance,
          isActive: product?.isSlotActive ?? true,
          lastCalibration: product?.lastCalibration
        });
      }

      return slots;
    } catch (error) {
      logger.error('Error obteniendo slots', { error });
      throw error;
    }
  }

  /**
   * Obtener solo los slots disponibles (sin producto asignado)
   */
  async getAvailableSlots(): Promise<number[]> {
    try {
      const allSlots = await this.getAllSlots();
      return allSlots
        .filter(slot => !slot.productId && slot.isActive)
        .map(slot => slot.slotPosition);
    } catch (error) {
      logger.error('Error obteniendo slots disponibles', { error });
      throw error;
    }
  }

  /**
   * Validar si un slot está disponible
   */
  async isSlotAvailable(slotPosition: number): Promise<boolean> {
    try {
      if (slotPosition < 1 || slotPosition > this.MAX_SLOTS) {
        return false;
      }

      const products = await db.getAll('products');
      const occupied = products.some(p => p.slotPosition === slotPosition);
      return !occupied;
    } catch (error) {
      logger.error('Error validando disponibilidad de slot', { slotPosition, error });
      return false;
    }
  }

  /**
   * Obtener el producto asignado a un slot específico
   */
  async getProductInSlot(slotPosition: number): Promise<DBSchema['products'] | null> {
    try {
      const products = await db.getAll('products');
      return products.find(p => p.slotPosition === slotPosition) || null;
    } catch (error) {
      logger.error('Error obteniendo producto en slot', { slotPosition, error });
      return null;
    }
  }

  /**
   * Asignar un producto a un slot
   */
  async assignProductToSlot(assignment: SlotAssignment): Promise<boolean> {
    try {
      const { productId, slotPosition, bandDistance } = assignment;

      // Validaciones
      if (!this.validateSlotPosition(slotPosition)) {
        throw new Error(`Slot ${slotPosition} fuera de rango (1-${this.MAX_SLOTS})`);
      }

      if (!this.validateBandDistance(bandDistance)) {
        throw new Error(`Distancia ${bandDistance}cm fuera de rango (${this.MIN_DISTANCE}-${this.MAX_DISTANCE}cm)`);
      }

      // Obtener producto
      const product = await db.get('products', productId);
      if (!product) {
        throw new Error(`Producto ${productId} no encontrado`);
      }

      // Si el slot ya está ocupado por otro producto, liberar
      const existingProduct = await this.getProductInSlot(slotPosition);
      if (existingProduct && existingProduct.id !== productId) {
        await this.unassignProductFromSlot(existingProduct.id);
        logger.info('Slot liberado de producto anterior', {
          slotPosition,
          previousProductId: existingProduct.id
        });
      }

      // Actualizar producto con nueva asignación
      const updatedProduct: DBSchema['products'] = {
        ...product,
        slotPosition,
        bandDistance,
        isSlotActive: true,
        lastCalibration: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.put('products', updatedProduct);

      logger.info('Producto asignado a slot', {
        productId,
        productName: product.title,
        slotPosition,
        bandDistance
      });

      return true;
    } catch (error) {
      logger.error('Error asignando producto a slot', { assignment, error });
      throw error;
    }
  }

  /**
   * Reasignar un producto a un nuevo slot
   */
  async reassignSlot(productId: number, newSlotPosition: number, newBandDistance: number): Promise<boolean> {
    try {
      const product = await db.get('products', productId);
      if (!product) {
        throw new Error(`Producto ${productId} no encontrado`);
      }

      const previousSlot = product.slotPosition;

      await this.assignProductToSlot({
        productId,
        slotPosition: newSlotPosition,
        bandDistance: newBandDistance,
        previousSlot
      });

      logger.info('Slot reasignado', {
        productId,
        previousSlot,
        newSlot: newSlotPosition
      });

      return true;
    } catch (error) {
      logger.error('Error reasignando slot', { productId, newSlotPosition, error });
      throw error;
    }
  }

  /**
   * Desasignar un producto de su slot
   */
  async unassignProductFromSlot(productId: number): Promise<boolean> {
    try {
      const product = await db.get('products', productId);
      if (!product) {
        throw new Error(`Producto ${productId} no encontrado`);
      }

      const updatedProduct: DBSchema['products'] = {
        ...product,
        slotPosition: undefined,
        bandDistance: undefined,
        isSlotActive: undefined,
        lastCalibration: undefined,
        updatedAt: new Date().toISOString()
      };

      await db.put('products', updatedProduct);

      logger.info('Producto desasignado de slot', {
        productId,
        previousSlot: product.slotPosition
      });

      return true;
    } catch (error) {
      logger.error('Error desasignando producto de slot', { productId, error });
      throw error;
    }
  }

  /**
   * Activar/desactivar un slot
   */
  async toggleSlotActive(slotPosition: number, isActive: boolean): Promise<boolean> {
    try {
      const product = await this.getProductInSlot(slotPosition);
      if (!product) {
        logger.warn('Intento de toggle en slot vacío', { slotPosition });
        return false;
      }

      const updatedProduct: DBSchema['products'] = {
        ...product,
        isSlotActive: isActive,
        updatedAt: new Date().toISOString()
      };

      await db.put('products', updatedProduct);

      logger.info('Estado de slot cambiado', {
        slotPosition,
        productId: product.id,
        isActive
      });

      return true;
    } catch (error) {
      logger.error('Error cambiando estado de slot', { slotPosition, isActive, error });
      throw error;
    }
  }

  /**
   * Validar posición de slot
   */
  private validateSlotPosition(position: number): boolean {
    return Number.isInteger(position) && position >= 1 && position <= this.MAX_SLOTS;
  }

  /**
   * Validar distancia de banda
   */
  private validateBandDistance(distance: number): boolean {
    return Number.isFinite(distance) && distance >= this.MIN_DISTANCE && distance <= this.MAX_DISTANCE;
  }

  /**
   * Obtener historial de cambios de slot (simulado - en producción usar tabla de historial)
   */
  async getSlotHistory(slotPosition: number): Promise<any[]> {
    // TODO: Implementar tabla de historial de slots
    logger.info('Historial de slot solicitado', { slotPosition });
    return [];
  }

  /**
   * Validar disponibilidad con mensaje detallado
   */
  async validateSlotAvailability(slotPosition: number): Promise<{ available: boolean; message?: string; currentProduct?: DBSchema['products'] }> {
    try {
      if (!this.validateSlotPosition(slotPosition)) {
        return {
          available: false,
          message: `Slot ${slotPosition} fuera de rango. Debe estar entre 1 y ${this.MAX_SLOTS}.`
        };
      }

      const product = await this.getProductInSlot(slotPosition);
      if (product) {
        return {
          available: false,
          message: `Slot ${slotPosition} ocupado por: ${product.title}`,
          currentProduct: product
        };
      }

      return { available: true };
    } catch (error) {
      logger.error('Error validando disponibilidad de slot', { slotPosition, error });
      return {
        available: false,
        message: 'Error al validar disponibilidad'
      };
    }
  }
}

export const slotService = new SlotService();
export default slotService;
