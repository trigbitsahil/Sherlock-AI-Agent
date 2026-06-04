import { UIMessage } from "ai";
import { processChatRequest } from "@/services/agent";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    console.log(`[API] Received POST /api/chat`);
    if (!messages || messages.length === 0) {
      return new Response("No messages provided", { status: 400 });
    }

    return await processChatRequest(messages);
  } catch (error) {
    console.error("[API Error]:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
