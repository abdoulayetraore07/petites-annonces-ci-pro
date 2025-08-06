// backend/src/routes/authRoutes.ts
// ROUTES AUTHENTIFICATION RÉVOLUTIONNAIRES

import { Router } from 'express';
import AuthController, {
  registerLimiter,
  loginLimiter,
  passwordResetLimiter,
  registerValidation,
  loginValidation,
  passwordResetValidation,
  passwordChangeValidation
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// ==============================================
// DOCUMENTATION DES ROUTES AUTH
// ==============================================

/**
 * @swagger
 * /api/auth:
 *   get:
 *     summary: Informations sur les routes d'authentification
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Routes d'authentification disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🔐 Routes d\'authentification - Petites Annonces CI',
    data: {
      version: '1.0.0',
      endpoints: {
        'POST /register': {
          description: 'Inscription d\'un nouvel utilisateur',
          rateLimit: '3 tentatives / 15 minutes',
          validation: 'Stricte avec double validation',
          features: ['Email verification', 'Password hashing', 'Phone CI validation']
        },
        'POST /login': {
          description: 'Connexion utilisateur',
          rateLimit: '5 tentatives / 15 minutes',
          features: ['JWT + Refresh tokens', 'Account lockout protection', 'Remember me']
        },
        'POST /refresh': {
          description: 'Rafraîchissement des tokens',
          features: ['Secure HTTP-only cookies', 'Token rotation', 'Auto cleanup']
        },
        'POST /logout': {
          description: 'Déconnexion sécurisée',
          features: ['Token revocation', 'Cookie cleanup', 'Multi-device support']
        },
        'GET /verify/:token': {
          description: 'Vérification d\'email',
          features: ['Email activation', 'Secure tokens', 'Auto-expiration']
        },
        'POST /forgot-password': {
          description: 'Demande de réinitialisation mot de passe',
          rateLimit: '3 tentatives / 1 heure',
          features: ['Secure email links', 'No email enumeration', 'Time-limited tokens']
        },
        'POST /reset-password': {
          description: 'Réinitialisation du mot de passe',
          features: ['Token validation', 'Password strength check', 'Auto-cleanup']
        },
        'GET /me': {
          description: 'Profil utilisateur courant',
          auth: 'Bearer token requis',
          features: ['User profile', 'Permissions check', 'Activity tracking']
        }
      },
      security: {
        rateLimiting: 'Adaptatif par endpoint',
        validation: 'Express-validator + Zod',
        passwordHashing: 'bcrypt (12 rounds)',
        tokenSecurity: 'JWT + HttpOnly cookies',
        phoneValidation: 'Format ivoirien (+225)',
        emailVerification: 'Obligatoire pour activation'
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

// ==============================================
// ROUTES D'INSCRIPTION
// ==============================================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Kouame"
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Yao"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "kouame.yao@example.com"
 *               phone:
 *                 type: string
 *                 pattern: "^(\\+225|00225|225)?[0-9]{8,10}$"
 *                 example: "+22507123456"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "MonMotDePasse123!"
 *               isProfessional:
 *                 type: boolean
 *                 default: false
 *               companyName:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Ma Société SARL"
 *               region:
 *                 type: string
 *                 example: "abidjan"
 *               commune:
 *                 type: string
 *                 example: "Cocody"
 *     responses:
 *       201:
 *         description: Inscription réussie
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Utilisateur existe déjà
 *       429:
 *         description: Trop de tentatives
 */
router.post('/register', 
  registerLimiter,
  registerValidation,
  AuthController.register
);

// ==============================================
// ROUTES DE CONNEXION
// ==============================================

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email ou numéro de téléphone
 *                 example: "kouame.yao@example.com"
 *               password:
 *                 type: string
 *                 example: "MonMotDePasse123!"
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *                 description: "Connexion prolongée (30 jours)"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         headers:
 *           Set-Cookie:
 *             description: Refresh token sécurisé
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: number
 *       401:
 *         description: Identifiants incorrects
 *       403:
 *         description: Compte suspendu/bloqué
 *       429:
 *         description: Trop de tentatives
 */
router.post('/login',
  loginLimiter,
  loginValidation,
  AuthController.login
);

// ==============================================
// ROUTES DE GESTION DES TOKENS
// ==============================================

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Rafraîchissement des tokens d'accès
 *     tags: [Authentication]
 *     description: Utilise le refresh token du cookie HttpOnly pour générer de nouveaux tokens
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: "Optionnel si présent dans les cookies"
 *     responses:
 *       200:
 *         description: Tokens rafraîchis avec succès
 *         headers:
 *           Set-Cookie:
 *             description: Nouveau refresh token
 *             schema:
 *               type: string
 *       401:
 *         description: Refresh token invalide ou expiré
 */
router.post('/refresh', AuthController.refreshTokens);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion sécurisée
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: Révoque les tokens et supprime les cookies
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allDevices:
 *                 type: boolean
 *                 default: false
 *                 description: "Déconnecter de tous les appareils"
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *       500:
 *         description: Erreur lors de la déconnexion
 */
router.post('/logout', authenticateToken, AuthController.logout);

// ==============================================
// ROUTES DE VÉRIFICATION EMAIL
// ==============================================

/**
 * @swagger
 * /api/auth/verify/{token}:
 *   get:
 *     summary: Vérification d'email
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de vérification envoyé par email
 *     responses:
 *       200:
 *         description: Email vérifié avec succès
 *       400:
 *         description: Token invalide ou expiré
 */
router.get('/verify/:token', AuthController.verifyEmail);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Renvoyer l'email de vérification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email de vérification renvoyé
 *       400:
 *         description: Email invalide
 *       429:
 *         description: Trop de tentatives
 */
router.post('/resend-verification',
  passwordResetLimiter, // Même limite que reset password
  passwordResetValidation,
  async (req, res) => {
    // TODO: Implémenter la logique de renvoi
    res.json({
      success: true,
      message: 'Email de vérification renvoyé (si le compte existe)'
    });
  }
);

// ==============================================
// ROUTES DE RÉINITIALISATION MOT DE PASSE
// ==============================================

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Demande de réinitialisation du mot de passe
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "kouame.yao@example.com"
 *     responses:
 *       200:
 *         description: Email envoyé (si le compte existe)
 *       400:
 *         description: Email invalide
 *       429:
 *         description: Trop de demandes
 */
router.post('/forgot-password',
  passwordResetLimiter,
  passwordResetValidation,
  AuthController.requestPasswordReset
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Réinitialisation du mot de passe
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token reçu par email
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Nouveau mot de passe sécurisé
 *                 example: "NouveauMotDePasse123!"
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé avec succès
 *       400:
 *         description: Token invalide ou mot de passe faible
 */
router.post('/reset-password',
  passwordChangeValidation,
  AuthController.resetPassword
);

// ==============================================
// ROUTES UTILISATEUR AUTHENTIFIÉ
// ==============================================

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Récupération du profil utilisateur courant
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur récupéré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Non authentifié
 */
router.get('/me', authenticateToken, AuthController.getCurrentUser);

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     summary: Changement de mot de passe (utilisateur connecté)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Mot de passe actuel
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Nouveau mot de passe
 *     responses:
 *       200:
 *         description: Mot de passe changé avec succès
 *       400:
 *         description: Mot de passe actuel incorrect
 *       401:
 *         description: Non authentifié
 */
router.patch('/change-password', authenticateToken, async (req, res) => {
  // TODO: Implémenter le changement de mot de passe pour utilisateur connecté
  res.json({
    success: true,
    message: 'Changement de mot de passe - À implémenter'
  });
});

/**
 * @swagger
 * /api/auth/update-profile:
 *   patch:
 *     summary: Mise à jour du profil utilisateur
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               companyName:
 *                 type: string
 *               region:
 *                 type: string
 *               commune:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 */
router.patch('/update-profile', authenticateToken, async (req, res) => {
  // TODO: Implémenter la mise à jour de profil
  res.json({
    success: true,
    message: 'Mise à jour profil - À implémenter'
  });
});

// ==============================================
// ROUTES DE SÉCURITÉ AVANCÉES
// ==============================================

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Liste des sessions actives
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: Affiche toutes les sessions actives de l'utilisateur
 *     responses:
 *       200:
 *         description: Sessions récupérées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       device:
 *                         type: string
 *                       browser:
 *                         type: string
 *                       location:
 *                         type: string
 *                       lastActivity:
 *                         type: string
 *                         format: date-time
 *                       current:
 *                         type: boolean
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  // TODO: Implémenter la gestion des sessions
  res.json({
    success: true,
    message: 'Gestion des sessions - À implémenter',
    data: []
  });
});

