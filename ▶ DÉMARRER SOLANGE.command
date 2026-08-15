#!/bin/zsh
# ============================================================
#  SOLANGE — démarre le site + l'app mobile.
#  👉 Double-clique ce fichier pour lancer.
# ============================================================
cd "$(dirname "$0")" || exit 1

echo "────────────────────────────────────────────"
echo "   SOLANGE — démarrage en cours…"
echo "────────────────────────────────────────────"

# Libère le port 3000 si un ancien serveur tourne déjà
lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null

# 1re fois : installe les dépendances
if [ ! -d "node_modules" ]; then
  echo "Installation des dépendances (1re fois, ~2 min)…"
  npm install --no-audit --no-fund
fi

# Construit l'app si nécessaire
if [ ! -d ".next" ]; then
  echo "Construction de l'app (~1 min)…"
  npm run build
fi

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "✅ SOLANGE est lancé !"
echo ""
echo "   • Sur ce Mac       →  http://localhost:3000"
echo "   • Sur ton iPhone   →  http://$IP:3000"
echo "     (le Mac et le téléphone doivent être sur le même réseau / partage de connexion)"
echo ""
echo "   Laisse cette fenêtre OUVERTE tant que tu utilises le site."
echo "   Pour arrêter : ferme cette fenêtre."
echo "────────────────────────────────────────────"

# Ouvre le site dans le navigateur du Mac
open "http://localhost:3000"

# Démarre le serveur (accessible aussi depuis le téléphone)
npx next start -H 0.0.0.0 -p 3000
