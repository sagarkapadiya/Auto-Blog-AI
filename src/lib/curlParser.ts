export interface ParsedCurl {
    url: string;
    method: string;
    headers: Record<string, string>;
    bodyTemplate: Record<string, unknown> | null;
}

export function parseCurlCommand(curl: string): ParsedCurl {
    const normalized = curl
        .replace(/\\\s*\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    let method = "POST";
    const headers: Record<string, string> = {};
    let bodyTemplate: Record<string, unknown> | null = null;
    let url = "";

    const methodMatch = normalized.match(/(?:-X|--request)\s+(\w+)/);
    if (methodMatch) {
        method = methodMatch[1].toUpperCase();
    }

    const headerRegex = /(?:-H|--header)\s+['"](.*?)['"]/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(normalized)) !== null) {
        const colonIdx = headerMatch[1].indexOf(":");
        if (colonIdx !== -1) {
            const key = headerMatch[1].substring(0, colonIdx).trim();
            const value = headerMatch[1].substring(colonIdx + 1).trim();
            headers[key] = value;
        }
    }

    const bodyRegex = /(?:-d|--data|--data-raw)\s+[']([\s\S]*?)[']/;
    const bodyMatch = normalized.match(bodyRegex);
    if (bodyMatch) {
        try {
            bodyTemplate = JSON.parse(bodyMatch[1]);
        } catch {
            bodyTemplate = null;
        }
    }

    const urlRegex = /(?:^|\s)['"]?(https?:\/\/[^\s'"]+)['"]?/;
    const urlMatch = normalized.match(urlRegex);
    if (urlMatch) {
        url = urlMatch[1];
    }

    return { url, method, headers, bodyTemplate };
}

export function buildPayloadFromTemplate(
    template: Record<string, unknown> | null,
    blogData: Record<string, unknown>
): Record<string, unknown> {
    if (!template) return blogData;

    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(template)) {
        payload[key] = key in blogData ? blogData[key] : template[key];
    }
    return payload;
}
