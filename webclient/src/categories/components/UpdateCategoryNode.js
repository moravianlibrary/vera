import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";


const UpdateCategoryView = (props) => {
    const { t } = useTranslation();
    const { node } = props;
    const departmentsOptions = props.departments;

    const { category } = node;
    const [name, setName] = useState(node.category && node.category.name);
    const [description, setDescription] = useState(node.category && node.category.description);
    const [assignable, setAssignable] = useState(node.category && node.category.assignable);
    const [departments, setDepartments] = useState(node.category && node.category.departments);

    const handleUpdate = () => {
        if (props.onUpdate) {
            const values = {
                name: name,
                description: description,
                assignable: assignable,
                departments: departments
            }
            props.onUpdate(node, values);
        }
        handleCloseEditing();
    }

    const handleCloseEditing = () => {
        if (props.onCloseEditing) {
            props.onCloseEditing(node);
        }
    }

    return (
        <div>
            <div className="flex flex-column gap-3">
                <div className="flex jsutify-content-start gap-2">
                    <Button className="p-1 surface-200" text severity="success" onClick={handleUpdate}>
                        <i className="pi pi-check" style={{ fontSize: '0.75rem' }} />
                    </Button>
                    <Button className="p-1 surface-200" text severity="danger" onClick={handleCloseEditing}>
                        <i className="pi pi-times" style={{ fontSize: '0.75rem' }} />
                    </Button>
                </div>
                <InputText
                    placeholder={t('name')}
                    keyfilter="alphanum"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                /> 
                <InputTextarea
                    placeholder={t('description')}
                    keyfilter="alphanum"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex align-items-center">
                    <Checkbox
                        inputId="assignable"
                        onChange={e => setAssignable(e.checked)}
                        checked={assignable}
                    />
                    <label htmlFor="assignable" className="ml-2">{t('assignable_category')}</label>
                </div>
                {departmentsOptions && departmentsOptions.length > 0 &&
                <div className="flex flex-column gap-1">
                    <span className="text-left">{t('use_category_departments')}:</span>
                    <div className="card flex justify-content-center">
                        <MultiSelect
                            placeholder={t('select_departments')}
                            value={departments} 
                            onChange={(e) => setDepartments(e.value)} 
                            options={departmentsOptions} 
                            optionLabel="name"
                            className="w-full md:w-20rem"
                            // selectedItemTemplate={(value) => <span>{value.name}</span>}
                            display="chip" 
                        />
                    </div>
                </div>}
            </div>
        </div>
    );
};

export default UpdateCategoryView;
