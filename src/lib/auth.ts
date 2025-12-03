// src/lib/auth.ts - Sistema de autenticación con Rate Limiting

import { db } from './db';
import { createLoginLimiter } from './rateLimiter';
import type { DBSchema } from './db';

type User = DBSchema['users'];
type Session = DBSchema['sessions'];

// ✅ Crear limitadores para login y registro
const loginLimiter = createLoginLimiter();
const registerLimiter = createLoginLimiter(); // Usar misma config (3/5min)

/**
 * Clase para manejar autenticación y autorización
 */
class AuthService {
  private currentSession: Session | null = null;
  private currentUser: User | null = null;

  /**
   * Hash de contraseña usando Web Crypto API (nativo del navegador)
   */
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifica si una contraseña coincide con el hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  /**
   * Genera un token aleatorio seguro para sesión
   */
  generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Registrar un nuevo usuario
   * ✅ CON RATE LIMITING
   */
  async register(
    email: string,
    password: string,
    name: string,
    role: 'admin' | 'customer' = 'customer',
    phone?: string
  ): Promise<User> {
    // ✅ RATE LIMITING: Verificar límite de registros
    const rateLimitCheck = registerLimiter.checkLimit(email);
    if (!rateLimitCheck.allowed) {
      const errorMsg = rateLimitCheck.message || 'Demasiados intentos de registro';
      console.error(`[Auth] 🔒 Registro bloqueado para ${email}: ${errorMsg}`);
      
      // Registrar intento bloqueado
      await this.logAccess(undefined, 'register_rate_limited', 'user', false, email);
      
      throw new Error(errorMsg);
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Email inválido');
    }

    // Validar contraseña (mínimo 8 caracteres, 1 mayúscula, 1 número)
    if (password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('La contraseña debe contener al menos una mayúscula');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('La contraseña debe contener al menos un número');
    }

    // Verificar si el email ya existe
    const existingUser = await db.getByIndex('users', 'email', email);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Crear usuario
    const passwordHash = await this.hashPassword(password);
    const userId = await db.add('users', {
      email,
      passwordHash,
      role,
      name,
      phone,
      isActive: true,
      loyaltyPoints: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    // Log de registro exitoso
    await this.logAccess(userId, 'register', 'user', true);

    const user = await db.get('users', userId);
    if (!user) throw new Error('Error al crear usuario');

    console.log(`[Auth] ✓ Usuario registrado: ${email}`);
    return user;
  }

  /**
   * Iniciar sesión
   * ✅ CON RATE LIMITING AGRESIVO (Prioridad ALTA)
   */
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // ✅ RATE LIMITING: Verificar límite de intentos de login
    const rateLimitCheck = loginLimiter.checkLimit(email);
    if (!rateLimitCheck.allowed) {
      const errorMsg = rateLimitCheck.message || 'Demasiados intentos de login';
      console.error(`[Auth] 🔒 Login bloqueado para ${email}: ${errorMsg}`);
      
      // Registrar intento bloqueado
      await this.logAccess(undefined, 'login_rate_limited', 'user', false, email);
      
      throw new Error(errorMsg);
    }

    // Buscar usuario por email
    const user = await db.getByIndex('users', 'email', email);
    
    if (!user) {
      await this.logAccess(undefined, 'login_failed', 'user', false, email);
      throw new Error('Email o contraseña incorrectos');
    }

    // Verificar si está activo
    if (!user.isActive) {
      await this.logAccess(user.id, 'login_inactive', 'user', false, email);
      throw new Error('Usuario inactivo. Contacte al administrador');
    }

    // Verificar contraseña
    const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      await this.logAccess(user.id, 'login_failed', 'user', false, email);
      throw new Error('Email o contraseña incorrectos');
    }

    // ✅ Login exitoso: Resetear contador de rate limit
    loginLimiter.reset(email);

    // Crear sesión
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const sessionId = await db.add('sessions', {
      userId: user.id!,
      token,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    } as any);

    const session = await db.get('sessions', sessionId);
    if (!session) throw new Error('Error al crear sesión');

    // Guardar sesión en memoria
    this.currentSession = session;
    this.currentUser = user;

    // Guardar token en localStorage
    localStorage.setItem('auth_token', token);

    // Log de login exitoso
    await this.logAccess(user.id, 'login_success', 'user', true, email);

    console.log(`[Auth] ✓ Login exitoso: ${email} (${user.role})`);
    return { user, token };
  }

