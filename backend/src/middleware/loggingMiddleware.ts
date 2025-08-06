// backend/src/middleware/loggingMiddleware.ts
// MIDDLEWARE LOGGING RÉVOLUTIONNAIRE - MONITORING NIVEAU NASA
// Analytics temps réel, performance tracking et sécurité avancée

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

// ==============================================
// CONFIGURATION LOGGER SPÉCIALISÉ
// ==============================================

const requestLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0 ? 
        ` | ${JSON.stringify(meta, null, 2)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  defaultMeta: {
    service: 'petites-annonces-ci-requests',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console colorée pour développement
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} ${level}: ${message}`;
        })
      )
    }),
    
    // Fichier séparé pour les requêtes
    new winston.transports.File({ 
      filename: 'logs/requests.log',
      maxsize: 10485760, // 10MB
      maxFiles: 20
    }),
    
    // Fichier pour les requêtes lentes uniquement
    new winston.transports.File({ 
      filename: 'logs/slow-requests.log',
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 10
    }),
    
    // Fichier pour les activités suspectes
    new winston.transports.File({ 
      filename: 'logs/security.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 15
    })
  ]
});

// ==============================================
// INTERFACES ET TYPES
// ==============================================

interface RequestMetrics {
  requestId: string;
  method: string;
  url: string;
  userAgent: string;
  ip: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  contentLength?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  errors?: string[];
}

interface SecurityEvent {
  type: 'SUSPICIOUS_REQUEST' | 'RATE_LIMIT_HIT' | 'AUTH_FAILURE' | 'MALICIOUS_PAYLOAD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  ip: string;
  userAgent: string;
  requestId: string;
  timestamp: string;
  context?: Record<string, any>;
}

// ==============================================
// DÉTECTION ACTIVITÉS SUSPECTES
// ==============================================

/**
 * Détecte les patterns suspects dans les requêtes
 */
const detectSuspiciousActivity = (req: Request): SecurityEvent | null => {
  const { method, url, body, headers, ip } = req;
  const userAgent = headers['user-agent'] || '';
  const requestId = (req as any).requestId;
  
  // Détection attaques SQL injection
  const sqlPatterns = [
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(\bSELECT\b.*\bFROM\b.*\bWHERE\b)/gi,
    /(\bDROP\b.*\bTABLE\b)/gi,
    /(\bINSERT\b.*\bINTO\b)/gi,
    /(\bDELETE\b.*\bFROM\b)/gi,
    /(\'.*\b(OR|AND)\b.*\')/gi
  ];
  
  const bodyString = JSON.stringify(body || {});
  const urlString = url.toLowerCase();
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(bodyString) || pattern.test(urlString)) {
      return {
        type: 'MALICIOUS_PAYLOAD',
        severity: 'HIGH',
        description: 'Tentative d\'injection SQL détectée',
        ip,
        userAgent,
        requestId,
        timestamp: new Date().toISOString(),
        context: { pattern: pattern.source, method, url }
      };
    }
  }
  
  // Détection attaques XSS
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(bodyString) || pattern.test(urlString)) {
      return {
        type: 'MALICIOUS_PAYLOAD',
        severity: 'HIGH',
        description: 'Tentative d\'attaque XSS détectée',
        ip,
        userAgent,
        requestId,
        timestamp: new Date().toISOString(),
        context: { pattern: pattern.source, method, url }
      };
    }
  }
  
  // Détection bots malveillants
  const maliciousBots = [
    /scrapy/i,
    /crawler/i,
    /bot/i,
    /spider/i,
    /harvest/i,
    /extract/i,
    /libwww-perl/i,
    /python-requests/i,
    /curl/i,
    /wget/i
  ];
  
  // Exception pour les bots légitimes
  const legitimateBots = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i
  ];
  
  const isMalicious = maliciousBots.some(pattern => pattern.test(userAgent));
  const isLegitimate = legitimateBots.some(pattern => pattern.test(userAgent));
  
  if (isMalicious && !isLegitimate) {
    return {
      type: 'SUSPICIOUS_REQUEST',
      severity: 'MEDIUM',
      description: 'Bot suspect détecté',
      ip,
      userAgent,
      requestId,
      timestamp: new Date().toISOString(),
      context: { method, url }
    };
  }
  
  // Détection requêtes anormalement grandes
  const contentLength = parseInt(headers['content-length'] || '0');
  if (contentLength > 50 * 1024 * 1024) { // 50MB
    return {
      type: 'SUSPICIOUS_REQUEST',
      severity: 'MEDIUM',
      description: 'Requête anormalement volumineuse',
      ip,
      userAgent,
      requestId,
      timestamp: new Date().toISOString(),
      context: { contentLength, method, url }
    };
  }
  
  return null;
};

