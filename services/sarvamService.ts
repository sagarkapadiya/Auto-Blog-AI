
import { Topic, BlogContent, BlogStatus } from "../types";

const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";
const SARVAM_MODEL = "sarvam-m";

export class SarvamService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateBlog(topic: Topic): Promise<Partial<BlogContent>> {
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

    const response = await fetch(SARVAM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": this.apiKey,
      },
      body: JSON.stringify({
        model: SARVAM_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert SEO blog writer. You always respond with valid JSON only. No markdown code fences, no extra text."
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Sarvam API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content || "";

    try {
      // Strip markdown code fences if present
      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        ?.trim();

      const data = JSON.parse(cleaned);
      return {
        seoTitle: data.seoTitle || topic.title,
        metaDescription: data.metaDescription || "",
        slug: data.slug || topic.title.toLowerCase().replace(/\s+/g, "-"),
        content: data.content || "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        featuredImagePrompt: data.featuredImagePrompt || topic.title,
        topicId: topic.id,
        status: BlogStatus.GENERATED,
      };
    } catch (e) {
      console.error("Failed to parse Sarvam AI response:", rawContent);
      throw new Error("AI Content Generation Failed - could not parse response as JSON");
    }
  }
}
