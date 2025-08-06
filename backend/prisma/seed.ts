// backend/prisma/seed.ts
// SCRIPT DE DONNÉES RÉVOLUTIONNAIRE - CÔTE D'IVOIRE
// Populate base de données avec régions, catégories et données de référence

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==============================================
// DONNÉES RÉGIONS CÔTE D'IVOIRE COMPLÈTES
// ==============================================

const REGIONS_COTE_IVOIRE = [
  {
    nom: 'Abidjan',
    code: 'AB',
    communes: [
      'Abobo', 'Adjamé', 'Attécoubé', 'Cocody', 'Koumassi', 
      'Marcory', 'Plateau', 'Port-Bouët', 'Treichville', 'Yopougon',
      'Bingerville', 'Songon'
    ],
    coordonnees: { lat: 5.345317, lng: -4.024429 },
    population: 6321017,
    superficie: 2119
  },
  {
    nom: 'Bouaké',
    code: 'BK',
    communes: ['Bouaké', 'Béoumi', 'Bodokro', 'Botro', 'Kondé', 'Sakassou'],
    coordonnees: { lat: 7.694444, lng: -5.030556 },
    population: 1573000,
    superficie: 7956
  },
  {
    nom: 'Yamoussoukro',
    code: 'YS',
    communes: ['Yamoussoukro', 'Attiégouakro', 'Tiébissou'],
    coordonnees: { lat: 6.816667, lng: -5.283333 },
    population: 355573,
    superficie: 3500
  },
  {
    nom: 'Korhogo',
    code: 'KH',
    communes: ['Korhogo', 'Dikodougou', 'Guiembé', 'Kanoroba', 'Komborodougou', 'Napiélédougou', 'Sinématiali'],
    coordonnees: { lat: 9.458056, lng: -5.629167 },
    population: 1040000,
    superficie: 12500
  },
  {
    nom: 'San-Pédro',
    code: 'SP',
    communes: ['San-Pédro', 'Sassandra', 'Soubré', 'Grand-Béréby'],
    coordonnees: { lat: 4.748611, lng: -6.636111 },
    population: 1133000,
    superficie: 25600
  },
  {
    nom: 'Daloa',
    code: 'DL',
    communes: ['Daloa', 'Issia', 'Vavoua', 'Zoukougbeu'],
    coordonnees: { lat: 6.877500, lng: -6.450000 },
    population: 1430000,
    superficie: 15200
  },
  {
    nom: 'Man',
    code: 'MN',
    communes: ['Man', 'Bangolo', 'Biankouma', 'Danané', 'Logoualé', 'Sipilou', 'Zouan-Hounien'],
    coordonnees: { lat: 7.412500, lng: -7.554167 },
    population: 1200000,
    superficie: 16600
  },
  {
    nom: 'Divo',
    code: 'DV',
    communes: ['Divo', 'Fresco', 'Guitry', 'Lakota', 'Lauzoua'],
    coordonnees: { lat: 5.839722, lng: -5.357500 },
    population: 961100,
    superficie: 15688
  }
];

// ==============================================
// CATÉGORIES D'ANNONCES CÔTE D'IVOIRE
// ==============================================

