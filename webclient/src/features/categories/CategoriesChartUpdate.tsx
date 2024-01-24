import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Chip } from 'primereact/chip';
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { NodeType } from "../../contexts/categories/CategoryNodeType";
import { useDepartments } from "../../contexts/departments/DepartmentsContext";
import { Tooltip } from "primereact/tooltip";
import { Department } from "../../adapters/ApiDepartments";

interface CategoriesChartUpdateProps {
    node: CategoryNode
};

const CategoriesChartUpdate: React.FC<CategoriesChartUpdateProps> = ({ node }) => {
    const { handleUpdateCategoryNode, handleCloseCategoryNodeEdit } = useCategoryNodes();
    const { t } = useTranslation();
    
    const { departments: departmentsOptions } = useDepartments();
    const category = node.category;

    const [name, setName] = useState<string>(category.name);
    const [description, setDescription] = useState<string>(category.description ? category.description : "");
    const [assignable, setAssignable] = useState<boolean>(category.assignable);
    const [departments, setDepartments] = useState<Department[]>(
        departmentsOptions.filter(d => category.departments.includes(d.id)));

    const handleUpdate = () => {
        handleUpdateCategoryNode(node, { name, description, assignable,
            departments: departments.map(d => d.id) });
    }

    useEffect(() => {
        console.log(node.predecessors_departments);
    }, [node.predecessors_departments]);

    return (
        <div>
            <div className="flex flex-column gap-3">
                <div className="flex jsutify-content-start gap-2">
                    <Button 
                        className="p-1 surface-200"
                        text
                        severity="success"
                        onClick={handleUpdate}
                    >
                        <i className="pi pi-check" style={{ fontSize: '0.75rem' }} />
                    </Button>
                    <Button
                        className="p-1 surface-200"
                        text
                        severity="danger"
                        onClick={() => handleCloseCategoryNodeEdit(node)}
                    >
                        <i className="pi pi-times" style={{ fontSize: '0.75rem' }} />
                    </Button>
                </div>
                <InputText
                    placeholder={t('name')}
                    keyfilter={/^[a-zA-Z0-9\s]+$/}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                /> 
                <InputTextarea
                    placeholder={t('description')}
                    keyfilter={/^[a-zA-Z0-9\s,:\.]+$/}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex align-items-center">
                    <Checkbox
                        inputId="assignable"
                        checked={assignable}
                        onChange={(e) => setAssignable(e.checked ? e.checked : false)}
                    />
                    <label htmlFor="assignable" className="ml-2">{t('assignable_category')}</label>
                </div>
                {departmentsOptions && departmentsOptions.length > 0 && category.level === 0 &&
                <div className="flex flex-column gap-1">
                    {/* <span className="text-left">{t("Predecessors departments:")}</span>
                    <div className="card flex justify-content-left">
                        {node.predecessors_departments.map(d_id => (
                            <Chip key={d_id} label={departmentsOptions.find(d => d_id === d.id)?.name}/>
                        ))}
                    </div> */}
                    <Tooltip target=".use-category-departments"  />
                    <span className="text-left use-category-departments"
                        data-pr-tooltip={t("This setting is propagated downwards")}
                    >{t('use_category_departments')}:</span>
                    <div className="card flex justify-content-center">
                        <MultiSelect
                            placeholder={t('select_departments')}
                            value={departments} 
                            onChange={(e) => setDepartments(e.value)} 
                            options={departmentsOptions} 
                            optionLabel="name"
                            className="w-full md:w-20rem"
                            display="chip" 
                        />
                    </div>
                </div>}
            </div>
        </div>
    );
};

export default CategoriesChartUpdate;
