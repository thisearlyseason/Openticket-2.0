import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Input, Select, Badge } from './UI';

export type Column<T> = {
    key: string;
    header: string;
    render: (item: T, index: number) => React.ReactNode;
    sortable?: boolean;
    filterable?: boolean;
    filterType?: 'text' | 'select' | 'date' | 'number';
    filterOptions?: { label: string; value: string }[];
    exportValue?: (item: T) => string | number; // For CSV export
};

export type BulkAction = {
    label: string;
    icon?: React.ReactNode;
    onClick: (selectedIds: string[]) => void;
    variant?: 'default' | 'destructive' | 'outline';
};

export type DataTableProps<T> = {
    data: T[];
    columns: Column<T>[];
    defaultRowsPerPage?: number;
    searchable?: boolean;
    searchPlaceholder?: string;
    onSearch?: (query: string) => void;
    loading?: boolean;
    emptyMessage?: string;
    // Backend pagination support
    totalCount?: number;
    onPageChange?: (page: number, rowsPerPage: number) => void;
    onFilterChange?: (filters: Record<string, any>) => void;
    onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
    className?: string;
    // Export
    exportable?: boolean;
    exportFilename?: string;
    // Bulk actions
    bulkActions?: BulkAction[];
    getRowId?: (item: T) => string; // Required for bulk actions
}

