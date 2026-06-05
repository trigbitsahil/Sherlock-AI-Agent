import { UIMessage } from "ai";
import { processChatRequest } from "@/services/agent";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages;
    
    // Extract model from URL query string
    const url = new URL(req.url);
    const model = url.searchParams.get("model") || body.model;

    console.log(`[API] Received POST /api/chat with model: ${model || 'default'}`);
    if (!messages || messages.length === 0) {
      return new Response("No messages provided", { status: 400 });
    }

    return await processChatRequest(messages, model);
  } catch (error) {
    console.error("[API Error]:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
