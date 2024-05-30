import React from "react";
import { DataTable } from "primereact/datatable";
import { useTranslation } from "react-i18next";
import { useIntentions } from "../../contexts/categories/IntentionsContext";
import { Column } from "primereact/column";

interface IntentionsTableProps {}

const IntentionsTable: React.FC<IntentionsTableProps> = (props) => {
    const { t } = useTranslation();
    const { intentions } = useIntentions();
    console.log(intentions);

    return (
        <div>
            <DataTable
                className="documents-table"
                value={intentions}
                scrollable
                scrollHeight="calc(100vh - 170px)"
                columnResizeMode="expand"
            >
                <Column header={t("Name")} field="name" />
                <Column
                    header={t("Target page count")}
                    field="target_page_count"
                />
            </DataTable>
        </div>
    );
};

export default IntentionsTable;
