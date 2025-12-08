// src/components/auth/UserMenu.tsx - NUEVO ARCHIVO

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Shield, Gift } from 'lucide-react';
import { authService } from '../../lib/auth';
import { useCart } from '../../context/CartContext';

export function UserMenu() {
  const { currentUser, isAuthenticated } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
      setIsOpen(false);
      navigate('/');
      window.location.reload(); // Recargar para actualizar el estado
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Botón de Usuario */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
          <User className="h-5 w-5 text-white" />
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
          <p className="text-xs text-gray-500">
            {currentUser.role === 'admin' ? 'Administrador' : 'Cliente'}
          </p>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="text-xs text-gray-500">{currentUser.email}</p>
          </div>

          {/* Puntos de Fidelidad */}
          {currentUser.role === 'customer' && (
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Gift className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm text-gray-700">Puntos</span>
                </div>
                <span className="text-sm font-bold text-indigo-600">
                  {currentUser.loyaltyPoints || 0}
                </span>
              </div>
            </div>
          )}

          {/* Admin Link */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => {
                navigate('/admin');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Shield className="h-4 w-4 mr-3 text-indigo-600" />
              Panel de Administración
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}
