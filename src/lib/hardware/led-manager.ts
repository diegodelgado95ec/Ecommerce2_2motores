import { ledService } from "../../services/LedService";

export interface LEDCommand {
  productId: number;
  quantity: number;
}

export class LEDManager {
  private commandQueue: LEDCommand[] = [];
  private isProcessing: boolean = false;

  constructor() {
    // ledService es un singleton, no instanciar aquí
  }

  async connect(): Promise<{ success: boolean; message: string }> {
    try {
      const success = await ledService.connect();
      return {
        success,
        message: success ? 'Conectado al ESP32' : 'No se pudo conectar al ESP32',
      };
    } catch (error) {
      console.error('Error en conexión:', error);
      return {
        success: false,
        message: `Error: ${error}`,
      };
    }
  }

  async queueCommand(command: LEDCommand): Promise<void> {
    this.commandQueue.push(command);
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.commandQueue.length === 0) return;

    this.isProcessing = true;
    try {
      while (this.commandQueue.length > 0) {
        const command = this.commandQueue[0];
        await ledService.sendProductSignal(command.productId, command.quantity);
        this.commandQueue.shift();
        // Esperar un momento entre comandos
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error procesando cola de comandos LED:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  isSupported(): boolean {
    return ledService.isSupported();
  }
}

export const ledManager = new LEDManager();