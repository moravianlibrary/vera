import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import React from "react";
import { useDepartments } from "../../contexts/departments/DepartmentsContext";
import { Department } from "../../adapters/ApiDepartments";

interface DepartmentPickerProps {
    selectedDepartment: Department | null;
    onDepartmentChange: (department: Department | null) => void;
    useActive?: boolean;
    disabled?: boolean;
    className?: string;
}

const DepartmentPicker: React.FC<DepartmentPickerProps> = (props) => {
    const { t } = useTranslation();
    const { departments } = useDepartments();

    return (
        <div className={`flex flex-column ${props.className}`}>
            <Dropdown
                disabled={props.disabled}
                value={props.selectedDepartment}
                options={departments}
                optionLabel="name"
                onChange={(e) => props.onDepartmentChange(e.value)}
                placeholder={t("Select department")}
            />
        </div>
    );
};

export default DepartmentPicker;
