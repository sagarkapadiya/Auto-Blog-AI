
import { parseCurlCommand, buildPayloadFromTemplate, ParsedCurl } from './curlParser';

export class BlogApiService {

  /**
   * Posts a blog using the saved cURL command.
   * Parses the cURL at runtime to extract URL, method, headers,
   * then sends the blog data as the request body.
   */
  static async postBlog(
    curlCommand: string,
    blogData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!curlCommand?.trim()) {
      throw new Error('No cURL command configured. Please add one in Settings.');
    }

    const parsed: ParsedCurl = parseCurlCommand(curlCommand);

    if (!parsed.url) {
      throw new Error('Could not extract a valid URL from the cURL command.');
    }

    // Build payload: if the cURL had a JSON body, use its keys as template;
    // otherwise send blogData as-is
    const payload = buildPayloadFromTemplate(parsed.bodyTemplate, blogData);

    // Ensure Content-Type is set
    if (!parsed.headers['Content-Type'] && !parsed.headers['content-type']) {
      parsed.headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(parsed.url, {
      method: parsed.method,
      headers: parsed.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`API call failed (${res.status}): ${errorText}`);
    }

    return res.json().catch(() => ({}));
  }
}
