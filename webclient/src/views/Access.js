import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Role } from "../models/Role.js";
import { SelectButton } from "primereact/selectbutton";

import { api } from '../services/Api.js';
import './Access.css';
import { tab } from "@testing-library/user-event/dist/tab.js";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import RolesTable from "../components/RolesTable.js";
import { roleEditor } from "../services/Editors.js";

const TableEnum = {
    USERS: 'users',
    DEPARTMENS: 'departments',
    ROLES: 'roles'
};

const Access = () => {
    const { t } = useTranslation();

    const [error, setError] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    const [table, setTable] = useState(TableEnum.USERS);
    const [tablesOptions] = useState([
        { label: t('users'), value: TableEnum.USERS },
        { label: t('departmens'), value: TableEnum.DEPARTMENS },
        { label: t('roles'), value: TableEnum.ROLES }
    ]);
    const [editingRows, setEditingRows] = useState([]);

    const [users, setUsers] = useState([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [departments, setDepartments] = useState([]);
    
    const fetchUsers = async () => {
        api.getUsers()
        .then(
            (result) => {
                setUsers(result.users);
                setTotalUsers(result.num_found);
                setIsLoaded(true);
            },
            (error) => {
                setIsLoaded(true);
                setError(error);
            }
        )
    }

    const fetchDepartments = async () => {
        api.getDepartments()
        .then(
            (result) => {
                setDepartments(result.departments);
            },
            (error) => {
                setError(error);
            }
        )
    }

    useEffect(() => {
        fetchUsers();
        fetchDepartments();
    }, [table]);

    const textEditor = (options) => {
        return <InputText type="text" value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
    };

    const departmentEditor = (options) => {
        return (
            <Dropdown
                value={options.value}
                options={departments.map(department => department.abbreviation)}
                onChange={(e) => options.editorCallback(e.value)}
            />
        );
    };

    const handleInsert = () => {
        if (table == TableEnum.DEPARTMENS) {
            const newDepartment = {};
            setDepartments([...departments, newDepartment]);
            setEditingRows([...editingRows, newDepartment]);
        } else if (table == TableEnum.ROLES) {
            const newRole = new Role();
            setEditingRows([...editingRows, newRole]);
        }
    };

    const handleUserEdit = (event) => {
        let _users = [...users];
        let { newData, index } = event;

        api.updateUser(newData)
        .then(
            (result) => {
                _users[index] = result;
            },
            (error) => {
                setError(error);
            }
        )
        setUsers(_users);
    };

    const handleDepartmentEdit = (event) => {
    }
    
    const tableHeader = () => {
        return (
            <div className="table-header">
                <Button severity={table === TableEnum.USERS && "secondary"} className="add-button" icon="pi pi-plus" rounded onClick={handleInsert} />
                <div className="middle-container">
                    <SelectButton className="select-button" value={table} onChange={(e) => setTable(e.value)} options={tablesOptions} />
                </div>
            </div>
        );
    };

    const onRowEditChange = (event) => {
        const { data } = event;
        const activeRowArray = (Array.isArray(data) ? data : [data]).filter(role => role.id != 1);
        setEditingRows(activeRowArray);
    }

    if (error) {
        return <div>Error: {error.message}</div>;
    } else if (!isLoaded) {
        return <div>Loading...</div>;
    } else {
        return (
            <div className="Access">
                { table === TableEnum.USERS && <DataTable
                    value={users}
                    header={tableHeader}
                    editMode="row"
                    onRowEditComplete={handleUserEdit}
                >

                    <Column field="username" header={t('username')} editor={textEditor} />
                    <Column field="department_abbreviation" header={t('department')} editor={departmentEditor} />
                    <Column field="role_name" header={t('role_name')} editor={roleEditor} />
                    <Column rowEditor />
                </DataTable> }
                { table === TableEnum.DEPARTMENS && <DataTable
                    value={departments}
                    header={tableHeader}
                    editMode="row"
                    onRowEditChange={onRowEditChange}
                    editingRows={editingRows || [false]}
                    onRowEditComplete={handleDepartmentEdit}
                >
                    <Column field="abbreviation" header={t('department_abbreviation')} editor={textEditor} />
                    <Column field="name" header={t('department_name')} editor={textEditor} />
                    <Column rowEditor />
                </DataTable> }
                { table === TableEnum.ROLES && <RolesTable 
                    header={tableHeader}
                />}
            </div>
        );
    }
}

export default Access;