import { InputText } from "primereact/inputtext";

const textEditor = (options) => {
    return (
        <InputText
            type="text"
            value={options.value}
            onChange={(e) => options.editorCallback(e.target.value)}
        />
    );
};

export { textEditor };
