// backend/src/routes/annonceRoutes.ts
// ROUTES ANNONCES RÉVOLUTIONNAIRES - NIVEAU GOOGLE/TESLA
// Créé pour dominer le marché des petites annonces en Côte d'Ivoire

import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import {
  creerAnnonce,
  obtenirAnnonces,
  obtenirAnnonceParId,
  modifierAnnonce,
  supprimerAnnonce,
  obtenirMesAnnonces,
  ajouterAuxFavoris,
  supprimerDesFavoris,
  obtenirFavoris,
  boosterAnnonce,
  marquerCommeVendue,
  obtenirRecommandations,
  rechercherAnnonces,
  obtenirStatistiques
} from '../controllers/annonceController';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// ==============================================
// CONFIGURATION MULTER POUR UPLOAD D'IMAGES
// ==============================================
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max par fichier
    files: 8 // Maximum 8 images par annonce
  },
  fileFilter: (req, file, cb) => {
    // Types MIME autorisés pour images optimisées
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/avif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format d\'image non autorisé. Utilisez JPEG, PNG, WebP ou AVIF.'));
    }
  }
});

// ==============================================
// RATE LIMITING SPÉCIALISÉ POUR CHAQUE ACTION
// ==============================================

// Rate limiting création - Éviter le spam
const createLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 annonces par 15min
  message: {
    error: '🚫 Limite de création atteinte',
    message: 'Vous pouvez créer maximum 5 annonces par 15 minutes',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting recherche - Éviter la surcharge
const searchLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 recherches par minute
  message: {
    error: '🔍 Trop de recherches',
    message: 'Maximum 60 recherches par minute autorisées',
    retryAfter: '1 minute'
  }
});

// Rate limiting général pour lecture
const readLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Max 120 requêtes de lecture par minute
  message: {
    error: '⚡ Trop de requêtes',
    message: 'Maximum 120 requêtes par minute',
    retryAfter: '1 minute'
  }
});

// Rate limiting pour actions sensibles (boost, favoris)
const actionLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Max 30 actions par 5min
  message: {
    error: '🎯 Limite d\'actions atteinte',
    message: 'Maximum 30 actions par 5 minutes',
    retryAfter: '5 minutes'
  }
});

// ==============================================
// ROUTES PUBLIQUES (LECTURE SANS AUTHENTIFICATION)
// ==============================================

/**
 * 🌍 GET /api/annonces
 * Obtenir la liste des annonces publiques avec pagination et filtres avancés
 * Support géolocalisation, catégories, prix, recherche textuelle
 * 
 * Query params:
 * - page: Numéro de page (défaut: 1)
 * - limit: Éléments par page (défaut: 20, max: 50)
 * - categorie: Filtrer par catégorie
 * - region: Filtrer par région CI
 * - commune: Filtrer par commune
 * - prixMin: Prix minimum en XOF
 * - prixMax: Prix maximum en XOF
 * - q: Recherche textuelle
 * - sortBy: Tri (recent, prix_asc, prix_desc, popularite)
 */
router.get('/api/annonces', readLimit, optionalAuth, obtenirAnnonces);

/**
 * 🔍 GET /api/annonces/rechercher
 * Recherche avancée avec IA et géolocalisation
 * Supporte la recherche sémantique et les suggestions automatiques
 */
router.get('/api/annonces/rechercher', searchLimit, optionalAuth, rechercherAnnonces);

/**
 * 👁️ GET /api/annonces/:id
 * Obtenir les détails d'une annonce spécifique
 * Incrémente automatiquement le compteur de vues
 * Retourne les annonces similaires via IA
 */
router.get('/api/annonces/:id', readLimit, optionalAuth, obtenirAnnonceParId);

/**
 * 🎯 GET /api/annonces/:id/recommandations
 * Obtenir les recommandations IA pour une annonce
 * Basé sur la similarité, l'historique utilisateur et la géolocalisation
 */
router.get('/api/annonces/:id/recommandations', readLimit, optionalAuth, obtenirRecommandations);

// ==============================================
// ROUTES AUTHENTIFIÉES (GESTION DES ANNONCES)
// ==============================================

/**
 * ✨ POST /api/annonces
 * Créer une nouvelle annonce avec upload d'images
 * Support Cloudinary avec optimisation WebP automatique
 * Estimation de prix automatique par IA
 * Géolocalisation et validation complète
 */
router.post('/api/annonces', 
  createLimit,
  authenticateJWT,
  upload.array('images', 8), // Maximum 8 images
  creerAnnonce
);

/**
 * 📝 PUT /api/annonces/:id
 * Modifier une annonce existante
 * Seul le propriétaire peut modifier
 * Support ajout/suppression d'images
 */
router.put('/api/annonces/:id',
  actionLimit,
  authenticateJWT,
  upload.array('images', 8),
  modifierAnnonce
);

/**
 * 🗑️ DELETE /api/annonces/:id
 * Supprimer définitivement une annonce
 * Seul le propriétaire ou admin peut supprimer
 * Supprime automatiquement les images Cloudinary
 */
router.delete('/api/annonces/:id',
  actionLimit,
  authenticateJWT,
  supprimerAnnonce
);

/**
 * ✅ PATCH /api/annonces/:id/vendue
 * Marquer une annonce comme vendue
 * Change le statut et archive l'annonce
 */
