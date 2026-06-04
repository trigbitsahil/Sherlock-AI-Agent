const { anthropic } = require("@ai-sdk/anthropic");
const { streamText, tool } = require("ai");
const { z } = require("zod");

const tools = {
    getSheets: tool({
      description: "List all Google Spreadsheet files from the Drive folder.",
      parameters: z.object({ _dummy: z.string().optional().describe("Ignore this.") }),
      execute: async () => {}
    })
};

async function run() {
  try {
    const res = await streamText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      prompt: "hi",
      tools
    });
    for await (const chunk of res.textStream) {
        process.stdout.write(chunk);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
