import React, { createContext, useContext, ReactNode } from "react";
import { useToast } from "../ToastContext";
import { useTranslation } from "react-i18next";
import { useDocuments } from "../documents/DocumentsContext";
import { useDigitizationLists } from "./DigitizationListsContext";
import { useDocumentsSelection } from "../documents/DocumentsSelectionContext";
import { useDocumentsQuery } from "../documents/search/DocumentsQueryContext";

interface DigitizationListsManagerContextProps {
    createDigitizationList: (intention_id?: number) => void;
    addDocumentsToDigitizationList: (digitization_list_id: number) => void;
    removeDocumentsFromDigitizationList: () => void;
}

const DigitizationListsManagerContext = createContext<
    DigitizationListsManagerContextProps | undefined
>(undefined);

interface DigitizationListsManagerProviderProps {
    children: ReactNode;
}

export const DigitizationListsManagerProvider: React.FC<
    DigitizationListsManagerProviderProps
> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const {
        createDigitizationList,
        addDocumentsToDigitizationList,
        removeDocumentsFromDigitizationList,
    } = useDigitizationLists();
    const { removeDocumentsFromResults } = useDocuments();
    const { selectionQuery, cancelSelection } = useDocumentsSelection();
    const { searchByDigitizationListId, digitizationListId } =
        useDocumentsQuery();

    const createDigiList = async (intention_id?: number) => {
        createDigitizationList(selectionQuery, intention_id)
            .then((digitizationList) => {
                showToast(
                    "success",
                    "Digitization list created successfully",
                    ""
                );
                cancelSelection();
                searchByDigitizationListId(digitizationList.id);
            })
            .catch((error) => {
                if (
                    400 <= error.response.status &&
                    error.response.status < 500
                ) {
                    showToast(
                        "error",
                        "Digitization list creation failed",
                        error.response.data.detail
                    );
                }
            });
    };

    const addDocumentsToDigiList = async (digitization_list_id: number) => {
        addDocumentsToDigitizationList(digitization_list_id, selectionQuery)
            .then((digitizationList) => {
                showToast(
                    "success",
                    "Digitization list updated successfully",
                    ""
                );
                cancelSelection();
                removeDocumentsFromResults(digitizationList.document_ids);
            })
            .catch((error) => {
                if (
                    400 <= error.response.status &&
                    error.response.status < 500
                ) {
                    showToast(
                        "error",
                        "Digitization list update failed",
                        error.response.data.detail
                    );
                }
            });
    };

    const removeDocumentsFromDigiList = async () => {
        removeDocumentsFromDigitizationList(digitizationListId!, selectionQuery)
            .then((digitizationList) => {
                showToast(
                    "success",
                    "Digitization list updated successfully",
                    ""
                );
                cancelSelection();
                removeDocumentsFromResults(selectionQuery.id_list!);
            })
            .catch((error) => {
                if (
                    400 <= error.response.status &&
                    error.response.status < 500
                ) {
                    showToast(
                        "error",
                        "Digitization list update failed",
                        error.response.data.detail
                    );
                }
            });
    };

    const contextValue: DigitizationListsManagerContextProps = {
        createDigitizationList: createDigiList,
        addDocumentsToDigitizationList: addDocumentsToDigiList,
        removeDocumentsFromDigitizationList: removeDocumentsFromDigiList,
    };

    return (
        <DigitizationListsManagerContext.Provider value={contextValue}>
            {children}
        </DigitizationListsManagerContext.Provider>
    );
};

export const useDigitizationManager =
    (): DigitizationListsManagerContextProps => {
        const context = useContext(DigitizationListsManagerContext);

        if (!context) {
            throw new Error(
                "useDigitizationManager must be used within a DigitizationManagerProvider"
            );
        }

        return context;
    };
