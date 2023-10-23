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
    const [roles, setRoles] = useState([]);
    
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

    const fetchRoles = async () => {
        api.getRolesActions()
        .then(
            (result) => {
                setRoles(result.roles.map(role => Role.fromJson(role)));
            },
            (error) => {
                setError(error);
            }
        )
    }

    useEffect(() => {
        fetchUsers();
        fetchDepartments();
        fetchRoles();
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

    const roleEditor = (options) => {
        return (
            <Dropdown
                value={options.value}
                options={roles.map(role => role.name)}
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
            setRoles([...roles, newRole]);
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

    const handleRoleEdit = (event) => {
    }

    const handleChangeActionLevel = (event, fieldName, index) => {
        let _roles = [...roles];
        _roles[index][fieldName] = parseInt(event.value, 10);
        setRoles(_roles);
    }

    const handleChangeAction = (event, index) => {
        let _roles = [...roles];
        _roles[index][event.value] = event.checked;
        setRoles(_roles);
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

    const readDatatablePicker = (role, column) => {
        return (
            <div className="flex flex-column gap-3">
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="0" onChange={(event) => handleChangeActionLevel(event, 'read_datatable_level', column.rowIndex)} checked={role.read_datatable_level >= 0} />
                    <label className="ml-2">{t('read_datatable_none')}</label>
                </div>
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="1" onChange={(event) => handleChangeActionLevel(event, 'read_datatable_level', column.rowIndex)} checked={role.read_datatable_level >= 1} />
                    <label className="ml-2">{t('read_datatable_own')}</label>
                </div>
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="2" onChange={(event) => handleChangeActionLevel(event, 'read_datatable_level', column.rowIndex)} checked={role.read_datatable_level >= 2} />
                    <label className="ml-2">{t('read_datatable_department')}</label>
                </div>
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="3" onChange={(event) => handleChangeActionLevel(event, 'read_datatable_level', column.rowIndex)} checked={role.read_datatable_level == 3} />
                    <label className="ml-2">{t('read_datatable_all')}</label>
                </div>
            </div>
        );
    };
    
    const editDatatablePicker = (role, column) => {
        return (
            <div className="flex flex-column gap-3">
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="0" onChange={(event) => handleChangeActionLevel(event, 'edit_datatable_level', column.rowIndex)} checked={role.edit_datatable_level >= 0} />
                    <label className="ml-2">{t('edit_datatable_none')}</label>
                </div>
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="1" onChange={(event) => handleChangeActionLevel(event, 'edit_datatable_level', column.rowIndex)} checked={role.edit_datatable_level >= 1} />
                    <label className="ml-2">{t('edit_datatable_own')}</label>
                </div>
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="2" onChange={(event) => handleChangeActionLevel(event, 'edit_datatable_level', column.rowIndex)} checked={role.edit_datatable_level >= 2} />
                    <label className="ml-2">{t('edit_datatable_department')}</label>
                </div>
                <div>
                    <Checkbox disabled={!editingRows.includes(role)} value="3" onChange={(event) => handleChangeActionLevel(event, 'edit_datatable_level', column.rowIndex)} checked={role.edit_datatable_level == 3} />
                    <label className="ml-2">{t('edit_datatable_all')}</label>
                </div>
            </div>
        );
    };

    const checkboxPicker = (role, column) => {
        return (
            <div>
                <Checkbox disabled={!editingRows.includes(role)} value={column.field} onChange={(event) => handleChangeAction(event, column.rowIndex)} checked={role[column.field] >= 1} />
                <label className="ml-2">{t(column.field)}</label>
            </div>
        );
    }

    const headerColumnGroup = (
        <ColumnGroup>
            <Row>
                <Column header={t('role_name')} />
                <Column header={t('actions')} colSpan={8} />
            </Row>
        </ColumnGroup>
    );

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
                { table === TableEnum.ROLES && <DataTable
                    value={roles}
                    header={tableHeader}
                    editMode="row"
                    onRowEditChange={onRowEditChange}
                    editingRows={editingRows || [false]}
                    onRowEditComplete={handleRoleEdit}
                    headerColumnGroup={headerColumnGroup}
                >
                    <Column field="name" editor={textEditor} />
                    <Column body={readDatatablePicker} />
                    <Column body={editDatatablePicker} />
                    <Column field="write_datatable" body={checkboxPicker} />
                    <Column field="comment_on_datatable" body={checkboxPicker} />
                    <Column field="edit_access" body={checkboxPicker} />
                    <Column field="edit_categories" body={checkboxPicker} />
                    <Column field="extract" body={checkboxPicker} />
                    <Column rowEditor />
                </DataTable> }
            </div>
        );
    }
}

export default Access;