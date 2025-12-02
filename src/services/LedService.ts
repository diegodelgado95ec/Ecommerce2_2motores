// src/services/LedService.ts - ACTUALIZAR

import { HardwareConfigManager } from '../config/hardware.config';

class LedService {
  // ❌ ELIMINAR: private readonly ESP32_IP = 'http://192.168.0.105';
  
  constructor() {
    const url = HardwareConfigManager.getESP32URL();
    console.log('[LedService] Inicializando con URL:', url);
  }

  async sendProductSignal(productId: number, quantity: number): Promise<boolean> {
    const config = HardwareConfigManager.getConfig();
    
    // Verificar si está habilitado
    if (!config.esp32.enabled) {
      console.log('[LedService] ESP32 deshabilitado - Simulando dispensación');
      return true; // Simular éxito en modo desarrollo
    }

    const url = HardwareConfigManager.getESP32URL();
    console.log('[LedService] Intentando dispensar: producto', productId, 'cantidad', quantity);

    // Intentar con reintentos
    for (let attempt = 1; attempt <= config.esp32.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.esp32.timeout);

        const response = await fetch(`${url}/dispense`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product: productId, quantity }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`[LedService] ✅ Dispensación exitosa (intento ${attempt}/${config.esp32.retries})`);
          return true;
        } else {
          console.warn(`[LedService] ⚠️ Error HTTP ${response.status} (intento ${attempt}/${config.esp32.retries})`);
        }
      } catch (error) {
        console.warn(`[LedService] ⚠️ Error en intento ${attempt}/${config.esp32.retries}:`, error);
        
        if (attempt === config.esp32.retries) {
          console.error('[LedService] ❌ Todos los intentos fallaron');
          return false;
        }
        
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return false;
  }

  // Resto del código...
}

export const ledService = new LedService();
