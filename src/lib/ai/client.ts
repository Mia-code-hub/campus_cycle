import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// AI 调用统一错误：kind 区分 api_error / timeout / parse_error
export type AiErrorKind = 'api_error' | 'timeout' | 'parse_error';

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
  }
}

const BASE_URL = process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const API_KEY = process.env.DASHSCOPE_API_KEY ?? '';
const TIMEOUT_MS = 15_000;

// 惰性单例，避免每次调用重复实例化
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
  return _client;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

// chat：返回模型原始文本，不解析、不落库（留痕统一由 withAiLog 负责）
export async function chat({ model, messages, maxTokens = 1024 }: ChatOptions): Promise<string> {
  if (!API_KEY) throw new AiError('api_error', 'DASHSCOPE_API_KEY 未配置');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await getClient().chat.completions.create(
      {
        model,
        messages: messages as unknown as ChatCompletionMessageParam[],
        max_tokens: maxTokens,
      },
      { signal: controller.signal },
    );
    const content = res.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AiError('parse_error', '模型返回内容为空或非文本');
    }
    return content;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (controller.signal.aborted) throw new AiError('timeout', `请求超时（${TIMEOUT_MS}ms）`);
    throw new AiError('api_error', e instanceof Error ? e.message : 'AI 服务调用失败');
  } finally {
    clearTimeout(timer);
  }
}

export interface EmbedOptions {
  model: string;
  texts: string[];
  dimensions?: number;
}

// embed：返回每个文本对应的向量（number[]，R12 再序列化存 BLOB）
export async function embed({ model, texts, dimensions }: EmbedOptions): Promise<number[][]> {
  if (!API_KEY) throw new AiError('api_error', 'DASHSCOPE_API_KEY 未配置');
  if (texts.length === 0) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await getClient().embeddings.create(
      { model, input: texts, dimensions },
      { signal: controller.signal },
    );
    const vectors = res.data.map((d) => d.embedding);
    if (vectors.length !== texts.length || vectors.some((v) => !Array.isArray(v) || v.length === 0)) {
      throw new AiError('parse_error', '嵌入返回条数与入参不一致');
    }
    return vectors;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (controller.signal.aborted) throw new AiError('timeout', `请求超时（${TIMEOUT_MS}ms）`);
    throw new AiError('api_error', e instanceof Error ? e.message : '嵌入服务调用失败');
  } finally {
    clearTimeout(timer);
  }
}
