export type ContentPlanSchemaV1 = {
  schemaVersion: "bagana.contentPlan.v1";
  extractedAt: string; // ISO
  brandName?: string;
  companyType?: string;
  website?: string;
  productType?: string;
  campaignType?: string;
  strategicOverview?: string;
  objectives?: string[];
  talentAssignments?: Array<{ talent: string; responsibilities: string[] }>;
  contentThemes?: string[];
  contentCalendarTimeline?: string[];
  keyMessaging?: string[];
  contentFormats?: string[];
  distributionStrategy?: string[];
  audit?: string[];
  unknownSections?: Record<string, string>;
  rawMarkdown: string;
};

function cleanLine(s: string): string {
  return (s || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function stripMarkdown(s: string): string {
  // minimal cleanup: remove leading markdown markers
  let out = (s || "").trim();
  out = out.replace(/^#+\s*/g, "");
  // remove bold markers (also covers stray ** like "Week 1**:")
  out = out.replace(/\*\*/g, "");
  return out.trim();
}

function parseListLines(block: string): string[] {
  const lines = (block || "").split("\n").map(cleanLine).filter(Boolean);
  const out: string[] = [];
  for (const ln of lines) {
    const m = ln.match(/^(?:-|\*|\d+\.)\s*(.+)$/);
    if (m?.[1]) out.push(stripMarkdown(m[1]));
    else if (ln) out.push(stripMarkdown(ln));
  }
  // de-dup while preserving order
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = x.trim();
    if (!k) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const KNOWN_SECTION_TITLES = [
  "Strategic Overview",
  "Objectives",
  "Talent Assignments",
  "Content Themes",
  "Content Calendar and Timeline",
  "Key Messaging",
  "Content Formats",
  "Distribution Strategy",
  "Audit",
] as const;

function isLooseSectionHeader(line: string): string | null {
  const l = stripMarkdown(cleanLine(line));
  if (!l) return null;
  for (const title of KNOWN_SECTION_TITLES) {
    if (l.toLowerCase() === title.toLowerCase()) return title;
    if (l.toLowerCase() === `${title.toLowerCase()}:`) return title;
  }
  return null;
}

function splitSections(md: string): Record<string, string> {
  const lines = (md || "").replace(/\r/g, "").split("\n");
  const sections: Record<string, string> = {};
  let current = "";
  let buf: string[] = [];

  const flush = () => {
    const key = current || "__preamble__";
    const val = buf.join("\n").trim();
    if (val) sections[key] = val;
    buf = [];
  };

  for (const raw of lines) {
    const line = raw ?? "";
    const hm = line.match(/^\s*#{1,6}\s+(.+?)\s*$/);
    if (hm?.[1]) {
      flush();
      current = stripMarkdown(hm[1]);
      continue;
    }
    const loose = isLooseSectionHeader(line);
    if (loose) {
      flush();
      current = loose;
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections;
}

function parseHeaderValue(md: string, label: string): string | undefined {
  const re = new RegExp(`^\\s*#*\\s*${label}\\s*:\\s*([^\\n\\r]+)\\s*$`, "im");
  const m = md.match(re);
  const v = m?.[1] ? stripMarkdown(m[1]) : "";
  return v || undefined;
}

function looksLikeTalentName(line: string): boolean {
  const l = stripMarkdown(cleanLine(line));
  // Common patterns: "Influencer A", "Creator 1", "Talent 2", "KOL B"
  return /^(?:Influencer|Creator|Talent|KOL)\s+[A-Za-z0-9]+$/i.test(l);
}

function splitResponsibilities(text: string): string[] {
  const cleaned = stripMarkdown(text);
  if (!cleaned) return [];
  return cleaned
    .split(/,|;|\u2022|\||\band\b/gi)
    .map((x) => stripMarkdown(x))
    .map((x) => x.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function parseTalentAssignments(block: string): Array<{ talent: string; responsibilities: string[] }> {
  const lines = (block || "").split("\n").map(cleanLine).filter(Boolean);
  const out: Array<{ talent: string; responsibilities: string[] }> = [];
  let currentTalent: string | null = null;
  let currentResp: string[] = [];

  const flush = () => {
    if (currentTalent) {
      const responsibilities = currentResp.length ? currentResp : [];
      out.push({ talent: currentTalent, responsibilities });
    }
    currentTalent = null;
    currentResp = [];
  };

  for (const ln of lines) {
    // Pattern 1: "Influencer A: Short videos, Live Q&A"
    const m = ln.match(/^(?:-|\*|\d+\.)?\s*([^:]{2,80})\s*:\s*(.+)$/);
    if (m?.[1] && m?.[2]) {
      flush();
      currentTalent = stripMarkdown(m[1]);
      currentResp = splitResponsibilities(m[2]);
      flush();
      continue;
    }

    // Pattern 2: multiline "Influencer A" then next line(s) responsibilities
    if (looksLikeTalentName(ln)) {
      flush();
      currentTalent = stripMarkdown(ln);
      continue;
    }
    // If we are inside a talent block, append responsibility lines until next talent
    if (currentTalent) {
      const maybeHeader = isLooseSectionHeader(ln);
      if (maybeHeader) {
        flush();
        // push header back by treating it in outer split; but since we're inside a block already, just stop
        continue;
      }
      const items = splitResponsibilities(ln);
      if (items.length) currentResp.push(...items);
      else {
        const t = stripMarkdown(ln);
        if (t) currentResp.push(t);
      }
    }
  }
  flush();

  // de-dup responsibilities per talent
  return out
    .map((x) => ({
      talent: x.talent,
      responsibilities: Array.from(new Set((x.responsibilities || []).map((r) => r.trim()).filter(Boolean))),
    }))
    .filter((x) => x.talent && x.responsibilities.length > 0);
}

export function parseContentPlanMarkdown(markdown: string): ContentPlanSchemaV1 {
  const rawMarkdown = (markdown || "").replace(/\r/g, "").trim();
  const sections = splitSections(rawMarkdown);

  // These often appear as "# Brand Name: X" style lines (even inside preamble)
  const brandName = parseHeaderValue(rawMarkdown, "Brand\\s+Name");
  const companyType = parseHeaderValue(rawMarkdown, "Company\\s+Type");
  const website = parseHeaderValue(rawMarkdown, "Website");
  const productType = parseHeaderValue(rawMarkdown, "Product\\s+Type");
  const campaignType = parseHeaderValue(rawMarkdown, "Campaign\\s+Type");

  const strategicOverview =
    sections["Strategic Overview"]?.trim() ||
    sections["Strategic overview"]?.trim() ||
    undefined;

  const objectives = sections["Objectives"] ? parseListLines(sections["Objectives"]) : undefined;
  const contentThemes = sections["Content Themes"] ? parseListLines(sections["Content Themes"]) : undefined;
  const contentCalendarTimeline = sections["Content Calendar and Timeline"]
    ? parseListLines(sections["Content Calendar and Timeline"])
    : undefined;
  const keyMessaging = sections["Key Messaging"] ? parseListLines(sections["Key Messaging"]) : undefined;
  const contentFormats = sections["Content Formats"] ? parseListLines(sections["Content Formats"]) : undefined;
  const distributionStrategy = sections["Distribution Strategy"]
    ? parseListLines(sections["Distribution Strategy"])
    : undefined;
  const audit = sections["Audit"] ? parseListLines(sections["Audit"]) : undefined;

  const talentAssignments = sections["Talent Assignments"]
    ? parseTalentAssignments(sections["Talent Assignments"])
    : undefined;

  const known = new Set([
    "__preamble__",
    "Strategic Overview",
    "Objectives",
    "Talent Assignments",
    "Content Themes",
    "Content Calendar and Timeline",
    "Key Messaging",
    "Content Formats",
    "Distribution Strategy",
    "Audit",
  ]);
  const unknownSections: Record<string, string> = {};
  for (const [k, v] of Object.entries(sections)) {
    if (!known.has(k) && v?.trim()) {
      unknownSections[k] = v.trim();
    }
  }

  return {
    schemaVersion: "bagana.contentPlan.v1",
    extractedAt: new Date().toISOString(),
    brandName,
    companyType,
    website,
    productType,
    campaignType,
    strategicOverview,
    objectives: objectives?.length ? objectives : undefined,
    talentAssignments: talentAssignments?.length ? talentAssignments : undefined,
    contentThemes: contentThemes?.length ? contentThemes : undefined,
    contentCalendarTimeline: contentCalendarTimeline?.length ? contentCalendarTimeline : undefined,
    keyMessaging: keyMessaging?.length ? keyMessaging : undefined,
    contentFormats: contentFormats?.length ? contentFormats : undefined,
    distributionStrategy: distributionStrategy?.length ? distributionStrategy : undefined,
    audit: audit?.length ? audit : undefined,
    unknownSections: Object.keys(unknownSections).length ? unknownSections : undefined,
    rawMarkdown,
  };
}

