import { defineConfig, loadEnv, type Plugin } from "vite";

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
            prompt: string;
            answer: string;
            core: string;
          };

          const system = `You are the Aura Judge for AuraFarm, a Gen Z vibe game. Score the player's answer 0-100 for aura/vibe quality. Consider: originality, confidence, aesthetic fit to their core (${body.core}), humor, and shareability. Keep content PG-13. Reply ONLY with compact JSON: {"score":number,"verdict":string,"tags":string[]} where verdict is a short hype line (max 12 words) and tags are 2-4 vibe words.`;

          const resp = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "grok-4.5",
              temperature: 0.7,
              messages: [
                { role: "system", content: system },
                {
                  role: "user",
                  content: `Challenge: ${body.prompt}\nAesthetic core: ${body.core}\nAnswer: ${body.answer}`,
                },
              ],
            }),
          });

          if (!resp.ok) {
            const text = await resp.text();
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "AI judge failed", detail: text.slice(0, 200) }));
            return;
          }

          const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content ?? "";
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Bad AI response" }));
            return;
          }

          const parsed = JSON.parse(match[0]) as {
            score: number;
            verdict: string;
            tags: string[];
          };

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              available: true,
              score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
              verdict: String(parsed.verdict || "Aura secured."),
              tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 4) : [],
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
