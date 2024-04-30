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

interface SpreadsheetValueMapper {
    label: string;
    singleColumn: boolean;
}

interface SpreadsheetInputProps {
    visible: boolean;
    onHide: () => void;
    valueMappers: SpreadsheetValueMapper[];
    onSubmit: (values: string[]) => void;
}

const TabSeparatedInput: React.FC<SpreadsheetInputProps> = ({
    visible,
    onHide,
    valueMappers,
    onSubmit,
}) => {
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
                    : label
            )
        );
    };

    return (
        <Dialog visible={visible} onHide={onHide}>
            <div className="w-full">
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
                        />
                    )}
                    RowIndicator={SpreadsheetRow}
                    columnLabels={columnLabels}
                />
                <div className="flex flex-column overflow-scroll"></div>
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
}) => {
    const contextMenuRef = useRef<ContextMenu | null>(null);

    const items = mapColumns
        ? mapColumns.map((c) => ({
              label: c.label,
              command: () => onMapToColumn?.(column, c),
          }))
        : [];

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
