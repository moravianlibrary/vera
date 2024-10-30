import React, { startTransition } from "react";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DigitizationList } from "../../adapters/ApiDigitizationLists";
import { Extraction } from "../../adapters/ApiExtractions";
import { Category } from "../../adapters/ApiCategories";

interface InternalLinkButtonProps {
    label: string;
    link: string;
    openInNewTab?: boolean;
}

interface ItemInternalLinkButtonProps {
    category?: Category;
    digitizationList?: DigitizationList;
    extraction?: Extraction;
    documentsQuery?: string;
    documentId?: number;
    openInNewTab?: boolean;
}

const InternalLinkButton: React.FC<InternalLinkButtonProps> & {
    ShowInCategories: React.FC<ItemInternalLinkButtonProps>;
    ShowInDocuments: React.FC<ItemInternalLinkButtonProps>;
} = ({ label, link, openInNewTab }) => {
    const navigate = useNavigate();

    if (openInNewTab) {
        return (
            <Button
                className="p-1 text-blue-600"
                text
                onClick={() => window.open(link, "_blank")}
            >
                <i className="pi pi-external-link" />
            </Button>
        );
    }

    return (
        <Button
            className="internal-link-button"
            label={label}
            onClick={(e) => startTransition(() => navigate(link))}
        />
    );
};

const DOCUMENTS_BASE = "/documents?index_name=documents";

const ShowInDocuments: React.FC<ItemInternalLinkButtonProps> = ({
    category,
    digitizationList,
    extraction,
    documentsQuery,
    documentId,
    openInNewTab,
}) => {
    const { t } = useTranslation("app");

    const getLink = () => {
        if (category) {
            return `${DOCUMENTS_BASE}/category_ids=${category.id}`;
        }
        if (digitizationList) {
            return `${DOCUMENTS_BASE}&digitization_list_id=${digitizationList.id}`;
        }
        if (extraction) {
            return `${DOCUMENTS_BASE}&extraction_ids=${extraction.id}`;
        }
        if (documentsQuery) {
            return `${DOCUMENTS_BASE}&query=${documentsQuery}`;
        }
        if (documentId) {
            return `${DOCUMENTS_BASE}&id=${documentId}:${documentId}`;
        }
    };

    return (
        <InternalLinkButton
            label={t("internal-link.show-in-documents")}
            link={getLink()}
            openInNewTab={openInNewTab}
        />
    );
};

const ShowInCategories: React.FC<ItemInternalLinkButtonProps> = ({
    category,
    digitizationList,
    extraction,
}) => {
    const { t } = useTranslation("app");

    const getLink = () => {
        if (category) {
            return `/categories?category_id=${category.id}`;
        }
        if (digitizationList) {
            return `/categories?digitizationListId=${digitizationList.id}`;
        }
        if (extraction) {
            return `/categories?extractionId=${extraction.id}`;
        }
    };

    return (
        <InternalLinkButton
            label={t("internal-link.show-in-categories")}
            link={getLink()}
        />
    );
};

InternalLinkButton.ShowInCategories = ShowInCategories;
InternalLinkButton.ShowInDocuments = ShowInDocuments;

export default InternalLinkButton;
