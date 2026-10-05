/**
 * Minimal Evolink client: file upload, async image/video generation, task query.
 * Docs: https://evolink.ai/docs — all generation calls return a task record
 * that is polled via GET /v1/tasks/{id}.
 */

const DEFAULT_BASE_URL = 'https://api.evolink.ai';
const FILES_URL = 'https://files-api.evolink.ai/api/v1/files/upload/base64';

export type EvolinkTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type EvolinkTask = {
  id: string;
  status: EvolinkTaskStatus;
  progress?: number;
  results?: string[];
  error?: { code?: string; message?: string };
  usage?: { credits_used?: number };
};

export class EvolinkClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(configs: { apiKey: string; baseUrl?: string }) {
    this.apiKey = configs.apiKey;
    // Generation lives on the api. host; a bare https://evolink.ai (the
    // marketing site) would only return HTML.
    const base = (configs.baseUrl || '').replace(/\/+$/, '');
    this.baseUrl = /^https:\/\/api\./.test(base) ? base : DEFAULT_BASE_URL;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = data?.error?.message || data?.msg || data?.message || '';
      // Keep "request failed with status: NNN" — callers use it to tell
      // transient (429/5xx) from permanent failures.
      throw new Error(
        `Evolink request failed with status: ${resp.status}${message ? ` ${message}` : ''}`
      );
    }
    return data as T;
  }

  /** Upload a data: URL image; returns a public URL valid for 72 hours. */
  async uploadImage(dataUrl: string, fileName: string): Promise<string> {
    const data = await this.request<{
      success?: boolean;
      msg?: string;
      data?: { file_url?: string };
    }>(FILES_URL, {
      method: 'POST',
      body: JSON.stringify({
        base64_data: dataUrl,
        upload_path: 'raindance',
        file_name: fileName,
      }),
    });
    const url = data?.data?.file_url;
    if (!data?.success || !url)
      throw new Error(data?.msg || 'Photo upload failed');
    return url;
  }

  createImage(body: Record<string, unknown>) {
    return this.request<EvolinkTask>(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  createVideo(body: Record<string, unknown>) {
    return this.request<EvolinkTask>(`${this.baseUrl}/v1/videos/generations`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getTask(taskId: string) {
    return this.request<EvolinkTask>(
      `${this.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}`
    );
  }
}
