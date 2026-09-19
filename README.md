# Fridgify

Inventaire du réfrigérateur, suivi des dates de péremption et liste de courses.
Progressive Web App auto-hébergée sur une Raspberry Pi, qui prévient
quand quelque chose va périmer. Accessible depuis le réseau local, et depuis
n'importe où par Tailscale.

## Architecture

```
Navigateur (iPhone, ordinateur…)
        │
        ├─ https://<nom>.<tailnet>.ts.net/   ← depuis partout, chiffré
        │        ▼
        │   tailscaled  :443 ── termine le TLS, renouvelle le certificat
        │        │
        └─ http://192.168.1.32/  ← réseau local, sans notifications
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

Les notifications et le mode hors ligne n'existent que sur le chemin HTTPS : les
navigateurs les réservent aux « contextes sécurisés ». C'est la seule raison
d'être de Tailscale ici — l'accès à distance n'en est qu'un effet de bord.

Un seul processus applicatif tourne en permanence : `fridgify-api`. Un minuteur
systemd, `fridgify-notifications.timer`, s'y ajoute une fois par jour le temps
d'envoyer l'alerte de péremption, puis s'arrête. Le frontend est un ensemble de
fichiers statiques compilés une fois et servis par nginx — il n'y a donc aucun
serveur de développement à maintenir en vie.

| Dossier     | Contenu                                                    |
| ----------- | ---------------------------------------------------------- |
| `backend/`  | API FastAPI, base SQLite, appels Gemini                     |
| `frontend/` | PWA React + TypeScript, compilée par Vite                   |
| `deploy/`   | nginx, unités systemd, scripts d'installation et de Tailscale |
| `legacy/`   | Application Expo/React Native d'origine, conservée pour référence |

## Installation

Sur une machine neuve :

```bash
sudo apt-get install -y nginx nodejs npm python3-venv rsync
cp backend/.env.example backend/.env
```

Remplir `backend/.env` — au minimum `GEMINI_API_KEY` et `API_KEY`. Les clés de
notification sont générées par le script d'installation. Pour générer un secret :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Puis :

```bash
sudo ./deploy/install.sh   # venv, services systemd, site nginx, clés
./deploy/deploy.sh         # compile le frontend et le publie
```

L'application est alors disponible sur `http://<ip-de-la-raspberry>/`.

Pour les notifications, il reste à activer le HTTPS :

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up          # affiche une URL à ouvrir pour autoriser la machine
sudo ./deploy/tailscale.sh # publie nginx en HTTPS et affiche l'adresse à utiliser
```

## Utilisation quotidienne

| Action                                   | Commande                        |
| ---------------------------------------- | ------------------------------- |
| Redéployer après modification du frontend | `./deploy/deploy.sh`            |
| Redémarrer l'API                          | `sudo systemctl restart fridgify-api` |
| Consulter les journaux de l'API           | `journalctl -u fridgify-api -f` |
| Recharger nginx                           | `sudo systemctl reload nginx`   |
| Voir la prochaine alerte de péremption    | `systemctl list-timers fridgify-notifications.timer` |
| Tester l'alerte sans l'envoyer            | `cd backend && .venv/bin/python -m app.notifications --simuler` |
| Forcer l'envoi de l'alerte du jour        | `cd backend && .venv/bin/python -m app.notifications --force` |
| Consulter le journal des alertes          | `journalctl -u fridgify-notifications -f` |

L'API, nginx et le minuteur sont activés au démarrage : ils survivent aux
redémarrages de la Raspberry.

## Installer la PWA sur iPhone

Installez Tailscale depuis l'App Store, connectez-vous au même tailnet que la
Raspberry, et laissez le VPN actif — il ne consomme presque rien et route en
direct quand les deux appareils sont sur le même réseau.

Ouvrez ensuite **l'adresse HTTPS** dans Safari, puis Partager → « Sur l'écran
d'accueil ».

```
https://<nom>.<tailnet>.ts.net/
```

**C'est l'adresse HTTPS qu'il faut installer, pas celle en `192.168`.** Pour un
navigateur, ce sont deux sites distincts : l'icône posée depuis l'adresse locale
reste une application séparée, sans notification ni hors ligne, avec son propre
stockage. Si vous avez déjà installé l'ancienne, supprimez son icône pour ne pas
entretenir deux applications côte à côte.

Ouvrez enfin Fridgify **depuis son icône** et activez les notifications dans
Réglages. Sous iOS, une page ouverte dans un onglet Safari n'a pas accès au push :
seule une application ajoutée à l'écran d'accueil l'obtient. L'écran de réglages
détecte ce cas et vous le dit plutôt que d'afficher un bouton inerte.

L'adresse locale `http://192.168.1.32/` continue de fonctionner comme avant, sans
notifications : gardez-la comme secours si Tailscale est en panne.

