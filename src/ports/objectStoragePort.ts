export type ObjectReadResult = {
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType?: string;
  etag?: string;
  size?: number;
};

export interface ObjectStoragePort {
  read(key: string): Promise<ObjectReadResult | null>;
  write(
    key: string,
    body: Uint8Array,
    options?: { contentType?: string; cacheControl?: string },
  ): Promise<void>;
  remove(key: string): Promise<void>;
}
