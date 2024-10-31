import { InputNumber } from "primereact/inputnumber";
import EditorProps from "./Editor";
import { Button } from "primereact/button";
import { useState } from "react";

const NumberEditor: React.FC<EditorProps<number>> = ({
    value,
    editorCallback,
    cancelCallback,
}) => {
    const [currValue, setCurrValue] = useState<number>(value);

    return (
        <div className="number-editor">
            <InputNumber
                className="w-6rem"
                value={currValue}
                onChange={(e) => setCurrValue(e.value)}
            />
            <Button
                key="submit"
                text
                className="p-1 text-green-500"
                icon="pi pi-check"
                onClick={() => editorCallback(currValue)}
            />
            {cancelCallback && (
                <Button
                    key="cancel"
                    text
                    className="p-1 text-red-500"
                    icon="pi pi-times"
                    onClick={cancelCallback}
                />
            )}
        </div>
    );
};

export default NumberEditor;
