export type LLMProvider = 'gemini' | 'groq';

let currentProvider: LLMProvider = 'gemini';

export function getProvider(): LLMProvider {
  return currentProvider;
}

export function setProvider(provider: LLMProvider) {
  currentProvider = provider;
}