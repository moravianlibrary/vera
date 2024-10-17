import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { useDepartments } from "../../contexts/DepartmentsContext";

interface AddDepartmentMenuProps {}

const AddDepartmentMenu: React.FC<AddDepartmentMenuProps> = () => {
    const { t } = useTranslation("departments");
    const { handleAddDepartment } = useDepartments();

    return (
        <Button
            label={t("actions.create")}
            icon="pi pi-plus"
            onClick={handleAddDepartment}
        />
    );
};

export default AddDepartmentMenu;