/**
 * @swagger
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Supprimer une session spécifique
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session supprimée
 *       404:
 *         description: Session non trouvée
 */
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  // TODO: Implémenter la suppression de session
  res.json({
    success: true,
    message: 'Suppression session - À implémenter'
  });
});

// ==============================================
// ROUTES DE DEBUG (DEVELOPMENT ONLY)
// ==============================================

if (process.env.NODE_ENV === 'development') {
  /**
   * Route de debug pour tester les tokens
   * ATTENTION: Disponible uniquement en développement
   */
  router.get('/debug/token', authenticateToken, (req, res) => {
    res.json({
      success: true,
      message: '🔍 Debug token - Développement uniquement',
      data: {
        user: req.user,
        tokenValid: true,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    });
  });

  /**
   * Route pour générer des tokens de test
   */
  router.post('/debug/generate-test-token', (req, res) => {
    res.json({
      success: true,
      message: '🧪 Génération token test - À implémenter',
      data: {
        note: 'Cette route est pour les tests uniquement',
        environment: process.env.NODE_ENV
      }
    });
  });
}

// ==============================================
// MIDDLEWARE DE GESTION D'ERREURS SPÉCIFIQUE
// ==============================================

router.use((error: Error, req: any, res: any, next: any) => {
  console.error('❌ Erreur dans les routes auth:', error);
  
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur d\'authentification',
    errors: [{
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
      code: 'AUTH_INTERNAL_ERROR'
    }],
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

export default router;