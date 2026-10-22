// Generates the isometric anime city sprites with OpenAI images.
// Usage: node scripts/gen-city-assets.mjs [name ...]   (reads OPENAI_API_KEY from .env.local)
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const KEY = env.OPENAI_API_KEY;
const MODEL = process.env.MODEL ?? "gpt-image-1.5";
const OUT = "public/city/raw";

const STYLE =
  "Isometric game asset for a cozy anime city builder. Exactly one subject, centered, fully inside the frame with margin. " +
  "True isometric 3/4 view: camera 30 degrees above the ground, rotated 45 degrees, so two side faces are visible. " +
  "Modern anime / Studio Ghibli inspired illustration, soft cel shading, clean thin dark outlines, bright midday sunlight from the top left, " +
  "fresh saturated pastel colors. Transparent background. No ground tile, no shadow on the ground, no text, no letters, no logos.";

const CHAR =
  "Character sprite sheet: the SAME chibi anime character drawn twice side by side, full body, same outfit and colors in both, " +
  "LEFT half: three-quarter front view walking toward the viewer and slightly to the left. RIGHT half: three-quarter back view walking away from the viewer and slightly to the right. " +
  "Cute 3-heads-tall proportions, expressive anime eyes, modern anime style, soft cel shading, clean dark outlines, bright daylight. " +
  "Transparent background, no ground, no shadow, no text.";

const ASSETS = {
  // buildings
  ramen: `${STYLE} A small two-story Japanese ramen shop with red noren curtains, paper lanterns, wooden facade, tiled roof.`,
  cafe: `${STYLE} A cute corner coffee shop with a striped awning, big windows, potted plants and a small chalkboard sign without text.`,
  startup: `${STYLE} A modern four-story glass and white concrete tech startup office with rooftop garden and solar panels.`,
  tower: `${STYLE} A tall slim residential apartment tower, eight floors, balconies with plants and laundry, warm beige walls.`,
  arcade: `${STYLE} A colorful two-story arcade game center with pink and cyan facade panels, claw machines visible through the windows.`,
  konbini: `${STYLE} A Japanese convenience store, one story, white facade with green and blue stripes, glass front, vending machines beside it.`,
  library: `${STYLE} A red brick bookstore and library, two stories, arched windows, ivy on the walls, a small clock above the door.`,
  hall: `${STYLE} A large modern hackathon event hall with a curved roof, glass entrance, colorful flags on poles, people-free.`,
  // props
  sakura: `${STYLE} A single blooming cherry blossom tree with a round pink canopy.`,
  tree: `${STYLE} A single round leafy green park tree.`,
  vending: `${STYLE} A single Japanese drink vending machine, blue and white.`,
  bench: `${STYLE} A single wooden park bench with metal legs.`,
  fountain: `${STYLE} A round stone plaza fountain with clear blue water.`,
  // characters
  c1: `${CHAR} A girl with short pink hair, oversized lime green hoodie, black shorts, white sneakers, holding a laptop.`,
  c2: `${CHAR} A boy with messy black hair, big headphones around his neck, navy jacket, cargo pants.`,
  c3: `${CHAR} A girl with long purple hair in a ponytail, denim jacket, yellow skirt, carrying a tote bag.`,
  c4: `${CHAR} A tall boy with round glasses, orange beanie, green backpack, beige trench coat.`,
  c5: `${CHAR} A girl with blond twin tails, sailor-style school uniform, red bow, holding a smartphone.`,
  c6: `${CHAR} A boy with silver spiky hair, black techwear jacket with cyan lines, fingerless gloves.`,
  c7: `${CHAR} A girl with dark skin and curly brown hair, white t-shirt with a rocket graphic, overalls, sneakers.`,
  c8: `${CHAR} A boy with brown hair and freckles, red varsity jacket, jeans, skateboard under his arm.`,
};

async function gen(name) {
  const file = path.join(OUT, `${name}.png`);
  if (fs.existsSync(file)) return console.log("skip", name);
  const isChar = /^c\d+$/.test(name);
  const t = Date.now();
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: ASSETS[name],
      size: isChar ? "1536x1024" : "1024x1024",
      quality: "medium",
      background: "transparent",
      output_format: "png",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  fs.writeFileSync(file, Buffer.from(data.data[0].b64_json, "base64"));
  console.log("ok", name, `${Math.round((Date.now() - t) / 1000)}s`);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ASSETS);
const queue = [...names];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const n = queue.shift();
      await gen(n).catch((e) => console.log("FAIL", e.message));
    }
  }),
);
