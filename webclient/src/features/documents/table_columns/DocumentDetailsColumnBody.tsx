import { Button } from "primereact/button";
import { IndexDocument } from "../../../adapters/ApiDocuments";
import { useDocuments } from "../../../contexts/DocumentsContext";

const DocumentDetailsColumnBody = (document: IndexDocument) => {
    const { expandedRows, onRowExpand, onRowCollapse } = useDocuments();

    const isVisible = () => {
        return document.id in expandedRows && expandedRows[document.id];
    };

    const toggleDetailsVisibility = () => {
        if (!isVisible()) {
            onRowExpand(document);
        } else {
            onRowCollapse(document);
        }
    };

    return (
        <Button
            className="details-button"
            text={!isVisible()}
            onClick={toggleDetailsVisibility}
        >
            <i className="pi pi-book" />
        </Button>
    );
};

export default DocumentDetailsColumnBody;
