import { describe, expect, it } from 'vitest';
import { toPaged } from './client';

describe('toPaged', () => {
  it('reads items in data with paging in meta', () => {
    const meta = { page: 2, pageSize: 10, totalCount: 12, totalPages: 2 };
    expect(toPaged([{ id: 'a' }], meta)).toEqual({ items: [{ id: 'a' }], meta });
  });

  it('reads a PagedResult in data, as GET /stock-transfers returns it', () => {
    expect(toPaged({ items: [{ id: 'a' }], page: 1, pageSize: 100, totalCount: 1 }, null)).toEqual({
      items: [{ id: 'a' }],
      meta: { page: 1, pageSize: 100, totalCount: 1, totalPages: 1 },
    });
  });

  it('gives an empty page for anything else', () => {
    expect(toPaged(null, null).items).toEqual([]);
  });
});
