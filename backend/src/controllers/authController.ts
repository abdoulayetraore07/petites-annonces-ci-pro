// backend/src/controllers/authController.ts
// CONTRÔLEUR AUTHENTIFICATION RÉVOLUTIONNAIRE

import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import AuthService from '../services/authService';
import type { ApiResponse, LoginResponse } from '../../../shared/src/types';
import { userSchema, loginSchema } from '../../../shared/src/types';

// ==============================================
// RATE LIMITING AVANCÉ
// ==============================================

// Rate limiting spécifique pour l'inscription
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Maximum 3 inscriptions par IP
  message: {
    error: 'Trop de tentatives d\'inscription depuis cette IP',
    retryAfter: 15
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting pour la connexion
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 tentatives de connexion
  message: {
    error: 'Trop de tentatives de connexion depuis cette IP',
    retryAfter: 15
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne pas compter les connexions réussies
});

// Rate limiting pour reset mot de passe
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // Maximum 3 demandes de reset par IP
  message: {
    error: 'Trop de demandes de réinitialisation depuis cette IP',
    retryAfter: 60
  },
});

// ==============================================
// VALIDATEURS EXPRESS-VALIDATOR
// ==============================================

export const validateRegister = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Prénom requis (2-50 caractères)')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Prénom contient des caractères invalides'),

  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nom requis (2-50 caractères)')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Nom contient des caractères invalides'),

  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),

  body('phone')
    .trim()
    .matches(/^(\+225|00225|225)?[0-9]{8,10}$/)
    .withMessage('Numéro de téléphone ivoirien invalide'),

  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Mot de passe requis (6-128 caractères)')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mot de passe doit contenir au moins: 1 minuscule, 1 majuscule, 1 chiffre'),

  body('isProfessional')
    .optional()
    .isBoolean()
    .withMessage('isProfessional doit être un booléen'),

  body('companyName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Nom d\'entreprise trop long (max 100 caractères)'),

  body('region')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Région invalide'),

  body('commune')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Commune invalide'),
];

export const validateLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email ou téléphone requis'),

  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis'),

  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('rememberMe doit être un booléen'),
];

export const validatePasswordReset = [
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
];

export const validatePasswordChange = [
  body('token')
    .notEmpty()
    .withMessage('Token requis'),

  body('newPassword')
    .isLength({ min: 6, max: 128 })
    .withMessage('Nouveau mot de passe requis (6-128 caractères)')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mot de passe doit contenir au moins: 1 minuscule, 1 majuscule, 1 chiffre'),
];

// ==============================================
// MIDDLEWARE DE GESTION D'ERREURS
// ==============================================

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : undefined,
      message: error.msg,
      code: 'VALIDATION_ERROR'
    }));

    const response: ApiResponse = {
      success: false,
      message: 'Données invalides',
      errors: formattedErrors,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    return res.status(400).json(response);
  }
  next();
};

// ==============================================
// CONTRÔLEUR AUTHCONTROLLER
// ==============================================

export class AuthController {

  // ==============================================
  // INSCRIPTION
  // ==============================================

  static async register(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔐 Tentative d\'inscription:', {
        email: req.body.email,
        phone: req.body.phone,
        isProfessional: req.body.isProfessional
      });

