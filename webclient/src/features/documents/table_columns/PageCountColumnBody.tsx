import { useTranslation } from "react-i18next";
import { IndexDocument } from "../../../adapters/ApiDocuments";

const PageCountColumnBody = (document: IndexDocument) => {
    const { t } = useTranslation();

    const counts = [
        document.page_count_catalog,
        document.page_count_manual,
        document.page_count_predicted,
    ].filter((x) => x);

    if (counts.length === 1) {
        return counts[0];
    } else if (counts.length === 0) {
        return null;
    }

    const countsJoined: string[] = [];

    if (document.page_count_catalog) {
        countsJoined.push(
            `${t("from catalog")}: ${document.page_count_catalog}`
        );
    }
    if (document.page_count_manual) {
        countsJoined.push(
            `${t("set manually")}: ${document.page_count_manual}`
        );
    }
    if (document.page_count_predicted) {
        countsJoined.push(
            `${t("predicted")}: ${document.page_count_predicted}`
        );
    }

    return countsJoined.join(", ");
};

export default PageCountColumnBody;