const CATEGORIES_BASE = [
  {
    nom: 'Véhicules',
    slug: 'vehicules',
    description: 'Voitures, motos, camions, pièces détachées',
    icone: '🚗',
    couleur: '#3B82F6',
    sousCategories: [
      { nom: 'Voitures', slug: 'voitures', icone: '🚙' },
      { nom: 'Motos', slug: 'motos', icone: '🏍️' },
      { nom: 'Camions & Utilitaires', slug: 'camions', icone: '🚚' },
      { nom: 'Pièces & Accessoires', slug: 'pieces-auto', icone: '🔧' },
      { nom: 'Bateaux', slug: 'bateaux', icone: '⛵' }
    ]
  },
  {
    nom: 'Immobilier',
    slug: 'immobilier',
    description: 'Ventes, locations, terrains',
    icone: '🏠',
    couleur: '#10B981',
    sousCategories: [
      { nom: 'Ventes Immobilières', slug: 'vente-immobilier', icone: '🏡' },
      { nom: 'Locations', slug: 'location', icone: '🏠' },
      { nom: 'Colocations', slug: 'colocation', icone: '🤝' },
      { nom: 'Terrains', slug: 'terrains', icone: '🌍' },
      { nom: 'Bureaux & Commerces', slug: 'bureaux', icone: '🏢' }
    ]
  },
  {
    nom: 'Emplois & Services',
    slug: 'emplois-services',
    description: 'Offres d\'emploi, services professionnels',
    icone: '💼',
    couleur: '#8B5CF6',
    sousCategories: [
      { nom: 'Offres d\'Emploi', slug: 'emploi', icone: '👔' },
      { nom: 'Services à Domicile', slug: 'services-domicile', icone: '🏠' },
      { nom: 'Cours Particuliers', slug: 'cours', icone: '📚' },
      { nom: 'Événementiel', slug: 'evenementiel', icone: '🎉' },
      { nom: 'Beauté & Bien-être', slug: 'beaute', icone: '💄' }
    ]
  },
  {
    nom: 'Électronique',
    slug: 'electronique',
    description: 'Téléphones, informatique, électroménager',
    icone: '📱',
    couleur: '#F59E0B',
    sousCategories: [
      { nom: 'Téléphones', slug: 'telephones', icone: '📱' },
      { nom: 'Informatique', slug: 'informatique', icone: '💻' },
      { nom: 'TV & Audio', slug: 'tv-audio', icone: '📺' },
      { nom: 'Électroménager', slug: 'electromenager', icone: '🏠' },
      { nom: 'Gaming', slug: 'gaming', icone: '🎮' }
    ]
  },
  {
    nom: 'Mode & Beauté',
    slug: 'mode-beaute',
    description: 'Vêtements, chaussures, accessoires',
    icone: '👗',
    couleur: '#EC4899',
    sousCategories: [
      { nom: 'Vêtements Femmes', slug: 'vetements-femmes', icone: '👗' },
      { nom: 'Vêtements Hommes', slug: 'vetements-hommes', icone: '👔' },
      { nom: 'Chaussures', slug: 'chaussures', icone: '👠' },
      { nom: 'Sacs & Accessoires', slug: 'sacs-accessoires', icone: '👜' },
      { nom: 'Bijoux & Montres', slug: 'bijoux', icone: '💍' }
    ]
  },
  {
    nom: 'Maison & Jardin',
    slug: 'maison-jardin',
    description: 'Meubles, décoration, jardinage',
    icone: '🪴',
    couleur: '#059669',
    sousCategories: [
      { nom: 'Meubles', slug: 'meubles', icone: '🪑' },
      { nom: 'Décoration', slug: 'decoration', icone: '🖼️' },
      { nom: 'Jardinage', slug: 'jardinage', icone: '🌱' },
      { nom: 'Bricolage', slug: 'bricolage', icone: '🔨' },
      { nom: 'Piscine & Spa', slug: 'piscine', icone: '🏊' }
    ]
  },
  {
    nom: 'Loisirs & Divertissement',
    slug: 'loisirs',
    description: 'Sports, livres, musique, voyages',
    icone: '🎯',
    couleur: '#DC2626',
    sousCategories: [
      { nom: 'Sports & Fitness', slug: 'sport', icone: '⚽' },
      { nom: 'Livres & BD', slug: 'livres', icone: '📚' },
      { nom: 'Musique & Cinéma', slug: 'musique', icone: '🎵' },
      { nom: 'Voyages', slug: 'voyages', icone: '✈️' },
      { nom: 'Collection', slug: 'collection', icone: '🏆' }
    ]
  },
  {
    nom: 'Agriculture & Élevage',
    slug: 'agriculture',
    description: 'Matériel agricole, animaux, productions locales',
    icone: '🌾',
    couleur: '#65A30D',
    sousCategories: [
      { nom: 'Matériel Agricole', slug: 'materiel-agricole', icone: '🚜' },
      { nom: 'Animaux', slug: 'animaux', icone: '🐄' },
      { nom: 'Semences & Plants', slug: 'semences', icone: '🌱' },
      { nom: 'Produits Fermiers', slug: 'produits-fermiers', icone: '🥬' }
    ]
  }
];

// ==============================================
// UTILISATEURS DE DÉMONSTRATION
// ==============================================

