import React, { useState, useEffect, ReactNode } from "react";
import { ApiBase } from "../../adapters/ApiBase";

interface ItemsPaginationProps<T> {
    items: T[];
    numFound: number;
    refresh: () => void;
    page: number;
    setPage: (page: number) => void;
    pageSizeOptions?: number[];
    pageSize: number;
    setPageSize: (pageSize: number) => void;
}

const withPagination = <T,>(
    WrappedComponent: React.ComponentType<
        ItemsPaginationProps<T> & { children?: ReactNode }
    >,
    api: ApiBase<T>,
    itemsName: string,
    loadOnMount?: boolean
) => {
    return (
        props: Omit<ItemsPaginationProps<T>, keyof ItemsPaginationProps<T>>
    ) => {
        const [isInitialized, setIsInitialized] = useState<boolean>(false);

        const [items, setItems] = useState<T[]>([]);
        const [numFound, setNumFound] = useState<number>(0);
        const [page, setPage] = useState<number>(1);
        const [pageSize, setPageSize] = useState<number>(20);

        const fetchItems = async () => {
            console.debug(`Fetching ${itemsName} from server.`);
            api.getPage(page, pageSize)
                .then((response) => {
                    setItems(response.data.items);
                    setNumFound(response.data.num_found);
                })
                .catch((error) => {
                    console.error(`Failed to fetch ${itemsName}:`, error);
                });
        };

        useEffect(() => {
            if (isInitialized || loadOnMount) {
                fetchItems();
            } else {
                setIsInitialized(true);
            }
        }, [page, pageSize, api, itemsName]);

        return (
            <WrappedComponent
                {...(props as any)}
                items={items}
                numFound={numFound}
                refresh={fetchItems}
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
            />
        );
    };
};

export default withPagination;
export type { ItemsPaginationProps };
