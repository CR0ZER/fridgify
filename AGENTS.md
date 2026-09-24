# Frigo

Progressive Web App auto-hébergée sur Raspberry Pi. Voir `README.md` pour
l'architecture complète.

- **Backend** — FastAPI + SQLite, dans `backend/`. Toute la logique métier et
  les appels à Gemini vivent ici. Aucun secret ne doit descendre au navigateur.
- **Frontend** — React 18 + TypeScript + Vite, dans `frontend/`. CSS Modules
  pour les styles propres à un composant, `src/styles/ui.css` pour ce qui se
  répète (boutons, champs, compteurs, étiquettes). Les couleurs ne vivent que
  dans `src/styles/theme.css`, en variables : palette claire et palette sombre.
  Ne jamais écrire une couleur en dur ailleurs, sinon l'un des deux thèmes casse.
- **Design** — référence unique : la maquette Claude Design `Fridgify.dc.html`
  et sa « Palette sombre ». Urgence en couleur (`components/Urgence.tsx`) : rouge
  ≤ 1 jour, ambre 2-3 jours, vert au-delà, gris sans date. Polices Bricolage
  Grotesque et Martian Mono, auto-hébergées dans `src/fonts/` (sous-ensemble
  latin) pour rester disponibles hors ligne.
- **Thème** — clair, sombre ou « selon le téléphone », choisi dans Réglages
  (`utils/theme.ts`, dupliqué en ligne dans `index.html` pour éviter un flash).
- **Comptes** — un compte, un frigo. Toute requête qui touche à des données
  passe par `Depends(utilisateur_courant)` et filtre son SQL sur
  `utilisateur_id` : sans ce filtre, un identifiant deviné ouvre le frigo du
  voisin. Mots de passe, sessions et jetons de service vivent dans
  `backend/app/comptes.py`, les gardes dans `backend/app/auth.py`.
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