const USERS_DEMO = [
  {
    email: 'admin@petites-annonces-ci.com',
    phone: '+22507000001',
    firstName: 'Admin',
    lastName: 'Système',
    password: 'Admin123!@#',
    isProfessional: false,
    region: 'Abidjan',
    commune: 'Plateau',
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: true
  },
  {
    email: 'konan.kouame@example.ci',
    phone: '+22507123456',
    firstName: 'Konan',
    lastName: 'Kouamé',
    password: 'Demo123!',
    isProfessional: true,
    companyName: 'Kouamé Auto',
    region: 'Abidjan',
    commune: 'Cocody',
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: true
  },
  {
    email: 'aya.traore@example.ci',
    phone: '+22501987654',
    firstName: 'Aya',
    lastName: 'Traoré',
    password: 'Demo123!',
    isProfessional: false,
    region: 'Bouaké',
    commune: 'Bouaké',
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: true
  }
];

// ==============================================
// ANNONCES DE DÉMONSTRATION
// ==============================================

const ANNONCES_DEMO = [
  {
    titre: 'Toyota Corolla 2018 - Excellent état',
    description: 'Toyota Corolla 2018 en excellent état, climatisée, vitres électriques, radio MP3. Entretien régulier chez Toyota CI. Papiers à jour. Visible à Cocody.',
    prix: 12500000,
    categorie: 'vehicules',
    sousCategorie: 'voitures',
    etat: 'TRES_BON_ETAT',
    region: 'Abidjan',
    commune: 'Cocody',
    quartier: 'Riviera',
    telephone: '+22507123456',
    whatsapp: '+22507123456',
    tags: ['toyota', 'corolla', '2018', 'climatisée'],
    images: [
      'https://example.com/toyota-corolla-1.jpg',
      'https://example.com/toyota-corolla-2.jpg'
    ],
    proprietes: {
      marque: 'Toyota',
      modele: 'Corolla',
      annee: 2018,
      kilometrage: 45000,
      carburant: 'Essence',
      transmission: 'Manuelle',
      couleur: 'Gris métallisé'
    },
    statut: 'ACTIVE',
    premium: true
  },
  {
    titre: 'Appartement 3 pièces à louer - Marcory',
    description: 'Bel appartement 3 pièces au 2ème étage, salon, 2 chambres, cuisine équipée, salle de bain. Quartier calme proche des transports.',
    prix: 180000,
    categorie: 'immobilier',
    sousCategorie: 'location',
    region: 'Abidjan',
    commune: 'Marcory',
    quartier: 'Zone 4',
    telephone: '+22501987654',
    images: [
      'https://example.com/appartement-1.jpg',
      'https://example.com/appartement-2.jpg',
      'https://example.com/appartement-3.jpg'
    ],
    proprietes: {
      surface: 65,
      pieces: 3,
      chambres: 2,
      sallesBain: 1,
      etage: 2,
      ascenseur: false,
      parking: true,
      jardin: false
    },
    statut: 'ACTIVE',
    urgente: true
  },
  {
    titre: 'iPhone 13 Pro 128GB - Comme neuf',
    description: 'iPhone 13 Pro 128GB couleur graphite, acheté il y a 6 mois. Très peu utilisé, comme neuf. Boîte et accessoires inclus.',
    prix: 650000,
    categorie: 'electronique',
    sousCategorie: 'telephones',
    etat: 'TRES_BON_ETAT',
    region: 'Abidjan',
    commune: 'Plateau',
    quartier: 'Centre-ville',
    telephone: '+22507000001',
    tags: ['iphone', 'apple', '13pro', '128gb'],
    images: ['https://example.com/iphone13pro.jpg'],
    proprietes: {
      marque: 'Apple',
      modele: 'iPhone 13 Pro',
      stockage: '128GB',
      couleur: 'Graphite',
      garantie: '6 mois restants'
    },
    statut: 'ACTIVE',
    promue: true
  }
];

// ==============================================
// FONCTIONS D'AIDE
// ==============================================

async function clearDatabase() {
  console.log('🗑️ Nettoyage de la base de données...');
  
  // Supprimer dans l'ordre inverse des dépendances
  await prisma.logActivite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.signalement.deleteMany();
  await prisma.avis.deleteMany();
  await prisma.abonnement.deleteMany();
  await prisma.paiement.deleteMany();
  await prisma.vueAnnonce.deleteMany();
  await prisma.message.deleteMany();
  await prisma.favori.deleteMany();
  await prisma.annonce.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.categorie.deleteMany();
  await prisma.regionCI.deleteMany();
  
  console.log('✅ Base de données nettoyée');
}

