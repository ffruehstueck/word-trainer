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
  return value === "1" || value === "true" || value === "";
}

function getParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (params instanceof URLSearchParams) {
      if (params.has(key)) {
        return params.get(key) ?? "";
      }
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const raw = params[key];
      if (Array.isArray(raw)) return raw[0] ?? "";
      return raw ?? "";
    }
  }
  return undefined;
}

function parseMode(value: string | undefined): ShareMode | null {
  if (value === "e" || value === "exam") return "exam";
  if (value === "t" || value === "training") return "training";
  return null;
}

function resolveFile(raw: string, allowedFiles: string[]): string | null {
  const allowed = new Set([...allowedFiles, "all"]);
  if (allowed.has(raw)) return raw;
  if (!raw.endsWith(".json")) {
    const withJson = `${raw}.json`;
    if (allowed.has(withJson)) return withJson;
  }
  return null;
}

function compactFile(file: string): string {
  return file.endsWith(".json") ? file.slice(0, -5) : file;
}

export function parseShareParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  allowedFiles: string[]
): ShareConfig | null {
  const sharedRaw = getParam(params, "s", "shared");
  if (sharedRaw === undefined || !parseFlag(sharedRaw)) {
    return null;
  }

  const fileRaw = getParam(params, "f", "file");
  const mode = parseMode(getParam(params, "m", "mode"));
  if (!fileRaw || !mode) return null;

  const file = resolveFile(fileRaw, allowedFiles);
  if (!file) return null;

  const reverseRaw = getParam(params, "r", "reverse");
  const mixRaw = getParam(params, "x", "mix");

  return {
    file,
    mode,
    reverse: reverseRaw !== undefined && parseFlag(reverseRaw),
    mix: mixRaw !== undefined && parseFlag(mixRaw),
    shared: true,
  };
}

export function buildShareSearchParams(input: ShareLinkInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set("f", compactFile(input.file));
  params.set("m", input.mode === "exam" ? "e" : "t");
  if (input.reverse) params.set("r", "1");
  if (input.mix) params.set("x", "1");
  params.set("s", "1");
  return params;
}

export function buildShareUrl(origin: string, input: ShareLinkInput): string {
  const params = buildShareSearchParams(input);
  return `${origin.replace(/\/$/, "")}/?${params.toString()}`;
}
