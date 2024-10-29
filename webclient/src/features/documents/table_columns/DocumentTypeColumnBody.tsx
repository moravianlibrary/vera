import { IndexDocument } from "../../../adapters/ApiDocuments";
import DocumentTypeTag from "../../../components/tags/DocumentTypeTag";

const DocumentTypeColumnBody = (document: IndexDocument) => {
    return (
        <DocumentTypeTag
            materialType={document.material_type}
            issuanceType={document.issuance_type}
        />
    );
};

export default DocumentTypeColumnBody;
