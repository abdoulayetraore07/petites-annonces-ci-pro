import app from './app';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 API disponible sur: http://localhost:${PORT}`);
  console.log(`🔧 Health check: http://localhost:${PORT}/health`);
});

// Gestion propre de l'arrêt du serveur
process.on('SIGTERM', () => {
  console.log('💀 Signal SIGTERM reçu');
  server.close(() => {
    console.log('🛑 Serveur fermé proprement');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('💀 Signal SIGINT reçu (Ctrl+C)');
  server.close(() => {
    console.log('🛑 Serveur fermé proprement');
    process.exit(0);
  });
});

export default server;