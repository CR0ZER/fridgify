#!/usr/bin/env bash
# Recompile la PWA et la publie dans la racine servie par nginx.
# A relancer après chaque modification du frontend.
#
#   ./deploy/deploy.sh
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBROOT=/var/www/fridgify

echo "==> Dépendances du frontend"
cd "$RACINE/frontend"
# `npm ci` efface et réinstalle tout node_modules : c'est de loin l'étape la
# plus lourde en E/S et en mémoire sur une Raspberry, et elle est inutile tant
# que le verrou n'a pas bougé. On mémorise son empreinte pour ne réinstaller
# qu'en cas de changement réel.
EMPREINTE="$(sha256sum package-lock.json | cut -d' ' -f1)"
TEMOIN="node_modules/.fridgify-lock"

if [[ ! -d node_modules || "$(cat "$TEMOIN" 2>/dev/null)" != "$EMPREINTE" ]]; then
  npm ci --no-audit --no-fund
  printf '%s' "$EMPREINTE" > "$TEMOIN"
else
  echo "    inchangées, réinstallation ignorée"
fi

echo "==> Compilation"
npm run build

echo "==> Publication vers $WEBROOT"
# --delete purge les anciens fichiers empreintés, sinon la racine grossit à
# chaque déploiement.
sudo rsync -a --delete "$RACINE/frontend/dist/" "$WEBROOT/"
sudo chown -R www-data:www-data "$WEBROOT"

echo "==> Redémarrage de l'API"
sudo systemctl restart fridgify-api

echo
echo "Déployé. Application disponible sur http://$(hostname -I | awk '{print $1}')/"
