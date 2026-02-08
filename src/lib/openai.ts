import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default openai;

export const CHAT_MODEL = "gpt-5-mini";
export const SPEC_AND_RANKING_MODEL = "gpt-5.1";

function supportsTemperature(model: string): boolean {
  // Reasoning models don't support custom temperature
  const reasoningModels = ["gpt-5", "o1", "o3"];
  return !reasoningModels.some((prefix) => model.startsWith(prefix));
}

export async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
) {
  const actualModel = options?.model ?? "gpt-4o-mini";
  const response = await openai.chat.completions.create({
    model: actualModel,
    messages,
    max_completion_tokens: options?.maxTokens ?? 2048,
    ...(supportsTemperature(actualModel) && {
      temperature: options?.temperature ?? 0.7,
    }),
  });
  return response.choices[0].message.content ?? "";
}

export async function jsonCompletion<T>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<T> {
  const actualModel = options?.model ?? "gpt-4o-mini";
  const response = await openai.chat.completions.create({
    model: actualModel,
    messages,
    max_completion_tokens: options?.maxTokens ?? 4096,
    response_format: { type: "json_object" },
    ...(supportsTemperature(actualModel) && {
      temperature: options?.temperature ?? 0.3,
    }),
  });
  const content = response.choices[0].message.content ?? "{}";
  return JSON.parse(content) as T;
}
