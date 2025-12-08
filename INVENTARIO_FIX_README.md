# 📦 FIX: Sistema de Inventario - Stock Inicial vs Stock Actual

## 🐛 Problema Original

**El sistema estaba modificando incorrectamente el Stock Inicial con cada venta:**

```
❌ ANTES (INCORRECTO):
Stock Inicial: 73  →  Venta de 11  →  Stock Inicial: 62 ❌
Stock Actual: 73   →  Venta de 11  →  Stock Actual: 62
Ventas: 0          →  Venta de 11  →  Ventas: 11
Diferencia: 0                          Diferencia: 0 ❌
```

**Resultado:** El Stock Inicial cambiaba con las ventas, perdiendo el registro de capacidad máxima del slot.

---

## ✅ Solución Implementada

### Nuevos Campos en Schema

```typescript
interface Product {
  id: number;
  title: string;
  price: number;
  stock: number;           // Stock actual (cantidad física disponible)
  initialStock?: number;   // ✨ NUEVO: Capacidad máxima del slot (FIJO)
  sales?: number;          // ✨ NUEVO: Ventas desde último reabastecimiento
  // ... otros campos
}
```

### Nueva Lógica

```
✓ AHORA (CORRECTO):

Stock Inicial: 73 (FIJO - no cambia con ventas)
Stock Actual: 73  →  Venta de 11  →  Stock Actual: 62 ✓
Ventas: 0         →  Venta de 11  →  Ventas: 11 ✓
Diferencia: 0                          Diferencia: -11 (73 - 62) ✓
```

---

## 🔄 Flujo de Operaciones

### 1. Venta (type: 'out')

```typescript
// Antes de la venta
initialStock: 73 (fijo)
stock: 62
sales: 11

// Venta de 5 unidades
// Resultado:
initialStock: 73  // NO CAMBIA ✓
stock: 57         // 62 - 5
sales: 16         // 11 + 5
diferencia: -16   // 73 - 57
```

### 2. Reabastecimiento (type: 'in')

```typescript
// Antes del reabastecimiento
initialStock: 73 (fijo)
stock: 57
sales: 16

// Reabastecimiento de +10 unidades
// Resultado:
initialStock: 73  // NO CAMBIA ✓
stock: 67         // 57 + 10
sales: 0          // RESETEA a 0 ✓
diferencia: -6    // 73 - 67
```

### 3. Primera Entrada (sin initialStock)

```typescript
// Producto nuevo sin initialStock
initialStock: undefined
stock: 0

// Primera entrada de 100 unidades
// Resultado:
initialStock: 100  // SE ESTABLECE en primera entrada ✓
stock: 100
sales: 0
diferencia: 0
```

---

## 📊 Cálculo de Diferencia

```typescript
// Fórmula:
diferencia = stock_actual - initialStock

// Interpretación:
// Positivo (+)  : Hay más stock del inicial (azul)
// Cero (0)      : Stock igual al inicial (verde) ✅
// Negativo (-)  : Falta stock respecto al inicial (rojo)
```

### Ejemplos:

| Stock Inicial | Stock Actual | Diferencia | Color | Significado |
|--------------|--------------|------------|-------|-------------|
| 73 | 73 | 0 | 🟢 Verde | Lleno (ideal) |
| 73 | 62 | -11 | 🔴 Rojo | Faltan 11 unidades |
| 73 | 80 | +7 | 🔵 Azul | Sobrepasado (raro) |

---

## 🛠️ Archivos Modificados

### 1. **src/lib/db.ts**
- ✨ Agregado `initialStock` y `sales` al schema de productos
- ✨ Agregado store `stockAdjustments` para historial detallado
- 🔄 Incrementada versión de BD a 4

### 2. **src/services/StockService.ts**
- ✨ Lógica para manejar `initialStock` (fijo)
- ✨ Incrementar `sales` en ventas (type: 'out')
- ✨ Resetear `sales` a 0 en reabastecimiento (type: 'in')
- ✨ Método `getStockDifference()` para calcular diferencia

### 3. **src/components/admin/InventoryManager.tsx**
- ✨ Establecer `initialStock` en primera entrada
- ✨ No modificar `initialStock` en reabastecimientos
- ✨ Mostrar Stock Inicial en tabla de inventario

### 4. **src/lib/migrations/setInitialStock.ts** (✨ NUEVO)
- Script de migración automática
- Establece `initialStock = stock` para productos existentes
- Inicializa `sales = 0`
- Se ejecuta UNA VEZ automáticamente

