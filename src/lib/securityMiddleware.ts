// src/lib/securityMiddleware.ts - Configuración centralizada de Rate Limiting

import { createLoginLimiter, createOrderLimiter } from './rateLimiter';

/**
 * ✅ CONFIGURACIÓN DE RATE LIMITERS
 * 
 * Prioridades según análisis:
 * 1. Admin (login) - CRÍTICO
 * 2. DevTools - ALTO (ya bloqueado físicamente)
 * 3. Saturación ESP32 - MEDIO
 * 4. Spam de órdenes - BAJO (requiere pago)
 */

// 🔴 PRIORIDAD 1: Login (Protección Admin)
export const loginLimiter = createLoginLimiter({
  windowMs: 300000,        // 5 minutos
  maxRequests: 3,          // Solo 3 intentos
  blockDuration: 900000,   // Bloqueo de 15 minutos
  keyPrefix: 'login',
  message: 'Demasiados intentos de login. Intenta de nuevo en {timeRemaining} segundos'
});

// 🔴 PRIORIDAD 1: Registro
export const registerLimiter = createLoginLimiter({
  windowMs: 3600000,       // 1 hora
  maxRequests: 3,          // Max 3 registros por hora
  blockDuration: 3600000,  // Bloqueo de 1 hora
  keyPrefix: 'register',
  message: 'Demasiados intentos de registro. Intenta de nuevo en {timeRemaining} segundos'
});

// 🟡 PRIORIDAD 4: Órdenes (Protección moderada)
export const orderLimiter = createOrderLimiter({
  windowMs: 60000,         // 1 minuto
  maxRequests: 5,          // 5 órdenes por minuto
  blockDuration: 60000,    // Bloqueo de 1 minuto
  keyPrefix: 'order',
  message: 'Demasiadas órdenes. Espera {timeRemaining} segundos'
});

/**
 * ✅ Obtener estadísticas de todos los limiters
 */
export function getAllRateLimitStats() {
  return {
    login: loginLimiter.getAllStats(),
    register: registerLimiter.getAllStats(),
    order: orderLimiter.getAllStats()
  };
}

/**
 * ✅ Resetear todos los limiters (solo para desarrollo)
 */
export function resetAllLimiters() {
  if (import.meta.env.DEV) {
    loginLimiter.resetAll();
    registerLimiter.resetAll();
    orderLimiter.resetAll();
    console.log('[Security] ✅ Todos los rate limiters reseteados');
  } else {
    console.warn('[Security] ⚠️ resetAllLimiters solo disponible en desarrollo');
  }
}
