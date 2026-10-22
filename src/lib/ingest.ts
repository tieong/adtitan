import "server-only";

export type Source = {
  url: string;
  kind: "github" | "website";
  title: string;
  text: string;
  meta: Record<string, unknown>;
};

const MAX_TEXT = 7000;

export function normalizeUrl(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = new URL(s);
  u.hash = "";
  if (u.hostname === "www.github.com") u.hostname = "github.com";
  if (u.hostname === "github.com") {
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    if (owner && repo) return `https://github.com/${owner}/${repo.replace(/\.git$/, "")}`;
  }
  return u.toString().replace(/\/$/, "");
}

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    // Many marketing sites 403 unknown bots, so look like a regular browser.
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      ...headers,
    },
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

async function fromGithub(url: string): Promise<Source> {
  const [owner, repo] = new URL(url).pathname.split("/").filter(Boolean);
  const auth: Record<string, string> = process.env.GITHUB_TOKEN
    ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {};
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const info = await (await get(api, { accept: "application/vnd.github+json", ...auth })).json();
  let readme = "";
  try {
    readme = await (await get(`${api}/readme`, { accept: "application/vnd.github.raw", ...auth })).text();
  } catch {
    // Repos without a README still have a description and topics.
  }
  readme = readme
    .replace(/<img[^>]*>/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  return {
    url,
    kind: "github",
    title: info.name ?? repo,
    text: [
      `Repository: ${info.full_name}`,
      info.description && `Description: ${info.description}`,
      info.homepage && `Homepage: ${info.homepage}`,
      info.topics?.length && `Topics: ${info.topics.join(", ")}`,
      info.language && `Language: ${info.language}`,
      `README:\n${readme}`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_TEXT),
    meta: {
      stars: info.stargazers_count ?? 0,
      language: info.language ?? null,
      owner: info.owner?.login ?? owner,
      avatar: info.owner?.avatar_url ?? null,
      homepage: info.homepage || null,
    },
  };
}

function attr(html: string, re: RegExp) {
  return html.match(re)?.[1]?.trim() ?? null;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function fromWebsite(url: string): Promise<Source> {
  const html = await (await get(url, { accept: "text/html" })).text();
  const title =
    attr(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ??
    attr(html, /<title[^>]*>([^<]+)<\/title>/i) ??
    new URL(url).hostname;
  const description =
    attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ??
    attr(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i);
  const ogImage = attr(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
  const body = decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|h\d|li|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return {
    url,
    kind: "website",
    title: decode(title),
    text: [`Title: ${decode(title)}`, description && `Description: ${decode(description)}`, `Page text:\n${body}`]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_TEXT),
    meta: { ogImage: ogImage ? new URL(ogImage, url).toString() : null, host: new URL(url).hostname },
  };
}

// Fallback for sites behind bot protection: a hosted reader renders the page and returns text.
async function fromReader(url: string): Promise<Source> {
  const text = await (await get(`https://r.jina.ai/${url}`, { accept: "text/plain" })).text();
  const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? new URL(url).hostname;
  return { url, kind: "website", title, text: text.slice(0, MAX_TEXT), meta: { host: new URL(url).hostname } };
}

export async function ingest(url: string): Promise<Source> {
  if (new URL(url).hostname === "github.com") return fromGithub(url);
  try {
    return await fromWebsite(url);
  } catch (e) {
    console.warn("direct fetch failed, using reader", url, e instanceof Error ? e.message : e);
    return fromReader(url);
  }
}
