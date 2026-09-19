#!/usr/bin/env bash
# Expose Fridgify en HTTPS sur le réseau Tailscale.
#
# Le HTTPS n'est pas un luxe ici : les notifications push et le mode hors ligne
# exigent tous deux un « contexte sécurisé », que le HTTP du réseau local ne
# fournit jamais. Tailscale règle les deux d'un coup, sans ouvrir le moindre
# port sur la box.
#
# On délègue le TLS à `tailscale serve` plutôt que de poser un certificat dans
# nginx : Tailscale renouvelle alors le certificat tout seul. Un certificat
# obtenu à la main via `tailscale cert` expire au bout de 90 jours et
# l'application tomberait en panne sans prévenir.
#
#   sudo ./deploy/tailscale.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être lancé avec sudo." >&2
  exit 1
fi

if ! command -v tailscale >/dev/null; then
  cat >&2 <<'AIDE'
Tailscale n'est pas installé. Installez-le puis relancez ce script :

  curl -fsSL https://tailscale.com/install.sh | sh
  sudo tailscale up

`tailscale up` affiche une URL à ouvrir dans un navigateur pour authentifier
cette machine : c'est une étape manuelle, elle ne peut pas être scriptée.
AIDE
  exit 1
fi

echo "==> État du démon Tailscale"
etat="$(tailscale status --json 2>/dev/null || echo '{}')"
backend="$(printf '%s' "$etat" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("BackendState",""))' 2>/dev/null || true)"

if [[ "$backend" != "Running" ]]; then
  echo "Tailscale n'est pas connecté (état : ${backend:-inconnu})." >&2
  echo "Lancez  sudo tailscale up  puis ouvrez l'URL affichée pour autoriser cette machine." >&2
  exit 1
fi

nom="$(printf '%s' "$etat" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
echo "    connecté sous le nom $nom"

echo "==> Publication de nginx en HTTPS"
# La syntaxe de `tailscale serve` a changé au fil des versions : on tente la
# forme actuelle, puis l'ancienne, avant d'abandonner en expliquant pourquoi.
if tailscale serve --bg http://127.0.0.1:80 2>/tmp/fridgify-serve.log; then
  echo "    publié"
elif tailscale serve https:443 / http://127.0.0.1:80 2>>/tmp/fridgify-serve.log; then
  echo "    publié (syntaxe historique)"
else
  echo "Échec de la publication :" >&2
  cat /tmp/fridgify-serve.log >&2
  cat >&2 <<'AIDE'

Cause la plus fréquente : les certificats HTTPS ne sont pas activés sur le
tailnet. Dans la console d'administration Tailscale, allez dans DNS, puis
activez MagicDNS et « HTTPS Certificates ». Relancez ensuite ce script.
AIDE
  exit 1
fi

echo
echo "==> Vérification"
tailscale serve status || true

echo
echo "Fridgify est joignable en HTTPS à cette adresse, depuis n'importe où :"
echo
echo "    https://$nom/"
echo
echo "C'est cette adresse — et non l'adresse en 192.168 — qu'il faut ajouter à"
echo "l'écran d'accueil du téléphone : les notifications n'existent qu'ici."
