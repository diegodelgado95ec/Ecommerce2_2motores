// src/config/hardware.config.ts - NUEVO ARCHIVO

interface HardwareConfig {
  esp32: {
    ip: string;
    port: number;
    timeout: number;
    retries: number;
    enabled: boolean;
  };
}

class HardwareConfigManager {
  private static readonly STORAGE_KEY = 'hardware_config';
  
  // Configuración por defecto
  private static readonly DEFAULT_CONFIG: HardwareConfig = {
    esp32: {
      ip: '192.168.0.105',
      port: 80,
      timeout: 5000, // 5 segundos
      retries: 3,
      enabled: true
    }
  };

  /**
   * Obtener configuración actual
   */
  static getConfig(): HardwareConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[HardwareConfig] Error al cargar configuración:', error);
    }
    return this.DEFAULT_CONFIG;
  }

  /**
   * Guardar configuración
   */
  static saveConfig(config: Partial<HardwareConfig>): void {
    try {
      const current = this.getConfig();
      const updated = {
        ...current,
        esp32: { ...current.esp32, ...config.esp32 }
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      console.log('[HardwareConfig] Configuración guardada:', updated);
    } catch (error) {
      console.error('[HardwareConfig] Error al guardar configuración:', error);
      throw new Error('No se pudo guardar la configuración');
    }
  }

  /**
   * Obtener URL completa del ESP32
   */
  static getESP32URL(): string {
    const config = this.getConfig();
    return `http://${config.esp32.ip}:${config.esp32.port}`;
  }

  /**
   * Verificar conexión con ESP32
   */
  static async testConnection(): Promise<{ success: boolean; message: string; latency?: number }> {
    const config = this.getConfig();
    
    if (!config.esp32.enabled) {
      return {
        success: false,
        message: 'ESP32 deshabilitado en configuración'
      };
    }

    const url = this.getESP32URL();
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.esp32.timeout);

      const response = await fetch(`${url}/status`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          message: `Conexión exitosa (${latency}ms)`,
          latency
        };
      } else {
        return {
          success: false,
          message: `Error HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Resetear a configuración por defecto
   */
  static reset(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('[HardwareConfig] Configuración reseteada');
  }
}

export { HardwareConfigManager, type HardwareConfig };
