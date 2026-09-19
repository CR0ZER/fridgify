import { getSetting } from '../../db/settings';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

export const DEFAULT_SCAN_PROMPT = `Tu analyses une photo de ticket de caisse. Extrais uniquement les produits alimentaires destinés au réfrigérateur (laitages, viandes, poissons, légumes, fruits, plats préparés frais). Exclus strictement : épicerie sèche, hygiène, boissons non périssables, produits ménagers.

Nettoie les libellés abrégés du ticket en noms lisibles (ex: "YAO BRASS" devient "Yaourt brassé").

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après, sans balises markdown, au format exact suivant :
[{"nom": "string", "categorie": "string", "quantite": number}]

La quantité correspond au nombre d'unités physiques individuelles dans le lot (ex: un pack de 6 yaourts → quantite: 6, une seule bouteille de lait → quantite: 1). N'inclus JAMAIS la quantité dans le texte du nom (pas de "x6" ou "x2").

Catégories possibles : Laitage, Viande, Poisson, Légume, Fruit, Plat préparé, Autre.`;

export const DEFAULT_RECIPE_PROMPT = `Tu es un assistant culinaire. Voici les ingrédients disponibles dans mon frigo, triés par ordre d'urgence de péremption (le premier périme le plus vite) :
{{INGREDIENTS}}

Propose jusqu'à TROIS recettes simples utilisant EN PRIORITÉ les ingrédients les plus urgents (si possible) de cette liste (3 à 5 ingrédients maximum au total dans chaque recette). Évite les associations aberrantes ou peu réalistes. Tu peux supposer que j'ai les bases courantes (sel, poivre, huile, ail) sans les compter dans la limite.

J'ai l'habitude de cuisiner des recettes simples et rapides comme des viandes à la poêle, des pâtes, etc. Propose des recettes adaptées à ce style de cuisine.
Pour te donner des exemples, voilà mes recettes préférées : "Gnocchis, chèvre, miel, crème fraîche, lardons", "Viande marinée soja miel, nouilles", "Burgers maison, steak haché, cheddar, bacon, oignons"

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après, sans balises markdown, au format exact d'un tableau de recettes :
[{"titre": "string", "ingredients_utilises": ["string"], "etapes": ["string"]}]`;

export type ProduitDetecte = {
  nom: string;
  categorie: string;
  quantite: number;
};

export async function scanReceiptWithGemini(imageBase64: string): Promise<ProduitDetecte[]> {
  if (!API_KEY) {
    throw new Error('Clé API Gemini manquante. Vérifiez votre fichier .env');
  }

  const promptText = getSetting('prompt_scan') ?? DEFAULT_SCAN_PROMPT;

  const response = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API Gemini (${response.status}) : ${errorText}`);
  }

  const data = await response.json();
  const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Réponse Gemini vide ou mal formée');
  }

  const cleaned = rawText.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as ProduitDetecte[];
  } catch {
    throw new Error('Impossible de parser la réponse JSON de Gemini : ' + cleaned);
  }
}

export type RecetteGeneree = {
  titre: string;
  ingredients_utilises: string[];
  etapes: string[];
};

export async function generateRecipesWithGemini(
  ingredientsTries: string[],
  customRequest?: string
): Promise<RecetteGeneree[]> {
  if (!API_KEY) {
    throw new Error('Clé API Gemini manquante. Vérifiez votre fichier .env');
  }

  const template = getSetting('prompt_recipes') ?? DEFAULT_RECIPE_PROMPT;
  const listeIngredients = ingredientsTries.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
  let promptText = template.replace('{{INGREDIENTS}}', listeIngredients);

  if (customRequest && customRequest.trim()) {
    promptText += `\n\nEnvie particulière pour cette fois : ${customRequest.trim()}`;
  }

  const response = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API Gemini (${response.status}) : ${errorText}`);
  }

  const data = await response.json();
  const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Réponse Gemini vide ou mal formée');
  }

  const cleaned = rawText.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as RecetteGeneree[];
  } catch {
    throw new Error('Impossible de parser les recettes JSON : ' + cleaned);
  }
}