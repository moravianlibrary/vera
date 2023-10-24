import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { departmentEditor, roleEditor, textEditor } from "../services/Editors";
import { data } from "../services/Data";

const UsersTable = (props) => {
    const { t } = useTranslation();

    const [users, setUsers] = useState([]);
    const [totalUsers, setTotalUsers] = useState(0);
    
    const [refreshCount, setRefreshCount] = useState(0);

    const handleUserEdit = (event) => {
        console.log(event);
    };

    useEffect(() => {
        async function fetchUsers() {
            const {users, num_found} = await data.getUsers();
            setUsers(users);
            setTotalUsers(num_found);
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
            <Column field="department_abbreviation" header={t('department')} editor={departmentEditor} />
            <Column field="role_name" header={t('role_name')} editor={roleEditor} />
            <Column rowEditor />
        </DataTable> 
    );
};

export default UsersTable;