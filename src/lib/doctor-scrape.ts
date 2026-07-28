import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Imports physicians from a practice's public website.
 *
 * Practice sites have no reliable structure to key off — the reference site
 * (cvmedpc.com) ships no JSON-LD, no og: tags and no stable class names, and the
 * next practice will be on a different CMS entirely. So instead of CSS selectors
 * we strip each page to text and let a model fill a strict schema. Stripping is
 * what makes this cheap: raw markup is ~100k+ tokens of script/nav, the text is
 * a few thousand.
 *
 * Scraping happens once, on demand, behind an admin review step — screens read
 * the saved `Doctor` rows and never call this.
 */

// Extraction is schema-bound field-filling, not reasoning: Haiku is the right
// size, and structured outputs (not the model's judgement) enforce correctness.
const MODEL = "claude-haiku-4-5";
// A cap, not a spend — billing is on tokens actually produced, so leave headroom
// rather than risk truncating a long bio mid-field.
const MAX_TOKENS = 16000;

const FETCH_TIMEOUT_MS = 20_000;
const MAX_LINKS = 400;
const MAX_DIRECTORIES = 5;
const MAX_DOCTORS = 60;

export type ScrapedDoctor = {
  name: string;
  credentials: string | null;
  title: string | null;
  specialty: string | null;
  photoUrl: string | null;
  bio: string | null;
  education: string[];
  boardCertifications: string[];
  languages: string[];
  acceptingNewPatients: boolean | null;
  sourceUrl: string;
};

// The fields shared by both extraction modes.
const doctorFields = {
  name: z.string().describe("Full name without post-nominals, e.g. 'Waseem Ahmad'."),
  credentials: z.string().nullable().describe("Post-nominals only, e.g. 'MD' or 'DO, FACC'."),
  title: z.string().nullable().describe("Role at the practice, e.g. 'Medical Director of the Sleep Lab'."),
  specialty: z.string().nullable().describe("Primary clinical specialty, e.g. 'Sleep Medicine'."),
  photoUrl: z
    .string()
    .nullable()
    .describe("The candidate image URL that is this physician's headshot, copied verbatim. Null if none."),
  bio: z.string().nullable().describe("Biography as prose, suitable to show a patient. Null if absent."),
  education: z.array(z.string()).describe("Degrees, residencies, fellowships, one per entry."),
  boardCertifications: z.array(z.string()),
  languages: z.array(z.string()).describe("Languages spoken. Empty if not stated."),
  acceptingNewPatients: z.boolean().nullable(),
} as const;

// One-physician-per-page sites (e.g. large groups with individual profiles).
const DoctorSchema = z.object({
  isPhysicianProfile: z
    .boolean()
    .describe("True only if this page is one individual physician's profile."),
  ...doctorFields,
});

// Team/About/Providers pages that introduce several clinicians inline (common for
// smaller practices with no per-doctor pages).
const DoctorsPageSchema = z.object({
  doctors: z
    .array(z.object(doctorFields))
    .describe(
      "One entry per DISTINCT, NAMED clinician this page introduces with real detail (a bio, credentials, " +
        "education, or a headshot). Every entry MUST have a real full name — a first AND last name. " +
        "Do NOT create an entry from: a surname alone (e.g. 'Mittal'), the practice's name, a family name, " +
        "or a combined practice description or specialty. If the same person appears more than once, include " +
        "them only once. Skip staff without clinical detail and entries that are only a link to elsewhere.",
    ),
});

// Sorts a practice's nav into the two layouts we handle, in one pass.
const RosterClassSchema = z.object({
  teamPages: z
    .array(z.string())
    .describe(
      "Pages that introduce the clinicians INLINE with photos/bios — About Us, Meet the Team, Our Providers, " +
        "Our Physicians, Our Doctors. These have the bios on the page itself.",
    ),
  directoryPages: z
    .array(z.string())
    .describe(
      "Pages that LIST clinicians as links out to a separate profile page per person (a 'find a doctor' / " +
        "physician directory). These link elsewhere rather than holding the bios.",
    ),
});

const UrlListSchema = z.object({
  urls: z.array(z.string()).describe("Matching URLs, copied verbatim from the list."),
});

