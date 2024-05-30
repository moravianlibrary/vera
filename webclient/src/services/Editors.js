import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MaterialType } from "../types/MaterialType";
import { IssuanceType } from "../types/IssuanceType";

export const textEditor = (options) => {
    return <InputText type="text" value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
};

export const numberEditor = (options) => {
    return <InputNumber 
        value={options.value}
        onValueChange={(e) => options.editorCallback(e.target.value)}
        min={1}
    />;
};

export const textareaEditor = (options) => {
    return <InputTextarea type="text" autoResize rows={1} value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
};

export const CategoryEditor = (options) => {
    return (
        <></>
    )
    // const { categories } = useAssignableCategories();
    // return (
    //     <Dropdown
    //         value={options.value}
    //         options={categories.map(category => category.name)}
    //         onChange={(e) => options.editorCallback(e.value)}
    //     />
    // );
};

export const MaterialTypeEditor = (options) => {
    return (
        <Dropdown
            value={options.value}
            options={Object.values(MaterialType)}
            onChange={(e) => options.editorCallback(e.value)}
        />
    );
};

export const IssuanceTypeEditor = (options) => {
    return (
        <Dropdown
            value={options.value}
            options={Object.values(IssuanceType)}
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
