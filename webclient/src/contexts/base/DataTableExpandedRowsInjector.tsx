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
    const [expandedRows, setExpandedRows] = useState<any>({});

    const onRowExpand = useCallback(
        (data: any) => {
            console.log(expandedRows);
            setExpandedRows({ ...expandedRows, [data.id]: true });
        },
        [expandedRows, setExpandedRows]
    );

    const onRowExpandEvent = useCallback(
        (e: DataTableRowEvent) => {
            onRowExpand(e.data);
        },
        [onRowExpand]
    );

    const onRowCollapse = useCallback((data: any) => {
        setExpandedRows((prev) => {
            const newRows = { ...prev };
            delete newRows[data.id];
            return newRows;
        });
    }, []);

    const onRowCollapseEvent = useCallback(
        (e: DataTableRowEvent) => {
            onRowCollapse(e.data);
        },
        [onRowCollapse]
    );

    const reset = useCallback(() => {
        setExpandedRows({});
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
