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

    /**
     * Execute the delete cURL command, substituting placeholders from the
     * saved publish API response into the URL and body template.
     *
     * Placeholder format in the cURL: {{key}} — replaced with value from
     * publishApiResponse (supports nested keys via dot notation, e.g. {{data.id}}).
     */
    static async deleteBlog(
        deleteCurlCommand: string,
        publishApiResponse: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        if (!deleteCurlCommand?.trim()) {
            throw new Error("No delete cURL command configured. Please add one in Settings.");
        }

        console.log("[DeleteBlog] publishApiResponse:", JSON.stringify(publishApiResponse));

        // Flatten the response: recursively convert ObjectIds, nested objects, etc. to strings
        const flattenValue = (val: unknown): string => {
            if (val === null || val === undefined) return "";
            if (typeof val === "string") return val;
            if (typeof val === "number" || typeof val === "boolean") return String(val);
            // Handle MongoDB ObjectId-like objects: { $oid: "..." } or objects with toString()
            if (typeof val === "object") {
                const obj = val as Record<string, unknown>;
                if ("$oid" in obj) return String(obj.$oid);
                if ("toString" in obj && typeof obj.toString === "function") {
                    const str = obj.toString();
                    if (str !== "[object Object]") return str;
                }
                return JSON.stringify(val);
            }
            return String(val);
        };

        // Helper to resolve a dotted key path from the response object
        // Also searches nested objects (e.g. data.id, blog._id) if direct key not found
        const resolveValue = (key: string): string => {
            // Direct path lookup
            const value = key.split(".").reduce((obj: any, k: string) => obj?.[k], publishApiResponse);
            if (value !== undefined && value !== null) return flattenValue(value);

            // If key is "id" or "_id", search common nested locations
            if (key === "id" || key === "_id") {
                const idCandidates = [
                    publishApiResponse?.id,
                    publishApiResponse?._id,
                    (publishApiResponse?.data as any)?.id,
                    (publishApiResponse?.data as any)?._id,
                    (publishApiResponse?.blog as any)?.id,
                    (publishApiResponse?.blog as any)?._id,
                    (publishApiResponse?.result as any)?.id,
                    (publishApiResponse?.result as any)?._id,
                ];
                for (const candidate of idCandidates) {
                    if (candidate !== undefined && candidate !== null) return flattenValue(candidate);
                }
            }
            return "";
        };

        // Replace {{placeholder}} tokens in the raw cURL with values from the publish response
        let interpolated = deleteCurlCommand.replace(
            /\{\{([\w.]+)\}\}/g,
            (_match, key: string) => resolveValue(key)
        );

        // Also replace :placeholder tokens in URLs (e.g. /api/blogs/:id)
        interpolated = interpolated.replace(
            /(https?:\/\/[^\s'"]*):(\w+)/g,
            (_match, prefix: string, key: string) => {
                const resolved = resolveValue(key);
                return resolved ? `${prefix}${resolved}` : `${prefix}:${key}`;
            }
        );

        console.log("[DeleteBlog] Interpolated cURL:", interpolated);

        const parsed: ParsedCurl = parseCurlCommand(interpolated);

        // If no -X flag was specified, default to DELETE (parser defaults to POST)
        const hasExplicitMethod = /(?:-X|--request)\s+\w+/.test(deleteCurlCommand);
        const method = hasExplicitMethod ? parsed.method : "DELETE";

        if (!parsed.url) {
            throw new Error("Could not extract a valid URL from the delete cURL command.");
        }

        // Also substitute any remaining {{placeholders}} inside the parsed body template values
        const resolveBodyPlaceholders = (obj: Record<string, unknown>): Record<string, unknown> => {
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(obj)) {
                if (typeof v === "string") {
                    result[k] = v.replace(/\{\{([\w.]+)\}\}/g, (_m, key: string) => resolveValue(key));
                } else {
                    result[k] = v;
                }
            }
            return result;
        };

        const body = parsed.bodyTemplate ? resolveBodyPlaceholders(parsed.bodyTemplate) : undefined;

        if (!parsed.headers["Content-Type"] && !parsed.headers["content-type"]) {
            parsed.headers["Content-Type"] = "application/json";
        }

        console.log("[DeleteBlog] Calling:", method, parsed.url, body ? JSON.stringify(body) : "(no body)");

        try {
            const { data } = await axios({
                method,
                url: parsed.url,
                headers: parsed.headers,
                ...(body ? { data: body } : {}),
            });
            console.log("[DeleteBlog] Success:", JSON.stringify(data));
            return data ?? {};
        } catch (error: any) {
            if (error.response) {
                const errorText = typeof error.response.data === "string"
                    ? error.response.data
                    : JSON.stringify(error.response.data ?? "");
                console.error("[DeleteBlog] Failed:", error.response.status, errorText);
                throw new Error(`Delete API call failed (${error.response.status}): ${errorText}`);
            }
            console.error("[DeleteBlog] Error:", error.message);
            throw error;
        }
    }
}
