import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";

import { useEffect, useState } from "react";
import { Checkbox } from "primereact/checkbox";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import { textEditor } from '../services/Editors.js';
import { Role } from "../contexts/user/RoleModel.js";
import { Button } from "primereact/button";
import { useData } from "../services/Data.js";


const RolesTable = (props) => {
    const { handleAddRow, onRowAdded } = props;
    const { t } = useTranslation();
    const { dataService } = useData();
    
    const [roles, setRoles] = useState([]);

    const [editingRows, setEditingRows] = useState([]);
    const [insertMode, setInsertMode] = useState(false);
    const [refreshCount, setRefreshCount] = useState(0);

    const handleInsert = () => {
        if (!insertMode) {
            setInsertMode(true);
            const newRole = new Role();
            setRoles([...roles, newRole]);
            setEditingRows([...editingRows, newRole]);
        }
    };

    const onRowEditChange = (event) => {
        const { data, index } = event;
        if (insertMode && index == roles.length - 1) {
            setInsertMode(false);
        }
        const activeRowArray = (Array.isArray(data) ? data : [data]).filter(role => role.id != 1);
        setEditingRows(activeRowArray);
    };

    const handleRoleEdit = (event) => {
        const { data, newData, index } = event;
        data.name = newData.name;

        if (insertMode && index == roles.length - 1) {
            dataService.createRole(data);
        } else {
            dataService.updateRole(data);
            setRefreshCount(refreshCount + 1);
        }
    };

    const handleChangeActionLevel = (event, fieldName, index) => {
        let _roles = [...roles];
        _roles[index][fieldName] = parseInt(event.value, 10);
        setRoles(_roles);
    };

    const handleChangeAction = (event, index) => {
        let _roles = [...roles];
        _roles[index][event.value] = event.checked;
        setRoles(_roles);
    };

    const handleDeleteRole = (role) => {
        dataService.deleteRole(role);
        setRefreshCount(refreshCount + 1);
    };

    useEffect(() => {
        async function fetchRoles() {
            const roles = await dataService.getRoles();
            if (roles) {
                setRoles(roles);
            }
        }
        if (!insertMode) {
            fetchRoles();
        }
    }, [insertMode, refreshCount]);

    useEffect(() => {
        if (handleAddRow) {
            handleInsert();
            onRowAdded();
        }
    }, [handleAddRow]);

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

    const deleteButton = (role) => {
        if (role.id) {
            return (
                <Button className="p-button-rounded p-button-text"
                    icon="pi pi-trash"
                    severity={role.id === 1 ? "secondary" : "danger"}
                    disabled={role.id === 1}
                    onClick={() => handleDeleteRole(role)}
                />
            );
        }
    };

    const headerColumnGroup = (
        <ColumnGroup>
            <Row>
                <Column header={t('role_name')} />
                <Column header={t('actions')} colSpan={9} />
            </Row>
        </ColumnGroup>
    );

    return (
        <DataTable
            value={roles}
            editMode="row"
            onRowEditChange={onRowEditChange}
            editingRows={editingRows || [false]}
            onRowEditComplete={handleRoleEdit}
            headerColumnGroup={headerColumnGroup}
            scrollable
            scrollHeight="flex"
            header={props.header}
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
            <Column body={deleteButton} />
        </DataTable> 
    );
};

export default RolesTable;