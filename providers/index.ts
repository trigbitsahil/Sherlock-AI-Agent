import { anthropic } from "@ai-sdk/anthropic";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";

export function getModel(provider?: string, modelId?: string) {
  const p = provider || process.env.AI_PROVIDER || "minimax";

  const getMinimax = () => {
    const minimaxProvider = createOpenAI({
      apiKey: process.env.MINIMAX_API_KEY || "",
      baseURL: "https://api.minimax.io/v1", // No trailing slash
    });
    return minimaxProvider.chat("MiniMax-M2.7-highspeed");
  };

  switch (p.toLowerCase()) {
    case "minimax":
      return getMinimax();
    case "deepseek":
      const deepseekProvider = createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY || "",
        baseURL: "https://api.deepseek.com/v1",
      });
      return deepseekProvider.chat(modelId || "deepseek-chat");
    case "anthropic":
      return anthropic(modelId || "claude-3-5-sonnet-20240620");
    case "openai":
      // Use .chat() to force Chat Completions API (/v1/chat/completions)
      // The default openai() uses /v1/responses (Responses API) which has
      // a schema serialization bug producing type:"None" for tool parameters.
      return openai.chat(modelId || "gpt-4o");
    case "google":
      return google(modelId || "gemini-2.0-flash");
    case "grok":
      const grokProvider = createOpenAI({
        apiKey: process.env.GROK_API_KEY || "",
        baseURL: "https://api.x.ai/v1",
      });
      return grokProvider.chat(modelId || "grok-beta");
    case "groq":
      return groq(modelId || "llama-3.3-70b-versatile");
    default:
      return getMinimax();
  }
}
