// shared/src/types/index.ts
// TYPES ULTRA-AVANCÉS POUR PETITES ANNONCES CI

import { z } from 'zod';

// ==============================================
// ENUMS ET CONSTANTES
// ==============================================

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED', 
  DELETED = 'DELETED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY'
}

export enum StatutAnnonce {
  BROUILLON = 'BROUILLON',
  ACTIVE = 'ACTIVE',
  VENDUE = 'VENDUE',
  EXPIREE = 'EXPIREE',
  SUSPENDUE = 'SUSPENDUE',
  SUPPRIMEE = 'SUPPRIMEE'
}

export enum EtatProduit {
  NEUF = 'NEUF',
  TRES_BON_ETAT = 'TRES_BON_ETAT',
  BON_ETAT = 'BON_ETAT',
  ETAT_MOYEN = 'ETAT_MOYEN',
  POUR_PIECES = 'POUR_PIECES'
}

export enum TypeMessage {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  LOCATION = 'LOCATION'
}

export enum MethodePaiement {
  STRIPE = 'STRIPE',
  ORANGE_MONEY = 'ORANGE_MONEY',
  WAVE = 'WAVE',
  MOOV_MONEY = 'MOOV_MONEY',
  VIREMENT = 'VIREMENT'
}

// ==============================================
// RÉGIONS ET GÉOLOCALISATION CÔTE D'IVOIRE
// ==============================================

export const REGIONS_COTE_IVOIRE = {
  'abidjan': {
    nom: 'Abidjan',
    communes: [
      'Abobo', 'Adjamé', 'Attécoubé', 'Cocody', 'Koumassi',
      'Marcory', 'Plateau', 'Port-Bouët', 'Treichville', 'Yopougon',
      'Bingerville', 'Songon'
    ]
  },
  'bouake': {
    nom: 'Bouaké',
    communes: ['Bouaké', 'Béoumi', 'Bodokro', 'Botro', 'Kondé', 'Sakassou']
  },
  'yamoussoukro': {
    nom: 'Yamoussoukro',
    communes: ['Yamoussoukro', 'Attiégouakro', 'Toumodi']
  },
  'daloa': {
    nom: 'Daloa',
    communes: ['Daloa', 'Issia', 'Vavoua', 'Zuénoula']
  },
  'san-pedro': {
    nom: 'San-Pédro',
    communes: ['San-Pédro', 'Sassandra', 'Soubré', 'Tabou']
  },
  'korhogo': {
    nom: 'Korhogo',
    communes: ['Korhogo', 'Boundiali', 'Ferkessédougou', 'Sinématiali']
  },
  'man': {
    nom: 'Man',
    communes: ['Man', 'Biankouma', 'Danané', 'Sipilou']
  }
} as const;

export type RegionCode = keyof typeof REGIONS_COTE_IVOIRE;

// ==============================================
// CATÉGORIES SPÉCIALISÉES CÔTE D'IVOIRE
// ==============================================

export const CATEGORIES_CI = {
  'immobilier': {
    nom: 'Immobilier',
    icon: '🏠',
    sousCategories: [
      'Appartements',
      'Maisons',
      'Terrains',
      'Bureaux',
      'Magasins',
      'Colocations',
      'Locations saisonnières'
    ],
    champsSpecifiques: ['superficie', 'nombreChambres', 'nombreSallesBain', 'parking', 'jardin']
  },
  'vehicules': {
    nom: 'Véhicules',
    icon: '🚗',
    sousCategories: [
      'Voitures',
      'Motos',
      'Camions',
      'Bus',
      'Pièces Auto',
      'Location',
      'Moto-taxis'
    ],
    champsSpecifiques: ['marque', 'modele', 'annee', 'kilometrage', 'carburant', 'transmission']
  },
  'electronique': {
    nom: 'Électronique',
    icon: '📱',
    sousCategories: [
      'Téléphones',
      'Ordinateurs',
      'TV/Audio',
      'Électroménager',
      'Consoles',
      'Accessoires'
    ],
    champsSpecifiques: ['marque', 'modele', 'etat', 'garantie', 'accessoires']
  },
  'mode-beaute': {
    nom: 'Mode & Beauté',
    icon: '👗',
    sousCategories: [
      'Vêtements Femme',
      'Vêtements Homme',
      'Chaussures',
      'Sacs & Accessoires',
      'Beauté & Cosmétiques',
      'Montres & Bijoux',
      'Vêtements Traditionnels'
    ],
    champsSpecifiques: ['taille', 'couleur', 'matiere', 'marque']
  },
  'services': {
    nom: 'Services',
    icon: '🔧',
    sousCategories: [
      'Nettoyage',
      'Réparations',
      'Cours particuliers',
      'Événements',
      'Transport',
      'Jardinage',
      'Sécurité'
    ],
    champsSpecifiques: ['tarif', 'disponibilite', 'zone', 'experience']
  },
  'emploi': {
    nom: 'Emploi',
    icon: '💼',
    sousCategories: [
      'CDI',
      'CDD',
      'Stage',
      'Freelance',
      'Temps partiel',
      'Bénévolat'
    ],
    champsSpecifiques: ['salaire', 'experience', 'diplome', 'langues']
  },
  'maison-jardin': {
    nom: 'Maison & Jardin',
    icon: '🏡',
    sousCategories: [
      'Meubles',
      'Décoration',
      'Électroménager',
      'Jardin',
      'Bricolage',
      'Cuisine'
    ],
    champsSpecifiques: ['dimensions', 'matiere', 'couleur', 'etat']
  },
  'loisirs': {
    nom: 'Loisirs',
    icon: '🎯',
    sousCategories: [
      'Sports',
      'Musique',
      'Livres',
      'Jeux',
      'Collection',
      'Art'
    ],
    champsSpecifiques: ['discipline', 'niveau', 'age', 'etat']
  }
} as const;

