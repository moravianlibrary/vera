import { DataTable } from "primereact/datatable";
import { FileUpload } from "primereact/fileupload";
import {
    FileUploadValue,
    useInsertDocuments,
} from "../../contexts/insert-documents/InsertDocumentsContext";
import React, { useEffect, useState } from "react";
import { Column, ColumnEditorOptions } from "primereact/column";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import {
    getIdentifierTypeLabel,
    getLocalizedIdentifiers,
} from "../../types/Identifiers";
import { IdentifierType } from "../../types/IdentifierType";
import { useAssignableCategories } from "../../contexts/categories/AssignableCategoriesContext";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import AssignableCategoryEditor from "../../components/editors/AssignableCategoryEditor";

const InsertDocumentsFiles: React.FC = () => {
    const { t } = useTranslation();
    const { categories } = useAssignableCategories();
    const { fileUploadValues, handleFileUpload, updateFileUploadRow } =
        useInsertDocuments();
    const [editingRows, setEditingRows] = useState<FileUploadValue[]>([]);

    useEffect(() => {
        setEditingRows(fileUploadValues);
    }, [fileUploadValues]);

    const itemTemplate = (file, props) => {
        return (
            <div className="flex align-items-center flex-wrap">
                <div
                    className="flex align-items-center"
                    style={{ width: "40%" }}
                >
                    <span className="flex flex-column text-left ml-3">
                        {file.name}
                        <small>{new Date().toLocaleDateString()}</small>
                    </span>
                </div>
                <Tag
                    value={props.formatSize}
                    severity="info"
                    className="px-3 py-2"
                />
                <Button
                    icon="pi pi-times"
                    className="p-button-text p-button-rounded p-button-danger ml-auto"
                    onClick={props.onRemove}
                />
            </div>
        );
    };

    if (fileUploadValues.length === 0) {
        return (
            <div>
                <FileUpload
                    mode="advanced"
                    customUpload={true}
                    uploadHandler={handleFileUpload}
                    multiple
                    maxFileSize={2000000}
                    accept="text/plain"
                    chooseLabel={t("Choose")}
                    uploadLabel={t("Upload")}
                    cancelLabel={t("Cancel")}
                    itemTemplate={itemTemplate}
                />
            </div>
        );
    }

    const categoryBody = (category_id: number | undefined) => {
        if (!category_id) {
            return "";
        }
        const category = categories.find((c) => c.id === category_id);
        return category ? category.getPath() : "";
    };

    const identifierEditor = (options: ColumnEditorOptions) => {
        return (
            <Dropdown
                value={options.value}
                options={getLocalizedIdentifiers(t)}
                onChange={(e) =>
                    options.editorCallback!(e.target.value as IdentifierType)
                }
            />
        );
    };

    const onCellValueEdit = ({ rowIndex, newRowData }) => {
        updateFileUploadRow(rowIndex, newRowData);
    };

    return (
        <DataTable
            value={fileUploadValues}
            editMode="row"
            editingRows={editingRows}
            onRowEditComplete={({ newData, index }) =>
                updateFileUploadRow(index, newData as FileUploadValue)
            }
            scrollable
            scrollHeight="calc(100vh - 510px)"
        >
            <Column field="filename" header={t("Filename")} filter />
            <Column field="value" header={t("Value")} filter />
            <Column
                field="identifier"
                header={t("Identifier")}
                body={(v) => t(getIdentifierTypeLabel(v.identifier))}
                editor={identifierEditor}
                onCellEditComplete={onCellValueEdit}
            />
            <Column
                field="category_id"
                header={t("Category")}
                body={(v) => categoryBody(v.category_id)}
                editor={(options) => (
                    <AssignableCategoryEditor options={options} />
                )}
                onCellEditComplete={onCellValueEdit}
            />
            <Column rowEditor />
            {/* <Column body={documentsButton} /> */}
        </DataTable>
    );
};

export default InsertDocumentsFiles;
