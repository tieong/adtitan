import "server-only";
import { VOICES, type VideoScript } from "./script";

const API = "https://api.elevenlabs.io/v1";

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not set");
  return k;
}

async function post(path: string, body: unknown, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "xi-api-key": key(), "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) return res;
    // Concurrency limits on the Creator plan are low (2 music, 5 TTS): back off and retry.
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`ElevenLabs ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

export type Word = { text: string; start: number; end: number };
export type SceneTiming = { start: number; end: number };

export type Voiceover = {
  mp3: Buffer;
  duration: number;
  words: Word[];
  /** When each scene's spoken line starts and ends, in seconds. */
  scenes: SceneTiming[];
};

/**
 * One TTS call for the whole script so the read sounds continuous, then split
 * back into scenes and words with the character-level alignment.
 */
export async function voiceover(script: VideoScript): Promise<Voiceover> {
  const lines = script.scenes.map((s) => s.voiceover.trim());
  const text = lines.join(" ");
  const res = await post(`/text-to-speech/${VOICES[script.voice].id}/with-timestamps?output_format=mp3_44100_128`, {
    text,
    model_id: process.env.ELEVENLABS_TTS_MODEL ?? "eleven_v4",
    voice_settings: { stability: 0.4, similarity_boost: 0.8 },
  });
  const data = (await res.json()) as {
    audio_base64: string;
    alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
  };
  const { characters: chars, character_start_times_seconds: st, character_end_times_seconds: en } = data.alignment;

  // Mark characters that belong to [audio tags] so they never show up in captions.
  const spoken = chars.map(() => true);
  let inTag = false;
  chars.forEach((ch, i) => {
    if (ch === "[") inTag = true;
    if (inTag) spoken[i] = false;
    if (ch === "]") inTag = false;
  });

  const words: Word[] = [];
  let cur: Word | null = null;
  chars.forEach((ch, i) => {
    if (!spoken[i] || /\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: "", start: st[i], end: en[i] };
    cur.text += ch;
    cur.end = en[i];
  });
  if (cur) words.push(cur);

  // Scene boundaries: offsets of each line inside the joined text.
  const scenes: SceneTiming[] = [];
  let offset = 0;
  for (const line of lines) {
    const from = offset;
    const to = offset + line.length;
    offset = to + 1;
    const idx = [...Array(to - from).keys()].map((k) => from + k).filter((i) => spoken[i] && !/\s/.test(chars[i] ?? ""));
    scenes.push({
      start: idx.length ? st[idx[0]] : 0,
      end: idx.length ? en[idx[idx.length - 1]] : 0,
    });
  }

  return {
    mp3: Buffer.from(data.audio_base64, "base64"),
    duration: en[en.length - 1] ?? 0,
    words,
    scenes,
  };
}

async function body(res: Response) {
  return Buffer.from(await res.arrayBuffer());
}

export async function music(prompt: string, seconds: number): Promise<Buffer> {
  const res = await post(`/music?output_format=mp3_44100_128`, {
    prompt: `${prompt}. Instrumental only, punchy intro, clean ending.`,
    music_length_ms: Math.round(Math.min(Math.max(seconds, 10), 60) * 1000),
    model_id: "music_v2_5",
    force_instrumental: true,
  });
  return body(res);
}

export async function sfx(text: string, seconds: number): Promise<Buffer> {
  const res = await post(`/sound-generation?output_format=mp3_44100_128`, {
    text,
    duration_seconds: seconds,
    prompt_influence: 0.5,
    model_id: "eleven_text_to_sound_v3",
  });
  return body(res);
}
