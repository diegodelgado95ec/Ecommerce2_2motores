// src/components/UserAccount.tsx - NUEVO ARCHIVO COMPLETO

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Shield, Gift, Mail, Lock, UserPlus, AlertCircle } from 'lucide-react';
import { authService } from '../lib/auth';
import { useCart } from '../context/CartContext';

type AuthView = 'login' | 'register';

export function UserAccount() {
  const { currentUser, isAuthenticated } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Estados para login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Estados para registro
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

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
      window.location.reload();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      console.log('[UserAccount] Intentando login:', loginEmail);
      
      const result = await authService.login(loginEmail, loginPassword);
      
      console.log('[UserAccount] Login exitoso:', result.user.name);
      
      // Cerrar modal y recargar
      setShowAuthModal(false);
      setLoginEmail('');
      setLoginPassword('');
      window.location.reload();
    } catch (err) {
      console.error('[UserAccount] Error en login:', err);
      setLoginError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterLoading(true);

    try {
      console.log('[UserAccount] Registrando usuario:', registerEmail);
      
      // Registrar como CLIENTE (no admin)
      await authService.register(
        registerEmail,
        registerPassword,
        registerName,
        'customer', // ✅ ROL: customer
        registerPhone || undefined
      );
      
      console.log('[UserAccount] Registro exitoso');
      
      // Mostrar mensaje de éxito
      setRegisterSuccess(true);
      
      // Limpiar formulario
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterPhone('');
      
      // Después de 2 segundos, cambiar a login
      setTimeout(() => {
        setRegisterSuccess(false);
        setAuthView('login');
        setLoginEmail(registerEmail); // Pre-llenar email en login
      }, 2000);
      
      setRegisterLoading(false);
    } catch (err) {
      console.error('[UserAccount] Error en registro:', err);
      setRegisterError(err instanceof Error ? err.message : 'Error al registrarse');
      setRegisterLoading(false);
    }
  };

  // Si está autenticado, mostrar menú de usuario
  if (isAuthenticated && currentUser) {
    return (
      <div className="relative" ref={menuRef}>
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

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
              <p className="text-xs text-gray-500">{currentUser.email}</p>
            </div>

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

  // Si NO está autenticado, mostrar botón de cuenta
  return (
    <>
      <button
        onClick={() => setShowAuthModal(true)}
        className="flex items-center space-x-2 px-3 py-2 text-gray-700 hover:text-indigo-600 transition-colors"
      >
        <User className="h-5 w-5" />
        <span className="hidden md:inline">Cuenta</span>
      </button>

      {/* Modal de Autenticación */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowAuthModal(false)}
            />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
              {/* Pestañas */}
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => {
                    setAuthView('login');
                    setLoginError('');
                    setRegisterError('');
                  }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    authView === 'login'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={() => {
                    setAuthView('register');
                    setLoginError('');
                    setRegisterError('');
                  }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    authView === 'register'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Registrarse
                </button>
              </div>

              {/* Vista de Login */}
              {authView === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Iniciar Sesión</h2>
                  
                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                      <p className="text-sm text-red-700">{loginError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loginLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                  </button>
                </form>
              )}

              {/* Vista de Registro */}
              {authView === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Crear Cuenta</h2>
                  
                  {registerError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                      <p className="text-sm text-red-700">{registerError}</p>
                    </div>
                  )}

                  {registerSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">✅ Cuenta creada exitosamente</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Juan Pérez"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="0999999999"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="password"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Debe tener al menos 8 caracteres, 1 mayúscula y 1 número
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={registerLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {registerLoading ? (
                      'Creando cuenta...'
                    ) : (
                      <>
                        <UserPlus className="h-5 w-5 mr-2" />
                        Crear Cuenta
                      </>
                    )}
                  </button>
                </form>
              )}

              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
