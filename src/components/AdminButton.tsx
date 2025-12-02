// src/components/AdminButton.tsx - ACTUALIZAR O CREAR

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

export function AdminButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/login')}
      className="fixed bottom-4 left-4 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 z-50"
      title="Acceso Administrador"
    >
      <Shield className="h-6 w-6" />
    </button>
  );
}
