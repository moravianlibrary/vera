import { IndexDocument } from "../../../adapters/ApiDocuments";

const DescriptionColumnBody = (document: IndexDocument) => {
    return [document.volume_year, document.volume, document.bundle]
        .filter((x) => x)
        .join(" ");
};

export default DescriptionColumnBody;
