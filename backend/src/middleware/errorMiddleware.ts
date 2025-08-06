// backend/src/middleware/errorMiddleware.ts
// MIDDLEWARE GESTION D'ERREURS RÉVOLUTIONNAIRE - NIVEAU GOOGLE/TESLA
// Gestion centralisée avec logging, monitoring et réponses intelligentes

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { MulterError } from 'multer';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// ==============================================
// CONFIGURATION LOGGER AVANCÉ
// ==============================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
      
      // Ajout métadonnées
      if (Object.keys(meta).length > 0) {
        log += ` | Metadata: ${JSON.stringify(meta)}`;
      }
      
      // Stack trace pour erreurs
      if (stack && level === 'error') {
        log += `\nStack: ${stack}`;
      }
      
      return log;
    })
  ),
  defaultMeta: {
    service: 'petites-annonces-ci-backend',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console pour développement
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Fichier pour toutes les erreurs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 10
    }),
    
    // Fichier pour tous les logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB 
      maxFiles: 5
    })
  ]
});

// Créer répertoire logs s'il n'existe pas
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (err) {
  console.warn('⚠️ Impossible de créer le répertoire logs:', err);
}

// ==============================================
// TYPES D'ERREURS MÉTIER
// ==============================================

export enum ErrorTypes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  DUPLICATE_ERROR = 'DUPLICATE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

/**
 * Classe d'erreur personnalisée pour l'application
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly type: ErrorTypes;
  public readonly isOperational: boolean;
  public readonly errorId: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    type: ErrorTypes = ErrorTypes.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = isOperational;
    this.errorId = uuidv4();
    this.context = context;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// ==============================================
// ERREURS MÉTIER SPÉCIALISÉES CÔTE D'IVOIRE
// ==============================================

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, ErrorTypes.VALIDATION_ERROR, true, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication requise', context?: Record<string, any>) {
    super(message, 401, ErrorTypes.AUTHENTICATION_ERROR, true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Accès non autorisé', context?: Record<string, any>) {
    super(message, 403, ErrorTypes.AUTHORIZATION_ERROR, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Ressource', context?: Record<string, any>) {
    super(`${resource} introuvable`, 404, ErrorTypes.NOT_FOUND_ERROR, true, context);
  }
}

export class DuplicateError extends AppError {
  constructor(field: string, context?: Record<string, any>) {
    super(`${field} existe déjà`, 409, ErrorTypes.DUPLICATE_ERROR, true, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Trop de requêtes', retryAfter?: string, context?: Record<string, any>) {
    super(message, 429, ErrorTypes.RATE_LIMIT_ERROR, true, { ...context, retryAfter });
  }
}

export class PaymentError extends AppError {
  constructor(message: string, provider?: string, context?: Record<string, any>) {
    super(message, 402, ErrorTypes.PAYMENT_ERROR, true, { ...context, provider });
  }
}

// ==============================================
// MAPPAGE ERREURS EXTERNES
// ==============================================

/**
 * Convertit les erreurs externes en erreurs applicatives
 */