// ==============================================
// CACHE PERFORMANCE ANALYTICS
// ==============================================

class RequestAnalytics {
  private static instance: RequestAnalytics;
  private metrics: Map<string, RequestMetrics[]> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private readonly MAX_METRICS_PER_ROUTE = 100;
  private readonly MAX_SECURITY_EVENTS = 1000;
  
  static getInstance(): RequestAnalytics {
    if (!RequestAnalytics.instance) {
      RequestAnalytics.instance = new RequestAnalytics();
    }
    return RequestAnalytics.instance;
  }
  
  addMetric(route: string, metric: RequestMetrics): void {
    if (!this.metrics.has(route)) {
      this.metrics.set(route, []);
    }
    
    const routeMetrics = this.metrics.get(route)!;
    routeMetrics.push(metric);
    
    // Garder seulement les N dernières métriques
    if (routeMetrics.length > this.MAX_METRICS_PER_ROUTE) {
      routeMetrics.shift();
    }
  }
  
  addSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);
    
    // Garder seulement les N derniers événements
    if (this.securityEvents.length > this.MAX_SECURITY_EVENTS) {
      this.securityEvents.shift();
    }
  }
  
  getRouteStats(route: string): any {
    const metrics = this.metrics.get(route) || [];
    if (metrics.length === 0) return null;
    
    const durations = metrics.map(m => m.duration || 0);
    const statusCodes = metrics.map(m => m.statusCode || 0);
    
    return {
      totalRequests: metrics.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      statusCodeDistribution: statusCodes.reduce((acc, code) => {
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {} as Record<number, number>),
      lastUpdated: new Date().toISOString()
    };
  }
  
  getGlobalStats(): any {
    const allMetrics = Array.from(this.metrics.values()).flat();
    const recentEvents = this.securityEvents.slice(-50);
    
    return {
      totalRequests: allMetrics.length,
      totalRoutes: this.metrics.size,
      securityEvents: {
        total: this.securityEvents.length,
        recent: recentEvents.length,
        byType: recentEvents.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        bySeverity: recentEvents.reduce((acc, event) => {
          acc[event.severity] = (acc[event.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      performance: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    };
  }
  
  clearOldData(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // Nettoyer les anciennes métriques
    for (const [route, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.startTime > oneDayAgo);
      if (filtered.length === 0) {
        this.metrics.delete(route);
      } else {
        this.metrics.set(route, filtered);
      }
    }
    
    // Nettoyer les anciens événements de sécurité
    this.securityEvents = this.securityEvents.filter(
      event => new Date(event.timestamp).getTime() > oneDayAgo
    );
  }
}

const analytics = RequestAnalytics.getInstance();

// Nettoyage automatique toutes les heures
setInterval(() => {
  analytics.clearOldData();
}, 60 * 60 * 1000);

// ==============================================
// MIDDLEWARE PRINCIPAL DE LOGGING
// ==============================================

/**
 * Middleware de logging complet avec analytics et sécurité
 */
export const requestLogging = (options: {
  skipRoutes?: string[];
  logBody?: boolean;
  logResponse?: boolean;
  slowRequestThreshold?: number;
} = {}) => {
  const {
    skipRoutes = ['/health', '/metrics', '/favicon.ico'],
    logBody = false,
    logResponse = false,
    slowRequestThreshold = 1000 // 1 seconde
  } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip si route exclue
    if (skipRoutes.some(route => req.path.includes(route))) {
      return next();
    }
    
    // Générer ID unique pour la requête
    const requestId = uuidv4();
    (req as any).requestId = requestId;
    
    // Capturer le début de la requête
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    // Extraire infos de la requête
    const {
      method,
      url,
      headers,
      body,
      query,
      params,
      ip
    } = req;
    
    const userAgent = headers['user-agent'] || 'Unknown';
    const contentType = headers['content-type'] || '';
    const contentLength = parseInt(headers['content-length'] || '0');
    const userId = (req as any).user?.id;
    
    // Créer hash de l'IP pour anonymisation
    const ipHash = createHash('sha256').update(ip).digest('hex').substring(0, 8);
    
    // Détection activité suspecte
    const securityEvent = detectSuspiciousActivity(req);
    if (securityEvent) {
      analytics.addSecurityEvent(securityEvent);
      requestLogger.error('🚨 Activité suspecte détectée', securityEvent);
    }
    
    // Log de la requête entrante
    const requestInfo = {
      requestId,
      method,
      url,
      userAgent,
      ip: process.env.NODE_ENV === 'development' ? ip : ipHash,
      userId,
      contentType,
      contentLength,
      query: Object.keys(query).length > 0 ? query : undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
      body: logBody ? body : undefined,
      timestamp: new Date().toISOString()
    };
    
    requestLogger.info('📥 Requête entrante', requestInfo);
    
    // Capturer la réponse
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;
    
    // Override res.send
    res.send = function(body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };
    
    // Override res.json
    res.json = function(body: any) {
      responseBody = body;
      return originalJson.call(this, body);
    };
    
    // Capturer la fin de la requête
    res.on('finish', () => {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      const endMemory = process.memoryUsage();
      
      // Métriques de performance
      const metrics: RequestMetrics = {
        requestId,
        method,
        url,
        userAgent,
        ip: process.env.NODE_ENV === 'development' ? ip : ipHash,
        userId,
        startTime,
        endTime,
        duration,
        statusCode: res.statusCode,
        contentLength: parseInt(res.get('content-length') || '0'),
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
        }
      };
      
      // Ajouter aux analytics
      analytics.addMetric(`${method} ${url}`, metrics);
      
      // Log de la réponse
      const responseInfo = {
        requestId,
        method,
        url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('content-length') || '0',
        responseBody: logResponse ? responseBody : undefined,
        memoryDelta: `${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100}MB`,
        userId,
        timestamp: new Date().toISOString()
      };
      
      // Logger selon le type de réponse
      if (res.statusCode >= 500) {
        requestLogger.error('❌ Réponse erreur serveur', responseInfo);
      } else if (res.statusCode >= 400) {
        requestLogger.warn('⚠️ Réponse erreur client', responseInfo);
      } else if (duration > slowRequestThreshold) {
        requestLogger.warn('🐌 Requête lente détectée', {
          ...responseInfo,
          threshold: `${slowRequestThreshold}ms`,
          performance: 'SLOW'
        });
      } else {
        requestLogger.info('📤 Réponse envoyée', responseInfo);
      }
      
      // Log spécial pour activités importantes
      if (method === 'POST' && url.includes('/annonces')) {
        requestLogger.info('📢 Nouvelle annonce créée', {
          requestId,
          userId,
          duration: `${duration}ms`,
          ip: process.env.NODE_ENV === 'development' ? ip : ipHash
        });
      }
      
      if (method === 'POST' && url.includes('/auth')) {
        requestLogger.info('🔐 Tentative d\'authentification', {
          requestId,
          success: res.statusCode < 400,
          duration: `${duration}ms`,
          ip: process.env.NODE_ENV === 'development' ? ip : ipHash
        });
      }
    });
    
    // Capturer les erreurs
    res.on('error', (error) => {
      requestLogger.error('💥 Erreur de réponse', {
        requestId,
        method,
        url,
        error: error.message,
        stack: error.stack,
        userId
      });
    });
    
    next();
  };
};

// ==============================================
// MIDDLEWARE ANALYTICS API
// ==============================================

/**
 * Route pour consulter les métriques en temps réel
 */
export const metricsEndpoint = (req: Request, res: Response) => {
  const { route } = req.query;
  
  if (route && typeof route === 'string') {
    const routeStats = analytics.getRouteStats(route);
    if (!routeStats) {
      return res.status(404).json({
        error: 'Route non trouvée dans les métriques',
        availableRoutes: Array.from((analytics as any).metrics.keys())
      });
    }
    return res.json(routeStats);
  }
  
  const globalStats = analytics.getGlobalStats();
  res.json({
    message: '📊 Métriques Petites Annonces CI',
    ...globalStats
  });
};

// ==============================================
// MIDDLEWARE DEBUGGING DÉVELOPPEMENT
// ==============================================

/**
 * Middleware de debug pour développement uniquement
 */
export const debugLogging = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }
  
  console.log(`\n🚀 [DEBUG] ${req.method} ${req.url}`);
  console.log(`📍 IP: ${req.ip}`);
  console.log(`🌐 User-Agent: ${req.get('User-Agent')}`);
  console.log(`👤 User: ${(req as any).user?.id || 'Anonymous'}`);
  
  if (Object.keys(req.query).length > 0) {
    console.log(`❓ Query:`, req.query);
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, req.body);
  }
  
  console.log(`⏰ Time: ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' })}`);
  console.log('─'.repeat(60));
  
  next();
};

// ==============================================
// EXPORTS ET UTILITAIRES
// ==============================================

export default {
  requestLogging,
  metricsEndpoint,
  debugLogging,
  analytics: RequestAnalytics.getInstance()
};