## Appeler l'API directement

FastAPI écoute sur le port 8000, joignable depuis tout le réseau local. Chaque
requête doit porter le secret défini dans `backend/.env` :

```bash
curl -H "X-API-Key: $VOTRE_CLE" http://192.168.1.32:8000/api/produits
```

Documentation interactive générée automatiquement :
`http://192.168.1.32:8000/docs`

Seul `/api/health` répond sans clé — il sert de sonde et indique ce qui est
configuré côté serveur.

### Points d'entrée principaux

| Méthode  | Chemin                    | Rôle                                        |
| -------- | ------------------------- | ------------------------------------------- |
| `GET`    | `/api/produits`           | Inventaire actif, trié par urgence          |
| `DELETE` | `/api/produits`           | Vide le frigo                               |
| `POST`   | `/api/lots`               | Crée *n* unités partageant un même lot      |
| `PATCH`  | `/api/lots/{lot_id}`      | Renomme / recatégorise tout un lot          |
| `PATCH`  | `/api/produits/{id}`      | Modifie une unité                           |
| `POST`   | `/api/produits/{id}/ouvrir` | Marque ouvert et recalcule la DLC         |
| `POST`   | `/api/produits/{id}/statut` | `{"statut": "consomme" \| "jete"}`        |
| `DELETE` | `/api/produits/{id}/statut` | Annule la clôture                         |
| `GET`    | `/api/stats`              | Statistiques et derniers mouvements         |
| `GET/PUT/DELETE` | `/api/settings/{clé}` | Prompts personnalisés                   |
| `POST`   | `/api/llm/scan`           | Photo de ticket → produits détectés         |
| `GET/POST` | `/api/courses`          | Liste de courses : envies de plats          |
| `PATCH/DELETE` | `/api/courses/{id}` | Modifie / retire une envie                  |
| `POST`   | `/api/courses/{id}/achat` | Marque acheté                               |
| `DELETE` | `/api/courses/{id}/achat` | Remet dans la liste                         |
| `DELETE` | `/api/courses/achetes`    | Retire tout ce qui est acheté               |
| `GET`    | `/api/push/etat`          | Clé publique VAPID et appareils abonnés     |
| `POST`   | `/api/push/abonnements`   | Abonne cet appareil aux notifications       |
| `DELETE` | `/api/push/abonnements`   | Désabonne un appareil                       |
| `POST`   | `/api/push/test`          | Envoie l'alerte du jour immédiatement       |

## Tests

```bash
cd backend
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest
```

La suite couvre la logique métier du backend : cycle de vie d'un produit,
réservation et préparation d'un plat, liste de courses, fermeture des catégories, extraction du
JSON renvoyé par Gemini, et les notifications — sélection des produits urgents,
formulation, garde-fou du jour et purge des abonnements expirés. Les envois y
sont toujours simulés : aucun test ne joint un service de push. Elle tourne sur une base temporaire, jamais sur celle de
production.

## Catégories et durées de conservation

`backend/app/categories.py` est la source unique : la liste déroulante de
l'interface, le prompt de scan et les DLC proposées en découlent tous. Ajouter
une catégorie là la fait apparaître partout.

Les durées ne servent qu'à **proposer** une date à la saisie ; elle reste
modifiable produit par produit, et une date corrigée à la main n'est jamais
réécrite par un changement de catégorie.

Les valeurs hors liste — celles que Gemini renvoie parfois malgré la consigne,
comme « Légumes » — sont rattachées à la catégorie canonique, et retombent sur
« Autre » si elles restent inconnues.

## Développement

