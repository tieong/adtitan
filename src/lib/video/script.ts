import "server-only";
import OpenAI from "openai";
import type { Campaign } from "../types";

export const VOICES = {
  liam: { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam — energetic creator" },
  charlie: { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie — deep, hyped" },
  brian: { id: "nPczCjzI2devNBz1zQrb", label: "Brian — deep, resonant" },
  laura: { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — enthusiastic, quirky" },
  jessica: { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica — playful, bright" },
  daniel: { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel — steady broadcaster" },
} as const;
export type VoiceKey = keyof typeof VOICES;

export type SceneKind = "hook" | "problem" | "solution" | "features" | "proof" | "cta";

export type Scene = {
  kind: SceneKind;
  /** Spoken line. May start with one ElevenLabs audio tag like [excited]. */
  voiceover: string;
  /** Big on-screen text, max 6 words. */
  title: string;
  /** Small label above the title. */
  kicker: string;
  /** Up to 3 short items, only used by "features". */
  bullets: string[];
};

export type VideoScript = {
  voice: VoiceKey;
  scenes: Scene[];
  musicPrompt: string;
  transitionSfx: string;
  endSfx: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["voice", "scenes", "musicPrompt", "transitionSfx", "endSfx"],
  properties: {
    voice: {
      type: "string",
      enum: Object.keys(VOICES),
      description: Object.entries(VOICES)
        .map(([k, v]) => `${k}: ${v.label}`)
        .join("; "),
    },
    scenes: {
      type: "array",
      minItems: 4,
      maxItems: 5,
      description:
        "Scenes in order. Must start with 'hook' and end with 'cta'. Pick the middle from problem, solution, features, proof. Use 'proof' only if there is a real number (stars, users, speed) in the source.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "voiceover", "title", "kicker", "bullets"],
        properties: {
          kind: { type: "string", enum: ["hook", "problem", "solution", "features", "proof", "cta"] },
          voiceover: {
            type: "string",
            description:
              "What the narrator says in this scene, 5-14 words, punchy spoken English. You may begin with ONE audio tag such as [excited], [confident], [whispers], [laughs]. The cta line must say the product name.",
          },
          title: { type: "string", description: "On-screen headline, 1-6 words. For proof: the number itself, e.g. '69k stars'." },
          kicker: { type: "string", description: "Tiny label above the title, 1-3 words, e.g. 'The problem', 'Meet', 'Open source'." },
          bullets: {
            type: "array",
            maxItems: 3,
            items: { type: "string" },
            description: "Only for 'features': 3 items of 2-4 words. Empty array otherwise.",
          },
        },
      },
    },
    musicPrompt: {
      type: "string",
      description: "Instrumental background music for this ad: genre, mood, BPM, instruments. No vocals.",
    },
    transitionSfx: { type: "string", description: "Short transition sound effect, e.g. 'fast airy whoosh'." },
    endSfx: { type: "string", description: "Sound for the final logo reveal, e.g. 'deep cinematic impact with shimmer'." },
  },
} as const;

export async function writeVideoScript(c: Campaign): Promise<VideoScript> {
  const openai = new OpenAI();
  const facts = [
    `Product: ${c.name} (${c.category})`,
    `What it does: ${c.description}`,
    `URL: ${c.url}`,
    `Billboard ads already written: ${c.variants.map((v) => `"${v.headline}" / ${v.subline} / CTA ${v.cta}`).join(" | ")}`,
    c.meta.stars ? `GitHub stars: ${c.meta.stars}` : "",
    c.meta.language ? `Language: ${c.meta.language}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5.4-mini",
    reasoning_effort: "low",
    response_format: { type: "json_schema", json_schema: { name: "video_ad", strict: true, schema } },
    messages: [
      {
        role: "system",
        content:
          "You write 15-18 second vertical video ads (TikTok/Reels style motion design) for hackathon projects. " +
          "Total voiceover 35-50 words. Fast, confident, concrete; never invent features or numbers. " +
          "Every scene's title must be readable in under a second.",
      },
      { role: "user", content: facts },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("The model returned no video script");
  const s = JSON.parse(raw) as VideoScript;
  if (s.scenes[s.scenes.length - 1]?.kind !== "cta") s.scenes[s.scenes.length - 1].kind = "cta";
  return s;
}
