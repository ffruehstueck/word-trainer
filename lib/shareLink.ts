export type ShareMode = "exam" | "training";

export interface ShareConfig {
  file: string;
  mode: ShareMode;
  reverse: boolean;
  mix: boolean;
  shared: true;
}

export interface ShareLinkInput {
  file: string;
  mode: ShareMode;
  reverse: boolean;
  mix: boolean;
}

function parseFlag(value: string | null | undefined): boolean {
  return value === "1" || value === "true";
}

export function parseShareParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  allowedFiles: string[]
): ShareConfig | null {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return params.get(key) ?? undefined;
    }
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const file = get("file");
  const mode = get("mode");
  const shared = parseFlag(get("shared"));

  if (!shared || !file || (mode !== "exam" && mode !== "training")) {
    return null;
  }

  const allowed = new Set([...allowedFiles, "all"]);
  if (!allowed.has(file)) {
    return null;
  }

  return {
    file,
    mode,
    reverse: parseFlag(get("reverse")),
    mix: parseFlag(get("mix")),
    shared: true,
  };
}

export function buildShareSearchParams(input: ShareLinkInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set("file", input.file);
  params.set("mode", input.mode);
  params.set("reverse", input.reverse ? "1" : "0");
  params.set("mix", input.mix ? "1" : "0");
  params.set("shared", "1");
  return params;
}

export function buildShareUrl(origin: string, input: ShareLinkInput): string {
  const params = buildShareSearchParams(input);
  return `${origin.replace(/\/$/, "")}/?${params.toString()}`;
}
