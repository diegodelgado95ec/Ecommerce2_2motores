/**
 * ESP32 DISPENSADOR - Código de Referencia
 * ==========================================
 * 
 * Ejemplo de cómo implementar el endpoint /dispense en Arduino (ESP32)
 * para trabajar con el sistema de dispensación de ecommerce
 * 
 * COMPONENTES NECESARIOS:
 * - ESP32 con WiFi
 * - 2x Motores Stepper NEMA 17
 * - 2x Drivers A4988 (o similares)
 * - Fuente de poder 12V para motores
 */

// ============================================
// CONFIGURACIÓN DE PINES Y MOTORES
// ============================================

// Motor 1 - ARROZ (ID: 1)
const int MOTOR1_STEP = 12;     // Pin step del driver A4988
const int MOTOR1_DIR = 13;      // Pin dirección del driver A4988
const int MOTOR1_ENABLE = 14;   // Pin enable/disable del driver

// Motor 2 - FIDEOS (ID: 2)
const int MOTOR2_STEP = 25;
const int MOTOR2_DIR = 26;
const int MOTOR2_ENABLE = 27;

// Configuración de velocidad (microsegundos entre pulsos)
const int STEP_DELAY = 1000;    // Ajustar según velocidad deseada

// ============================================
// LIBRERÍA REQUERIDA: AsyncWebServer
// ============================================
// Instalar: Sketch → Include Library → Manage Libraries
// Buscar: AsyncTCP y ESPAsyncWebServer
// Versión recomendada: ESPAsyncWebServer 1.2.3+

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

// ============================================
// VARIABLES GLOBALES
// ============================================

const char* SSID = "TU_SSID_AQUI";
const char* PASSWORD = "TU_PASSWORD_AQUI";

AsyncWebServer server(80);
bool motorsBusy = false;

// ============================================
// CONFIGURACIÓN INICIAL - setup()
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=== ESP32 DISPENSADOR INICIANDO ===\n");

  // Configurar pines
  configurarMotores();

  // Conectar WiFi
  conectarWiFi();

  // Configurar rutas del servidor
  configurarServer();

  Serial.println("\n✓ Sistema listo para recibir comandos");
  Serial.println("POST http://192.168.18.14/dispense");
  Serial.println("  {\"productId\": 1, \"quantity\": 2}\n");
}

// ============================================
// CONFIGURAR PINES DE MOTORES
// ============================================

void configurarMotores() {
  Serial.println("[setup] Configurando pines de motores...");

  // Motor 1
  pinMode(MOTOR1_STEP, OUTPUT);
  pinMode(MOTOR1_DIR, OUTPUT);
  pinMode(MOTOR1_ENABLE, OUTPUT);
  digitalWrite(MOTOR1_ENABLE, HIGH);  // Deshabilitado inicialmente

  // Motor 2
  pinMode(MOTOR2_STEP, OUTPUT);
  pinMode(MOTOR2_DIR, OUTPUT);
  pinMode(MOTOR2_ENABLE, OUTPUT);
  digitalWrite(MOTOR2_ENABLE, HIGH);  // Deshabilitado inicialmente

  Serial.println("[setup] ✓ Pines configurados correctamente");
}

// ============================================
// CONECTAR A WiFi
// ============================================

void conectarWiFi() {
  Serial.println("[WiFi] Conectando a " + String(SSID) + "...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(SSID, PASSWORD);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WiFi] ✓ Conectado correctamente");
    Serial.println("[WiFi] IP: " + WiFi.localIP().toString());
    Serial.println("[WiFi] RSSI: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println();
    Serial.println("[WiFi] ✗ No se pudo conectar");
  }
}

// ============================================
// CONFIGURAR RUTAS DEL SERVIDOR WEB
// ============================================

