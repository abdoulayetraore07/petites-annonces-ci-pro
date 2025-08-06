// backend/src/services/annonceService.ts
// SERVICE ANNONCES RÉVOLUTIONNAIRE AVEC IA ET GÉOLOCALISATION

import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';
import type { 
  Annonce, 
  SearchFilters, 
  SearchResult, 
  StatutAnnonce, 
  EtatProduit,
  CreateInput,
  UpdateInput 
} from '../../../shared/src/types';
import { CATEGORIES_CI, REGIONS_COTE_IVOIRE } from '../../../shared/src/types';

const prisma = new PrismaClient();

// ==============================================
// INTERFACES ET TYPES
// ==============================================

interface CreateAnnonceData {
  titre: string;
  description: string;
  prix: number;
  negociable?: boolean;
  categorie: string;
  sousCategorie?: string;
  region: string;
  commune: string;
  quartier?: string;
  telephone?: string;
  whatsapp?: string;
  images: string[];
  videos?: string[];
  etat?: EtatProduit;
  proprietes?: Record<string, any>;
  tags?: string[];
  userId: string;
}

interface UpdateAnnonceData extends Partial<CreateAnnonceData> {
  statut?: StatutAnnonce;
  premium?: boolean;
  promue?: boolean;
  urgente?: boolean;
}

interface SearchOptions {
  filters: SearchFilters;
  page: number;
  limit: number;
  sortBy: 'recent' | 'prix_asc' | 'prix_desc' | 'pertinence' | 'distance';
  userLocation?: { latitude: number; longitude: number };
}

interface AnnonceStats {
  totalVues: number;
  vuesAujourdhui: number;
  totalFavoris: number;
  totalMessages: number;
  tauxConversion: number;
  positionMoyenne: number;
}

// ==============================================
// CLASSE ANNONCESERVICE
// ==============================================

export class AnnonceService {

  // ==============================================
  // CRÉATION D'ANNONCE INTELLIGENTE
  // ==============================================

  static async createAnnonce(data: CreateAnnonceData): Promise<Annonce> {
    try {
      // Validation des données
      await this.validateAnnonceData(data);

      // Générer un slug unique
      const slug = await this.generateUniqueSlug(data.titre);

      // Extraction automatique des mots-clés avec IA
      const motsCles = await this.extractKeywords(data.titre, data.description);

      // Estimation de prix automatique basée sur l'IA
      const prixEstime = await this.estimatePrice(data);

      // Géolocalisation automatique
      const coordinates = await this.geocodeLocation(data.region, data.commune, data.quartier);

      // Détection automatique des propriétés importantes
      const proprietesAutomatic = await this.extractProperties(
        data.description, 
        data.categorie, 
        data.sousCategorie
      );

      // Normalisation du téléphone
      const telephoneNormalise = data.telephone ? this.normalizePhoneCI(data.telephone) : null;
      const whatsappNormalise = data.whatsapp ? this.normalizePhoneCI(data.whatsapp) : null;

      // Création de l'annonce avec toutes les améliorations IA
      const annonce = await prisma.annonce.create({
        data: {
          titre: data.titre.trim(),
          description: data.description.trim(),
          prix: data.prix,
          devise: 'XOF',
          negociable: data.negociable || false,
          
          // Catégorisation
          categorie: data.categorie,
          sousCategorie: data.sousCategorie,
          
          // Géolocalisation
          region: data.region,
          commune: data.commune,
          quartier: data.quartier,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          adresseComplete: this.formatAddress(data.region, data.commune, data.quartier),
          
          // Contact
          telephone: telephoneNormalise,
          whatsapp: whatsappNormalise,
          
          // Médias
          images: JSON.stringify(data.images),
          videos: JSON.stringify(data.videos || []),
          
          // Métadonnées
          slug,
          tags: data.tags || [],
          motsCles,
          etat: data.etat,
          proprietes: JSON.stringify({
            ...data.proprietes,
            ...proprietesAutomatic,
            prixEstimeIA: prixEstime,
            scoreQualite: await this.calculateQualityScore(data)
          }),
          
          // Statut
          statut: StatutAnnonce.ACTIVE,
          datePublication: new Date(),
          dateExpiration: this.calculateExpirationDate(data.userId),
          
          // Relations
          userId: data.userId
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              isProfessional: true,
              companyName: true,
              region: true,
              commune: true,
              emailVerified: true,
              phoneVerified: true,
              createdAt: true
            }
          }
        }
      });

