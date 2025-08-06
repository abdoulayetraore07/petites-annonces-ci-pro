// backend/src/services/authService.ts
// SERVICE D'AUTHENTIFICATION RÉVOLUTIONNAIRE

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { User, UserStatus, AuthTokens } from '../../../shared/src/types';

const prisma = new PrismaClient();

// ==============================================
// INTERFACES ET TYPES
// ==============================================

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  isProfessional?: boolean;
  companyName?: string;
  region?: string;
  commune?: string;
}

interface LoginData {
  identifier: string; // email ou phone
  password: string;
  rememberMe?: boolean;
}

interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh' | 'verification' | 'reset';
  iat?: number;
  exp?: number;
}

interface AuthResult {
  user: Omit<User, 'password'>;
  tokens: AuthTokens;
}

// ==============================================
// CONFIGURATION
// ==============================================

const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRES: '15m',
  REFRESH_TOKEN_EXPIRES: '7d',
  VERIFICATION_TOKEN_EXPIRES: '24h',
  RESET_TOKEN_EXPIRES: '1h',
  SECRET: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
  REFRESH_SECRET: process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key',
  ISSUER: 'petites-annonces-ci',
  AUDIENCE: 'petites-annonces-ci-users'
};

const SECURITY_CONFIG = {
  BCRYPT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128
};

// ==============================================
// CLASSE AUTHSERVICE
// ==============================================

export class AuthService {
  
  // ==============================================
  // INSCRIPTION
  // ==============================================
  
  static async register(data: RegisterData): Promise<AuthResult> {
    try {
      // Validation des données
      await this.validateRegistrationData(data);
      
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.findUserByEmailOrPhone(data.email, data.phone);
      if (existingUser) {
        throw new Error(existingUser.email === data.email 
          ? 'Un compte avec cet email existe déjà' 
          : 'Un compte avec ce numéro existe déjà'
        );
      }
      
      // Hash du mot de passe
      const hashedPassword = await bcrypt.hash(data.password, SECURITY_CONFIG.BCRYPT_ROUNDS);
      
      // Générer un slug unique pour le profil
      const profileSlug = await this.generateUniqueSlug(data.firstName, data.lastName);
      
      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.toLowerCase().trim(),
          phone: this.normalizePhoneNumber(data.phone),
          password: hashedPassword,
          isProfessional: data.isProfessional || false,
          companyName: data.companyName?.trim(),
          region: data.region?.trim(),
          commune: data.commune?.trim(),
          status: UserStatus.PENDING_VERIFICATION,
          // Générer un avatar par défaut avec initiales
          avatar: this.generateDefaultAvatar(data.firstName, data.lastName)
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isProfessional: true,
          companyName: true,
          region: true,
          commune: true,
          emailVerified: true,
          phoneVerified: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      // Générer les tokens
      const tokens = await this.generateTokenPair(user.id, user.email);
      
      // Envoyer l'email de vérification (async, ne pas attendre)
      this.sendVerificationEmail(user.email, user.firstName).catch(console.error);
      
      // Log de l'inscription
      await this.logActivity('USER_REGISTERED', user.id, {
        email: user.email,
        isProfessional: user.isProfessional
      });
      
      return {
        user: user as Omit<User, 'password'>,
        tokens
      };
      
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      throw error instanceof Error ? error : new Error('Erreur lors de l\'inscription');
    }
  }
  
  // ==============================================
  // CONNEXION
  // ==============================================
  
  static async login(data: LoginData): Promise<AuthResult> {
    try {
      // Trouver l'utilisateur
      const user = await this.findUserByEmailOrPhone(data.identifier, data.identifier);
      if (!user) {
        throw new Error('Email/téléphone ou mot de passe incorrect');
      }
      
      // Vérifier si le compte est bloqué
      await this.checkAccountLockout(user.id);
      
      // Vérifier le mot de passe
      const isValidPassword = await bcrypt.compare(data.password, user.password);
      if (!isValidPassword) {
        await this.handleFailedLogin(user.id);
        throw new Error('Email/téléphone ou mot de passe incorrect');
      }
      
      // Vérifier le statut du compte
      if (user.status === UserStatus.SUSPENDED) {
        throw new Error('Votre compte est suspendu. Contactez le support.');
      }
      
      if (user.status === UserStatus.DELETED) {
        throw new Error('Ce compte n\'existe plus.');
      }
      
      // Réinitialiser les tentatives de connexion
      await this.resetLoginAttempts(user.id);
      
      // Mettre à jour la dernière connexion
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      
      // Générer les tokens
      const tokens = await this.generateTokenPair(user.id, user.email, data.rememberMe);
      
      // Log de la connexion
      await this.logActivity('USER_LOGIN', user.id, {
        email: user.email,
        rememberMe: data.rememberMe
      });
      
      // Retourner sans le mot de passe
      const { password, ...userWithoutPassword } = user;
      
      return {
        user: userWithoutPassword as Omit<User, 'password'>,
        tokens
      };
      
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      throw error instanceof Error ? error : new Error('Erreur lors de la connexion');
    }
  }
  
