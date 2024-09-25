import { Tag } from "primereact/tag";
import React from "react";

interface NotFoundTagProps {
    label: string;
}

const NotFoundTag: React.FC<NotFoundTagProps> = ({ label }) => {
    return <Tag value={label} className="tag-not-found" />;
};

export default NotFoundTag;
