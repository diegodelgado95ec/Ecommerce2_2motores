// src/components/admin/InventoryTable.tsx - VERSIÓN CORREGIDA

import React, { useState, useEffect } from 'react';
import { getAllProducts, db } from '../../lib/inventory';
import { Pencil, Save, X } from 'lucide-react';
import type { Product } from '../../lib/inventory';

export function InventoryTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]); // ✅ AGREGAR
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProducts();
    loadOrderItems(); // ✅ AGREGAR
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const users = await db.getAll('users');
      // Aquí deberías verificar el usuario actual desde authService
      // Por ahora asumimos que hay forma de saber si es admin
      const currentUserEmail = localStorage.getItem('currentUserEmail');
      const user = users.find((u: any) => u.email === currentUserEmail);
      setIsAdmin(user?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const loadProducts = async () => {
    const data = await getAllProducts();
    setProducts(data);
  };

  // ✅ NUEVO: Cargar items de órdenes para calcular ventas reales
  const loadOrderItems = async () => {
    try {
      const items = await db.getAll('orderItems');
      setOrderItems(items);
    } catch (error) {
      console.error('Error loading order items:', error);
      setOrderItems([]);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm(product);
  };

  const handleSave = async () => {
    if (!editingId || !editForm) return;

    try {
      const updatedProduct = {
        ...editForm,
        id: editingId,
        updatedAt: new Date(),
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        rating: Number(editForm.rating)
      } as Product;

      await db.put('products', updatedProduct);
      setSuccess('Producto actualizado correctamente');
      setEditingId(null);
      setEditForm({});
      await loadProducts();

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      setError('Error al guardar los cambios');
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleChange = (field: keyof Product, value: any) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ FUNCIÓN: Calcular estadísticas por producto
  const getProductStats = (product: Product) => {
    // Ventas reales desde orderItems
    const productOrderItems = orderItems.filter(item => item.productId === product.id);
    const unitsSold = productOrderItems.reduce((sum, item) => sum + Math.abs(item.quantity), 0);
    const revenueFromSales = productOrderItems.reduce((sum, item) => {
      return sum + (Math.abs(item.quantity) * item.price);
    }, 0);

    // Valor del stock actual
    const stockValue = product.stock * product.price;

    return {
      unitsSold,           // ✅ Unidades vendidas (desde órdenes)
      revenueFromSales,    // ✅ Ingresos por ventas
      stockValue           // ✅ Valor del inventario actual
    };
  };

  // ✅ CALCULAR TOTALES
  const totals = products.reduce(
    (acc, product) => {
      const stats = getProductStats(product);
      return {
        stock: acc.stock + product.stock,
        unitsSold: acc.unitsSold + stats.unitsSold,
        revenue: acc.revenue + stats.revenueFromSales,
        stockValue: acc.stockValue + stats.stockValue
      };
    },
    { stock: 0, unitsSold: 0, revenue: 0, stockValue: 0 }
  );

  return (
    <div className="flex flex-col">
      {error && (
        <div className="mb-4 bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 text-green-500 p-3 rounded-md text-sm">
          {success}
        </div>
      )}
      
      <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Actual
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidades Vendidas
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Unitario
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor del Stock
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ingresos por Ventas
                  </th>
                  {isAdmin && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => {
                  const stats = getProductStats(product);
                  const isEditing = editingId === product.id;
                  
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editForm.title || ''}
                                onChange={(e) => handleChange('title', e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="Título del producto"
                              />
                              <input
                                type="url"
                                value={editForm.image || ''}
                                onChange={(e) => handleChange('image', e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="URL de la imagen"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <img className="h-10 w-10 rounded-full object-cover" src={product.image} alt="" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{product.title}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.stock || 0}
                            onChange={(e) => handleChange('stock', parseInt(e.target.value))}
                            className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          />
                        ) : (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.stock > 50 ? 'bg-green-100 text-green-800' :
                            product.stock > 20 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {product.stock}
                          </span>
                        )}
                      </td>
                      
                      {/* ✅ Unidades Vendidas (desde órdenes reales) */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stats.unitsSold}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.price || 0}
                            onChange={(e) => handleChange('price', parseFloat(e.target.value))}
                            className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          />
                        ) : (
                          `$${product.price.toFixed(2)}`
                        )}
                      </td>
                      
                      {/* ✅ Valor del Stock (stock actual × precio) */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${stats.stockValue.toFixed(2)}
                      </td>
                      
                      {/* ✅ Ingresos por Ventas (desde órdenes reales) */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ${stats.revenueFromSales.toFixed(2)}
                      </td>
                      
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {isEditing ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={handleSave}
                                className="text-green-600 hover:text-green-900"
                                title="Guardar cambios"
                              >
                                <Save className="h-5 w-5" />
                              </button>
                              <button
                                onClick={handleCancel}
                                className="text-red-600 hover:text-red-900"
                                title="Cancelar"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Editar producto"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              
              {/* ✅ FILA DE TOTALES CORREGIDA */}
              <tfoot className="bg-gray-50">
                <tr className="font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    TOTALES
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {totals.stock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {totals.unitsSold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${totals.stockValue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    ${totals.revenue.toFixed(2)}
                  </td>
                  {isAdmin && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ✅ NOTA EXPLICATIVA */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Stock Actual:</strong> Productos disponibles en inventario • 
              <strong> Valor del Stock:</strong> Valor monetario del inventario (stock × precio) • 
              <strong> Ingresos por Ventas:</strong> Dinero generado por ventas realizadas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
