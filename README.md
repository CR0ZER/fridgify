<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="frontend/public/logo-sombre.png">
  <img src="frontend/public/logo-clair.png" alt="Frigo" width="96">
</picture>

# Frigo

**Le frigo qui prévient avant que ça périme.**

Inventaire du réfrigérateur, suivi des dates de péremption, plats à cuisiner et
liste de courses — une application web installable, auto-hébergée sur une
Raspberry Pi, qui envoie chaque matin l'alerte de ce qui doit partir en premier.

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry_Pi-A22846?style=flat-square&logo=raspberrypi&logoColor=white)
![Licence MIT](https://img.shields.io/badge/licence-MIT-1b211f?style=flat-square)

[Fonctionnalités](#fonctionnalités) ·
[Architecture](#architecture) ·
[Installation](#installation) ·
[Développement](#développement) ·
[API](#api)

</div>

<!-- Captures d'écran à venir : Frigo, détail d'un lot, Plats, Courses, en clair et en sombre. -->

## Pourquoi

Un yaourt oublié au fond du frigo ne prévient pas. Frigo tient l'inventaire
à jour, calcule ce qui presse et le dit — sans compte en ligne, sans
abonnement, sans que les données quittent la maison. Tout tourne sur une
Raspberry Pi ; le téléphone n'est qu'une fenêtre dessus.

## Fonctionnalités

**Un compte, un frigo.** Plusieurs personnes partagent le même serveur sans
jamais se croiser : inventaire, plats, courses, historique et notifications sont
cloisonnés par compte. Identifiant et mot de passe, session gardée sur
l'appareil, et Face ID ou empreinte à l'ouverture si le téléphone le propose.

**Inventaire par lots et par unités.** Un pack de 6 yaourts est un lot de 6
unités identiques. Le nom et la catégorie se règlent pour tout le lot ; la
date limite, l'ouverture et la sortie se gèrent unité par unité. Chaque lot
s'affiche au niveau de son unité la plus urgente.

**Trois niveaux d'urgence, lisibles d'un coup d'œil.** Rouge à un jour ou
moins, ambre entre deux et trois jours, vert au-delà. En tête d'inventaire,
une jauge résume l'état du frigo.

**Ouvrir, consommer, jeter.** Ouvrir un produit recalcule sa date limite selon
sa durée de conservation après ouverture. « Consommé » s'annule pendant quatre
secondes ; « jeté » et la suppression définitive demandent confirmation — la
seconde est réservée aux erreurs de saisie et n'entre pas dans les
statistiques.

**Dates proposées selon la catégorie.** Sept catégories fermées (laitage,
viande, poisson, légume, fruit, plat préparé, autre) proposent chacune une
date limite et une durée après ouverture. Une date corrigée à la main n'est
plus jamais écrasée.

**Scan de ticket de caisse.** Une photo du ticket suffit : le serveur en
extrait les produits frais avec Gemini, propose une date pour chacun, et rien
n'est enregistré sans validation ligne par ligne.

**Plats à préparer.** Un plat réserve des produits du frigo sans les
consommer. L'application calcule ce qui reste libre, la date avant laquelle
cuisiner, et signale quand le stock passe sous la quantité réservée. Préparer
le plat consomme les unités les plus urgentes et range les portions au frigo
comme un reste maison.

**Liste de courses.** Les plats qui font envie, avec ce qu'il faut acheter
pour les cuisiner. Volontairement indépendante du frigo.

**Alerte quotidienne.** Une notification Web Push chaque matin à 9 h pour ce
qui périme sous un jour ou est déjà périmé — rien si le frigo est sain.

**Historique.** Part consommée contre part jetée, produits les plus gaspillés
et dernières sorties.

**Thème clair et sombre.** Selon le téléphone, ou forcé dans les réglages.

**Installable et hors ligne.** Ajoutée à l'écran d'accueil de l'iPhone, elle
se comporte comme une application native.

## Architecture

```
Navigateur (iPhone, ordinateur…)
        │
        ├─ https://<nom>.<tailnet>.ts.net/   ← depuis partout, chiffré
        │        ▼
        │   tailscaled  :443 ── termine le TLS, renouvelle le certificat
        │        │
        └─ http://<ip-locale>/               ← réseau local, sans notifications
                 ▼
               nginx  :80 ──── sert /var/www/fridgify (build statique)
                 │
                 └──► /api/*  ── ajoute le header X-API-Key ──►  FastAPI :8000
                                                                      │
                                                                      ├─► SQLite
                                                                      ├─► API Gemini
                                                                      └─► services de push
                                                                          (Apple, Google)
```

- **Un seul processus permanent**, `fridgify-api` — les noms de services, de
  chemins et de fichiers sont restés tels quels après le renommage de
  l'application, pour ne pas casser une installation existante. Un minuteur systemd le
  rejoint une fois par jour, le temps d'envoyer l'alerte, puis s'arrête.
- **Le frontend est statique** : compilé une fois, servi par nginx. Aucun
  serveur Node ne tourne en production.
- **Toute la logique métier vit dans le backend**, couverte par des tests. Le
  navigateur n'affiche que ce que l'API calcule.
- **Tailscale n'est là que pour le HTTPS.** Les notifications et le mode hors
  ligne exigent un « contexte sécurisé » ; l'accès à distance n'en est qu'un
  effet de bord.

| Dossier     | Contenu                                                        |
| ----------- | -------------------------------------------------------------- |
| `backend/`  | API FastAPI, base SQLite, appels Gemini, notifications         |
| `frontend/` | PWA React + TypeScript, compilée par Vite                      |
| `deploy/`   | nginx, unités systemd, scripts d'installation et de Tailscale  |
| `legacy/`   | Application Expo d'origine, archivée pour référence            |

## Installation

Sur une Raspberry Pi (ou toute machine Debian) :

```bash
sudo apt-get install -y nginx nodejs npm python3-venv rsync
git clone https://github.com/CR0ZER/frigo.git && cd frigo
cp backend/.env.example backend/.env
```

Remplir `backend/.env` — au minimum `API_KEY` et, pour le scan de ticket,
`GEMINI_API_KEY`. Pour générer un secret :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Puis :

```bash
sudo ./deploy/install.sh   # venv, services systemd, site nginx, clés de notification
./deploy/deploy.sh         # compile le frontend et le publie
```

L'application répond alors sur `http://<ip-de-la-raspberry>/`. Créez enfin votre
compte — le premier créé hérite de l'inventaire qui existait avant les comptes :

```bash
cd backend && .venv/bin/python -m app.comptes creer <identifiant>
```

### Activer le HTTPS et les notifications

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up            # affiche une URL pour autoriser la machine
sudo ./deploy/tailscale.sh   # publie nginx en HTTPS et affiche l'adresse
```

Dans la console d'administration Tailscale, section **DNS**, activer une fois
pour toutes MagicDNS et « HTTPS Certificates ». Le certificat est ensuite
renouvelé automatiquement par `tailscaled`.

### Installer sur iPhone

1. Installer Tailscale depuis l'App Store et rejoindre le même tailnet.
2. Ouvrir **l'adresse HTTPS** dans Safari, puis Partager → « Sur l'écran
   d'accueil ».
3. Ouvrir Frigo depuis son icône et activer l'alerte dans Réglages.

iOS ne donne accès aux notifications qu'aux applications ajoutées à l'écran
d'accueil, et depuis l'adresse HTTPS : celle en `http://` reste utilisable
comme secours, sans notifications.

### Au quotidien

| Action                                 | Commande                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| Mettre à jour                          | `git pull && ./deploy/deploy.sh`                           |
| Redémarrer l'API (après un changement backend) | `sudo systemctl restart fridgify-api`              |
| Journaux de l'API                      | `journalctl -u fridgify-api -f`                            |
| Prochaine alerte programmée            | `systemctl list-timers fridgify-notifications.timer`       |
| Prévisualiser l'alerte sans l'envoyer  | `cd backend && .venv/bin/python -m app.notifications --simuler` |
| Forcer l'envoi de l'alerte du jour     | `cd backend && .venv/bin/python -m app.notifications --force` |
| Lister les comptes                     | `cd backend && .venv/bin/python -m app.comptes lister`     |
| Réinitialiser un mot de passe          | `cd backend && .venv/bin/python -m app.comptes mot-de-passe <identifiant>` |

Sauvegarder la base (la Raspberry n'a pas besoin de l'outil `sqlite3`) :

```bash
cd backend && .venv/bin/python -c "import sqlite3; sqlite3.connect('data/fridgify.db').backup(sqlite3.connect('sauvegarde.db'))"
```

## Développement

```bash
# API, avec rechargement automatique
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env        # API_KEY : n'importe quelle valeur en local
.venv/bin/uvicorn app.main:app --reload

# Frontend, dans un second terminal
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Le serveur Vite relaie `/api` vers le port 8000 en ajoutant lui-même la clé
lue dans `backend/.env`, comme nginx en production. Sous Windows, remplacer
`.venv/bin/` par `.venv\Scripts\`.

### Tests

```bash
cd backend && .venv/bin/python -m pytest
```

La suite couvre la logique métier : cycle de vie d'un produit, réservation et
préparation d'un plat, liste de courses, fermeture des catégories, lecture de
la réponse de Gemini, sélection et formulation des alertes, purge des
abonnements expirés. Elle tourne sur une base temporaire et simule tous les
envois : aucun test ne touche la production ni un service externe.

### Conventions

Interface et code sont en français. Les couleurs ne vivent que dans
`frontend/src/styles/theme.css`, sous forme de variables pour les deux
palettes. Le détail est dans [`AGENTS.md`](AGENTS.md).

## API

Documentation interactive générée par FastAPI : `http://<ip>:8000/docs`.

Deux gardes se succèdent. Le header `X-API-Key`, ajouté par nginx, dit que la
requête vient d'un appareil autorisé ; il protège le port 8000, joignable depuis
tout le réseau local. La **session** dit ensuite de quel compte il s'agit, et
donc quel frigo répond. Seul `/api/health` se passe des deux.

Une machine — l'écran d'affichage du salon, un script — présente à la place un
**jeton de service**, créé sur le serveur et rattaché à un compte :

```bash
cd backend && .venv/bin/python -m app.comptes jeton florian "Écran du salon"
curl -H "X-API-Key: $CLE" -H "X-Service-Token: $JETON" http://<ip>:8000/api/produits
```

<details>
<summary><b>Points d'entrée</b></summary>

| Méthode             | Chemin                          | Rôle                                         |
| ------------------- | ------------------------------- | -------------------------------------------- |
| `GET`               | `/api/health`                   | Sonde, sans clé                              |
| `POST`              | `/api/auth/inscription`         | Crée un compte et ouvre sa session           |
| `POST`              | `/api/auth/connexion`           | Ouvre une session (cookie)                   |
| `POST`              | `/api/auth/deconnexion`         | Ferme la session                             |
| `GET`               | `/api/auth/moi`                 | Le compte connecté et la taille de son frigo |
| `GET`               | `/api/produits`                 | Inventaire actif, trié par urgence           |
| `DELETE`            | `/api/produits`                 | Vide le frigo                                |
| `PATCH` / `DELETE`  | `/api/produits/{id}`            | Modifie / supprime une unité                 |
| `POST`              | `/api/produits/{id}/ouvrir`     | Marque ouverte et recalcule la date limite   |
| `POST` / `DELETE`   | `/api/produits/{id}/statut`     | Consommée ou jetée / annule la sortie        |
| `POST`              | `/api/lots`                     | Crée un lot de *n* unités                    |
| `GET` / `PATCH`     | `/api/lots/{lot_id}`            | Lit / renomme et recatégorise un lot         |
| `GET`               | `/api/categories`               | Catégories et durées de conservation         |
| `GET` / `POST`      | `/api/plats`                    | Plats prévus et préparés / nouveau plat      |
| `GET` / `PATCH` / `DELETE` | `/api/plats/{id}`        | Lit / modifie / annule un plat               |
| `POST`              | `/api/plats/{id}/preparer`      | Consomme les réservations, range les portions |
| `GET`               | `/api/disponibilites`           | Ce que chaque lot peut encore fournir        |
| `GET` / `POST`      | `/api/courses`                  | Liste de courses                             |
| `PATCH` / `DELETE`  | `/api/courses/{id}`             | Modifie / retire une envie                   |
| `POST` / `DELETE`   | `/api/courses/{id}/achat`       | Marque achetée / remet dans la liste         |
| `DELETE`            | `/api/courses/achetes`          | Retire tout ce qui est acheté                |
| `GET`               | `/api/stats`                    | Statistiques et dernières sorties            |
| `GET` / `PUT` / `DELETE` | `/api/settings/{clé}`      | Prompt de scan personnalisé                  |
| `POST`              | `/api/llm/scan`                 | Photo de ticket → produits détectés          |
| `GET`               | `/api/push/etat`                | Clé publique et appareils abonnés            |
| `POST` / `DELETE`   | `/api/push/abonnements`         | Abonne / désabonne un appareil               |
| `POST`              | `/api/push/test`                | Envoie l'alerte du jour immédiatement        |

</details>

## Sécurité et vie privée

- **Aucun secret dans le navigateur.** La clé Gemini ne quitte pas le serveur ;
  la clé d'API est ajoutée par nginx et n'apparaît pas dans le JavaScript
  servi.
- **Mots de passe hachés avec `scrypt`**, sel par compte, comparaison en temps
  constant. Trois essais ratés bloquent la connexion une minute.
- **Session dans un cookie `httpOnly`**, inaccessible au JavaScript, marqué
  `Secure` dès que la page est servie en HTTPS et `SameSite=Lax` pour couper les
  requêtes venues d'un autre site.
- **Frigos cloisonnés.** Chaque requête est filtrée par compte jusque dans le
  SQL ; un identifiant deviné ne donne rien. Le scan de ticket est plafonné à
  cinq par compte et par jour, la clé Gemini étant partagée.
- **Aucune donnée dans le cloud.** L'inventaire vit dans un fichier SQLite sur
  la Raspberry. Seule la photo d'un ticket est envoyée à Gemini, au moment du
  scan.
- **Notifications chiffrées de bout en bout.** Apple et Google relaient les
  messages sans pouvoir les lire ; la clé VAPID privée reste sur le serveur.
- **Aucun port ouvert sur la box.** L'accès à distance passe par Tailscale.

## Licence

[MIT](LICENSE) © Florian Huillet
