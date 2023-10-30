import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";

import { departmentEditor, roleEditor, textEditor } from "../services/Editors";
import { dataService } from "../services/Data";

const UsersTable = (props) => {
    const { t } = useTranslation();

    const [users, setUsers] = useState([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    
    const [refreshCount, setRefreshCount] = useState(0);

    const handleUserEdit = (event) => {
        const { newData } = event;

        newData.department_id = departments.find(d => d.department_abbreviation === newData.department_abbreviation).id;
        newData.role_id = roles.find(role => role.name === newData.role_name).id;

        dataService.updateUser(newData);
        setRefreshCount(refreshCount + 1);
    };

    const handleDeleteUser = (user) => {
        dataService.deleteUser(user);
        setRefreshCount(refreshCount + 1);
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

    const deleteButton = (user) => {
        if (user.id) {
            return (
                <Button className="p-button-rounded p-button-text p-button-danger" icon="pi pi-trash" onClick={() => handleDeleteUser(user)} />
            );
        }
    };

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
            <Column body={deleteButton} />
        </DataTable> 
    );
};

export default UsersTable;