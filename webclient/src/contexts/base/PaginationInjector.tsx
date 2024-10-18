import { useState, useEffect } from "react";
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

const useItemsPagination = <T extends Object>(
    api: ApiBase<T>,
    itemsName: string
) => {
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    const [items, setItems] = useState<T[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const pageSizeOptions = [10, 15, 20, 25, 50, 100];
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
        if (!isInitialized) {
            fetchItems();
            setIsInitialized(true);
        }
    }, [page, pageSize, api, itemsName]);

    return {
        items,
        numFound,
        refresh: fetchItems,
        page,
        setPage,
        pageSizeOptions,
        pageSize,
        setPageSize,
    };
};

export default useItemsPagination;
export type { ItemsPaginationProps };
