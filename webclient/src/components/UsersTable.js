import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { departmentEditor, roleEditor, textEditor } from "../services/Editors";
import { dataService } from "../services/Data";
import { Dropdown } from "primereact/dropdown";

const UsersTable = (props) => {
    const { t } = useTranslation();

    const [users, setUsers] = useState([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    
    const [refreshCount, setRefreshCount] = useState(0);

    const handleUserEdit = (event) => {
        console.log(event);
    };

    useEffect(() => {
        async function fetchUsers() {
            const {users, num_found} = await dataService.getUsers();
            setUsers(users);
            setTotalUsers(num_found);

            const {departments} = await dataService.getDepartments();
            setDepartments(departments);

            setRoles(await dataService.getRoles());
        }
        fetchUsers();
    }, [refreshCount]);

    return (
        <DataTable
            value={users}
            editMode="row"
            onRowEditComplete={handleUserEdit}
            {...props}
        >
            <Column field="username" header={t('username')} editor={textEditor} />
            <Column field="department_abbreviation" 
                header={t('department')} 
                editor={(editorOptions) => departmentEditor({ ...editorOptions, departments })}
            />
            <Column field="role_name"
                header={t('role_name')}
                editor={(editorOptions) => roleEditor({ ...editorOptions, roles })}
            />
            <Column rowEditor />
        </DataTable> 
    );
};

export default UsersTable;