      // Validation avec Zod en plus d'express-validator
      const validationResult = userSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          message: 'Données de validation Zod invalides',
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: 'ZOD_VALIDATION_ERROR'
          })),
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      // Appel du service d'authentification
      const result = await AuthService.register(req.body);

      console.log('✅ Inscription réussie:', {
        userId: result.user.id,
        email: result.user.email
      });

      const response: LoginResponse = {
        success: true,
        message: 'Inscription réussie ! Vérifiez votre email pour activer votre compte.',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('❌ Erreur inscription:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'inscription';
      
      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{
          message: errorMessage,
          code: 'REGISTRATION_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      // Statut HTTP différent selon le type d'erreur
      const statusCode = errorMessage.includes('existe déjà') ? 409 : 400;
      res.status(statusCode).json(response);
    }
  }

  // ==============================================
  // CONNEXION
  // ==============================================

  static async login(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔐 Tentative de connexion:', {
        identifier: req.body.identifier,
        rememberMe: req.body.rememberMe
      });

      // Validation avec Zod
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          message: 'Données de connexion invalides',
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: 'LOGIN_VALIDATION_ERROR'
          })),
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      // Appel du service d'authentification
      const result = await AuthService.login(req.body);

      console.log('✅ Connexion réussie:', {
        userId: result.user.id,
        email: result.user.email,
        isProfessional: result.user.isProfessional
      });

      // Définir le cookie refresh token (sécurisé)
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: req.body.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 30 jours ou 7 jours
        path: '/api/auth'
      };

      res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions);

      const response: LoginResponse = {
        success: true,
        message: 'Connexion réussie',
        data: {
          user: result.user,
          tokens: {
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken, // Pour compatibility, mais sera dans cookie
            expiresIn: result.tokens.expiresIn
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur connexion:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la connexion';
      
      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{
          message: errorMessage,
          code: 'LOGIN_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      // Statut HTTP différent selon le type d'erreur
      let statusCode = 400;
      if (errorMessage.includes('incorrect') || errorMessage.includes('invalide')) {
        statusCode = 401;
      } else if (errorMessage.includes('suspendu') || errorMessage.includes('bloqué')) {
        statusCode = 403;
      }

      res.status(statusCode).json(response);
    }
  }

  // ==============================================
  // RAFRAÎCHISSEMENT DES TOKENS
  // ==============================================

  static async refreshTokens(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          message: 'Refresh token manquant',
          errors: [{
            message: 'Refresh token requis',
            code: 'MISSING_REFRESH_TOKEN'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(401).json(response);
        return;
      }

      const tokens = await AuthService.refreshTokens(refreshToken);

      // Mettre à jour le cookie refresh token
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
        path: '/api/auth'
      };

      res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

      const response: ApiResponse<typeof tokens> = {
        success: true,
        message: 'Tokens rafraîchis avec succès',
        data: tokens,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur refresh tokens:', error);

      // Supprimer le cookie invalide
      res.clearCookie('refreshToken', { path: '/api/auth' });

      const response: ApiResponse = {
        success: false,
        message: 'Token de rafraîchissement invalide',
        errors: [{
          message: 'Veuillez vous reconnecter',
          code: 'INVALID_REFRESH_TOKEN'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(401).json(response);
    }
  }

  // ==============================================
  // DÉCONNEXION
  // ==============================================

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id; // Vient du middleware d'auth
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (userId) {
        await AuthService.logout(userId, refreshToken);
      }

      // Supprimer le cookie
      res.clearCookie('refreshToken', { path: '/api/auth' });

      console.log('✅ Déconnexion réussie:', { userId });

      const response: ApiResponse = {
        success: true,
        message: 'Déconnexion réussie',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);

      // Même si erreur, on clear le cookie côté client
      res.clearCookie('refreshToken', { path: '/api/auth' });

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la déconnexion',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          code: 'LOGOUT_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(500).json(response);
    }
  }

  // ==============================================
  // VÉRIFICATION EMAIL
  // ==============================================

  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        const response: ApiResponse = {
          success: false,
          message: 'Token de vérification manquant',
          errors: [{
            message: 'Token requis',
            code: 'MISSING_TOKEN'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      await AuthService.verifyEmail(token);

      console.log('✅ Email vérifié avec succès');

      const response: ApiResponse = {
        success: true,
        message: 'Email vérifié avec succès ! Votre compte est maintenant actif.',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur vérification email:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Token de vérification invalide ou expiré',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur de vérification',
          code: 'EMAIL_VERIFICATION_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(400).json(response);
    }
  }

  // ==============================================
  // DEMANDE RÉINITIALISATION MOT DE PASSE
  // ==============================================

  static async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      await AuthService.requestPasswordReset(email);

      console.log('✅ Demande reset mot de passe envoyée:', { email });

      // Toujours retourner succès pour ne pas révéler si l'email existe
      const response: ApiResponse = {
        success: true,
        message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur demande reset:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la demande de réinitialisation',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          code: 'PASSWORD_RESET_REQUEST_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(500).json(response);
    }
  }

  // ==============================================
  // RÉINITIALISATION MOT DE PASSE
  // ==============================================

  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      await AuthService.resetPassword(token, newPassword);

      console.log('✅ Mot de passe réinitialisé avec succès');

      const response: ApiResponse = {
        success: true,
        message: 'Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur reset mot de passe:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Token invalide ou mot de passe non conforme',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur de réinitialisation',
          code: 'PASSWORD_RESET_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(400).json(response);
    }
  }

  // ==============================================
  // PROFIL UTILISATEUR COURANT
  // ==============================================

  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user; // Vient du middleware d'auth

      if (!user) {
        const response: ApiResponse = {
          success: false,
          message: 'Utilisateur non authentifié',
          errors: [{
            message: 'Token d\'authentification requis',
            code: 'UNAUTHENTICATED'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(401).json(response);
        return;
      }

      const response: ApiResponse<typeof user> = {
        success: true,
        message: 'Profil utilisateur récupéré',
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur récupération profil:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération du profil',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          code: 'PROFILE_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(500).json(response);
    }
  }
}

// ==============================================
// MIDDLEWARE D'EXPORTS
// ==============================================

// Combiner les validateurs avec le gestionnaire d'erreurs
export const registerValidation = [
  ...validateRegister,
  handleValidationErrors
];

export const loginValidation = [
  ...validateLogin,
  handleValidationErrors
];

export const passwordResetValidation = [
  ...validatePasswordReset,
  handleValidationErrors
];

export const passwordChangeValidation = [
  ...validatePasswordChange,
  handleValidationErrors
];

export default AuthController;