import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";

export const textEditor = (options) => {
    return <InputText type="text" value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
};

export const numberEditor = (options) => {
    return <InputNumber value={options.value} onValueChange={(e) => options.editorCallback(e.target.value)} min={1} />;
};

export const textareaEditor = (options) => {
    return <InputTextarea type="text" autoResize value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
};

export const categoryEditor = (options) => {
    return (
        <Dropdown
            value={options.value}
            options={options.categories.map(category => category.name)}
            onChange={(e) => options.editorCallback(e.value)}
        />
    );
};

export const departmentEditor = (options) => {
    return (
        <Dropdown
            value={options.value}
            options={options.departments.map(department => department.abbreviation)}
            onChange={(e) => options.editorCallback(e.value)}
        />
    );
};

export const roleEditor = (options) => {
    return (
        <Dropdown
            value={options.value}
            options={options.roles.map(role => role.name)}
            onChange={(e) => options.editorCallback(e.value)}
        />
    );
};
