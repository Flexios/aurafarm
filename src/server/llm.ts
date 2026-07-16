/**
 * Dev/Vite re-export — production serverless uses api/_lib/llm.ts
 */
export type { LlmMessage } from "../../api/lib/llm";

import type { LlmMessage } from "../../api/lib/llm";
import {
  chatCompletion as apiChat,
  llmAvailable as apiAvailable,
  llmProviderNames as apiNames,
  listProviders,
} from "../../api/lib/llm";

export type LlmEnv = Record<string, string | undefined>;

/** Apply env overlay for Vite middleware (loadEnv), then call providers. */
function withEnv(env: LlmEnv, fn: () => unknown): unknown {
  const saved: LlmEnv = {};
  const keys = Object.keys(env);
  for (const k of keys) {
    saved[k] = process.env[k];
    if (env[k] !== undefined) process.env[k] = env[k];
  }
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

export function listLlmProviders(env: LlmEnv = {}) {
  return withEnv(env, () => listProviders()) as ReturnType<typeof listProviders>;
}

export function llmAvailable(env: LlmEnv = {}): boolean {
  return withEnv(env, () => apiAvailable()) as boolean;
}

export function llmProviderNames(env: LlmEnv = {}): string[] {
  return withEnv(env, () => apiNames()) as string[];
}

export async function chatCompletion(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number; env?: LlmEnv } = {},
): Promise<{ content: string; provider: string } | null> {
  const env = opts.env ?? {};
  const keys = Object.keys(env);
  const saved: LlmEnv = {};
  for (const k of keys) {
    saved[k] = process.env[k];
    if (env[k] !== undefined) process.env[k] = env[k];
  }
  try {
    return await apiChat(messages, {
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
