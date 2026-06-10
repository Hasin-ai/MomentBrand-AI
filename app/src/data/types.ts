export interface Brand {
  brand_id: string;
  brand_name: string;
  tagline: string;
  tagline_bn: string | null;
  industry: string;
  target_audience: string;
  brand_personality: string[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    palette: string[];
  };
  typography: {
    heading_font: string;
    heading_font_bn: string;
    body_font: string;
    body_font_bn: string;
  };
  logo_url: string | null;
  product_image_url: string | null;
  voice: {
    tone: string;
    language: string;
    formality: string;
  };
  do_not_use: string[];
}

export interface AdVariant {
  id: string;
  letter: string;
  angle: string;
  emotion: string;
  headline: string;
  primary: string;
  cta: string;
  visual: string;
  platform: string;
  audienceSeg: string;
  placement: string;
  ip: "clear" | "review" | "flag";
  risk: "low" | "medium" | "high";
  ipNote: string | null;
  grad: string;
  ad_image_url?: string;
  background_image_url?: string;
  asset_status?: "generated" | "failed";
  asset_error?: unknown;
}
