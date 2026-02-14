export const IPC_CHANNELS = {
  runCompare: 'compare:run',
  getFileDiff: 'compare:file-diff',
  selectDirectory: 'dialog:select-directory',
  resolveDirectoryPath: 'dialog:resolve-directory-path'
} as const;

export interface CompareRequest {
  leftPath: string;
  rightPath: string;
  excludeNames?: string[];
}

export type CompareItemStatus = 'same' | 'different' | 'left_only' | 'right_only';
export type DiffKindHint = 'text' | 'binary' | 'too_large';

export interface CompareItem {
  relativePath: string;
  status: CompareItemStatus;
  diffKindHint?: DiffKindHint;
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
    diffPolicy: {
      maxTextDiffBytes: number;
      binaryExtensions: string[];
    };
    summary: CompareSummary;
    items: CompareItem[];
    requestId: string;
    generatedAt: string;
  };
}

export interface CompareErrorResponse {
  ok: false;
  error: {
    code:
      | 'INVALID_INPUT'
      | 'NOT_FOUND'
      | 'PERMISSION_DENIED'
      | 'INTERNAL_ERROR';
    message: string;
    source: 'compare';
    step:
      | 'validate_input'
      | 'scan_directory'
      | 'classify_result'
      | 'unexpected';
    retryable: boolean;
  };
}

export type CompareResponse = CompareSuccessResponse | CompareErrorResponse;

export interface FileDiffRequest {
  leftRootPath: string;
  rightRootPath: string;
  relativePath: string;
}

export type FileDiffLineType = 'context' | 'added' | 'removed';

export interface FileDiffLine {
  type: FileDiffLineType;
  text: string;
  leftLineNumber?: number;
  rightLineNumber?: number;
}

export interface FileDiffSuccessResponse {
  ok: true;
  data: {
    relativePath: string;
    kind: 'text' | 'binary' | 'too_large';
    lines: FileDiffLine[];
    maxBytes: number;
  };
}

export interface FileDiffErrorResponse {
  ok: false;
  error: {
    code:
      | 'INVALID_INPUT'
      | 'NOT_FOUND'
      | 'PERMISSION_DENIED'
      | 'INTERNAL_ERROR';
    message: string;
    source: 'file_diff';
    step: 'validate_input' | 'read_file' | 'unexpected';
    retryable: boolean;
  };
}

export type FileDiffResponse = FileDiffSuccessResponse | FileDiffErrorResponse;

export interface DiffDirApi {
  runCompare: (request: CompareRequest) => Promise<CompareResponse>;
  getFileDiff: (request: FileDiffRequest) => Promise<FileDiffResponse>;
  selectDirectory: () => Promise<string | null>;
  resolveDirectoryPath: (rawPath: string) => Promise<string | null>;
  getDroppedFilePath: (file: File) => string | null;
}
