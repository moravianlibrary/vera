import React from "react";
import { Toolbar } from "primereact/toolbar";
import { useTranslation } from "react-i18next";
import EsSearchBox from "../../components/elasticsearch/EsSearchBox";
import EsSelectionMenu from "../../components/elasticsearch/EsSelectionMenu";
import DocumentsInsertMenu from "./DocumentsInsertMenu";
import DocumentsActionsMenuItems from "./DocumentsActionsMenuItems";
import { useDocuments } from "../../contexts/DocumentsContext";

interface DocumentsHeaderProps {}

const DocumentsHeader: React.FC<DocumentsHeaderProps> = ({}) => {
    const { t } = useTranslation("documents");

    return (
        <Toolbar
            start={<DocumentsInsertMenu />}
            center={<EsSearchBox />}
            end={
                <EsSelectionMenu
                    selectionProps={useDocuments()}
                    actionsMenuItems={DocumentsActionsMenuItems()}
                    numSelectedLabel={t("num-selected")}
                />
            }
        />
    );
};

export default DocumentsHeader;
