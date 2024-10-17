import React from "react";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DigitizationList } from "../../adapters/ApiDigitizationLists";
import { Extraction } from "../../adapters/ApiExtractions";

interface InternalLinkButtonProps {
    label: string;
    link: string;
}

interface ItemInternalLinkButtonProps {
    digitizationList?: DigitizationList;
    extraction?: Extraction;
}

const InternalLinkButton: React.FC<InternalLinkButtonProps> & {
    ShowInCategories: React.FC<ItemInternalLinkButtonProps>;
    ShowInDocuments: React.FC<ItemInternalLinkButtonProps>;
} = ({ label, link }) => {
    return (
        <Link to={link}>
            <Button className="internal-link-button" label={label} />
        </Link>
    );
};

const ShowInDocuments: React.FC<ItemInternalLinkButtonProps> = ({
    digitizationList,
    extraction,
}) => {
    const { t } = useTranslation("app");

    const getLink = () => {
        if (digitizationList) {
            return `/documents?digitizationListId=${digitizationList.id}`;
        }
        if (extraction) {
            return `/documents?extractionId=${extraction.id}`;
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
    digitizationList,
    extraction,
}) => {
    const { t } = useTranslation("app");

    const getLink = () => {
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
