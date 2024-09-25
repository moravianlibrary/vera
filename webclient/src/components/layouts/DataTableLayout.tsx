import React from "react";

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
    return (
        <div className="layout-datatable">
            {header && (
                <header className="layout-datatable-header">{header}</header>
            )}
            {sidebar && (
                <aside className="layout-datatable-sidebar">{sidebar}</aside>
            )}
            <section className="layout-datatable-section">{datatable}</section>
            <footer className="layout-datatable-paginator">{paginator}</footer>
        </div>
    );
};

export default DataTableLayout;
