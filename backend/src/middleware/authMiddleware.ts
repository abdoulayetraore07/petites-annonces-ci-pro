// backend/src/middleware/authMiddleware.ts
// MIDDLEWARE D'AUTHENTIFICATION RÉVOLUTIONNAIRE

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import type { ApiResponse, User, UserStatus } from '../../../shared/src/types';

const prisma = new PrismaClient();

// ==============================================
// INTERFACES ET TYPES
// ==============================================

interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh' | 'verification' | 'reset';
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID pour la révocation
}

interface AuthenticatedRequest extends Request {
  user?: User;
  tokenInfo?: {
    jti: string;
    iat: number;
    exp: number;
  };
}

// Étendre le type Request global
declare global {
  namespace Express {
    interface Request {
      user?: User;
      tokenInfo?: {
        jti: string;
        iat: number;
        exp: number;
      };
    }
  }
}

// ==============================================
// CONFIGURATION JWT
// ==============================================

const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
  ISSUER: 'petites-annonces-ci',
  AUDIENCE: 'petites-annonces-ci-users',
  ALGORITHM: 'HS256' as const
};

// Cache en mémoire pour les tokens révoqués (Redis en production)
const revokedTokens = new Set<string>();

// Cache utilisateurs pour éviter les requêtes DB répétées
const userCache = new Map<string, { user: User; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ==============================================
// MIDDLEWARE D'AUTHENTIFICATION PRINCIPAL
// ==============================================

/**
 * Middleware d'authentification JWT ultra-sécurisé
 * Vérifie le token, la validité de l'utilisateur, et met en cache les données
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extraction du token depuis l'header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      const response: ApiResponse = {
        success: false,
        message: 'Token d\'authentification requis',
        errors: [{
          message: 'Header Authorization avec Bearer token requis',
          code: 'MISSING_TOKEN'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Vérification si le token est révoqué
    if (revokedTokens.has(token)) {
      const response: ApiResponse = {
        success: false,
        message: 'Token révoqué',
        errors: [{
          message: 'Ce token a été révoqué, veuillez vous reconnecter',
          code: 'REVOKED_TOKEN'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Vérification et décodage du JWT
    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, JWT_CONFIG.SECRET, {
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE,
        algorithms: [JWT_CONFIG.ALGORITHM]
      }) as TokenPayload;
    } catch (jwtError) {
      console.error('❌ Erreur vérification JWT:', jwtError);
      
      let errorMessage = 'Token invalide';
      let errorCode = 'INVALID_TOKEN';

      if (jwtError instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token expiré';
        errorCode = 'EXPIRED_TOKEN';
      } else if (jwtError instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Format de token invalide';
        errorCode = 'MALFORMED_TOKEN';
      }

      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{
          message: errorMessage,
          code: errorCode
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Vérifier que c'est bien un access token
    if (payload.type !== 'access') {
      const response: ApiResponse = {
        success: false,
        message: 'Type de token invalide',
        errors: [{
          message: 'Seuls les access tokens sont acceptés',
          code: 'WRONG_TOKEN_TYPE'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Récupération de l'utilisateur (avec cache)
    let userData = userCache.get(payload.userId);
    const now = Date.now();

    if (!userData || (now - userData.timestamp) > CACHE_DURATION) {
      console.log(`🔄 Rechargement utilisateur depuis DB: ${payload.userId}`);
      
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
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
            updatedAt: true,
            lastLoginAt: true
          }
        });

        if (!user) {
          // Utilisateur supprimé, révoquer le token
          revokedTokens.add(token);
          userCache.delete(payload.userId);
          
          const response: ApiResponse = {
            success: false,
            message: 'Utilisateur non trouvé',
            errors: [{
              message: 'Ce compte n\'existe plus',
              code: 'USER_NOT_FOUND'
            }],
            meta: {
              timestamp: new Date().toISOString(),
              version: '1.0.0'
            }
          };
          res.status(401).json(response);
          return;
        }

        // Mise à jour du cache
        userData = { user: user as User, timestamp: now };
        userCache.set(payload.userId, userData);
        
      } catch (dbError) {
        console.error('❌ Erreur accès base de données:', dbError);
        
        const response: ApiResponse = {
          success: false,
          message: 'Erreur de vérification utilisateur',
          errors: [{
            message: 'Erreur temporaire, veuillez réessayer',
            code: 'DB_ERROR'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(500).json(response);
        return;
      }
    }

    const user = userData.user;

    // Vérifications du statut utilisateur
    if (user.status === UserStatus.SUSPENDED) {
      const response: ApiResponse = {
        success: false,
        message: 'Compte suspendu',
        errors: [{
          message: 'Votre compte a été suspendu. Contactez le support.',
          code: 'ACCOUNT_SUSPENDED'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(403).json(response);
      return;
    }

    if (user.status === UserStatus.DELETED) {
      revokedTokens.add(token);
      userCache.delete(payload.userId);
      
      const response: ApiResponse = {
        success: false,
        message: 'Compte supprimé',
        errors: [{
          message: 'Ce compte a été supprimé',
          code: 'ACCOUNT_DELETED'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(403).json(response);
      return;
    }

    // Vérifier la cohérence email du token vs DB
    if (user.email !== payload.email) {
      console.warn('⚠️ Incohérence email token/DB:', {
        userId: user.id,
        tokenEmail: payload.email,
        dbEmail: user.email
      });
      
      revokedTokens.add(token);
      userCache.delete(payload.userId);
      
      const response: ApiResponse = {
        success: false,
        message: 'Token incohérent',
        errors: [{
          message: 'Informations du token incohérentes, reconnectez-vous',
          code: 'TOKEN_MISMATCH'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Ajouter l'utilisateur et les infos token à la requête
    req.user = user;
    req.tokenInfo = {
      jti: payload.jti || '',
      iat: payload.iat || 0,
      exp: payload.exp || 0
    };

    // Log de l'activité (en développement)
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Auth réussie: ${user.firstName} ${user.lastName} (${user.email})`);
    }

    // Mise à jour asynchrone de la dernière activité
    updateLastActivity(user.id).catch(console.error);

    next();

  } catch (error) {
    console.error('❌ Erreur critique dans authenticateToken:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Erreur d\'authentification',
      errors: [{
        message: 'Erreur interne, veuillez réessayer',
        code: 'AUTH_INTERNAL_ERROR'
      }],
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(500).json(response);
  }
};

// ==============================================
// MIDDLEWARE D'AUTHENTIFICATION OPTIONNELLE
// ==============================================

/**
 * Middleware d'authentification optionnelle
 * L'utilisateur peut être connecté ou non, sans erreur si pas de token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      // Pas de token = pas d'utilisateur, mais on continue
      next();
      return;
    }

    // Si token présent, on fait la vérification complète
    await authenticateToken(req, res, (error) => {
      if (error) {
        // En cas d'erreur, on continue sans utilisateur
        req.user = undefined;
      }
      next();
    });

  } catch (error) {
    console.error('❌ Erreur dans optionalAuth:', error);
    // En cas d'erreur, on continue sans utilisateur
    req.user = undefined;
    next();
  }
};

// ==============================================
// MIDDLEWARE DE VÉRIFICATION DES RÔLES
// ==============================================

/**
 * Middleware pour vérifier que l'utilisateur est professionnel
 */
export const requireProfessional = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      message: 'Authentification requise',
      errors: [{
        message: 'Vous devez être connecté',
        code: 'AUTHENTICATION_REQUIRED'
      }],
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(401).json(response);
    return;
  }

  if (!req.user.isProfessional) {
    const response: ApiResponse = {
      success: false,
      message: 'Compte professionnel requis',
      errors: [{
        message: 'Cette action nécessite un compte professionnel',
        code: 'PROFESSIONAL_REQUIRED'
      }],
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(403).json(response);
    return;
  }

  next();
};

