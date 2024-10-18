import React, { startTransition } from "react";
import { Button } from "primereact/button";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DigitizationList } from "../../adapters/ApiDigitizationLists";
import { Extraction } from "../../adapters/ApiExtractions";
import { Category } from "../../adapters/ApiCategories";

interface InternalLinkButtonProps {
    label: string;
    link: string;
}

interface ItemInternalLinkButtonProps {
    category?: Category;
    digitizationList?: DigitizationList;
    extraction?: Extraction;
}

const InternalLinkButton: React.FC<InternalLinkButtonProps> & {
    ShowInCategories: React.FC<ItemInternalLinkButtonProps>;
    ShowInDocuments: React.FC<ItemInternalLinkButtonProps>;
} = ({ label, link }) => {
    const navigate = useNavigate();

    return (
        <Button
            className="internal-link-button"
            label={label}
            onClick={(e) => startTransition(() => navigate(link))}
        />
    );
};

const ShowInDocuments: React.FC<ItemInternalLinkButtonProps> = ({
    category,
    digitizationList,
    extraction,
}) => {
    const { t } = useTranslation("app");

    const getLink = () => {
        if (category) {
            return `/documents?category_id=${category.id}`;
        }
        if (digitizationList) {
            return `/documents?digitization_list_id=${digitizationList.id}`;
        }
        if (extraction) {
            return `/documents?extraction_ids=${extraction.id}`;
        }
    };

    return (
        <InternalLinkButton
            label={t("internal-link.show-in-documents")}
            link={getLink()}
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
