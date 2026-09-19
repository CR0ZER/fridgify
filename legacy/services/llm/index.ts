import { scanReceiptWithGemini, ProduitDetecte, generateRecipesWithGemini, RecetteGeneree } from './gemini';
import { scanReceiptWithGroq, generateRecipesWithGroq } from './groq';
import { getProvider } from './provider';

export type { ProduitDetecte, RecetteGeneree };
export { getProvider, setProvider } from './provider';

export async function scanReceipt(imageBase64: string): Promise<ProduitDetecte[]> {
  if (getProvider() === 'groq') return scanReceiptWithGroq();
  return scanReceiptWithGemini(imageBase64);
}

export async function generateRecipes(ingredientsTries: string[], customRequest?: string): Promise<RecetteGeneree[]> {
  if (getProvider() === 'groq') return generateRecipesWithGroq();
  return generateRecipesWithGemini(ingredientsTries, customRequest);
}