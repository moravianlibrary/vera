import React from "react";
import { Button } from "primereact/button";
import {
    createCnbLink,
    createDigitizationRegistryLink,
    createMzkAlephLink,
    createSkcLink,
} from "../../data/factories/LinksFactory";

interface ExternalLinkButtonProps {
    label: string;
    url: string;
    hideValue?: boolean;
}

interface SpecificLinkButtonProps {
    value?: string;
    hideValue?: boolean;
}

const ExternalLinkButton: React.FC<ExternalLinkButtonProps> & {
    MzkCatalog: React.FC<SpecificLinkButtonProps>;
    SckCatalog: React.FC<SpecificLinkButtonProps>;
    CnbCatalog: React.FC<SpecificLinkButtonProps>;
    DigitizationRegistry: React.FC<SpecificLinkButtonProps>;
} = ({ label, url, hideValue }) => {
    return (
        <div className="flex align-items-center gap-2">
            {!hideValue && <span>{label}</span>}
            <Button
                className="p-1 text-blue-600"
                text
                onClick={() => window.open(url, "_blank")}
            >
                <i className="pi pi-external-link" />
            </Button>
        </div>
    );
};

const MzkCatalog: React.FC<SpecificLinkButtonProps> = ({ value }) => {
    return value ? (
        <ExternalLinkButton label={value} url={createMzkAlephLink(value)} />
    ) : null;
};

const SkcCatalog: React.FC<SpecificLinkButtonProps> = ({ value }) => {
    return value ? (
        <ExternalLinkButton label={value} url={createSkcLink(value)} />
    ) : null;
};

const CnbCatalog: React.FC<SpecificLinkButtonProps> = ({ value }) => {
    return value ? (
        <ExternalLinkButton label={value} url={createCnbLink(value)} />
    ) : null;
};

const DigitizationRegistry: React.FC<SpecificLinkButtonProps> = ({
    value,
    hideValue,
}) => {
    return value ? (
        <ExternalLinkButton
            label={value}
            url={createDigitizationRegistryLink(Number(value))}
            hideValue={hideValue}
        />
    ) : null;
};

ExternalLinkButton.MzkCatalog = MzkCatalog;
ExternalLinkButton.SckCatalog = SkcCatalog;
ExternalLinkButton.CnbCatalog = CnbCatalog;
ExternalLinkButton.DigitizationRegistry = DigitizationRegistry;

export default ExternalLinkButton;
