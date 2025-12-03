// src/lib/rateLimiter.ts - Sistema de Rate Limiting con Logger

import logger from './logger';

export interface RateLimiterConfig {
  windowMs: number;           // Ventana de tiempo en ms (ej: 60000 = 1 min)
  maxRequests: number;        // Máximo de requests en esa ventana
  lockoutDuration?: number;   // Duración del bloqueo si excede (opcional)
  keyPrefix?: string;         // Prefijo para las keys (ej: 'login:', 'order:')
  onLimitExceeded?: (key: string, remainingMs: number) => void;
}

interface RequestRecord {
  timestamps: number[];
  lockedUntil?: number;
}

export class RateLimiter {
  private records = new Map<string, RequestRecord>();
  private config: Required<RateLimiterConfig>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimiterConfig) {
    this.config = {
      lockoutDuration: config.lockoutDuration || 0,
      keyPrefix: config.keyPrefix || '',
      onLimitExceeded: config.onLimitExceeded || (() => {}),
      ...config
    };

    // Limpieza automática cada minuto
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Verifica si una key puede hacer un request
   */
  checkLimit(key: string): { allowed: boolean; remainingMs?: number; message?: string } {
    const fullKey = `${this.config.keyPrefix}:${key}`; // ✅ FIX: Agregar ':'
    const now = Date.now();
    
    let record = this.records.get(fullKey);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(fullKey, record);
    }

    // Verificar si está en lockout
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingMs = record.lockedUntil - now;
      const remainingSecs = Math.ceil(remainingMs / 1000);
      
      logger.warn(
        `[RateLimiter] 🔒 Key "${fullKey}" bloqueada. Tiempo restante: ${remainingSecs}s`
      );
      
      this.config.onLimitExceeded(fullKey, remainingMs);
      
      return {
        allowed: false,
        remainingMs,
        message: `Bloqueado. Intenta de nuevo en ${remainingSecs} segundos`
      };
    }

    // Limpiar timestamps viejos
    const windowStart = now - this.config.windowMs;
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    // Verificar límite
    if (record.timestamps.length >= this.config.maxRequests) {
      logger.warn(
        `[RateLimiter] ⚠️ Límite excedido para "${fullKey}": ${record.timestamps.length}/${this.config.maxRequests} requests`
      );

      if (this.config.lockoutDuration > 0) {
        record.lockedUntil = now + this.config.lockoutDuration;
        const lockoutSecs = Math.ceil(this.config.lockoutDuration / 1000);
        
        logger.warn(
          `[RateLimiter] 🔒 Key "${fullKey}" bloqueada por ${lockoutSecs}s`
        );
        
        this.config.onLimitExceeded(fullKey, this.config.lockoutDuration);
        
        return {
          allowed: false,
          remainingMs: this.config.lockoutDuration,
          message: `Demasiados intentos. Bloqueado por ${lockoutSecs} segundos`
        };
      }

      const oldestRequest = record.timestamps[0];
      const remainingMs = oldestRequest + this.config.windowMs - now;
      const remainingSecs = Math.ceil(remainingMs / 1000);

      return {
        allowed: false,
        remainingMs,
        message: `Límite alcanzado. Espera ${remainingSecs} segundos`
      };
    }

    record.timestamps.push(now);
    
    logger.log(
      `[RateLimiter] ✓ Request permitido para "${fullKey}": ${record.timestamps.length}/${this.config.maxRequests}`
    );

    return { allowed: true };
  }

  /**
   * Resetea el contador para una key específica
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix}:${key}`; // ✅ FIX: Agregar ':'
    this.records.delete(fullKey);
    logger.log(`[RateLimiter] 🔄 Contador reseteado para "${fullKey}"`);
  }

  /**
   * Desbloquea una key manualmente
   */
  unlock(key: string): void {
    const fullKey = `${this.config.keyPrefix}:${key}`; // ✅ FIX: Agregar ':'
    const record = this.records.get(fullKey);
    
    if (record) {
      record.lockedUntil = undefined;
      record.timestamps = [];
      logger.log(`[RateLimiter] 🔓 Key "${fullKey}" desbloqueada manualmente`);
    }
  }

  /**
   * Obtiene estadísticas de una key
   */
  getStats(key: string) {
    const fullKey = `${this.config.keyPrefix}:${key}`; // ✅ FIX: Agregar ':'
    const record = this.records.get(fullKey);
    const now = Date.now();

    if (!record) {
      return {
        requests: 0,
        maxRequests: this.config.maxRequests,
        isLocked: false,
        remainingMs: 0
      };
    }

    const windowStart = now - this.config.windowMs;
    const recentRequests = record.timestamps.filter(ts => ts > windowStart);

    return {
      requests: recentRequests.length,
      maxRequests: this.config.maxRequests,
      isLocked: !!(record.lockedUntil && record.lockedUntil > now),
      remainingMs: record.lockedUntil && record.lockedUntil > now 
        ? record.lockedUntil - now 
        : 0
    };
  }

  /**
   * Obtiene estadísticas globales
   */
  getAllStats() {
    const now = Date.now();
    const stats = {
      totalTracked: this.records.size,
      totalLocked: 0,
      users: [] as Array<{
        key: string;
        requests: number;
        maxRequests: number;
        isLocked: boolean;
        remainingMs: number;
      }>
    };

    for (const [fullKey, record] of this.records.entries()) {
      const windowStart = now - this.config.windowMs;
      const recentRequests = record.timestamps.filter(ts => ts > windowStart);
      const isLocked = !!(record.lockedUntil && record.lockedUntil > now);
      
      if (isLocked) {
        stats.totalLocked++;
      }

      stats.users.push({
        key: fullKey,
        requests: recentRequests.length,
        maxRequests: this.config.maxRequests,
        isLocked,
        remainingMs: record.lockedUntil && record.lockedUntil > now 
          ? record.lockedUntil - now 
          : 0
      });
    }

    return stats;
  }

  /**
   * Resetea TODOS los contadores
   */
  resetAll(): void {
    const count = this.records.size;
    this.records.clear();
    logger.log(`[RateLimiter] 🧽 Todos los contadores reseteados (${count} registros eliminados)`);
  }

  /**
   * Limpieza de registros viejos
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.records.entries()) {
      const windowStart = now - this.config.windowMs;
      record.timestamps = record.timestamps.filter(ts => ts > windowStart);

      if (record.lockedUntil && record.lockedUntil < now) {
        record.lockedUntil = undefined;
      }

      if (record.timestamps.length === 0 && !record.lockedUntil) {
        this.records.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.log(`[RateLimiter] 🧹 Limpieza: ${cleaned} registros eliminados`);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.records.clear();
  }
}

// Factory functions
export function createLoginLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  return new RateLimiter({
    windowMs: 300000,
    maxRequests: 3,
    lockoutDuration: 900000,
    keyPrefix: 'login',
    onLimitExceeded: (key, remainingMs) => {
      logger.error(`[Security] 🚨 Login bloqueado para ${key}: ${Math.ceil(remainingMs/1000)}s`);
    },
    ...config
  });
}

export function createOrderLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  return new RateLimiter({
    windowMs: 60000,
    maxRequests: 5,
    lockoutDuration: 30000,
    keyPrefix: 'order',
    onLimitExceeded: (key, remainingMs) => {
      logger.warn(`[Security] ⚠️ Órdenes limitadas para ${key}: ${Math.ceil(remainingMs/1000)}s`);
    },
    ...config
  });
}

export function createDispenseLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  return new RateLimiter({
    windowMs: 10000,
    maxRequests: 10,
    lockoutDuration: 20000,
    keyPrefix: 'dispense',
    onLimitExceeded: (key, remainingMs) => {
      logger.warn(`[Security] ⚠️ Dispensación limitada para ${key}: ${Math.ceil(remainingMs/1000)}s`);
    },
    ...config
  });
}
