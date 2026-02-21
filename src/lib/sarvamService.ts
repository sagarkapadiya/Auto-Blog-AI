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
                            "You are an expert SEO blog writer. You MUST respond with ONLY a single valid JSON object. No markdown, no code blocks, no backticks, no explanations before or after. Output starts with { and ends with }.",
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

            const rawContent = result.choices?.[0]?.message?.content || "";

            const parseJsonFromContent = (text: string): Record<string, unknown> | null => {
                if (!text?.trim()) return null;
                let cleaned = text
                    .replace(/^```(?:json)?\s*/i, "")
                    .replace(/\s*```\s*$/g, "")
                    .trim();
                // Try direct parse first
                try {
                    return JSON.parse(cleaned);
                } catch {
                    // Extract JSON object: find first { and match to closing }, respecting strings
                    const start = cleaned.indexOf("{");
                    if (start === -1) return null;
                    let depth = 0;
                    let i = start;
                    let inString: false | string = false;
                    let escape = false;
                    const chars = cleaned.split("");
                    while (i < chars.length) {
                        const c = chars[i];
                        if (escape) {
                            escape = false;
                        } else if (inString) {
                            if (c === "\\") escape = true;
                            else if (typeof inString === "string" && c === inString) inString = false;
                        } else if (c === '"' || c === "'") {
                            inString = c;
                        } else if (c === "{") {
                            depth++;
                        } else if (c === "}") {
                            depth--;
                            if (depth === 0) {
                                try {
                                    return JSON.parse(cleaned.slice(start, i + 1));
                                } catch {
                                    return null;
                                }
                            }
                        }
                        i++;
                    }
                    return null;
                }
            };

            const data = parseJsonFromContent(rawContent);
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
