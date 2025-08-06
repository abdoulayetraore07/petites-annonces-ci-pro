// backend/src/controllers/annonceController.ts
// CONTRÔLEUR ANNONCES RÉVOLUTIONNAIRE AVEC IA ET ANALYTICS

import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import AnnonceService from '../services/annonceService';
import type { 
  ApiResponse, 
  SearchFilters, 
  StatutAnnonce, 
  EtatProduit 
} from '../../../shared/src/types';
import { 
  annonceSchema, 
  searchSchema, 
  CATEGORIES_CI, 
  REGIONS_COTE_IVOIRE,
  LIMITS 
} from '../../../shared/src/types';

// ==============================================
// CONFIGURATION CLOUDINARY
// ==============================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==============================================
// CONFIGURATION MULTER POUR UPLOAD
// ==============================================

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: LIMITS.FILE.MAX_SIZE_IMAGE, // 5MB
    files: LIMITS.ANNONCE.MAX_IMAGES, // 10 fichiers max
  },
  fileFilter: (req, file, cb) => {
    // Types d'images acceptés
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Formats acceptés: JPG, PNG, WebP'));
    }
  },
});

// ==============================================
// RATE LIMITING SPÉCIALISÉ
// ==============================================

// Rate limiting pour création d'annonces
export const createAnnonceLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // Maximum 10 annonces par heure
  message: {
    error: 'Limite de création d\'annonces atteinte',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting pour recherche (plus permissif)
export const searchLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 recherches par minute
  message: {
    error: 'Trop de recherches depuis cette IP',
    retryAfter: 1
  },
});

// Rate limiting pour upload d'images
export const uploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 uploads par 15 minutes
  message: {
    error: 'Limite d\'upload d\'images atteinte',
    retryAfter: 15
  },
});

// ==============================================
// VALIDATEURS EXPRESS-VALIDATOR
// ==============================================

export const validateCreateAnnonce = [
  body('titre')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Titre requis (5-200 caractères)')
    .matches(/^[^<>{}]*$/)
    .withMessage('Titre contient des caractères interdits'),

  body('description')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description requise (10-5000 caractères)')
    .matches(/^[^<>{}]*$/)
    .withMessage('Description contient des caractères interdits'),

  body('prix')
    .isFloat({ min: 0.01 })
    .withMessage('Prix doit être positif')
    .custom((value) => {
      if (value > 1000000000) { // 1 milliard XOF max
        throw new Error('Prix trop élevé (max 1 milliard XOF)');
      }
      return true;
    }),

  body('negociable')
    .optional()
    .isBoolean()
    .withMessage('Négociable doit être vrai ou faux'),

  body('categorie')
    .trim()
    .notEmpty()
    .withMessage('Catégorie requise')
    .custom((value) => {
      if (!CATEGORIES_CI[value as keyof typeof CATEGORIES_CI]) {
        throw new Error('Catégorie invalide');
      }
      return true;
    }),

  body('sousCategorie')
    .optional()
    .trim()
    .custom((value, { req }) => {
      if (value && req.body.categorie) {
        const category = CATEGORIES_CI[req.body.categorie as keyof typeof CATEGORIES_CI];
        if (category && !category.sousCategories.includes(value)) {
          throw new Error('Sous-catégorie invalide pour cette catégorie');
        }
      }
      return true;
    }),

  body('region')
    .trim()
    .notEmpty()
    .withMessage('Région requise')
    .custom((value) => {
      if (!REGIONS_COTE_IVOIRE[value as keyof typeof REGIONS_COTE_IVOIRE]) {
        throw new Error('Région invalide');
      }
      return true;
    }),

  body('commune')
    .trim()
    .notEmpty()
    .withMessage('Commune requise')
    .custom((value, { req }) => {
      if (value && req.body.region) {
        const region = REGIONS_COTE_IVOIRE[req.body.region as keyof typeof REGIONS_COTE_IVOIRE];
        if (region && !region.communes.includes(value)) {
          throw new Error('Commune invalide pour cette région');
        }
      }
      return true;
    }),

  body('quartier')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Quartier trop long (max 100 caractères)'),

  body('telephone')
    .optional()
    .trim()
    .matches(/^(\+225|00225|225)?[0-9]{8,10}$/)
    .withMessage('Numéro de téléphone ivoirien invalide'),

  body('whatsapp')
    .optional()
    .trim()
    .matches(/^(\+225|00225|225)?[0-9]{8,10}$/)
    .withMessage('Numéro WhatsApp ivoirien invalide'),

  body('etat')
    .optional()
    .isIn(['NEUF', 'TRES_BON_ETAT', 'BON_ETAT', 'ETAT_MOYEN', 'POUR_PIECES'])
    .withMessage('État du produit invalide'),

  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Maximum 20 tags autorisés'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Tag doit contenir 2-50 caractères'),

  body('proprietes')
    .optional()
    .isObject()
    .withMessage('Propriétés doivent être un objet'),
];

