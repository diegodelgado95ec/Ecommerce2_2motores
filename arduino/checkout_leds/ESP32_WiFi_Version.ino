/*
  ESP32 WiFi Control para Banda Transportadora
  Motor NEMA17 + Driver A4988/DRV8825
  Con servidor HTTP y soporte CORS
*/

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// ========== CONFIGURACIÓN WiFi ==========
const char* ssid = "TU_SSID";           // REEMPLAZA CON TU SSID
const char* password = "TU_PASSWORD";   // REEMPLAZA CON TU PASSWORD

// ========== CONFIGURACIÓN PINES ESP32 ==========
const int STEP_PIN = 18;      // GPIO18 - Pin STEP del driver
const int DIR_PIN = 19;       // GPIO19 - Pin DIR del driver
const int ENABLE_PIN = 21;    // GPIO21 - Pin ENABLE del driver (LOW = habilitado)

// ========== CONFIGURACIÓN MOTOR ==========
const int STEPS_PER_REV = 200;           // Pasos por revolución NEMA17
const int MICROSTEPS = 1;                // Microstepping (1 = full-step)
const int TOTAL_STEPS = STEPS_PER_REV * 2 * MICROSTEPS;  // 2 vueltas = 400 pasos
const int STEP_DELAY = 2500;             // Microsegundos entre pulsos (total 2000ms)

// ========== VARIABLES DE ESTADO ==========
WebServer server(80);
volatile bool motorRunning = false;
unsigned long lastCommandTime = 0;

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== ESP32 MOTOR CONTROL ===");
  Serial.println("Inicializando pines...");
  
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);

  digitalWrite(ENABLE_PIN, HIGH);  // Motor deshabilitado al inicio
  digitalWrite(DIR_PIN, LOW);
  digitalWrite(STEP_PIN, LOW);

  Serial.println("✓ Pines configurados");

  // Conectar WiFi
  connectToWiFi();

  // Configurar endpoints HTTP
  setupServerRoutes();

  Serial.println("✓ Sistema listo");
}

// ========== CONEXIÓN WIFI ==========
void connectToWiFi() {
  Serial.print("Conectando a WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi conectado");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ Error de conexión WiFi");
  }
}

// ========== RUTAS DEL SERVIDOR HTTP ==========
void setupServerRoutes() {
  // OPTIONS para CORS preflight
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      sendCORSHeaders();
      server.send(200);
      return;
    }
  });

  // GET /status - Verificar estado
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, []() {
    sendCORSHeaders();
    server.send(200);
  });

  // POST /blink - Dispensar producto
  server.on("/blink", HTTP_POST, handleBlink);
  server.on("/blink", HTTP_OPTIONS, []() {
    sendCORSHeaders();
    server.send(200);
  });

  // GET /health - Health check
  server.on("/health", HTTP_GET, []() {
    sendCORSHeaders();
    server.sendHeader("Content-Type", "application/json");
    server.send(200, "application/json", 
      "{\"status\":\"online\",\"uptime\":" + String(millis()) + "}");
  });

  server.begin();
  Serial.println("✓ Servidor HTTP iniciado en puerto 80");
}

// ========== HANDLERS HTTP ==========

void handleStatus() {
  sendCORSHeaders();
  
  StaticJsonDocument<200> doc;
  doc["status"] = "online";
  doc["motorRunning"] = motorRunning;
  doc["uptime"] = millis();
  doc["ip"] = WiFi.localIP().toString();

  String response;
  serializeJson(doc, response);

  server.sendHeader("Content-Type", "application/json");
  server.send(200, "application/json", response);

  Serial.println("[STATUS] Consulta recibida");
}

void handleBlink() {
  sendCORSHeaders();

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"No payload\"}");
    return;
  }

  String payload = server.arg("plain");
  Serial.println("[BLINK] Payload recibido: " + payload);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    server.send(400, "application/json", "{\"error\":\"JSON inválido\"}");
    Serial.println("[BLINK] Error JSON: " + String(error.c_str()));
    return;
  }

  int productId = doc["productId"] | -1;
  int quantity = doc["quantity"] | 0;

  if (productId < 1 || quantity < 1) {
    server.send(400, "application/json", 
      "{\"error\":\"productId y quantity requeridos\"}");
    return;
  }

  Serial.print("[BLINK] Dispensando producto ");
  Serial.print(productId);
  Serial.print(" x ");
  Serial.println(quantity);

  // Dispensar de forma no-bloqueante (opcional: usar multitarea)
  for (int i = 0; i < quantity; i++) {
    dispenseProduct();
    if (i < quantity - 1) {
      delay(500);
    }
  }

  StaticJsonDocument<200> response;
  response["success"] = true;
  response["message"] = "Dispensación completada";
  response["productId"] = productId;
  response["quantity"] = quantity;

  String responseStr;
  serializeJson(response, responseStr);

  server.sendHeader("Content-Type", "application/json");
  server.send(200, "application/json", responseStr);

  Serial.println("[BLINK] ✓ Dispensación completada");
}

// ========== ENVIAR HEADERS CORS ==========
void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Max-Age", "3600");
}

// ========== CONTROL DEL MOTOR ==========
void dispenseProduct() {
  motorRunning = true;

  // Habilitar motor
  digitalWrite(ENABLE_PIN, LOW);
  delay(100);

  // Dirección horaria
  digitalWrite(DIR_PIN, HIGH);

  // 2 vueltas completas (400 pasos)
  for (int step = 0; step < TOTAL_STEPS; step++) {
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(STEP_DELAY);
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(STEP_DELAY);
  }

  // Deshabilitar motor
  digitalWrite(ENABLE_PIN, HIGH);
  delay(100);

  motorRunning = false;
}

// ========== LOOP PRINCIPAL ==========
void loop() {
  server.handleClient();
  
  // Optional: reconectar WiFi si se desconecta
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Reconectando...");
    connectToWiFi();
  }
}