export type CategorieCode = keyof typeof CATEGORIES_CI;

// ==============================================
// SCHEMAS DE VALIDATION ZOD
// ==============================================

// Schema utilisateur
export const userSchema = z.object({
  firstName: z.string().min(2, 'Prénom requis (min 2 caractères)').max(50),
  lastName: z.string().min(2, 'Nom requis (min 2 caractères)').max(50),
  email: z.string().email('Email invalide'),
  phone: z.string().regex(/^(\+225|00225|225)?[0-9]{8,10}$/, 'Numéro ivoirien invalide'),
  password: z.string().min(6, 'Mot de passe min 6 caractères').max(128),
  dateOfBirth: z.date().optional(),
  gender: z.nativeEnum(Gender).optional(),
  isProfessional: z.boolean().default(false),
  companyName: z.string().max(100).optional(),
  region: z.string().optional(),
  commune: z.string().optional(),
  quartier: z.string().optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email ou téléphone requis'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().default(false)
});

// Schema annonce
export const annonceSchema = z.object({
  titre: z.string().min(5, 'Titre min 5 caractères').max(200),
  description: z.string().min(10, 'Description min 10 caractères').max(5000),
  prix: z.number().positive('Prix doit être positif'),
  negociable: z.boolean().default(false),
  categorie: z.string().min(1, 'Catégorie requise'),
  sousCategorie: z.string().optional(),
  region: z.string().min(1, 'Région requise'),
  commune: z.string().min(1, 'Commune requise'),
  quartier: z.string().optional(),
  telephone: z.string().regex(/^(\+225|00225|225)?[0-9]{8,10}$/).optional(),
  whatsapp: z.string().regex(/^(\+225|00225|225)?[0-9]{8,10}$/).optional(),
  images: z.array(z.string().url()).max(10, 'Maximum 10 images'),
  tags: z.array(z.string()).max(20).default([]),
  etat: z.nativeEnum(EtatProduit).optional(),
  proprietes: z.record(z.any()).default({})
});

// Schema message
export const messageSchema = z.object({
  annonceId: z.string().cuid(),
  receiverId: z.string().cuid(),
  contenu: z.string().min(1, 'Message requis').max(1000),
  type: z.nativeEnum(TypeMessage).default(TypeMessage.TEXT),
  fichiers: z.array(z.string().url()).max(5).default([])
});

// Schema recherche
export const searchSchema = z.object({
  q: z.string().optional(),
  categorie: z.string().optional(),
  sousCategorie: z.string().optional(),
  region: z.string().optional(),
  commune: z.string().optional(),
  prixMin: z.number().positive().optional(),
  prixMax: z.number().positive().optional(),
  etat: z.nativeEnum(EtatProduit).optional(),
  tri: z.enum(['recent', 'prix_asc', 'prix_desc', 'pertinence']).default('recent'),
  page: z.number().positive().default(1),
  limite: z.number().positive().max(50).default(20)
});

// ==============================================
// TYPES D'INTERFACE
// ==============================================

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isProfessional: boolean;
  companyName?: string;
  region?: string;
  commune?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isProfessional: boolean;
  companyName?: string;
  region?: string;
  commune?: string;
  noteGlobale?: number;
  nombreAvis?: number;
  membereDepuis: Date;
}