export const validateSearchAnnonces = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Recherche trop longue (max 200 caractères)')
    .matches(/^[^<>{}]*$/)
    .withMessage('Recherche contient des caractères interdits'),

  query('categorie')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !CATEGORIES_CI[value as keyof typeof CATEGORIES_CI]) {
        throw new Error('Catégorie invalide');
      }
      return true;
    }),

  query('region')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !REGIONS_COTE_IVOIRE[value as keyof typeof REGIONS_COTE_IVOIRE]) {
        throw new Error('Région invalide');
      }
      return true;
    }),

  query('prixMin')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Prix minimum doit être positif'),

  query('prixMax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Prix maximum doit être positif')
    .custom((value, { req }) => {
      const prixMin = parseFloat(req.query?.prixMin as string);
      if (prixMin && value && parseFloat(value) < prixMin) {
        throw new Error('Prix maximum doit être supérieur au prix minimum');
      }
      return true;
    }),

  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page doit être entre 1 et 1000'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limite doit être entre 1 et 50'),

  query('sortBy')
    .optional()
    .isIn(['recent', 'prix_asc', 'prix_desc', 'pertinence', 'distance'])
    .withMessage('Tri invalide'),

  query('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude invalide'),

  query('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude invalide'),
];

export const validateAnnonceId = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('ID annonce requis')
    .isLength({ min: 20, max: 30 })
    .withMessage('Format ID invalide')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('ID contient des caractères invalides'),
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
// MIDDLEWARE D'UPLOAD D'IMAGES
// ==============================================

export const uploadImages = upload.array('images', LIMITS.ANNONCE.MAX_IMAGES);

const uploadToCloudinary = async (buffer: Buffer, filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: `${process.env.CLOUDINARY_FOLDER || 'petites-annonces-ci'}/annonces`,
        public_id: filename,
        transformation: [
          { width: 1200, height: 900, crop: 'limit', quality: 'auto' },
          { format: 'webp' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result!.secure_url);
        }
      }
    ).end(buffer);
  });
};

// ==============================================
// CONTRÔLEUR ANNONCECONTROLLER
// ==============================================

export class AnnonceController {

  // ==============================================
  // CRÉATION D'ANNONCE AVEC IA
  // ==============================================