      // Mise à jour des statistiques utilisateur
      await this.updateUserStats(data.userId, 'ANNONCE_CREATED');

      // Indexation pour la recherche (ElasticSearch/Algolia plus tard)
      await this.indexAnnonceForSearch(annonce.id);

      // Notifications aux utilisateurs intéressés
      this.notifyInterestedUsers(annonce).catch(console.error);

      // Log de création
      await this.logActivity('ANNONCE_CREATED', annonce.id, data.userId, {
        categorie: data.categorie,
        prix: data.prix,
        region: data.region
      });

      return this.formatAnnonceForAPI(annonce);

    } catch (error) {
      console.error('Erreur création annonce:', error);
      throw error instanceof Error ? error : new Error('Erreur lors de la création de l\'annonce');
    }
  }

  // ==============================================
  // RECHERCHE AVANCÉE AVEC IA
  // ==============================================

  static async searchAnnonces(options: SearchOptions): Promise<SearchResult> {
    try {
      const { filters, page, limit, sortBy, userLocation } = options;

      // Construction de la requête Prisma complexe
      const whereClause = this.buildWhereClause(filters);
      const orderByClause = this.buildOrderByClause(sortBy, userLocation);

      // Requête principale avec pagination
      const [annonces, total] = await Promise.all([
        prisma.annonce.findMany({
          where: whereClause,
          orderBy: orderByClause,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                isProfessional: true,
                companyName: true,
                region: true,
                commune: true,
                emailVerified: true,
                phoneVerified: true,
                createdAt: true
              }
            },
            _count: {
              select: {
                favoris: true,
                messages: true,
                vues: true
              }
            }
          }
        }),
        prisma.annonce.count({ where: whereClause })
      ]);

      // Calcul des facettes pour filtres avancés
      const facettes = await this.calculateFacets(whereClause);

      // Ajout de données enrichies (distance, recommandations, etc.)
      const annoncesEnrichies = await Promise.all(
        annonces.map(async (annonce) => {
          const enrichedAnnonce = this.formatAnnonceForAPI(annonce);
          
          // Calcul de distance si position utilisateur fournie
          if (userLocation && annonce.latitude && annonce.longitude) {
            enrichedAnnonce.distance = this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              annonce.latitude,
              annonce.longitude
            );
          }

          return enrichedAnnonce;
        })
      );

      const totalPages = Math.ceil(total / limit);

      return {
        annonces: annoncesEnrichies,
        total,
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        facettes
      };

    } catch (error) {
      console.error('Erreur recherche annonces:', error);
      throw new Error('Erreur lors de la recherche');
    }
  }

  // ==============================================
  // RÉCUPÉRATION ANNONCE AVEC ANALYTICS
  // ==============================================

  static async getAnnonceById(id: string, userId?: string): Promise<Annonce | null> {
    try {
      const annonce = await prisma.annonce.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              isProfessional: true,
              companyName: true,
              region: true,
              commune: true,
              emailVerified: true,
              phoneVerified: true,
              createdAt: true
            }
          },
          favoris: userId ? {
            where: { userId }
          } : false,
          _count: {
            select: {
              favoris: true,
              messages: true,
              vues: true
            }
          }
        }
      });

      if (!annonce || annonce.statut === StatutAnnonce.SUPPRIMEE) {
        return null;
      }

      // Incrémenter le compteur de vues (async)
      this.incrementViewCount(id, userId).catch(console.error);

      // Recommandations similaires (async)
      const recommandations = this.getSimilarAnnonces(id, 5).catch(() => []);

      const formattedAnnonce = this.formatAnnonceForAPI(annonce);
      
      // Ajouter des métadonnées spéciales pour le propriétaire
      if (userId === annonce.userId) {
        formattedAnnonce.stats = await this.getAnnonceStats(id);
        formattedAnnonce.recommandations = await recommandations;
      }

      return formattedAnnonce;

    } catch (error) {
      console.error('Erreur récupération annonce:', error);
      throw new Error('Erreur lors de la récupération de l\'annonce');
    }
  }

  // ==============================================
  // GESTION DES FAVORIS
  // ==============================================

  static async toggleFavorite(annonceId: string, userId: string): Promise<{ isFavorite: boolean }> {
    try {
      const existingFavorite = await prisma.favori.findUnique({
        where: {
          userId_annonceId: {
            userId,
            annonceId
          }
        }
      });

      if (existingFavorite) {
        // Supprimer des favoris
        await prisma.favori.delete({
          where: { id: existingFavorite.id }
        });

        // Décrémenter le compteur
        await prisma.annonce.update({
          where: { id: annonceId },
          data: { favorisCount: { decrement: 1 } }
        });

        await this.logActivity('FAVORITE_REMOVED', annonceId, userId);
        return { isFavorite: false };

      } else {
        // Ajouter aux favoris
        await prisma.favori.create({
          data: {
            userId,
            annonceId
          }
        });

        // Incrémenter le compteur
        await prisma.annonce.update({
          where: { id: annonceId },
          data: { favorisCount: { increment: 1 } }
        });

        await this.logActivity('FAVORITE_ADDED', annonceId, userId);
        return { isFavorite: true };
      }

    } catch (error) {
      console.error('Erreur toggle favori:', error);
      throw new Error('Erreur lors de la gestion des favoris');
    }
  }

  // ==============================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ==============================================

  private static async validateAnnonceData(data: CreateAnnonceData): Promise<void> {
    // Validation titre
    if (data.titre.length < 5 || data.titre.length > 200) {
      throw new Error('Le titre doit contenir entre 5 et 200 caractères');
    }

    // Validation description
    if (data.description.length < 10 || data.description.length > 5000) {
      throw new Error('La description doit contenir entre 10 et 5000 caractères');
    }

    // Validation prix
    if (data.prix <= 0) {
      throw new Error('Le prix doit être positif');
    }

    // Validation catégorie
    if (!CATEGORIES_CI[data.categorie as keyof typeof CATEGORIES_CI]) {
      throw new Error('Catégorie invalide');
    }

    // Validation région
    if (!REGIONS_COTE_IVOIRE[data.region as keyof typeof REGIONS_COTE_IVOIRE]) {
      throw new Error('Région invalide');
    }

    // Validation téléphone si fourni
    if (data.telephone && !this.isValidPhoneCI(data.telephone)) {
      throw new Error('Numéro de téléphone ivoirien invalide');
    }

    // Validation images
    if (!data.images || data.images.length === 0) {
      throw new Error('Au moins une image est requise');
    }

    if (data.images.length > 10) {
      throw new Error('Maximum 10 images autorisées');
    }
  }

  private static async generateUniqueSlug(titre: string, excludeId?: string): Promise<string> {
    const baseSlug = slugify(titre, {
      lower: true,
      remove: /[*+~.()'"!:@]/g
    });

    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private static async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const count = await prisma.annonce.count({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
        statut: { not: StatutAnnonce.SUPPRIMEE }
      }
    });
    return count > 0;
  }

  private static async extractKeywords(titre: string, description: string): Promise<string> {
    // IA simple d'extraction de mots-clés
    const text = `${titre} ${description}`.toLowerCase();
    const stopWords = ['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'avec', 'pour', 'sur', 'dans'];
    
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 20);

    return [...new Set(words)].join(' ');
  }

  private static async estimatePrice(data: CreateAnnonceData): Promise<number | null> {
    try {
      // IA d'estimation de prix basée sur les annonces similaires
      const similarAnnonces = await prisma.annonce.findMany({
        where: {
          categorie: data.categorie,
          sousCategorie: data.sousCategorie,
          region: data.region,
          statut: StatutAnnonce.ACTIVE,
          prix: { gt: 0 }
        },
        select: { prix: true },
        take: 50,
        orderBy: { createdAt: 'desc' }
      });

      if (similarAnnonces.length === 0) return null;

      const prices = similarAnnonces.map(a => a.prix).sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      
      return median;

    } catch (error) {
      console.error('Erreur estimation prix:', error);
      return null;
    }
  }

  private static async geocodeLocation(region: string, commune: string, quartier?: string): Promise<{latitude: number; longitude: number} | null> {
    try {
      // TODO: Intégrer une API de géocodage (Google Maps, Mapbox)
      // Pour l'instant, retourner des coordonnées par défaut pour Abidjan
      if (region.toLowerCase().includes('abidjan')) {
        return {
          latitude: 5.3600,
          longitude: -4.0083
        };
      }
      return null;
    } catch (error) {
      console.error('Erreur géocodage:', error);
      return null;
    }
  }

  private static async extractProperties(description: string, categorie: string, sousCategorie?: string): Promise<Record<string, any>> {
    // IA d'extraction de propriétés depuis la description
    const properties: Record<string, any> = {};

    // Extraction de nombres (superficie, année, etc.)
    const numbers = description.match(/\d+/g);
    if (numbers) {
      properties.numbersFound = numbers.slice(0, 5);
    }

    // Extraction spécifique par catégorie
    switch (categorie) {
      case 'vehicules':
        if (description.match(/\b(automatique|manuel)\b/i)) {
          properties.transmission = description.match(/automatique/i) ? 'automatique' : 'manuel';
        }
        break;
      
      case 'immobilier':
        const rooms = description.match(/(\d+)\s*(chambre|pièce)/i);
        if (rooms) properties.nombreChambres = parseInt(rooms[1]);
        break;
    }

    return properties;
  }

  private static normalizePhoneCI(phone: string): string {
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

  private static isValidPhoneCI(phone: string): boolean {
    const phoneRegex = /^(\+225|00225|225)?[0-9]{8,10}$/;
    return phoneRegex.test(phone);
  }

  private static formatAddress(region: string, commune: string, quartier?: string): string {
    let address = `${commune}, ${region}`;
    if (quartier) address = `${quartier}, ${address}`;
    return address;
  }

  private static calculateExpirationDate(userId: string): Date {
    // TODO: Vérifier le type d'abonnement de l'utilisateur
    // Pour l'instant, 30 jours par défaut
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  private static async calculateQualityScore(data: CreateAnnonceData): Promise<number> {
    let score = 0;

    // Score basé sur la longueur du titre (max 20 points)
    score += Math.min(data.titre.length / 10, 20);

    // Score basé sur la description (max 30 points)
    score += Math.min(data.description.length / 100, 30);

    // Score pour les images (max 25 points)
    score += Math.min(data.images.length * 5, 25);

    // Score pour le téléphone (10 points)
    if (data.telephone) score += 10;

    // Score pour les propriétés (max 15 points)
    if (data.proprietes && Object.keys(data.proprietes).length > 0) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  private static buildWhereClause(filters: SearchFilters): any {
    const where: any = {
      statut: StatutAnnonce.ACTIVE,
      dateExpiration: { gt: new Date() }
    };

    if (filters.q) {
      where.OR = [
        { titre: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
        { motsCles: { contains: filters.q, mode: 'insensitive' } }
      ];
    }

    if (filters.categorie) where.categorie = filters.categorie;
    if (filters.sousCategorie) where.sousCategorie = filters.sousCategorie;
    if (filters.region) where.region = filters.region;
    if (filters.commune) where.commune = filters.commune;
    if (filters.etat) where.etat = filters.etat;

    if (filters.prixMin !== undefined || filters.prixMax !== undefined) {
      where.prix = {};
      if (filters.prixMin !== undefined) where.prix.gte = filters.prixMin;
      if (filters.prixMax !== undefined) where.prix.lte = filters.prixMax;
    }

    if (filters.utilisateurPro !== undefined) {
      where.user = { isProfessional: filters.utilisateurPro };
    }

    if (filters.avecImages) {
      where.images = { not: '[]' };
    }

    if (filters.urgentesOnly) {
      where.urgente = true;
    }

    if (filters.dateMin || filters.dateMax) {
      where.datePublication = {};
      if (filters.dateMin) where.datePublication.gte = filters.dateMin;
      if (filters.dateMax) where.datePublication.lte = filters.dateMax;
    }

    return where;
  }

  private static buildOrderByClause(sortBy: string, userLocation?: { latitude: number; longitude: number }): any {
    switch (sortBy) {
      case 'prix_asc':
        return { prix: 'asc' };
      case 'prix_desc':
        return { prix: 'desc' };
      case 'pertinence':
        return [
          { premium: 'desc' },
          { promue: 'desc' },
          { vuesCount: 'desc' },
          { datePublication: 'desc' }
        ];
      case 'distance':
        // TODO: Implémenter tri par distance avec SQL spatial
        return { datePublication: 'desc' };
      default:
        return { datePublication: 'desc' };
    }
  }

  private static async calculateFacets(whereClause: any): Promise<any> {
    // Calcul des facettes pour les filtres
    const [categories, regions, prixStats] = await Promise.all([
      prisma.annonce.groupBy({
        by: ['categorie'],
        where: whereClause,
        _count: true,
        orderBy: { _count: { categorie: 'desc' } }
      }),
      prisma.annonce.groupBy({
        by: ['region'],
        where: whereClause,
        _count: true,
        orderBy: { _count: { region: 'desc' } }
      }),
      prisma.annonce.aggregate({
        where: whereClause,
        _min: { prix: true },
        _max: { prix: true },
        _avg: { prix: true }
      })
    ]);

    return {
      categories: categories.map(c => ({ nom: c.categorie, count: c._count })),
      regions: regions.map(r => ({ nom: r.region, count: r._count })),
      prix: {
        min: prixStats._min.prix || 0,
        max: prixStats._max.prix || 0,
        moyenne: Math.round(prixStats._avg.prix || 0)
      }
    };
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private static formatAnnonceForAPI(annonce: any): Annonce {
    return {
      ...annonce,
      images: JSON.parse(annonce.images || '[]'),
      videos: JSON.parse(annonce.videos || '[]'),
      proprietes: JSON.parse(annonce.proprietes || '{}'),
      isFavorite: annonce.favoris && annonce.favoris.length > 0,
      user: annonce.user
    };
  }

  // Autres méthodes utilitaires
  private static async incrementViewCount(annonceId: string, userId?: string): Promise<void> {
    // Implémentation du comptage des vues
  }

  private static async updateUserStats(userId: string, action: string): Promise<void> {
    // Mise à jour des statistiques utilisateur
  }

  private static async indexAnnonceForSearch(annonceId: string): Promise<void> {
    // Indexation pour moteur de recherche
  }

  private static async notifyInterestedUsers(annonce: any): Promise<void> {
    // Notifications aux utilisateurs intéressés
  }

  private static async logActivity(action: string, annonceId: string, userId: string, details?: any): Promise<void> {
    try {
      await prisma.logActivite.create({
        data: {
          userId,
          action,
          entite: 'Annonce',
          entiteId: annonceId,
          details: details || {}
        }
      });
    } catch (error) {
      console.error('Erreur log activité:', error);
    }
  }

  // ==============================================
  // ANALYTICS ET STATS
  // ==============================================

  static async getAnnonceStats(annonceId: string): Promise<AnnonceStats> {
    try {
      const [vuesTotal, vuesToday, favorisCount, messagesCount] = await Promise.all([
        prisma.vueAnnonce.count({ where: { annonceId } }),
        prisma.vueAnnonce.count({
          where: { 
            annonceId,
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          }
        }),
        prisma.favori.count({ where: { annonceId } }),
        prisma.message.count({ where: { annonceId } })
      ]);

      const tauxConversion = vuesTotal > 0 ? (messagesCount / vuesTotal) * 100 : 0;

      return {
        totalVues: vuesTotal,
        vuesAujourdhui: vuesToday,
        totalFavoris: favorisCount,
        totalMessages: messagesCount,
        tauxConversion: Math.round(tauxConversion * 100) / 100,
        positionMoyenne: 0
      };

    } catch (error) {
      console.error('Erreur stats annonce:', error);
      throw new Error('Erreur lors du calcul des statistiques');
    }
  }

  // ==============================================
  // RECOMMANDATIONS IA
  // ==============================================

  static async getSimilarAnnonces(annonceId: string, limit: number = 5): Promise<Annonce[]> {
    try {
      const sourceAnnonce = await prisma.annonce.findUnique({
        where: { id: annonceId },
        select: {
          categorie: true,
          sousCategorie: true,
          prix: true,
          region: true,
          commune: true,
          tags: true
        }
      });

      if (!sourceAnnonce) return [];

      const similarAnnonces = await prisma.annonce.findMany({
        where: {
          id: { not: annonceId },
          statut: StatutAnnonce.ACTIVE,
          OR: [
            {
              categorie: sourceAnnonce.categorie,
              region: sourceAnnonce.region
            },
            {
              sousCategorie: sourceAnnonce.sousCategorie
            },
            {
              categorie: sourceAnnonce.categorie,
              prix: {
                gte: sourceAnnonce.prix * 0.5,
                lte: sourceAnnonce.prix * 1.5
              }
            }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              isProfessional: true,
              companyName: true,
              region: true,
              commune: true
            }
          }
        },
        take: limit,
        orderBy: [
          { premium: 'desc' },
          { datePublication: 'desc' }
        ]
      });

      return similarAnnonces.map(annonce => this.formatAnnonceForAPI(annonce));

    } catch (error) {
      console.error('Erreur recommandations:', error);
      return [];
    }
  }
}

export default AnnonceService;