import { Button } from "primereact/button";
import React from "react";
import LabeledComponent from "../../../../components/LabeledComponent";
import { useTranslation } from "react-i18next";
import DepartmentPicker from "../../../../components/pickers/DepartmentPicker";
import { useCategories } from "../../../../contexts/categories/CategoriesContext";

interface DepartmentsDisplayOptionsProps {}

const DepartmentsDisplayOptions: React.FC<
    DepartmentsDisplayOptionsProps
> = () => {
    const { t } = useTranslation();
    const { department, setDepartment } = useCategories();

    return (
        <div className="card flex ml-2 gap-4 flex-wrap">
            <Button
                className={department === null ? "bg-primary" : "m-0 text-800"}
                text={department !== null}
                label={t("Show all categories")}
                onClick={() => setDepartment(null)}
            />
            <LabeledComponent
                label={t("Selected department")}
                className="p-button-label text-800 my-2 mx-1 align-items-center"
            >
                <DepartmentPicker
                    selectedDepartment={department}
                    onDepartmentChange={setDepartment}
                />
            </LabeledComponent>
        </div>
    );
};
export default DepartmentsDisplayOptions;
