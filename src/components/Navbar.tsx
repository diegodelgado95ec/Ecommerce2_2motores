// src/components/Navbar.tsx - VERSIÓN CORREGIDA

import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Store } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { UserAccount } from './UserAccount'; // ✅ IMPORTAR

export function Navbar() {
  const { state, dispatch } = useCart();
  
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Store className="h-8 w-8 text-yellow-400" />
            <span className="ml-2 text-xl font-bold text-gray-900">MiniMarket</span>
          </Link>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* ✅ REEMPLAZAR: Usar UserAccount en lugar del link */}
            <UserAccount />

            {/* Cart Button */}
            <button
              onClick={() => dispatch({ type: 'TOGGLE_CART' })}
              className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
