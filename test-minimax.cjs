const { createOpenAI } = require("@ai-sdk/openai");
const { generateText } = require("ai");
require("dotenv").config();

async function main() {
  const minimaxProvider = createOpenAI({
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: "https://api.minimax.io/v1",
    headers: {
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`
    }
  });
  
  try {
    const res = await generateText({
      model: minimaxProvider.chat("MiniMax-M3"),
      prompt: "Hello"
    });
    console.log("Success:", res.text);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
main();