const BlurbSchema = z.object({
  blurb: z
    .string()
    .describe(
      "A warm, patient-facing introduction for a waiting-room screen: exactly 2 short, complete " +
        "sentences, no more than 230 characters total. Plain prose (no markdown, lists, or headings). " +
        "End on a finished sentence — never trail off. Summarize their specialty and background at a high " +
        "level; do NOT list every institution, city, or office location. Base it ONLY on the details " +
        "provided; never invent facts. If little is known, write one complete sentence.",
    ),
});

// The card fits roughly this much text without clipping; a hard cap guarantees fit
// even if the model runs long. We trim to a sentence boundary so it never ellipsizes.
const BLURB_MAX_CHARS = 240;

/** Trim to the last complete sentence within the cap — no mid-word cut, no "…". */
function trimBlurb(text: string): string {
  const t = text.trim();
  if (t.length <= BLURB_MAX_CHARS) return t;
  const cut = t.slice(0, BLURB_MAX_CHARS);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > 60) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim();
}

/** The structured fields a screen blurb is written from. */
export type BlurbSource = {
  name: string;
  credentials?: string | null;
  title?: string | null;
  specialty?: string | null;
  bio?: string | null;
  education?: string[];
  boardCertifications?: string[];
  languages?: string[];
};

/**
 * Rephrase a doctor's scraped details into a short, self-contained introduction
 * sized to fit the card without truncation. Run once at import, not per playback.
 * Returns null if there's nothing to say or the model call fails — callers fall
 * back to the raw bio.
 */
export async function generateScreenBlurb(d: BlurbSource): Promise<string | null> {
  const facts = [
    `Name: ${d.name}${d.credentials ? `, ${d.credentials}` : ""}`,
    d.title ? `Role: ${d.title}` : "",
    d.specialty ? `Specialty: ${d.specialty}` : "",
    d.education?.length ? `Education: ${d.education.join("; ")}` : "",
    d.boardCertifications?.length ? `Board certifications: ${d.boardCertifications.join("; ")}` : "",
    d.languages?.length ? `Languages: ${d.languages.join(", ")}` : "",
    d.bio ? `Biography: ${d.bio}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  // Nothing beyond a name — a generated blurb would just be filler.
  if (!d.bio && !d.specialty && !d.title && !d.education?.length) return null;

  try {
    const res = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content:
            "Write a brief introduction for this physician to display to patients on a waiting-room " +
            "screen. Use only the details below.\n\n" +
            facts,
        },
      ],
      output_config: { format: zodOutputFormat(BlurbSchema) },
    });
    const blurb = res.parsed_output?.blurb?.trim();
    return blurb ? trimBlurb(blurb) : null;
  } catch {
    return null;
  }
}

function anthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env (local) or as a wrangler secret (deployed).",
    );
  }
  return new Anthropic({ apiKey });
}

// --- HTML handling -------------------------------------------------------

/** Resolve href against the page, dropping fragments and non-http schemes. */
function absoluteUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Strip markup to readable text — the step that makes extraction cheap and accurate. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|head|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Link = { url: string; text: string };

/** Same-origin links as {url, text}, deduped by URL. */
export function extractLinks(html: string, baseUrl: string): Link[] {
  const origin = new URL(baseUrl).origin;
  const found = new Map<string, string>();
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && found.size < MAX_LINKS) {
    const url = absoluteUrl(m[1], baseUrl);
    if (!url || new URL(url).origin !== origin) continue;
    const text = htmlToText(m[2]).replace(/\s+/g, " ").trim().slice(0, 120);
    if (!found.has(url)) found.set(url, text);
  }
  return [...found].map(([url, text]) => ({ url, text }));
}

/**
 * Candidate image URLs. Text stripping throws away <img> tags, so headshots are
 * collected separately and offered to the model as a list to choose from.
 */
export function extractImages(html: string, baseUrl: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /<img\b[^>]*\bsrc=["']([^"']+)["']/gi,
    /<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const url = absoluteUrl(m[1], baseUrl);
      if (url && /\.(jpe?g|png|webp)(\?|$)/i.test(url)) found.add(url);
    }
  }
  return [...found].slice(0, 60);
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ClinicScreenBot/1.0 (practice website import)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}).`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) throw new Error(`${url} is not a web page.`);
  return res.text();
}

