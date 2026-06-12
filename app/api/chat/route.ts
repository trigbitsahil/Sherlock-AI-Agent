import { UIMessage } from "ai";
import { processChatRequest } from "@/services/agent";
import { Redis } from "@upstash/redis";

export const maxDuration = 60; // 60s is the absolute maximum for Vercel Hobby (Free) tier

let redis: Redis | null = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
} catch (e) {
  // Ignore
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages;
    
    let globalConfig: { apiKey?: string, selectedModel?: string } | null = null;
    if (redis) {
      try {
        globalConfig = await redis.get('agent_global_settings');
      } catch (e) {
        console.error("Failed to read from Redis:", e);
      }
    }

    // Extract model from URL query string, Redis, or fallback
    const url = new URL(req.url);
    const model = url.searchParams.get("model") || globalConfig?.selectedModel || body.model;
    const apiKey = globalConfig?.apiKey || body.apiKey || process.env.OPENROUTER_API_KEY;

    console.log(`[API] Received POST /api/chat with model: ${model || 'default'}`);
    if (!messages || messages.length === 0) {
      return new Response("No messages provided", { status: 400 });
    }

    return await processChatRequest(messages, model, apiKey);
  } catch (error) {
    console.error("[API Error]:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