const mapExternalError = (error: any): AppError => {
  // Erreurs Zod (validation)
  if (error instanceof ZodError) {
    const details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
    
    return new ValidationError('Données invalides', { details });
  }
  
  // Erreurs JWT
  if (error instanceof JsonWebTokenError) {
    if (error instanceof TokenExpiredError) {
      return new AuthenticationError('Token expiré', { expiredAt: error.expiredAt });
    }
    if (error instanceof NotBeforeError) {
      return new AuthenticationError('Token pas encore valide', { date: error.date });
    }
    return new AuthenticationError('Token invalide', { jwtError: error.message });
  }
  
  // Erreurs Multer (upload)
  if (error instanceof MulterError) {
    const errorMap: Record<string, { message: string; statusCode: number }> = {
      'LIMIT_FILE_SIZE': { 
        message: 'Fichier trop volumineux (max 10MB)', 
        statusCode: 413 
      },
      'LIMIT_FILE_COUNT': { 
        message: 'Trop de fichiers (max 8 images)', 
        statusCode: 400 
      },
      'LIMIT_UNEXPECTED_FILE': { 
        message: 'Champ de fichier inattendu', 
        statusCode: 400 
      },
      'LIMIT_PART_COUNT': { 
        message: 'Trop de parties dans la requête', 
        statusCode: 400 
      }
    };
    
    const mapped = errorMap[error.code] || { 
      message: 'Erreur d\'upload', 
      statusCode: 400 
    };
    
    return new AppError(
      mapped.message, 
      mapped.statusCode, 
      ErrorTypes.UPLOAD_ERROR, 
      true, 
      { multerCode: error.code, field: error.field }
    );
  }
  
  // Erreurs Prisma (base de données)
  if (error?.code?.startsWith?.('P')) {
    const prismaErrors: Record<string, { message: string; statusCode: number; type: ErrorTypes }> = {
      'P2002': {
        message: 'Cette valeur existe déjà',
        statusCode: 409,
        type: ErrorTypes.DUPLICATE_ERROR
      },
      'P2025': {
        message: 'Enregistrement introuvable',
        statusCode: 404,
        type: ErrorTypes.NOT_FOUND_ERROR
      },
      'P2003': {
        message: 'Contrainte de clé étrangère violée',
        statusCode: 400,
        type: ErrorTypes.VALIDATION_ERROR
      },
      'P2014': {
        message: 'Relation requise manquante',
        statusCode: 400,
        type: ErrorTypes.VALIDATION_ERROR
      }
    };
    
    const mapped = prismaErrors[error.code];
    if (mapped) {
      return new AppError(
        mapped.message,
        mapped.statusCode,
        mapped.type,
        true,
        { 
          prismaCode: error.code,
          target: error.meta?.target,
          field_name: error.meta?.field_name
        }
      );
    }
    
    return new AppError(
      'Erreur de base de données',
      500,
      ErrorTypes.DATABASE_ERROR,
      true,
      { prismaCode: error.code }
    );
  }
  
  // Erreurs MongoDB
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if (error.code === 11000) {
      return new DuplicateError('Valeur', { mongoError: error.keyValue });
    }
    
    return new AppError(
      'Erreur de base de données',
      500,
      ErrorTypes.DATABASE_ERROR,
      true,
      { mongoCode: error.code }
    );
  }
  
  // Erreurs réseau/API externes
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new AppError(
      'Service externe indisponible',
      503,
      ErrorTypes.EXTERNAL_API_ERROR,
      true,
      { networkError: error.code }
    );
  }
  
  // Erreur par défaut
  return new AppError(
    error.message || 'Erreur interne du serveur',
    error.statusCode || 500,
    ErrorTypes.INTERNAL_SERVER_ERROR,
    false,
    { originalError: error.name }
  );
};

// ==============================================
// FORMATAGE RÉPONSES D'ERREUR
// ==============================================

/**
 * Formate la réponse d'erreur selon l'environnement
 */
const formatErrorResponse = (error: AppError, req: Request) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Réponse de base
  const response: any = {
    error: true,
    errorId: error.errorId,
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };
  
  // Informations contextuelles en développement
  if (isDevelopment) {
    response.stack = error.stack;
    response.context = error.context;
    response.requestBody = req.body;
    response.requestQuery = req.query;
    response.userAgent = req.get('User-Agent');
    response.ip = req.ip;
  }
  
  // Contexte filtré en production (données sensibles masquées)
  if (isProduction && error.context) {
    response.context = Object.keys(error.context).reduce((acc, key) => {
      // Masquer données sensibles
      if (['password', 'token', 'secret', 'key'].some(sensitive => 
          key.toLowerCase().includes(sensitive))) {
        acc[key] = '[MASKED]';
      } else {
        acc[key] = error.context![key];
      }
      return acc;
    }, {} as Record<string, any>);
  }
  
  // Suggestions de correction pour erreurs communes
  const suggestions = getSuggestions(error.type, error.message);
  if (suggestions.length > 0) {
    response.suggestions = suggestions;
  }
  
  // Liens utiles
  response.documentation = 'https://docs.petites-annonces-ci.com';
  response.support = 'support@petites-annonces-ci.com';
  
  return response;
};

/**
 * Génère des suggestions de correction
 */
