import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import type { EsHit } from "../../models/es";
import type { TableColumnConfig } from "../../models/config";

interface EsHitsTableProps<T> {
    columns: TableColumnConfig<T>[];
    hits: Array<EsHit<T>>;
    columnsOrder?: Record<string, number>;
}

const EsHitsTable = <T,>({
    columns,
    hits,
    columnsOrder,
}: EsHitsTableProps<T>) => {
    const orderedColumns = columnsOrder
        ? columns.sort((a, b) => {
              const orderA = columnsOrder[a.key] ?? Number.MAX_SAFE_INTEGER;
              const orderB = columnsOrder[b.key] ?? Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
          })
        : columns;

    return (
        <Table>
            <Thead>
                <Tr>
                    {orderedColumns.map((col) => (
                        <Th key={col.key}>{col.key}</Th>
                    ))}
                </Tr>
            </Thead>
            <Tbody>
                {hits.map((hit) => (
                    <Tr key={hit._id}>
                        {orderedColumns.map((col) => (
                            <Td key={col.key} dataLabel={col.key}>
                                {col.render(hit._source as Partial<T>)}
                            </Td>
                        ))}
                    </Tr>
                ))}
            </Tbody>
        </Table>
    );
};

export default EsHitsTable;
