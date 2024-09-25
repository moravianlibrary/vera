import React from "react";
import { Rating, RatingChangeEvent } from "primereact/rating";
import EditorProps from "./Editor";

const ExtractionPriorityEditor: React.FC<EditorProps<number>> = ({
    value,
    editorCallback,
    cancelCallback,
}) => {
    const handleChange = (e: RatingChangeEvent) => {
        if (e && e.value) {
            editorCallback(e.value);
        } else {
            cancelCallback();
        }
    };

    return (
        <Rating
            value={value}
            stars={5}
            cancel={true}
            cancelIcon="pi pi-times"
            onIcon={<i className={`extraction-priority-${value}-icon`} />}
            offIcon={<i className="extraction-priority-empty-icon" />}
            onChange={handleChange}
        />
    );
};

export default ExtractionPriorityEditor;
