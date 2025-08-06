// backend/prisma/migrations/000001_initial_setup/migration.sql
-- MIGRATION INITIALE RÉVOLUTIONNAIRE - CÔTE D'IVOIRE
-- Base de données ultra-optimisée pour petites annonces

-- Activer les extensions PostgreSQL nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==============================================
-- ENUMS MÉTIER
-- ==============================================

CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING_VERIFICATION');
CREATE TYPE "EtatProduit" AS ENUM ('NEUF', 'TRES_BON_ETAT', 'BON_ETAT', 'ETAT_MOYEN', 'POUR_PIECES');
CREATE TYPE "StatutAnnonce" AS ENUM ('BROUILLON', 'ACTIVE', 'VENDUE', 'EXPIREE', 'SUSPENDUE', 'SUPPRIMEE');
CREATE TYPE "TypeMessage" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION');
CREATE TYPE "MethodePaiement" AS ENUM ('STRIPE', 'ORANGE_MONEY', 'WAVE', 'MOOV_MONEY', 'VIREMENT');
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REFUSE', 'REMBOURSE');
CREATE TYPE "TypeAbonnement" AS ENUM ('GRATUIT', 'PREMIUM', 'BUSINESS', 'ENTERPRISE');
CREATE TYPE "TypeNotification" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- ==============================================
-- TABLE UTILISATEURS AVANCÉE
-- ==============================================

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    
    -- Informations personnelles
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatar" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    
    -- Professionnel
    "isProfessional" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "companyLogo" TEXT,
    "storeLocation" TEXT,
    "siret" TEXT,
    
    -- Géolocalisation
    "region" TEXT,
    "commune" TEXT,
    "quartier" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    
    -- Vérifications
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    
    -- Sécurité
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    
    -- Préférences
    "language" TEXT NOT NULL DEFAULT 'fr',
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Abidjan',
    "notifications" JSONB NOT NULL DEFAULT '{"email": true, "sms": true, "push": true}',
    
    -- Métadonnées
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- TOKENS DE RAFRAÎCHISSEMENT
-- ==============================================

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- ANNONCES RÉVOLUTIONNAIRES
-- ==============================================

