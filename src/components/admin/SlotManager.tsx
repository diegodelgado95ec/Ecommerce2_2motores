// src/components/admin/SlotManager.tsx
import React, { useState, useEffect } from 'react';
import { Package, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { slotService, type SlotInfo } from '../../services/SlotService';

export function SlotManager() {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);

  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = async () => {
    try {
      setLoading(true);
      const data = await slotService.getAllSlots();
      setSlots(data);
    } catch (error) {
      console.error('Error cargando slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSlotStatusColor = (slot: SlotInfo) => {
    if (!slot.productId) return 'bg-gray-100 border-gray-300 text-gray-500';
    if (!slot.isActive) return 'bg-red-50 border-red-300 text-red-600';
    return 'bg-green-50 border-green-300 text-green-700';
  };

  const getSlotStatusIcon = (slot: SlotInfo) => {
    if (!slot.productId) return <XCircle className="w-5 h-5" />;
    if (!slot.isActive) return <AlertCircle className="w-5 h-5" />;
    return <CheckCircle className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  const occupiedSlots = slots.filter(s => s.productId).length;
  const availableSlots = slots.filter(s => !s.productId && s.isActive).length;
  const inactiveSlots = slots.filter(s => s.productId && !s.isActive).length;

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Slots Ocupados</dt>
                  <dd className="text-lg font-semibold text-gray-900">{occupiedSlots}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Slots Disponibles</dt>
                  <dd className="text-lg font-semibold text-gray-900">{availableSlots}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Slots Inactivos</dt>
                  <dd className="text-lg font-semibold text-gray-900">{inactiveSlots}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Slots */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Mapa de Slots Físicos</h3>
        <div className="grid grid-cols-5 gap-4">
          {slots.map((slot) => (
            <button
              key={slot.slotPosition}
              onClick={() => setSelectedSlot(slot)}
              className={`
                relative p-4 border-2 rounded-lg transition-all hover:shadow-md
                ${getSlotStatusColor(slot)}
                ${selectedSlot?.slotPosition === slot.slotPosition ? 'ring-2 ring-yellow-500' : ''}
              `}
            >
              <div className="flex flex-col items-center space-y-2">
                {getSlotStatusIcon(slot)}
                <span className="text-lg font-bold">#{slot.slotPosition}</span>
                {slot.productName && (
                  <span className="text-xs text-center truncate w-full" title={slot.productName}>
                    {slot.productName}
                  </span>
                )}
                {slot.bandDistance && (
                  <span className="text-xs text-gray-500">{slot.bandDistance}cm</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detalles del Slot Seleccionado */}
      {selectedSlot && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Detalles del Slot #{selectedSlot.slotPosition}
          </h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Estado</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {selectedSlot.productId ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Ocupado
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Disponible
                  </span>
                )}
              </dd>
            </div>

            {selectedSlot.productName && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Producto Asignado</dt>
                <dd className="mt-1 text-sm text-gray-900">{selectedSlot.productName}</dd>
              </div>
            )}

            {selectedSlot.bandDistance && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Distancia de Banda</dt>
                <dd className="mt-1 text-sm text-gray-900">{selectedSlot.bandDistance} cm</dd>
              </div>
            )}

            <div>
              <dt className="text-sm font-medium text-gray-500">Slot Activo</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {selectedSlot.isActive ? 'Sí' : 'No'}
              </dd>
            </div>

            {selectedSlot.lastCalibration && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Última Calibración</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(selectedSlot.lastCalibration).toLocaleString('es-ES')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Leyenda */}
      <div className="bg-white shadow rounded-lg p-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Leyenda</h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded"></div>
            <span className="text-sm text-gray-600">Ocupado y Activo</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
            <span className="text-sm text-gray-600">Disponible</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-50 border-2 border-red-300 rounded"></div>
            <span className="text-sm text-gray-600">Inactivo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
