import React from "react";
import EditorProps from "./Editor";
import ExtractionPriorityTag from "../tags/ExtractionPriorityTag";
import { Button } from "primereact/button";

const ExtractionPriorityEditor: React.FC<EditorProps<number>> = ({
    value,
    editorCallback,
    cancelCallback,
}) => {
    return (
        <div className="extraction-priority-editor">
            {[1, 2, 3, 4, 5].map((priority) => (
                <Button
                    key={priority}
                    text
                    className={
                        priority === value
                            ? "button active"
                            : "button non-active"
                    }
                    onClick={(e) => editorCallback(priority)}
                >
                    <ExtractionPriorityTag priority={priority} key={priority} />
                </Button>
            ))}
            <Button
                key="cancel"
                text
                className="p-1 text-red-500"
                icon="pi pi-times"
                onClick={cancelCallback}
            />
        </div>
    );
};

export default ExtractionPriorityEditor;
