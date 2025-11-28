import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { createOrder } from '../lib/inventory';
import type { Product } from '../lib/inventory';

// Types
interface CartItem extends Product {
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'TOGGLE_CART' }
  | { type: 'CLEAR_CART' };

interface CartContextType {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  checkout: () => Promise<void>;
}

// Context
const CartContext = createContext<CartContextType | null>(null);

// Reducer
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          ),
          isOpen: true
        };
      }
      return {
        ...state,
        items: [...state.items, action.payload],
        isOpen: true
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };

    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ).filter(item => item.quantity > 0)
      };

    case 'TOGGLE_CART':
      return {
        ...state,
        isOpen: !state.isOpen
      };

    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        isOpen: false
      };

    default:
      return state;
  }
}

// Provider Component
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isOpen: false,
  });

  const checkout = useCallback(async () => {
    try {
      const orderItems = state.items.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      // Crear la orden (createOrder YA maneja la dispensación internamente)
      const orderId = await createOrder(orderItems);
      
      // La dispensación física ya fue manejada por createOrder
      console.log('Orden creada y productos dispensados correctamente');

      dispatch({ type: 'CLEAR_CART' });
      alert(`¡Orden #${orderId} creada con éxito!`);
    } catch (error) {
      console.error('Error en checkout:', error);
      if (error instanceof Error) {
        alert(`Error al procesar la orden: ${error.message}`);
      } else {
        alert('Error al procesar la orden');
      }
    }
  }, [state.items]);

  return (
    <CartContext.Provider value={{ state, dispatch, checkout }}>
      {children}
    </CartContext.Provider>
  );
}

// Custom Hook
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider');
  }
  return context;
}

// Types Export
export type { CartItem, CartState, CartAction, CartContextType };
