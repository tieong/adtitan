import "server-only";
import OpenAI from "openai";
import type { AdVariant, Palette } from "./types";
import type { Source } from "./ingest";

let openai: OpenAI | null = null;
function ai() {
  openai ??= new OpenAI();
  return openai;
}

export type AdCopy = {
  name: string;
  description: string;
  category: string;
  emoji: string;
  palette: Palette;
  variants: AdVariant[];
  imagePrompt: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "category", "emoji", "palette", "variants", "imagePrompt"],
  properties: {
    name: { type: "string", description: "Product name, short, as the makers call it." },
    description: {
      type: "string",
      description: "One sentence (max 22 words) explaining what it does and for whom. Concrete, no hype words.",
    },
    category: {
      type: "string",
      description: "One or two words, e.g. 'Dev tools', 'Health', 'Fintech', 'AI agents', 'Gaming'.",
    },
    emoji: { type: "string", description: "A single emoji that represents the product." },
    palette: {
      type: "object",
      additionalProperties: false,
      required: ["bg", "fg", "accent"],
      properties: {
        bg: { type: "string", description: "Dark background hex color, e.g. #0b1020." },
        fg: { type: "string", description: "Near-white text hex color with strong contrast on bg." },
        accent: { type: "string", description: "Vivid neon accent hex color that fits the brand." },
      },
    },
    variants: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      description:
        "Three distinct billboard ads for A/B/C testing. Each takes a different angle: (1) the benefit, (2) the pain it kills, (3) something bold or witty.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "subline", "cta"],
        properties: {
          headline: { type: "string", description: "Billboard slogan, max 7 words, punchy." },
          subline: { type: "string", description: "Supporting line, max 14 words." },
          cta: { type: "string", description: "Call to action, 2-4 words, e.g. 'Try it free'." },
        },
      },
    },
    imagePrompt: {
      type: "string",
      description:
        "Prompt for a wide 3:2 advertising key visual with NO text, NO letters, NO logos. Describe one striking central subject, cinematic lighting, dark background matching the palette.",
    },
  },
} as const;

export async function writeAd(src: Source): Promise<AdCopy> {
  const res = await ai().chat.completions.create({
    model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5.4-mini",
    reasoning_effort: "low",
    response_format: { type: "json_schema", json_schema: { name: "ad_campaign", strict: true, schema } },
    messages: [
      {
        role: "system",
        content:
          "You are a world-class creative director turning hackathon projects into billboard campaigns. " +
          "Read what the project actually does and write ads that a passer-by gets in two seconds. " +
          "Use the project's language (English unless the source is clearly in another language). Never invent features.",
      },
      { role: "user", content: `Source URL: ${src.url}\n\n${src.text}` },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("The model returned no ad copy");
  return JSON.parse(raw) as AdCopy;
}

export async function paintAd(copy: AdCopy): Promise<{ data: Buffer; mime: string }> {
  const res = await ai().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1-mini",
    prompt:
      `${copy.imagePrompt}\n\nStyle: premium advertising key visual, high contrast, ` +
      `dominant colors ${copy.palette.bg} and ${copy.palette.accent}. Absolutely no text or typography.`,
    size: "1536x1024",
    quality: "low",
    output_format: "jpeg",
    output_compression: 80,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned nothing");
  return { data: Buffer.from(b64, "base64"), mime: "image/jpeg" };
}
