/**
 * Backend Pagination Utilities
 * Provides consistent pagination, filtering, and sorting across all API endpoints
 */

/**
 * Parse pagination parameters from request query
 */
export const parsePaginationParams = (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 25;
    const search = query.search || '';
    const sortBy = query.sortBy || 'created_at';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    
    const offset = (page - 1) * limit;
    
    return {
        page,
        limit,
        offset,
        search,
        sortBy,
        sortDir,
        filters: query.filters ? JSON.parse(query.filters) : {}
    };
};

/**
 * Apply pagination to Supabase query
 */
export const applyPagination = (query, params) => {
    return query
        .range(params.offset, params.offset + params.limit - 1)
        .order(params.sortBy, { ascending: params.sortDir === 'asc' });
};

/**
 * Build paginated response
 */
export const buildPaginatedResponse = (data, totalCount, params) => {
    const totalPages = Math.ceil(totalCount / params.limit);
    
    return {
        data,
        pagination: {
            page: params.page,
            limit: params.limit,
            totalCount,
            totalPages,
            hasNextPage: params.page < totalPages,
            hasPrevPage: params.page > 1
        }
    };
};

/**
 * Apply search filter to query (for text search across multiple columns)
 */
export const applySearch = (query, searchTerm, searchColumns) => {
    if (!searchTerm || !searchColumns || searchColumns.length === 0) {
        return query;
    }
    
    // Supabase doesn't support OR across columns directly in query builder
    // We'll need to use textSearch or filter client-side
    // For now, we'll search the first column as primary
    return query.ilike(searchColumns[0], `%${searchTerm}%`);
};

/**
 * Apply column filters to query
 */
export const applyFilters = (query, filters) => {
    if (!filters || Object.keys(filters).length === 0) {
        return query;
    }
    
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            query = query.eq(key, value);
        }
    });
    
    return query;
};

export default {
    parsePaginationParams,
    applyPagination,
    buildPaginatedResponse,
    applySearch,
    applyFilters
};
