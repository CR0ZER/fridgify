# Fridgify

Progressive Web App auto-hébergée sur Raspberry Pi. Voir `README.md` pour
l'architecture complète.

- **Backend** — FastAPI + SQLite, dans `backend/`. Toute la logique métier et
  les appels à Gemini vivent ici. Aucun secret ne doit descendre au navigateur.
- **Frontend** — React 18 + TypeScript + Vite, dans `frontend/`. CSS Modules
  pour les styles propres à un composant, `src/styles/ui.css` pour ce qui se
  répète. Le design system est dans `src/styles/theme.css`.
- **Interface et code en français** — libellés, noms de fonctions, commentaires
  et messages d'erreur, à l'image de l'existant.
- **Catégories** — liste fermée dans `backend/app/categories.py`, source unique
  du prompt de scan, du sélecteur et des DLC proposées. Ne jamais réintroduire de
  saisie libre.
- **Notifications** — Web Push, dans `app/push.py` (transport) et
  `app/notifications.py` (contenu de l'alerte quotidienne, lancée par le minuteur
  systemd). Exigent un contexte sécurisé : c'est le rôle de `deploy/tailscale.sh`.
  Le service worker traite le message dans `frontend/public/push-handler.js`, hors
  de `src/` puisqu'il s'exécute dans un contexte séparé de la page.
- **Tests** — `cd backend && .venv/bin/python -m pytest`. Toute logique métier
  ajoutée au backend doit venir avec ses tests.
- **Déploiement** — `./deploy/deploy.sh` recompile et publie. Ne jamais servir
  `frontend/dist` directement : nginx lit `/var/www/fridgify`.

L'application Expo/React Native d'origine est archivée dans `legacy/`. Elle
n'est plus compilée ni maintenue : ne pas y appliquer de correctifs.
