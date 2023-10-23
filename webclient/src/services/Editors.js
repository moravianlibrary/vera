import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { data } from '../services/Data';

export const textEditor = (options) => {
    return <InputText type="text" value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
};

// export const departmentEditor = (options) => {
//     return (
//         <Dropdown
//             value={options.value}
//             options={departments.map(department => department.abbreviation)}
//             onChange={(e) => options.editorCallback(e.value)}
//         />
//     );
// };

export const roleEditor = (options) => {
    return (
        <Dropdown
            value={options.value}
            options={data.getRolesNames()}
            onChange={(e) => options.editorCallback(e.value)}
        />
    );
};