/**
 * Middleware pour vérifier que l'utilisateur a vérifié son email
 */
export const requireEmailVerified = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      message: 'Authentification requise',
      errors: [{
        message: 'Vous devez être connecté',
        code: 'AUTHENTICATION_REQUIRED'
      }],
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(401).json(response);
    return;
  }

  if (!req.user.emailVerified) {
    const response: ApiResponse = {
      success: false,
      message: 'Email non vérifié',
      errors: [{
        message: 'Veuillez vérifier votre email avant de continuer',
        code: 'EMAIL_VERIFICATION_REQUIRED'
      }],
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(403).json(response);
    return;
  }

  next();
};

/**
 * Middleware pour vérifier que l'utilisateur a vérifié son téléphone
 */
export const requirePhoneVerified = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      message: 'Authentification requise',
      errors: [{
        message: 'Vous devez être connecté',
        code: 'AUTHENTICATION_REQUIRED'
      }],
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(401).json(response);
    return;
  }

  if (!req.user.phoneVerified) {
    const response: ApiResponse = {
      success: false,
      message: 'Téléphone non vérifié',
      errors: [{
        message: 'Veuillez vérifier votre numéro de téléphone',
        code: 'PHONE_VERIFICATION_REQUIRED'
      }],
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(403).json(response);
    return;
  }

  next();
};

