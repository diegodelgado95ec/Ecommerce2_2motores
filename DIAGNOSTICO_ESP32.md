# 🔧 Diagnóstico de Conexión ESP32 - LedService

## Problema Identificado
El navegador (desde donde corre la aplicación React) no puede conectarse al ESP32 mediante requests HTTP con CORS habilitado.

---

## ✅ Checklist de Diagnóstico

### 1️⃣ Verificar Conectividad Básica
```bash
# Abre PowerShell y ejecuta:
ping 10.119.11.136

# Si responde, la red está OK
```

### 2️⃣ Verificar Endpoints del ESP32
```bash
# Abre la URL en el navegador:
http://10.119.11.136/status

# Debería responder algo como:
# {"status":"online"}
# o
# {"status":"ready"}
```

### 3️⃣ Verificar Consola del Navegador
1. Abre la app React en `http://localhost:5173`
2. Presiona `F12` para abrir Developer Tools
3. Ve a la pestaña **Console**
4. Intenta conectar y busca estos logs:
   - ✓ `[LedService] Inicializando con IP: http://10.119.11.136`
   - ✓ `[LedService] Verificando conexión ESP32 en: http://10.119.11.136`
   - Observa si hay errores de CORS o timeout

---

## 🛠️ Configuración Requerida en el ESP32

Si el problema es **CORS**, el ESP32 necesita estos headers en TODAS las respuestas:

### Código Arduino que DEBE estar en tu ESP32:
```cpp
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);

// ENDPOINTS REQUERIDOS
void handleStatus() {
  // CORS headers
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (server.method() == HTTP_OPTIONS) {
    server.send(200);
    return;
  }

  server.sendHeader("Content-Type", "application/json");
  server.send(200, "application/json", "{\"status\":\"online\"}");
}

void handleBlink() {
  // CORS headers
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (server.method() == HTTP_OPTIONS) {
    server.send(200);
    return;
  }

  String payload = server.arg("plain");
  // Aquí procesas: DynamicJsonDocument doc(1024);
  
  server.sendHeader("Content-Type", "application/json");
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Comando recibido\"}");
}

// En setup():
void setup() {
  // ... tu código WiFi ...
  
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleStatus);
  
  server.on("/blink", HTTP_POST, handleBlink);
  server.on("/blink", HTTP_OPTIONS, handleBlink);
  
  server.begin();
}
```

---

## 📋 Requisitos Mínimos del ESP32

**Debe tener estos endpoints:**
- `GET /status` → Responde `{"status":"online"}`
- `POST /blink` → Recibe JSON `{productId, quantity}` y responde `{"success":true}`

**Cada respuesta debe incluir:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 🔍 Paso a Paso para Probar

### A. Probar directamente en el navegador
```javascript
// Abre DevTools (F12), Console, y copia esto:

// Test 1: Verificar conexión
fetch('http://10.119.11.136/status', {
  method: 'GET',
  mode: 'cors'
})
.then(r => r.json())
.then(console.log)
.catch(console.error);

// Test 2: Enviar comando (espera 2 segundos después del Test 1)
fetch('http://10.119.11.136/blink', {
  method: 'POST',
  mode: 'cors',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId: 1, quantity: 5 })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### B. Probar con cURL (PowerShell)
```powershell
# Test 1
Invoke-WebRequest -Uri "http://10.119.11.136/status" -Method GET

# Test 2
$body = @{productId=1; quantity=5} | ConvertTo-Json
Invoke-WebRequest -Uri "http://10.119.11.136/blink" -Method POST -Body $body -ContentType "application/json"
```

---

## 🚨 Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `CORS error` | ESP32 no envía headers CORS | Agrega los 3 headers en cada respuesta |
| `Connection refused` | Puerto 80 no abierto en ESP32 | Verifica que `WebServer server(80)` esté en setup |
| `timeout` | ESP32 no responde en 5 seg | Aumenta timeout o revisa WiFi del ESP32 |
| `404 Not Found` | Endpoint no existe | Verifica que `/status` y `/blink` existan |
| `IP incorrecta` | Estás usando otra IP | Mira el Serial Monitor al iniciar ESP32 |

---

## 📝 Variables de Entorno Actualizadas

**Archivo `.env`:**
```env
VITE_ESP32_IP=http://10.119.11.136
```

**Cambios en el código (YA REALIZADOS):**
- ✅ `LedService.ts` → Añadido timeout de 5 segundos y mejor logging
- ✅ `led-manager.ts` → Corregida instanciación de ledService
- ✅ Timeout en ambos endpoints
- ✅ Logs mejorados con emojis (✓, ✗)

---

## 🎯 Próximos Pasos Recomendados

1. **Verifica la IP del ESP32**
   - Abre Arduino IDE → Monitor Serial
   - Busca el mensaje "IP: 10.xxx.xxx.xxx"

2. **Confirma CORS en Arduino**
   - Si te falta, copia el código de arriba en tu sketch

3. **Prueba los fetch() en Console**
   - Abre DevTools y ejecuta los comandos de prueba

4. **Revisa los logs de LedService**
   - Busca `[LedService]` en la consola del navegador

5. **Si sigue sin funcionar**
   - ¿Responde `/status` en navegador? → Problema de CORS o endpoint
   - ¿No responde? → Problema de red o IP incorrecta
   - ¿Responde pero devuelve error? → Problema en el código Arduino

