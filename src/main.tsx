// src/main.tsx - VERSIÓN COMPLETA CON HERRAMIENTAS DE DEBUG

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDB } from './lib/inventory';
import { authService } from './lib/auth';
import { db } from './lib/db';

/**
 * Inicialización de la aplicación
 */
async function initializeApp() {
  try {
    console.log('[App] 🚀 Iniciando aplicación...');
    
    console.log('[App] 📊 Inicializando base de datos...');
    await initializeDB();
    console.log('[App] ✓ Base de datos inicializada correctamente');
    
    console.log('[App] 👤 Verificando usuario administrador...');
    await authService.createDefaultAdmin();
    console.log('[App] ✓ Usuario administrador verificado');
    
    console.log('[App] 🔐 Verificando sesión activa...');
    const user = await authService.checkSession();
    if (user) {
      console.log(`[App] ✓ Sesión activa: ${user.name} (${user.role})`);
    } else {
      console.log('[App] ℹ️ No hay sesión activa (modo invitado)');
    }
    
    console.log('[App] ✅ Aplicación inicializada correctamente\n');
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

// ✅ NUEVO: Exponer herramientas para pruebas (solo en desarrollo)
if (import.meta.env.DEV) {
  (window as any).db = db;
  (window as any).authService = authService;
  
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
      .then(r => console.log('✅ Login exitoso:', r.user.name)),
    
    // Logout rápido
    logout: () => authService.logout()
      .then(() => console.log('✅ Sesión cerrada')),
    
    // Ver usuario actual
    currentUser: () => {
      const user = authService.getCurrentUser();
      console.log(user ? `✅ Usuario: ${user.name} (${user.role})` : '❌ Sin sesión');
    }
  };
  
  console.log('🔧 [DEV] Herramientas de desarrollo disponibles:');
  console.log('   - db.getAll("users")');
  console.log('   - authService.login(email, password)');
  console.log('   - testAuth.users()');
  console.log('   - testAuth.sessions()');
  console.log('   - testAuth.logs()');
  console.log('   - testAuth.orders()');
  console.log('   - testAuth.loginAdmin()');
  console.log('   - testAuth.logout()');
  console.log('   - testAuth.currentUser()');
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
