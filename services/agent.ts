import { convertToModelMessages, streamText, UIMessage, stepCountIs, generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import { getMcpTools } from "../tools";
import { HR_AGENT_SYSTEM_PROMPT, MINIMAL_SYSTEM_PROMPT } from "../prompts/system";

export async function processChatRequest(messages: UIMessage[], modelId?: string, apiKey?: string) {
  console.log(`\n======================================================`);
  console.log(`[AgentService/Start] Processing request with ${messages.length} messages using model: ${modelId || 'default'}`);
  console.log(`[AgentService/Messages] Last message: "${(messages[messages.length - 1] as any)?.content || ''}"`);
  
  try {
    // 1. Conversation Trimming: Keep only the last 5 messages to save tokens
    const MAX_HISTORY = 5;
    const trimmedMessages = messages.length > MAX_HISTORY ? messages.slice(-MAX_HISTORY) : messages;
    if (messages.length > MAX_HISTORY) {
      console.log(`[AgentService/Context] Trimmed conversation history from ${messages.length} to ${MAX_HISTORY} messages`);
    }

    // 2. Intent Detection: Check if we need tools
    const lastMsg = trimmedMessages[trimmedMessages.length - 1] as any;
    let lastMessageContent = '';
    if (typeof lastMsg?.content === 'string') {
      lastMessageContent = lastMsg.content;
    } else if (Array.isArray(lastMsg?.content)) {
      lastMessageContent = lastMsg.content.map((p: any) => p.text || '').join(' ');
    } else if (Array.isArray(lastMsg?.parts)) {
      lastMessageContent = lastMsg.parts.map((p: any) => p.text || '').join(' ');
    } else if (typeof lastMsg?.text === 'string') {
      lastMessageContent = lastMsg.text;
    }
    
    console.log(`[AgentService/Intent] Extracted last message content: "${lastMessageContent}"`);
    let requiresTools = true;
    let requiredTools: string[] = [];
    const msgLower = lastMessageContent.toLowerCase();
    
    // Fast heuristic for simple greetings
    const isSimpleGreeting = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup)[\s\!\.\?]*$/i.test(lastMessageContent.trim());
    
    if (isSimpleGreeting) {
      console.log(`[AgentService/Intent] Simple greeting detected via heuristic. Skipping tools.`);
    } else {
      console.log(`[AgentService/Intent] Analyzing intent deterministically...`);
      
      if (msgLower.match(/\b(sheet|sheets|list|available)\b/)) requiredTools.push("getSheets");
      if (msgLower.match(/\b(structure|headers|columns)\b/)) requiredTools.push("getSheetStructure");
      if (msgLower.match(/\b(row|rows|data|details|team|utilization|budget|client|clients|read|fetch|get)\b/)) {
        requiredTools.push("getRows", "searchRows", "getRowById");
      }
      if (msgLower.match(/\b(update|edit|change|modify)\b/)) requiredTools.push("updateRow", "getRowById");
      if (msgLower.match(/\b(create|add|new|insert)\b/)) requiredTools.push("createRow");
      if (msgLower.match(/\b(report|aggregate|summary)\b/)) requiredTools.push("generateReport");
      if (msgLower.match(/\b(revenue|ytd|earnings)\b/)) requiredTools.push("getYearlyRevenue");
      if (msgLower.match(/\b(top|highest|most)\b/)) requiredTools.push("getTopClients");

      // Deduplicate
      requiredTools = [...new Set(requiredTools)];
      
      // If no specific tools matched but it's not a simple greeting, load the most common read tools
      if (requiredTools.length === 0) {
        requiredTools = ["getSheets", "getRows", "searchRows"];
      }
      
      console.log(`[AgentService/Intent] Deterministic intent result: requiredTools=[${requiredTools.join(", ")}]`);
    }

    requiresTools = requiredTools.length > 0;
    let tools = undefined;
    let systemPrompt = MINIMAL_SYSTEM_PROMPT;

    if (requiresTools) {
      console.log(`[AgentService/Context] Loading MCP tools...`);
      tools = await getMcpTools(requiredTools);
      systemPrompt = HR_AGENT_SYSTEM_PROMPT;
      console.log(`[AgentService/Context] MCP tools loaded successfully`);
    }
    
    // Normalize messages to ensure 'content' is set (frontend might send 'text' instead of 'content')
    const normalizedMessages = trimmedMessages.map((msg: any) => {
      if (!msg.content && msg.text) {
        return { ...msg, content: msg.text };
      }
      return msg;
    });
    
    const coreMessages = await convertToModelMessages(normalizedMessages);
    console.log(`[AgentService/Context] Converted to ${coreMessages.length} model messages`);

    // 3. Dynamic Prompt Caching Strategy
    const isAnthropic = modelId?.toLowerCase().includes('anthropic') || modelId?.toLowerCase().includes('claude');
    
    // For Anthropic, we can explicitly set cache breakpoints on the system prompt
    const systemMessage = isAnthropic ? [
      { 
        type: 'text', 
        text: systemPrompt, 
        experimental_providerMetadata: { anthropic: { cacheControl: { type: 'ephemeral' } } } 
      }
    ] : systemPrompt;

    console.log(`[AgentService/LLM] Initiating streamText with maxRetries: 5`);
    const streamOptions: any = {
      model: getModel(modelId, apiKey),
      system: systemMessage,
      messages: coreMessages,
      tools,
      stopWhen: stepCountIs(12), // Limit max steps to prevent runaway multi-step loops
      maxRetries: 5, // Built-in robust retry mechanism for API failures
      experimental_telemetry: {
        isEnabled: true,
        functionId: "processChatRequest"
      },
      onStepFinish({ text, toolCalls, toolResults, finishReason, usage }: any) {
        console.log(`\n--- [AgentService/StepFinish] ---`);
        const totalTok = usage?.totalTokens ?? 'N/A';
        const promptTok = usage?.promptTokens ?? usage?.inputTokens ?? 'N/A (model does not report)';
        const completionTok = usage?.completionTokens ?? usage?.outputTokens ?? 'N/A (model does not report)';
        console.log(`Reason: ${finishReason} | Tokens: ${totalTok} (Prompt: ${promptTok}, Completion: ${completionTok})`);
        if (text) {
          console.log(`Text generated: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        }
        if (toolCalls && toolCalls.length > 0) {
          toolCalls.forEach((tc: any, idx: number) => {
            console.log(`[ToolCall ${idx + 1}] ${tc.toolName} - Args:`, JSON.stringify(tc.args)?.substring(0, 200));
          });
        }
        if (toolResults && toolResults.length > 0) {
          toolResults.forEach((tr: any, idx: number) => {
            const preview = JSON.stringify(tr.result).substring(0, 150);
            console.log(`[ToolResult ${idx + 1}] ${tr.toolName} - ${preview}...`);
          });
        }
        console.log(`---------------------------------\n`);
      },
      onFinish: (event: any) => {
        console.log(`[AgentService/StreamFinish] Stream completely finished. Total steps: ${event.steps?.length || 1}`);
        const totalTok = event.usage?.totalTokens ?? 'N/A';
        const promptTok = event.usage?.promptTokens ?? event.usage?.inputTokens ?? 'N/A';
        const completionTok = event.usage?.completionTokens ?? event.usage?.outputTokens ?? 'N/A';
        console.log(`[AgentService/StreamFinish] Total Tokens: ${totalTok} (Prompt: ${promptTok}, Completion: ${completionTok})`);
        console.log(`======================================================\n`);
      },
      onError: (error: any) => {
        console.error(`[AgentService/StreamError] Critical failure inside streamText:`, error);
      }
    };
    const result = streamText(streamOptions);

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
