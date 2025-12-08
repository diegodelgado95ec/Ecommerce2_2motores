// src/lib/logger.ts - Sistema de logging condicional

/**
 * ✅ OPTIMIZACIÓN #4: Reducir logs en producción
 * 
 * Logger condicional que:
 * - Muestra logs en desarrollo (NODE_ENV === 'development')
 * - Oculta logs en producción (para performance y seguridad)
 * - SIEMPRE muestra errores (críticos)
 * - SIEMPRE muestra warnings (importantes)
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log informativo (solo en desarrollo)
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log de información (solo en desarrollo)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning (SIEMPRE se muestra)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error (SIEMPRE se muestra)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log de tabla (solo en desarrollo)
   */
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * Grupo de logs (solo en desarrollo)
   */
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * Fin de grupo de logs (solo en desarrollo)
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  /**
   * Grupo colapsado (solo en desarrollo)
   */
  groupCollapsed: (label: string) => {
    if (isDevelopment) {
      console.groupCollapsed(label);
    }
  },

  /**
   * Debug trace (solo en desarrollo)
   */
  trace: (...args: any[]) => {
    if (isDevelopment) {
      console.trace(...args);
    }
  },

  /**
   * Verificar si estamos en modo desarrollo
   */
  isDev: () => isDevelopment
};

export default logger;
