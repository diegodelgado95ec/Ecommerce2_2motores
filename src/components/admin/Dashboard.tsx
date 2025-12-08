import React, { useState, useEffect } from 'react';
import { Users, Package, DollarSign, ShoppingCart, Usb, Mail, Settings } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { InventoryTable } from './InventoryTable';
import { InventoryManager } from './InventoryManager';
import { ProductManagement } from './ProductManagement';
import { TransactionsPanel } from './TransactionsPanel'; // ✨ NUEVO
import { WeeklyStatsCard } from './WeeklyStatsCard';
import { weeklyStatsService } from '../../services/WeeklyStatsService';
import { getAllProducts } from '../../lib/inventory';
import { ledService } from "../../services/LedService";
import type { Product } from '../../lib/inventory';
import ExpiringBatchesAlert from "./ExpiringBatchesAlert";
import BatchSearcher from "./BatchSearcher";
import EmailTasks from "./EmailTasks";
import { HardwareSettings } from './HardwareSettings';
import { db } from '../../lib/db';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<
    'users' | 'inventory' | 'stock' | 'products' | 'sales' | 'batches' | 'settings'
  >('inventory');

  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialError, setSerialError] = useState<string | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  useEffect(() => {
    loadWeeklyStats();
    loadProducts();
  }, []);

  const loadWeeklyStats = async () => {
    try {
      setLoading(true);
      const stats = await weeklyStatsService.getWeeklyStats();
      setWeeklyStats(stats);
    } catch (error) {
      console.error('Error loading weekly stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const all = await getAllProducts();
      setProducts(all);
      if (all.length > 0 && selectedProductId === null) {
        setSelectedProductId(all[0].id);
      }
    } catch (error) {
      console.error('Error loading products for batches:', error);
    }
  };

  const handleSerialConnect = async () => {
    try {
      setSerialError(null);
      const success = await ledService.connect();
      setIsSerialConnected(success);
      if (!success) {
        setSerialError('No se pudo conectar al Arduino. Verifica que esté conectado y en el puerto correcto.');
      }
    } catch (error) {
      console.error('Error connecting to serial:', error);
      setSerialError('Error al conectar con el Arduino');
      setIsSerialConnected(false);
    }
  };

  const handleTestESP32 = async () => {
    try {
      setSerialError(null);
      const success = await ledService.sendProductSignal(1, 1);
      if (success) {
        alert('Test exitoso: LED encendido');
      } else {
        setSerialError('Error al enviar señal de prueba');
      }
    } catch (error) {
      console.error('Error testing ESP32:', error);
      setSerialError('Error al probar ESP32');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Panel de Administración
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSerialConnect}
                className={`flex items-center px-4 py-2 rounded-lg transition-all duration-300 ${
                  isSerialConnected
                    ? 'bg-green-100 text-green-800 hover:bg-green-200 shadow-lg'
                    : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900 shadow-lg hover:shadow-xl'
                }`}
              >
                <Usb className="w-5 h-5 mr-2" />
                {isSerialConnected ? 'ESP32 Conectado' : 'Conectar ESP32'}
              </button>
              {isSerialConnected && (
                <button
                  onClick={handleTestESP32}
                  className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Test LED
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {serialError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 text-red-500 p-4 rounded-lg shadow-lg">
            {serialError}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ✨ Métricas Dashboard Mejoradas */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-white/60 backdrop-blur-xl rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : weeklyStats ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <WeeklyStatsCard
              title="Ingresos Semanales"
              value={`$${weeklyStats.currentWeek.revenue.toFixed(2)}`}
              icon={<DollarSign className="w-8 h-8" />}
              trend={weeklyStats.trends.revenue.direction}
              trendValue={weeklyStats.trends.revenue.value}
              sparklineData={weeklyStats.currentWeek.dailyRevenue}
              gradientFrom="from-emerald-500"
              gradientTo="to-teal-600"
            />

            <WeeklyStatsCard
              title="Ventas Semanales"
              value={weeklyStats.currentWeek.sales}
              icon={<ShoppingCart className="w-8 h-8" />}
              trend={weeklyStats.trends.sales.direction}
              trendValue={weeklyStats.trends.sales.value}
              sparklineData={weeklyStats.currentWeek.dailyRevenue.map((_, i) => 
                Math.floor(Math.random() * 20) + 10
              )}
              gradientFrom="from-blue-500"
              gradientTo="to-indigo-600"
            />

            <WeeklyStatsCard
              title="Productos"
              value={weeklyStats.currentWeek.products}
              icon={<Package className="w-8 h-8" />}
              trend={weeklyStats.trends.products.direction}
              trendValue={weeklyStats.trends.products.value}
              sparklineData={[10, 12, 11, 13, 15, 14, weeklyStats.currentWeek.products]}
              gradientFrom="from-amber-500"
              gradientTo="to-orange-600"
            />

            <WeeklyStatsCard
              title="Usuarios"
              value={weeklyStats.currentWeek.users}
              icon={<Users className="w-8 h-8" />}
              trend={weeklyStats.trends.users.direction}
              trendValue={weeklyStats.trends.users.value}
              sparklineData={[2, 2, 3, 3, 3, 3, weeklyStats.currentWeek.users]}
              gradientFrom="from-purple-500"
              gradientTo="to-pink-600"
            />
          </div>
        ) : null}

        {/* Navegación por paneles */}
        <div className="bg-white/80 backdrop-blur-lg shadow-xl rounded-2xl mb-8 border border-white/20">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs" style={{ scrollbarWidth: 'thin' }}>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`${
                  activeTab === 'inventory'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 transition-colors`}
              >
                <Package className="w-5 h-5 mr-2" />
                Control de Inventario
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`${
                  activeTab === 'products'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 transition-colors`}
              >
                <Package className="w-5 h-5 mr-2" />
                Gestión de Productos
              </button>

              <button
                onClick={() => setActiveTab('stock')}
                className={`${
                  activeTab === 'stock'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 transition-colors`}
              >
                <Package className="w-5 h-5 mr-2" />
                Ajuste de Stock
              </button>

              <button
                onClick={() => setActiveTab('sales')}
                className={`${
                  activeTab === 'sales'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 transition-colors`}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Órdenes y Transacciones
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`${
                  activeTab === 'users'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 transition-colors`}
              >
                <Users className="w-5 h-5 mr-2" />
                Usuarios
              </button>

              <button
                onClick={() => setActiveTab('batches')}
                className={`${
                  activeTab === 'batches'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 transition-colors`}
              >
                <Mail className="w-5 h-5 mr-2" />
                Lotes y Reportes
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`${
                  activeTab === 'settings'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 transition-colors`}
              >
                <Settings className="w-5 h-5 mr-2" />
                Configuración
              </button>
            </nav>
          </div>
        </div>

        {/* Contenido de los paneles */}
        <div className="bg-white/80 backdrop-blur-lg shadow-xl rounded-2xl p-6 border border-white/20">
          {activeTab === 'inventory' && <InventoryTable />}
          {activeTab === 'products' && <ProductManagement />}
          {activeTab === 'stock' && <InventoryManager />}
          {activeTab === 'sales' && <TransactionsPanel />}
          {activeTab === 'users' && <UserManagement />}

          {activeTab === 'batches' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Búsqueda de Lotes por Producto</h3>
                <BatchSearcher />
              </div>
              <hr className="my-6" />
              <div>
                <h3 className="text-lg font-semibold mb-4">Lotes Próximos a Caducarse</h3>
                <ExpiringBatchesAlert />
              </div>
              <hr className="my-6" />
              <EmailTasks />
            </div>
          )}
          {activeTab === 'settings' && <HardwareSettings />}
        </div>
      </div>
    </div>
  );
}
