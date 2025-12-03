// src/lib/inventory.ts - Sistema de inventario con SRP

import { db } from './db';
import { dispenseService } from '../services/DispenseService';
import { authService } from './auth';
import { createOrderLimiter } from './rateLimiter';
import { stockService } from '../services/StockService';
import { loyaltyService } from '../services/LoyaltyService';
import logger from './logger';
import type { DBSchema } from './db';

export type Product = DBSchema['products'];
export type Order = DBSchema['orders'];
export type OrderItem = DBSchema['orderItems'];
export type StockMovement = DBSchema['stockMovements'];

const orderLimiter = createOrderLimiter();

/**
 * ✅ OPTIMIZACIÓN #8: Refactorizado con SRP
 * 
 * createOrder ahora SOLO:
 * - Valida rate limiting
 * - Crea la orden en BD
 * - Registra items de orden
 * - Orquesta servicios especializados
 * 
 * Delega responsabilidades a:
 * - StockService: Validación y actualización de stock
 * - LoyaltyService: Puntos de fidelidad
 * - DispenseService: Dispensación física
 */
export async function createOrder(
  items: { productId: number; quantity: number; price: number }[],
  paymentMethod: 'cash' | 'card' = 'cash'
): Promise<number> {
  // 🛡️ RATE LIMITING
  const currentUser = authService.getCurrentUser();
  const rateLimitKey = currentUser?.id?.toString() || 'anonymous';
  
  const rateLimitCheck = orderLimiter.checkLimit(rateLimitKey);
  if (!rateLimitCheck.allowed) {
    const errorMsg = rateLimitCheck.message || 'Demasiadas órdenes';
    logger.error(`[Inventory] 🔒 Orden bloqueada para ${rateLimitKey}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  logger.log(`[Inventory] 🛍️ Creando orden con ${items.length} producto(s)`);
  
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  logger.log(`[Inventory] 💰 Total de orden: $${total.toFixed(2)}`);

  // ✅ DELEGADO A StockService: Validar stock y cargar productos
  const productsMap = await stockService.validateStockAvailability(items);

  // Preparar items con productos
  const itemsWithProducts = items.map(item => ({
    item,
    product: productsMap.get(item.productId)!
  }));

  // 📋 Crear orden en BD
  logger.log('[Inventory] 📝 Registrando orden en BD...');
  const orderId = await db.add('orders', {
    userId: currentUser?.id,
    total,
    status: 'pending',
    paymentMethod,
    paymentStatus: 'pending',
    createdAt: new Date().toISOString()
  } as any);
  
  logger.log(`[Inventory] ✓ Orden #${orderId} creada en BD`);

  // ✅ DELEGADO A LoyaltyService: Agregar puntos de fidelidad
  if (currentUser) {
    await loyaltyService.addPointsToUser(currentUser, total);
  }

  // 📦 Procesar items de la orden
  logger.log('[Inventory] 📦 Procesando items de la orden...');
  
  try {
    // Registrar items en BD
    for (const { item } of itemsWithProducts) {
      await db.add('orderItems', {
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      } as any);
    }
    logger.log('[Inventory] ✓ Items registrados en orden');

    // ✅ DELEGADO A StockService: Actualizar stock
    await stockService.updateStockForOrder(orderId, itemsWithProducts);
    
    logger.log(`[Inventory] ✓✓✓ Orden #${orderId} completada exitosamente`);
  } catch (error) {
    logger.error('[Inventory] ❌ Error procesando items:', error);
    
    // Marcar orden como fallida
    const order = await db.get('orders', orderId);
    if (order) {
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await db.put('orders', order);
    }
    
    throw error;
  }

  // 🎯 Dispensación física
  logger.log('[Inventory] 🎯 Iniciando dispensación física...');
  try {
    const itemsToDispense = itemsWithProducts.map(({ item, product }) => ({
      productId: item.productId,
      title: product.title,
      quantity: item.quantity
    }));

    const dispenseResults = await dispenseService.dispenseOrder(itemsToDispense);
    
    dispenseResults.forEach(result => {
      if (result.success) {
        logger.log(`[Inventory]   ✓ ${result.message}`);
      } else {
        logger.warn(`[Inventory]   ⚠️ ${result.message}`);
      }
    });
    
    // Actualizar estado
    const order = await db.get('orders', orderId);
    if (order) {
      order.paymentStatus = 'completed';
      order.status = 'completed';
      await db.put('orders', order);
    }
    
    logger.log('[Inventory] ✓✓✓ Dispensación física completada');
  } catch (error) {
    logger.error('[Inventory] ❌ Error en dispensación física:', error);
    
    // Marcar pago como fallido
    const order = await db.get('orders', orderId);
    if (order) {
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      await db.put('orders', order);
    }
    
    logger.warn('[Inventory] ⚠️ Orden creada pero dispensación falló');
  }

  return orderId;
}

/**
 * Actualiza el stock de un producto
 * 👉 Considera usar StockService directamente
 */
export async function updateStock(
  productId: number,
  quantity: number,
  type: 'in' | 'out',
  note?: string
): Promise<number> {
  const product = await db.get('products', productId);
  if (!product) {
    throw new Error('Producto no encontrado');
  }

  return await stockService.updateProductStock(
    product,
    quantity,
    type,
    note || `Actualización manual de stock`
  );
}

export async function getAllProducts(): Promise<Product[]> {
  return db.getAll('products');
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return db.get('products', id);
}

export async function initializeDB(): Promise<void> {
  await db.init();
  
  const products = await getAllProducts();
  if (products.length === 0) {
    const initialProducts = [
      {
        title: "Arroz Premium Extra Largo - 1kg",
        price: 2.99,
        stock: 100,
        unit: "kg",
        image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Fideos Espagueti - 500g",
        price: 1.99,
        stock: 150,
        unit: "paquete",
        image: "https://images.unsplash.com/photo-1612969308146-066d55f37927?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Aceite de Oliva Extra Virgen - 750ml",
        price: 8.99,
        stock: 75,
        unit: "botella",
        image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.9,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Leche Entera - 1L",
        price: 1.49,
        stock: 200,
        unit: "litro",
        image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Pan Integral - 700g",
        price: 2.49,
        stock: 50,
        unit: "paquete",
        image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Huevos Orgánicos - 12 unidades",
        price: 4.99,
        stock: 80,
        unit: "docena",
        image: "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const product of initialProducts) {
      await db.add('products', product as any);
    }
  }
}

export { db };