async function seedRegions() {
  console.log('🌍 Création des régions de Côte d\'Ivoire...');
  
  for (const region of REGIONS_COTE_IVOIRE) {
    await prisma.regionCI.create({
      data: {
        id: region.code.toLowerCase(),
        nom: region.nom,
        code: region.code,
        communes: region.communes,
        coordonnees: region.coordonnees,
        population: region.population,
        superficie: region.superficie
      }
    });
  }
  
  console.log(`✅ ${REGIONS_COTE_IVOIRE.length} régions créées`);
}

async function seedCategories() {
  console.log('📂 Création des catégories d\'annonces...');
  
  for (const [index, cat] of CATEGORIES_BASE.entries()) {
    // Créer la catégorie principale
    const parentCategorie = await prisma.categorie.create({
      data: {
        nom: cat.nom,
        slug: cat.slug,
        description: cat.description,
        icone: cat.icone,
        couleur: cat.couleur,
        ordre: index
      }
    });
    
    // Créer les sous-catégories
    for (const [subIndex, subCat] of cat.sousCategories.entries()) {
      await prisma.categorie.create({
        data: {
          nom: subCat.nom,
          slug: subCat.slug,
          icone: subCat.icone,
          parentId: parentCategorie.id,
          ordre: subIndex
        }
      });
    }
  }
  
  console.log('✅ Catégories et sous-catégories créées');
}

async function seedUsers() {
  console.log('👥 Création des utilisateurs de démonstration...');
  
  for (const userData of USERS_DEMO) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        id: `user_${userData.firstName.toLowerCase()}_${Date.now()}`
      }
    });
  }
  
  console.log(`✅ ${USERS_DEMO.length} utilisateurs créés`);
}

async function seedAnnonces() {
  console.log('📢 Création des annonces de démonstration...');
  
  // Récupérer les utilisateurs pour attribution
  const users = await prisma.user.findMany();
  
  for (const [index, annonceData] of ANNONCES_DEMO.entries()) {
    const user = users[index % users.length];
    const slug = annonceData.titre
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    await prisma.annonce.create({
      data: {
        ...annonceData,
        slug: `${slug}-${Date.now()}`,
        userId: user.id,
        datePublication: new Date(),
        dateExpiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
      }
    });
  }
  
  console.log(`✅ ${ANNONCES_DEMO.length} annonces créées`);
}

async function createIndices() {
  console.log('🔍 Création des index de recherche...');
  
  // Index de recherche full-text personnalisé (déjà dans la migration)
  console.log('✅ Index de recherche configurés');
}

async function logSummary() {
  const stats = {
    regions: await prisma.regionCI.count(),
    categories: await prisma.categorie.count(),
    users: await prisma.user.count(),
    annonces: await prisma.annonce.count()
  };
  
  console.log('\n🎉 SEED TERMINÉ AVEC SUCCÈS ! 🎉');
  console.log('===============================');
  console.log(`📍 Régions CI      : ${stats.regions}`);
  console.log(`📂 Catégories      : ${stats.categories}`);
  console.log(`👥 Utilisateurs    : ${stats.users}`);
  console.log(`📢 Annonces        : ${stats.annonces}`);
  console.log('===============================');
  console.log('\n🚀 Votre plateforme Petites Annonces CI est prête !');
  console.log('📱 Connectez-vous avec :');
  console.log('   Email: admin@petites-annonces-ci.com');
  console.log('   Mot de passe: Admin123!@#');
  console.log('\n🌍 Base de données Côte d\'Ivoire complète !');
}

// ==============================================
// SCRIPT PRINCIPAL
// ==============================================

async function main() {
  try {
    console.log('🚀 DÉBUT DU SEED PETITES ANNONCES CI');
    console.log('=====================================\n');
    
    // 1. Nettoyer la base
    await clearDatabase();
    
    // 2. Créer les données de référence
    await seedRegions();
    await seedCategories();
    
    // 3. Créer les utilisateurs
    await seedUsers();
    
    // 4. Créer les annonces
    await seedAnnonces();
    
    // 5. Configuration finale
    await createIndices();
    
    // 6. Résumé
    await logSummary();
    
  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    process.exit(1);
  }
}

// Exécution du script
main()
  .catch((e) => {
    console.error('💥 Erreur fatale:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export default main;