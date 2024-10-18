import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { useRoles } from "../../contexts/RolesContext";

interface AddRoleMenuProps {}

const AddRoleMenu: React.FC<AddRoleMenuProps> = () => {
    const { t } = useTranslation("roles");
    const { addItem } = useRoles();

    return (
        <Button
            label={t("actions.create")}
            icon="pi pi-plus"
            onClick={addItem}
        />
    );
};

export default AddRoleMenu;
