import {
    DataTable,
    DataTableCellSelection,
    DataTableSelectionCellChangeEvent,
} from "primereact/datatable";
import { FileUpload } from "primereact/fileupload";
import {
    FileUploadValue,
    SpreadsheetContent,
    SpreadsheetFileContent,
    useInsertDocuments,
} from "../../contexts/insert-documents/InsertDocumentsContext";
import React, { useEffect, useRef, useState } from "react";
import {
    Column,
    ColumnBodyOptions,
    ColumnEditorOptions,
} from "primereact/column";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import {
    getIdentifierTypeLabel,
    getLocalizedIdentifiers,
} from "../../types/Identifiers";
import { IdentifierType } from "../../types/IdentifierType";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import AssignableCategoryEditor from "../../components/editors/AssignableCategoryEditor";
import { Dialog } from "primereact/dialog";
import { Tooltip } from "primereact/tooltip";
import { TabMenu } from "primereact/tabmenu";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import { Category } from "../../adapters/ApiCategories";

const InsertDocumentsFiles: React.FC = () => {
    const { t } = useTranslation();
    const { categories } = useCategories();
    const {
        fileUploadValues,
        spreadsheetFileContent,
        handleChooseSpreadsheetValues,
        handleFileUpload,
        updateFileUploadRow,
    } = useInsertDocuments();
    const [editingRows, setEditingRows] = useState<FileUploadValue[]>([]);
    const [spreadsheetDialogVisible, setSpreadsheetDialogVisible] =
        useState<boolean>(false);

    useEffect(() => {
        setEditingRows(fileUploadValues);
    }, [fileUploadValues]);

    useEffect(() => {
        if (spreadsheetFileContent) {
            setSpreadsheetDialogVisible(true);
        }
    }, [spreadsheetFileContent]);

    const handleSpreadsheetValuesAccept = (values: string[]) => {
        handleChooseSpreadsheetValues(spreadsheetFileContent!.fileName, values);
        setSpreadsheetDialogVisible(false);
    };

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
                    // accept="text/plain"
                    chooseLabel={`${t("Choose")} (.txt, .xlsx)`}
                    uploadLabel={t("Upload")}
                    cancelLabel={t("Cancel")}
                    itemTemplate={itemTemplate}
                />
                <Dialog
                    visible={spreadsheetDialogVisible}
                    onHide={() => setSpreadsheetDialogVisible(false)}
                    maximized={true}
                >
                    <SpreadsheetDataTable
                        spreadsheetFile={spreadsheetFileContent}
                        onAccept={handleSpreadsheetValuesAccept}
                    ></SpreadsheetDataTable>
                </Dialog>
            </div>
        );
    }

    const categoryBody = (category_id: number | undefined) => {
        if (!category_id || !categories) {
            return "";
        }
        const findCategory = (categories: Category[], id: number) => {
            const found = categories.find((c) => c.id === id);
            if (found) {
                return found;
            }
            const foundInSub = categories
                .map((c) => findCategory(c.sub_categories, id))
                .filter((c) => c);
            return foundInSub.length === 1 ? foundInSub[0] : undefined;
        };
        const category = findCategory(categories, category_id);
        return category ? category.name : "";
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

interface SpreadsheetDataTableProps {
    spreadsheetFile: SpreadsheetFileContent | null;
    onAccept: (values: string[]) => void;
}

function colStringToIndex(colString: string) {
    let index = 0;
    for (let i = 0; i < colString.length; i++) {
        index *= 26;
        index += colString.charCodeAt(i) - "A".charCodeAt(0) + 1;
    }
    return index;
}

function colIndexToString(colIndex: number) {
    let colString = "";
    while (colIndex > 0) {
        colString =
            String.fromCharCode("A".charCodeAt(0) + (colIndex % 26)) +
            colString;
        colIndex = Math.floor(colIndex / 26);
    }
    return colString || "A";
}

const transformFormulaeDataToDataTable = (
    content: SpreadsheetContent
): any[] => {
    const { formulaeData } = content;
    let data: any[] = [];

    let currRow = 0;
    let rowData = {};
    for (let i = 0; i < formulaeData.length; i++) {
        const dataSplitted = formulaeData[i].split("=");
        if (dataSplitted.length !== 2) {
            continue;
        }

        const row = parseInt(dataSplitted[0].match(/\d+/)![0]) - 1;
        const col = colStringToIndex(dataSplitted[0].match(/[A-Z]+/)![0]) - 1;
        const value = dataSplitted[1].replace(RegExp("^'"), "");

        while (currRow < row) {
            data.push(rowData);
            rowData = {};
            currRow++;
        }
        rowData[colIndexToString(col)] = value;
    }
    return data;
};

const getTableHeader = (content: SpreadsheetContent) => {
    let header: string[] = [];
    for (let i = 0; i < content.maxCol; i++) {
        header.push(colIndexToString(i));
    }
    return header;
};

const SpreadsheetDataTable: React.FC<SpreadsheetDataTableProps> = ({
    spreadsheetFile,
    onAccept,
}) => {
    const { t } = useTranslation();

    const [currentSheet, setCurrentSheet] = useState<SpreadsheetContent | null>(
        spreadsheetFile?.content?.[0] || null
    );
    const [values, setValues] = useState<string[]>([]);

    const [selectedCells, setSelectedCells] = useState<{
        [key: string]: DataTableCellSelection<any[]> | null;
    }>({});
    const [selectedValues, setSelectedValues] = useState<{
        [key: string]: string[];
    }>({});

    useEffect(() => {
        if (currentSheet) {
            setValues(transformFormulaeDataToDataTable(currentSheet));
        }
    }, [currentSheet]);

    const handleCancelSelection = () => {
        setSelectedCells((prevState) => ({
            ...prevState,
            [currentSheet?.sheetName || ""]: null,
        }));
        setSelectedValues((prevState) => ({
            ...prevState,
            [currentSheet?.sheetName || ""]: [],
        }));
    };

    const handleSelectionChange = (
        event: DataTableSelectionCellChangeEvent<any>
    ) => {
        if (currentSheet && event.value) {
            const filteredCells = Object.values(event.value).filter(
                (cell) => cell.colIndex !== 0
            );
            setSelectedCells((prevState) => ({
                ...prevState,
                [currentSheet.sheetName]:
                    filteredCells as unknown as DataTableCellSelection<any>,
            }));
            setSelectedValues((prevState) => ({
                ...prevState,
                [currentSheet.sheetName]: filteredCells.map(
                    (cell) => cell.value as string
                ),
            }));
        } else {
            handleCancelSelection();
        }
    };

    const handleAccept = () => {
        onAccept(Object.values(selectedValues).flat());
    };

    const rowNumberBodyTemplate = (
        rowData: any,
        options: ColumnBodyOptions
    ) => {
        return options.rowIndex + 1;
    };

    const footer = () => {
        const tooltip = t(
            "Cell selection is possible by clicking on individual cells or by dragging across multiple cells"
        );
        const menuItems = spreadsheetFile?.content.map((sheet) => ({
            label: sheet.sheetName,
            command: () => setCurrentSheet(sheet),
        }));
        const countSelectedCurr =
            currentSheet && currentSheet.sheetName in selectedValues
                ? selectedValues[currentSheet.sheetName].length
                : 0;
        const countSelectedAll = Object.values(selectedValues).reduce(
            (acc, curr) => (curr ? acc + curr.length : acc),
            0
        );
        return (
            <div className="flex justify-content-between align-items-center">
                <TabMenu model={menuItems} />
                <div className="flex align-items-center gap-1">
                    <Tooltip target=".pi-info-circle" content={tooltip} />
                    <i className="pi pi-info-circle text-blue-700 text-lg" />
                    <span>
                        {`${t(
                            "Selected cells"
                        )}: ${countSelectedCurr} (${countSelectedAll})`}
                    </span>
                    <Button
                        icon="pi pi-times"
                        rounded
                        text
                        severity="danger"
                        onClick={handleCancelSelection}
                    />
                </div>
                <Button label={t("Accept")} onClick={handleAccept} />
            </div>
        );
    };

    return (
        <div className="card">
            <DataTable
                value={values}
                scrollable
                scrollHeight="calc(100vh - 190px)"
                cellSelection
                selectionMode="multiple"
                dragSelection
                selection={
                    currentSheet ? selectedCells[currentSheet.sheetName] : null
                }
                onSelectionChange={handleSelectionChange}
                footer={footer}
            >
                <Column className="surface-50" body={rowNumberBodyTemplate} />
                {currentSheet &&
                    getTableHeader(currentSheet).map((colName) => (
                        <Column
                            key={colName}
                            field={colName}
                            header={colName}
                        />
                    ))}
            </DataTable>
        </div>
    );
};

export default InsertDocumentsFiles;