// --- Model calls ---------------------------------------------------------

async function pickUrls(instruction: string, links: { url: string; text: string }[]): Promise<string[]> {
  if (links.length === 0) return [];
  const listing = links.map((l) => `${l.url}\t${l.text}`).join("\n");
  const res = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `${instruction}\n\nEach line is a URL and its link text, tab-separated.\nReturn only URLs copied exactly from this list; return an empty array if none match.\n\n${listing}`,
      },
    ],
    output_config: { format: zodOutputFormat(UrlListSchema) },
  });
  const urls = res.parsed_output?.urls ?? [];
  // The model can only choose, never invent — drop anything not on the list.
  const allowed = new Set(links.map((l) => l.url));
  return urls.filter((u) => allowed.has(u));
}

function nameSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(dr|doctor|md|do|np|pa|facc|phd|faap|dnp|arnp)\b/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Common team-page paths, tried when a site's nav doesn't reveal one (JS menus,
// unusual labels). Cheap insurance that we still find the roster.
const COMMON_TEAM_PATHS = [
  "about-us", "about", "our-team", "team", "meet-the-team", "meet-our-team", "our-providers",
  "providers", "our-physicians", "physicians", "our-doctors", "doctors", "our-staff", "staff",
  "find-a-doctor", "find-a-provider", "our-practice", "meet-the-doctors", "meet-our-doctors",
];

/** Sort the practice's nav into inline-team pages vs profile directories. */
async function classifyRosterPages(
  homeLinks: Link[],
): Promise<{ teamPages: string[]; directoryPages: string[] }> {
  if (homeLinks.length === 0) return { teamPages: [], directoryPages: [] };
  const listing = homeLinks.map((l) => `${l.url}\t${l.text}`).join("\n");
  const allowed = new Set(homeLinks.map((l) => l.url));
  try {
    const res = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content:
            "Sort these navigation links for a medical practice. Each line is a URL and its link text.\n" +
            "Copy URLs verbatim from the list; ignore services, blog, contact, careers, patient-resources, " +
            "and location pages.\n\n" +
            listing,
        },
      ],
      output_config: { format: zodOutputFormat(RosterClassSchema) },
    });
    const c = res.parsed_output;
    return {
      teamPages: (c?.teamPages ?? []).filter((u) => allowed.has(u)),
      directoryPages: (c?.directoryPages ?? []).filter((u) => allowed.has(u)),
    };
  } catch {
    return { teamPages: [], directoryPages: [] };
  }
}

/**
 * GET candidate URLs, keeping the ones that are real HTML pages — and dropping any
 * that redirect back to the homepage (a common soft-404), so we don't mine the
 * homepage as if it were a team page.
 */
async function keepReachable(urls: string[], homeUrl: string): Promise<string[]> {
  const home = new URL(homeUrl);
  const checks = await Promise.allSettled(
    urls.map(async (u) => {
      const res = await fetch(u, {
        method: "GET",
        headers: { "User-Agent": "ClinicScreenBot/1.0 (practice website import)" },
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.includes("html")) return null;
      const fin = new URL(res.url || u);
      if (fin.origin === home.origin && (fin.pathname === "/" || fin.pathname === "")) return null;
      return fin.toString();
    }),
  );
  return [...new Set(checks.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : [])))];
}

/** Individual one-person-per-page profiles linked from directory pages + homepage. */
async function findProfileUrls(siteUrl: string, homeLinks: Link[], directoryPages: string[]): Promise<string[]> {
  const doctorUrls = new Set<string>();
  const pages = [...new Set([siteUrl, ...directoryPages])];
  for (const page of pages) {
    let links: Link[];
    try {
      links = page === siteUrl ? homeLinks : extractLinks(await fetchPage(page), page);
    } catch {
      continue; // a dead directory link shouldn't sink the whole import
    }
    const picked = await pickUrls(
      "Identify pages that are an INDIVIDUAL clinician's profile — one named person per page (the link text is usually a person's name). Exclude directory/listing, about, services, and location pages.",
      links,
    );
    for (const u of picked) doctorUrls.add(u);
    if (doctorUrls.size >= MAX_DOCTORS) break;
  }
  return [...doctorUrls].slice(0, MAX_DOCTORS);
}

