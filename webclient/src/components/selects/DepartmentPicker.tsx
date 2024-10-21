import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import React from "react";
import { useDepartments } from "../../contexts/DepartmentsContext";
import { Department } from "../../adapters/ApiDepartments";

interface DepartmentPickerProps {
    selectedDepartment: Department | null;
    onDepartmentChange: (department: Department | null) => void;
    useActive?: boolean;
    disabled?: boolean;
    className?: string;
}

const DepartmentPicker: React.FC<DepartmentPickerProps> = (props) => {
    const { t } = useTranslation("departments");
    const { items } = useDepartments();

    return (
        <div className={`flex flex-column ${props.className}`}>
            <Dropdown
                disabled={props.disabled}
                value={props.selectedDepartment}
                options={items}
                optionLabel="name"
                onChange={(e) => props.onDepartmentChange(e.value)}
                placeholder={t("select-placeholder")}
            />
        </div>
    );
};

export default DepartmentPicker;