export function DataTable<T>({
    data,
    columns,
    defaultRowsPerPage = 25,
    searchable = true,
    searchPlaceholder = 'Search...',
    onSearch,
    loading = false,
    emptyMessage = 'No data available',
    totalCount,
    onPageChange,
    onFilterChange,
    onSortChange,
    className = '',
    exportable = true,
    exportFilename = 'export',
    bulkActions,
    getRowId
}: DataTableProps<T>) {
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [showFilters, setShowFilters] = useState(false);
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    // If backend pagination is enabled, use totalCount; otherwise, use data length
    const isBackendPagination = totalCount !== undefined && onPageChange !== undefined;
    const total = isBackendPagination ? totalCount : data.length;

    // Client-side filtering, sorting, and pagination (when backend pagination is not used)
    const filteredData = useMemo(() => {
        if (isBackendPagination) return data; // Backend handles filtering

        let filtered = [...data];

        // Apply search
        if (searchQuery && !onSearch) {
            filtered = filtered.filter((item: any) =>
                columns.some(col => {
                    const value = item[col.key];
                    return value && String(value).toLowerCase().includes(searchQuery.toLowerCase());
                })
            );
        }

        // Apply column filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                filtered = filtered.filter((item: any) => {
                    const itemValue = item[key];
                    if (typeof value === 'string') {
                        return String(itemValue).toLowerCase().includes(value.toLowerCase());
                    }
                    return itemValue === value;
                });
            }
        });

        // Apply sorting
        if (sortKey && !onSortChange) {
            filtered.sort((a: any, b: any) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];
                
                if (aVal === bVal) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;
                
                const comparison = aVal < bVal ? -1 : 1;
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return filtered;
    }, [data, searchQuery, filters, sortKey, sortDirection, columns, onSearch, onSortChange, isBackendPagination]);

    // Pagination
    const totalPages = Math.ceil(total / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = isBackendPagination ? data : filteredData.slice(startIndex, endIndex);

    // Handle search
    const handleSearch = (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
        if (onSearch) {
            onSearch(query);
        }
    };

    // Handle filter change
    const handleFilterChange = (key: string, value: any) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        setCurrentPage(1);
        if (onFilterChange) {
            onFilterChange(newFilters);
        }
    };

    // Handle page change
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        if (onPageChange) {
            onPageChange(page, rowsPerPage);
        }
    };

    // Handle rows per page change
    const handleRowsPerPageChange = (value: number) => {
        setRowsPerPage(value);
        setCurrentPage(1);
        if (onPageChange) {
            onPageChange(1, value);
        }
    };

    const rowsPerPageOptions = [10, 25, 50, 100];

    // Handle sorting
    const handleSort = (key: string) => {
        if (!columns.find(col => col.key === key)?.sortable) return;

        const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortKey(key);
        setSortDirection(newDirection);
        
        if (onSortChange) {
            onSortChange(key, newDirection);
        }
    };

    // Handle bulk selection
    const handleSelectAll = () => {
        if (!getRowId) return;
        
        if (selectedRows.size === paginatedData.length) {
            setSelectedRows(new Set());
        } else {
            const allIds = new Set(paginatedData.map(item => getRowId(item)));
            setSelectedRows(allIds);
        }
    };

    const handleSelectRow = (id: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedRows(newSelection);
    };

    // Export to CSV
    const handleExport = () => {
        const csvData = filteredData.map(item => {
            const row: any = {};
            columns.forEach(col => {
                if (col.exportValue) {
                    row[col.header] = col.exportValue(item);
                } else {
                    row[col.header] = (item as any)[col.key];
                }
            });
            return row;
        });

        const headers = columns.map(col => col.header).join(',');
        const rows = csvData.map(row => 
            columns.map(col => {
                const value = row[col.header];
                // Escape quotes and wrap in quotes if contains comma
                const stringValue = String(value || '');
                return stringValue.includes(',') || stringValue.includes('"') 
                    ? `"${stringValue.replace(/"/g, '""')}"` 
                    : stringValue;
            }).join(',')
        ).join('\n');

        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportFilename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const hasBulkActions = bulkActions && bulkActions.length > 0 && getRowId;

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Bulk Actions Bar */}
            {hasBulkActions && selectedRows.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Badge variant="default">{selectedRows.size} selected</Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRows(new Set())}
                        >
                            Clear
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        {bulkActions?.map((action, idx) => (
                            <Button
                                key={idx}
                                variant={action.variant || 'default'}
                                size="sm"
                                onClick={() => action.onClick(Array.from(selectedRows))}
                                className="flex items-center gap-2"
                            >
                                {action.icon}
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                {/* Search */}
                {searchable && (
                    <div className="relative flex-1 max-w-xs">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <Input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Export */}
                    {exportable && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            className="flex items-center gap-2"
                            disabled={filteredData.length === 0}
                        >
                            <Download size={16} />
                            Export CSV
                        </Button>
                    )}

                    {/* Filter Toggle */}
                    {columns.some(col => col.filterable) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2"
                        >
                            <Filter size={16} />
                            Filters
                        </Button>
                    )}

                    {/* Rows per page */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">Rows:</span>
                        <Select
                            value={String(rowsPerPage)}
                            onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
                            className="w-20"
                        >
                            {rowsPerPageOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </Select>
                    </div>
                </div>
            </div>

            {/* Column Filters */}
            {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    {columns.filter(col => col.filterable).map(col => (
                        <div key={col.key}>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                {col.header}
                            </label>
                            {col.filterType === 'select' && col.filterOptions ? (
                                <Select
                                    value={filters[col.key] || ''}
                                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                >
                                    <option value="">All</option>
                                    {col.filterOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Select>
                            ) : (
                                <Input
                                    type={col.filterType || 'text'}
                                    value={filters[col.key] || ''}
                                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                    placeholder={`Filter ${col.header.toLowerCase()}...`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <table className="w-full min-w-[1200px]">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
                        <tr>
                            {/* Bulk selection checkbox */}
                            {hasBulkActions && (
                                <th className="px-4 py-3 w-12">
                                    <input
                                        type="checkbox"
                                        checked={paginatedData.length > 0 && selectedRows.size === paginatedData.length}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary"
                                    />
                                </th>
                            )}
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={`px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider ${
                                        col.sortable ? 'cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''
                                    }`}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.header}
                                        {col.sortable && (
                                            <span className="text-zinc-400">
                                                {sortKey === col.key ? (
                                                    sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                                ) : (
                                                    <ArrowUpDown size={14} />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + (hasBulkActions ? 1 : 0)} className="px-4 py-8 text-center text-zinc-500">
                                    Loading...
                                </td>
                            </tr>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (hasBulkActions ? 1 : 0)} className="px-4 py-8 text-center text-zinc-500">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((item, index) => {
                                const rowId = getRowId ? getRowId(item) : String(index);
                                const isSelected = selectedRows.has(rowId);
                                
                                return (
                                    <tr
                                        key={rowId}
                                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors ${
                                            isSelected ? 'bg-primary/5' : ''
                                        }`}
                                    >
                                        {/* Bulk selection checkbox */}
                                        {hasBulkActions && (
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectRow(rowId)}
                                                    className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary"
                                                />
                                            </td>
                                        )}
                                        {columns.map(col => (
                                            <td key={col.key} className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                                                {col.render(item, startIndex + index)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Showing {startIndex + 1} to {Math.min(endIndex, total)} of {total} entries
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronsLeft size={16} />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={16} />
                        </Button>

                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={currentPage === pageNum ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => handlePageChange(pageNum)}
                                        className="w-8 h-8 p-0"
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight size={16} />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronsRight size={16} />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
