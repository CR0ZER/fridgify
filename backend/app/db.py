import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

from .config import get_settings

SCHEMA = """
-- Un compte, un frigo. Toutes les tables de donnees portent un utilisateur_id :
-- c'est la seule chose qui separe deux inventaires sur le meme serveur.
CREATE TABLE IF NOT EXISTS utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- NOCASE : « Lea » et « lea » sont le meme compte, on ne veut pas de sosies.
    identifiant TEXT NOT NULL UNIQUE COLLATE NOCASE,
    mot_de_passe TEXT NOT NULL,
    date_creation TEXT NOT NULL,
    derniere_connexion TEXT
);

-- Sessions ouvertes. Le jeton n'est stocke que hache : une copie de la base ne
-- permet pas de se faire passer pour quelqu'un.
CREATE TABLE IF NOT EXISTS sessions (
    jeton TEXT PRIMARY KEY,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    date_creation TEXT NOT NULL,
    expiration TEXT NOT NULL,
    appareil TEXT
);

-- Jetons de machine a machine : un ecran d'affichage agit sur le frigo de son
-- proprietaire sans ouvrir de session ni connaitre son mot de passe.
CREATE TABLE IF NOT EXISTS jetons_service (
    jeton TEXT PRIMARY KEY,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    libelle TEXT NOT NULL,
    date_creation TEXT NOT NULL,
    dernier_acces TEXT
);

-- Compteur de scans : la cle Gemini est partagee entre tous les comptes.
CREATE TABLE IF NOT EXISTS scans_journaliers (
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    jour TEXT NOT NULL,
    nombre INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (utilisateur_id, jour)
);

-- Reglages propres a un compte : prompt de scan, marqueur de la derniere
-- alerte envoyee. Remplace l'ancienne table `settings`, qui etait globale.
CREATE TABLE IF NOT EXISTS reglages (
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    cle TEXT NOT NULL,
    valeur TEXT,
    PRIMARY KEY (utilisateur_id, cle)
);

CREATE TABLE IF NOT EXISTS inventaire_frigo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    categorie TEXT,
    date_achat TEXT,
    est_ouvert INTEGER DEFAULT 0,
    duree_apres_ouverture INTEGER,
    date_peremption_effective TEXT,
    est_un_reste INTEGER DEFAULT 0,
    lot_id TEXT,
    statut_fin TEXT,
    date_fin TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventaire_statut ON inventaire_frigo (utilisateur_id, statut_fin);
CREATE INDEX IF NOT EXISTS idx_inventaire_lot ON inventaire_frigo (lot_id);

-- Un plat prevu reserve une partie du stock. Tant qu'il n'est pas prepare, rien
-- n'est consomme : la reservation ne fait que documenter l'intention et permet
-- de distinguer ce qui est deja affecte de ce qui reste libre.
CREATE TABLE IF NOT EXISTS plats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    note TEXT,
    statut TEXT NOT NULL DEFAULT 'prevu',
    date_creation TEXT NOT NULL,
    date_preparation TEXT,
    lot_resultat TEXT
);

-- La reservation porte sur le lot, pas sur l'unite : c'est le lot que
-- l'utilisateur manipule dans l'inventaire. Quelles unites concretes seront
-- prises n'est decide qu'au moment de la preparation. `quantite` est un nombre
-- d'unites entieres : une unite est consommee en entier ou pas du tout.
CREATE TABLE IF NOT EXISTS plat_ingredients (
    plat_id INTEGER NOT NULL REFERENCES plats(id) ON DELETE CASCADE,
    lot_id TEXT NOT NULL,
    quantite INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (plat_id, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_plats_statut ON plats (utilisateur_id, statut);

-- Liste de courses : des plats qui font envie, notes pour le prochain passage au
-- magasin. Volontairement detachee de l'inventaire et des plats : rien n'est
-- reserve ni cree dans le frigo quand une envie est achetee.
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    note TEXT,
    statut TEXT NOT NULL DEFAULT 'a_acheter',
    date_creation TEXT NOT NULL,
    date_achat TEXT
);

-- Un abonnement Web Push par appareil. L'endpoint est l'URL que le service de
-- push (Apple, Google...) a attribuee a cette installation : il identifie
-- l'abonnement de facon unique, ce qui rend un reabonnement idempotent.
-- Les deux cles servent a chiffrer le message pour ce seul destinataire ; le
-- serveur ne peut pas les recalculer, seul le navigateur les fournit.
CREATE TABLE IF NOT EXISTS abonnements_push (
    endpoint TEXT PRIMARY KEY,
    utilisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    date_creation TEXT NOT NULL,
    dernier_succes TEXT,
    appareil TEXT
);
"""


def _connect() -> sqlite3.Connection:
    settings = get_settings()
    settings.db_file.parent.mkdir(parents=True, exist_ok=True)
    # check_same_thread=False : les endpoints `async def` s'executent sur la boucle
    # d'evenements alors que la dependance get_db, etant synchrone, est resolue dans
    # un thread du pool. La connexion reste utilisee sequentiellement par une seule
    # requete a la fois, donc le partage entre ces deux threads est sans danger.
    conn = sqlite3.connect(
        settings.db_file, isolation_level=None, check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


def init_db() -> None:
    """Cree le schema au demarrage."""
    with _connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connexion() -> Iterator[sqlite3.Connection]:
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    """Dependance FastAPI : une connexion par requete."""
    with connexion() as conn:
        yield conn
