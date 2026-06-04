require('dotenv').config();
const { anthropic } = require('@ai-sdk/anthropic');
const { streamText, tool, jsonSchema } = require('ai');
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
