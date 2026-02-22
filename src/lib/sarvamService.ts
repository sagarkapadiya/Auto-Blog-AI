import axios from "axios";

const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";
const SARVAM_MODEL = "sarvam-m";

interface TopicInput {
    title: string;
    category: string;
    keywords: string[];
    targetAudience: string;
    _id: string;
}

/**
 * Robustly extract a JSON object from an LLM response string.
 *
 * Handles:
 * - Markdown code fences (```json ... ```)
 * - Leading/trailing text before/after the JSON
 * - HTML content inside `content` field that contains `{`, `}`, unescaped `&`, etc.
 * - Literal newlines inside JSON string values (control characters)
 */
function extractJsonFromLLMResponse(raw: string): Record<string, unknown> | null {
    if (!raw?.trim()) return null;

    // Step 1: strip markdown code fences (handles multiline and various forms)
    let text = raw
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/\s*```\s*$/im, "")
        .trim();

    // Step 2: Try direct parse — handles the happy path
    try {
        return JSON.parse(text);
    } catch {/* fall through */ }

    // Step 3: Locate the start of the JSON object
    const start = text.indexOf("{");
    if (start === -1) return null;
    text = text.slice(start);

    // Step 4: Try parse from first `{` directly
    try {
        return JSON.parse(text);
    } catch {/* fall through */ }

    // Step 5: Replace literal unescaped control characters inside strings
    // (LLMs sometimes emit real newlines/tabs inside JSON string values)
    const sanitized = text
        .replace(/[\u0000-\u001F\u007F]/g, (ch) => {
            // Keep chars that are valid JSON escape sequences
            const escapes: Record<string, string> = {
                "\n": "\\n",
                "\r": "\\r",
                "\t": "\\t",
                "\b": "\\b",
                "\f": "\\f",
            };
            return escapes[ch] ?? "";
        });
    try {
        return JSON.parse(sanitized);
    } catch {/* fall through */ }

    // Step 6: Walk character-by-character to find the balanced closing `}`
    // This handles junk text after the JSON object
    let depth = 0;
    let i = 0;
    let inString = false;
    let escape = false;

    while (i < sanitized.length) {
        const c = sanitized[i];
        if (escape) {
            escape = false;
        } else if (c === "\\") {
            escape = true;
        } else if (c === '"') {
            inString = !inString;
        } else if (!inString) {
            if (c === "{") depth++;
            else if (c === "}") {
                depth--;
                if (depth === 0) {
                    try {
                        return JSON.parse(sanitized.slice(0, i + 1));
                    } catch {
                        break;
                    }
                }
            }
        }
        i++;
    }

    // Step 7: Last resort — use a regex to extract each known field individually
    // (handles the case where `content` has malformed JSON-breaking characters)
    try {
        const extract = (key: string): string | null => {
            // Match "key": "value" where value may span multiple lines
            const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"`, "s");
            const m = sanitized.match(re);
            return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : null;
        };
        const extractArray = (key: string): string[] => {
            const re = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)]`, "s");
            const m = sanitized.match(re);
            if (!m) return [];
            return m[1].match(/"([^"]*)"/g)?.map(s => s.slice(1, -1)) ?? [];
        };

        const seoTitle = extract("seoTitle");
        const content = extract("content");
        if (!seoTitle && !content) return null; // nothing useful found

        return {
            seoTitle: seoTitle ?? "",
            metaDescription: extract("metaDescription") ?? "",
            slug: extract("slug") ?? "",
            content: content ?? "",
            tags: extractArray("tags"),
            featuredImagePrompt: extract("featuredImagePrompt") ?? "",
        };
    } catch {
        return null;
    }
}

export class SarvamService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async generateBlog(topic: TopicInput) {
        const prompt = `
Write a comprehensive, SEO-optimized blog post about: "${topic.title}".
Category: ${topic.category}
Keywords: ${topic.keywords.join(", ")}
Target Audience: ${topic.targetAudience}

The blog should be 1200-1500 words, include H2/H3 headings, an FAQ section, and a strong CTA.
Write in a human, engaging tone. Avoid robotic language.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) with these exact keys:
{
  "seoTitle": "SEO-optimized title for the blog",
  "metaDescription": "A compelling meta description under 160 characters",
  "slug": "url-friendly-slug-for-the-blog",
  "content": "Full blog content in HTML format with proper h2, h3, p, ul, ol tags",
  "tags": ["tag1", "tag2", "tag3"],
  "featuredImagePrompt": "A detailed prompt for generating a featured image for this blog"
}
`;

        try {
            const { data: result } = await axios.post(SARVAM_API_URL, {
                model: SARVAM_MODEL,
                messages: [
                    {
                        role: "system",
                        content:
                            "You are an expert SEO blog writer. You MUST respond with ONLY a single valid JSON object. No markdown, no code blocks, no backticks, no explanations before or after. Output starts with { and ends with }. All HTML inside the content field MUST be on a single line with no literal newlines — use \\n escape sequences instead.",
                    },
                    { role: "user", content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 4096,
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "api-subscription-key": this.apiKey,
                },
            });

            const rawContent: string = result.choices?.[0]?.message?.content || "";

            const data = extractJsonFromLLMResponse(rawContent);
            if (!data || typeof data !== "object") {
                console.error("Failed to parse Sarvam AI response. Raw (first 500 chars):", rawContent.slice(0, 500));
                throw new Error(
                    "AI Content Generation Failed - could not parse response as JSON. The model may have returned invalid or non-JSON content."
                );
            }

            return {
                seoTitle: (data.seoTitle as string) || topic.title,
                metaDescription: (data.metaDescription as string) || "",
                slug: (data.slug as string) || topic.title.toLowerCase().replace(/\s+/g, "-"),
                content: (data.content as string) || "",
                tags: Array.isArray(data.tags) ? data.tags : [],
                featuredImagePrompt: (data.featuredImagePrompt as string) || topic.title,
                topicId: topic._id,
                status: "GENERATED" as const,
            };
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Sarvam API error (${error.response.status}): ${error.response.data ? JSON.stringify(error.response.data) : ""}`);
            }
            throw error;
        }
    }
}
