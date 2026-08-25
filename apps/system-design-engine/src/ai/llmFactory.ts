import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

let geminiKeyIndex = 0;
let groqKeyIndex = 0;

export type SupportedChatModel = ChatGoogleGenerativeAI | ChatGroq;

export interface CreateChatModelOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

/**
 * Creates a configured chat model instance.
 * Prioritizes Google Gemini (GEMINI_API_KEY / GOOGLE_API_KEY),
 * and falls back to Groq (GROQ_API_KEY) if Gemini is not configured.
 */
export function createChatModel(options: CreateChatModelOptions = {}): SupportedChatModel {
  const { temperature = 0.2, maxTokens = 8192, streaming = true } = options;

  // 1. Check for Gemini / Google API Key
  const geminiKeyStr = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const geminiKeys = geminiKeyStr
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (geminiKeys.length > 0) {
    const apiKey = geminiKeys[geminiKeyIndex % geminiKeys.length];
    geminiKeyIndex = (geminiKeyIndex + 1) % geminiKeys.length;

    let modelName =
      process.env.GEMINI_LLM_MODEL ||
      process.env.GOOGLE_LLM_MODEL ||
      "gemini-3.6-flash";

    console.log(`[llmFactory] Initializing Gemini model: ${modelName} (key prefix: ${apiKey?.slice(0, 6)}...)`);

    try {
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: modelName,
        temperature,
        maxOutputTokens: maxTokens,
        streaming,
      });
    } catch (err: any) {
      console.error(`[llmFactory] Error initializing Gemini model (${modelName}):`, err?.message || err);
      if (err?.stack) console.error(`[llmFactory] Stack:`, err.stack);
      throw err;
    }
  }

  // 2. Fallback to Groq
  const groqKeyStr = process.env.GROQ_API_KEY || "";
  const groqKeys = groqKeyStr
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (groqKeys.length > 0) {
    const apiKey = groqKeys[groqKeyIndex % groqKeys.length];
    groqKeyIndex = (groqKeyIndex + 1) % groqKeys.length;

    let modelName = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-20b";
    console.log(`[llmFactory] Initializing Groq model: ${modelName}`);

    try {
      return new ChatGroq({
        apiKey,
        model: modelName,
        temperature,
        maxTokens,
        streaming,
      });
    } catch (err: any) {
      console.error(`[llmFactory] Error initializing Groq model (${modelName}):`, err?.message || err);
      if (err?.stack) console.error(`[llmFactory] Stack:`, err.stack);
      throw err;
    }
  }

  const errorMsg = "No AI API key found. Please set GEMINI_API_KEY (or GOOGLE_API_KEY) or GROQ_API_KEY in .env";
  console.error(`[llmFactory] ${errorMsg}`);
  throw new Error(errorMsg);
}
