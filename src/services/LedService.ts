class LedService {
  private baseUrl: string = import.meta.env.VITE_ESP32_IP || 'http://localhost:8080';
  private isConnected: boolean = false;

  constructor() {
    console.log('[LedService] Inicializando con IP:', this.baseUrl);
  }

  async connect(): Promise<boolean> {
    try {
      console.log('[LedService] Verificando conexión ESP32 en:', this.baseUrl);
      
      // Intenta conectar con timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        this.isConnected = data.status === 'online' || response.status === 200;
        console.log('[LedService] ✓ ESP32 conectado:', data);
        return this.isConnected;
      }
      
      console.warn('[LedService] Respuesta no OK:', response.status);
      return false;
    } catch (error) {
      console.error('[LedService] ✗ Error conectando:', error);
      this.isConnected = false;
      return false;
    }
  }

  async sendProductSignal(productId: number, quantity: number): Promise<boolean> {
    // ✓ CAMBIO: No requerir conexión previa para /dispense
    // La dispensación debe ocurrir incluso si se detectó offline antes
    console.log(`[LedService] Intentando dispensar: producto ${productId}, cantidad ${quantity}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // ✓ CAMBIO: Endpoint modificado de /blink a /dispense
      const response = await fetch(`${this.baseUrl}/dispense`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, quantity }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[LedService] ⚠️ Error HTTP: ${response.status} - La compra será procesada igual`);
        // ✓ CAMBIO: No bloquear la compra si ESP32 falla
        return false;
      }

      const result = await response.json();
      console.log('[LedService] ✓ Dispensación enviada al ESP32:', result);
      return true;
    } catch (error) {
      // ✓ CAMBIO: Error no bloqueante - registra pero permite continuar
      console.warn('[LedService] ⚠️ Error enviando comando de dispensación:', error);
      console.warn('[LedService] ℹ️ La compra se procesará normalmente sin dispensación física');
      return false;
    }
  }

  isSupported(): boolean {
    return true; // WiFi siempre disponible
  }
}

export const ledService = new LedService();
