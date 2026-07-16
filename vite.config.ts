import { defineConfig, loadEnv, type Plugin } from "vite";
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeUserMessage,
  parseJudgeJson,
} from "./src/game/judgeRubric";
import {
  RIZZ_SYSTEM_PROMPT,
  buildRizzUserMessage,
  parseRizzJson,
} from "./src/game/rizzPrompt";
import type { RizzPersona } from "./src/data/rizzScenarios";
import type { RizzChatMessage } from "./src/game/rizzLocal";
import { chatCompletion, llmAvailable, llmProviderNames } from "./src/server/llm";

function envBag(mode: string): Record<string, string | undefined> {
  const loaded = loadEnv(mode, process.cwd(), "");
  return { ...process.env, ...loaded };
}

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

        const env = envBag(server.config.mode);
        if (!llmAvailable(env)) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "No AI provider configured",
              available: false,
            }),
          );
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

          const ai = await chatCompletion(
            [
              { role: "system", content: JUDGE_SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
            { temperature: 0.45, maxTokens: 280, env },
          );

          if (!ai) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "All AI providers failed" }));
            return;
          }

          const parsed = parseJudgeJson(ai.content);
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
              provider: ai.provider,
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
        const env = envBag(server.config.mode);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            available: llmAvailable(env),
            providers: llmProviderNames(env),
          }),
        );
      });

      server.middlewares.use("/api/rizz-turn", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const env = envBag(server.config.mode);
        if (!llmAvailable(env)) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "No AI provider configured",
              available: false,
            }),
          );
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
          }
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            personaId?: string;
            gender?: string;
            name?: string;
            handle?: string;
            vibe?: string;
            storyCaption?: string;
            personality?: string;
            hardNos?: string[];
            softYes?: string[];
            history?: RizzChatMessage[];
            playerMessage?: string;
            interest?: number;
            turn?: number;
            isStoryReply?: boolean;
          };

          const playerMessage = String(body.playerMessage ?? "").trim();
          if (playerMessage.length < 1) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Empty message" }));
            return;
          }

          const interest =
            typeof body.interest === "number" ? Math.max(0, Math.min(100, body.interest)) : 40;
          const turn = typeof body.turn === "number" ? body.turn : 1;

          const persona: RizzPersona = {
            id: String(body.personaId ?? "npc"),
            gender: body.gender === "male" ? "male" : "female",
            name: String(body.name ?? "Alex"),
            handle: String(body.handle ?? "alex"),
            vibe: String(body.vibe ?? "chill"),
            storyCaption: String(body.storyCaption ?? ""),
            image: "",
            accent: "#888",
            accent2: "#111",
            emoji: "✨",
            personality: String(body.personality ?? "friendly"),
            hardNos: Array.isArray(body.hardNos) ? body.hardNos.map(String) : [],
            softYes: Array.isArray(body.softYes) ? body.softYes.map(String) : [],
            replies: { warm: [], cold: [], like: [], ghost: [] },
          };

          const history = Array.isArray(body.history)
            ? body.history
                .filter((m) => m && (m.role === "user" || m.role === "npc"))
                .map((m) => ({ role: m.role, text: String(m.text).slice(0, 200) }))
                .slice(-12)
            : [];

          const userMsg = buildRizzUserMessage({
            persona,
            history,
            playerMessage,
            interest,
            turn,
            isStoryReply: Boolean(body.isStoryReply),
          });

          const ai = await chatCompletion(
            [
              { role: "system", content: RIZZ_SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
            { temperature: 0.75, maxTokens: 220, env },
          );

          if (!ai) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "All AI providers failed" }));
            return;
          }

          const parsed = parseRizzJson(ai.content, interest);
          if (!parsed) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Bad AI response" }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ available: true, provider: ai.provider, ...parsed }));
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