router.patch('/api/annonces/:id/vendue',
  actionLimit,
  authenticateJWT,
  marquerCommeVendue
);

// ==============================================
// ROUTES UTILISATEUR PERSONNEL
// ==============================================

/**
 * 👤 GET /api/annonces/mes-annonces
 * Obtenir toutes les annonces de l'utilisateur connecté
 * Inclut brouillons, actives, vendues et supprimées
 * Statistiques détaillées par annonce
 */
router.get('/api/annonces/mes-annonces',
  readLimit,
  authenticateJWT,
  obtenirMesAnnonces
);

/**
 * 📊 GET /api/annonces/mes-annonces/statistiques
 * Statistiques détaillées des annonces utilisateur
 * Vues, favoris, messages, conversions
 * Graphiques et analytics avancés
 */
router.get('/api/annonces/mes-annonces/statistiques',
  readLimit,
  authenticateJWT,
  obtenirStatistiques
);

// ==============================================
// SYSTÈME DE FAVORIS INTELLIGENT
// ==============================================

/**
 * ❤️ POST /api/annonces/:id/favoris
 * Ajouter une annonce aux favoris
 * Système intelligent avec catégorisation automatique
 */
router.post('/api/annonces/:id/favoris',
  actionLimit,
  authenticateJWT,
  ajouterAuxFavoris
);

/**
 * 💔 DELETE /api/annonces/:id/favoris
 * Retirer une annonce des favoris
 */
router.delete('/api/annonces/:id/favoris',
  actionLimit,
  authenticateJWT,
  supprimerDesFavoris
);

/**
 * 📋 GET /api/favoris
 * Obtenir tous les favoris de l'utilisateur
 * Groupés par catégories avec métadonnées
 */
router.get('/api/favoris',
  readLimit,
  authenticateJWT,
  obtenirFavoris
);

// ==============================================
// SYSTÈME DE BOOST ET PROMOTION
// ==============================================

/**
 * 🚀 POST /api/annonces/:id/boost
 * Booster une annonce (premium, urgent, promue)
 * Système de paiement intégré (Orange Money, Wave, Stripe)
 * 
 * Body params:
 * - type: 'premium' | 'urgent' | 'promue'
 * - duree: Durée en jours (1-30)
 * - paiement: Méthode de paiement
 */
router.post('/api/annonces/:id/boost',
  actionLimit,
  authenticateJWT,
  boosterAnnonce
);

// ==============================================
// ROUTES ADMINISTRATEUR AVANCÉES
// ==============================================

/**
 * 🛡️ GET /api/admin/annonces
 * Interface admin pour gérer toutes les annonces
 * Filtres avancés, modération, statistiques globales
 */
router.get('/api/admin/annonces',
  readLimit,
  authenticateJWT,
  // TODO: Ajouter middleware admin
  (req, res) => {
    res.status(501).json({
      message: '🚧 Interface administrateur en développement',
      status: 'coming_soon',
      features: [
        'Modération automatique par IA',
        'Dashboard analytics avancé', 
        'Gestion des signalements',
        'Statistiques en temps réel'
      ]
    });
  }
);

// ==============================================
// GESTION D'ERREURS SPÉCIALISÉE
// ==============================================

// Middleware de gestion d'erreurs pour les uploads
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: '📸 Fichier trop volumineux',
        message: 'Taille maximum: 10MB par image',
        code: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: '📸 Trop d\'images',
        message: 'Maximum 8 images par annonce',
        code: 'TOO_MANY_FILES'
      });
    }
  }
  
  if (error.message?.includes('Format d\'image non autorisé')) {
    return res.status(400).json({
      error: '🖼️ Format non supporté',
      message: 'Utilisez JPEG, PNG, WebP ou AVIF uniquement',
      code: 'INVALID_FILE_FORMAT'
    });
  }
  
  next(error);
});

// ==============================================
// DOCUMENTATION SWAGGER INTÉGRÉE
// ==============================================

/**
 * 📚 GET /api/annonces/docs
 * Documentation interactive Swagger/OpenAPI
 * Exemples complets pour l'API des annonces
 */
router.get('/api/annonces/docs', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: '🚀 API Petites Annonces CI - Annonces',
      version: '1.0.0',
      description: 'API révolutionnaire pour la gestion des annonces en Côte d\'Ivoire',
      contact: {
        name: 'Support Technique',
        email: 'dev@petites-annonces-ci.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.petites-annonces-ci.com' 
          : 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Développement'
      }
    ],
    paths: {
      '/api/annonces': {
        get: {
          summary: 'Liste des annonces publiques',
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1 },
              description: 'Numéro de page'
            },
            {
              name: 'categorie', 
              in: 'query',
              schema: { type: 'string' },
              description: 'Filtrer par catégorie'
            },
            {
              name: 'region',
              in: 'query', 
              schema: { type: 'string' },
              description: 'Région en Côte d\'Ivoire'
            }
          ]
        },
        post: {
          summary: 'Créer une nouvelle annonce',
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    titre: { type: 'string', minLength: 5, maxLength: 200 },
                    description: { type: 'string', minLength: 10, maxLength: 5000 },
                    prix: { type: 'number', minimum: 0.01 },
                    categorie: { type: 'string' },
                    region: { type: 'string' },
                    commune: { type: 'string' },
                    images: {
                      type: 'array',
                      items: { type: 'string', format: 'binary' },
                      maxItems: 8
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  });
});

export default router;