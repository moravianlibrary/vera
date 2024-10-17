import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { useRoles } from "../../contexts/roles/RolesContext";

interface AddRoleMenuProps {}

const AddRoleMenu: React.FC<AddRoleMenuProps> = () => {
    const { t } = useTranslation("roles");
    const { handleAddRole } = useRoles();

    return (
        <Button
            label={t("actions.create")}
            icon="pi pi-plus"
            onClick={handleAddRole}
        />
    );
};

export default AddRoleMenu;
