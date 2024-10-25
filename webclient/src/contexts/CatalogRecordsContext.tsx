import React, { useContext, useEffect } from "react";
import { createContext } from "react";
import ApiCatalogRecords, {
    CatalogRecord,
} from "../adapters/ApiCatalogRecords";
import { BaseProviderProps } from "./BaseContext";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";
import useEsPagination, {
    EsItemsPaginationProps,
} from "./base/EsPaginationInjector";
import useEsSelection, {
    EsItemsSelectionProps,
} from "./base/EsSelectionInjector";
import useDataTableExpandedRows, {
    DataTableExpandedRowsProps,
} from "./base/DataTableExpandedRowsInjector";

interface CatalogRecordsContextProps
    extends EsItemsPaginationProps<CatalogRecord>,
        EsItemsSelectionProps<CatalogRecord>,
        DataTableExpandedRowsProps {
    approveDifference: (differenceId: number) => void;
}

const CatalogRecordsContext = createContext<
    CatalogRecordsContextProps | undefined
>(undefined);

export const CatalogRecordsProvider: React.FC<
    BaseProviderProps & {
        searchClient: {
            clearCache(): Promise<void>;
        };
    }
> = ({ searchClient, children }) => {
    const api = new ApiCatalogRecords();
    const { t } = useTranslation("catalog-records");
    const showToast = useToast();
    const {
        items,
        numFound,
        queryParams,
        queryRoute,
        updateItem,
        ...restOfPaginationProps
    } = useEsPagination<CatalogRecord>();
    const { reset, ...restOfExpandedRowsProps } = useDataTableExpandedRows();

    const approveDifference = (differenceId: number) => {
        api.approveDifference(differenceId).then((response) => {
            updateItem(response.data.id, response.data);
            searchClient.clearCache();
            showToast("success", t("actions.difference-approve-success"));
        });
    };

    useEffect(() => {
        reset();
    }, [reset, queryParams.current, queryRoute.current]);

    const contextValue: CatalogRecordsContextProps = {
        items,
        numFound,
        queryParams,
        queryRoute,
        updateItem,
        ...restOfPaginationProps,

        ...useEsSelection(),

        reset,
        ...restOfExpandedRowsProps,

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
