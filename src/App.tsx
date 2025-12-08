// src/App.tsx - Con protecciones de seguridad

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { Dashboard } from './components/admin/Dashboard';
import { AdminLogin } from './components/AdminLogin';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InactivityTimeout } from './components/InactivityTimeout';
import { CartProvider } from './context/CartContext';
import { useDevToolsDetector, useDisableDevToolsKeys } from './hooks/useDevToolsDetector';

function App() {
  // ✅ Activar detector de DevTools (solo en producción)
  useDevToolsDetector();
  
  // ✅ Deshabilitar teclas de acceso a DevTools
  useDisableDevToolsKeys();

  return (
    <CartProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        {/* ✅ Timeout de inactividad (2 minutos) */}
        <InactivityTimeout 
          timeoutMs={120000}   // 2 minutos
          warningMs={90000}    // Advertencia a los 90s
          enabled={true}       // Siempre activo
        />

        <Routes>
          {/* Ruta pública: tienda */}
          <Route path="/" element={<MainLayout />} />
          
          {/* Ruta pública: login de admin */}
          <Route path="/login" element={<AdminLogin />} />
          
          {/* ✅ Ruta protegida: panel admin (requiere login + rol admin) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
