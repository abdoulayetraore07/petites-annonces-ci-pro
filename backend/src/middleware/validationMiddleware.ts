// backend/src/middleware/validationMiddleware.ts
// MIDDLEWARE VALIDATION RÉVOLUTIONNAIRE - SÉCURITÉ NIVEAU PENTAGONE
// Validation Zod ultra-stricte spécialisée pour la Côte d'Ivoire

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { 
  REGIONS_COTE_IVOIRE, 
  CATEGORIES_CI, 
  StatutAnnonce, 
  EtatProduit,
  MethodePaiement,
  UserStatus,
  Gender
} from '../../../shared/src/types';
import rateLimit from 'express-rate-limit';
import validator from 'validator';
import { createHash } from 'crypto';

// ==============================================
// UTILITAIRES DE VALIDATION CÔTE D'IVOIRE
// ==============================================

/**
 * Validation téléphone ivoirien (+225)
 * Supporte tous les formats : +225, 00225, 225, direct
 */
const validateIvoirianPhone = (phone: string): boolean => {
  // Nettoyer le numéro
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Patterns supportés pour CI
  const patterns = [
    /^\+225[0-9]{8,10}$/,     // +225XXXXXXXX
    /^00225[0-9]{8,10}$/,     // 00225XXXXXXXX  
    /^225[0-9]{8,10}$/,       // 225XXXXXXXX
    /^[0-9]{8,10}$/           // XXXXXXXX (direct)
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
};

/**
 * Validation email avec domaines CI populaires
 */
const validateEmail = (email: string): boolean => {
  if (!validator.isEmail(email)) return false;
  
  // Domaines interdits (temporaires/jetables)
  const forbiddenDomains = [
    '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
    'tempmail.org', 'throwaway.email', 'trash-mail.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return !forbiddenDomains.includes(domain);
};

/**
 * Validation coordonnées GPS Côte d'Ivoire
 * Latitude: 4.3° à 10.7° Nord
 * Longitude: -8.6° à -2.5° Ouest
 */
const validateCICoordinates = (lat: number, lon: number): boolean => {
  return lat >= 4.3 && lat <= 10.7 && lon >= -8.6 && lon <= -2.5;
};

/**
 * Détection contenu suspect/spam
 */
const validateContentSafety = (text: string): boolean => {
  const suspiciousPatterns = [
    /viagra|cialis|casino|bitcoin|crypto/gi,
    /arnaque|scam|ponzi|pyramid/gi,
    /whatsapp.*argent|money.*transfer/gi,
    /lottery.*winner|héritage.*million/gi
  ];
  
  return !suspiciousPatterns.some(pattern => pattern.test(text));
};

// ==============================================
// SCHÉMAS ZOD RÉVOLUTIONNAIRES
// ==============================================

/**
 * 🔐 Schéma d'inscription utilisateur ultra-sécurisé
 */
const registerSchema = z.object({
  nom: z.string()
    .min(2, 'Nom trop court (min 2 caractères)')
    .max(50, 'Nom trop long (max 50 caractères)')
    .regex(/^[a-zA-ZÀ-ÿ\s\-']+$/, 'Nom contient des caractères invalides')
    .transform(val => val.trim()),
    
  prenoms: z.string()
    .min(2, 'Prénoms trop courts (min 2 caractères)')
    .max(100, 'Prénoms trop longs (max 100 caractères)')
    .regex(/^[a-zA-ZÀ-ÿ\s\-']+$/, 'Prénoms contiennent des caractères invalides')
    .transform(val => val.trim()),
    
  email: z.string()
    .email('Format email invalide')
    .max(255, 'Email trop long')
    .refine(validateEmail, 'Email ou domaine non autorisé')
    .transform(val => val.toLowerCase().trim()),
    
  telephone: z.string()
    .refine(validateIvoirianPhone, 'Numéro de téléphone ivoirien invalide')
    .transform(val => {
      // Normalisation format +225XXXXXXXX
      const cleaned = val.replace(/[\s\-\(\)\.]/g, '');
      if (cleaned.startsWith('+225')) return cleaned;
      if (cleaned.startsWith('00225')) return '+225' + cleaned.slice(5);
      if (cleaned.startsWith('225')) return '+225' + cleaned.slice(3);
      return '+225' + cleaned;
    }),
    
  motDePasse: z.string()
    .min(8, 'Mot de passe trop court (min 8 caractères)')
    .max(128, 'Mot de passe trop long (max 128 caractères)')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Mot de passe doit contenir: minuscule, majuscule, chiffre, caractère spécial'),
           
  confirmationMotDePasse: z.string(),
  
  dateNaissance: z.string()
    .refine(val => {
      const date = new Date(val);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      return age >= 13 && age <= 120;
    }, 'Âge doit être entre 13 et 120 ans'),
    
  genre: z.nativeEnum(Gender).optional(),
  
  ville: z.string()
    .min(2, 'Ville requise')
    .max(100, 'Ville trop longue'),
    
  accepteConditions: z.boolean()
    .refine(val => val === true, 'Vous devez accepter les conditions d\'utilisation'),
    
  accepteNewsletter: z.boolean().default(false)
    
}).refine(data => data.motDePasse === data.confirmationMotDePasse, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmationMotDePasse']
});

/**
 * 🔑 Schéma de connexion sécurisé
 */
const loginSchema = z.object({
  identifiant: z.string()
    .min(1, 'Identifiant requis')
    .max(255, 'Identifiant trop long')
    .transform(val => val.toLowerCase().trim()),
    
  motDePasse: z.string()
    .min(1, 'Mot de passe requis')
    .max(128, 'Mot de passe trop long'),
    
  seSouvenir: z.boolean().default(false),
  
  // Protection contre brute force
  captcha: z.string().optional(),
  
  // Tracking sécurisé
  deviceFingerprint: z.string().optional()
});

/**
 * 📢 Schéma création annonce révolutionnaire
 */
const createAnnonceSchema = z.object({
  titre: z.string()
    .min(5, 'Titre trop court (min 5 caractères)')
    .max(200, 'Titre trop long (max 200 caractères)')
    .regex(/^[^<>{}]*$/, 'Titre contient des caractères interdits')
    .refine(validateContentSafety, 'Contenu suspect détecté dans le titre')
    .transform(val => val.trim()),
    
  description: z.string()
    .min(10, 'Description trop courte (min 10 caractères)')
    .max(5000, 'Description trop longue (max 5000 caractères)')
    .regex(/^[^<>{}]*$/, 'Description contient des caractères interdits')
    .refine(validateContentSafety, 'Contenu suspect détecté dans la description')
    .transform(val => val.trim()),
    
  prix: z.number()
    .min(0.01, 'Prix doit être positif')
    .max(1_000_000_000, 'Prix trop élevé (max 1 milliard XOF)')
    .refine(val => Number.isFinite(val), 'Prix invalide'),
    
  negociable: z.boolean().default(true),
  
  categorie: z.string()
    .refine(val => Object.keys(CATEGORIES_CI).includes(val), 'Catégorie invalide'),
    
  sousCategorie: z.string()
    .optional()
    .refine((val, ctx) => {
      if (!val) return true;
      const categorie = ctx.parent.categorie;
      const category = CATEGORIES_CI[categorie as keyof typeof CATEGORIES_CI];
      return category?.sousCategories?.includes(val);
    }, 'Sous-catégorie invalide pour cette catégorie'),
    
  etat: z.nativeEnum(EtatProduit).optional(),
  
  // Géolocalisation Côte d'Ivoire
  region: z.string()
    .refine(val => Object.keys(REGIONS_COTE_IVOIRE).includes(val), 'Région invalide'),
    
  commune: z.string()
    .refine((val, ctx) => {
      const region = ctx.parent.region;
      const regionData = REGIONS_COTE_IVOIRE[region as keyof typeof REGIONS_COTE_IVOIRE];
      return regionData?.communes?.includes(val);
    }, 'Commune invalide pour cette région'),
    
  quartier: z.string()
    .max(100, 'Quartier trop long (max 100 caractères)')
    .optional()
    .transform(val => val?.trim()),
    
  // Coordonnées GPS optionnelles
  latitude: z.number()
    .optional()
    .refine((val, ctx) => {
      if (!val) return true;
      const lon = ctx.parent.longitude;
      return lon ? validateCICoordinates(val, lon) : true;
    }, 'Coordonnées en dehors de la Côte d\'Ivoire'),
    
  longitude: z.number()
    .optional()
    .refine((val, ctx) => {
      if (!val) return true;
      const lat = ctx.parent.latitude;
      return lat ? validateCICoordinates(lat, val) : true;
    }, 'Coordonnées en dehors de la Côte d\'Ivoire'),
    
  // Contact
  telephone: z.string()
    .optional()
    .refine(val => !val || validateIvoirianPhone(val), 'Numéro de téléphone ivoirien invalide')
    .transform(val => {
      if (!val) return undefined;
      const cleaned = val.replace(/[\s\-\(\)\.]/g, '');
      if (cleaned.startsWith('+225')) return cleaned;
      if (cleaned.startsWith('00225')) return '+225' + cleaned.slice(5);
      if (cleaned.startsWith('225')) return '+225' + cleaned.slice(3);
      return '+225' + cleaned;
    }),
    
  whatsapp: z.string()
    .optional()
    .refine(val => !val || validateIvoirianPhone(val), 'Numéro WhatsApp ivoirien invalide')
    .transform(val => {
      if (!val) return undefined;
      const cleaned = val.replace(/[\s\-\(\)\.]/g, '');
      if (cleaned.startsWith('+225')) return cleaned;
      if (cleaned.startsWith('00225')) return '+225' + cleaned.slice(5);
      if (cleaned.startsWith('225')) return '+225' + cleaned.slice(3);
      return '+225' + cleaned;
    }),
    
  // Tags et métadonnées
  tags: z.array(z.string().min(2).max(30))
    .max(20, 'Maximum 20 tags autorisés')
    .optional()
    .transform(val => val?.map(tag => tag.trim().toLowerCase())),
    
  // Images (validation côté serveur)
  images: z.array(z.string().url())
    .max(8, 'Maximum 8 images autorisées')
    .optional(),
    
  // Validité annonce
  dateExpiration: z.string()
    .optional()
    .refine(val => {
      if (!val) return true;
      const expiry = new Date(val);
      const now = new Date();
      const maxExpiry = new Date();
      maxExpiry.setMonth(maxExpiry.getMonth() + 6); // Max 6 mois
      return expiry > now && expiry <= maxExpiry;
    }, 'Date d\'expiration invalide (max 6 mois)'),
    
  // Options premium
  boost: z.object({
    type: z.enum(['premium', 'urgent', 'promue']),
    duree: z.number().min(1).max(30), // Max 30 jours
    paiement: z.nativeEnum(MethodePaiement)
  }).optional()
});

/**
 * 🔍 Schéma recherche avancée
 */
const searchSchema = z.object({
  q: z.string()
    .max(200, 'Recherche trop longue')
    .optional()
    .transform(val => val?.trim()),
    
  categorie: z.string()
    .refine(val => !val || Object.keys(CATEGORIES_CI).includes(val), 'Catégorie invalide')
    .optional(),
    
  region: z.string()
    .refine(val => !val || Object.keys(REGIONS_COTE_IVOIRE).includes(val), 'Région invalide')
    .optional(),
    
  commune: z.string().optional(),
  
  prixMin: z.number().min(0).optional(),
  prixMax: z.number().min(0).optional(),
  
  etat: z.array(z.nativeEnum(EtatProduit)).optional(),
  
  // Géolocalisation
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  rayon: z.number().min(1).max(100).optional(), // Rayon en km
  
  // Tri et pagination
  sortBy: z.enum(['recent', 'prix_asc', 'prix_desc', 'popularite', 'distance']).default('recent'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
  
  // Filtres avancés
  avecImages: z.boolean().optional(),
  negociable: z.boolean().optional(),
  datePublication: z.enum(['24h', '7j', '30j', '90j']).optional()
    
}).refine(data => {
  if (data.prixMin && data.prixMax) {
    return data.prixMin <= data.prixMax;
  }
  return true;
}, {
  message: 'Prix minimum doit être inférieur au prix maximum',
  path: ['prixMax']
});

/**
 * 💰 Schéma boost/promotion d'annonce
 */
const boostSchema = z.object({
  type: z.enum(['premium', 'urgent', 'promue'], {
    required_error: 'Type de boost requis'
  }),
  
  duree: z.number()
    .min(1, 'Durée minimum: 1 jour')
    .max(30, 'Durée maximum: 30 jours'),
    
  paiement: z.nativeEnum(MethodePaiement, {
    required_error: 'Méthode de paiement requise'
  }),
  
  // Données paiement spécifiques CI
  numeroPaiement: z.string()
    .optional()
    .refine(val => {
      if (!val) return true;
      return validateIvoirianPhone(val);
    }, 'Numéro de paiement mobile invalide'),
    
  codeConfirmation: z.string()
    .min(4, 'Code de confirmation requis')
    .max(20, 'Code trop long')
    .optional()
});

// ==============================================
// FACTORY DE VALIDATION MIDDLEWARE
// ==============================================

/**
 * Crée un middleware de validation personnalisé
 */
const createValidationMiddleware = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Logging pour debug (développement uniquement)
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Validation ${source}:`, req[source]);
      }
      
      // Validation avec transformation automatique
      const validated = await schema.parseAsync(req[source]);
      
      // Remplacement des données par les données validées/transformées
      req[source] = validated;
      
      // Hash du contenu pour détection de doublons (seulement pour création)
      if (source === 'body' && req.method === 'POST') {
        const contentHash = createHash('sha256')
          .update(JSON.stringify(validated))
          .digest('hex');
        req.contentHash = contentHash;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.input
        }));
        
        return res.status(400).json({
          error: '🚫 Données invalides',
          message: 'Veuillez corriger les erreurs suivantes',
          details: formattedErrors,
          timestamp: new Date().toISOString()
        });
      }
      
      // Erreur de validation interne
      console.error('❌ Erreur validation middleware:', error);
      return res.status(500).json({
        error: '⚠️ Erreur de validation',
        message: 'Erreur interne de validation',
        code: 'VALIDATION_ERROR'
      });
    }
  };
};

// ==============================================
// MIDDLEWARES SPÉCIALISÉS EXPORT
// ==============================================

/**
 * 🔐 Validation inscription utilisateur
 */
export const validateRegister = createValidationMiddleware(registerSchema, 'body');

/**
 * 🔑 Validation connexion utilisateur
 */
export const validateLogin = createValidationMiddleware(loginSchema, 'body');

/**
 * 📢 Validation création d'annonce
 */
export const validateCreateAnnonce = createValidationMiddleware(createAnnonceSchema, 'body');

/**
 * 📝 Validation modification d'annonce (schema partiel)
 */
export const validateUpdateAnnonce = createValidationMiddleware(
  createAnnonceSchema.partial(), 
  'body'
);

/**
 * 🔍 Validation recherche avancée
 */
export const validateSearch = createValidationMiddleware(searchSchema, 'query');

/**
 * 💰 Validation boost d'annonce
 */
export const validateBoost = createValidationMiddleware(boostSchema, 'body');

/**
 * 🆔 Validation ID MongoDB/UUID
 */
export const validateId = createValidationMiddleware(
  z.object({
    id: z.string()
      .min(1, 'ID requis')
      .regex(/^[a-fA-F0-9]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'Format ID invalide')
  }),
  'params'
);

/**
 * 📄 Validation pagination
 */
export const validatePagination = createValidationMiddleware(
  z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),
  'query'
);

// ==============================================
// MIDDLEWARE DE DÉTECTION DE CONTENU DUPLIQUÉ
// ==============================================

/**
 * 🔄 Détection de contenu dupliqué
 * Utilise le hash du contenu pour identifier les doublons
 */
export const detectDuplicateContent = () => {
  const recentHashes = new Map<string, { timestamp: number, count: number }>();
  const WINDOW_TIME = 15 * 60 * 1000; // 15 minutes
  const MAX_DUPLICATES = 3;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const contentHash = req.contentHash;
    
    if (!contentHash) {
      return next();
    }
    
    const now = Date.now();
    const existing = recentHashes.get(contentHash);
    
    // Nettoyer les anciens hashes
    for (const [hash, data] of recentHashes.entries()) {
      if (now - data.timestamp > WINDOW_TIME) {
        recentHashes.delete(hash);
      }
    }
    
    if (existing) {
      if (existing.count >= MAX_DUPLICATES) {
        return res.status(429).json({
          error: '🔄 Contenu dupliqué détecté',
          message: `Contenu identique publié ${existing.count} fois en 15 minutes`,
          code: 'DUPLICATE_CONTENT',
          retryAfter: '15 minutes'
        });
      }
      
      existing.count++;
      existing.timestamp = now;
    } else {
      recentHashes.set(contentHash, { timestamp: now, count: 1 });
    }
    
    next();
  };
};

// ==============================================
// TYPES POUR EXTENSION EXPRESS
// ==============================================

declare global {
  namespace Express {
    interface Request {
      contentHash?: string;
    }
  }
}

export default {
  validateRegister,
  validateLogin,
  validateCreateAnnonce,
  validateUpdateAnnonce,
  validateSearch,
  validateBoost,
  validateId,
  validatePagination,
  detectDuplicateContent
};