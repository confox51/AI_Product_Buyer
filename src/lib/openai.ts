import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default openai;

export const CHAT_MODEL = "gpt-5-mini";
export const SPEC_AND_RANKING_MODEL = "gpt-5.1";

export async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
) {
  const response = await openai.chat.completions.create({
    model: options?.model ?? "gpt-4o-mini",
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  });
  return response.choices[0].message.content ?? "";
}

export async function jsonCompletion<T>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<T> {
  const response = await openai.chat.completions.create({
    model: options?.model ?? "gpt-4o-mini",
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 4096,
    response_format: { type: "json_object" },
  });
  const content = response.choices[0].message.content ?? "{}";
  return JSON.parse(content) as T;
}
