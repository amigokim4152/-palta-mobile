export type EdgeRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Uint8Array;
};

export type EdgeResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: Uint8Array;
};

export interface EdgeRuntimePort {
  handle(request: EdgeRequest): Promise<EdgeResponse>;
}
