import { Dialog } from "primereact/dialog";
import React, { useEffect, useRef, useState } from "react";
import Spreadsheet, {
    CellBase,
    ColumnIndicatorProps,
    EmptySelection,
    RowIndicatorProps,
    Selection,
} from "react-spreadsheet";
import { ContextMenu } from "primereact/contextmenu";
import { useTranslation } from "react-i18next";
import { Chip } from "primereact/chip";
import { Badge } from "primereact/badge";
import { Button } from "primereact/button";

export interface MapModel {
    mapFrom: string;
    mapTo: string;
    required?: boolean;
}

export type ModelType = { [key: string]: string };

interface SpreadsheetInputProps {
    visible: boolean;
    onHide: () => void;
    mapModel: MapModel[];
    onSubmit: (data: ModelType[]) => void;
}

const TabSeparatedInput: React.FC<SpreadsheetInputProps> = ({
    visible,
    onHide,
    mapModel,
    onSubmit,
}) => {
    const { t } = useTranslation();

    const [columnMappings, setColumnMappings] = useState<(MapModel | null)[]>(
        []
    );
    const [data, setData] = useState<CellBase[][]>([
        [{ value: t("Insert table data here") }],
    ]);
    const [selected, setSelected] = useState<Selection>(new EmptySelection());

    useEffect(() => {
        setColumnMappings(
            Array.from({ length: data[0].length }, (_, i) => null)
        );
    }, [data]);

    const handleMapToColumn = (column: number, mappingColumn: MapModel) => {
        setColumnMappings((prev) =>
            prev.map((c, i) =>
                i === column && prev[column] !== mappingColumn
                    ? mappingColumn
                    : c
            )
        );
    };

    const handleDuplicateColumn = (column: number) => {
        setData((prev) =>
            prev.map((row) => [
                ...row.slice(0, column + 1),
                ...row.slice(column, column + 1),
                ...row.slice(column + 1),
            ])
        );
    };

    const handleDeleteColumn = (column: number) => {
        setData((prev) =>
            prev.map((row) => [
                ...row.slice(0, column),
                ...row.slice(column + 1),
            ])
        );
    };

    const handleSubmit = () => {
        const values: ModelType[] = data.map((row) => {
            return columnMappings.reduce((acc, mapper, i) => {
                if (mapper && row[i] && row[i].value) {
                    acc[mapper.mapTo] = row[i].value;
                }
                return acc;
            }, {} as ModelType);
        });
        onSubmit(values);
        onHide();
    };

    const dialogFooterButtons = () => {
        return (
            <div className="flex gap-2 align-items-end">
                <div className="flex flex-wrap w-full gap-2 align-items-center">
                    <span>{t("Assign column labels")}:</span>
                    {mapModel.map((mapper) => (
                        <ColumnLabelChip
                            label={mapper.mapFrom}
                            required={mapper.required}
                            isSelected={columnMappings.includes(mapper)}
                        />
                    ))}
                </div>
                <div className="flex justify-content-end gap-2">
                    <Button
                        label={t("Cancel")}
                        icon="pi pi-times"
                        onClick={onHide}
                    />
                    <Button
                        label={t("Confirm")}
                        icon="pi pi-check"
                        onClick={handleSubmit}
                    />
                </div>
            </div>
        );
    };

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header={t("Table data form")}
            footer={dialogFooterButtons()}
        >
            <div className="flex flex-column w-full gap-3">
                <Spreadsheet
                    data={data}
                    onChange={(newData) => setData(newData as CellBase[][])}
                    selected={selected}
                    onSelect={setSelected}
                    ColumnIndicator={(props) => (
                        <SpreadsheetColumn
                            {...props}
                            mapColumns={mapModel}
                            onMapToColumn={handleMapToColumn}
                            onDuplicateColumn={handleDuplicateColumn}
                            onDeleteColumn={handleDeleteColumn}
                        />
                    )}
                    RowIndicator={SpreadsheetRow}
                    columnLabels={columnMappings.map((c) =>
                        c ? c.mapFrom : ""
                    )}
                />
            </div>
        </Dialog>
    );
};

