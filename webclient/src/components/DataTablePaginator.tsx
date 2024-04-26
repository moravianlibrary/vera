import React from "react";
import { Paginator, PaginatorPageChangeEvent } from "primereact/paginator";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";

interface DataTablePaginatorProps {
    offset: number;
    limit: number;
    numFound: number;
    onPageChange: (event: PaginatorPageChangeEvent) => void;
    onRefresh?: () => void;
}

const DataTablePaginator: React.FC<DataTablePaginatorProps> = ({
    offset,
    limit,
    numFound,
    onPageChange,
    onRefresh,
}) => {
    const { t } = useTranslation();

    const refreshButton = (
        <Button
            className="p-button-text"
            icon="pi pi-refresh"
            onClick={() => onRefresh?.()}
        />
    );

    return (
        <Paginator
            className="border-top-2 border-solid surface-50 fixed bottom-0 w-full"
            first={offset}
            rowsPerPageOptions={[10, 15, 20, 25, 50]}
            rows={limit}
            totalRecords={numFound}
            onPageChange={onPageChange}
            rightContent={onRefresh ? refreshButton : <></>}
            leftContent={<> </>}
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
