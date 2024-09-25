import React, { useContext, useEffect, useState } from "react";
import { createContext } from "react";
import ApiCatalogRecords, {
    CatalogRecord,
} from "../adapters/ApiCatalogRecords";
import { BaseProviderProps } from "./BaseContext";

interface CatalogRecordsContextProps {
    catalogRecords: CatalogRecord[];
    numFound: number;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (pageSize: number) => void;
    refresh: () => void;
}

const CatalogRecordsContext = createContext<
    CatalogRecordsContextProps | undefined
>(undefined);

export const CatalogRecordsProvider: React.FC<BaseProviderProps> = ({
    children,
}) => {
    const api = new ApiCatalogRecords();

    const [catalogRecords, setCatalogRecords] = useState<CatalogRecord[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);

    const fetchCatalogRecords = async () => {
        api.getPage(page, pageSize).then((response) => {
            console.log(response.data);

            setCatalogRecords(response.data.items);
            setNumFound(response.data.num_found);
        });
    };

    const refresh = () => {
        fetchCatalogRecords();
    };

    useEffect(() => {
        fetchCatalogRecords();
    }, [page, pageSize]);

    const contextValue: CatalogRecordsContextProps = {
        catalogRecords,
        numFound,
        page,
        setPage,
        pageSize,
        setPageSize,
        refresh,
    };

    return (
        <CatalogRecordsContext.Provider value={contextValue}>
            {children}
        </CatalogRecordsContext.Provider>
    );
};

export const useCatalogRecords = (): CatalogRecordsContextProps => {
    const context = useContext(CatalogRecordsContext);

    if (!context) {
        throw new Error(
            "useDepartments must be used within a DepartmentsProvider"
        );
    }

    return context;
};
