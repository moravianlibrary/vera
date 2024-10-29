import React from "react";
import { Toolbar } from "primereact/toolbar";
import EsSearchBox from "../../components/elasticsearch/EsSearchBox";
import EsSelectionMenu from "../../components/elasticsearch/EsSelectionMenu";
import DocumentsActionsMenuItems from "./DocumentsActionsMenuItems";
import { useDocuments } from "../../contexts/DocumentsContext";
import AddDocumentsMenu from "./AddDocumentsMenu";

interface DocumentsHeaderProps {}

const DocumentsHeader: React.FC<DocumentsHeaderProps> = ({}) => {
    return (
        <Toolbar
            start={<AddDocumentsMenu />}
            center={<EsSearchBox />}
            end={
                <EsSelectionMenu
                    selectionProps={useDocuments()}
                    actionsMenuItems={DocumentsActionsMenuItems()}
                    numSelectedLabelNs="documents"
                />
            }
        />
    );
};

export default DocumentsHeader;