interface ColumnLabelChipProps {
    label: string;
    required?: boolean;
    isSelected: boolean;
}

const ColumnLabelChip: React.FC<ColumnLabelChipProps> = ({
    label,
    required,
    isSelected,
}) => {
    const { t } = useTranslation();

    if (required || isSelected) {
        return (
            <div className="relative">
                <Chip
                    className="p-overlay-badge"
                    key={`${label}_chip`}
                    label={label}
                />
                <Badge
                    key={`${label}_badge`}
                    severity={isSelected ? "success" : "warning"}
                    value={isSelected ? "" : t("Required")}
                    style={{
                        position: "relative",
                        top: "-7px",
                        left: "-10px",
                        zIndex: 10,
                    }}
                />
            </div>
        );
    }

    return (
        <Chip className="p-overlay-badge" key={`${label}_chip`} label={label} />
    );
};

interface SpreadsheetColumnProps extends ColumnIndicatorProps {
    mapColumns?: MapModel[];
    onMapToColumn?: (column: number, mappingColumn: MapModel) => void;
    onDuplicateColumn?: (column: number) => void;
    onDeleteColumn?: (column: number) => void;
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

const SpreadsheetColumn: React.FC<SpreadsheetColumnProps> = ({
    column,
    label,
    selected,
    onSelect,
    mapColumns,
    onMapToColumn,
    onDuplicateColumn,
    onDeleteColumn,
}) => {
    const { t } = useTranslation();
    const contextMenuRef = useRef<ContextMenu | null>(null);

    const items = [
        {
            label: t("Duplicate column"),
            command: () => onDuplicateColumn?.(column),
        },
        {
            label: t("Delete column"),
            command: () => onDeleteColumn?.(column),
        },
        {
            label: t("Assign label"),
            items: mapColumns
                ? mapColumns.map((c) => ({
                      label: c.mapFrom,
                      command: () => onMapToColumn?.(column, c),
                  }))
                : [],
        },
    ];

    const handleSelect = () => {
        onSelect(column, true);
    };

    const divPalette = selected
        ? "surface-500 border-900"
        : "surface-100 border-300";
    const textPalette = selected ? "text-white" : "text-500";
    return (
        <th
            className={`justify-content-center align-items-center border-1 ${divPalette}`}
            style={{ height: "32px" }}
            onClick={handleSelect}
            onContextMenu={(e) => contextMenuRef.current?.show(e)}
        >
            <span className={`text-lg ${textPalette}`}>
                {label || colIndexToString(column)}
            </span>
            <ContextMenu
                ref={contextMenuRef}
                model={items}
                breakpoint="767px"
            />
        </th>
    );
};

const SpreadsheetRow: React.FC<RowIndicatorProps> = ({
    row,
    label,
    selected,
    onSelect,
}) => {
    const { t } = useTranslation();

    const contextMenuRef = useRef<ContextMenu | null>(null);
    const [ignoreRow, setIgnoreRow] = useState<boolean>(false);

    const items = [
        { label: t("Ignore row"), command: () => setIgnoreRow(!ignoreRow) },
    ];

    const handleSelect = () => {
        if (!ignoreRow) {
            onSelect(row, true);
        }
    };

    const divPalette = ignoreRow
        ? "bg-red-100 border-red-700"
        : selected
        ? "surface-500 border-900"
        : "surface-100 border-300";
    const textPalette = ignoreRow
        ? "text-red-700"
        : selected
        ? "text-white"
        : "text-500";

    return (
        <th
            className={`justify-content-center align-items-center border-1 ${divPalette}`}
            style={{ height: "32px" }}
            onClick={handleSelect}
            onContextMenu={(e) => contextMenuRef.current?.show(e)}
        >
            <span className={`text-lg ${textPalette}`}>{label || row + 1}</span>
            <ContextMenu
                ref={contextMenuRef}
                model={items}
                breakpoint="767px"
            />
        </th>
    );
};

export default TabSeparatedInput;
