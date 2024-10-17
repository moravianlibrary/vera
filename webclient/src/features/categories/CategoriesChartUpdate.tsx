import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Chip } from "primereact/chip";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { CategoryType } from "../../contexts/categories/CategoryType";
import { useDepartments } from "../../contexts/DepartmentsContext";
import { Tooltip } from "primereact/tooltip";
import { Department } from "../../adapters/ApiDepartments";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";

interface CategoriesChartUpdateProps {
    category: CategoryModel;
}

const CategoriesChartUpdate: React.FC<CategoriesChartUpdateProps> = ({
    category,
}) => {
    const { closeCategoryEdit, updateCategory, createCategory } =
        useCategoryModels();
    const { t } = useTranslation("categories");

    const { departments: departmentsOptions } = useDepartments();

    const [name, setName] = useState<string>(category.name);
    const [description, setDescription] = useState<string>(
        category.description ? category.description : ""
    );
    const [assignable, setAssignable] = useState<boolean>(category.assignable);
    const [departments, setDepartments] = useState<Department[]>(
        departmentsOptions.filter((d) => category.departments.includes(d.id!))
    );

    const handleUpdate = () => {
        const categoryBody = {
            name,
            description,
            assignable,
            extract_whole: false,
            departments: departments.map((d) => d.id!),
            disabled: category.disabled,
        };
        if (category.type === CategoryType.NewCategory) {
            createCategory(categoryBody, category.parent_id);
        } else {
            updateCategory(categoryBody);
        }
    };

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
                        <i
                            className="pi pi-check"
                            style={{ fontSize: "0.75rem" }}
                        />
                    </Button>
                    <Button
                        className="p-1 surface-200"
                        text
                        severity="danger"
                        onClick={() => closeCategoryEdit()}
                    >
                        <i
                            className="pi pi-times"
                            style={{ fontSize: "0.75rem" }}
                        />
                    </Button>
                </div>
                <InputText
                    placeholder={t("form.placeholder.name")}
                    keyfilter={new RegExp("^[0-9\\p{L}\\s\\.,!?]*$", "u")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <InputTextarea
                    placeholder={t("form.placeholder.description")}
                    keyfilter={new RegExp("^[0-9\\p{L}\\s\\.,!?]*$", "u")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex align-items-center">
                    <Checkbox
                        inputId="assignable"
                        checked={assignable}
                        onChange={(e) =>
                            setAssignable(e.checked ? e.checked : false)
                        }
                    />
                    <label htmlFor="assignable" className="ml-2">
                        {t("form.label.assignable")}
                    </label>
                </div>
                {departmentsOptions &&
                    departmentsOptions.length > 0 &&
                    category.level === 0 && (
                        <div className="flex flex-column gap-1">
                            {/* <span className="text-left">{t("Predecessors departments:")}</span>
                    <div className="card flex justify-content-left">
                        {category.predecessors_departments.map(d_id => (
                            <Chip key={d_id} label={departmentsOptions.find(d => d_id === d.id)?.name}/>
                        ))}
                    </div> */}
                            {/* <Tooltip target=".use-category-departments"  /> */}
                            <span className="text-left use-category-departments">
                                {t("form.label.departments")}:
                            </span>
                            <div className="card flex justify-content-center">
                                <MultiSelect
                                    placeholder={t(
                                        "form.placeholder.select-departments"
                                    )}
                                    value={departments}
                                    onChange={(e) => setDepartments(e.value)}
                                    options={departmentsOptions}
                                    optionLabel="name"
                                    className="w-full md:w-20rem"
                                    display="chip"
                                />
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
};

export default CategoriesChartUpdate;