/**
 * Extract every clinician introduced inline on a team/about/roster page. Returns
 * one entry per doctor; each keeps a fragment on its sourceUrl so several doctors
 * sharing a page stay distinct. Bare names/links (no inline detail) are dropped
 * by the schema instruction, so running this over a link-only directory yields
 * nothing rather than junk.
 */
export async function extractDoctorsFromPage(url: string): Promise<ScrapedDoctor[]> {
  const html = await fetchPage(url);
  const text = htmlToText(html);
  const images = extractImages(html, url);

  const res = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          "This page introduces one or more clinicians. Extract each clinician who has real detail present on THIS page (a bio, credentials, education, or a headshot).",
          "Use only what the page states — never infer, guess, or fill from outside knowledge. Use null/empty for anything absent.",
          "For each clinician, choose their headshot from the candidate image list below (match by name/position), or null if none is clearly theirs.",
          "",
          `PAGE URL: ${url}`,
          "",
          "CANDIDATE IMAGE URLS:",
          images.length ? images.join("\n") : "(none found)",
          "",
          "PAGE TEXT:",
          text,
        ].join("\n"),
      },
    ],
    output_config: { format: zodOutputFormat(DoctorsPageSchema) },
  });

  return (res.parsed_output?.doctors ?? [])
    .filter((d) => d.name.trim())
    .map((d) => ({
      name: d.name.trim(),
      credentials: d.credentials,
      title: d.title,
      specialty: d.specialty,
      photoUrl: d.photoUrl && images.includes(d.photoUrl) ? d.photoUrl : null,
      bio: d.bio,
      education: d.education,
      boardCertifications: d.boardCertifications,
      languages: d.languages,
      acceptingNewPatients: d.acceptingNewPatients,
      sourceUrl: `${url}#${nameSlug(d.name.trim())}`,
    }));
}

/** Re-scrape a saved doctor, handling both single-profile and inline-team sources. */
export async function rescrapeDoctor(sourceUrl: string): Promise<ScrapedDoctor | null> {
  const [base] = sourceUrl.split("#");
  if (!sourceUrl.includes("#")) return extractDoctor(base);
  const all = await extractDoctorsFromPage(base);
  return all.find((d) => d.sourceUrl === sourceUrl) ?? all[0] ?? null;
}

/** Scrape one physician profile page into structured fields. */
export async function extractDoctor(url: string): Promise<ScrapedDoctor | null> {
  const html = await fetchPage(url);
  const text = htmlToText(html);
  const images = extractImages(html, url);

  const res = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          "Extract this physician's details from their profile page, for display on a waiting-room screen.",
          "Use only what the page states — never infer, guess, or fill from outside knowledge. Use null/empty for anything absent.",
          "",
          `PAGE URL: ${url}`,
          "",
          "CANDIDATE IMAGE URLS (choose this physician's headshot, or null):",
          images.length ? images.join("\n") : "(none found)",
          "",
          "PAGE TEXT:",
          text,
        ].join("\n"),
      },
    ],
    output_config: { format: zodOutputFormat(DoctorSchema) },
  });

  const d = res.parsed_output;
  if (!d || !d.isPhysicianProfile || !d.name.trim()) return null;

  // Only accept a headshot the page actually offered.
  const photoUrl = d.photoUrl && images.includes(d.photoUrl) ? d.photoUrl : null;

  return {
    name: d.name.trim(),
    credentials: d.credentials,
    title: d.title,
    specialty: d.specialty,
    photoUrl,
    bio: d.bio,
    education: d.education,
    boardCertifications: d.boardCertifications,
    languages: d.languages,
    acceptingNewPatients: d.acceptingNewPatients,
    sourceUrl: url,
  };
}

