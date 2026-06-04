import { anthropic } from '@ai-sdk/anthropic';
import { tool, jsonSchema } from 'ai';
import { z } from 'zod';

const t = tool({
  description: "Test tool",
  parameters: jsonSchema({
    type: "object",
    properties: {
      sourceId: { type: "string" }
    }
  }),
  execute: async () => {}
});

console.log(JSON.stringify(t, null, 2));
