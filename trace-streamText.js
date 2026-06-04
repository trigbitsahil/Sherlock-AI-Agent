import { streamText, tool, jsonSchema } from 'ai';

const getSheets = tool({
  description: "test",
  parameters: jsonSchema({
    type: "object",
    properties: {
      _unused: { type: "string" }
    },
    additionalProperties: false
  }),
  execute: async () => {}
});

// Create a fake provider to capture the request
const fakeProvider = {
  provider: 'fake',
  modelId: 'fake',
  specificationVersion: 'v1',
  defaultObjectGenerationMode: 'json',
  async doStream(options) {
    console.log("Tools received by provider:");
    console.log(JSON.stringify(options.tools, null, 2));
    throw new Error("stop");
  }
};

async function run() {
  try {
    const result = streamText({
      model: fakeProvider,
      messages: [{ role: 'user', content: 'test' }],
      tools: { getSheets },
      maxSteps: 1
    });
    for await (const chunk of result.textStream) { }
  } catch(e) {}
}
run();
