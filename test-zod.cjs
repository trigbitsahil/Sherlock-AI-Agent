const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');

const schema = z.object({
  sheetName: z.string(),
  data: z.record(z.unknown()), // Try unknown
  updates: z.any() // Try any
});

console.log(JSON.stringify(zodToJsonSchema(schema), null, 2));
