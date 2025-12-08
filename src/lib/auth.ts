// src/lib/auth.ts - Sistema de autenticación con Logger

import { db } from './db';
import { loginLimiter, registerLimiter } from './securityMiddleware';
import logger from './logger';
import type { DBSchema } from './db';

type User = DBSchema['users'];
type Session = DBSchema['sessions'];

class AuthService {
  private currentSession: Session | null = null;
  private currentUser: User | null = null;

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async register(
    email: string,
    password: string,
    name: string,
    role: 'admin' | 'customer' = 'customer',
    phone?: string
  ): Promise<User> {
    const rateLimitCheck = registerLimiter.checkLimit(email);
    if (!rateLimitCheck.allowed) {
      const errorMsg = rateLimitCheck.message || 'Demasiados intentos de registro';
      logger.error(`[Auth] 🔒 Registro bloqueado para ${email}: ${errorMsg}`);
      await this.logAccess(undefined, 'register_rate_limited', 'user', false, email);
      throw new Error(errorMsg);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Email inválido');
    }

    if (password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('La contraseña debe contener al menos una mayúscula');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('La contraseña debe contener al menos un número');
    }

    const existingUser = await db.getByIndex('users', 'email', email);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

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

    await this.logAccess(userId, 'register', 'user', true);
    const user = await db.get('users', userId);
    if (!user) throw new Error('Error al crear usuario');

    logger.log(`[Auth] ✓ Usuario registrado: ${email}`);
    return user;
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const rateLimitCheck = loginLimiter.checkLimit(email);
    if (!rateLimitCheck.allowed) {
      const errorMsg = rateLimitCheck.message || 'Demasiados intentos de login';
      logger.error(`[Auth] 🔒 Login bloqueado para ${email}: ${errorMsg}`);
      await this.logAccess(undefined, 'login_rate_limited', 'user', false, email);
      throw new Error(errorMsg);
    }

    const user = await db.getByIndex('users', 'email', email);
    
    if (!user) {
      await this.logAccess(undefined, 'login_failed', 'user', false, email);
      throw new Error('Email o contraseña incorrectos');
    }

    if (!user.isActive) {
      await this.logAccess(user.id, 'login_inactive', 'user', false, email);
      throw new Error('Usuario inactivo. Contacte al administrador');
    }

    const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      await this.logAccess(user.id, 'login_failed', 'user', false, email);
      throw new Error('Email o contraseña incorrectos');
    }

    loginLimiter.reset(email);

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

    this.currentSession = session;
    this.currentUser = user;
    localStorage.setItem('auth_token', token);
    await this.logAccess(user.id, 'login_success', 'user', true, email);

    logger.log(`[Auth] ✓ Login exitoso: ${email} (${user.role})`);
    return { user, token };
  }

  async logout(): Promise<void> {
    if (this.currentSession) {
      await db.delete('sessions', this.currentSession.id!);
      await this.logAccess(this.currentUser?.id, 'logout', 'user', true);
    }

    this.currentSession = null;
    this.currentUser = null;
    localStorage.removeItem('auth_token');
    
    logger.log('[Auth] ✓ Logout exitoso');
  }

  async checkSession(): Promise<User | null> {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const session = await db.getByIndex('sessions', 'token', token);
    if (!session) {
      localStorage.removeItem('auth_token');
      return null;
    }

    if (new Date(session.expiresAt) < new Date()) {
      await db.delete('sessions', session.id!);
      localStorage.removeItem('auth_token');
      logger.log('[Auth] Sesión expirada');
      return null;
    }

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

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  requireAdmin(): void {
    if (!this.isAuthenticated()) {
      throw new Error('Debe iniciar sesión para acceder a esta función');
    }
    if (!this.isAdmin()) {
      throw new Error('No tiene permisos de administrador');
    }
  }

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
      logger.error('[Auth] Error logging access:', error);
    }
  }

  async createDefaultAdmin(): Promise<void> {
    const allUsers = await db.getAll('users');
    const admins = allUsers.filter(u => u.role === 'admin');

    if (admins.length === 0) {
      logger.log('[Auth] Creando usuario administrador por defecto...');
      await this.register(
        'admin@store.local',
        'Admin123!',
        'Administrador',
        'admin'
      );
      logger.log('[Auth] ✓ Usuario admin creado: admin@store.local / Admin123!');
    }
  }

  getRateLimitStats(email: string) {
    return {
      login: loginLimiter.getStats(email),
      register: registerLimiter.getStats(email)
    };
  }

  unlockUser(email: string): void {
    this.requireAdmin();
    loginLimiter.unlock(email);
    registerLimiter.unlock(email);
    logger.log(`[Auth] 🔓 Usuario desbloqueado: ${email}`);
  }
}

export const authService = new AuthService();
export default authService;
