import { streamText, tool, jsonSchema } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const t = tool({
  description: "test",
  parameters: jsonSchema({
    type: "object",
    properties: { foo: { type: "string" } },
    required: ["foo"],
    additionalProperties: false
  }),
  execute: async () => {}
});

async function main() {
  try {
    const result = streamText({
      model: anthropic('claude-3-5-sonnet-20240620'),
      messages: [{ role: 'user', content: 'test' }],
      tools: { testTool: t },
      maxSteps: 1
    });
    
    // consume the stream to force the request
    for await (const chunk of result.textStream) {
       console.log(chunk);
    }
  } catch (err) {
    console.error("Error from AI SDK:");
    console.error(err);
  }
}
main();
