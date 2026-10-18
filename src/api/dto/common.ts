/** C# Guid. */
export type Guid = string;
/** C# DateOnly, serialised as yyyy-MM-dd. */
export type DateOnly = string;
/** C# DateTime / DateTimeOffset, serialised as ISO 8601. */
export type DateTimeString = string;

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string[]> | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
  meta: PagingMeta | null;
}

export interface PagingMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PagingMeta;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}
