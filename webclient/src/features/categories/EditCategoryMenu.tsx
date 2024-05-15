import React, { useEffect, useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { useTranslation } from "react-i18next";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from "primereact/checkbox";
import { Department } from "../../adapters/ApiDepartments";
import { useDepartments } from "../../contexts/departments/DepartmentsContext";
import { MultiSelect } from "primereact/multiselect";
import { Category } from "../../adapters/ApiCategories";
import LabeledComponent from "../../components/LabeledComponent";
import { Button } from "primereact/button";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { CategoryType } from "../../contexts/categories/CategoryType";

interface EditCategoryMenuProps {}

const EditCategoryMenu: React.FC<EditCategoryMenuProps> = () => {
    const { t } = useTranslation();
    const { editCategory, closeCategoryEdit } = useCategoryModels();

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(editCategory !== null);
    }, [editCategory]);

    return (
        <Sidebar
            visible={visible}
            onHide={() => closeCategoryEdit()}
            position="bottom"
            className="h-min"
        >
            {editCategory && <CategoryForm category={editCategory} />}
        </Sidebar>
    );
};

interface CategoryFormProps {
    category: CategoryModel;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ category }) => {
    const { t } = useTranslation();
    const { departments: departmentsOptions } = useDepartments();
    const { closeCategoryEdit, createCategory, updateCategory } =
        useCategoryModels();

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

    const handleUpdate = () => {
        const categoryBody = {
            name,
            description,
            assignable,
            departments: departments.map((d) => d.id!),
            parent_id: category.parent_id,
            disabled: category.disabled,
        };
        if (category.type === CategoryType.NewCategory) {
            createCategory(categoryBody);
        } else {
            updateCategory(categoryBody);
        }
    };

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
                    <LabeledComponent label={t("use_category_departments")}>
                        <MultiSelect
                            placeholder={t("select_departments")}
                            value={departments}
                            onChange={(e) => setDepartments(e.value)}
                            options={departmentsOptions}
                            optionLabel="name"
                            className="w-full md:w-20rem"
                            display="chip"
                        />
                    </LabeledComponent>
                )}
            <div className="flex gap-4">
                <Button
                    label={t("Save")}
                    icon="pi pi-save"
                    outlined
                    severity="success"
                    onClick={handleUpdate}
                />
                <Button
                    label={t("Cancel")}
                    icon="pi pi-times"
                    outlined
                    severity="danger"
                    onClick={() => {
                        closeCategoryEdit();
                    }}
                />
            </div>
        </div>
    );
};

export default EditCategoryMenu;
