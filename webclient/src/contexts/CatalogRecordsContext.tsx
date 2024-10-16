import React, { useContext } from "react";
import { createContext } from "react";
import ApiCatalogRecords, {
    CatalogRecord,
} from "../adapters/ApiCatalogRecords";
import { BaseProviderProps } from "./BaseContext";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";
import { useEsDataTable } from "./EsDataTableContext";
import useEsPagination, {
    EsItemsPaginationProps,
} from "./base/EsPaginationInjector";
import useEsSelection, {
    EsItemsSelectionProps,
} from "./base/EsSelectionInjector";
import { stateToQuery, stateToRoute } from "../data/factories/EsQueriesFactory";
import { booleanAttributes } from "../config/documents_index";
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

export const CatalogRecordsProvider: React.FC<BaseProviderProps> = ({
    children,
}) => {
    const api = new ApiCatalogRecords();
    const { updateItem } = useEsDataTable();
    const { t } = useTranslation();
    const showToast = useToast();
    const { items, numFound, queryParams, ...restOfPaginationProps } =
        useEsPagination(
            (uiState) =>
                stateToQuery("catalog_records", booleanAttributes, uiState),
            (uiState) =>
                stateToRoute("catalog_records", booleanAttributes, uiState)
        );

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
        items,
        numFound,
        queryParams,
        ...restOfPaginationProps,

        ...useEsSelection(items, numFound, queryParams),

        ...useDataTableExpandedRows(),

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
