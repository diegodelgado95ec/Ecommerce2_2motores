// src/components/admin/UserManagement.tsx - VERSIÓN CORREGIDA

import React, { useState, useEffect } from 'react';
import { Trash2, UserPlus, AlertCircle } from 'lucide-react';
import { authService } from '../../lib/auth';
import { db } from '../../lib/db';

interface User {
  id?: number;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  phone?: string;
  isActive: boolean;
  loyaltyPoints: number;
  createdAt: string;
  updatedAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'customer' as 'admin' | 'customer'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await db.getAll('users');
      setUsers(allUsers);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setError('Error al cargar usuarios');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validar contraseña
      if (newUser.password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres');
        setLoading(false);
        return;
      }

      if (!/[A-Z]/.test(newUser.password)) {
        setError('La contraseña debe contener al menos una mayúscula');
        setLoading(false);
        return;
      }

      if (!/[0-9]/.test(newUser.password)) {
        setError('La contraseña debe contener al menos un número');
        setLoading(false);
        return;
      }

      // Crear usuario usando authService
      await authService.register(
        newUser.email,
        newUser.password,
        newUser.name,
        newUser.role,
        newUser.phone || undefined
      );

      setSuccess(`Usuario ${newUser.role === 'admin' ? 'administrador' : 'cliente'} creado exitosamente`);
      
      // Limpiar formulario
      setNewUser({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'customer'
      });

      // Recargar lista de usuarios
      await loadUsers();

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Error al crear usuario:', err);
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) {
      return;
    }

    try {
      await db.delete('users', id);
      setSuccess('Usuario eliminado exitosamente');
      await loadUsers();

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      setError('Error al eliminar usuario');
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulario de Nuevo Usuario */}
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Nuevo Usuario</h3>
            <p className="mt-1 text-sm text-gray-500">
              Crear una nueva cuenta de usuario en el sistema.
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-2">
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700">✅ {success}</p>
                </div>
              )}
              
              <div className="grid grid-cols-6 gap-6">
                <div className="col-span-6 sm:col-span-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="col-span-6 sm:col-span-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="col-span-6 sm:col-span-4">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    disabled={loading}
                  />
                </div>

                <div className="col-span-6 sm:col-span-4">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                    minLength={8}
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Mínimo 8 caracteres, 1 mayúscula y 1 número
                  </p>
                </div>

                <div className="col-span-6 sm:col-span-4">
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Rol
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'customer' })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    disabled={loading}
                  >
                    <option value="customer">Cliente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-5">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  {loading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Usuarios Registrados</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Puntos
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'admin' ? 'Administrador' : 'Cliente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.loyaltyPoints || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(user.id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="h-5 w-5" />
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
  );
}
