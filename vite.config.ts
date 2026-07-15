import { defineConfig, loadEnv, type Plugin } from "vite";
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeUserMessage,
  parseJudgeJson,
} from "./src/game/judgeRubric";

function aiJudgeProxy(): Plugin {
  return {
    name: "aurafarm-ai-judge",
    configureServer(server) {
      server.middlewares.use("/api/judge", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const env = loadEnv(server.config.mode, process.cwd(), "");
        const apiKey = env.XAI_API_KEY || process.env.XAI_API_KEY;
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "XAI_API_KEY not configured", available: false }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
          }
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            prompt?: string;
            answer?: string;
            core?: string;
            title?: string;
            hint?: string;
            category?: string;
            coreLabel?: string;
            streak?: number;
          };

          const answer = String(body.answer ?? "").trim();
          if (answer.length < 1) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Empty answer" }));
            return;
          }

          const userMsg = buildJudgeUserMessage({
            title: body.title,
            prompt: String(body.prompt ?? ""),
            hint: body.hint,
            category: body.category,
            core: String(body.core ?? "main-character"),
            coreLabel: body.coreLabel,
            answer,
            streak: body.streak,
          });

          const resp = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "grok-4.5",
              temperature: 0.45,
              max_tokens: 280,
              messages: [
                { role: "system", content: JUDGE_SYSTEM_PROMPT },
                { role: "user", content: userMsg },
              ],
            }),
          });

          if (!resp.ok) {
            const text = await resp.text();
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "AI judge failed", detail: text.slice(0, 240) }));
            return;
          }

          const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content ?? "";
          const parsed = parseJudgeJson(content);
          if (!parsed) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Bad AI response" }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              available: true,
              score: parsed.score,
              verdict: parsed.verdict,
              tags: parsed.tags.length ? parsed.tags : ["ai-judged"],
              breakdown: parsed.breakdown,
            }),
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Unknown error",
            }),
          );
        }
      });

      server.middlewares.use("/api/ai-status", (_req, res) => {
        const env = loadEnv(server.config.mode, process.cwd(), "");
        const available = Boolean(env.XAI_API_KEY || process.env.XAI_API_KEY);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ available }));
      });
    },
  };
}

export default defineConfig({
  plugins: [aiJudgeProxy()],
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
});
