import React, { useState, useEffect } from 'react';
import { Search, Plus, Image as ImageIcon, Package, Edit } from 'lucide-react';
import { getAllProducts, type Product } from '../../lib/inventory';
import { db } from '../../lib/inventory';
import { ProductFormWithSlot } from './ProductFormWithSlot';
import { slotService } from '../../services/SlotService';

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [reassigningProduct, setReassigningProduct] = useState<Product | null>(null);
  const [newSlotData, setNewSlotData] = useState({ slotPosition: '', bandDistance: '' });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch (error) {
      setError('Error al cargar productos');
    }
  }

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReassignSlot = async (product: Product) => {
    setReassigningProduct(product);
    setNewSlotData({
      slotPosition: product.slotPosition?.toString() || '',
      bandDistance: product.bandDistance?.toString() || ''
    });
  };

  const confirmReassign = async () => {
    if (!reassigningProduct || !newSlotData.slotPosition || !newSlotData.bandDistance) {
      setError('Debes especificar slot y distancia');
      return;
    }

    try {
      await slotService.reassignSlot(
        reassigningProduct.id,
        parseInt(newSlotData.slotPosition),
        parseFloat(newSlotData.bandDistance)
      );
      
      setSuccess(`Slot reasignado correctamente para "${reassigningProduct.title}"`);
      setReassigningProduct(null);
      setNewSlotData({ slotPosition: '', bandDistance: '' });
      await loadProducts();
    } catch (error) {
      setError('Error al reasignar slot');
    }
  };

  const getSlotStatusBadge = (product: Product) => {
    if (!product.slotPosition) {
      return <span className="text-xs text-gray-400">Sin asignar</span>;
    }
    if (!product.isSlotActive) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Slot #{product.slotPosition} (Inactivo)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Slot #{product.slotPosition}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Botón para toggle del formulario */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Gestión de Productos</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingProduct(null);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-yellow-400 hover:bg-yellow-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          {showForm ? 'Ocultar Formulario' : 'Nuevo Producto'}
        </button>
      </div>

      {/* Formulario con Slots */}
      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <ProductFormWithSlot
            existingProduct={editingProduct || undefined}
            onSuccess={() => {
              loadProducts();
              setShowForm(false);
              setEditingProduct(null);
            }}
          />
        </div>
      )}

      {/* Modal de Reasignación */}
      {reassigningProduct && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Reasignar Slot - {reassigningProduct.title}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nueva Posición de Slot</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newSlotData.slotPosition}
                  onChange={(e) => setNewSlotData({ ...newSlotData, slotPosition: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Distancia de Banda (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  max="200"
                  value={newSlotData.bandDistance}
                  onChange={(e) => setNewSlotData({ ...newSlotData, bandDistance: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={confirmReassign}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-900 bg-yellow-400 hover:bg-yellow-500"
              >
                Confirmar
              </button>
              <button
                onClick={() => setReassigningProduct(null)}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-500 p-3 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Tabla de Productos con columna Slot */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Productos Existentes</h3>
          
          <div className="mt-4 max-w-xl">
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="focus:ring-yellow-500 focus:border-yellow-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex flex-col">
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
                            Precio
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stock Actual
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unidad
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Slot
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Distancia
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.map((product) => (
                          <tr key={product.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <img className="h-10 w-10 rounded-full object-cover" src={product.image} alt="" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{product.title}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              ${product.price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.stock}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getSlotStatusBadge(product)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.bandDistance ? `${product.bandDistance} cm` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleReassignSlot(product)}
                                className="text-yellow-600 hover:text-yellow-900 inline-flex items-center"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Reasignar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}