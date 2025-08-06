# 🚀 Petites Annonces CI - Plateforme Révolutionnaire

> La plateforme de petites annonces la plus moderne de Côte d'Ivoire et d'Afrique de l'Ouest

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node->=18.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.3+-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-14.0+-black.svg)

## ✨ Caractéristiques Révolutionnaires

### 🎯 **Interface Utilisateur Next-Gen**
- **Design Moderne** : Interface inspirée des meilleures plateformes mondiales
- **PWA Mobile-First** : Application web progressive optimisée mobile
- **Dark/Light Mode** : Thème adaptatif pour tous les utilisateurs
- **Animations Fluides** : Transitions et micro-interactions professionnelles
- **Performance Maximale** : Temps de chargement < 1 seconde

### 🔧 **Technologies de Pointe**
- **Backend** : Node.js + TypeScript + Express + PostgreSQL + Redis
- **Frontend** : Next.js 14 + TypeScript + Tailwind CSS + Framer Motion
- **Architecture** : Microservices + API REST/GraphQL + WebSocket
- **Cloud** : Docker + AWS/Vercel + CDN Global
- **Paiements** : Stripe + Orange Money + Wave + Moov Money

### 🌍 **Spécialisé Côte d'Ivoire & Afrique**
- **Géolocalisation** : Toutes les régions et communes de CI
- **Paiements Mobiles** : Intégration complète Orange Money, Wave, Moov
- **SMS Locaux** : Notifications via opérateurs ivoiriens
- **Multilingue** : Français + Anglais + langues locales
- **Optimisé Mobile** : Adapté aux connexions 3G/4G africaines

## 🚀 Installation Rapide

### Prérequis
- Node.js >= 18.0.0
- Docker & Docker Compose
- Git

### Démarrage en 3 minutes

```bash
# 1. Cloner le projet
git clone https://github.com/votre-username/petites-annonces-ci-pro.git
cd petites-annonces-ci-pro

# 2. Installation des dépendances
npm run setup

# 3. Démarrer l'environnement de développement
npm run dev
```

🎉 **Votre site est accessible sur :**
- Frontend : http://localhost:3000
- Backend API : http://localhost:5000
- Base de données : http://localhost:8080 (Adminer)

## 📁 Structure du Projet

```
petites-annonces-ci-pro/
├── backend/          # API Node.js + TypeScript + PostgreSQL
├── frontend/         # Next.js 14 + TypeScript + Tailwind
├── shared/           # Types et utilitaires partagés
├── database/         # Migrations et seeds
├── docs/            # Documentation
└── scripts/         # Scripts de déploiement
```

## 🎯 Fonctionnalités Principales

### 👥 **Gestion Utilisateurs**
- ✅ Inscription/Connexion sécurisée
- ✅ Profils particuliers et professionnels
- ✅ Vérification SMS/Email
- ✅ Système d'avis et notation
- ✅ Dashboard personnel complet

### 📢 **Annonces Avancées**
- ✅ Upload d'images optimisées (Cloudinary)
- ✅ Catégorisation intelligente
- ✅ Géolocalisation précise
- ✅ Recherche et filtres avancés
- ✅ Favoris et alertes

### 💬 **Communication**
- ✅ Messagerie temps réel (WebSocket)
- ✅ Notifications push
- ✅ Intégration WhatsApp
- ✅ Partage réseaux sociaux

### 💰 **Paiements & Monétisation**
- ✅ Paiements sécurisés Stripe
- ✅ Orange Money / Wave / Moov
- ✅ Annonces sponsorisées
- ✅ Abonnements premium
- ✅ Commission sur ventes

## 🛠 Scripts Disponibles

### Développement
```bash
npm run dev              # Démarrer backend + frontend
npm run dev:backend      # Backend seulement  
npm run dev:frontend     # Frontend seulement
```

### Build & Test
```bash
npm run build           # Build production
npm run test            # Tests complets
npm run lint            # Vérification code
```

### Base de Données
```bash
npm run db:migrate      # Migrations
npm run db:seed         # Données de test
npm run db:studio       # Interface graphique
```

### Docker
```bash
npm run docker:up       # Démarrer containers
npm run docker:down     # Arrêter containers
```

## 🌐 Déploiement

### Environnements Supportés
- **Development** : Docker local
- **Staging** : Vercel + Supabase
- **Production** : AWS + CloudFront + RDS

### Variables d'Environnement
```env
# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret-key
CLOUDINARY_API_KEY=your-key

# Frontend
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_SITE_URL=https://example.com
```

## 📊 Performance & Monitoring

- **Lighthouse Score** : 95+ sur tous les critères
- **Core Web Vitals** : Optimisé Google
- **Analytics** : Vercel Analytics + Google Analytics
- **Monitoring** : Sentry + Winston Logs
- **SEO** : Next-SEO + Sitemap automatique

## 🤝 Contribution

1. Fork le projet
2. Créer une branche : `git checkout -b feature/amazing-feature`
3. Commit : `git commit -m 'Add amazing feature'`
4. Push : `git push origin feature/amazing-feature`
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙋‍♂️ Support

- **Documentation** : [docs/](docs/)
- **Issues** : [GitHub Issues](https://github.com/votre-username/petites-annonces-ci-pro/issues)
- **Email** : support@petites-annonces-ci.com

## 🎉 Roadmap

### Version 1.0 (Actuelle)
- ✅ Plateforme complète web
- ✅ Paiements mobiles CI
- ✅ Géolocalisation avancée

### Version 1.5 (Q2 2024)
- 📱 Application mobile React Native
- 🤖 Intelligence artificielle pour recommandations
- 🌍 Expansion Mali, Burkina Faso, Sénégal

### Version 2.0 (Q4 2024)
- 🛒 Marketplace intégré
- 🚚 Système de livraison
- 💼 Solutions B2B entreprises

---

**Fait avec ❤️ en Côte d'Ivoire pour l'Afrique** 🇨🇮