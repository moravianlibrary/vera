import React from "react";
import { Button } from "primereact/button";

interface DeleteButtonProps {
    disabled?: boolean;
    onDelete?: () => void;
    itemId?: number;
    onDeleteItem?: (itemId: number) => void;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
    disabled,
    onDelete,
    itemId,
    onDeleteItem,
}) => {
    const handleClick = () => {
        if (itemId && onDeleteItem) {
            onDeleteItem(itemId);
        } else if (onDelete) {
            onDelete();
        }
    };
    return (
        <Button
            disabled={disabled}
            className="p-button-rounded p-button-text p-button-danger"
            icon="pi pi-trash"
            onClick={handleClick}
        />
    );
};

export default DeleteButton;
