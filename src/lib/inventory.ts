import { db } from './db';
import { dispenseService } from '../services/DispenseService';
import type { DBSchema } from './db';

export type Product = DBSchema['products'];
export type Order = DBSchema['orders'];
export type OrderItem = DBSchema['orderItems'];
export type StockMovement = DBSchema['stockMovements'];

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
    updatedAt: new Date()
  });

  await db.add('stockMovements', {
    productId,
    quantity,
    type,
    note,
    createdAt: new Date()
  });

  return newStock;
}

export async function createOrder(
  items: { productId: number; quantity: number; price: number }[]
): Promise<number> {
  console.log('[inventory.createOrder] 🛒 Creando orden con', items.length, 'producto(s)');
  
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  console.log('[inventory.createOrder] 💰 Total de orden: $', total.toFixed(2));

  // Validar stock disponible
  console.log('[inventory.createOrder] ✓ Validando stock disponible...');
  for (const item of items) {
    const product = await db.get('products', item.productId);
    if (!product || product.stock < item.quantity) {
      throw new Error(`Stock insuficiente para el producto ${product?.title}`);
    }
  }
  console.log('[inventory.createOrder] ✓ Stock validado correctamente');

  // Crear orden en BD
  console.log('[inventory.createOrder] 📝 Registrando orden en BD...');
  const orderId = await db.add('orders', {
    total,
    status: 'pending',
    createdAt: new Date()
  });
  console.log(`[inventory.createOrder] ✓ Orden #${orderId} creada en BD`);

  // Registrar items y actualizar stock
  console.log('[inventory.createOrder] 📦 Procesando items de la orden...');
  for (const item of items) {
    const product = await db.get('products', item.productId);
    console.log(`[inventory.createOrder]   • Procesando: ${product?.title} (ID: ${item.productId}, Qty: ${item.quantity})`);
    
    await db.add('orderItems', {
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price
    });
    console.log(`[inventory.createOrder]     ✓ Item registrado en orden #${orderId}`);

    await updateStock(item.productId, item.quantity, 'out', `Orden #${orderId}`);
    console.log('[inventory.createOrder]     ✓ Stock actualizado');
  }
  console.log(`[inventory.createOrder] ✓✓✓ Orden #${orderId} completada exitosamente`);

  // DISPENSAR PRODUCTOS FÍSICAMENTE
  console.log('[inventory.createOrder] 🎯 Iniciando dispensación física de productos...');
  try {
    // Preparar items para dispensación (con la propiedad 'title' que espera DispenseService)
    const itemsToDispense = await Promise.all(
      items.map(async (item) => {
        const product = await db.get('products', item.productId);
        return {
          productId: item.productId,
          title: product?.title || `Producto ${item.productId}`,
          quantity: item.quantity
        };
      })
    );

    // Dispensar productos
    const dispenseResults = await dispenseService.dispenseOrder(itemsToDispense);
    
    // Mostrar resultados
    dispenseResults.forEach(result => {
      if (result.success) {
        console.log(`[inventory.createOrder]   ✓ ${result.message}`);
      } else {
        console.warn(`[inventory.createOrder]   ⚠️ ${result.message}`);
      }
    });
    
    console.log('[inventory.createOrder] ✓✓✓ Dispensación física completada');
  } catch (error) {
    console.error('[inventory.createOrder] ❌ Error en dispensación física:', error);
    // No lanzar error para que la orden se complete aunque falle la dispensación
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: "Fideos Espagueti - 500g",
        price: 1.99,
        stock: 150,
        unit: "paquete",
        image: "https://images.unsplash.com/photo-1612969308146-066d55f37927?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: "Aceite de Oliva Extra Virgen - 750ml",
        price: 8.99,
        stock: 75,
        unit: "botella",
        image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.9,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: "Leche Entera - 1L",
        price: 1.49,
        stock: 200,
        unit: "litro",
        image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: "Pan Integral - 700g",
        price: 2.49,
        stock: 50,
        unit: "paquete",
        image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.7,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: "Huevos Orgánicos - 12 unidades",
        price: 4.99,
        stock: 80,
        unit: "docena",
        image: "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
        rating: 4.8,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const product of initialProducts) {
      await db.add('products', product);
    }
  }
}

export { db };
