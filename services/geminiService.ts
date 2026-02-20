
import { GoogleGenAI, Type } from "@google/genai";
import { Topic, BlogContent, BlogStatus } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateBlog(topic: Topic): Promise<Partial<BlogContent>> {
    const prompt = `
      Write a comprehensive, SEO-optimized blog post about: "${topic.title}".
      Category: ${topic.category}
      Keywords: ${topic.keywords.join(", ")}
      Target Audience: ${topic.targetAudience}

      The blog should be 1200-1500 words, include H2/H3 headings, an FAQ section, and a strong CTA.
      Write in a human, engaging tone. Avoid robotic language.
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            seoTitle: { type: Type.STRING },
            metaDescription: { type: Type.STRING },
            slug: { type: Type.STRING },
            content: { type: Type.STRING, description: "Full blog content in HTML format" },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            featuredImagePrompt: { type: Type.STRING, description: "A detailed prompt for generating a featured image for this blog" },
          },
          required: ["seoTitle", "metaDescription", "slug", "content", "tags", "featuredImagePrompt"],
        },
      },
    });

    try {
      const data = JSON.parse(response.text || "{}");
      return {
        ...data,
        topicId: topic.id,
        status: BlogStatus.GENERATED,
      };
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      throw new Error("AI Content Generation Failed");
    }
  }

  async generateImage(prompt: string): Promise<string> {
    // Note: This requires a specific image model
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Create a professional, high-quality blog featured image for: ${prompt}. Cinematic lighting, minimalist style.` }],
      },
      config: {
        imageConfig: { aspectRatio: "16:9" }
      }
    });

    for (const part of response.candidates?.[0]?.content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    // Fallback to a placeholder if image gen fails or is unavailable
    return `https://picsum.photos/seed/${Math.random()}/1200/630`;
  }
}
