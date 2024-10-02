import React, { useContext, useEffect, useState } from "react";
import { createContext } from "react";
import ApiCatalogRecords, {
    CatalogRecord,
} from "../adapters/ApiCatalogRecords";
import { BaseProviderProps } from "./BaseContext";
import { useInstantSearch } from "react-instantsearch";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";

interface CatalogRecordsContextProps {
    catalogRecords: CatalogRecord[];
    approveDifference: (differenceId: number) => void;
}

const CatalogRecordsContext = createContext<
    CatalogRecordsContextProps | undefined
>(undefined);

export const CatalogRecordsProvider: React.FC<BaseProviderProps> = ({
    children,
}) => {
    const api = new ApiCatalogRecords();
    const { results } = useInstantSearch();
    const { t } = useTranslation();
    const showToast = useToast();

    const [catalogRecords, setCatalogRecords] = useState<CatalogRecord[]>([]);

    const approveDifference = (differenceId: number) => {
        api.approveDifference(differenceId).then((response) => {
            const updatedCatalogRecord = response.data;
            setCatalogRecords(
                catalogRecords.map((cr) => {
                    return cr.id === updatedCatalogRecord.id
                        ? updatedCatalogRecord
                        : cr;
                })
            );
            showToast(
                "success",
                t("catalog-records.difference-approve-success")
            );
        });
    };

    useEffect(() => {
        setCatalogRecords(results.hits);
    }, [results]);

    const contextValue: CatalogRecordsContextProps = {
        catalogRecords,
        approveDifference,
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
