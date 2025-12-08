// src/main.tsx - CON LOGGER Y SERVICIOS EXPUESTOS

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDB } from './lib/inventory';
import { authService } from './lib/auth';
import { db } from './lib/db';
import { dispenseService } from './services/DispenseService';
import { loginLimiter, registerLimiter, orderLimiter, getAllRateLimitStats, resetAllLimiters } from './lib/securityMiddleware';
import logger from './lib/logger'; // ✅ IMPORTAR LOGGER
import { stockService } from './services/StockService'; // ✅ IMPORTAR STOCK SERVICE
import { loyaltyService } from './services/LoyaltyService'; // ✅ IMPORTAR LOYALTY SERVICE

/**
 * Inicialización de la aplicación
 */
async function initializeApp() {
  try {
    logger.log('[App] 🚀 Iniciando aplicación...');
    
    logger.log('[App] 📊 Inicializando base de datos...');
    await initializeDB();
    logger.log('[App] ✓ Base de datos inicializada correctamente');
    
    logger.log('[App] 👤 Verificando usuario administrador...');
    await authService.createDefaultAdmin();
    logger.log('[App] ✓ Usuario administrador verificado');
    
    logger.log('[App] 🔐 Verificando sesión activa...');
    const user = await authService.checkSession();
    if (user) {
      logger.log(`[App] ✓ Sesión activa: ${user.name} (${user.role})`);
    } else {
      logger.log('[App] ℹ️ No hay sesión activa (modo invitado)');
    }
    
    logger.log('[App] ✅ Aplicación inicializada correctamente\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('📦 SISTEMA DE VENDING MACHINE - LISTO PARA USAR');
    console.log('═══════════════════════════════════════════════════');
    console.log('👥 Modo Cliente: Compra directa sin login');
    console.log('🔑 Admin por defecto:');
    console.log('   Email: admin@store.local');
    console.log('   Password: Admin123!');
    console.log('═══════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ [App] Error fatal al inicializar la aplicación:', error);
    throw error;
  }
}

// ✅ Exponer herramientas para pruebas (solo en desarrollo)
if (import.meta.env.DEV) {
  (window as any).db = db;
  (window as any).authService = authService;
  (window as any).dispenseService = dispenseService;
  
  // ✅ Exponer rate limiters
  (window as any).loginLimiter = loginLimiter;
  (window as any).registerLimiter = registerLimiter;
  (window as any).orderLimiter = orderLimiter;
  (window as any).getAllRateLimitStats = getAllRateLimitStats;
  (window as any).resetAllLimiters = resetAllLimiters;
  
  // ✅ NUEVO: Exponer logger
  (window as any).logger = logger;
  
  // ✅ NUEVO: Exponer servicios SRP
  (window as any).stockService = stockService;
  (window as any).loyaltyService = loyaltyService;
  
  // Helper functions para pruebas rápidas
  (window as any).testAuth = {
    // Ver usuarios
    users: () => db.getAll('users').then(u => console.table(u)),
    
    // Ver sesiones
    sessions: () => db.getAll('sessions').then(s => console.table(s)),
    
    // Ver logs
    logs: () => db.getAll('access_logs').then(l => console.table(l)),
    
    // Ver órdenes
    orders: () => db.getAll('orders').then(o => console.table(o)),
    
    // Login rápido como admin
    loginAdmin: () => authService.login('admin@store.local', 'Admin123!')
      .then(r => logger.log('✅ Login exitoso:', r.user.name)),
    
    // Logout rápido
    logout: () => authService.logout()
      .then(() => logger.log('✅ Sesión cerrada')),
    
    // Ver usuario actual
    currentUser: () => {
      const user = authService.getCurrentUser();
      console.log(user ? `✅ Usuario: ${user.name} (${user.role})` : '❌ Sin sesión');
    },
    
    // Pruebas de dispensación
    testDispense: async (productId: number, quantity: number) => {
      logger.log(`🧪 Probando dispensación: Producto ${productId}, Cantidad ${quantity}`);
      const result = await dispenseService.dispenseProduct(productId, quantity, `Producto ${productId}`);
      console.log('Resultado:', result);
      return result;
    },
    
    // Ver estado de rate limiting
    rateLimitStatus: (email: string) => {
      console.log('\n🔒 ESTADO DE RATE LIMITING');
      console.log('──────────────────────────────');
      
      // Login stats
      const loginStats = loginLimiter.getStats(email);
      const loginRemaining = loginStats.maxRequests - loginStats.requests;
      console.log(`Login (${email}):`);
      console.log(`  Intentos restantes: ${loginRemaining}/${loginStats.maxRequests}`);
      console.log(`  Bloqueado: ${loginStats.isLocked ? '🔴 SÍ' : '🟢 NO'}`);
      if (loginStats.isLocked && loginStats.remainingMs) {
        console.log(`  Se desbloquea en: ${Math.ceil(loginStats.remainingMs / 1000)}s`);
      }
      
      // Register stats
      const registerStats = registerLimiter.getStats(email);
      const registerRemaining = registerStats.maxRequests - registerStats.requests;
      console.log(`\nRegistro (${email}):`);
      console.log(`  Intentos restantes: ${registerRemaining}/${registerStats.maxRequests}`);
      console.log(`  Bloqueado: ${registerStats.isLocked ? '🔴 SÍ' : '🟢 NO'}`);
      if (registerStats.isLocked && registerStats.remainingMs) {
        console.log(`  Se desbloquea en: ${Math.ceil(registerStats.remainingMs / 1000)}s`);
      }
      
      console.log('──────────────────────────────\n');
      
      return { login: loginStats, register: registerStats };
    },
    
    // Desbloquear usuario manualmente
    unblock: (email: string) => {
      loginLimiter.unlock(email);
      registerLimiter.unlock(email);
      console.log(`✅ Usuario ${email} desbloqueado manualmente`);
    },
    
    // Ver historial de dispensaciones
    dispenseHistory: () => {
      const history = dispenseService.getHistory();
      console.log('\n📦 HISTORIAL DE DISPENSACIONES');
      console.log('──────────────────────────────');
      console.table(history);
      console.log('──────────────────────────────\n');
      return history;
    },
    
    // Ver estadísticas de dispensaciones
    dispenseStats: () => {
      const stats = dispenseService.getStats();
      console.log('\n📊 ESTADÍSTICAS DE DISPENSACIONES');
      console.log('──────────────────────────────────');
      console.log(`Total de dispensaciones: ${stats.total}`);
      console.log(`Exitosas: ${stats.successful} (🟢)`);
      console.log(`Fallidas: ${stats.failed} (🔴)`);
      console.log(`Omitidas: ${stats.skipped} (⚪)`);
      console.log(`Tasa de éxito: ${stats.successRate}%`);
      console.log('──────────────────────────────────\n');
      return stats;
    }
  };
  
  console.log('🔧 [DEV] Herramientas de desarrollo disponibles:');
  console.log('\n📂 BASE DE DATOS:');
  console.log('   - db.getAll("users")');
  console.log('   - testAuth.users()');
  console.log('   - testAuth.sessions()');
  console.log('   - testAuth.orders()');
  console.log('   - testAuth.logs()');
  
  console.log('\n🔐 AUTENTICACIÓN:');
  console.log('   - authService.login(email, password)');
  console.log('   - testAuth.loginAdmin()');
  console.log('   - testAuth.logout()');
  console.log('   - testAuth.currentUser()');
  
  console.log('\n🛡️ RATE LIMITING:');
  console.log('   - loginLimiter.getStats("email@example.com")');
  console.log('   - testAuth.rateLimitStatus("email@example.com")');
  console.log('   - testAuth.unblock("email@example.com")');
  console.log('   - getAllRateLimitStats()');
  console.log('   - resetAllLimiters()  // Solo DEV');
  
  console.log('\n📦 DISPENSACIÓN:');
  console.log('   - dispenseService.dispenseProduct(id, qty)');
  console.log('   - testAuth.testDispense(productId, quantity)');
  console.log('   - testAuth.dispenseHistory()');
  console.log('   - testAuth.dispenseStats()');
  
  console.log('\n📝 LOGGER (NUEVO):');
  console.log('   - logger.log("mensaje")         // Solo en DEV');
  console.log('   - logger.error("error")         // Siempre visible');
  console.log('   - logger.warn("warning")        // Siempre visible');
  console.log('   - logger.isDev()                // Verificar modo');
  
  console.log('\n🧱 SERVICIOS SRP (NUEVO):');
  console.log('   - stockService.validateStockAvailability(items)');
  console.log('   - stockService.updateProductStock(product, qty, type, note)');
  console.log('   - loyaltyService.calculatePointsEarned(total)');
  console.log('   - loyaltyService.addPointsToUser(user, total)');
  console.log('');
}

// Inicializar y renderizar
initializeApp()
  .then(() => {
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      throw new Error('No se encontró el elemento root en el DOM');
    }
    
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((error) => {
    console.error('Error crítico:', error);
    
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: system-ui, -apple-system, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          padding: 20px;
        ">
          <div style="
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          ">
            <h1 style="font-size: 48px; margin: 0 0 20px 0;">⚠️</h1>
            <h2 style="margin: 0 0 16px 0;">Error de Inicialización</h2>
            <p style="margin: 0 0 24px 0; opacity: 0.9;">
              No se pudo inicializar la aplicación correctamente.
            </p>
            <details style="
              text-align: left;
              background: rgba(0, 0, 0, 0.2);
              padding: 16px;
              border-radius: 8px;
              font-size: 14px;
              font-family: monospace;
            ">
              <summary style="cursor: pointer; margin-bottom: 8px; font-weight: bold;">
                Ver detalles técnicos
              </summary>
              <pre style="margin: 0; overflow-x: auto;">${error instanceof Error ? error.message : String(error)}</pre>
            </details>
            <button 
              onclick="window.location.reload()" 
              style="
                margin-top: 24px;
                padding: 12px 32px;
                background: white;
                color: #667eea;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s;
              "
              onmouseover="this.style.transform='scale(1.05)'"
              onmouseout="this.style.transform='scale(1)'"
            >
              🔄 Reintentar
            </button>
          </div>
        </div>
      `;
    }
  });
