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

const TIMEOUT_MS = 15_000;

// 两个通道都是 OpenAI 兼容端点，按模型名前缀路由：
//   deepseek-*  → DeepSeek 官方（只支持纯文本）
//   其他（qwen-* / text-embedding-*）→ 阿里百炼
// 这样换模型只改 .env.local，不动代码。
type ProviderName = 'dashscope' | 'deepseek';

interface ProviderConf {
  name: ProviderName;
  baseURL: string;
  apiKey: string;
}

export function providerOf(model: string): ProviderName {
  return model.trim().toLowerCase().startsWith('deepseek') ? 'deepseek' : 'dashscope';
}

function confOf(model: string): ProviderConf {
  if (providerOf(model) === 'deepseek') {
    return {
      name: 'deepseek',
      baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    };
  }
  return {
    name: 'dashscope',
    baseURL:
      process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.DASHSCOPE_API_KEY ?? '',
  };
}

// 模型是否配置了密钥；没有密钥就不发请求，直接走降级
export function hasModelKey(model: string): boolean {
  if (!model) return false;
  return confOf(model).apiKey.length > 0;
}

// 是否具备识图能力：DeepSeek 官方 API 目前无视觉模型，图片会直接被拒。
// 判定优先看配置：写在 VLM_MODEL 里的就是视觉模型 —— 换供应商时模型名可能不带 vl
// （glm-4v-flash、qwen2.5-vl 都算视觉，DeepSeek 文本模型不算），靠正则硬猜容易误判。
// 不可用时调用方应降级为纯文本。
export function canUseVision(model: string): boolean {
  if (!hasModelKey(model)) return false;
  if (providerOf(model) !== 'dashscope') return false;
  const name = model.trim().toLowerCase();
  const configured = process.env.VLM_MODEL?.trim().toLowerCase();
  if (configured && name === configured) return true;
  return /vl|vision|-4v|omni|gpt-4o|gemini/i.test(name);
}

// 惰性单例（按通道各一个），避免每次调用重复实例化
const clients = new Map<ProviderName, OpenAI>();
function getClient(conf: ProviderConf): OpenAI {
  const cached = clients.get(conf.name);
  if (cached) return cached;
  const client = new OpenAI({ apiKey: conf.apiKey, baseURL: conf.baseURL });
  clients.set(conf.name, client);
  return client;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

// chat：返回模型原始文本，不解析、不落库（留痕统一由 withAiLog 负责）
export async function chat({
  model,
  messages,
  maxTokens = 1024,
  temperature,
}: ChatOptions): Promise<string> {
  const conf = confOf(model);
  if (!conf.apiKey) {
    throw new AiError('api_error', `${conf.name} 通道未配置 API Key（模型 ${model}）`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await getClient(conf).chat.completions.create(
      {
        model,
        messages: messages as unknown as ChatCompletionMessageParam[],
        max_tokens: maxTokens,
        ...(temperature === undefined ? {} : { temperature }),
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
  const conf = confOf(model);
  if (!conf.apiKey) {
    throw new AiError('api_error', `${conf.name} 通道未配置 API Key（模型 ${model}）`);
  }
  if (texts.length === 0) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await getClient(conf).embeddings.create(
      { model, input: texts, dimensions },
      { signal: controller.signal },
    );
    // 少数异常响应会带 200 但 body 是错误结构，直接 .map 会抛 "Cannot read properties of undefined"，
    // 留痕里只剩一句 JS 报错，排查时看不出是账号还是参数问题。
    if (!res || !Array.isArray(res.data)) {
      throw new AiError(
        'parse_error',
        `嵌入接口返回结构异常：${JSON.stringify(res ?? null).slice(0, 300)}`,
      );
    }
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