void configurarServer() {
  Serial.println("[Server] Configurando rutas HTTP...");

  // Ruta: GET /status
  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request) {
    handleStatus(request);
  });

  // Ruta: POST /dispense
  server.on("/dispense", HTTP_POST, [](AsyncWebServerRequest *request) {
    handleDispense(request);
  }, nullptr, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    handleDispenseBody(request, data, len, index, total);
  });

  server.begin();
  Serial.println("[Server] ✓ Servidor iniciado en puerto 80");
}

// ============================================
// HANDLER: GET /status
// ============================================

void handleStatus(AsyncWebServerRequest *request) {
  Serial.println("[status] Solicitud de estado recibida");

  // Crear respuesta JSON
  StaticJsonDocument<200> doc;
  doc["status"] = "online";
  doc["version"] = "1.0";
  doc["timestamp"] = millis();
  doc["motorsBusy"] = motorsBusy;
  doc["ip"] = WiFi.localIP().toString();

  String response;
  serializeJson(doc, response);

  request->send(200, "application/json", response);
  Serial.println("[status] ✓ Respuesta enviada");
}

// ============================================
// HANDLER: POST /dispense (Cabeceras y validación)
// ============================================

String dispensaPayload = "";

void handleDispense(AsyncWebServerRequest *request) {
  // Este handler se llama DESPUÉS de recibir todo el body
  Serial.println("\n[dispense] === SOLICITUD DE DISPENSACIÓN RECIBIDA ===");

  if (dispensaPayload.length() == 0) {
    Serial.println("[dispense] ✗ Error: Payload vacío");
    request->send(400, "application/json", "{\"error\": \"Payload vacío\"}");
    return;
  }

  // Parsear JSON
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, dispensaPayload);

  if (error) {
    Serial.println("[dispense] ✗ Error parseando JSON: " + String(error.c_str()));
    request->send(400, "application/json", "{\"error\": \"JSON inválido\"}");
    dispensaPayload = "";
    return;
  }

  int productId = doc["productId"];
  int quantity = doc["quantity"];

  Serial.println("[dispense] ProductID: " + String(productId));
  Serial.println("[dispense] Quantity: " + String(quantity));

  // Ejecutar dispensación
  dispensarProducto(productId, quantity);

  // Enviar respuesta exitosa
  StaticJsonDocument<200> response;
  response["status"] = "ok";
  response["productId"] = productId;
  response["quantity"] = quantity;
  response["message"] = "Producto dispensado correctamente";

  String responseStr;
  serializeJson(response, responseStr);

  request->send(200, "application/json", responseStr);
  Serial.println("[dispense] ✓ Dispensación completada\n");

  // Limpiar payload
  dispensaPayload = "";
}

// ============================================
// HANDLER: POST /dispense (Recibir Body)
// ============================================

void handleDispenseBody(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
  // Este handler se llama mientras se recibe el body
  for (size_t i = 0; i < len; i++) {
    dispensaPayload += (char)data[i];
  }
}

// ============================================
// DISPENSAR PRODUCTO - Lógica Principal
// ============================================

void dispensarProducto(int productId, int quantity) {
  Serial.println("\n[dispense] 🔄 Iniciando dispensación...");

  motorsBusy = true;

  switch (productId) {
    case 1:
      Serial.println("[dispense] Motor 1 activado (ARROZ)");
      activarMotor(MOTOR1_STEP, MOTOR1_DIR, MOTOR1_ENABLE, quantity);
      Serial.println("[dispense] ✓ Motor 1 completado");
      break;

    case 2:
      Serial.println("[dispense] Motor 2 activado (FIDEOS)");
      activarMotor(MOTOR2_STEP, MOTOR2_DIR, MOTOR2_ENABLE, quantity);
      Serial.println("[dispense] ✓ Motor 2 completado");
      break;

    default:
      Serial.println("[dispense] ✗ ProductID no válido: " + String(productId));
      break;
  }

  motorsBusy = false;
  Serial.println("[dispense] ✓✓ Dispensación finalizada\n");
}

// ============================================
// ACTIVAR MOTOR STEPPER
// ============================================

