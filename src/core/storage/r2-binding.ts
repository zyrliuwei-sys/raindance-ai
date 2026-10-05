import type {
  StorageConfigs,
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '.';

/** The subset of the Workers R2 bucket binding this provider uses. */
export type R2BucketBinding = {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string; contentDisposition?: string };
    }
  ): Promise<unknown>;
  head(key: string): Promise<unknown | null>;
};

export interface R2BindingConfigs extends StorageConfigs {
  bucket: R2BucketBinding;
  /** Public origin serving the bucket, e.g. https://media.example.com */
  publicDomain: string;
}

/**
 * R2 through a Workers bucket binding — no S3 access keys needed. Only
 * available inside workerd (the binding lives on the Workers env).
 */
export class R2BindingProvider implements StorageProvider {
  readonly name = 'r2-binding';
  configs: R2BindingConfigs;

  constructor(configs: R2BindingConfigs) {
    this.configs = configs;
  }

  getPublicUrl = (options: { key: string }) =>
    `${this.configs.publicDomain.replace(/\/+$/, '')}/${options.key}`;

  exists = async (options: { key: string }) =>
    (await this.configs.bucket.head(options.key)) !== null;

  async uploadFile(
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      await this.configs.bucket.put(options.key, options.body, {
        httpMetadata: {
          contentType: options.contentType,
          contentDisposition: options.disposition || 'inline',
        },
      });
      return {
        success: true,
        key: options.key,
        url: this.getPublicUrl({ key: options.key }),
        provider: this.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Upload failed',
        provider: this.name,
      };
    }
  }

  async downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    const resp = await fetch(options.url);
    if (!resp.ok) {
      return {
        success: false,
        error: `Download failed with status: ${resp.status}`,
        provider: this.name,
      };
    }
    return this.uploadFile({
      body: new Uint8Array(await resp.arrayBuffer()),
      key: options.key,
      contentType:
        options.contentType || resp.headers.get('content-type') || undefined,
      disposition: options.disposition,
    });
  }
}
