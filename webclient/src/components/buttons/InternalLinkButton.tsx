import React from "react";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";

interface InternalLinkButtonProps {
    label: string;
    link: string;
}

const InternalLinkButton: React.FC<InternalLinkButtonProps> = ({
    label,
    link,
}) => {
    return (
        <Link to={link}>
            <Button className="internal-link-button" label={label} />
        </Link>
    );
};

export default InternalLinkButton;
