// src/components/admin/TransactionsPanel.tsx
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Package, AlertTriangle, 
  Filter, Calendar, User, Search, ChevronDown 
} from 'lucide-react';
import { db } from '../../lib/db';
import type { DBSchema } from '../../lib/db';

type TimeRange = 'daily' | 'weekly' | 'monthly';
type MovementType = 'all' | 'sale' | 'restock' | 'damaged';

interface Movement {
  id: number;
  type: 'sale' | 'restock' | 'damaged';
  productName: string;
  productId: number;
  quantity: number;
  amount?: number;
  userName: string;
  timestamp: string;
  note?: string;
}

interface Summary {
  totalSales: number;
  totalRevenue: number;
  restockUnits: number;
  damagedUnits: number;
}

export function TransactionsPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [movementType, setMovementType] = useState<MovementType>('all');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalSales: 0,
    totalRevenue: 0,
    restockUnits: 0,
    damagedUnits: 0
  });
  
  // Filtros
  const [searchProduct, setSearchProduct] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [products, setProducts] = useState<DBSchema['products'][]>([]);
  const [users, setUsers] = useState<DBSchema['users'][]>([]);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  useEffect(() => {
    applyFilters();
  }, [movements, movementType, searchProduct, searchUser, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      // Cargar productos y usuarios para los filtros
      const productsData = await db.getAll('products');
      const usersData = await db.getAll('users');
      setProducts(productsData);
      setUsers(usersData);

      // Cargar movimientos según el rango de tiempo
      const range = getDateRange(timeRange);
      const allMovements: Movement[] = [];

      // 1. Ventas (de órdenes)
      const orders = await db.getAll('orders');
      for (const order of orders) {
        if (isInDateRange(order.createdAt, range)) {
          const orderItems = await db.getAllByIndex('orderItems', 'orderId', order.id);
          for (const item of orderItems) {
            const product = productsData.find(p => p.id === item.productId);
            const user = usersData.find(u => u.id === order.userId);
            allMovements.push({
              id: order.id!,
              type: 'sale',
              productName: product?.title || 'Producto desconocido',
              productId: item.productId,
              quantity: item.quantity,
              amount: item.price * item.quantity,
              userName: user?.name || 'Cliente',
              timestamp: order.createdAt,
              note: `Orden #${order.id}`
            });
          }
        }
      }

      // 2. Reabastecimientos (de stockAdjustments type: 'restock')
      const adjustments = await db.getAll('stockAdjustments');
      for (const adj of adjustments) {
        if (isInDateRange(adj.timestamp, range)) {
          const product = productsData.find(p => p.id === adj.productId);
          if (adj.adjustmentType === 'restock' && adj.difference > 0) {
            allMovements.push({
              id: adj.id!,
              type: 'restock',
              productName: product?.title || 'Producto desconocido',
              productId: adj.productId,
              quantity: adj.difference,
              userName: adj.userId || 'Sistema',
              timestamp: adj.timestamp,
              note: adj.note
            });
          }
        }
      }

      // 3. Stock dañado (de stockMovements type: 'out' con nota de 'dañado')
      const stockMovements = await db.getAll('stockMovements');
      for (const mov of stockMovements) {
        if (isInDateRange(mov.createdAt, range)) {
          const product = productsData.find(p => p.id === mov.productId);
          if (mov.type === 'out' && mov.note?.toLowerCase().includes('dañ') && mov.quantity < 0) {
            allMovements.push({
              id: mov.id!,
              type: 'damaged',
              productName: product?.title || 'Producto desconocido',
              productId: mov.productId,
              quantity: Math.abs(mov.quantity),
              userName: 'Administrador',
              timestamp: mov.createdAt,
              note: mov.note
            });
          }
        }
      }

      // Ordenar por fecha (más reciente primero)
      allMovements.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setMovements(allMovements);
      calculateSummary(allMovements);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...movements];

    // Filtro por tipo
    if (movementType !== 'all') {
      filtered = filtered.filter(m => m.type === movementType);
    }

    // Filtro por producto
    if (searchProduct) {
      filtered = filtered.filter(m => 
        m.productName.toLowerCase().includes(searchProduct.toLowerCase()) ||
        m.productId.toString() === searchProduct
      );
    }

    // Filtro por usuario
    if (searchUser) {
      filtered = filtered.filter(m => 
        m.userName.toLowerCase().includes(searchUser.toLowerCase())
      );
    }

    // Filtro por rango de fechas
    if (dateFrom) {
      filtered = filtered.filter(m => 
        new Date(m.timestamp) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(m => 
        new Date(m.timestamp) <= new Date(dateTo + 'T23:59:59')
      );
    }

    setFilteredMovements(filtered);
  };

  const calculateSummary = (movs: Movement[]) => {
    const summary: Summary = {
      totalSales: 0,
      totalRevenue: 0,
      restockUnits: 0,
      damagedUnits: 0
    };

    movs.forEach(m => {
      if (m.type === 'sale') {
        summary.totalSales += m.quantity;
        summary.totalRevenue += m.amount || 0;
      } else if (m.type === 'restock') {
        summary.restockUnits += m.quantity;
      } else if (m.type === 'damaged') {
        summary.damagedUnits += m.quantity;
      }
    });

    setSummary(summary);
  };

  const getDateRange = (range: TimeRange): { from: Date; to: Date } => {
    const now = new Date();
    const to = now;
    let from: Date;

    if (range === 'daily') {
      from = new Date(now.setHours(0, 0, 0, 0));
    } else if (range === 'weekly') {
      from = new Date(now.setDate(now.getDate() - now.getDay())); // Inicio de semana (Domingo)
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1); // Inicio de mes
    }

    return { from, to: new Date() };
  };

  const isInDateRange = (dateStr: string, range: { from: Date; to: Date }): boolean => {
    const date = new Date(dateStr);
    return date >= range.from && date <= range.to;
  };

  const getMovementBadge = (type: Movement['type']) => {
    switch (type) {
      case 'sale':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <TrendingUp className="w-3 h-3 mr-1" />
            Venta
          </span>
        );
      case 'restock':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Package className="w-3 h-3 mr-1" />
            Reabastecimiento
          </span>
        );
      case 'damaged':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Dañado
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* RESUMEN SUPERIOR */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Órdenes y Transacciones</h2>
        
        {/* Toggle Rango de Tiempo */}
        <div className="flex rounded-lg shadow-sm bg-white border border-gray-200">
          <button
            onClick={() => setTimeRange('daily')}
            className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
              timeRange === 'daily'
                ? 'bg-yellow-400 text-gray-900'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Diario
          </button>
          <button
            onClick={() => setTimeRange('weekly')}
            className={`px-4 py-2 text-sm font-medium border-x ${
              timeRange === 'weekly'
                ? 'bg-yellow-400 text-gray-900'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Semanal
          </button>
          <button
            onClick={() => setTimeRange('monthly')}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
              timeRange === 'monthly'
                ? 'bg-yellow-400 text-gray-900'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Mensual
          </button>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Ingresos</p>
              <p className="text-3xl font-bold">${summary.totalRevenue.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Ventas</p>
              <p className="text-3xl font-bold">{summary.totalSales}</p>
              <p className="text-xs opacity-75">unidades</p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Reabastecido</p>
              <p className="text-3xl font-bold">{summary.restockUnits}</p>
              <p className="text-xs opacity-75">unidades</p>
            </div>
            <Package className="w-12 h-12 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-400 to-pink-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Stock Dañado</p>
              <p className="text-3xl font-bold">{summary.damagedUnits}</p>
              <p className="text-xs opacity-75">unidades</p>
            </div>
            <AlertTriangle className="w-12 h-12 opacity-75" />
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 mr-2 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Tipo de Movimiento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as MovementType)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            >
              <option value="all">Todos</option>
              <option value="sale">Ventas</option>
              <option value="restock">Reabastecimientos</option>
              <option value="damaged">Stock Dañado</option>
            </select>
          </div>

          {/* Producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
            <input
              type="text"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              placeholder="Buscar producto..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>

          {/* Usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input
              type="text"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Buscar usuario..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>

          {/* Fecha Desde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>
        </div>
      </div>

      {/* TABLA DE MOVIMIENTOS */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nota
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron movimientos
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement, index) => (
                  <tr key={`${movement.type}-${movement.id}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(movement.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMovementBadge(movement.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {movement.productName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        movement.type === 'sale' ? 'text-red-600' :
                        movement.type === 'restock' ? 'text-green-600' :
                        'text-gray-600'
                      }`}>
                        {movement.type === 'sale' ? '-' : '+'}{movement.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {movement.amount ? `$${movement.amount.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {movement.userName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {movement.note || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TOTAL DE RESULTADOS */}
      <div className="text-center text-sm text-gray-500">
        Mostrando {filteredMovements.length} de {movements.length} movimientos
      </div>
    </div>
  );
}
