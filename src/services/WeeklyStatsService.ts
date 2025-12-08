// src/services/WeeklyStatsService.ts
import { db } from '../lib/db';
import type { DBSchema } from '../lib/db';

interface WeeklyStats {
  currentWeek: {
    revenue: number;
    sales: number;
    products: number;
    users: number;
    dailyRevenue: number[]; // Últimos 7 días
  };
  previousWeek: {
    revenue: number;
    sales: number;
    products: number;
    users: number;
  };
  trends: {
    revenue: { value: string; direction: 'up' | 'down' | 'neutral' };
    sales: { value: string; direction: 'up' | 'down' | 'neutral' };
    products: { value: string; direction: 'up' | 'down' | 'neutral' };
    users: { value: string; direction: 'up' | 'down' | 'neutral' };
  };
}

export class WeeklyStatsService {
  /**
   * Obtiene el inicio y fin de la semana actual (Lunes-Domingo)
   */
  private getWeekRange(date: Date = new Date()): { start: Date; end: Date } {
    const current = new Date(date);
    const day = current.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Ajustar para que Lunes sea el inicio
    
    const start = new Date(current);
    start.setDate(current.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }

  /**
   * Obtiene el rango de la semana anterior
   */
  private getPreviousWeekRange(): { start: Date; end: Date } {
    const currentWeekStart = this.getWeekRange().start;
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(currentWeekStart.getDate() - 1);
    
    return this.getWeekRange(previousWeekEnd);
  }

  /**
   * Filtra órdenes por rango de fechas
   */
  private filterOrdersByDateRange(orders: DBSchema['orders'][], start: Date, end: Date): DBSchema['orders'][] {
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });
  }

  /**
   * Calcula ingresos diarios para sparkline (hasta el día actual de la semana)
   */
  private async getDailyRevenue(): Promise<number[]> {
    const { start, end } = this.getWeekRange();
    const today = new Date();
    const orders = await db.getAll('orders');
    
    const dailyData: number[] = [];
    const currentDate = new Date(start);
    
    // Solo hasta el día actual si estamos en la semana actual
    while (currentDate <= Math.min(today.getTime(), end.getTime())) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayOrders = this.filterOrdersByDateRange(orders, dayStart, dayEnd);
      const dayRevenue = dayOrders
        .filter(o => o.paymentStatus === 'completed')
        .reduce((sum, order) => sum + order.total, 0);
      
      dailyData.push(dayRevenue);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Asegurar que siempre haya 7 puntos para el gráfico
    while (dailyData.length < 7) {
      dailyData.push(0);
    }
    
    return dailyData;
  }

  /**
   * Calcula el porcentaje de cambio y dirección de tendencia
   */
  private calculateTrend(current: number, previous: number): { value: string; direction: 'up' | 'down' | 'neutral' } {
    if (previous === 0) {
      return { 
        value: current > 0 ? '+100%' : '0%', 
        direction: current > 0 ? 'up' : 'neutral' 
      };
    }
    
    const percentChange = ((current - previous) / previous) * 100;
    const rounded = Math.abs(Math.round(percentChange));
    
    if (Math.abs(percentChange) < 1) {
      return { value: '0%', direction: 'neutral' };
    }
    
    return {
      value: `${percentChange > 0 ? '+' : '-'}${rounded}%`,
      direction: percentChange > 0 ? 'up' : 'down'
    };
  }

  /**
   * Obtiene todas las estadísticas semanales
   */
  async getWeeklyStats(): Promise<WeeklyStats> {
    const { start: currentStart, end: currentEnd } = this.getWeekRange();
    const { start: previousStart, end: previousEnd } = this.getPreviousWeekRange();
    const today = new Date();
    
    // Cargar datos
    const orders = await db.getAll('orders');
    const orderItems = await db.getAll('orderItems');
    const products = await db.getAll('products');
    const users = JSON.parse(localStorage.getItem('app_users') || '[]');
    
    // Filtrar órdenes por semana
    const currentWeekOrders = this.filterOrdersByDateRange(orders, currentStart, Math.min(today, currentEnd));
    const previousWeekOrders = this.filterOrdersByDateRange(orders, previousStart, previousEnd);
    
    // Calcular revenue (solo órdenes completadas)
    const currentRevenue = currentWeekOrders
      .filter(o => o.paymentStatus === 'completed')
      .reduce((sum, order) => sum + order.total, 0);
    
    const previousRevenue = previousWeekOrders
      .filter(o => o.paymentStatus === 'completed')
      .reduce((sum, order) => sum + order.total, 0);
    
    // Calcular ventas (items vendidos)
    const currentSales = orderItems
      .filter(item => {
        const order = currentWeekOrders.find(o => o.id === item.orderId);
        return order?.paymentStatus === 'completed';
      })
      .reduce((sum, item) => sum + item.quantity, 0);
    
    const previousSales = orderItems
      .filter(item => {
        const order = previousWeekOrders.find(o => o.id === item.orderId);
        return order?.paymentStatus === 'completed';
      })
      .reduce((sum, item) => sum + item.quantity, 0);
    
    // Obtener datos diarios para sparkline
    const dailyRevenue = await this.getDailyRevenue();
    
    // Productos y usuarios (totales actuales)
    const currentProducts = products.length;
    const currentUsers = users.length;
    
    // Para productos y usuarios, usar datos históricos si existen
    // Por ahora, asumimos que son relativamente estables
    const previousProducts = currentProducts;
    const previousUsers = currentUsers;
    
    return {
      currentWeek: {
        revenue: currentRevenue,
        sales: currentSales,
        products: currentProducts,
        users: currentUsers,
        dailyRevenue
      },
      previousWeek: {
        revenue: previousRevenue,
        sales: previousSales,
        products: previousProducts,
        users: previousUsers
      },
      trends: {
        revenue: this.calculateTrend(currentRevenue, previousRevenue),
        sales: this.calculateTrend(currentSales, previousSales),
        products: this.calculateTrend(currentProducts, previousProducts),
        users: this.calculateTrend(currentUsers, previousUsers)
      }
    };
  }
}

export const weeklyStatsService = new WeeklyStatsService();
export default weeklyStatsService;