// ==============================================
// MIDDLEWARE COMBINÉS
// ==============================================

/**
 * Middleware combiné : Authentification + Email vérifié
 */
export const requireAuthAndEmailVerified = [
  authenticateToken,
  requireEmailVerified
];

/**
 * Middleware combiné : Authentification + Compte professionnel
 */
export const requireAuthAndProfessional = [
  authenticateToken,
  requireProfessional
];

/**
 * Middleware combiné : Authentification + Email + Téléphone vérifiés
 */
export const requireFullVerification = [
  authenticateToken,
  requireEmailVerified,
  requirePhoneVerified
];

// ==============================================
// FONCTIONS UTILITAIRES
// ==============================================

/**
 * Révoque un token spécifique
 */
export const revokeToken = (token: string): void => {
  revokedTokens.add(token);
  console.log(`🔒 Token révoqué: ${token.substring(0, 20)}...`);
};

/**
 * Révoque tous les tokens d'un utilisateur (simule une déconnexion globale)
 */
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  try {
    // Supprimer du cache
    userCache.delete(userId);
    
    // En production, on supprimerait tous les refresh tokens de l'utilisateur
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
    
    console.log(`🔒 Tous les tokens révoqués pour utilisateur: ${userId}`);
  } catch (error) {
    console.error('❌ Erreur révocation tokens utilisateur:', error);
  }
};

/**
 * Nettoie le cache utilisateur
 */
export const clearUserCache = (userId?: string): void => {
  if (userId) {
    userCache.delete(userId);
    console.log(`🧹 Cache utilisateur nettoyé: ${userId}`);
  } else {
    userCache.clear();
    console.log('🧹 Cache utilisateurs complètement nettoyé');
  }
};

/**
 * Nettoie les tokens révoqués expirés
 */
export const cleanupRevokedTokens = (): void => {
  // En production, on vérifierait la date d'expiration des tokens
  // Pour l'instant, on garde une approche simple
  if (revokedTokens.size > 10000) {
    revokedTokens.clear();
    console.log('🧹 Cache tokens révoqués nettoyé (limite atteinte)');
  }
};

/**
 * Mise à jour asynchrone de la dernière activité
 */
const updateLastActivity = async (userId: string): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  } catch (error) {
    // Ne pas faire échouer l'auth pour un problème de log
    console.error('❌ Erreur mise à jour dernière activité:', error);
  }
};

// ==============================================
// TÂCHES DE MAINTENANCE
// ==============================================

// Nettoyage automatique toutes les heures
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    cleanupRevokedTokens();
    
    // Nettoyer le cache utilisateur des entrées expirées
    const now = Date.now();
    for (const [userId, userData] of userCache.entries()) {
      if ((now - userData.timestamp) > CACHE_DURATION * 2) {
        userCache.delete(userId);
      }
    }
    
    console.log(`🧹 Maintenance cache: ${userCache.size} utilisateurs, ${revokedTokens.size} tokens révoqués`);
  }, 60 * 60 * 1000); // 1 heure
}

// ==============================================
// MIDDLEWARE DE DEBUG (DEVELOPMENT ONLY)
// ==============================================

export const debugAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Debug Auth:', {
      url: req.originalUrl,
      method: req.method,
      hasAuth: !!req.headers.authorization,
      user: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Non connecté',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

export default {
  authenticateToken,
  optionalAuth,
  requireProfessional,
  requireEmailVerified,
  requirePhoneVerified,
  requireAuthAndEmailVerified,
  requireAuthAndProfessional,
  requireFullVerification,
  revokeToken,
  revokeAllUserTokens,
  clearUserCache,
  debugAuth
};