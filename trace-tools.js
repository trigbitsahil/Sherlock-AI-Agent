import { tool, jsonSchema } from 'ai';
import { asSchema } from '@ai-sdk/provider-utils';

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

async function run() {
  const schema = await asSchema(getSheets.parameters).jsonSchema;
  console.log(JSON.stringify(schema, null, 2));
}
run();
