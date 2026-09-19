#!/usr/bin/env bash
# Installation unique de Fridgify sur la Raspberry. A relancer sans risque :
# le script est idempotent.
#
#   sudo ./deploy/install.sh
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBROOT=/var/www/fridgify
SNIPPET=/etc/nginx/snippets/fridgify-api-key.conf

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être lancé avec sudo." >&2
  exit 1
fi

if [[ ! -f "$RACINE/backend/.env" ]]; then
  echo "backend/.env est absent. Copiez backend/.env.example et remplissez-le." >&2
  exit 1
fi

echo "==> Vérification des dépendances système"
manquants=()
for binaire in nginx node npm python3 rsync; do
  command -v "$binaire" >/dev/null || manquants+=("$binaire")
done
if (( ${#manquants[@]} )); then
  echo "Manquant : ${manquants[*]}. Installez-les avec :" >&2
  echo "  sudo apt-get install -y nginx nodejs npm python3-venv" >&2
  exit 1
fi

echo "==> Environnement Python du backend"
PROPRIETAIRE="$(stat -c %U "$RACINE")"
if [[ ! -x "$RACINE/backend/.venv/bin/uvicorn" ]]; then
  # Cree en tant que proprietaire du dossier, sinon le venv appartiendrait a
  # root alors que le service tourne sous un compte utilisateur.
  runuser -u "$PROPRIETAIRE" -- python3 -m venv "$RACINE/backend/.venv"
  runuser -u "$PROPRIETAIRE" -- "$RACINE/backend/.venv/bin/pip" install --quiet \
    --upgrade pip
  runuser -u "$PROPRIETAIRE" -- "$RACINE/backend/.venv/bin/pip" install --quiet \
    -r "$RACINE/backend/requirements.txt"
  echo "    venv créé pour $PROPRIETAIRE"
else
  echo "    déjà présent"
fi

echo "==> Clés de notification (VAPID)"
# Generees ici plutot que demandees a l'utilisateur : ce sont des secrets sans
# valeur en dehors de cette installation. Les regenerer invaliderait tous les
# abonnements existants, on ne touche donc a rien si elles sont deja la.
if grep -q '^VAPID_PRIVATE_KEY=.\+' "$RACINE/backend/.env"; then
  echo "    déjà présentes"
else
  runuser -u "$PROPRIETAIRE" -- "$RACINE/backend/.venv/bin/python" -m app.push \
    >> "$RACINE/backend/.env"
  echo "    générées et ajoutées à backend/.env"
fi

echo "==> Service systemd fridgify-api"
install -m 644 "$RACINE/deploy/systemd/fridgify-api.service" \
  /etc/systemd/system/fridgify-api.service
systemctl daemon-reload
systemctl enable --now fridgify-api

echo "==> Minuteur d'alerte quotidienne"
install -m 644 "$RACINE/deploy/systemd/fridgify-notifications.service" \
  /etc/systemd/system/fridgify-notifications.service
install -m 644 "$RACINE/deploy/systemd/fridgify-notifications.timer" \
  /etc/systemd/system/fridgify-notifications.timer
systemctl daemon-reload
systemctl enable --now fridgify-notifications.timer
echo "    prochaine exécution : $(systemctl show -p NextElapseUSecRealtime --value fridgify-notifications.timer 2>/dev/null || echo 'voir systemctl list-timers')"

echo "==> Injection de la clé API dans nginx"
CLE="$(grep -oP '^API_KEY=\K.*' "$RACINE/backend/.env" | tr -d '\r')"
if [[ -z "$CLE" ]]; then
  echo "API_KEY est vide dans backend/.env." >&2
  exit 1
fi
mkdir -p /etc/nginx/snippets
# 640 root:root : nginx lit sa configuration en tant que root, personne d'autre
# n'a besoin de voir ce secret.
printf 'proxy_set_header X-API-Key "%s";\n' "$CLE" > "$SNIPPET"
chmod 640 "$SNIPPET"
chown root:root "$SNIPPET"

echo "==> Racine web $WEBROOT"
# Le build est copié hors de /home : le dossier personnel est en 700, www-data
# ne peut pas le traverser, et servir directement un répertoire de travail
# n'est de toute façon pas souhaitable.
mkdir -p "$WEBROOT"
chown -R www-data:www-data "$WEBROOT"

echo "==> Site nginx"
install -m 644 "$RACINE/deploy/nginx/fridgify.conf" /etc/nginx/sites-available/fridgify
ln -sfn /etc/nginx/sites-available/fridgify /etc/nginx/sites-enabled/fridgify
# Le site par défaut de Debian revendique lui aussi default_server sur le port 80.
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

echo
echo "Installation terminée."
echo "Déployez maintenant le front avec :  ./deploy/deploy.sh"
