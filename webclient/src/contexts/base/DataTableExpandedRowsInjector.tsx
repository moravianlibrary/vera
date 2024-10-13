import { useState } from "react";
import { DataTableRowEvent } from "primereact/datatable";

interface DataTableExpandedRowsProps {
    expandedRows: any[];
    onRowExpand: (event: DataTableRowEvent) => void;
    onRowCollapse: (event: DataTableRowEvent) => void;
}

const useDataTableExpandedRows = () => {
    const [expandedRows, setExpandedRows] = useState<any[]>([]);

    const onRowExpand = (e: DataTableRowEvent) => {
        setExpandedRows([...expandedRows, e.data]);
    };

    const onRowCollapse = (e: DataTableRowEvent) => {
        setExpandedRows(expandedRows.filter((row) => row.id !== e.data.id));
    };

    return {
        expandedRows,
        onRowExpand,
        onRowCollapse,
    };
};

export default useDataTableExpandedRows;
export type { DataTableExpandedRowsProps };
