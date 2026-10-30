import type {
  BrowserLLMResult,
  BrowserLLMStreamBatch,
  CallBrowserLLMArgs,
} from "./types";

/**
 * Direct browser LLM invocation via client-side fetch.
 * Returns the actual response string from the provider or throws the actual error.
 * Zero mocked strings.
 */
export async function callBrowserLLM(args: CallBrowserLLMArgs): Promise<BrowserLLMResult> {
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

  if (messages.length === 0) {
    throw new Error(`Cannot invoke ${provider.toUpperCase()}: No messages or prompt provided.`);
  }

  const isStructured = Boolean(responseFormat?.enabled);
  const schemaStr = responseFormat?.schemaJson?.trim();

  let effectiveSystemPrompt = systemPrompt;
  if (isStructured) {
    effectiveSystemPrompt += `\n\nCRITICAL INSTRUCTION: You must respond ONLY with a valid JSON object matching this schema or structure:\n${
      schemaStr || '{"aiResponse": "string"}'
    }\nDo not include any conversational preamble, explanations, markdown backticks, or any text other than the JSON object itself.`;
  }

  const streamBatches: BrowserLLMStreamBatch[] = [];
  let fullText = "";
  let idx = 0;

  // 1. Custom / Local LLM (Ollama, local vLLM, etc.)
  if (customUrl || provider === "custom") {
    const url = customUrl || "http://localhost:11434/v1/chat/completions";
    const promptMessages = [
      { role: "system", content: effectiveSystemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelName,
          messages: promptMessages,
          temperature: isStructured ? 0.2 : 0.7,
          stream: true,
        }),
      });
    } catch (netErr: unknown) {
      throw new Error(
        `Failed to connect to custom LLM at ${url}: ${netErr instanceof Error ? netErr.message : String(netErr)}. Ensure your local model or server is running with CORS enabled.`,
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Custom LLM endpoint (${url}) returned HTTP ${res.status}: ${errText}`);
    }

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
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) fullText += delta;
                streamBatches.push({
                  index: idx++,
                  delta,
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  raw: parsed.choices?.[0],
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    if (!fullText && streamBatches.length === 0) {
      try {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        return {
          text: content,
          streamBatches: [
            {
              index: 0,
              delta: content,
              content,
              timestamp: new Date().toISOString(),
              raw: data,
            },
          ],
        };
      } catch {}
    }

    return { text: fullText, streamBatches };
  }

  // 2. Groq & OpenAI (OpenAI-compatible chat completions)
  if (provider === "groq" || provider === "openai") {
    if (!apiKey) {
      throw new Error(`Missing API Key: ${provider.toUpperCase()} requires a valid API key.`);
    }
    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

    const promptMessages = [
      { role: "system", content: effectiveSystemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: promptMessages,
          temperature: isStructured ? 0.2 : 0.7,
          stream: streamEnabled,
          ...(isStructured ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (netErr: unknown) {
      throw new Error(
        `Network failure connecting to ${provider.toUpperCase()} (${url}): ${netErr instanceof Error ? netErr.message : String(netErr)}`,
      );
    }

    if (!res.ok) {
      let errMsg = "";
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        errMsg = await res.text();
      }
      throw new Error(`${provider.toUpperCase()} API error (${res.status}): ${errMsg}`);
    }

    if (!streamEnabled) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      return {
        text: content,
        streamBatches: [],
      };
    }

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
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) fullText += delta;
                streamBatches.push({
                  index: idx++,
                  delta,
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  raw: parsed.choices?.[0],
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    if (!fullText && streamBatches.length === 0) {
      try {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        return {
          text: content,
          streamBatches: [
            {
              index: 0,
              delta: content,
              content,
              timestamp: new Date().toISOString(),
              raw: data,
            },
          ],
        };
      } catch {}
    }

    return { text: fullText, streamBatches };
  }

  // 3. Anthropic Messages API
  if (provider === "anthropic") {
    if (!apiKey) {
      throw new Error(`Missing API Key: Anthropic requires a valid API key.`);
    }
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: modelName || "claude-3-5-sonnet-20241022",
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          max_tokens: 1024,
          stream: true,
        }),
      });
    } catch (netErr: unknown) {
      throw new Error(
        `Network failure connecting to Anthropic: ${netErr instanceof Error ? netErr.message : String(netErr)}`,
      );
    }

    if (!res.ok) {
      let errMsg = "";
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        errMsg = await res.text();
      }
      throw new Error(`Anthropic API error (${res.status}): ${errMsg}`);
    }

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
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.type === "content_block_delta" ? parsed.delta?.text || "" : "";
                if (delta) fullText += delta;
                streamBatches.push({
                  index: idx++,
                  delta,
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  raw: parsed,
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    if (!fullText && streamBatches.length === 0) {
      try {
        const data = await res.json();
        const content = data.content?.[0]?.text || "";
        return {
          text: content,
          streamBatches: [
            {
              index: 0,
              delta: content,
              content,
              timestamp: new Date().toISOString(),
              raw: data,
            },
          ],
        };
      } catch {}
    }

    return { text: fullText, streamBatches };
  }

  throw new Error(`Unsupported LLM provider: "${provider}". Please choose Groq, OpenAI, or Anthropic.`);
}