// How "complete" a record is — used to keep the richer copy when the same doctor
// turns up on both an individual page and a roster page. Individual pages (no '#')
// win ties, since they're usually the fuller source.
function richness(d: ScrapedDoctor): number {
  return (
    (d.bio?.length ?? 0) +
    (d.photoUrl ? 200 : 0) +
    d.education.length * 20 +
    d.boardCertifications.length * 10 +
    (d.sourceUrl.includes("#") ? 0 : 25)
  );
}

function dedupeByName(list: ScrapedDoctor[]): ScrapedDoctor[] {
  const byName = new Map<string, ScrapedDoctor>();
  for (const d of list) {
    const key = normalizeName(d.name) || d.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || richness(d) > richness(existing)) byName.set(key, d);
  }
  return [...byName.values()];
}

/** A real physician entry has a first AND last name — a bare surname is a fragment. */
function isValidDoctorName(name: string): boolean {
  const tokens = normalizeName(name).split(" ").filter((t) => t.length >= 2);
  return tokens.length >= 2;
}

/**
 * Drop entries whose full set of name tokens is contained in a larger name we also
 * kept (e.g. "Manisha" ⊂ "Manisha Mittal"). Belt-and-suspenders against partial
 * duplicates the surname-count rule alone wouldn't catch.
 */
function dropSubsetNames(list: ScrapedDoctor[]): ScrapedDoctor[] {
  const tokens = list.map((d) => new Set(normalizeName(d.name).split(" ").filter(Boolean)));
  return list.filter((_, i) => {
    const a = tokens[i];
    return !list.some((_o, j) => {
      if (i === j || tokens[j].size <= a.size) return false;
      return [...a].every((t) => tokens[j].has(t)); // a fully inside a longer name
    });
  });
}

/**
 * Discover + scrape every physician on a practice's site, handling both common
 * layouts: one-page-per-doctor (large groups) and everyone-on-one-team-page
 * (small practices).
 *
 * Precision matters more than a couple of extra calls here: nav is classified so
 * inline-team extraction only runs on real team pages (never the homepage, which
 * manufactures ghosts from the practice's own name), common team paths are probed
 * when nav hides them, and every result must pass a real-name check.
 */
export async function scrapePracticeSite(siteUrl: string): Promise<{
  doctors: ScrapedDoctor[];
  failures: { url: string; error: string }[];
}> {
  const failures: { url: string; error: string }[] = [];
  const home = await fetchPage(siteUrl);
  const homeLinks = extractLinks(home, siteUrl);

  const { teamPages, directoryPages } = await classifyRosterPages(homeLinks);

  // If nav revealed no inline-team page, probe common paths so we still find one.
  let inlinePages = teamPages;
  if (inlinePages.length === 0) {
    const guesses = COMMON_TEAM_PATHS.map((p) => new URL(p, siteUrl).toString());
    inlinePages = await keepReachable(guesses, siteUrl);
  }
  inlinePages = [...new Set(inlinePages)].slice(0, 4);

  const profileUrls = await findProfileUrls(siteUrl, homeLinks, directoryPages);

  const found: ScrapedDoctor[] = [];

  // One-per-page profiles (large groups).
  const singles = await Promise.allSettled(profileUrls.map((u) => extractDoctor(u)));
  singles.forEach((r, i) => {
    if (r.status === "rejected") failures.push({ url: profileUrls[i], error: r.reason?.message ?? "Scrape failed." });
    else if (r.value) found.push(r.value);
  });

  // Inline-team pages (small practices).
  const multis = await Promise.allSettled(inlinePages.map((u) => extractDoctorsFromPage(u)));
  multis.forEach((r, i) => {
    if (r.status === "rejected") failures.push({ url: inlinePages[i], error: r.reason?.message ?? "Scrape failed." });
    else found.push(...r.value);
  });

  // Last resort: if nothing turned up anywhere, mine the homepage itself.
  if (found.length === 0) {
    try {
      found.push(...(await extractDoctorsFromPage(siteUrl)));
    } catch {
      /* nothing to add */
    }
  }

  const valid = found.filter((d) => isValidDoctorName(d.name));
  const doctors = dropSubsetNames(dedupeByName(valid)).sort((a, b) => a.name.localeCompare(b.name));
  return { doctors, failures };
}