void activarMotor(int stepPin, int dirPin, int enablePin, int pasos) {
  Serial.println("[motor] Activando motor: " + String(pasos) + " pasos");

  // Habilitar motor
  digitalWrite(enablePin, LOW);
  delay(100);

  // Establecer dirección
  digitalWrite(dirPin, HIGH);  // Cambiar a LOW si es necesario invertir dirección

  // Generar pulsos
  for (int i = 0; i < pasos * 200; i++) {  // 200 pasos por revolución (NEMA 17)
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(500);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(500);

    // Feedback cada 2000 pasos
    if ((i + 1) % 2000 == 0) {
      Serial.println("[motor]   Progreso: " + String((i + 1) / 200) + "/" + String(pasos) + " revoluciones");
    }
  }

  // Deshabilitar motor
  digitalWrite(enablePin, HIGH);
  delay(100);

  Serial.println("[motor] ✓ Motor detenido");
}

// ============================================
// LOOP PRINCIPAL
// ============================================

void loop() {
  // El servidor AsyncWeb maneja todo en background
  // Aquí solo agregamos monitoreo opcional

  delay(1000);

  // Mostrar estado cada 10 segundos
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 10000) {
    lastCheck = millis();

    Serial.println("\n[monitor] Estado del sistema:");
    Serial.println("  - IP: " + WiFi.localIP().toString());
    Serial.println("  - RSSI: " + String(WiFi.RSSI()) + " dBm");
    Serial.println("  - Motors Busy: " + String(motorsBusy ? "SÍ" : "NO"));
    Serial.println("  - Uptime: " + String(millis() / 1000) + "s\n");
  }
}

// ============================================
// CONFIGURACIÓN ALTERNATIVA: Velocidad Variable
// ============================================

// Descomenta la siguiente función si quieres velocidad ajustable
/*
void activarMotorVelocidad(int stepPin, int dirPin, int enablePin, int pasos, int speedDelay) {
  digitalWrite(enablePin, LOW);
  delay(100);

  digitalWrite(dirPin, HIGH);

  for (int i = 0; i < pasos * 200; i++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(speedDelay);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(speedDelay);
  }

  digitalWrite(enablePin, HIGH);
  delay(100);
}
*/

// ============================================
// PRUEBAS DESDE TERMINAL (para debugging)
// ============================================

/*

// Probar conexión:
curl http://192.168.18.14/status

// Dispensar 1 unidad de Arroz:
curl -X POST http://192.168.18.14/dispense \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 1}'

// Dispensar 2 unidades de Fideos:
curl -X POST http://192.168.18.14/dispense \
  -H "Content-Type: application/json" \
  -d '{"productId": 2, "quantity": 2}'

// Dispensar múltiples en secuencia:
for i in {1..5}; do
  curl -X POST http://192.168.18.14/dispense \
    -H "Content-Type: application/json" \
    -d "{\"productId\": 1, \"quantity\": 1}"
  sleep 2
done

*/

// ============================================
// NOTAS DE AJUSTE
// ============================================

/*
1. VELOCIDAD DE MOTOR:
   - Actual: 1000 microsegundos entre pulsos
   - Más rápido: Disminuir STEP_DELAY
   - Más lento: Aumentar STEP_DELAY

2. PASOS POR REVOLUCIÓN:
   - NEMA 17: 200 pasos (1.8° por paso)
   - Si usas otro motor: Cambiar en activarMotor()

3. PINES GPIO:
   - Reemplazar 12, 13, 14, 25, 26, 27 con pines libres en tu ESP32
   - Verificar compatibilidad con otros componentes

4. ALIMENTACIÓN:
   - Motor: Conectar a 12V separado (NO a 5V de ESP32)
   - Driver A4988: Conectar lógica a 3.3V del ESP32
   - Usar diodo de protección en el driver

5. DEBUGGING:
   - Conectar Serial Monitor a 115200 baud
   - Ver logs en tiempo real mientras se dispensa
*/
