#include <WiFi.h>
#include <WebServer.h>

// === CONFIGURACIÓN WIFI ===
const char* ssid = "CELERITY_DELGADO";
const char* password = "123queso";
WebServer server(80);

// === PINES MOTOR 1 (Producto 1) ===
const int STEP1_PIN = 33;
const int DIR1_PIN = 32;
const int ENABLE1_PIN = 18;

// === PINES MOTOR 2 (Producto 2) ===
const int STEP2_PIN = 35;
const int DIR2_PIN = 34;
const int ENABLE2_PIN = 19;

// === CONFIGURACIÓN DEL MOTOR ===
const int STEPS_PER_REV = 200;
const int MICROSTEPS = 1;
const int TOTAL_STEPS = STEPS_PER_REV * 2 * MICROSTEPS;
const int STEP_DELAY = 3000;  // Velocidad (ajusta según necesites)

// === PINES DE LED ===
const int LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Dispensador Dual ===");

  // Configurar pines MOTOR 1
  pinMode(STEP1_PIN, OUTPUT);
  pinMode(DIR1_PIN, OUTPUT);
  pinMode(ENABLE1_PIN, OUTPUT);
  
  // Configurar pines MOTOR 2
  pinMode(STEP2_PIN, OUTPUT);
  pinMode(DIR2_PIN, OUTPUT);
  pinMode(ENABLE2_PIN, OUTPUT);
  
  // LED de estado
  pinMode(LED_PIN, OUTPUT);

  // Deshabilitar motores al inicio (sin ruido)
  digitalWrite(ENABLE1_PIN, HIGH);
  digitalWrite(ENABLE2_PIN, HIGH);
  
  digitalWrite(DIR1_PIN, LOW);
  digitalWrite(DIR2_PIN, LOW);
  
  digitalWrite(STEP1_PIN, LOW);
  digitalWrite(STEP2_PIN, LOW);
  
  digitalWrite(LED_PIN, LOW);

  Serial.println("[OK] Motores DESHABILITADOS - Sin ruido");

  // Conectar WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[OK] WiFi conectado");
  Serial.print("[IP] ");
  Serial.println(WiFi.localIP());

  // === CONFIGURAR RUTAS HTTP ===
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleCORS);
  server.on("/blink", HTTP_POST, handleBlink);
  server.on("/blink", HTTP_OPTIONS, handleCORS);
  server.on("/dispense", HTTP_POST, handleDispense);
  server.on("/dispense", HTTP_OPTIONS, handleCORS);
  server.on("/test", HTTP_GET, handleTest);
  server.on("/test", HTTP_OPTIONS, handleCORS);
  
  // Manejar OPTIONS para CORS
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleCORS();
    } else {
      server.send(404, "text/plain", "Not Found");
    }
  });

  server.begin();
  Serial.println("[OK] Servidor HTTP iniciado");
  Serial.println("[STATUS] http://" + WiFi.localIP().toString() + "/status");
  Serial.println("[DISPENSE] http://" + WiFi.localIP().toString() + "/dispense");
  Serial.println("=============================\n");

  // Parpadeo de confirmación
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
}

void loop() {
  server.handleClient();
}

// === MANEJADOR: CORS Preflight ===
void handleCORS() {
  Serial.println("[CORS] OPTIONS request recibido");
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Max-Age", "86400");
  
  server.send(200, "text/plain", "");
}

// === MANEJADOR: Ruta raíz ===
void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  String html = "<!DOCTYPE html><html><body>";
  html += "<h1>ESP32 Dispensador Dual</h1>";
  html += "<p>IP: " + WiFi.localIP().toString() + "</p>";
  html += "<p>Estado: Operativo (2 Motores)</p>";
  html += "<button onclick=\"fetch('/test?motor=1')\">Probar Motor 1</button><br><br>";
  html += "<button onclick=\"fetch('/test?motor=2')\">Probar Motor 2</button>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

// === MANEJADOR: Estado del servidor ===
void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  Serial.println("[STATUS] GET /status");
  
  String response = "{";
  response += "\"status\":\"online\",";
  response += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  response += "\"ssid\":\"" + String(ssid) + "\",";
  response += "\"motors\":2,";
  response += "\"uptime\":" + String(millis());
  response += "}";
  
  server.send(200, "application/json", response);
}

// === MANEJADOR: Alias /blink (compatibilidad) ===
void handleBlink() {
  handleDispense();  // Redirige a handleDispense
}

