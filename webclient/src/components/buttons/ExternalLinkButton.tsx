import React from "react";
import { Button } from "primereact/button";

interface ExternalLinkButtonProps {
    label: string;
    url: string;
}

const ExternalLinkButton: React.FC<ExternalLinkButtonProps> = ({
    label,
    url,
}) => {
    return (
        <div className="flex align-items-center gap-2">
            <span>{label}</span>
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

export default ExternalLinkButton;
