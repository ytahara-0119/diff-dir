export const IPC_CHANNELS = {
  runCompare: 'compare:run'
} as const;

export interface CompareRequest {
  leftPath: string;
  rightPath: string;
  excludeNames?: string[];
}

export type CompareItemStatus = 'same' | 'different' | 'left_only' | 'right_only';

export interface CompareItem {
  relativePath: string;
  status: CompareItemStatus;
  left?: {
    size: number;
    mtimeMs: number;
  };
  right?: {
    size: number;
    mtimeMs: number;
  };
}

export interface CompareSummary {
  same: number;
  different: number;
  leftOnly: number;
  rightOnly: number;
}

export interface CompareSuccessResponse {
  ok: true;
  data: {
    request: CompareRequest;
    leftFileCount: number;
    rightFileCount: number;
    appliedExcludeNames: string[];
    summary: CompareSummary;
    items: CompareItem[];
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
