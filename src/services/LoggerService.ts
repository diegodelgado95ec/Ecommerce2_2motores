// src/services/LoggerService.ts
/**
 * Servicio de logging centralizado para la aplicación
 * Registra eventos importantes para debugging y auditoría
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
}

class LoggerService {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000; // Máximo de logs en memoria
  private isDevelopment = import.meta.env.DEV;

  /**
   * Registra un mensaje informativo
   */
  info(message: string, data?: any, context?: string): void {
    this.log('info', message, data, context);
  }

  /**
   * Registra una advertencia
   */
  warn(message: string, data?: any, context?: string): void {
    this.log('warn', message, data, context);
  }

  /**
   * Registra un error
   */
  error(message: string, data?: any, context?: string): void {
    this.log('error', message, data, context);
  }

  /**
   * Registra un mensaje de debug (solo en desarrollo)
   */
  debug(message: string, data?: any, context?: string): void {
    if (this.isDevelopment) {
      this.log('debug', message, data, context);
    }
  }

  /**
   * Método interno para registrar logs
   */
  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context
    };

    // Agregar a memoria
    this.logs.push(entry);

    // Limitar tamaño del array
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Enviar a consola en desarrollo
    if (this.isDevelopment) {
      const emoji = this.getEmoji(level);
      const style = this.getStyle(level);
      
      console.log(
        `%c${emoji} [${level.toUpperCase()}] ${context ? `[${context}] ` : ''}${message}`,
        style
      );
      
      if (data) {
        console.log('%cData:', 'color: #666; font-style: italic;', data);
      }
    }

    // En producción, podrías enviar logs críticos a un servicio externo
    if (!this.isDevelopment && level === 'error') {
      // TODO: Integrar con servicio de logging externo (ej: Sentry, LogRocket)
      // this.sendToExternalService(entry);
    }
  }

  /**
   * Obtiene emoji según nivel de log
   */
  private getEmoji(level: LogLevel): string {
    const emojis = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🐛'
    };
    return emojis[level];
  }

  /**
   * Obtiene estilo CSS para consola según nivel
   */
  private getStyle(level: LogLevel): string {
    const styles = {
      info: 'color: #3b82f6; font-weight: bold;',
      warn: 'color: #f59e0b; font-weight: bold;',
      error: 'color: #ef4444; font-weight: bold;',
      debug: 'color: #8b5cf6; font-weight: bold;'
    };
    return styles[level];
  }

  /**
   * Obtiene todos los logs
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  /**
   * Obtiene logs recientes
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Limpia todos los logs
   */
  clearLogs(): void {
    this.logs = [];
    console.log('🧹 Logs limpiados');
  }

  /**
   * Exporta logs como JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Descarga logs como archivo
   */
  downloadLogs(): void {
    const dataStr = this.exportLogs();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Obtiene estadísticas de logs
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      info: this.logs.filter(l => l.level === 'info').length,
      warn: this.logs.filter(l => l.level === 'warn').length,
      error: this.logs.filter(l => l.level === 'error').length,
      debug: this.logs.filter(l => l.level === 'debug').length
    };
    return stats;
  }
}

// Exportar instancia singleton
export const logger = new LoggerService();

// Exponer en window para debugging en desarrollo
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).logger = logger;
  console.log('📊 LoggerService disponible en window.logger');
}

export default logger;
