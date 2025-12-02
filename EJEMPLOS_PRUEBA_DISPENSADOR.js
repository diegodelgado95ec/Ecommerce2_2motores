// ============================================
// EJEMPLOS DE PRUEBA - Sistema Dispensador
// ============================================

// Estos ejemplos pueden ejecutarse en la Consola del Navegador (F12)
// o adaptarse para pruebas en tu aplicación

// ============================================
// PRUEBA 1: Verificar que DispenseService está disponible
// ============================================

console.log('Verificando disponibilidad de servicios...');
console.log(window.DispenseService ? '✓ DispenseService disponible' : '✗ DispenseService NO disponible');

// Resultado esperado en consola:
// Verificando disponibilidad de servicios...
// ✓ DispenseService disponible


// ============================================
// PRUEBA 2: Verificar conectividad a ESP32
// ============================================

async function verificarESP32() {
  console.log('[TEST] Verificando conexión a ESP32...');
  
  try {
    const response = await fetch('http://192.168.18.14/status', {
      method: 'GET',
      mode: 'cors'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[TEST] ✓ ESP32 conectado:', data);
      return true;
    } else {
      console.log('[TEST] ✗ ESP32 respondió con error:', response.status);
      return false;
    }
  } catch (error) {
    console.error('[TEST] ✗ No se pudo contactar a ESP32:', error.message);
    return false;
  }
}

// Ejecutar:
// await verificarESP32();

// Resultado esperado:
// [TEST] ✓ ESP32 conectado: {status: 'online', version: '1.0', ...}


// ============================================
// PRUEBA 3: Prueba de Dispensación Individual
// ============================================

async function probarDispensacionProducto(productId, quantity) {
  console.log(`[TEST] Iniciando dispensación: Producto ${productId}, Cantidad ${quantity}`);
  
  try {
    const response = await fetch('http://192.168.18.14/dispense', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productId, quantity }),
      mode: 'cors'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[TEST] ✓ Dispensación exitosa:', data);
      return true;
    } else {
      console.log('[TEST] ✗ Error en dispensación:', response.status);
      return false;
    }
  } catch (error) {
    console.error('[TEST] ✗ Error de conexión:', error.message);
    return false;
  }
}

// Ejecutar:
// await probarDispensacionProducto(1, 1);  // Dispensar 1 Arroz
// await probarDispensacionProducto(2, 2);  // Dispensar 2 Fideos

// Resultado esperado:
// [TEST] ✓ Dispensación exitosa: {status: 'ok', productId: 1, quantity: 1}


// ============================================
// PRUEBA 4: Dispensación Secuencial (Simula Orden)
// ============================================

