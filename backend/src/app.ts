// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import path from 'path';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';
import { requestLogging, metricsEndpoint, debugLogging } from './middleware/loggingMiddleware';


// Configuration des variables d'environnement
config();

// Types
interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
}

// Configuration de l'application
const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};

// Création de l'application Express
const app = express();

// ==============================================
// MIDDLEWARE DE SÉCURITÉ
// ==============================================

// Helmet pour la sécurité HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://images.unsplash.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS Configuration avancée
app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (appConfig.corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: appConfig.rateLimitWindow, // 15 minutes par défaut
  max: appConfig.rateLimitMax, // Limite de requêtes par IP
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    retryAfter: Math.ceil(appConfig.rateLimitWindow / 60000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
      retryAfter: Math.ceil(appConfig.rateLimitWindow / 60000)
    });
  }
});

// Appliquer le rate limiting à toutes les routes API
app.use('/api/', limiter);

// ==============================================
// MIDDLEWARE DE PARSING
// ==============================================

// Body parser pour JSON (limite de 10MB pour les images)
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Vérification de la taille des requêtes
    if (buf.length > 10 * 1024 * 1024) { // 10MB
      throw new Error('Payload trop volumineux');
    }
  }
}));

// URL encoded
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// ==============================================
// MIDDLEWARE DE LOGGING
// ==============================================

// Logger personnalisé pour le développement
if (appConfig.nodeEnv === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
    
    // Logger la réponse
    const originalSend = res.send;
    res.send = function(data) {
      console.log(`[${timestamp}] Response: ${res.statusCode} - ${method} ${url}`);
      return originalSend.call(this, data);
    };
    
    next();
  });
}

// ==============================================
// HEALTH CHECK
// ==============================================

app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();
  
  res.status(200).json({
    status: 'OK',
    message: 'Serveur Petites Annonces CI en ligne',
    timestamp,
    uptime: Math.floor(uptime),
    environment: appConfig.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

app.use(debugLogging);           // Debug dev uniquement
app.use(requestLogging({         // Logging principal
  logBody: false,                // Corps requête (false prod)
  slowRequestThreshold: 1000     // Seuil requête lente 1s
}));


// ==============================================
// API ROUTES (À IMPLÉMENTER)
// ==============================================

// Route de base API
app.get('/api', (req, res) => {
  res.json({
    message: '🚀 API Petites Annonces CI - Version révolutionnaire',
    version: '1.0.0',
    documentation: '/api/docs',
    status: 'active',
    features: [
      '🔐 Authentification sécurisée',
      '📱 Support mobile optimisé',
      '💰 Paiements mobiles CI',
      '🌍 Géolocalisation avancée',
      '⚡ Performance maximale',
      '🎨 Interface moderne'
    ],
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      annonces: '/api/annonces',
      categories: '/api/categories',
      messages: '/api/messages',
      payments: '/api/payments'
    }
  });
});

// Routes d'authentification (placeholder)
app.post('/api/auth/register', (req, res) => {
  res.json({ message: 'Route d\'inscription - À implémenter' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ message: 'Route de connexion - À implémenter' });
});

// Routes des annonces (placeholder)
app.get('/api/annonces', (req, res) => {
  res.json({ 
    message: 'Liste des annonces - À implémenter',
    count: 0,
    data: []
  });
});

app.post('/api/annonces', (req, res) => {
  res.json({ message: 'Création d\'annonce - À implémenter' });
});

app.get('/metrics', metricsEndpoint);

// ==============================================
// GESTION DES FICHIERS STATIQUES
// ==============================================

// Servir les fichiers uploadés (temporaire, sera remplacé par Cloudinary)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==============================================
// GESTION DES ERREURS
// ==============================================

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.method} ${req.originalUrl} n'existe pas`,
    availableRoutes: {
      'GET /health': 'Vérification de l\'état du serveur',
      'GET /api': 'Informations de l\'API',
      'POST /api/auth/register': 'Inscription utilisateur',
      'POST /api/auth/login': 'Connexion utilisateur',
      'GET /api/annonces': 'Liste des annonces',
      'POST /api/annonces': 'Création d\'annonce'
    }
  });
});

// Gestionnaire d'erreurs global
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erreur serveur:', error);

  // Erreur de validation JSON
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      error: 'Format JSON invalide',
      message: 'Vérifiez la syntaxe de votre requête JSON'
    });
  }

  // Erreur de taille de payload
  if (error.message === 'Payload trop volumineux') {
    return res.status(413).json({
      error: 'Fichier trop volumineux',
      message: 'La taille maximale autorisée est de 10MB'
    });
  }

  // Erreur générique
  const statusCode = appConfig.nodeEnv === 'production' ? 500 : 500;
  const errorMessage = appConfig.nodeEnv === 'production' 
    ? 'Erreur interne du serveur' 
    : error.message;

  res.status(statusCode).json({
    error: errorMessage,
    ...(appConfig.nodeEnv === 'development' && {
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
  });
});

// ==============================================
// DÉMARRAGE DU SERVEUR
// ==============================================

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
  console.log('🛑 Signal SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Signal SIGINT reçu, arrêt du serveur...');
  process.exit(0);
});


app.use(notFoundHandler);    // Gère les routes 404
app.use(errorHandler);       // Gère toutes les autres erreurs

// Démarrage du serveur
const server = app.listen(appConfig.port, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('🇨🇮   PETITES ANNONCES CI - SERVEUR DÉMARRÉ');
  console.log('🚀 ========================================');
  console.log('');
  console.log(`📍 Serveur : http://localhost:${appConfig.port}`);
  console.log(`🔧 Environnement : ${appConfig.nodeEnv}`);
  console.log(`⚡ API : http://localhost:${appConfig.port}/api`);
  console.log(`💚 Santé : http://localhost:${appConfig.port}/health`);
  console.log('');
  console.log('🎯 Fonctionnalités disponibles :');
  console.log('   • 🔐 Sécurité avancée (Helmet + CORS)');
  console.log('   • ⚡ Rate limiting intelligent');
  console.log('   • 📊 Monitoring en temps réel');
  console.log('   • 🚨 Gestion d\'erreurs complète');
  console.log('');
  console.log('🌍 Prêt pour la révolution des petites annonces !');
  console.log('');
});

// Gestion des erreurs de démarrage
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      console.error(`❌ Le port ${appConfig.port} nécessite des privilèges élevés`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ Le port ${appConfig.port} est déjà utilisé`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

export default app;