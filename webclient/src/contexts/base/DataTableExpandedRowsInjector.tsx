import { useCallback, useState } from "react";
import { DataTableRowEvent } from "primereact/datatable";

interface DataTableExpandedRowsProps {
    expandedRows: any[];
    onRowExpand: (dat: any) => void;
    onRowExpandEvent: (event: DataTableRowEvent) => void;
    onRowCollapse: (data: any) => void;
    onRowCollapseEvent: (event: DataTableRowEvent) => void;
    reset: () => void;
}

const useDataTableExpandedRows = () => {
    const [expandedRows, setExpandedRows] = useState<any[]>([]);

    const onRowExpand = useCallback((data: any) => {
        setExpandedRows((prev) => [...prev, data]);
    }, []);

    const onRowExpandEvent = useCallback(
        (e: DataTableRowEvent) => {
            onRowExpand(e.data);
        },
        [onRowExpand]
    );

    const onRowCollapse = useCallback((data: any) => {
        if (data.id) {
            setExpandedRows((prev) => prev.filter((row) => row.id !== data.id));
        } else {
            setExpandedRows((prev) => prev.filter((row) => row !== data));
        }
    }, []);

    const onRowCollapseEvent = useCallback(
        (e: DataTableRowEvent) => {
            onRowCollapse(e.data);
        },
        [onRowCollapse]
    );
    
    const reset = useCallback(() => {
        setExpandedRows([]);
    }, []);

    return {
        expandedRows,
        onRowExpand,
        onRowExpandEvent,
        onRowCollapse,
        onRowCollapseEvent,
        reset,
    };
};

export default useDataTableExpandedRows;
export type { DataTableExpandedRowsProps };
