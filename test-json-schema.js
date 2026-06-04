import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, jsonSchema } from 'ai';
import * as dotenv from 'dotenv';
dotenv.config();

const tools = {
    getSheets: tool({
      description: 'List sheets',
      parameters: jsonSchema({
        type: "object",
        properties: {},
        additionalProperties: false
      }),
      execute: async () => {}
    })
};
async function run() {
  try {
    const res = await streamText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      prompt: 'hi',
      tools
    });
    console.log("Success!");
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
