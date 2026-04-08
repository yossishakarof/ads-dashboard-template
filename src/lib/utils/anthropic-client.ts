/**
 * Claude Code Local Client
 *
 * Uses @anthropic-ai/claude-agent-sdk to run queries via the local
 * Claude Code CLI. No API key needed - uses your existing Claude Code auth.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * Check if Claude Code CLI is available
 */
export function hasClaudeCode(): boolean {
  return true;
}

interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

/**
 * Generate text using local Claude Code
 */
export async function generateText(
  options: GenerateTextOptions
): Promise<{ text: string; error?: string }> {
  const { prompt, systemPrompt } = options;

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${prompt}`
    : prompt;

  try {
    let result = "";
    for await (const message of query({
      prompt: fullPrompt,
      options: {
        maxTurns: 1,
        allowedTools: [],
      },
    })) {
      if ("result" in message) {
        result = message.result;
      }
    }

    if (!result) {
      return { text: "", error: "No response from Claude Code" };
    }

    return { text: result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Claude Code query failed";
    console.error("[Claude Code]", errorMsg);
    return { text: "", error: errorMsg };
  }
}
