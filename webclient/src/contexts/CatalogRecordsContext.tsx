import React, { useContext } from "react";
import { createContext } from "react";
import ApiCatalogRecords from "../adapters/ApiCatalogRecords";
import { BaseProviderProps } from "./BaseContext";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";
import { useEsDataTable } from "./EsDataTableContext";

interface CatalogRecordsContextProps {
    approveDifference: (differenceId: number) => void;
}

const CatalogRecordsContext = createContext<
    CatalogRecordsContextProps | undefined
>(undefined);

export const CatalogRecordsProvider: React.FC<BaseProviderProps> = ({
    children,
}) => {
    const api = new ApiCatalogRecords();
    const { updateItem } = useEsDataTable();
    const { t } = useTranslation();
    const showToast = useToast();

    const approveDifference = (differenceId: number) => {
        api.approveDifference(differenceId).then((response) => {
            updateItem(response.data.id, response.data);
            showToast(
                "success",
                t("catalog-records.difference-approve-success")
            );
        });
    };

    const contextValue: CatalogRecordsContextProps = {
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
            "useCatalogRecords must be used within a CatalogRecordsProvider"
        );
    }

    return context;
};
