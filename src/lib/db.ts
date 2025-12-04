// src/lib/db.ts - ACTUALIZADO CON SLOTS

export interface DBSchema {
  products: {
    id: number;
    title: string;
    price: number;
    stock: number;
    unit: string;
    image: string;
    rating: number;
    createdAt: string;
    updatedAt: string;
    // ✨ NUEVOS CAMPOS FASE 2: Gestión de Slots Físicos
    slotPosition?: number;      // Posición física (1, 2, 3, ...)
    bandDistance?: number;       // Distancia en cm para la banda
    isSlotActive?: boolean;      // Si el slot está operativo
    lastCalibration?: string;    // Última calibración del slot
  };
  
  users: {
    id: number;
    email: string;
    passwordHash: string;
    role: 'admin' | 'customer';
    name: string;
    phone?: string;
    isActive: boolean;
    loyaltyPoints: number;
    createdAt: string;
    updatedAt: string;
  };
  
  sessions: {
    id: number;
    userId: number;
    token: string;
    expiresAt: string;
    createdAt: string;
  };
  
  orders: {
    id: number;
    userId?: number;
    total: number;
    status: string;
    paymentMethod: 'cash' | 'card' | 'pending';
    paymentStatus: 'pending' | 'completed' | 'failed';
    createdAt: string;
  };
  
  orderItems: {
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    price: number;
  };
  
  stockMovements: {
    id: number;
    productId: number;
    quantity: number;
    type: 'in' | 'out';
    note?: string;
    createdAt: string;
  };
  
  product_batches: {
    id: number;
    productId: number;
    batchCode: string;
    quantity: number;
    expiryDate: string;
  };
  
  access_logs: {
    id: number;
    userId?: number;
    action: string;
    resource: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    createdAt: string;
  };
}

class DB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'storeDB';
  private readonly version = 3; // ✅ Incrementar versión para slots

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Productos
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          productStore.createIndex('title', 'title', { unique: false });
          productStore.createIndex('stock', 'stock', { unique: false });
          productStore.createIndex('slotPosition', 'slotPosition', { unique: false }); // ✨ NUEVO índice
        } else {
          // Si ya existe, intentar agregar el índice en actualización
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const productStore = transaction.objectStore('products');
            if (!productStore.indexNames.contains('slotPosition')) {
              productStore.createIndex('slotPosition', 'slotPosition', { unique: false });
            }
          }
        }

        // Usuarios
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          userStore.createIndex('email', 'email', { unique: true });
          userStore.createIndex('role', 'role', { unique: false });
          userStore.createIndex('isActive', 'isActive', { unique: false });
        }

        // Sesiones
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          sessionStore.createIndex('token', 'token', { unique: true });
          sessionStore.createIndex('userId', 'userId', { unique: false });
          sessionStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Logs de acceso
        if (!db.objectStoreNames.contains('access_logs')) {
          const logStore = db.createObjectStore('access_logs', { keyPath: 'id', autoIncrement: true });
          logStore.createIndex('userId', 'userId', { unique: false });
          logStore.createIndex('action', 'action', { unique: false });
          logStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Órdenes
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
          orderStore.createIndex('userId', 'userId', { unique: false });
          orderStore.createIndex('status', 'status', { unique: false });
          orderStore.createIndex('paymentStatus', 'paymentStatus', { unique: false });
          orderStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Lotes de producto
        if (!db.objectStoreNames.contains('product_batches')) {
          const batchStore = db.createObjectStore('product_batches', { keyPath: 'id', autoIncrement: true });
          batchStore.createIndex('productId', 'productId', { unique: false });
          batchStore.createIndex('expiryDate', 'expiryDate', { unique: false });
        }

        // Items de orden
        if (!db.objectStoreNames.contains('orderItems')) {
          const orderItemStore = db.createObjectStore('orderItems', { keyPath: 'id', autoIncrement: true });
          orderItemStore.createIndex('orderId', 'orderId', { unique: false });
          orderItemStore.createIndex('productId', 'productId', { unique: false });
        }

        // Movimientos de stock
        if (!db.objectStoreNames.contains('stockMovements')) {
          const stockMovementStore = db.createObjectStore('stockMovements', { keyPath: 'id', autoIncrement: true });
          stockMovementStore.createIndex('productId', 'productId', { unique: false });
          stockMovementStore.createIndex('type', 'type', { unique: false });
          stockMovementStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async getByIndex<T extends keyof DBSchema>(
    storeName: T,
    indexName: string,
    value: any
  ): Promise<DBSchema[T] | undefined> {
    return this.transaction(storeName, 'readonly', async (store) => {
      return new Promise((resolve, reject) => {
        const index = store.index(indexName);
        const request = index.get(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getAllByIndex<T extends keyof DBSchema>(
    storeName: T,
    indexName: string,
    value: any
  ): Promise<DBSchema[T][]> {
    return this.transaction(storeName, 'readonly', async (store) => {
      return new Promise((resolve, reject) => {
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async transaction<T>(
    storeName: keyof DBSchema,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      transaction.oncomplete = () => resolve;
      transaction.onerror = () => reject(transaction.error);

      Promise.resolve(callback(store))
        .then(resolve)
        .catch(reject);
    });
  }

  async getAll<T extends keyof DBSchema>(storeName: T): Promise<DBSchema[T][]> {
    return this.transaction(storeName, 'readonly', async (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async get<T extends keyof DBSchema>(
    storeName: T,
    id: number
  ): Promise<DBSchema[T] | undefined> {
    return this.transaction(storeName, 'readonly', async (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async add<T extends keyof DBSchema>(
    storeName: T,
    data: Omit<DBSchema[T], 'id'>
  ): Promise<number> {
    return this.transaction(storeName, 'readwrite', async (store) => {
      return new Promise((resolve, reject) => {
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async put<T extends keyof DBSchema>(
    storeName: T,
    data: DBSchema[T]
  ): Promise<void> {
    return this.transaction(storeName, 'readwrite', async (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async delete<T extends keyof DBSchema>(
    storeName: T,
    id: number
  ): Promise<void> {
    return this.transaction(storeName, 'readwrite', async (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }
}

export const db = new DB();
export default db;
