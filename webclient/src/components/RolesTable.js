import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";

import { data } from "../services/Data";
import { useEffect, useState } from "react";
import { Checkbox } from "primereact/checkbox";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import { textEditor } from '../services/Editors.js';

const RolesTable = (options) => {
    const { t } = useTranslation();
    
    const [roles, setRoles] = useState([]);

    useEffect(() => {
        setRoles(data.getRolesActions());
        console.log(data.getRolesActions());
    }, [roles]);
    
    const [editingRows, setEditingRows] = useState([]);

    const onRowEditChange = (event) => {
        const { data } = event;
        const activeRowArray = (Array.isArray(data) ? data : [data]).filter(role => role.id != 1);
        setEditingRows(activeRowArray);
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

    return (
        <DataTable
            options={options}
            value={roles}
            // editMode="row"
            onRowEditChange={onRowEditChange}
            editingRows={editingRows || [false]}
            // onRowEditComplete={handleRoleEdit}
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
        </DataTable> 
    );
};

export default RolesTable;