import {
    Table,
    Thead,
    Tr,
    Th,
    Tbody,
    Td,
    OuterScrollContainer,
    InnerScrollContainer,
} from "@patternfly/react-table";
import type { TableColumnConfig, TableColumnState } from "../../models/config";
import type { EsHit } from "../../models/api/responses/es";
import { Bullseye, Button } from "@patternfly/react-core";
import { ColumnsIcon } from "@patternfly/react-icons";

interface EsHitsTableProps<T> {
    columns: TableColumnConfig[];
    columnStates: Record<string, TableColumnState>;
    tableState?: React.ReactNode;
    hits: Array<EsHit<T>>;
    selectedIds: Set<string>;
    onToggleSelect: (hitId: string) => void;
}

const EsHitsTable = <T,>({
    columns,
    columnStates,
    tableState,
    hits,
    selectedIds,
    onToggleSelect,
}: EsHitsTableProps<T>) => {
    const orderedColumns = columns.sort(
        (a, b) =>
            (columnStates[a.key]?.order ?? Number.MAX_SAFE_INTEGER) -
            (columnStates[b.key]?.order ?? Number.MAX_SAFE_INTEGER)
    );
    const displayedColumns = orderedColumns.filter(
        (col) => columnStates[col.key]?.visible
    );

    if (orderedColumns.length === 0) {
        throw new Error("No columns configured for the table");
    }

    const header = (
        <Thead>
            <Tr>
                <Th>
                    <Button
                        variant="plain"
                        icon={<ColumnsIcon />}
                        hasNoPadding
                    />
                </Th>
                {displayedColumns.map((col) => (
                    <Th key={col.key}>{col.label}</Th>
                ))}
            </Tr>
        </Thead>
    );

    // if (displayedColumns.length === 0) {
    //     return (
    //         <Table isStickyHeader>
    //             {header}
    //             <Tbody>
    //                 <Tr>
    //                     <Td colSpan={1}>
    //                         <span>
    //                             No columns selected. Please select columns to
    //                             display using the settings menu.
    //                         </span>
    //                     </Td>
    //                 </Tr>
    //             </Tbody>
    //         </Table>
    //     );
    // }

    // if (hits.length === 0) {
    //     return (
    //         <Table isStickyHeader>
    //             {header}
    //             <Tbody>
    //                 <Tr>
    //                     <Td colSpan={displayedColumns.length + 1}>
    //                         {`No results`}
    //                     </Td>
    //                 </Tr>
    //             </Tbody>
    //         </Table>
    //     );
    // }

    const renderCell = (hit: EsHit<T>, col: TableColumnConfig) => {
        if (col.render) {
            return col.render(hit._source as Partial<T>);
        }
        return String((hit._source as { [key: string]: unknown })?.[col.key]);
    };

    const currentStateBody = (
        <Tbody>
            <Tr>
                <Td colSpan={displayedColumns.length + 1}>
                    <Bullseye>{tableState}</Bullseye>
                </Td>
            </Tr>
        </Tbody>
    );

    const hitsBody = (
        <Tbody>
            {hits.map((hit, index) => (
                <Tr key={hit._id}>
                    <Td
                        select={{
                            rowIndex: index,
                            isSelected: selectedIds.has(hit._id) ?? false,
                            onSelect: () => onToggleSelect(hit._id),
                        }}
                    />
                    {displayedColumns.map((col) => (
                        <Td key={col.key} dataLabel={col.label}>
                            {renderCell(hit, col)}
                        </Td>
                    ))}
                </Tr>
            ))}
        </Tbody>
    );

    return (
        <OuterScrollContainer style={{ marginLeft: 30, marginRight: 30 }}>
            <InnerScrollContainer>
                <Table isStickyHeader>
                    {header}
                    {tableState ? currentStateBody : hitsBody}
                </Table>
            </InnerScrollContainer>
        </OuterScrollContainer>
    );
};

export default EsHitsTable;
