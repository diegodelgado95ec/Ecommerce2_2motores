import { db } from './db';

// Tipo para lotes
export interface Batch {
  id?: number;
  productId: number;
  batchCode: string;      // Ej: "ArrPreExLa-A"
  quantity: number;       // Stock disponible en ese lote
  expiryDate: string;     // Fecha en formato 'YYYY-MM-DD'
}

// Añadir un nuevo lote a la tabla product_batches
export async function addBatch(batch: Batch): Promise<number> {
  // Si existe lote+producto, suma cantidad, si no, crea lote
  const existentes = await getBatchesByProduct(batch.productId);
  const coincide = existentes.find(
    b => b.batchCode === batch.batchCode
  );
  if (coincide) {
    // Suma cantidad al lote
    return updateBatchQuantity(coincide.id!, coincide.quantity + batch.quantity);
  }
  // Crea lote nuevo
  return db.add('product_batches', batch);
}

// Obtener todos los lotes de un producto (con stock)
export async function getBatchesByProduct(productId: number): Promise<Batch[]> {
  // Puedes adaptar este SELECT a tu motor de base de datos
  // Si usas IndexedDB, filtra manual:
  const allBatches = await db.getAll('product_batches');
  return allBatches.filter((b: Batch) => b.productId === productId);
}

// Actualiza la cantidad de un lote
export async function updateBatchQuantity(batchId: number, newQuantity: number): Promise<number> {
  const batch = await db.get('product_batches', batchId);
  if (!batch) throw new Error('Lote no encontrado');
  batch.quantity = newQuantity;
  await db.put('product_batches', batch);
  return batch.id!;
}

// Para consulta de lotes por vencer (días antes)
export async function getExpiringBatches(daysBefore: number): Promise<Batch[]> {
  const now = new Date();
  const soon = new Date();
  soon.setDate(now.getDate() + daysBefore);

  const allBatches = await db.getAll('product_batches');
  return allBatches.filter((b: Batch) => {
    const exp = new Date(b.expiryDate);
    return exp >= now && exp <= soon && b.quantity > 0;
  });
}

// Consumir lotes usando metodología FIFO (First In First Out)
// Descuenta de los lotes más antiguos primero
export async function consumeBatchesFIFO(productId: number, quantityToConsume: number): Promise<void> {
  const batches = await getBatchesByProduct(productId);
  
  // Ordenar por fecha de caducidad (más próximos a vencer primero - FIFO)
  const sortedBatches = batches
    .filter(b => b.quantity > 0)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  let remaining = quantityToConsume;

  for (const batch of sortedBatches) {
    if (remaining <= 0) break;

    if (batch.quantity <= remaining) {
      // Consumir el lote completo
      remaining -= batch.quantity;
      await updateBatchQuantity(batch.id!, 0);
    } else {
      // Consumir solo parte del lote
      await updateBatchQuantity(batch.id!, batch.quantity - remaining);
      remaining = 0;
    }
  }

  if (remaining > 0) {
    throw new Error(`No hay suficiente cantidad de lotes para el producto ${productId}`);
  }
}
