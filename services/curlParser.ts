
export interface ParsedCurl {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyTemplate: Record<string, unknown> | null;
}

export function parseCurlCommand(curl: string): ParsedCurl {
  // Normalize: remove line-continuation backslashes and collapse whitespace
  const normalized = curl
    .replace(/\\\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    ?.trim();

  let method = 'POST';
  const headers: Record<string, string> = {};
  let bodyTemplate: Record<string, unknown> | null = null;
  let url = '';

  // Extract method: -X POST or --request POST
  const methodMatch = normalized.match(/(?:-X|--request)\s+(\w+)/);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase();
  }

  // Extract headers: -H "Key: Value" or --header "Key: Value"
  const headerRegex = /(?:-H|--header)\s+['"](.*?)['"]/g;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const colonIdx = headerMatch[1].indexOf(':');
    if (colonIdx !== -1) {
      const key = headerMatch[1].substring(0, colonIdx)?.trim();
      const value = headerMatch[1].substring(colonIdx + 1)?.trim();
      headers[key] = value;
    }
  }

  // Extract body: -d '...' or --data '...' or --data-raw '...'
  const bodyRegex = /(?:-d|--data|--data-raw)\s+['"]([\s\S]*?)['"]/;
  const bodyMatch = normalized.match(bodyRegex);
  if (bodyMatch) {
    try {
      bodyTemplate = JSON.parse(bodyMatch[1]);
    } catch {
      bodyTemplate = null;
    }
  }

  // Extract URL: find something that looks like a URL (http/https)
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
  if (!template) {
    // No template from cURL, send blog data as-is
    return blogData;
  }

  // Use the template keys, fill values from blogData where possible
  const payload: Record<string, unknown> = {};

  for (const key of Object.keys(template)) {
    if (key in blogData) {
      payload[key] = blogData[key];
    } else {
      // Keep the original template value as placeholder/default
      payload[key] = template[key];
    }
  }

  return payload;
}
