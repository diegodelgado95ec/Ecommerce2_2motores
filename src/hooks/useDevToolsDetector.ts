// src/hooks/useDevToolsDetector.ts - Detector de DevTools

import { useEffect } from 'react';

/**
 * Hook que detecta si DevTools está abierto y recarga la página
 * Solo activo en modo producción
 */
export function useDevToolsDetector() {
  useEffect(() => {
    // Solo en producción
    if (import.meta.env.MODE !== 'production') {
      console.log('[DevToolsDetector] 🛠️ Detector deshabilitado en modo desarrollo');
      return;
    }

    let devtoolsOpen = false;

    // Método 1: Detectar por tamaño de ventana
    const checkWindowSize = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          handleDevToolsDetected('window-size');
        }
      } else {
        devtoolsOpen = false;
      }
    };

    // Método 2: Detectar por console.log
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function() {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          handleDevToolsDetected('console-check');
        }
        return 'devtools-detector';
      }
    });

    // Método 3: Detectar por debugger
    const checkDebugger = () => {
      const before = new Date();
      // @ts-ignore
      debugger;
      const after = new Date();
      const diff = after.getTime() - before.getTime();
      
      // Si hay más de 100ms de diferencia, probablemente DevTools está abierto
      if (diff > 100) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          handleDevToolsDetected('debugger-check');
        }
      }
    };

    // Handler cuando se detecta DevTools
    const handleDevToolsDetected = (method: string) => {
      console.error(`[DevToolsDetector] 🚨 DevTools detectado (método: ${method})`);
      
      // Registrar evento
      try {
        const event = {
          type: 'devtools_detected',
          method,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        };
        
        // Guardar en localStorage para auditoría
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        logs.push(event);
        // Mantener solo últimos 100 eventos
        localStorage.setItem('security_logs', JSON.stringify(logs.slice(-100)));
      } catch (error) {
        console.error('[DevToolsDetector] Error guardando log:', error);
      }

      // Mostrar mensaje y recargar
      alert('⚠️ Sistema de seguridad activado. La sesión se reiniciará.');
      
      // Limpiar datos sensibles
      sessionStorage.clear();
      
      // Recargar página (volver al home)
      window.location.href = '/';
    };

    // Ejecutar checks periódicamente
    const interval = setInterval(() => {
      checkWindowSize();
      
      // Solo ejecutar debugger check cada 5 segundos (es intensivo)
      if (Math.random() > 0.8) {
        checkDebugger();
      }
      
      // Console check
      console.log(element);
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, []);
}

/**
 * Deshabilita teclas de acceso rápido a DevTools
 */
export function useDisableDevToolsKeys() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        console.warn('[Security] ⚠️ F12 deshabilitado');
        return false;
      }

      // Ctrl+Shift+I (Inspector)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        console.warn('[Security] ⚠️ Ctrl+Shift+I deshabilitado');
        return false;
      }

      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        console.warn('[Security] ⚠️ Ctrl+Shift+J deshabilitado');
        return false;
      }

      // Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        console.warn('[Security] ⚠️ Ctrl+Shift+C deshabilitado');
        return false;
      }

      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        console.warn('[Security] ⚠️ Ctrl+U deshabilitado');
        return false;
      }
    };

    // Deshabilitar click derecho
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      console.warn('[Security] ⚠️ Click derecho deshabilitado');
      return false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
}