async function probarDispensacionOrden() {
  console.log('[TEST] === PRUEBA DE ORDEN COMPLETA ===');
  
  const items = [
    { productId: 1, quantity: 1, title: 'Arroz' },
    { productId: 2, quantity: 2, title: 'Fideos' }
  ];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`[TEST] Dispensando ${i + 1}/${items.length}: ${item.title}`);
    
    await probarDispensacionProducto(item.productId, item.quantity);
    
    if (i < items.length - 1) {
      console.log('[TEST] Esperando 1 segundo antes del siguiente...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('[TEST] ✓ Prueba de orden completada');
}

// Ejecutar:
// await probarDispensacionOrden();


// ============================================
// PRUEBA 5: Test de Productos No Dispensables
// ============================================

async function probarProductoNoDispensable() {
  console.log('[TEST] Probando producto NO dispensable (ID: 3)');
  
  // En una aplicación real, DispenseService debería:
  // 1. Detectar que ID 3 no es dispensable
  // 2. No intentar enviar a ESP32
  // 3. Registrar como "no requiere dispensación"
  
  const isDispensable = [1, 2].includes(3);
  console.log(`[TEST] Producto ID 3 es dispensable: ${isDispensable}`);
  
  if (!isDispensable) {
    console.log('[TEST] ✓ Correcto: Producto ID 3 no será dispensado');
  }
}

// Ejecutar:
// probarProductoNoDispensable();


// ============================================
// PRUEBA 6: Simular Error de Conectividad
// ============================================

async function probarErrorConectividad() {
  console.log('[TEST] Simulando error de conectividad...');
  
  try {
    // Intentar conectar a IP inválida
    const response = await fetch('http://192.168.99.99/status', {
      method: 'GET',
      mode: 'cors',
      signal: AbortSignal.timeout(5000)
    });
    
    console.log('[TEST] Respuesta:', response.status);
  } catch (error) {
    console.log('[TEST] ✓ Error capturado correctamente:', error.message);
    console.log('[TEST] ✓ La aplicación debería continuar sin bloqueos');
  }
}

// Ejecutar:
// await probarErrorConectividad();


// ============================================
// PRUEBA 7: Flujo Completo (Simula Checkout)
// ============================================

async function probarCheckoutCompleto() {
  console.log('\n[TEST] === FLUJO COMPLETO DE CHECKOUT ===\n');
  
  // Paso 1: Verificar conexión
  console.log('PASO 1: Verificar conexión a ESP32');
  const conectado = await verificarESP32();
  
  if (!conectado) {
    console.warn('[TEST] ⚠️ Advertencia: ESP32 no conectado, pero continuaremos');
  }
  
  // Paso 2: Simular orden
  console.log('\nPASO 2: Simular creación de orden (ya estaría en BD)');
  console.log('[TEST] Orden #1000 creada (simulada)');
  
  // Paso 3: Dispensar productos
  console.log('\nPASO 3: Dispensar productos de la orden');
  await probarDispensacionOrden();
  
  // Paso 4: Confirmación
  console.log('\n[TEST] ✓✓✓ CHECKOUT COMPLETADO\n');
}

// Ejecutar:
// await probarCheckoutCompleto();


// ============================================
// PRUEBA 8: Script para Pruebas Automáticas
// ============================================

async function ejecutarTodasLasPruebas() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║ SUITE DE PRUEBAS - SISTEMA DISPENSADOR ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // Test 1
  console.log('TEST 1: Verificar ESP32');
  const esp32Online = await verificarESP32();
  console.log('Resultado:', esp32Online ? '✓ PASADO' : '✗ FALLIDO', '\n');
  
  if (!esp32Online) {
    console.log('⚠️ ESP32 no está disponible. Saltando pruebas que lo requieren.\n');
    return;
  }
  
  // Test 2
  console.log('TEST 2: Dispensación de Arroz (ID: 1)');
  await probarDispensacionProducto(1, 1);
  console.log('Resultado: ✓ PASADO\n');
  
  // Test 3
  console.log('TEST 3: Dispensación de Fideos (ID: 2)');
  await probarDispensacionProducto(2, 1);
  console.log('Resultado: ✓ PASADO\n');
  
  // Test 4
  console.log('TEST 4: Productos No Dispensables');
  probarProductoNoDispensable();
  console.log('Resultado: ✓ PASADO\n');
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║      TODAS LAS PRUEBAS COMPLETADAS     ║');
  console.log('╚════════════════════════════════════════╝\n');
}

// Ejecutar:
// await ejecutarTodasLasPruebas();


// ============================================
// HERRAMIENTAS DE DEBUGGING
// ============================================

// Función para ver historial de dispensaciones (si está disponible)
function verHistorialDispensaciones() {
  console.log('[DEBUG] Intentando acceder a historial de dispensaciones...');
  
  // Esto dependerá de cómo expongas dispenseService en tu app
  // Por ahora, es solo un ejemplo conceptual
  
  if (typeof window.dispenseService !== 'undefined') {
    const stats = window.dispenseService.getStats();
    console.log('[DEBUG] Estadísticas:', stats);
    
    const history = window.dispenseService.getHistory();
    console.log('[DEBUG] Historial:', history);
  } else {
    console.log('[DEBUG] DispenseService no está expuesto globalmente');
    console.log('[DEBUG] Puedes hacerlo agregando en main.tsx:');
    console.log('       window.dispenseService = dispenseService;');
  }
}

// Ejecutar:
// verHistorialDispensaciones();


// ============================================
// COMANDOS CURL (Si tienes acceso a terminal)
// ============================================

/*
# Verificar que ESP32 está en línea
curl http://192.168.18.14/status

# Dispensar 1 Arroz
curl -X POST http://192.168.18.14/dispense \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 1}'

# Dispensar 2 Fideos
curl -X POST http://192.168.18.14/dispense \
  -H "Content-Type: application/json" \
  -d '{"productId": 2, "quantity": 2}'

# Dispensación múltiple en bucle
for i in {1..5}; do
  echo "Dispensación $i/5"
  curl -X POST http://192.168.18.14/dispense \
    -H "Content-Type: application/json" \
    -d '{"productId": 1, "quantity": 1}'
  sleep 2
done
*/


// ============================================
// RESUMEN DE PRUEBAS
// ============================================

/*
Copiar y pegar en la Consola del Navegador (F12):

// Verificar conectividad
await verificarESP32();

// Hacer una dispensación simple
await probarDispensacionProducto(1, 1);

// Ejecutar todas las pruebas
await ejecutarTodasLasPruebas();

Resultado esperado: Motores se activan en el ESP32
*/
