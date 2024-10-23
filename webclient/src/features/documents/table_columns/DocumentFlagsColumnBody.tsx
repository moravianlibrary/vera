import { IndexDocument } from "../../../adapters/ApiDocuments";
import DocumentFlagTag from "../../../components/tags/DocumentFlagTag";

const DocumentFlagsColumnBody = (document: IndexDocument) => {
    return <DocumentFlagTag.List flags={document.document_flags} />;
};

export default DocumentFlagsColumnBody;
