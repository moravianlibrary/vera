import React, { useState } from "react";
import ExtractionPriorityEditor from "../editors/ExtractionPriorityEditor";
import ExtractionPriorityTag from "../tags/ExtractionPriorityTag";
import { Button } from "primereact/button";

interface ExtractionPrioritySelectProps {
    value: number;
    onValueChange: (priority: number) => void;
}

const ExtractionPrioritySelect: React.FC<ExtractionPrioritySelectProps> = ({
    value,
    onValueChange,
}) => {
    const [isEditing, setIsEditing] = useState<boolean>(false);

    const onEditorCallback = (priority: number) => {
        setIsEditing(false);
        onValueChange(priority);
    };

    if (isEditing) {
        return (
            <ExtractionPriorityEditor
                value={value}
                editorCallback={onEditorCallback}
                cancelCallback={() => setIsEditing(false)}
            />
        );
    }

    return (
        <div className="extraction-priority-select flex align-items-baseline">
            <ExtractionPriorityTag priority={value} />
            <Button
                className="text-500 p-0 m-0"
                text
                icon="pi pi-pencil"
                onClick={(e) => setIsEditing(true)}
            />
        </div>
    );
};

export default ExtractionPrioritySelect;
