import { Tag } from "primereact/tag";
import React from "react";

interface ValidityTagProps {
    label: string;
    isValid: boolean;
}

const ValidityTag: React.FC<ValidityTagProps> = ({ label, isValid }) => {
    return <Tag value={label} className={`tag-validity-${isValid}`} />;
};

export default ValidityTag;
