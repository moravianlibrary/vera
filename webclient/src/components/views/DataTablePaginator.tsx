import React from "react";
import { Paginator, PaginatorPageChangeEvent } from "primereact/paginator";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Badge } from "primereact/badge";

interface DataTablePaginatorProps {
    numFound: number;
    page: number;
    pageSize: number;
    onPageChange: (newPage: number) => void;
    onPageSizeChange: (newPageSize: number) => void;
    rightContent?: React.ReactNode;
    onRefresh?: () => void;
    leftContent?: React.ReactNode;
    numFoundText?: string;
    pageSizeOptions?: number[];
}

const DataTablePaginator: React.FC<DataTablePaginatorProps> = ({
    numFound,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    rightContent,
    onRefresh,
    leftContent,
    numFoundText,
    pageSizeOptions,
}) => {
    const { t } = useTranslation("app");
    const handlePageChange = (event: PaginatorPageChangeEvent) => {
        if (onPageChange && event.page + 1 !== page) {
            onPageChange(event.page + 1);
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
        return pageSize > 1 ? pageSize * (page - 1) + 1 : page - 1;
    };

    const numFoundLabel = () => {
        if (!numFoundText) {
            return null;
        }
        return (
            <Badge className="surface-50 text-gray-600" value={numFoundText} />
        );
    };

    return (
        <Paginator
            className="border-top-2 border-solid surface-50 w-full"
            first={getFirst()}
            rowsPerPageOptions={pageSizeOptions || [10, 15, 20, 25, 50]}
            rows={pageSize}
            totalRecords={numFound || 1}
            onPageChange={handlePageChange}
            rightContent={rightContent || onRefresh ? refreshButton : <></>}
            leftContent={leftContent || numFoundLabel() || <> </>}
            template={{
                layout: `FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink ${
                    onPageSizeChange ? "RowsPerPageDropdown" : ""
                }`,
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
                                {t("paginator.items-per-page")}:{" "}
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
