import "../styles/Access.css";
import DepartmentsTable from "../features/departments/DepartmentsTable";
import { DepartmentsProvider } from "../contexts/DepartmentsContext";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationAccess from "../components/navigation/SubNavigationAccess";
import SubNavigationMenu from "../components/navigation/SubNavigationMenu";
import AddDepartmentMenu from "../features/departments/AddDepartmentMenu";

interface DepartmentsProps {}

const Departments: React.FC<DepartmentsProps> = () => {
    return (
        <DepartmentsProvider>
            <DataTableLayout
                header={
                    <SubNavigationMenu
                        start={<AddDepartmentMenu />}
                        end={<SubNavigationAccess />}
                    />
                }
                datatable={<DepartmentsTable />}
            />
        </DepartmentsProvider>
    );
};

export default Departments;
