// src/components/admin/HardwareSettings.tsx - NUEVO ARCHIVO

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Settings, Wifi, WifiOff, CheckCircle, XCircle } from 'lucide-react';
import { HardwareConfigManager } from '../../config/hardware.config';

export function HardwareSettings() {
  const [config, setConfig] = useState(HardwareConfigManager.getConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaving(true);
    try {
      HardwareConfigManager.saveConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await HardwareConfigManager.testConnection();
    setTestResult(result);
    setTesting(false);
  };

  const handleReset = () => {
    if (confirm('¿Resetear a configuración por defecto?')) {
      HardwareConfigManager.reset();
      setConfig(HardwareConfigManager.getConfig());
      setTestResult(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Settings className="h-6 w-6 text-gray-400 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Configuración de Hardware</h3>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="h-4 w-4 inline mr-1" />
              Resetear
            </button>
          </div>

          {/* Estado de Conexión */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {config.esp32.enabled ? (
                  <Wifi className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500 mr-2" />
                )}
                <span className="text-sm font-medium text-gray-700">
                  Estado: {config.esp32.enabled ? 'Habilitado' : 'Deshabilitado'}
                </span>
              </div>
              <button
                onClick={handleTest}
                disabled={testing || !config.esp32.enabled}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Probando...
                  </>
                ) : (
                  'Probar Conexión'
                )}
              </button>
            </div>

            {testResult && (
              <div className={`mt-3 p-3 rounded-md ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mr-2" />
                  )}
                  <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Formulario de Configuración */}
          <div className="space-y-4">
            {/* Habilitar/Deshabilitar */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={config.esp32.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  esp32: { ...config.esp32, enabled: e.target.checked }
                })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                Habilitar dispensador físico (ESP32)
              </label>
            </div>

            {/* IP */}
            <div>
              <label htmlFor="ip" className="block text-sm font-medium text-gray-700">
                Dirección IP
              </label>
              <input
                type="text"
                id="ip"
                value={config.esp32.ip}
                onChange={(e) => setConfig({
                  ...config,
                  esp32: { ...config.esp32, ip: e.target.value }
                })}
                placeholder="192.168.0.105"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Puerto */}
            <div>
              <label htmlFor="port" className="block text-sm font-medium text-gray-700">
                Puerto
              </label>
              <input
                type="number"
                id="port"
                value={config.esp32.port}
                onChange={(e) => setConfig({
                  ...config,
                  esp32: { ...config.esp32, port: parseInt(e.target.value) }
                })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Timeout */}
            <div>
              <label htmlFor="timeout" className="block text-sm font-medium text-gray-700">
                Timeout (ms)
              </label>
              <input
                type="number"
                id="timeout"
                value={config.esp32.timeout}
                onChange={(e) => setConfig({
                  ...config,
                  esp32: { ...config.esp32, timeout: parseInt(e.target.value) }
                })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Reintentos */}
            <div>
              <label htmlFor="retries" className="block text-sm font-medium text-gray-700">
                Número de reintentos
              </label>
              <input
                type="number"
                id="retries"
                value={config.esp32.retries}
                onChange={(e) => setConfig({
                  ...config,
                  esp32: { ...config.esp32, retries: parseInt(e.target.value) }
                })}
                min="1"
                max="5"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
