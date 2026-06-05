import { createOpenAI } from "@ai-sdk/openai";

/**
 * All AI model calls are routed exclusively through OpenRouter.
 * This gives us a single API key, a unified billing dashboard,
 * and the ability to switch any model from the UI without touching code.
 *
 * Add or remove models by editing OPENROUTER_MODELS in the UI constants
 * (see components/ChatInterface.tsx). No backend changes needed.
 */

function getOpenRouterProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === "your_openrouter_api_key_here" || apiKey.trim() === "") {
    throw new Error(
      "[OpenRouter] OPENROUTER_API_KEY is not set in your .env file. " +
      "Get a free key at https://openrouter.ai and add: OPENROUTER_API_KEY=your_key"
    );
  }

  return createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

/**
 * Returns an OpenRouter-backed model instance.
 * @param modelId - The OpenRouter model string, e.g. "minimax/minimax-m2.7"
 */
export function getModel(modelId?: string) {
  const resolvedModel = modelId || process.env.DEFAULT_MODEL || "minimax/minimax-m2.7";
  const provider = getOpenRouterProvider();
  return provider.chat(resolvedModel);
}
