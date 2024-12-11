import { DataTable } from "primereact/datatable";
import React, { Fragment, useState } from "react";
import { Column } from "primereact/column";
import DataTablePaginator from "./DataTablePaginator";
import { useTranslation } from "react-i18next";
import { EsContextProps } from "../../elasticsearch/EsContext";

interface ColumnProps {
    field: string;
    renderer?: (rowData: any) => React.ReactNode;
}

interface DataTableLayoutProps<T> {
    context: EsContextProps<T>;
    columns: ColumnProps[];
    header?: React.ReactNode;
    sidebar?: React.ReactNode;
    dialog?: React.ReactNode;
}

const DataTableLayout = <T,>({
    context,
    columns,
    header,
    sidebar,
    dialog,
}: DataTableLayoutProps<T>) => {
    const { t } = useTranslation("app");
    const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(
        sidebar !== undefined
    );

    const datatable = (
        <DataTable
            value={context.items}
            scrollable
            scrollHeight="flex"
            dataKey={"id"}
            emptyMessage={t("table.no-data")}
            // selectionMode="checkbox"
            // selection={currentPageSelected}
            // onSelectionChange={handleDataTableSelectionChange}
            onMouseDownCapture={(e) => {
                e.stopPropagation();
            }}
        >
            {columns.map((c, i) => (
                <Column
                    key={i}
                    field={c.field}
                    header={c.field}
                    body={c.renderer}
                />
            ))}
        </DataTable>
    );
    const paginator = <DataTablePaginator context={context} />;

    return (
        <div className="layout-datatable">
            {header && <div className="header">{header}</div>}
            {sidebar && (
                <Fragment>
                    <div className="sidebar" hidden={!isSidebarVisible}>
                        {sidebar}
                    </div>
                    <button
                        className="toggle-sidebar-btn surface-50 text-500 border-2 border-round border-200"
                        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                    >
                        <i
                            className={`text-xs pi pi-chevron-${
                                isSidebarVisible ? "left" : "right"
                            }`}
                        />
                    </button>
                </Fragment>
            )}
            <div className="section">{datatable}</div>
            {paginator && <div className="paginator">{paginator}</div>}
            {dialog && <div className="dialog">{dialog}</div>}
        </div>
    );
};

export default DataTableLayout;
