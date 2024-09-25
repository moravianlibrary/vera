import React from "react";
import { Paginator, PaginatorPageChangeEvent } from "primereact/paginator";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Badge } from "primereact/badge";

interface DataTablePaginatorProps {
    offset?: number;
    limit?: number;
    numFound: number;
    page?: number;
    pageSize?: number;
    onPageChange?: (e: PaginatorPageChangeEvent) => void;
    onPageChangeNew?: (newPage: number) => void;
    onPageSizeChange?: (newPageSize: number) => void;
    rightContent?: React.ReactNode;
    onRefresh?: () => void;
    leftContent?: React.ReactNode;
    numFoundText?: string;
}

const DataTablePaginator: React.FC<DataTablePaginatorProps> = ({
    offset,
    limit,
    numFound,
    page,
    pageSize,
    onPageChange,
    onPageChangeNew,
    onPageSizeChange,
    rightContent,
    onRefresh,
    leftContent,
    numFoundText,
}) => {
    const { t } = useTranslation();

    const handlePageChange = (event: PaginatorPageChangeEvent) => {
        if (onPageChange) {
            onPageChange(event);
        }

        if (onPageChangeNew && event.page + 1 !== page) {
            onPageChangeNew(event.page + 1);
        }
        if (onPageSizeChange && event.rows !== pageSize) {
            onPageSizeChange(event.rows);
        }
    };

    const refreshButton = (
        <Button
            className="p-button-text"
            icon="pi pi-refresh"
            onClick={() => onRefresh?.()}
        />
    );

    const getFirst = () => {
        if (offset) {
            return offset;
        }
        if (page && pageSize) {
            return pageSize * (page - 1) + 1;
        }
        return 0;
    };

    const getRows = () => {
        if (limit) {
            return limit;
        }
        if (pageSize) {
            return pageSize;
        }
        return 10;
    };

    const numFoundLabel = () => {
        if (!numFoundText) {
            return null;
        }
        return (
            <Badge
                className="surface-50 text-gray-600"
                value={`${t(numFoundText)}: ${numFound}`}
            />
        );
    };

    return (
        <Paginator
            className="border-top-2 border-solid surface-50 fixed bottom-0 w-full"
            first={getFirst()}
            rowsPerPageOptions={[10, 15, 20, 25, 50]}
            rows={getRows()}
            totalRecords={numFound || 1}
            onPageChange={handlePageChange}
            rightContent={rightContent || onRefresh ? refreshButton : <></>}
            leftContent={leftContent || numFoundLabel() || <> </>}
            template={{
                layout: "FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown",
                PageLinks: (options) => {
                    if (
                        (options.view.startPage === options.page &&
                            options.view.startPage !== 0) ||
                        (options.view.endPage === options.page &&
                            options.page + 1 !== options.totalPages)
                    ) {
                        return <span style={{ userSelect: "none" }}>...</span>;
                    }

                    return (
                        <button
                            type="button"
                            className={options.className}
                            onClick={options.onClick}
                        >
                            {options.page + 1}
                        </button>
                    );
                },
                RowsPerPageDropdown: (options) => {
                    return (
                        <React.Fragment>
                            <span
                                className="mx-1"
                                style={{
                                    color: "var(--text-color)",
                                    userSelect: "none",
                                }}
                            >
                                {t("Items per page")}:{" "}
                            </span>
                            <Dropdown
                                value={options.value}
                                options={options.options}
                                onChange={options.onChange}
                            />
                        </React.Fragment>
                    );
                },
            }}
        />
    );
};

export default DataTablePaginator;
