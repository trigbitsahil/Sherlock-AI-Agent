import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client
let redis: Redis | null = null;

try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
} catch (e) {
  console.warn("Could not initialize Upstash Redis.");
}

export async function GET() {
  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  try {
    const config = await redis.get<{ apiKey?: string, selectedModel?: string }>('agent_global_settings');
    return NextResponse.json(config || {});
  } catch (e) {
    console.error("Error reading from Redis:", e);
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { apiKey, selectedModel } = body;
    
    await redis.set('agent_global_settings', {
      apiKey: apiKey || "",
      selectedModel: selectedModel || "minimax/minimax-m3"
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Error writing to Redis:", e);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
