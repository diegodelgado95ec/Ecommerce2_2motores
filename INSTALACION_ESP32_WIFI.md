# 🔧 Instalación ESP32 con WiFi - Solución CORS

## 🚨 PROBLEMA ACTUAL
```
Access to fetch at 'http://10.119.11.136/status' from origin 'http://localhost:5173' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

**Tu ESP32 actual NO tiene servidor HTTP con soporte CORS.**

---

## ✅ SOLUCIÓN

He creado un nuevo código Arduino completamente funcional: **`ESP32_WiFi_Version.ino`**

### Características:
- ✓ Servidor HTTP en puerto 80
- ✓ Headers CORS correctos en todas las respuestas
- ✓ Endpoints `/status`, `/blink`, `/health`
- ✓ Manejo JSON con ArduinoJson
- ✓ Control de motor NEMA17 exactamente igual
- ✓ Reconexión WiFi automática
- ✓ Serial debug para diagnosticar problemas

---

## 📥 INSTALACIÓN PASO A PASO

### 1️⃣ Instalar Librerías en Arduino IDE

Abre Arduino IDE → Sketch → Include Library → Manage Libraries

Busca e instala:
- **ArduinoJson** (por Benoit Blanchon) - versión 6.x
- **WebServer** (ya incluida en ESP32 core)
- **WiFi** (ya incluida en ESP32 core)

### 2️⃣ Configurar Arduino IDE para ESP32

Si NO tienes ESP32 configurado:

**Archivo → Preferencias**
- Agrega esta URL en "URLs adicionales de Gestor de tarjetas":
  ```
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
  ```

**Herramientas → Placa → Gestor de tarjetas**
- Busca "esp32"
- Instala "ESP32 by Espressif Systems"

**Herramientas - Selecciona:**
- **Placa**: ESP32-WROOM-32
- **Upload Speed**: 921600
- **CPU Frequency**: 80 MHz
- **Flash Mode**: DIO
- **Flash Frequency**: 40MHz
- **Flash Size**: 4MB
- **Partition Scheme**: Default 4MB with spiffs
- **Core Debug Level**: Info
- **Port**: COMx (donde esté tu ESP32)

### 3️⃣ Configurar WiFi en el Código

Abre **`ESP32_WiFi_Version.ino`** y busca:

```cpp
const char* ssid = "TU_SSID";           // REEMPLAZA CON TU SSID
const char* password = "TU_PASSWORD";   // REEMPLAZA CON TU PASSWORD
```

**Reemplaza con TUS datos de WiFi:**
```cpp
const char* ssid = "Mi_Red_WiFi";
const char* password = "miContraseña123";
```

### 4️⃣ Cargar el Código

1. Abre `ESP32_WiFi_Version.ino` en Arduino IDE
2. **Sketch → Subir** (o Ctrl+U)
3. Espera a que se cargue (tardará ~10 segundos)

### 5️⃣ Ver Serial Monitor para Confirmar

- **Herramientas → Monitor Serial**
- **Velocidad**: 115200 baud
- Deberías ver:
```
=== ESP32 MOTOR CONTROL ===
Inicializando pines...
✓ Pines configurados
Conectando a WiFi: Mi_Red_WiFi
.....
✓ WiFi conectado
IP: 10.119.11.136
✓ Servidor HTTP iniciado en puerto 80
```

---

## ⚠️ IMPORTANTE: Verificación de Pines

El código usa estos pines GPIO del ESP32:
```
STEP_PIN = GPIO18
DIR_PIN = GPIO19
ENABLE_PIN = GPIO21
```

**Verifica que coincidan con tu hardware:**
- Si usas otros pines, modifica estas líneas:
```cpp
const int STEP_PIN = 18;      // Cambia si es diferente
const int DIR_PIN = 19;       // Cambia si es diferente
const int ENABLE_PIN = 21;    // Cambia si es diferente
```

---

## 🧪 Pruebas de Conexión

### Test 1: Desde el Navegador
1. Abre: `http://10.119.11.136/status`
2. Debería responder:
```json
{
  "status": "online",
  "motorRunning": false,
  "uptime": 12345,
  "ip": "10.119.11.136"
}
```

### Test 2: Desde DevTools Console
```javascript
// Verificar CORS
fetch('http://10.119.11.136/status', {
  method: 'GET',
  mode: 'cors'
})
.then(r => r.json())
.then(data => console.log('✓ CORS OK:', data))
.catch(err => console.error('✗ Error:', err));
```

### Test 3: Dispensar Producto
```javascript
fetch('http://10.119.11.136/blink', {
  method: 'POST',
  mode: 'cors',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId: 1, quantity: 3 })
})
.then(r => r.json())
.then(data => console.log('✓ Dispensado:', data))
.catch(err => console.error('✗ Error:', err));
```

### Test 4: Health Check
```
http://10.119.11.136/health
```

---

## 🔍 Solución de Problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| `Connection refused` | Puerto 80 no abierto | Reinicia ESP32 con el código cargado |
| No conecto a WiFi | SSID/Password incorrectos | Verifica en Monitor Serial, corrige y recarga |
| `404 Not Found` | Endpoints no existen | Verifica que el nuevo código esté cargado |
| Still CORS error | Headers CORS no se envían | El código nuevo debe estar cargado, recarga ESP32 |
| Puerto COM no aparece | Driver USB no instalado | Instala CH340 driver (si tu ESP32 lo usa) |

---

## 📝 Cambios en el Lado React (YA HECHO)

El `.env` ya tiene la IP correcta:
```env
VITE_ESP32_IP=http://10.119.11.136
```

El `LedService.ts` ya está optimizado con:
- ✓ Timeout de 5 segundos
- ✓ Manejo de CORS
- ✓ Logging detallado
- ✓ Endpoints correctos

---

## 📋 Checklist Final

- [ ] Instalé ArduinoJson desde Gestor de Librerías
- [ ] Configuré Arduino IDE para ESP32
- [ ] Reemplacé "TU_SSID" y "TU_PASSWORD" con mis datos
- [ ] Cargué el código `ESP32_WiFi_Version.ino`
- [ ] Vi en Serial Monitor: "✓ WiFi conectado"
- [ ] Probé `http://10.119.11.136/status` en navegador
- [ ] Probé los fetch() en DevTools Console
- [ ] El motor funciona con el app React

---

## 🆘 Si Aún No Funciona

Proporciona en consola:
1. **Output completo del Serial Monitor** (desde el boot hasta los errores)
2. **Errores exactos en DevTools Console** (captura de pantalla o texto)
3. **IP real del ESP32** (confirma que es 10.119.11.136)
4. **¿Responde `http://10.119.11.136/status` en el navegador?** (Sí/No)

Con esa info podré diagnosticar el problema exacto.