// === MANEJADOR: Dispensar producto ===
void handleDispense() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"No data\"}");
    return;
  }

  String body = server.arg("plain");
  Serial.println("[DISPENSE] POST /dispense");
  Serial.println("[BODY] " + body);

  int productId = extractValue(body, "productId");
  int quantity = extractValue(body, "quantity");

  Serial.print("[INFO] Producto ID: ");
  Serial.print(productId);
  Serial.print(", Cantidad: ");
  Serial.println(quantity);

  // Validar parámetros
  if (productId < 1 || productId > 2 || quantity <= 0 || quantity > 10) {
    Serial.println("[ERROR] Parámetros inválidos\n");
    server.send(400, "application/json", "{\"error\":\"Invalid parameters. ProductId must be 1 or 2, quantity 1-10\"}");
    return;
  }

  // Activar LED
  digitalWrite(LED_PIN, HIGH);

  // Dispensar según producto
  for (int i = 0; i < quantity; i++) {
    Serial.print("[DISPENSA] Producto ");
    Serial.print(productId);
    Serial.print(" - ");
    Serial.print(i + 1);
    Serial.print("/");
    Serial.println(quantity);
    
    if (productId == 1) {
      dispenseProduct(1);  // Motor 1
    } else if (productId == 2) {
      dispenseProduct(2);  // Motor 2
    }

    if (i < quantity - 1) {
      delay(500);  // Pausa entre dispensaciones
    }
  }

  digitalWrite(LED_PIN, LOW);
  Serial.println("[OK] Dispensación completada\n");

  String response = "{";
  response += "\"success\":true,";
  response += "\"message\":\"Dispensación completada\",";
  response += "\"productId\":" + String(productId) + ",";
  response += "\"quantity\":" + String(quantity) + ",";
  response += "\"motor\":" + String(productId);
  response += "}";
  
  server.send(200, "application/json", response);
}

// === MANEJADOR: Prueba de motor ===
void handleTest() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  int motor = 1;  // Por defecto motor 1
  
  if (server.hasArg("motor")) {
    motor = server.arg("motor").toInt();
  }
  
  if (motor < 1 || motor > 2) {
    server.send(400, "application/json", "{\"error\":\"Motor must be 1 or 2\"}");
    return;
  }
  
  Serial.print("[TEST] Probando motor ");
  Serial.println(motor);
  
  digitalWrite(LED_PIN, HIGH);
  dispenseProduct(motor);
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("[OK] Prueba completada\n");
  
  String response = "{\"status\":\"test_ok\",\"motor\":" + String(motor) + "}";
  server.send(200, "application/json", response);
}

// === FUNCIÓN: Dispensar producto (selecciona motor) ===
void dispenseProduct(int motorNumber) {
  if (motorNumber == 1) {
    runMotor(ENABLE1_PIN, DIR1_PIN, STEP1_PIN, "Motor 1");
  } else if (motorNumber == 2) {
    runMotor(ENABLE2_PIN, DIR2_PIN, STEP2_PIN, "Motor 2");
  }
}

// === FUNCIÓN: Ejecutar motor ===
void runMotor(int enablePin, int dirPin, int stepPin, String motorName) {
  Serial.print("[MOTOR] Activando ");
  Serial.println(motorName);
  
  // Habilitar motor
  digitalWrite(enablePin, LOW);
  delay(100);

  // Establecer dirección
  digitalWrite(dirPin, HIGH);

  // Generar pulsos STEP
  for (int step = 0; step < TOTAL_STEPS; step++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(STEP_DELAY);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(STEP_DELAY);
  }

  // Deshabilitar motor (elimina ruido)
  digitalWrite(enablePin, HIGH);
  delay(100);
  
  Serial.print("[OK] ");
  Serial.print(motorName);
  Serial.println(" completado");
}

// === UTILIDAD: Extraer valor de JSON ===
int extractValue(String json, String key) {
  String searchKey = "\"" + key + "\":";
  int keyIndex = json.indexOf(searchKey);
  
  if (keyIndex == -1) return 0;
  
  int valueStart = keyIndex + searchKey.length();
  int valueEnd = json.indexOf(",", valueStart);
  
  if (valueEnd == -1) {
    valueEnd = json.indexOf("}", valueStart);
  }
  
  String valueStr = json.substring(valueStart, valueEnd);
  valueStr.trim();
  
  return valueStr.toInt();
}