  /**
   * Cerrar sesión
   */
  async logout(): Promise<void> {
    if (this.currentSession) {
      await db.delete('sessions', this.currentSession.id!);
      await this.logAccess(this.currentUser?.id, 'logout', 'user', true);
    }

    this.currentSession = null;
    this.currentUser = null;
    localStorage.removeItem('auth_token');
    
    console.log('[Auth] ✓ Logout exitoso');
  }

  /**
   * Verificar si hay una sesión activa
   */
  async checkSession(): Promise<User | null> {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    // Buscar sesión por token
    const session = await db.getByIndex('sessions', 'token', token);
    if (!session) {
      localStorage.removeItem('auth_token');
      return null;
    }

    // Verificar si la sesión expiró
    if (new Date(session.expiresAt) < new Date()) {
      await db.delete('sessions', session.id!);
      localStorage.removeItem('auth_token');
      console.log('[Auth] Sesión expirada');
      return null;
    }

    // Obtener usuario
    const user = await db.get('users', session.userId);
    if (!user || !user.isActive) {
      await db.delete('sessions', session.id!);
      localStorage.removeItem('auth_token');
      return null;
    }

    this.currentSession = session;
    this.currentUser = user;

    return user;
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Verificar si el usuario actual es administrador
   */
  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Middleware para verificar permiso de administrador
   */
  requireAdmin(): void {
    if (!this.isAuthenticated()) {
      throw new Error('Debe iniciar sesión para acceder a esta función');
    }
    if (!this.isAdmin()) {
      throw new Error('No tiene permisos de administrador');
    }
  }

  /**
   * ✅ Registrar acceso en logs (con email opcional para tracking)
   */
  private async logAccess(
    userId: number | undefined,
    action: string,
    resource: string,
    success: boolean,
    email?: string
  ): Promise<void> {
    try {
      await db.add('access_logs', {
        userId,
        action,
        resource,
        success,
        metadata: email ? JSON.stringify({ email }) : undefined,
        createdAt: new Date().toISOString(),
      } as any);
    } catch (error) {
      console.error('[Auth] Error logging access:', error);
    }
  }

  /**
   * Crear usuario administrador por defecto (solo si no existe ninguno)
   */
  async createDefaultAdmin(): Promise<void> {
    const allUsers = await db.getAll('users');
    const admins = allUsers.filter(u => u.role === 'admin');

    if (admins.length === 0) {
      console.log('[Auth] Creando usuario administrador por defecto...');
      await this.register(
        'admin@store.local',
        'Admin123!',
        'Administrador',
        'admin'
      );
      console.log('[Auth] ✓ Usuario admin creado: admin@store.local / Admin123!');
    }
  }

  /**
   * ✅ NUEVO: Obtener estadísticas de rate limiting (para admin)
   */
  getRateLimitStats(email: string) {
    return {
      login: loginLimiter.getStats(email),
      register: registerLimiter.getStats(email)
    };
  }

  /**
   * ✅ NUEVO: Desbloquear usuario manualmente (solo admin)
   */
  unlockUser(email: string): void {
    this.requireAdmin();
    loginLimiter.unlock(email);
    registerLimiter.unlock(email);
    console.log(`[Auth] 🔓 Usuario desbloqueado: ${email}`);
  }
}

export const authService = new AuthService();
export default authService;