const getSuggestions = (type: ErrorTypes, message: string): string[] => {
  const suggestions: string[] = [];
  
  switch (type) {
    case ErrorTypes.VALIDATION_ERROR:
      suggestions.push(
        'Vérifiez le format des données envoyées',
        'Consultez la documentation de l\'API',
        'Utilisez les exemples de requêtes fournis'
      );
      break;
      
    case ErrorTypes.AUTHENTICATION_ERROR:
      suggestions.push(
        'Vérifiez que votre token JWT est valide',
        'Reconnectez-vous pour obtenir un nouveau token',
        'Vérifiez l\'en-tête Authorization: Bearer <token>'
      );
      break;
      
    case ErrorTypes.RATE_LIMIT_ERROR:
      suggestions.push(
        'Attendez quelques minutes avant de réessayer',
        'Réduisez la fréquence de vos requêtes',
        'Contactez-nous pour augmenter vos limites'
      );
      break;
      
    case ErrorTypes.UPLOAD_ERROR:
      suggestions.push(
        'Vérifiez la taille de vos fichiers (max 10MB)',
        'Utilisez les formats: JPEG, PNG, WebP, AVIF',
        'Limitez-vous à 8 images maximum par annonce'
      );
      break;
      
    case ErrorTypes.PAYMENT_ERROR:
      suggestions.push(
        'Vérifiez votre solde Orange Money/Wave/Moov',
        'Contactez votre opérateur mobile',
        'Réessayez avec une autre méthode de paiement'
      );
      break;
  }
  
  return suggestions;
};

// ==============================================
// MIDDLEWARE PRINCIPAL DE GESTION D'ERREURS
// ==============================================

/**
 * Middleware principal de gestion d'erreurs
 * DOIT être placé en dernier dans la chaîne de middlewares
 */
export const errorHandler: ErrorRequestHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Convertir l'erreur en AppError si nécessaire
  const appError = error instanceof AppError ? error : mapExternalError(error);
  
  // Générer le contexte de la requête pour les logs
  const requestContext = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    errorId: appError.errorId,
    timestamp: new Date().toISOString()
  };
  
  // Logger l'erreur selon son niveau de gravité
  if (appError.statusCode >= 500) {
    // Erreurs serveur - logs d'erreur complets
    logger.error('🚨 Erreur serveur critique', {
      error: {
        message: appError.message,
        type: appError.type,
        statusCode: appError.statusCode,
        stack: appError.stack,
        context: appError.context
      },
      request: requestContext
    });
  } else if (appError.statusCode >= 400) {
    // Erreurs client - logs d'avertissement
    logger.warn('⚠️ Erreur client', {
      error: {
        message: appError.message,
        type: appError.type,
        statusCode: appError.statusCode
      },
      request: requestContext
    });
  }
  
  // Formater et envoyer la réponse d'erreur
  const response = formatErrorResponse(appError, req);
  
  // Headers de sécurité
  res.set({
    'X-Error-ID': appError.errorId,
    'X-RateLimit-Remaining': res.get('X-RateLimit-Remaining') || '0'
  });
  
  // Envoyer la réponse
  res.status(appError.statusCode).json(response);
  
  // Monitoring en production (ex: Sentry, DataDog)
  if (process.env.NODE_ENV === 'production' && !appError.isOperational) {
    // TODO: Intégrer Sentry ou autre service de monitoring
    console.error('🚨 ERREUR NON OPÉRATIONNELLE:', {
      errorId: appError.errorId,
      message: appError.message,
      stack: appError.stack
    });
  }
};

// ==============================================
// MIDDLEWARE 404 - ROUTE NON TROUVÉE
// ==============================================

/**
 * Middleware pour gérer les routes non trouvées
 * DOIT être placé avant errorHandler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`, {
    availableRoutes: [
      'GET /api',
      'GET /api/annonces',
      'POST /api/annonces',
      'GET /api/annonces/:id',
      'POST /api/auth/login',
      'POST /api/auth/register'
    ]
  });
  
  next(error);
};

// ==============================================
// MIDDLEWARE ASYNC ERROR WRAPPER
// ==============================================

/**
 * Wrapper pour gérer automatiquement les erreurs des fonctions async
 * Évite les try/catch répétitifs dans les contrôleurs
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ==============================================
// UTILITAIRES POUR HEALTH CHECK
// ==============================================

/**
 * Middleware pour health check avec détection d'erreurs système
 */
export const healthCheck = (req: Request, res: Response) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    }
  };
  
  res.json(health);
};

// ==============================================
// EXPORTS PRINCIPAUX
// ==============================================

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  healthCheck,
  
  // Classes d'erreur
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DuplicateError,
  RateLimitError,
  PaymentError,
  
  // Enums
  ErrorTypes,
  
  // Logger pour utilisation externe
  logger
};