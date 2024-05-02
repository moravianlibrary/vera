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
import RequiredValueBadge from "./RequiredValueBadge";

interface SpreadsheetValueMapper {
    key: string;
    label: string;
    required?: boolean;
}

interface SpreadsheetInputProps {
    visible: boolean;
    onHide: () => void;
    valueMappers: SpreadsheetValueMapper[];
    onSubmit: (values: [key: string, value: string][]) => void;
}

const TabSeparatedInput: React.FC<SpreadsheetInputProps> = ({
    visible,
    onHide,
    valueMappers,
    onSubmit,
}) => {
    const { t } = useTranslation();

    const [columnLabels, setColumnLabels] = useState<string[]>([]);
    const [data, setData] = useState<CellBase[][]>([[{ value: "" }]]);
    const [selected, setSelected] = useState<Selection>(new EmptySelection());

    useEffect(() => {
        setColumnLabels(Array.from({ length: data[0].length }, (_, i) => ""));
    }, [data]);

    const handleMapToColumn = (
        column: number,
        mappingColumn: SpreadsheetValueMapper
    ) => {
        setColumnLabels((prev) =>
            prev.map((label, i) =>
                i === column
                    ? columnLabels[i] !== mappingColumn.label
                        ? mappingColumn.label
                        : ""
                    : label === mappingColumn.label
                    ? ""
                    : label
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

    return (
        <Dialog visible={visible} onHide={onHide}>
            <div className="flex flex-column w-full gap-3">
                <div className="flex w-full gap-2 align-items-center">
                    <span>{t("Column labels")}:</span>
                    {valueMappers.map((mapper) => (
                        <div className="relative">
                            <Chip
                                className="p-overlay-badge"
                                key={mapper.label}
                                label={mapper.label}
                            />
                            <Badge
                                key={mapper.label}
                                severity={
                                    columnLabels.filter(
                                        (label) => label === mapper.label
                                    ).length === 0
                                        ? "warning"
                                        : "success"
                                }
                                value={mapper.required && "Required"}
                                style={{
                                    position: "relative",
                                    top: "-7px",
                                    left: "-10px",
                                    zIndex: 10,
                                }}
                            />
                        </div>
                    ))}
                </div>
                <div
                    className="overflow-scroll"
                    style={{ maxHeight: "calc(100vh - 320px)" }}
                >
                    <Spreadsheet
                        data={data}
                        onChange={(newData) => setData(newData as CellBase[][])}
                        selected={selected}
                        onSelect={setSelected}
                        ColumnIndicator={(props) => (
                            <SpreadsheetColumn
                                {...props}
                                mapColumns={valueMappers}
                                onMapToColumn={handleMapToColumn}
                                onDuplicateColumn={handleDuplicateColumn}
                                onDeleteColumn={handleDeleteColumn}
                            />
                        )}
                        RowIndicator={SpreadsheetRow}
                        columnLabels={columnLabels}
                    />
                </div>
            </div>
        </Dialog>
    );
};

interface SpreadsheetColumnProps extends ColumnIndicatorProps {
    mapColumns?: SpreadsheetValueMapper[];
    onMapToColumn?: (
        column: number,
        mappingColumn: SpreadsheetValueMapper
    ) => void;
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
            label: t("Map to column"),
            items: mapColumns
                ? mapColumns.map((c) => ({
                      label: c.label,
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
