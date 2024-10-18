import React from "react";
import { Button } from "primereact/button";

interface DeleteButtonProps {
    disabled?: boolean;
    onDelete?: () => void;
    itemId?: number;
    onDeleteItem?: (itemId: number) => void;
    hideWhenDisabled?: boolean;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
    disabled,
    onDelete,
    itemId,
    onDeleteItem,
    hideWhenDisabled,
}) => {
    const handleClick = () => {
        if (itemId && onDeleteItem) {
            onDeleteItem(itemId);
        } else if (onDelete) {
            onDelete();
        }
    };

    if (disabled && hideWhenDisabled) return null;

    return (
        <Button
            disabled={disabled}
            className="p-button-rounded p-button-text"
            severity={disabled ? "secondary" : "danger"}
            icon="pi pi-trash"
            onClick={handleClick}
        />
    );
};

export default DeleteButton;
