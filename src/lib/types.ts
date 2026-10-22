export type AdVariant = {
  headline: string;
  subline: string;
  cta: string;
};

export type Palette = {
  bg: string;
  fg: string;
  accent: string;
};

export type Campaign = {
  id: string;
  url: string;
  kind: "github" | "website";
  name: string;
  description: string;
  category: string;
  emoji: string;
  palette: Palette;
  variants: AdVariant[];
  imagePrompt: string;
  hasImage: boolean;
  meta: Record<string, unknown>;
  slot: number;
  createdAt: string;
};

export type EventType = "impression" | "click" | "visit";

export type TrackEvent = {
  type: EventType;
  campaignId: string;
  variant: number;
  sessionId: string;
  source: string;
};

export type VariantStats = {
  variant: number;
  impressions: number;
  clicks: number;
  visits: number;
};

export type CampaignStats = {
  campaignId: string;
  impressions: number;
  clicks: number;
  visits: number;
  ctr: number;
  uniqueViewers: number;
  variants: VariantStats[];
  series: { t: string; impressions: number; clicks: number }[];
};

export type Player = {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  x: number;
  z: number;
  ry: number;
  t: number;
};
