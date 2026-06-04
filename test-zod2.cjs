const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');

const schema = z.object({
  sheetName: z.string(),
  data: z.record(z.string())
});

console.log(JSON.stringify(zodToJsonSchema(schema), null, 2));
