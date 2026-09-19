"""Prompts par defaut, surchargeables depuis l'ecran Reglages (table settings)."""

from .categories import NOMS

CLE_PROMPT_SCAN = "prompt_scan"

DEFAULT_SCAN_PROMPT = """Tu analyses une photo de ticket de caisse. Extrais uniquement les produits alimentaires destinés au réfrigérateur (laitages, viandes, poissons, légumes, fruits, plats préparés frais). Exclus strictement : épicerie sèche, hygiène, boissons non périssables, produits ménagers.

Nettoie les libellés abrégés du ticket en noms lisibles (ex: "YAO BRASS" devient "Yaourt brassé").

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après, sans balises markdown, au format exact suivant :
[{"nom": "string", "categorie": "string", "quantite": number}]

La quantité correspond au nombre d'unités physiques individuelles dans le lot (ex: un pack de 6 yaourts → quantite: 6, une seule bouteille de lait → quantite: 1). N'inclus JAMAIS la quantité dans le texte du nom (pas de "x6" ou "x2").

Catégories possibles : {{CATEGORIES}}."""

# Interpole apres coup plutot qu'en f-string : le prompt contient des accolades
# JSON litterales qu'il faudrait sinon toutes doubler.
DEFAULT_SCAN_PROMPT = DEFAULT_SCAN_PROMPT.replace("{{CATEGORIES}}", ", ".join(NOMS))

DEFAULTS = {
    CLE_PROMPT_SCAN: DEFAULT_SCAN_PROMPT,
}
