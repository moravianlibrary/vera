import { Button } from "primereact/button";
import React, { useEffect, useState } from "react";

interface DataTableLayoutProps {
    header?: React.ReactNode;
    sidebar?: React.ReactNode;
    datatable: React.ReactNode;
    paginator: React.ReactNode;
}

const DataTableLayout: React.FC<DataTableLayoutProps> = ({
    header,
    sidebar,
    datatable,
    paginator,
}) => {
    const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(
        sidebar !== undefined
    );

    return (
        <div className="layout-datatable">
            {header && <div className="header">{header}</div>}
            {sidebar && (
                <div className="sidebar" hidden={!isSidebarVisible}>
                    {sidebar}
                </div>
            )}
            {sidebar && (
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
            )}
            <div className="section">{datatable}</div>
            <div className="paginator">{paginator}</div>
        </div>
    );
};

export default DataTableLayout;
