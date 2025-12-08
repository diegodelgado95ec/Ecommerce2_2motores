// src/components/InactivityTimeout.tsx - Timeout de inactividad

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

interface InactivityTimeoutProps {
  timeoutMs?: number;      // Tiempo de inactividad (default: 2 min)
  warningMs?: number;      // Mostrar advertencia antes (default: 90s)
  enabled?: boolean;       // Habilitar/deshabilitar (default: true)
}

export function InactivityTimeout({ 
  timeoutMs = 120000,     // 2 minutos
  warningMs = 90000,      // 90 segundos
  enabled = true 
}: InactivityTimeoutProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const { clearCart } = useCart();

  useEffect(() => {
    if (!enabled) return;

    let inactivityTimer: NodeJS.Timeout;
    let warningTimer: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    const resetTimers = () => {
      // Limpiar timers existentes
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);
      clearInterval(countdownInterval);
      setShowWarning(false);
      setCountdown(0);

      // Timer para mostrar advertencia
      warningTimer = setTimeout(() => {
        console.log('[InactivityTimeout] ⚠️ Mostrando advertencia de inactividad');
        setShowWarning(true);
        
        const remainingMs = timeoutMs - warningMs;
        setCountdown(Math.ceil(remainingMs / 1000));

        // Contador regresivo
        countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, warningMs);

      // Timer para timeout final
      inactivityTimer = setTimeout(() => {
        console.log('[InactivityTimeout] ⏰ Timeout de inactividad alcanzado');
        handleTimeout();
      }, timeoutMs);
    };

    const handleTimeout = () => {
      console.log('[InactivityTimeout] 🔄 Reiniciando sesión por inactividad');
      
      // Limpiar carrito
      clearCart();
      
      // Limpiar sessionStorage (pero no localStorage)
      sessionStorage.clear();
      
      // Registrar evento
      try {
        const event = {
          type: 'inactivity_timeout',
          timestamp: new Date().toISOString(),
          path: window.location.pathname
        };
        
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        logs.push(event);
        localStorage.setItem('security_logs', JSON.stringify(logs.slice(-100)));
      } catch (error) {
        console.error('[InactivityTimeout] Error guardando log:', error);
      }
      
      // Navegar al home
      navigate('/');
      
      // Ocultar warning
      setShowWarning(false);
    };

    const handleActivity = () => {
      if (showWarning) {
        console.log('[InactivityTimeout] ✓ Actividad detectada, cancelando timeout');
      }
      resetTimers();
    };

    // Eventos que indican actividad
    const events = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Iniciar timers
    resetTimers();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);
      clearInterval(countdownInterval);
    };
  }, [enabled, timeoutMs, warningMs, navigate, clearCart, showWarning]);

  // No renderizar nada si no hay warning
  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 text-center">
        <div className="mb-4">
          <svg 
            className="mx-auto h-16 w-16 text-yellow-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          ¿Sigues ahí?
        </h3>
        
        <p className="text-gray-600 mb-4">
          No hemos detectado actividad. La sesión se reiniciará en:
        </p>
        
        <div className="text-6xl font-bold text-indigo-600 mb-4">
          {countdown}s
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          Toca la pantalla para continuar
        </p>
        
        <button
          onClick={() => setShowWarning(false)}
          className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          Continuar Comprando
        </button>
      </div>
    </div>
  );
}
