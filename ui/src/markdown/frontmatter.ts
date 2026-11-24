import yaml from 'js-yaml';

export interface FrontmatterResult {
  attributes: Record<string, unknown> | null;
  body: string;
  lineOffset: number;
}

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function extractFrontmatter(raw: string): FrontmatterResult {
  const normalized = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  const match = FM_REGEX.exec(normalized);
  if (!match) {
    return { attributes: null, body: normalized, lineOffset: 0 };
  }

  const yamlText = match[1];
  const matchedBlock = match[0];
  const lineOffset = matchedBlock.split(/\r?\n/).length - 1;

  try {
    const parsed = yaml.load(yamlText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        attributes: parsed as Record<string, unknown>,
        body: normalized.slice(matchedBlock.length),
        lineOffset,
      };
    }
  } catch {
    // Malformed YAML frontmatter falls back to rendering raw Markdown
  }

  return { attributes: null, body: normalized, lineOffset: 0 };
}
