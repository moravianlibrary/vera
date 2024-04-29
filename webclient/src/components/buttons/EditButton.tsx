import React from "react";
import { Button } from "primereact/button";

interface EditButtonProps {
    disabled?: boolean;
    onEdit?: () => void;
    itemId?: number;
    onEditItem?: (itemId: number) => void;
}

const EditButton: React.FC<EditButtonProps> = ({
    disabled,
    onEdit,
    itemId,
    onEditItem,
}) => {
    const handleClick = () => {
        if (itemId && onEditItem) {
            onEditItem(itemId);
        } else if (onEdit) {
            onEdit();
        }
    };

    return (
        <Button
            disabled={disabled}
            className="p-button-rounded p-button-text"
            icon="pi pi-pencil"
            onClick={handleClick}
        />
    );
};

export default EditButton;
