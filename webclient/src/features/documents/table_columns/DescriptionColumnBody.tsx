import { IndexDocument } from "../../../adapters/ApiDocuments";
import { parseDescription } from "../../../data/factories/DocumentAttributesFactory";

const DescriptionColumnBody = (document: IndexDocument) => {
    return parseDescription(
        document.volume_year,
        document.volume,
        document.bundle
    );
};

export default DescriptionColumnBody;