  // ==============================================
  // RAFRAÎCHISSEMENT DES TOKENS
  // ==============================================
  
  static async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      // Vérifier le refresh token
      const payload = jwt.verify(refreshToken, JWT_CONFIG.REFRESH_SECRET) as TokenPayload;
      
      if (payload.type !== 'refresh') {
        throw new Error('Type de token invalide');
      }
      
      // Vérifier que le token existe en base
      const tokenRecord = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true }
      });
      
      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new Error('Refresh token invalide ou expiré');
      }
      
      // Générer de nouveaux tokens
      const tokens = await this.generateTokenPair(
        tokenRecord.userId, 
        tokenRecord.user.email
      );
      
      // Supprimer l'ancien refresh token
      await prisma.refreshToken.delete({
        where: { id: tokenRecord.id }
      });
      
      return tokens;
      
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      throw new Error('Token de rafraîchissement invalide');
    }
  }
  
  // ==============================================
  // DÉCONNEXION
  // ==============================================
  
  static async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      // Supprimer le refresh token spécifique ou tous les tokens de l'utilisateur
      if (refreshToken) {
        await prisma.refreshToken.deleteMany({
          where: { 
            userId,
            token: refreshToken 
          }
        });
      } else {
        // Déconnexion de tous les appareils
        await prisma.refreshToken.deleteMany({
          where: { userId }
        });
      }
      
      // Log de la déconnexion
      await this.logActivity('USER_LOGOUT', userId);
      
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw new Error('Erreur lors de la déconnexion');
    }
  }
  
  // ==============================================
  // VÉRIFICATION EMAIL
  // ==============================================
  
  static async verifyEmail(token: string): Promise<void> {
    try {
      const payload = jwt.verify(token, JWT_CONFIG.SECRET) as TokenPayload;
      
      if (payload.type !== 'verification') {
        throw new Error('Type de token invalide');
      }
      
      await prisma.user.update({
        where: { id: payload.userId },
        data: { 
          emailVerified: true,
          status: UserStatus.ACTIVE 
        }
      });
      
      await this.logActivity('EMAIL_VERIFIED', payload.userId);
      
    } catch (error) {
      console.error('Erreur lors de la vérification email:', error);
      throw new Error('Token de vérification invalide ou expiré');
    }
  }
  
  // ==============================================
  // RÉINITIALISATION MOT DE PASSE
  // ==============================================
  
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      });
      
      if (!user) {
        // Ne pas révéler si l'email existe ou non
        return;
      }
      
      // Générer un token de réinitialisation
      const resetToken = this.generateToken(
        user.id, 
        user.email, 
        'reset',
        JWT_CONFIG.RESET_TOKEN_EXPIRES
      );
      
      // Envoyer l'email (async)
      this.sendPasswordResetEmail(user.email, user.firstName, resetToken)
        .catch(console.error);
      
      await this.logActivity('PASSWORD_RESET_REQUESTED', user.id);
      
    } catch (error) {
      console.error('Erreur demande réinitialisation:', error);
      throw new Error('Erreur lors de la demande de réinitialisation');
    }
  }
  
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const payload = jwt.verify(token, JWT_CONFIG.SECRET) as TokenPayload;
      
      if (payload.type !== 'reset') {
        throw new Error('Type de token invalide');
      }
      
      // Valider le nouveau mot de passe
      this.validatePassword(newPassword);
      
      // Hash du nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, SECURITY_CONFIG.BCRYPT_ROUNDS);
      
      await prisma.user.update({
        where: { id: payload.userId },
        data: { 
          password: hashedPassword,
          // Réinitialiser les tentatives de connexion
          loginAttempts: 0,
          blockedUntil: null
        }
      });
      
      // Supprimer tous les refresh tokens (forcer reconnexion)
      await prisma.refreshToken.deleteMany({
        where: { userId: payload.userId }
      });
      
      await this.logActivity('PASSWORD_RESET_COMPLETED', payload.userId);
      
    } catch (error) {
      console.error('Erreur réinitialisation mot de passe:', error);
      throw new Error('Token de réinitialisation invalide ou expiré');
    }
  }
  
  // ==============================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ==============================================
  
  private static async validateRegistrationData(data: RegisterData): Promise<void> {
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Format d\'email invalide');
    }
    
    // Validation téléphone ivoirien
    const phoneRegex = /^(\+225|00225|225)?[0-9]{8,10}$/;
    if (!phoneRegex.test(data.phone)) {
      throw new Error('Numéro de téléphone ivoirien invalide');
    }
    
    // Validation mot de passe
    this.validatePassword(data.password);
    
    // Validation nom/prénom
    if (data.firstName.length < 2 || data.lastName.length < 2) {
      throw new Error('Nom et prénom doivent contenir au moins 2 caractères');
    }
  }
  
  private static validatePassword(password: string): void {
    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      throw new Error(`Mot de passe trop court (min ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} caractères)`);
    }
    
    if (password.length > SECURITY_CONFIG.PASSWORD_MAX_LENGTH) {
      throw new Error(`Mot de passe trop long (max ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} caractères)`);
    }
    
    // Optionnel: validation complexité
    if (process.env.NODE_ENV === 'production') {
      if (!/(?=.*[a-z])/.test(password)) {
        throw new Error('Le mot de passe doit contenir au moins une minuscule');
      }
      if (!/(?=.*[A-Z])/.test(password)) {
        throw new Error('Le mot de passe doit contenir au moins une majuscule');
      }
      if (!/(?=.*\d)/.test(password)) {
        throw new Error('Le mot de passe doit contenir au moins un chiffre');
      }
    }
  }
  
  private static async findUserByEmailOrPhone(email: string, phone: string) {
    return await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase().trim() },
          { phone: this.normalizePhoneNumber(phone) }
        ]
      }
    });
  }
  
  private static normalizePhoneNumber(phone: string): string {
    // Normaliser le numéro ivoirien
    let normalized = phone.replace(/\s+/g, '');
    
    if (normalized.startsWith('00225')) {
      normalized = '+225' + normalized.substring(5);
    } else if (normalized.startsWith('225')) {
      normalized = '+225' + normalized.substring(3);
    } else if (!normalized.startsWith('+225')) {
      normalized = '+225' + normalized;
    }
    
    return normalized;
  }
  
  private static async generateTokenPair(
    userId: string, 
    email: string, 
    rememberMe = false
  ): Promise<AuthTokens> {
    const accessToken = this.generateToken(userId, email, 'access', JWT_CONFIG.ACCESS_TOKEN_EXPIRES);
    
    const refreshTokenExpires = rememberMe ? '30d' : JWT_CONFIG.REFRESH_TOKEN_EXPIRES;
    const refreshToken = this.generateToken(userId, email, 'refresh', refreshTokenExpires);
    
    // Sauvegarder le refresh token en base
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));
    
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt
      }
    });
    
    return {
      accessToken,
      refreshToken,
      expiresIn: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    };
  }
  
  private static generateToken(
    userId: string,
    email: string,
    type: 'access' | 'refresh' | 'verification' | 'reset',
    expiresIn: string
  ): string {
    const secret = type === 'refresh' ? JWT_CONFIG.REFRESH_SECRET : JWT_CONFIG.SECRET;
    
    return jwt.sign(
      {
        userId,
        email,
        type
      } as TokenPayload,
      secret,
      {
        expiresIn,
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE,
        jwtid: crypto.randomUUID()
      }
    );
  }
  
  private static generateDefaultAvatar(firstName: string, lastName: string): string {
    const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const colorIndex = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length;
    
    return `https://ui-avatars.com/api/?name=${initials}&background=${colors[colorIndex].substring(1)}&color=fff&size=200`;
  }
  
  private static async generateUniqueSlug(firstName: string, lastName: string): Promise<string> {
    const baseSlug = `${firstName.toLowerCase()}-${lastName.toLowerCase()}`.replace(/[^a-z0-9-]/g, '');
    let slug = baseSlug;
    let counter = 1;
    
    while (await this.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }
  
  private static async slugExists(slug: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { 
        // Supposons qu'on ait un champ slug dans le modèle User
        firstName: { contains: slug.split('-')[0] }
      }
    });
    return count > 0;
  }
  
  private static async checkAccountLockout(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { loginAttempts: true, blockedUntil: true }
    });
    
    if (user?.blockedUntil && user.blockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.blockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`Compte temporairement bloqué. Réessayez dans ${remainingTime} minutes.`);
    }
  }
  
  private static async handleFailedLogin(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { loginAttempts: true }
    });
    
    const attempts = (user?.loginAttempts || 0) + 1;
    const updateData: any = { loginAttempts: attempts };
    
    if (attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      updateData.blockedUntil = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_TIME);
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
  }
  
  private static async resetLoginAttempts(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        loginAttempts: 0,
        blockedUntil: null
      }
    });
  }
  
  private static async logActivity(action: string, userId: string, details?: any): Promise<void> {
    try {
      await prisma.logActivite.create({
        data: {
          userId,
          action,
          entite: 'User',
          entiteId: userId,
          details: details || {}
        }
      });
    } catch (error) {
      console.error('Erreur log activité:', error);
      // Ne pas faire échouer l'opération principale
    }
  }
  
  // Méthodes d'envoi d'emails (à implémenter avec un service email)
  private static async sendVerificationEmail(email: string, firstName: string): Promise<void> {
    // TODO: Implémenter avec service email (Nodemailer, SendGrid, etc.)
    console.log(`📧 Envoi email vérification à ${email} pour ${firstName}`);
  }
  
  private static async sendPasswordResetEmail(email: string, firstName: string, token: string): Promise<void> {
    // TODO: Implémenter avec service email
    console.log(`📧 Envoi email réinitialisation à ${email} pour ${firstName}`);
  }
}

export default AuthService;