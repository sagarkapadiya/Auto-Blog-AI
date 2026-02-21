import axios from "axios";
import { parseCurlCommand, buildPayloadFromTemplate } from "./curlParser";
import type { ParsedCurl } from "./curlParser";

export class BlogApiService {
    static async postBlog(
        curlCommand: string,
        blogData: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        if (!curlCommand?.trim()) {
            throw new Error("No cURL command configured. Please add one in Settings.");
        }

        const parsed: ParsedCurl = parseCurlCommand(curlCommand);

        if (!parsed.url) {
            throw new Error("Could not extract a valid URL from the cURL command.");
        }

        const payload = buildPayloadFromTemplate(parsed.bodyTemplate, blogData);

        if (!parsed.headers["Content-Type"] && !parsed.headers["content-type"]) {
            parsed.headers["Content-Type"] = "application/json";
        }

        try {
            const { data } = await axios({
                method: parsed.method,
                url: parsed.url,
                headers: parsed.headers,
                data: payload,
            });
            return data ?? {};
        } catch (error: any) {
            if (error.response) {
                const errorText = typeof error.response.data === "string"
                    ? error.response.data
                    : JSON.stringify(error.response.data ?? "");
                throw new Error(`API call failed (${error.response.status}): ${errorText}`);
            }
            throw error;
        }
    }
}
