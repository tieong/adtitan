// Usage: node scripts/seed.mjs [baseUrl] [url ...]
// Generates campaigns for the given URLs (or the default list), 3 at a time.
const base = process.argv[2] ?? "http://localhost:3077";
const urls = process.argv.slice(3).length
  ? process.argv.slice(3)
  : [
      "https://github.com/heygen-com/hyperframes",
      "https://aiven.io",
      "https://modal.com",
      "https://elevenlabs.io",
      "https://github.com/supabase/supabase",
      "https://lovable.dev",
      "https://github.com/lightdash/lightdash",
      "https://github.com/n8n-io/n8n",
      "https://github.com/tldraw/tldraw",
      "https://github.com/excalidraw/excalidraw",
      "https://github.com/ollama/ollama",
      "https://github.com/pmndrs/react-three-fiber",
    ];

async function one(url) {
  const res = await fetch(`${base}/api/campaigns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
  const err = lines.find((l) => l.step === "error");
  const done = lines.find((l) => l.step === "done");
  const img = lines.some((l) => l.step === "image");
  console.log(err ? `✗ ${url}: ${err.error}` : `✓ ${done.campaign.name} — "${done.campaign.variants[0].headline}"${img ? " +img" : done.cached ? " (cached)" : ""}`);
}

const queue = [...urls];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) await one(queue.shift()).catch((e) => console.log("✗", e.message));
  }),
);
