import { tool, jsonSchema } from 'ai';

const getSheets = tool({
  description: "test",
  parameters: jsonSchema({
    type: "object",
    properties: { forceObj: { type: "string" } },
    additionalProperties: false
  }),
  execute: async () => {}
});

console.log(getSheets.parameters);
