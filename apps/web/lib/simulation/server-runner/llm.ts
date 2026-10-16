import Groq from "groq-sdk";
import type { LangGraphAgentResponseFormatConfig } from "@workspace/canvas";
import type { ServerLLMResult, ServerLLMStreamBatch } from "./types";

export interface CallServerLLMParams {
  provider: "openai" | "groq" | "anthropic" | "custom";
  apiKey?: string;
  modelName: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  customUrl?: string;
  responseFormat?: LangGraphAgentResponseFormatConfig;
  streamEnabled?: boolean;
}

export async function callServerLLM(args: CallServerLLMParams): Promise<ServerLLMResult> {
  const {
    provider,
    apiKey,
    modelName,
    systemPrompt,
    messages,
    customUrl,
    responseFormat,
    streamEnabled = true,
  } = args;

  const isStructured = Boolean(responseFormat?.enabled);
  const schemaStr = responseFormat?.schemaJson?.trim();

  let effectiveSystemPrompt = systemPrompt;
  if (isStructured) {
    effectiveSystemPrompt += `\n\nCRITICAL INSTRUCTION: You must respond ONLY with a valid JSON object matching this schema or structure:\n${
      schemaStr || '{"aiResponse": "string"}'
    }\nDo not include any conversational preamble, explanations, markdown backticks, or any text other than the JSON object itself.`;
  }

  // 1. Groq (streaming & non-streaming)
  if (provider === "groq") {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error(
        "Missing Groq API Key. Please provide an API key in the toolbar or GROQ_API_KEY env var.",
      );
    }
    const groq = new Groq({ apiKey: key });
    const promptMessages = [
      { role: "system" as const, content: effectiveSystemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
    ];

    if (!streamEnabled) {
      const completion = await groq.chat.completions.create({
        model: modelName || "openai/gpt-oss-120b",
        messages: promptMessages,
        temperature: isStructured ? 0.2 : 0.7,
        stream: false,
        ...(isStructured ? { response_format: { type: "json_object" as const } } : {}),
      });
      const text =
        "choices" in completion
          ? completion.choices[0]?.message?.content || ""
          : "";
      return { text, streamBatches: [] };
    }

    try {
      const stream = await groq.chat.completions.create({
        model: modelName || "openai/gpt-oss-120b",
        messages: promptMessages,
        temperature: isStructured ? 0.2 : 0.7,
        stream: true,
        ...(isStructured ? { response_format: { type: "json_object" as const } } : {}),
      });

      const streamBatches: ServerLLMStreamBatch[] = [];
      let fullText = "";
      let idx = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullText += delta;
        }
        streamBatches.push({
          index: idx++,
          delta,
          content: fullText,
          timestamp: new Date().toISOString(),
          raw: chunk.choices[0],
        });
      }

      return { text: fullText, streamBatches };
    } catch {
      // Fallback to non-streaming if stream mode encountered an issue
      const completion = await groq.chat.completions.create({
        model: modelName || "openai/gpt-oss-120b",
        messages: promptMessages,
        temperature: isStructured ? 0.2 : 0.7,
        stream: false,
        ...(isStructured ? { response_format: { type: "json_object" as const } } : {}),
      });
      const text =
        "choices" in completion
          ? completion.choices[0]?.message?.content || ""
          : "";
      return {
        text,
        streamBatches: [
          {
            index: 0,
            delta: text,
            content: text,
            timestamp: new Date().toISOString(),
            raw: "choices" in completion ? completion.choices[0] : completion,
          },
        ],
      };
    }
  }

  // 2. OpenAI & Anthropic & Custom HTTP
  const url =
    customUrl ||
    (provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : provider === "anthropic"
        ? "https://api.anthropic.com/v1/messages"
        : "http://localhost:11434/v1/chat/completions");

  const promptMessages = [
    { role: "system", content: effectiveSystemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(
      provider === "anthropic"
        ? {
            model: modelName,
            max_tokens: 2048,
            system: effectiveSystemPrompt,
            messages: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
            stream: streamEnabled,
          }
        : {
            model: modelName,
            messages: promptMessages,
            temperature: isStructured ? 0.2 : 0.7,
            stream: streamEnabled,
            ...(isStructured
              ? { response_format: { type: "json_object" } }
              : {}),
          },
    ),
  });

  if (!res.ok) {
    throw new Error(
      `${provider.toUpperCase()} API returned HTTP ${res.status}: ${await res.text()}`,
    );
  }

  if (!streamEnabled) {
    const json = (await res.json()) as {
      content?: Array<{ text?: string }>;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      provider === "anthropic"
        ? json.content?.[0]?.text || ""
        : json.choices?.[0]?.message?.content || "";
    return { text: content, streamBatches: [] };
  }

  const streamBatches: ServerLLMStreamBatch[] = [];
  let fullText = "";
  let idx = 0;

  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            try {
              const parsed = JSON.parse(dataStr) as {
                type?: string;
                delta?: { text?: string };
                choices?: Array<{ delta?: { content?: string } }>;
              };
              let delta = "";
              if (provider === "anthropic") {
                if (parsed.type === "content_block_delta") {
                  delta = parsed.delta?.text || "";
                }
              } else {
                delta = parsed.choices?.[0]?.delta?.content || "";
              }
              if (delta) {
                fullText += delta;
              }
              streamBatches.push({
                index: idx++,
                delta,
                content: fullText,
                timestamp: new Date().toISOString(),
                raw: parsed,
              });
            } catch {
              // ignore non-json SSE lines
            }
          }
        }
      }
    } catch {
      // Stream reading ended
    }
  }

  // Fallback if reader didn't yield batches (e.g. non-streaming endpoint response)
  if (!fullText && streamBatches.length === 0) {
    try {
      const json = (await res.json()) as {
        content?: Array<{ text?: string }>;
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content =
        provider === "anthropic"
          ? json.content?.[0]?.text || ""
          : json.choices?.[0]?.message?.content || "";
      return {
        text: content,
        streamBatches: [
          {
            index: 0,
            delta: content,
            content,
            timestamp: new Date().toISOString(),
            raw: json,
          },
        ],
      };
    } catch {
      // return as-is
    }
  }

  return { text: fullText, streamBatches };
}