export interface Annonce {
  id: string;
  titre: string;
  description: string;
  prix: number;
  devise: string;
  negociable: boolean;
  categorie: string;
  sousCategorie?: string;
  images: string[];
  videos: string[];
  region: string;
  commune: string;
  quartier?: string;
  telephone?: string;
  whatsapp?: string;
  statut: StatutAnnonce;
  premium: boolean;
  promue: boolean;
  urgente: boolean;
  vuesCount: number;
  favorisCount: number;
  tags: string[];
  etat?: EtatProduit;
  proprietes: Record<string, any>;
  slug: string;
  userId: string;
  user: PublicUser;
  datePublication?: Date;
  dateExpiration?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  annonceId: string;
  senderId: string;
  receiverId: string;
  contenu: string;
  type: TypeMessage;
  fichiers: string[];
  lu: boolean;
  dateEnvoi: Date;
  dateLecture?: Date;
  sender: PublicUser;
  receiver: PublicUser;
}

export interface Conversation {
  id: string;
  annonce: Pick<Annonce, 'id' | 'titre' | 'images' | 'prix' | 'statut'>;
  otherUser: PublicUser;
  lastMessage: Message;
  unreadCount: number;
  updatedAt: Date;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  nouveauMessage: boolean;
  nouvelleOffre: boolean;
  rappelExpiration: boolean;
}

export interface UserProfile extends User {
  dateOfBirth?: Date;
  gender?: Gender;
  address?: string;
  latitude?: number;
  longitude?: number;
  notifications: NotificationPreferences;
  language: string;
  timezone: string;
  twoFactorEnabled: boolean;
}

// ==============================================
// TYPES DE RECHERCHE ET FILTRES
// ==============================================

export interface SearchFilters {
  q?: string;
  categorie?: string;
  sousCategorie?: string;
  region?: string;
  commune?: string;
  prixMin?: number;
  prixMax?: number;
  etat?: EtatProduit;
  utilisateurPro?: boolean;
  avecImages?: boolean;
  urgentesOnly?: boolean;
  dateMin?: Date;
  dateMax?: Date;
}

export interface SearchResult {
  annonces: Annonce[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  facettes: {
    categories: Array<{ nom: string; count: number }>;
    regions: Array<{ nom: string; count: number }>;
    prix: { min: number; max: number; moyenne: number };
  };
}

// ==============================================
// TYPES API ET RÉPONSES
// ==============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
    version: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse extends ApiResponse<{
  user: User;
  tokens: AuthTokens;
}> {}

// ==============================================
// TYPES DE PAIEMENTS
// ==============================================

export interface PaiementData {
  montant: number;
  devise: string;
  methode: MethodePaiement;
  description: string;
  metadata?: Record<string, any>;
}

export interface PaiementOrangeMoney extends PaiementData {
  numeroTelephone: string;
  codePin?: string;
}

export interface PaiementWave extends PaiementData {
  numeroTelephone: string;
}

// ==============================================
// TYPES D'ÉVÉNEMENTS WEBSOCKET
// ==============================================

export interface WebSocketEvent {
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
}

export interface MessageEvent extends WebSocketEvent {
  type: 'NEW_MESSAGE';
  payload: Message;
}

export interface NotificationEvent extends WebSocketEvent {
  type: 'NOTIFICATION';
  payload: {
    titre: string;
    contenu: string;
    type: 'info' | 'success' | 'warning' | 'error';
    lien?: string;
  };
}

// ==============================================
// TYPES UTILITAIRES
// ==============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type OptionalExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

// ==============================================
// CONSTANTES MÉTIER
// ==============================================

export const LIMITS = {
  ANNONCE: {
    MAX_IMAGES: 10,
    MAX_VIDEOS: 3,
    MAX_TITRE: 200,
    MAX_DESCRIPTION: 5000,
    MAX_TAGS: 20
  },
  MESSAGE: {
    MAX_CONTENU: 1000,
    MAX_FICHIERS: 5
  },
  USER: {
    MAX_ANNONCES_GRATUITES: 5,
    MAX_ANNONCES_PRO: 50
  },
  FILE: {
    MAX_SIZE_IMAGE: 5 * 1024 * 1024, // 5MB
    MAX_SIZE_VIDEO: 50 * 1024 * 1024, // 50MB
    MAX_SIZE_DOCUMENT: 10 * 1024 * 1024 // 10MB
  }
} as const;

export const TARIFS = {
  BOOST_ANNONCE: 1000, // XOF
  ANNONCE_PREMIUM: 2500, // XOF
  ABONNEMENT_PRO_MENSUEL: 15000, // XOF
  COMMISSION_VENTE: 0.05 // 5%
} as const;

// ==============================================
// TYPES D'EXPORT
// ==============================================

export type {
  RegionCode,
  CategorieCode
};

// Schemas d'export
export {
  userSchema,
  loginSchema,
  annonceSchema,
  messageSchema,
  searchSchema
};