  static async createAnnonce(req: Request, res: Response): Promise<void> {
    try {
      console.log('📢 Création d\'annonce:', {
        userId: req.user?.id,
        categorie: req.body.categorie,
        prix: req.body.prix
      });

      // Validation Zod en plus d'express-validator
      const validationResult = annonceSchema.safeParse({
        ...req.body,
        images: req.body.images || []
      });

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

      // Vérifier que l'utilisateur a des images uploadées
      if (!req.body.images || req.body.images.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Au moins une image est requise',
          errors: [{
            field: 'images',
            message: 'Veuillez ajouter au moins une image',
            code: 'MISSING_IMAGES'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      // Créer l'annonce via le service
      const annonceData = {
        ...req.body,
        userId: req.user!.id
      };

      const annonce = await AnnonceService.createAnnonce(annonceData);

      console.log('✅ Annonce créée avec succès:', {
        annonceId: annonce.id,
        titre: annonce.titre,
        prix: annonce.prix
      });

      const response: ApiResponse<typeof annonce> = {
        success: true,
        message: 'Annonce créée avec succès !',
        data: annonce,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('❌ Erreur création annonce:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création';
      
      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{
          message: errorMessage,
          code: 'ANNONCE_CREATION_ERROR'
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
  // UPLOAD D'IMAGES CLOUDINARY
  // ==============================================

  static async uploadImages(req: Request, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Aucune image fournie',
          errors: [{
            message: 'Veuillez sélectionner au moins une image',
            code: 'NO_FILES'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      console.log(`📷 Upload de ${files.length} images`);

      // Upload parallèle vers Cloudinary
      const uploadPromises = files.map(async (file, index) => {
        const timestamp = Date.now();
        const filename = `${req.user!.id}_${timestamp}_${index}`;
        return uploadToCloudinary(file.buffer, filename);
      });

      const imageUrls = await Promise.all(uploadPromises);

      console.log('✅ Images uploadées avec succès:', imageUrls.length);

      const response: ApiResponse<{ images: string[] }> = {
        success: true,
        message: `${imageUrls.length} image(s) uploadée(s) avec succès`,
        data: { images: imageUrls },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur upload images:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de l\'upload des images',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur upload',
          code: 'IMAGE_UPLOAD_ERROR'
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
  // RECHERCHE AVANCÉE AVEC IA
  // ==============================================

  static async searchAnnonces(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 Recherche d\'annonces:', req.query);

      // Validation Zod de la recherche
      const validationResult = searchSchema.safeParse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limite: req.query.limit ? parseInt(req.query.limit as string) : 20,
        prixMin: req.query.prixMin ? parseFloat(req.query.prixMin as string) : undefined,
        prixMax: req.query.prixMax ? parseFloat(req.query.prixMax as string) : undefined,
      });

      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          message: 'Paramètres de recherche invalides',
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: 'SEARCH_VALIDATION_ERROR'
          })),
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      const { page, limite, tri, ...filters } = validationResult.data;

      // Position géographique de l'utilisateur (optionnelle)
      const userLocation = (req.query.latitude && req.query.longitude) ? {
        latitude: parseFloat(req.query.latitude as string),
        longitude: parseFloat(req.query.longitude as string)
      } : undefined;

      // Appel du service de recherche avancée
      const result = await AnnonceService.searchAnnonces({
        filters: filters as SearchFilters,
        page,
        limit: limite,
        sortBy: tri,
        userLocation
      });

      console.log('✅ Recherche réussie:', {
        total: result.total,
        page: result.page,
        annonces: result.annonces.length
      });

      const response: ApiResponse<typeof result> = {
        success: true,
        message: `${result.total} annonce(s) trouvée(s)`,
        data: result,
        meta: {
          pagination: {
            page: result.page,
            limit: limite,
            total: result.total,
            totalPages: result.totalPages
          },
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur recherche:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la recherche',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur de recherche',
          code: 'SEARCH_ERROR'
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
  // RÉCUPÉRATION ANNONCE AVEC ANALYTICS
  // ==============================================

  static async getAnnonceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id; // Peut être undefined si non connecté

      console.log('👀 Consultation annonce:', { annonceId: id, userId });

      const annonce = await AnnonceService.getAnnonceById(id, userId);

      if (!annonce) {
        const response: ApiResponse = {
          success: false,
          message: 'Annonce non trouvée',
          errors: [{
            message: 'Cette annonce n\'existe pas ou a été supprimée',
            code: 'ANNONCE_NOT_FOUND'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(404).json(response);
        return;
      }

      console.log('✅ Annonce récupérée:', {
        annonceId: annonce.id,
        titre: annonce.titre,
        vues: annonce.vuesCount
      });

      const response: ApiResponse<typeof annonce> = {
        success: true,
        message: 'Annonce récupérée avec succès',
        data: annonce,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur récupération annonce:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          code: 'ANNONCE_FETCH_ERROR'
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
  // GESTION DES FAVORIS
  // ==============================================

  static async toggleFavorite(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      console.log('⭐ Toggle favori:', { annonceId: id, userId });

      const result = await AnnonceService.toggleFavorite(id, userId);

      console.log('✅ Favori mis à jour:', result);

      const message = result.isFavorite 
        ? 'Annonce ajoutée aux favoris' 
        : 'Annonce retirée des favoris';

      const response: ApiResponse<typeof result> = {
        success: true,
        message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur toggle favori:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la gestion des favoris',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur favori',
          code: 'FAVORITE_ERROR'
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
  // MISE À JOUR ANNONCE
  // ==============================================

  static async updateAnnonce(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      console.log('✏️ Mise à jour annonce:', { annonceId: id, userId });

      const updatedAnnonce = await AnnonceService.updateAnnonce(id, userId, req.body);

      console.log('✅ Annonce mise à jour:', {
        annonceId: updatedAnnonce.id,
        titre: updatedAnnonce.titre
      });

      const response: ApiResponse<typeof updatedAnnonce> = {
        success: true,
        message: 'Annonce mise à jour avec succès',
        data: updatedAnnonce,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur mise à jour annonce:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la mise à jour';
      let statusCode = 400;

      if (errorMessage.includes('non trouvée') || errorMessage.includes('non autorisée')) {
        statusCode = 404;
      }

      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{
          message: errorMessage,
          code: 'ANNONCE_UPDATE_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(statusCode).json(response);
    }
  }

  // ==============================================
  // SUPPRESSION ANNONCE
  // ==============================================

  static async deleteAnnonce(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      console.log('🗑️ Suppression annonce:', { annonceId: id, userId });

      await AnnonceService.deleteAnnonce(id, userId);

      console.log('✅ Annonce supprimée:', { annonceId: id });

      const response: ApiResponse = {
        success: true,
        message: 'Annonce supprimée avec succès',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur suppression annonce:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression';
      let statusCode = 400;

      if (errorMessage.includes('non trouvée') || errorMessage.includes('non autorisée')) {
        statusCode = 404;
      }

      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{
          message: errorMessage,
          code: 'ANNONCE_DELETE_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(statusCode).json(response);
    }
  }

  // ==============================================
  // STATISTIQUES ANNONCE
  // ==============================================

  static async getAnnonceStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      console.log('📊 Récupération stats annonce:', { annonceId: id, userId });

      // Vérifier que l'utilisateur possède l'annonce
      const annonce = await AnnonceService.getAnnonceById(id, userId);
      if (!annonce || annonce.userId !== userId) {
        const response: ApiResponse = {
          success: false,
          message: 'Annonce non trouvée ou non autorisée',
          errors: [{
            message: 'Vous ne pouvez consulter que les statistiques de vos propres annonces',
            code: 'UNAUTHORIZED_STATS'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(403).json(response);
        return;
      }

      const stats = await AnnonceService.getAnnonceStats(id);

      console.log('✅ Stats récupérées:', stats);

      const response: ApiResponse<typeof stats> = {
        success: true,
        message: 'Statistiques récupérées avec succès',
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur stats annonce:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur stats',
          code: 'STATS_ERROR'
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
  // RECOMMANDATIONS SIMILAIRES
  // ==============================================

  static async getSimilarAnnonces(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 5;

      console.log('🎯 Récupération annonces similaires:', { annonceId: id, limit });

      const similarAnnonces = await AnnonceService.getSimilarAnnonces(id, limit);

      console.log('✅ Annonces similaires trouvées:', similarAnnonces.length);

      const response: ApiResponse<typeof similarAnnonces> = {
        success: true,
        message: `${similarAnnonces.length} annonce(s) similaire(s) trouvée(s)`,
        data: similarAnnonces,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur annonces similaires:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération des annonces similaires',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur recommandations',
          code: 'SIMILAR_ANNONCES_ERROR'
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
  // MES ANNONCES (UTILISATEUR CONNECTÉ)
  // ==============================================

  static async getMyAnnonces(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const statut = req.query.statut as StatutAnnonce;

      console.log('📋 Récupération mes annonces:', { userId, page, limit, statut });

      // Construire les filtres pour les annonces de l'utilisateur
      const filters: SearchFilters = {};
      if (statut && Object.values(StatutAnnonce).includes(statut)) {
        // Note: Cette logique serait adaptée dans le service pour filtrer par statut
        filters.q = ''; // Placeholder - le service gérera le filtrage par utilisateur
      }

      // Pour l'instant, utiliser une approche simplifiée
      // TODO: Créer une méthode dédiée getUserAnnonces dans AnnonceService
      const result = await AnnonceService.searchAnnonces({
        filters,
        page,
        limit,
        sortBy: 'recent',
        // Ajouter un filtre utilisateur (à implémenter dans le service)
      });

      // Filtrer côté contrôleur (temporaire - à optimiser dans le service)
      const userAnnonces = result.annonces.filter(annonce => annonce.userId === userId);

      const response: ApiResponse<typeof userAnnonces> = {
        success: true,
        message: `${userAnnonces.length} de vos annonces récupérées`,
        data: userAnnonces,
        meta: {
          pagination: {
            page,
            limit,
            total: userAnnonces.length,
            totalPages: Math.ceil(userAnnonces.length / limit)
          },
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur mes annonces:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération de vos annonces',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur mes annonces',
          code: 'MY_ANNONCES_ERROR'
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
  // MES FAVORIS
  // ==============================================

  static async getMyFavorites(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      console.log('⭐ Récupération mes favoris:', { userId, page, limit });

      // TODO: Créer une méthode dédiée getUserFavorites dans AnnonceService
      // Pour l'instant, retourner un placeholder
      
      const favorites: any[] = []; // Placeholder

      const response: ApiResponse<any[]> = {
        success: true,
        message: `${favorites.length} favori(s) récupéré(s)`,
        data: favorites,
        meta: {
          pagination: {
            page,
            limit,
            total: favorites.length,
            totalPages: Math.ceil(favorites.length / limit)
          },
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur mes favoris:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération de vos favoris',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur favoris',
          code: 'FAVORITES_ERROR'
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
  // BOOST D'ANNONCE (PREMIUM)
  // ==============================================

  static async boostAnnonce(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { type } = req.body; // 'premium', 'promue', 'urgente'
      const userId = req.user!.id;

      console.log('🚀 Boost d\'annonce:', { annonceId: id, userId, type });

      if (!['premium', 'promue', 'urgente'].includes(type)) {
        const response: ApiResponse = {
          success: false,
          message: 'Type de boost invalide',
          errors: [{
            field: 'type',
            message: 'Type doit être: premium, promue ou urgente',
            code: 'INVALID_BOOST_TYPE'
          }],
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        res.status(400).json(response);
        return;
      }

      await AnnonceService.boostAnnonce(id, userId, type);

      console.log('✅ Annonce boostée:', { annonceId: id, type });

      const messages = {
        premium: 'Annonce mise en premium pour 30 jours',
        promue: 'Annonce promue pour 7 jours',
        urgente: 'Annonce marquée urgente pour 3 jours'
      };

      const response: ApiResponse = {
        success: true,
        message: messages[type as keyof typeof messages],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur boost annonce:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du boost';
      let statusCode = 400;

      if (errorMessage.includes('premium requis')) {
        statusCode = 402; // Payment Required
      } else if (errorMessage.includes('non autorisée')) {
        statusCode = 403;
      }

      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{
          message: errorMessage,
          code: 'BOOST_ERROR'
        }],
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(statusCode).json(response);
    }
  }

  // ==============================================
  // CATÉGORIES DISPONIBLES
  // ==============================================

  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      console.log('📂 Récupération des catégories');

      const categories = Object.entries(CATEGORIES_CI).map(([key, value]) => ({
        id: key,
        nom: value.nom,
        icon: value.icon,
        sousCategories: value.sousCategories,
        champsSpecifiques: value.champsSpecifiques
      }));

      const response: ApiResponse<typeof categories> = {
        success: true,
        message: 'Catégories récupérées avec succès',
        data: categories,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur récupération catégories:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération des catégories',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur catégories',
          code: 'CATEGORIES_ERROR'
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
  // RÉGIONS CÔTE D'IVOIRE
  // ==============================================

  static async getRegions(req: Request, res: Response): Promise<void> {
    try {
      console.log('🌍 Récupération des régions CI');

      const regions = Object.entries(REGIONS_COTE_IVOIRE).map(([key, value]) => ({
        id: key,
        nom: value.nom,
        communes: value.communes
      }));

      const response: ApiResponse<typeof regions> = {
        success: true,
        message: 'Régions de Côte d\'Ivoire récupérées avec succès',
        data: regions,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur récupération régions:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Erreur lors de la récupération des régions',
        errors: [{
          message: error instanceof Error ? error.message : 'Erreur régions',
          code: 'REGIONS_ERROR'
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
// MIDDLEWARE D'EXPORTS AVEC VALIDATION
// ==============================================

// Combiner les validateurs avec le gestionnaire d'erreurs
export const createAnnonceValidation = [
  ...validateCreateAnnonce,
  handleValidationErrors
];

export const searchValidation = [
  ...validateSearchAnnonces,
  handleValidationErrors
];

export const annonceIdValidation = [
  ...validateAnnonceId,
  handleValidationErrors
];

// Middleware d'upload avec gestion d'erreurs
export const handleImageUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadImages(req, res, (error) => {
    if (error) {
      console.error('❌ Erreur upload middleware:', error);
      
      let errorMessage = 'Erreur lors de l\'upload';
      let errorCode = 'UPLOAD_ERROR';

      if (error instanceof multer.MulterError) {
        switch (error.code) {
          case 'LIMIT_FILE_SIZE':
            errorMessage = `Fichier trop volumineux (max ${LIMITS.FILE.MAX_SIZE_IMAGE / (1024 * 1024)}MB)`;
            errorCode = 'FILE_TOO_LARGE';
            break;
          case 'LIMIT_FILE_COUNT':
            errorMessage = `Trop de fichiers (max ${LIMITS.ANNONCE.MAX_IMAGES})`;
            errorCode = 'TOO_MANY_FILES';
            break;
          case 'LIMIT_UNEXPECTED_FILE':
            errorMessage = 'Champ de fichier inattendu';
            errorCode = 'UNEXPECTED_FIELD';
            break;
          default:
            errorMessage = error.message;
        }
      } else {
        errorMessage = error.message;
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

      return res.status(400).json(response);
    }

    next();
  });
};

export default AnnonceController;