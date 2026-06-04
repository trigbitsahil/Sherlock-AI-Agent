import { convertToModelMessages, streamText, UIMessage, stepCountIs } from "ai";
import { getModel } from "../providers";
import { getMcpTools } from "../tools";
import { HR_AGENT_SYSTEM_PROMPT } from "../prompts/system";

export async function processChatRequest(messages: UIMessage[]) {
  console.log(`\n======================================================`);
  console.log(`[AgentService/Start] Processing request with ${messages.length} messages`);
  console.log(`[AgentService/Messages] Last message: "${messages[messages.length - 1]?.content}"`);
  
  try {
    console.log(`[AgentService/Context] Loading MCP tools...`);
    const tools = await getMcpTools();
    console.log(`[AgentService/Context] MCP tools loaded successfully`);
    
    const coreMessages = await convertToModelMessages(messages);
    console.log(`[AgentService/Context] Converted to ${coreMessages.length} model messages`);

    console.log(`[AgentService/LLM] Initiating streamText with maxRetries: 5`);
    const result = streamText({
      model: getModel(),
      system: HR_AGENT_SYSTEM_PROMPT,
      messages: coreMessages,
      tools,
      stopWhen: stepCountIs(10), // Multi-step execution loop control
      maxRetries: 5, // Built-in robust retry mechanism for API failures
      experimental_telemetry: {
        isEnabled: true,
        functionId: "processChatRequest"
      },
      onStart: () => {
        console.log(`[AgentService/StreamStart] Stream successfully started and connected to provider`);
      },
      onStepFinish({ text, toolCalls, toolResults, finishReason, usage }) {
        console.log(`\n--- [AgentService/StepFinish] ---`);
        console.log(`Reason: ${finishReason} | Tokens: ${usage.totalTokens}`);
        if (text) {
          console.log(`Text generated: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        }
        if (toolCalls && toolCalls.length > 0) {
          toolCalls.forEach((tc, idx) => {
            console.log(`[ToolCall ${idx + 1}] ${tc.toolName} - Args:`, JSON.stringify(tc.args));
          });
        }
        if (toolResults && toolResults.length > 0) {
          toolResults.forEach((tr, idx) => {
            const preview = JSON.stringify(tr.result).substring(0, 150);
            console.log(`[ToolResult ${idx + 1}] ${tr.toolName} - ${preview}...`);
          });
        }
        console.log(`---------------------------------\n`);
      },
      onFinish: (event) => {
        console.log(`[AgentService/StreamFinish] Stream completely finished. Total steps: ${event.steps?.length || 1}`);
        console.log(`======================================================\n`);
      },
      onError: (error) => {
        console.error(`[AgentService/StreamError] Critical failure inside streamText:`, error);
      }
    });

    return result.toUIMessageStreamResponse({
      onError: (error: any) => {
        console.error("[AgentService/ResponseError] Error sending stream to client:", error);
        return error instanceof Error ? error.message : String(error);
      },
    });
  } catch (error) {
    console.error("[AgentService/FatalError] Execution terminated unexpectedly:", error);
    throw error;
  }
}
