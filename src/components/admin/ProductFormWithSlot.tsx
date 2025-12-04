// src/components/admin/ProductFormWithSlot.tsx
import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { slotService } from '../../services/SlotService';
import { db } from '../../lib/db';
import type { DBSchema } from '../../lib/db';

interface ProductFormWithSlotProps {
  onSuccess?: () => void;
  existingProduct?: DBSchema['products'];
}

export function ProductFormWithSlot({ onSuccess, existingProduct }: ProductFormWithSlotProps) {
  const [formData, setFormData] = useState({
    title: existingProduct?.title || '',
    price: existingProduct?.price.toString() || '',
    stock: existingProduct?.stock.toString() || '',
    unit: existingProduct?.unit || '',
    image: existingProduct?.image || '',
    rating: existingProduct?.rating.toString() || '5.0',
    slotPosition: existingProduct?.slotPosition?.toString() || '',
    bandDistance: existingProduct?.bandDistance?.toString() || ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [slotWarning, setSlotWarning] = useState<string | null>(null);
  const [currentProductInSlot, setCurrentProductInSlot] = useState<DBSchema['products'] | null>(null);
  const [availableSlots, setAvailableSlots] = useState<number[]>([]);

  useEffect(() => {
    loadAvailableSlots();
  }, []);

  useEffect(() => {
    if (formData.slotPosition) {
      checkSlotAvailability(parseInt(formData.slotPosition));
    } else {
      setSlotWarning(null);
      setCurrentProductInSlot(null);
    }
  }, [formData.slotPosition]);

  const loadAvailableSlots = async () => {
    try {
      const slots = await slotService.getAvailableSlots();
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error cargando slots disponibles:', error);
    }
  };

  const checkSlotAvailability = async (slotPosition: number) => {
    try {
      const validation = await slotService.validateSlotAvailability(slotPosition);
      
      if (!validation.available && validation.currentProduct) {
        // Solo mostrar warning si no es el mismo producto que estamos editando
        if (!existingProduct || validation.currentProduct.id !== existingProduct.id) {
          setSlotWarning(`⚠️ Slot ocupado por: ${validation.currentProduct.title}`);
          setCurrentProductInSlot(validation.currentProduct);
        } else {
          setSlotWarning(null);
          setCurrentProductInSlot(null);
        }
      } else {
        setSlotWarning(null);
        setCurrentProductInSlot(null);
      }
    } catch (error) {
      console.error('Error validando slot:', error);
    }
  };

  const adjustDistance = (increment: number) => {
    const current = parseFloat(formData.bandDistance) || 0;
    const newValue = Math.max(5, Math.min(200, current + increment));
    setFormData({ ...formData, bandDistance: newValue.toString() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Validaciones básicas
      const productData: Omit<DBSchema['products'], 'id'> = {
        title: formData.title.trim(),
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        unit: formData.unit,
        image: formData.image.trim(),
        rating: parseFloat(formData.rating),
        createdAt: existingProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!productData.title || !productData.price || !productData.stock || !productData.unit) {
        setError('Todos los campos básicos son obligatorios');
        return;
      }

      // Validar y agregar datos de slot si están presentes
      if (formData.slotPosition) {
        const slotPosition = parseInt(formData.slotPosition);
        const bandDistance = parseFloat(formData.bandDistance);

        if (!formData.bandDistance) {
          setError('La distancia de banda es obligatoria si asignas un slot');
          return;
        }

        if (bandDistance < 5 || bandDistance > 200) {
          setError('La distancia debe estar entre 5 y 200 cm');
          return;
        }

        // Si hay warning, confirmar con el usuario
        if (slotWarning && currentProductInSlot) {
          const confirmed = window.confirm(
            `${slotWarning}\n\n¿Seguro desea reasignar este slot? El producto "${currentProductInSlot.title}" perderá su asignación.`
          );
          
          if (!confirmed) {
            return;
          }
        }

        Object.assign(productData, {
          slotPosition,
          bandDistance,
          isSlotActive: true,
          lastCalibration: new Date().toISOString()
        });
      }

      // Guardar producto
      let productId: number;
      if (existingProduct) {
        await db.put('products', { ...productData, id: existingProduct.id });
        productId = existingProduct.id;
        setSuccess(`Producto "${productData.title}" actualizado correctamente`);
      } else {
        productId = await db.add('products', productData);
        setSuccess(`Producto "${productData.title}" agregado correctamente`);
      }

      // Asignar slot usando el servicio
      if (formData.slotPosition && formData.bandDistance) {
        await slotService.assignProductToSlot({
          productId,
          slotPosition: parseInt(formData.slotPosition),
          bandDistance: parseFloat(formData.bandDistance)
        });
      }

      // Limpiar formulario
      if (!existingProduct) {
        setFormData({
          title: '',
          price: '',
          stock: '',
          unit: '',
          image: '',
          rating: '5.0',
          slotPosition: '',
          bandDistance: ''
        });
      }

      if (onSuccess) onSuccess();
      await loadAvailableSlots();
    } catch (error) {
      console.error('Error guardando producto:', error);
      setError('Error al guardar el producto');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-500 p-3 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Campos básicos del producto */}
      <div className="grid grid-cols-6 gap-6">
        <div className="col-span-6">
          <label className="block text-sm font-medium text-gray-700">Nombre del Producto</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
          />
        </div>

        <div className="col-span-6 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Precio ($)</label>
          <input
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
          />
        </div>

        <div className="col-span-6 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Stock</label>
          <input
            type="number"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
          />
        </div>

        <div className="col-span-6 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Unidad</label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
          >
            <option value="">Seleccionar</option>
            <option value="kg">Kilogramo</option>
            <option value="g">Gramo</option>
            <option value="l">Litro</option>
            <option value="ml">Mililitro</option>
            <option value="unidad">Unidad</option>
          </select>
        </div>

        {/* SECCIÓN DE SLOT */}
        <div className="col-span-6 border-t pt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">🎯 Asignación de Slot Físico (Opcional)</h4>
          
          <div className="grid grid-cols-6 gap-6">
            <div className="col-span-6 sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Posición del Slot (1-20)</label>
              <select
                value={formData.slotPosition}
                onChange={(e) => setFormData({ ...formData, slotPosition: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
              >
                <option value="">Sin asignar</option>
                {availableSlots.map(slot => (
                  <option key={slot} value={slot}>Slot #{slot}</option>
                ))}
                {existingProduct?.slotPosition && (
                  <option value={existingProduct.slotPosition}>
                    Slot #{existingProduct.slotPosition} (Actual)
                  </option>
                )}
              </select>
              {slotWarning && (
                <p className="mt-2 text-sm text-orange-600 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {slotWarning}
                </p>
              )}
            </div>

            {formData.slotPosition && (
              <div className="col-span-6 sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Distancia de Banda (cm)</label>
                <div className="mt-1 flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="200"
                    value={formData.bandDistance}
                    onChange={(e) => setFormData({ ...formData, bandDistance: e.target.value })}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                  />
                  <div className="flex flex-col space-y-1">
                    <button
                      type="button"
                      onClick={() => adjustDistance(1)}
                      className="p-1 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustDistance(-1)}
                      className="p-1 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">Rango: 5-200 cm</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          {existingProduct ? 'Actualizar Producto' : 'Agregar Producto'}
        </button>
      </div>
    </form>
  );
}