```bash
# Terminal 1 — API avec rechargement automatique
cd backend && .venv/bin/uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Le serveur de développement Vite écoute sur le port 5173 et relaie `/api` vers
le port 8000 en ajoutant lui-même la clé, comme le fait nginx en production.

## Sécurité

- La clé Gemini ne vit que dans `backend/.env`, côté serveur. Elle n'est jamais
  envoyée au navigateur — contrairement à la version Expo, où `EXPO_PUBLIC_…`
  l'embarquait dans le bundle.
- La clé d'API est injectée par nginx dans le relais `/api`. Le JavaScript servi
  au navigateur ne la contient pas.
- `backend/.env` et le fichier de base de données sont exclus du dépôt.
- La clé VAPID **privée** reste sur le serveur ; seule la publique descend au
  navigateur, ce qui est sa fonction : elle ne permet que de vérifier que les
  notifications viennent bien de ce serveur.
- Le contenu des notifications est chiffré de bout en bout. Apple et Google
  relaient les messages sans pouvoir les lire.

## HTTPS par Tailscale

`deploy/tailscale.sh` publie nginx en HTTPS avec `tailscale serve`. Le TLS est
terminé par `tailscaled`, qui obtient le certificat et **le renouvelle seul**.

C'est la raison du choix : un certificat posé à la main dans nginx via
`tailscale cert` expire au bout de 90 jours, et l'application tomberait alors en
panne sans prévenir — en emportant les notifications avec elle. Rien à ajouter
dans la configuration nginx, et aucun port ouvert sur la box.

Deux réglages sont nécessaires une fois pour toutes dans la console
d'administration Tailscale, sous **DNS** : activer MagicDNS et « HTTPS
Certificates ». Sans eux, `tailscale serve` refuse de démarrer ; le script le
détecte et l'indique.

Vérifier l'état à tout moment :

```bash
tailscale serve status
```

L'application ne nécessitait aucune adaptation : elle n'utilise que des chemins
relatifs (`/api`), nginx répond sur `server_name _`, et le CORS est réglé par
variable d'environnement.

## Notifications de péremption

Une alerte par jour à 9 h, pour ce qui périme sous `NOTIFICATION_SEUIL_JOURS`
jours ou est déjà périmé. Rien ne part si le frigo est sain.

Trois pièces :

| Pièce | Rôle |
| --- | --- |
| `app/push.py` | Transport : signature VAPID, chiffrement, purge des abonnements morts |
| `app/notifications.py` | Contenu : sélection des produits urgents et formulation |
| `fridgify-notifications.timer` | Déclenchement quotidien, `Persistent=true` |

Le minuteur est `Persistent=true` : une Raspberry éteinte à 9 h envoie l'alerte
dès son allumage au lieu de sauter la journée. Un marqueur en base empêche qu'un
redémarrage le même jour renotifie — et il n'est posé que si un appareil a
réellement reçu l'alerte, pour qu'une panne réseau reste rattrapable.

Un abonnement que le service de push déclare expiré (404 ou 410) est supprimé
automatiquement : c'est la seule façon d'apprendre qu'une application a été
désinstallée, le navigateur ne prévenant personne.

Vérifier la formulation sans rien envoyer :

```bash
cd backend && .venv/bin/python -m app.notifications --simuler
```

## Liste de courses

L'onglet Courses note des **plats qui font envie**, avec en option ce qu'il faut
acheter pour les cuisiner. Chaque envie est *à acheter* puis *achetée*, sur le
modèle des plats *à préparer* / *préparés* ; un achat coché par erreur se remet
dans la liste.

La liste est volontairement détachée du reste : une envie achetée ne crée ni
produit dans le frigo, ni plat à préparer.

## Ce que la version web ne reprend pas

- **Génération de recettes par IA.** Retirée au profit de la liste de courses :
  Gemini ne sert plus qu'au scan de ticket.
- **Sélecteur de fournisseur IA.** L'option Groq levait une exception à chaque
  usage : elle n'a jamais été implémentée. Le modèle se règle désormais par
  `GEMINI_MODEL` dans `backend/.env`.
- **Sauvegarde automatique de la base.** Pas encore mise en place. Une copie
  ponctuelle se fait avec :
  `sqlite3 backend/data/fridgify.db ".backup sauvegarde.db"`.