### 5. **src/lib/inventory.ts**
- ✨ Llamada a `migrateInitialStock()` en `initializeDB()`

---

## 🚀 Cómo Usar

### En VS Code:

```bash
git pull origin ramaIA
npm install
npm run dev
```

### La migración se ejecuta automáticamente al iniciar la app

La primera vez que cargues la app después del pull:

1. Se ejecutará la migración automáticamente
2. Verás en consola:
   ```
   🔄 Iniciando migración de initialStock...
   • Arroz Premium: initialStock establecido en 73
   • Fideos: initialStock establecido en 143
   ...
   ✓ Migración completada: 7 productos actualizados
   ```
3. La migración NO se volverá a ejecutar (usa localStorage)

### Testing Manual (Consola del Navegador):

```javascript
// Ver productos actuales
const products = await db.getAll('products');
console.table(products.map(p => ({
  title: p.title,
  initialStock: p.initialStock,
  stock: p.stock,
  sales: p.sales,
  diferencia: p.stock - (p.initialStock || p.stock)
})));

// Forzar re-ejecución de migración (testing)
window.resetInitialStockMigration();
await window.migrateInitialStock();
```

---

## 📝 Ejemplo Completo

### Escenario:

```
1. CONFIGURACIÓN INICIAL:
   Producto: Arroz Premium
   Stock Inicial: 100 (capacidad del slot)
   Stock Actual: 100
   Sales: 0

2. VENTA DE 15 UNIDADES:
   Stock Inicial: 100 (sin cambio)
   Stock Actual: 85
   Sales: 15
   Diferencia: -15 (100 - 85) 🔴

3. VENTA DE 10 UNIDADES MÁS:
   Stock Inicial: 100 (sin cambio)
   Stock Actual: 75
   Sales: 25
   Diferencia: -25 (100 - 75) 🔴

4. REABASTECIMIENTO DE 20 UNIDADES:
   Stock Inicial: 100 (sin cambio)
   Stock Actual: 95 (75 + 20)
   Sales: 0 (reseteado)
   Diferencia: -5 (100 - 95) 🔴

5. REABASTECIMIENTO COMPLETO (+5):
   Stock Inicial: 100 (sin cambio)
   Stock Actual: 100
   Sales: 0 (ya estaba en 0)
   Diferencia: 0 (100 - 100) 🟢 IDEAL
```

---

## ✅ Validaciones

### En Control de Inventario (InventoryTable):

| Columna | Fórmula | Descripción |
|---------|---------|-------------|
| Stock Inicial | `product.initialStock \|\| product.stock` | Capacidad máxima (fijo) |
| Stock Actual | `product.stock` | Cantidad física actual |
| Diferencia | `stock - initialStock` | Código de colores |
| Ventas | `product.sales \|\| 0` | Desde último reabastecimiento |

---

## 🐛 Troubleshooting

### Problema: "Productos sin initialStock"
**Solución:** La migración lo establece automáticamente

### Problema: "Diferencia siempre en 0"
**Solución:** 
```javascript
// En consola:
window.resetInitialStockMigration();
await window.migrateInitialStock();
```

### Problema: "Sales no se resetean"
**Solución:** Verificar que estés usando type: 'in' en reabastecimiento

---

## 📊 Commits Realizados

1. [3d56e32](https://github.com/diegodelgado95ec/Ecommerce2_2motores/commit/3d56e328047c77d15a105b33cfb6940bb845f5ae) - Schema con initialStock y sales
2. [5501742](https://github.com/diegodelgado95ec/Ecommerce2_2motores/commit/5501742fe9fbe99cdd20a2da4216ac09753330b0) - StockService actualizado
3. [9a44d7b](https://github.com/diegodelgado95ec/Ecommerce2_2motores/commit/9a44d7b792b67ad5b6d13a28183a6aa7c70b1dc2) - InventoryManager fix
4. [cd89f4d](https://github.com/diegodelgado95ec/Ecommerce2_2motores/commit/cd89f4d0327a6087d0870a3d495b449cc1f30016) - Script de migración
5. [c2bdc15](https://github.com/diegodelgado95ec/Ecommerce2_2motores/commit/c2bdc151c972956dc37137ae5e46e894ee5c66a9) - Integración de migración

---

## ✅ Estado: COMPLETADO

**Listo para:**
- `git pull origin ramaIA`
- Probar sistema de inventario corregido
- Verificar diferencias de stock
- Continuar con otras mejoras

---

🎉 **Fix de inventario completado exitosamente!**
