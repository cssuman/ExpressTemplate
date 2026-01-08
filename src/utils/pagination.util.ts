type PaginationMeta = {
    limit: number;
    offset: number;
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
    nextOffset: number | null;
    prevOffset: number | null;
};

// Generic type for paginated response with a custom data key
type PaginatedResponse<T, K extends string> = {
    [P in K]: T[];
} & {
    pagination: PaginationMeta;
};

/**
 * Creates a paginated response with the given data, limit, offset, and total count.
 * The response will contain the data under the given key (default 'data'),
 * and a pagination object with the following properties:
 * - limit: the limit of the data
 * - offset: the offset of the data
 * - totalCount: the total count of the data
 * - currentPage: the current page number (1-indexed)
 * - totalPages: the total number of pages
 * - hasMore: whether there is more data after the current offset
 * - nextOffset: the offset of the next page (null if there is no next page)
 * - prevOffset: the offset of the previous page (null if there is no previous page)
 *
 * @template T - the type of the data
 * @template K - the key of the data (default 'data')
 * @param data - the data to be paginated
 * @param limit - the limit of the data
 * @param offset - the offset of the data
 * @param totalCount - the total count of the data
 * @param dataKey - the key of the data (default 'data')
 * @returns a paginated response with the given data and pagination
 */
export function createPagination<T, K extends string = 'data'>(
    data: T[],
    limit: number,
    offset: number,
    totalCount: number,
    dataKey?: K,
): PaginatedResponse<T, K> {
    const key = (dataKey ?? 'data') as K;

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = offset + data.length < totalCount;

    return {
        [key]: data,
        pagination: {
            limit,
            offset,
            totalCount,
            currentPage,
            totalPages,
            hasMore,
            nextOffset: hasMore ? offset + limit : null,
            prevOffset: offset > 0 ? Math.max(offset - limit, 0) : null,
        },
    } as PaginatedResponse<T, K>;
}
