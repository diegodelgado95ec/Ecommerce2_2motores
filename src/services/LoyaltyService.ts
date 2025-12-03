// src/services/LoyaltyService.ts - Servicio de puntos de fidelidad (SRP)

import { db } from '../lib/db';
import logger from '../lib/logger';
import type { DBSchema } from '../lib/db';

type User = DBSchema['users'];

/**
 * ✅ OPTIMIZACIÓN #8: Separación de responsabilidades (SRP)
 * 
 * LoyaltyService se encarga EXCLUSIVAMENTE de:
 * - Cálculo de puntos de fidelidad
 * - Actualización de puntos de usuario
 * - Canje de puntos
 */
export class LoyaltyService {
  /**
   * Tasa de conversión: $1 = 10 puntos
   */
  private readonly POINTS_PER_DOLLAR = 10;

  /**
   * Calcula puntos ganados por una compra
   */
  calculatePointsEarned(totalAmount: number): number {
    return Math.floor(totalAmount * this.POINTS_PER_DOLLAR);
  }

  /**
   * Agrega puntos de fidelidad a un usuario
   */
  async addPointsToUser(
    user: User,
    totalAmount: number
  ): Promise<number> {
    const pointsEarned = this.calculatePointsEarned(totalAmount);
    
    if (pointsEarned === 0) {
      return 0;
    }

    user.loyaltyPoints += pointsEarned;
    user.updatedAt = new Date().toISOString() as any;
    
    await db.put('users', user);
    
    logger.log(
      `[LoyaltyService] 🎁 ${pointsEarned} puntos agregados a ${user.email}`
    );
    
    return pointsEarned;
  }

  /**
   * Verifica si un usuario tiene suficientes puntos
   */
  hasEnoughPoints(user: User, requiredPoints: number): boolean {
    return user.loyaltyPoints >= requiredPoints;
  }

  /**
   * Canjea puntos de un usuario
   */
  async redeemPoints(
    user: User,
    pointsToRedeem: number
  ): Promise<void> {
    if (!this.hasEnoughPoints(user, pointsToRedeem)) {
      throw new Error(
        `Puntos insuficientes. Disponible: ${user.loyaltyPoints}, ` +
        `Requerido: ${pointsToRedeem}`
      );
    }

    user.loyaltyPoints -= pointsToRedeem;
    user.updatedAt = new Date().toISOString() as any;
    
    await db.put('users', user);
    
    logger.log(
      `[LoyaltyService] 🎫 ${pointsToRedeem} puntos canjeados por ${user.email}`
    );
  }

  /**
   * Convierte puntos a descuento en dólares
   */
  convertPointsToDiscount(points: number): number {
    return points / this.POINTS_PER_DOLLAR;
  }
}

export const loyaltyService = new LoyaltyService();
export default loyaltyService;
