import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

from .categories import normaliser
from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS inventaire_frigo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventaire_statut ON inventaire_frigo (statut_fin);
CREATE INDEX IF NOT EXISTS idx_inventaire_lot ON inventaire_frigo (lot_id);

-- Un plat prevu reserve une partie du stock. Tant qu'il n'est pas prepare, rien
-- n'est consomme : la reservation ne fait que documenter l'intention et permet
-- de distinguer ce qui est deja affecte de ce qui reste libre.
CREATE TABLE IF NOT EXISTS plats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE INDEX IF NOT EXISTS idx_plats_statut ON plats (statut);

-- Liste de courses : des plats qui font envie, notes pour le prochain passage au
-- magasin. Volontairement detachee de l'inventaire et des plats : rien n'est
-- reserve ni cree dans le frigo quand une envie est achetee.
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    """Cree le schema et applique les migrations additives au demarrage."""
    with _connect() as conn:
        conn.executescript(SCHEMA)

        colonnes = {row["name"] for row in conn.execute("PRAGMA table_info(inventaire_frigo);")}

        if "lot_id" not in colonnes:
            conn.execute("ALTER TABLE inventaire_frigo ADD COLUMN lot_id TEXT;")
            conn.execute(
                "UPDATE inventaire_frigo SET lot_id = 'legacy_' || id WHERE lot_id IS NULL;"
            )
        if "statut_fin" not in colonnes:
            conn.execute("ALTER TABLE inventaire_frigo ADD COLUMN statut_fin TEXT;")
        if "date_fin" not in colonnes:
            conn.execute("ALTER TABLE inventaire_frigo ADD COLUMN date_fin TEXT;")

        _fermer_categories(conn)
        _supprimer_colonnes_mortes(conn, colonnes)
        # Surcharge du prompt de la generation de recettes, retiree de l'application.
        conn.execute("DELETE FROM settings WHERE key = 'prompt_recipes';")


def _fermer_categories(conn: sqlite3.Connection) -> None:
    """Rattache les categories existantes a la liste fermee.

    L'inventaire a longtemps accepte du texte libre : « Légumes » et « Légume »
    y coexistent, et chacun produit sa propre puce de filtre. On les ramene une
    fois pour toutes, en ne touchant que les valeurs qui changent reellement.
    """
    existantes = [
        ligne["categorie"]
        for ligne in conn.execute(
            "SELECT DISTINCT categorie FROM inventaire_frigo WHERE categorie IS NOT NULL;"
        )
    ]
    for ancienne in existantes:
        canonique = normaliser(ancienne)
        if canonique != ancienne:
            conn.execute(
                "UPDATE inventaire_frigo SET categorie = ? WHERE categorie = ?;",
                (canonique, ancienne),
            )


def _supprimer_colonnes_mortes(conn: sqlite3.Connection, colonnes: set[str]) -> None:
    """Retire les colonnes qui n'etaient plus ni lues ni ecrites.

    `quantite` valait 1 partout depuis l'abandon des demi-unites, le stock se
    comptant desormais en nombre de lignes ; `date_peremption_initiale` etait
    ecrite a la creation et jamais relue. DROP COLUMN demande SQLite 3.35+, on
    laisse la colonne en place plutot que d'echouer sur une version plus ancienne.
    """
    if sqlite3.sqlite_version_info < (3, 35, 0):
        return

    for morte in ("quantite", "date_peremption_initiale"):
        if morte in colonnes:
            conn.execute(f"ALTER TABLE inventaire_frigo DROP COLUMN {morte};")


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
