import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";
import { DocumentsQuery } from "../../adapters/ApiDocuments";
import ApiDigitizationExtractions, {
    DigitizationExtraction,
} from "../../adapters/ApiDigitizationExtractions";
import DigitizationListModel from "./DigitizationListModel";
import { useDocumentsSearch } from "../documents/search/DocumentsSearchContext";
import { useDocuments } from "../documents/DocumentsContext";
import { useDigitizationLists } from "./DigitizationListsContext";
import { add } from "date-fns";
import { getAllByAltText } from "@testing-library/react";

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
    const { activeDigitizationList, setActiveDigitizationList } =
        useDocumentsSearch();
    const { getActiveQuery, removeDocumentsFromResults } = useDocuments();

    const createDigiList = async (intention_id?: number) => {
        createDigitizationList(getActiveQuery(), intention_id)
            .then((digitizationList) => {
                showToast(
                    "success",
                    "Digitization list created successfully",
                    ""
                );
                setActiveDigitizationList(digitizationList.id);
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
        addDocumentsToDigitizationList(digitization_list_id, getActiveQuery())
            .then((digitizationList) => {
                showToast(
                    "success",
                    "Digitization list updated successfully",
                    ""
                );
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
        removeDocumentsFromDigitizationList(
            activeDigitizationList!,
            getActiveQuery()
        )
            .then((digitizationList) => {
                showToast(
                    "success",
                    "Digitization list updated successfully",
                    ""
                );
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
