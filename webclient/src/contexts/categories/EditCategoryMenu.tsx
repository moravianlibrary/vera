import React, { useEffect, useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { useTranslation } from "react-i18next";
import { useCategoryNodes } from "./CategoryNodesContext";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from "primereact/checkbox";
import { Department } from "../../adapters/ApiDepartments";
import { useDepartments } from "../departments/DepartmentsContext";
import { MultiSelect } from "primereact/multiselect";
import { Category } from "../../adapters/ApiCategories";

interface EditCategoryMenuProps {}

const EditCategoryMenu: React.FC<EditCategoryMenuProps> = () => {
    const { t } = useTranslation();
    const { editCategory, setEditCategory } = useCategoryNodes();

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(editCategory !== null);
    }, [editCategory]);

    const handleCategory = (category: Category) => {
        console.log(category);
    };

    return (
        <Sidebar
            visible={visible}
            onHide={() => setVisible(false)}
            position="bottom"
            className="h-min"
        >
            {editCategory && (
                <CategoryForm
                    category={editCategory}
                    onSave={handleCategory}
                    onDelete={handleCategory}
                />
            )}
        </Sidebar>
    );
};

interface CategoryFormProps {
    category: Category;
    onSave: (category: Category) => void;
    onDelete: (category: Category) => void;
}

const CategoryForm: React.FC<CategoryFormProps> = ({
    category,
    onSave,
    onDelete,
}) => {
    const { t } = useTranslation();
    const { departments: departmentsOptions } = useDepartments();

    const [name, setName] = useState<string>(category ? category.name : "");
    const [description, setDescription] = useState<string>(
        category && category.description ? category.description : ""
    );
    const [assignable, setAssignable] = useState<boolean>(
        category ? category.assignable : false
    );
    const [departments, setDepartments] = useState<Department[]>(
        departmentsOptions.filter(
            (d) => d.id && category.departments.includes(d.id)
        )
    );

    return (
        <div className="flex flex-column gap-2">
            <InputText
                placeholder={t("name")}
                keyfilter={new RegExp("^[0-9\\p{L}\\s\\.,!?]*$", "u")}
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <InputTextarea
                placeholder={t("description")}
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
                    {t("assignable_category")}
                </label>
            </div>
            {departmentsOptions &&
                departmentsOptions.length > 0 &&
                category.level === 0 && (
                    <div className="flex flex-column gap-1">
                        {/* <span className="text-left">{t("Predecessors departments:")}</span>
                    <div className="card flex justify-content-left">
                        {node.predecessors_departments.map(d_id => (
                            <Chip key={d_id} label={departmentsOptions.find(d => d_id === d.id)?.name}/>
                        ))}
                    </div> */}
                        {/* <Tooltip target=".use-category-departments"  /> */}
                        <span
                            className="text-left use-category-departments"
                            data-pr-tooltip={t(
                                "This setting is propagated downwards"
                            )}
                        >
                            {t("use_category_departments")}:
                        </span>
                        <div className="card flex justify-content-center">
                            <MultiSelect
                                placeholder={t("select_departments")}
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
    );
};

export default EditCategoryMenu;
