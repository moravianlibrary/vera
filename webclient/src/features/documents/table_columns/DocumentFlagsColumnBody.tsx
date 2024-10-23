import { IndexDocument } from "../../../adapters/ApiDocuments";
import DocumentFlagTag from "../../../components/tags/DocumentFlagTag";
import { orderBy } from "../../../types/DocumentFlag";

const DocumentFlagsColumnBody = (document: IndexDocument) => {
    return (
        <div className="flex flex-wrap gap-2">
            {document.document_flags.sort(orderBy).map((flag, index) => (
                <DocumentFlagTag key={index} flag={flag} />
            ))}
        </div>
    );
};

export default DocumentFlagsColumnBody;
