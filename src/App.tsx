// src/App.tsx - ACTUALIZAR

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { Dashboard } from './components/admin/Dashboard';
import { AdminLogin } from './components/AdminLogin';
import { ProtectedRoute } from './components/ProtectedRoute'; // ✅ IMPORTAR
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
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
