import { db } from './db';
import { dispenseService } from '../services/DispenseService';
import { authService } from './auth';
import type { DBSchema } from './db';

export type Product = DBSchema['products'];
export type Order = DBSchema['orders'];
export type OrderItem = DBSchema['orderItems'];
export type StockMovement = DBSchema['stockMovements'];

/**
 * Actualiza el stock de un producto
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

  const newStock = type === 'in' ? product.stock + quantity : product.stock - quantity;
  if (newStock < 0) {
    throw new Error('Stock insuficiente');
  }

  await db.put('products', {
    ...product,
    stock: newStock,
    updatedAt: new Date().toISOString()
  } as any);

  await db.add('stockMovements', {
    productId,
    quantity,
    type,
    note,
    createdAt: new Date().toISOString()
  } as any);

  return newStock;
}

/**
 * ✅ OPTIMIZADO: Crear orden sin N+1 queries
 * Complejidad: O(n) en lugar de O(n²)
 * 
 * Antes: 4N queries (1 get por validación + 1 get por item + 1 get por dispensación + 1 put por stock)
 * Ahora: ~4 queries (1 getAll + 1 transacción con N operaciones + 1 get orden + 1 put orden)
 */
export async function createOrder(
  items: { productId: number; quantity: number; price: number }[],
  paymentMethod: 'cash' | 'card' = 'cash'
): Promise<number> {
  console.log('[inventory.createOrder] 🛍️ Creando orden con', items.length, 'producto(s)');
  
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  console.log('[inventory.createOrder] 💰 Total de orden: $', total.toFixed(2));

  // ✅ OPTIMIZACIÓN 1: Cargar TODOS los productos de una vez (1 query en lugar de N)
  console.log('[inventory.createOrder] ✓ Cargando productos de la orden...');
  const allProducts = await db.getAll('products');
  
  // Crear Map para acceso O(1)
  const productsMap = new Map(allProducts.map(p => [p.id!, p]));
  console.log(`[inventory.createOrder] ✓ ${allProducts.length} productos cargados en memoria`);

  // ✅ OPTIMIZACIÓN 2: Validar stock usando el Map (sin queries adicionales)
  console.log('[inventory.createOrder] ✓ Validando stock disponible...');
  const itemsWithProducts = items.map(item => {
    const product = productsMap.get(item.productId);
    if (!product) {
      throw new Error(`Producto ID ${item.productId} no encontrado`);
    }
    if (product.stock < item.quantity) {
      throw new Error(`Stock insuficiente para ${product.title}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`);
    }
    return { item, product };
  });
  console.log('[inventory.createOrder] ✓ Stock validado correctamente');

  // Obtener usuario actual (si está logueado)
  const currentUser = authService.getCurrentUser();

  // Crear orden en BD
  console.log('[inventory.createOrder] 📝 Registrando orden en BD...');
  const orderId = await db.add('orders', {
    userId: currentUser?.id,
    total,
    status: 'pending',
    paymentMethod,
    paymentStatus: 'pending',
    createdAt: new Date().toISOString()
  } as any);
  
  console.log(`[inventory.createOrder] ✓ Orden #${orderId} creada en BD`);

  // Si es usuario registrado, sumar puntos de fidelidad
  if (currentUser) {
    const pointsEarned = Math.floor(total * 10);
    currentUser.loyaltyPoints += pointsEarned;
    currentUser.updatedAt = new Date().toISOString() as any;
    await db.put('users', currentUser);
    console.log(`[inventory.createOrder] 🎁 ${pointsEarned} puntos de fidelidad agregados`);
  }

  // ✅ OPTIMIZACIÓN 3: Registrar items y actualizar stock en UNA SOLA TRANSACCIÓN
  console.log('[inventory.createOrder] 📦 Procesando items de la orden (transacción atómica)...');
  
  try {
    // Usar transacción para garantizar atomicidad
    await db.transaction(['orderItems', 'products', 'stockMovements'], 'readwrite', async () => {
      for (const { item, product } of itemsWithProducts) {
        console.log(`[inventory.createOrder]   • Procesando: ${product.title} (ID: ${item.productId}, Qty: ${item.quantity})`);
        
        // Agregar orderItem
        await db.add('orderItems', {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        } as any);
        console.log(`[inventory.createOrder]     ✓ Item registrado en orden #${orderId}`);

        // Actualizar stock del producto
        const newStock = product.stock - item.quantity;
        await db.put('products', {
          ...product,
          stock: newStock,
          updatedAt: new Date().toISOString()
        } as any);

        // Registrar movimiento de stock
        await db.add('stockMovements', {
          productId: item.productId,
          quantity: item.quantity,
          type: 'out' as const,
          note: `Orden #${orderId}`,
          createdAt: new Date().toISOString()
        } as any);
        
        console.log(`[inventory.createOrder]     ✓ Stock actualizado: ${product.stock} → ${newStock}`);
      }
    });
    
    console.log(`[inventory.createOrder] ✓✓✓ Orden #${orderId} completada exitosamente`);
  } catch (error) {
    console.error('[inventory.createOrder] ❌ Error en transacción:', error);
    
    // Marcar orden como fallida
    const order = await db.get('orders', orderId);
    if (order) {
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await db.put('orders', order);
    }
    
    throw error;
  }

  // ✅ OPTIMIZACIÓN 4: Preparar items para dispensación (sin queries adicionales)
  console.log('[inventory.createOrder] 🎯 Iniciando dispensación física de productos...');
  try {
    // Usar el Map ya cargado (sin queries adicionales)
    const itemsToDispense = itemsWithProducts.map(({ item, product }) => ({
      productId: item.productId,
      title: product.title,
      quantity: item.quantity
    }));

    const dispenseResults = await dispenseService.dispenseOrder(itemsToDispense);
    
    dispenseResults.forEach(result => {
      if (result.success) {
        console.log(`[inventory.createOrder]   ✓ ${result.message}`);
      } else {
        console.warn(`[inventory.createOrder]   ⚠️ ${result.message}`);
      }
    });
    
    // Actualizar estado de pago a completado
    const order = await db.get('orders', orderId);
    if (order) {
      order.paymentStatus = 'completed';
      order.status = 'completed';
      await db.put('orders', order);
    }
    
    console.log('[inventory.createOrder] ✓✓✓ Dispensación física completada');
  } catch (error) {
    console.error('[inventory.createOrder] ❌ Error en dispensación física:', error);
    
    // Marcar pago como fallido
    const order = await db.get('orders', orderId);
    if (order) {
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      await db.put('orders', order);
    }
    
    console.warn('[inventory.createOrder] ⚠️ Orden creada pero dispensación falló');
  }

  return orderId;
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