CREATE TABLE "annonces" (
    "id" TEXT NOT NULL,
    
    -- Contenu
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "negociable" BOOLEAN NOT NULL DEFAULT false,
    
    -- Médias
    "images" JSONB NOT NULL DEFAULT '[]',
    "videos" JSONB NOT NULL DEFAULT '[]',
    "documents" JSONB NOT NULL DEFAULT '[]',
    
    -- Catégorisation
    "categorie" TEXT NOT NULL,
    "sousCategorie" TEXT,
    "marque" TEXT,
    "modele" TEXT,
    "etat" "EtatProduit",
    
    -- Géolocalisation
    "region" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "quartier" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "adresseComplete" TEXT,
    "codePostal" TEXT,
    
    -- Contact
    "telephone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "siteWeb" TEXT,
    
    -- Propriétés dynamiques
    "proprietes" JSONB NOT NULL DEFAULT '{}',
    
    -- Statistiques
    "vuesCount" INTEGER NOT NULL DEFAULT 0,
    "favorisCount" INTEGER NOT NULL DEFAULT 0,
    "messagesCount" INTEGER NOT NULL DEFAULT 0,
    "partagesCount" INTEGER NOT NULL DEFAULT 0,
    
    -- SEO
    "slug" TEXT NOT NULL,
    "tags" TEXT[],
    "motsCles" TEXT,
    
    -- Statut
    "statut" "StatutAnnonce" NOT NULL DEFAULT 'BROUILLON',
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "promue" BOOLEAN NOT NULL DEFAULT false,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    
    -- Dates
    "datePublication" TIMESTAMP(3),
    "dateExpiration" TIMESTAMP(3),
    "dateVente" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    
    -- Propriétaire
    "userId" TEXT NOT NULL,

    CONSTRAINT "annonces_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- FAVORIS
-- ==============================================

CREATE TABLE "favoris" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoris_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- MESSAGERIE TEMPS RÉEL
-- ==============================================

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "type" "TypeMessage" NOT NULL DEFAULT 'TEXT',
    "fichiers" JSONB NOT NULL DEFAULT '[]',
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLecture" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- VUES ANNONCES (ANALYTICS)
-- ==============================================

CREATE TABLE "vues_annonces" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vues_annonces_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- PAIEMENTS MOBILES CÔTE D'IVOIRE
-- ==============================================

CREATE TABLE "paiements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "annonceId" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "methode" "MethodePaiement" NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    
    -- Données paiement mobile
    "numeroTelephone" TEXT,
    "operateur" TEXT, -- orange, mtn, moov
    "transactionId" TEXT,
    "codeConfirmation" TEXT,
    
    -- Stripe
    "stripePaymentId" TEXT,
    "stripeCustomerId" TEXT,
    
    -- Métadonnées
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "dateTransaction" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- ABONNEMENTS PREMIUM
-- ==============================================

CREATE TABLE "abonnements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TypeAbonnement" NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "autoRenouvellement" BOOLEAN NOT NULL DEFAULT false,
    "paiementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abonnements_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- AVIS ET EVALUATIONS
-- ==============================================

CREATE TABLE "avis" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "note" INTEGER NOT NULL CHECK ("note" >= 1 AND "note" <= 5),
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avis_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- SIGNALEMENTS
-- ==============================================

CREATE TABLE "signalements" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "description" TEXT,
    "traite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signalements_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- NOTIFICATIONS
-- ==============================================

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- RÉGIONS CÔTE D'IVOIRE
-- ==============================================

CREATE TABLE "regions_ci" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "communes" JSONB NOT NULL DEFAULT '[]',
    "coordonnees" JSONB NOT NULL DEFAULT '{}',
    "population" INTEGER,
    "superficie" DOUBLE PRECISION,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_ci_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- CATÉGORIES DYNAMIQUES
-- ==============================================

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icone" TEXT,
    "image" TEXT,
    "couleur" TEXT,
    "parentId" TEXT,
    "champsPersonnalises" JSONB NOT NULL DEFAULT '[]',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- LOGS D'ACTIVITÉ
-- ==============================================

CREATE TABLE "logs_activite" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_activite_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- CONSTRAINTS ET INDEX OPTIMISÉS
-- ==============================================

-- Utilisateurs
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "users_region_commune_idx" ON "users"("region", "commune");
CREATE INDEX "users_isProfessional_idx" ON "users"("isProfessional");
CREATE INDEX "users_status_idx" ON "users"("status");

-- Tokens
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- Annonces
CREATE UNIQUE INDEX "annonces_slug_key" ON "annonces"("slug");
CREATE INDEX "annonces_categorie_idx" ON "annonces"("categorie");
CREATE INDEX "annonces_sousCategorie_idx" ON "annonces"("sousCategorie");
CREATE INDEX "annonces_region_commune_idx" ON "annonces"("region", "commune");
CREATE INDEX "annonces_prix_idx" ON "annonces"("prix");
CREATE INDEX "annonces_statut_idx" ON "annonces"("statut");
CREATE INDEX "annonces_premium_idx" ON "annonces"("premium");
CREATE INDEX "annonces_datePublication_idx" ON "annonces"("datePublication");
CREATE INDEX "annonces_userId_idx" ON "annonces"("userId");

-- Index de recherche full-text
CREATE INDEX "annonces_fulltext_idx" ON "annonces" USING gin(to_tsvector('french', "titre" || ' ' || "description" || ' ' || COALESCE("motsCles", '')));

-- Index géospatial pour la recherche par localisation
CREATE INDEX "annonces_location_idx" ON "annonces" USING gist(ll_to_earth("latitude", "longitude"));

-- Favoris
CREATE UNIQUE INDEX "favoris_userId_annonceId_key" ON "favoris"("userId", "annonceId");
CREATE INDEX "favoris_userId_idx" ON "favoris"("userId");
CREATE INDEX "favoris_annonceId_idx" ON "favoris"("annonceId");

-- Messages
CREATE INDEX "messages_annonceId_idx" ON "messages"("annonceId");
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");
CREATE INDEX "messages_receiverId_idx" ON "messages"("receiverId");
CREATE INDEX "messages_dateEnvoi_idx" ON "messages"("dateEnvoi");

-- Vues annonces
CREATE INDEX "vues_annonces_annonceId_idx" ON "vues_annonces"("annonceId");
CREATE INDEX "vues_annonces_userId_idx" ON "vues_annonces"("userId");
CREATE INDEX "vues_annonces_timestamp_idx" ON "vues_annonces"("timestamp");

-- Paiements
CREATE INDEX "paiements_userId_idx" ON "paiements"("userId");
CREATE INDEX "paiements_annonceId_idx" ON "paiements"("annonceId");
CREATE INDEX "paiements_statut_idx" ON "paiements"("statut");

-- Catégories
CREATE UNIQUE INDEX "categories_nom_key" ON "categories"("nom");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");
CREATE INDEX "categories_ordre_idx" ON "categories"("ordre");

-- Régions
CREATE UNIQUE INDEX "regions_ci_nom_key" ON "regions_ci"("nom");
CREATE UNIQUE INDEX "regions_ci_code_key" ON "regions_ci"("code");

-- Logs
CREATE INDEX "logs_activite_userId_idx" ON "logs_activite"("userId");
CREATE INDEX "logs_activite_action_idx" ON "logs_activite"("action");
CREATE INDEX "logs_activite_entite_entiteId_idx" ON "logs_activite"("entite", "entiteId");
CREATE INDEX "logs_activite_createdAt_idx" ON "logs_activite"("createdAt");

-- ==============================================
-- FOREIGN KEYS
-- ==============================================

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "annonces" ADD CONSTRAINT "annonces_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favoris" ADD CONSTRAINT "favoris_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favoris" ADD CONSTRAINT "favoris_annonceId_fkey" 
    FOREIGN KEY ("annonceId") REFERENCES "annonces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_annonceId_fkey" 
    FOREIGN KEY ("annonceId") REFERENCES "annonces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" 
    FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" 
    FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vues_annonces" ADD CONSTRAINT "vues_annonces_annonceId_fkey" 
    FOREIGN KEY ("annonceId") REFERENCES "annonces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vues_annonces" ADD CONSTRAINT "vues_annonces_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "paiements" ADD CONSTRAINT "paiements_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "paiements" ADD CONSTRAINT "paiements_annonceId_fkey" 
    FOREIGN KEY ("annonceId") REFERENCES "annonces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "avis" ADD CONSTRAINT "avis_annonceId_fkey" 
    FOREIGN KEY ("annonceId") REFERENCES "annonces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "avis" ADD CONSTRAINT "avis_giverId_fkey" 
    FOREIGN KEY ("giverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "avis" ADD CONSTRAINT "avis_receiverId_fkey" 
    FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signalements" ADD CONSTRAINT "signalements_annonceId_fkey" 
    FOREIGN KEY ("annonceId") REFERENCES "annonces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signalements" ADD CONSTRAINT "signalements_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" 
    FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================
-- TRIGGERS POUR AUTO-UPDATE
-- ==============================================

-- Fonction pour mettre à jour automatiquement les timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger aux tables nécessaires
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_annonces_updated_at BEFORE UPDATE ON "annonces" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paiements_updated_at BEFORE UPDATE ON "paiements" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_abonnements_updated_at BEFORE UPDATE ON "abonnements" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_regions_ci_updated_at BEFORE UPDATE ON "regions_ci" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON "categories" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- FONCTION RECHERCHE AVANCÉE
-- ==============================================

-- Fonction de recherche full-text optimisée
CREATE OR REPLACE FUNCTION search_annonces(
    search_query TEXT DEFAULT '',
    search_region TEXT DEFAULT '',
    search_category TEXT DEFAULT '',
    min_price NUMERIC DEFAULT 0,
    max_price NUMERIC DEFAULT NULL,
    user_lat NUMERIC DEFAULT NULL,
    user_lon NUMERIC DEFAULT NULL,
    radius_km INTEGER DEFAULT 50
)
RETURNS TABLE (
    id TEXT,
    titre TEXT,
    prix NUMERIC,
    distance_km NUMERIC,
    relevance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.titre,
        a.prix,
        CASE 
            WHEN user_lat IS NOT NULL AND user_lon IS NOT NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
            THEN earth_distance(ll_to_earth(user_lat, user_lon), ll_to_earth(a.latitude, a.longitude)) / 1000
            ELSE NULL
        END as distance_km,
        CASE 
            WHEN search_query = '' THEN 1
            ELSE ts_rank(to_tsvector('french', a.titre || ' ' || a.description), plainto_tsquery('french', search_query))
        END as relevance
    FROM annonces a
    WHERE 
        a.statut = 'ACTIVE'
        AND a.dateExpiration > CURRENT_TIMESTAMP
        AND (search_query = '' OR to_tsvector('french', a.titre || ' ' || a.description) @@ plainto_tsquery('french', search_query))
        AND (search_region = '' OR a.region = search_region)
        AND (search_category = '' OR a.categorie = search_category)
        AND a.prix >= min_price
        AND (max_price IS NULL OR a.prix <= max_price)
        AND (
            user_lat IS NULL OR user_lon IS NULL OR a.latitude IS NULL OR a.longitude IS NULL
            OR earth_distance(ll_to_earth(user_lat, user_lon), ll_to_earth(a.latitude, a.longitude)) <= radius_km * 1000
        )
    ORDER BY relevance DESC, distance_km ASC NULLS LAST, a.premium DESC, a.datePublication DESC;
END;
$$ LANGUAGE plpgsql;