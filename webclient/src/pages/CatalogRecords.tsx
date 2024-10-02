import React from "react";
import { CatalogRecordsProvider } from "../contexts/CatalogRecordsContext";
import CatalogRecordsTable from "../features/catalog-records/CatalogRecordsTable";
import DataTableLayout from "../components/layouts/DataTableLayout";
import Client from "@searchkit/instantsearch-client";
import catalogRecordsIndex from "../adapters/IndexCatalogRecords";
import { InstantSearch } from "react-instantsearch";
import CatalogRecordsQueryRules from "../features/catalog-records/CatalogRecordsQueryRules";
import CatalogRecordsHeader from "../features/catalog-records/CatalogRecordsHeader";
import { SearchRequest } from "searchkit";

interface CatalogRecordsProps {}

const CatalogRecords: React.FC<CatalogRecordsProps> = (props) => {
    return <CatalogRecordsDiv {...props} />;
};

const doesHaveQueryFilter = (request: SearchRequest) => {
    return (request.body.query?.bool?.filter && true) || false;
};

interface QueryContainer {}

const getNestedFilterPaths = (
    queryContainer: QueryContainer | QueryContainer[]
) => {
    const pathCount = (
        Array.isArray(queryContainer) ? queryContainer : [queryContainer]
    )
        .filter((qc) => qc.bool && qc.bool.should)
        .map((qc) => qc.bool.should)
        .flat()
        .filter((qcs) => qcs.nested)
        .map((qcs) => qcs.nested!.path)
        .reduce((acc, path) => {
            acc[path] = (acc[path] || 0) + 1;
            return acc;
        }, {});

    return Object.keys(pathCount).filter((path) => pathCount[path] > 1);
};

const sharedNestedPathsWorkaround = (requests: SearchRequest[]) => {
    requests.forEach((request) => {
        const nestedFiltersMap = new Map();

        // Iterate through the filters and combine them based on nested paths
        const filters = request.body.query?.bool?.filter || [];

        if (!doesHaveQueryFilter(request)) return request;

        const nestedFilterPaths = getNestedFilterPaths(
            request.body.query!.bool!.filter!
        );

        (Array.isArray(filters) ? filters : [filters]).forEach((filter) => {
            if (filter.bool && filter.bool.should) {
                const shoulds = Array.isArray(filter.bool.should)
                    ? filter.bool.should
                    : [filter.bool.should];
                shoulds.forEach((nestedQuery) => {
                    if (nestedQuery.nested) {
                        const path = nestedQuery.nested.path;
                        if (!nestedFiltersMap.has(path)) {
                            nestedFiltersMap.set(path, []);
                        }
                        nestedFiltersMap
                            .get(path)
                            .push(nestedQuery.nested.query.bool?.should);
                    }
                });
            }
        });

        if (nestedFiltersMap.size < 1) {
            return request;
        }

        const newFilter = Array.from(nestedFiltersMap.entries()).map(
            ([path, queries]) => ({
                nested: {
                    inner_hits: {},
                    path,
                    query: {
                        bool: {
                            should: queries.flat(), // Flatten combined should arrays
                        },
                    },
                },
            })
        );

        request.body.query!.bool!.filter = newFilter;

        return request;
    });

    return Promise.resolve(requests);
};

const CatalogRecordsDiv: React.FC<CatalogRecordsProps> = () => {
    const searchClient = Client(catalogRecordsIndex, {
        hooks: {
            beforeSearch: sharedNestedPathsWorkaround,
        },
    });
    return (
        <InstantSearch indexName="catalog_records" searchClient={searchClient}>
            <CatalogRecordsProvider>
                <DataTableLayout
                    header={<CatalogRecordsHeader />}
                    sidebar={<CatalogRecordsQueryRules />}
                    datatable={<CatalogRecordsTable />}
                    paginator={<CatalogRecordsTable.Paginator />}
                />
            </CatalogRecordsProvider>
        </InstantSearch>
    );
};

export default CatalogRecords;
