export const IPC_CHANNELS = {
  runCompare: 'compare:run'
} as const;

export interface CompareRequest {
  leftPath: string;
  rightPath: string;
  excludeNames?: string[];
}

export interface CompareSuccessResponse {
  ok: true;
  data: {
    request: CompareRequest;
    leftFileCount: number;
    rightFileCount: number;
    leftSamplePaths: string[];
    rightSamplePaths: string[];
    appliedExcludeNames: string[];
    requestId: string;
    generatedAt: string;
  };
}

export interface CompareErrorResponse {
  ok: false;
  error: {
    code: 'INVALID_INPUT' | 'INTERNAL_ERROR';
    message: string;
  };
}

export type CompareResponse = CompareSuccessResponse | CompareErrorResponse;

export interface DiffDirApi {
  runCompare: (request: CompareRequest) => Promise<CompareResponse>;
}
