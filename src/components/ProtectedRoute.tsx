// src/components/ProtectedRoute.tsx - NUEVO ARCHIVO

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await authService.checkSession();
      
      if (!user) {
        console.log('[ProtectedRoute] No hay sesión activa');
        setIsAuthenticated(false);
        return;
      }

      console.log('[ProtectedRoute] Usuario autenticado:', user.name, user.role);
      setIsAuthenticated(true);
      setIsAdmin(user.role === 'admin');
    } catch (error) {
      console.error('[ProtectedRoute] Error checking auth:', error);
      setIsAuthenticated(false);
    }
  };

  // Mientras carga, mostrar loading
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Redirigiendo a /login - no autenticado');
    return <Navigate to="/login" replace />;
  }

  // Si requiere admin pero no es admin, redirigir a home
  if (requireAdmin && !isAdmin) {
    console.log('[ProtectedRoute] Redirigiendo a / - no es admin');
    return <Navigate to="/" replace />;
  }

  // Si todo está bien, mostrar el componente
  return <>{children}</>;
}
