import "../styles/Access.css";
import RolesTable from "../features/roles/RolesTable";
import { RolesProvider } from "../contexts/roles/RolesContext";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationMenu from "../components/SubNavigationMenu";
import SubNavigationAccess from "../components/navigation/SubNavigationAccess";
import AddRoleMenu from "../features/roles/AddRoleMenu";

interface RolesProps {}

const Roles: React.FC<RolesProps> = () => {
    return (
        <RolesProvider>
            <DataTableLayout
                header={
                    <SubNavigationMenu
                        start={<AddRoleMenu />}
                        end={<SubNavigationAccess />}
                    />
                }
                datatable={<RolesTable />}
            />
        </RolesProvider>
    );
};

export default Roles;
