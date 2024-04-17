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

interface DigitizationListsContextProps {
    digitizationLists: DigitizationExtraction[];
    numFound: number;
    loadExtractions: (offset: number, limit: number) => void;
    createDigitizationList: (
        query: DocumentsQuery,
        intention_id?: number
    ) => void;
    addDocumentsToDigitizationList: (
        digitization_list_id: number,
        query: DocumentsQuery
    ) => void;
    removeDocumentsFromDigitizationList: (
        digitization_list_id: number,
        query: DocumentsQuery
    ) => void;
    deleteDigitizationList: (digitization_list_id: number) => void;
}

const DigitizationListsContext = createContext<
    DigitizationListsContextProps | undefined
>(undefined);

interface DigitizationListsProviderProps {
    children: ReactNode;
}

export const DigitizationListsProvider: React.FC<
    DigitizationListsProviderProps
> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const loadAmount = 50;
    const [digitizationLists, setDigitizationLists] = useState<
        DigitizationExtraction[]
    >([]);
    const [numFound, setNumFound] = useState<number>(0);

    const loadExtractions = async (offset: number, limit: number) => {
        ApiDigitizationExtractions.getExtractions(offset, limit)
            .then((response) => {
                const transformedData: DigitizationExtraction[] =
                    response.data.extractions.map((extraction) => {
                        return new DigitizationListModel(extraction);
                    });
                setDigitizationLists(transformedData);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(`Could not receive digitization lists: ${error}`);
            });
    };

    const createDigitizationList = async (
        query: DocumentsQuery,
        intention_id?: number
    ) => {
        ApiDigitizationExtractions.createExtraction(query, intention_id)
            .then((response) => {
                const transformedData: DigitizationExtraction =
                    new DigitizationListModel(response.data);
                setDigitizationLists([transformedData, ...digitizationLists]);
                showToast(
                    "success",
                    t("Digitization list created successfully"),
                    ""
                );
            })
            .catch((error) => {
                if (
                    400 <= error.response.status &&
                    error.response.status < 500
                ) {
                    showToast(
                        "error",
                        t("Digitization list creation failed"),
                        error.response.data.detail
                    );
                }
                console.error(`Could not create digitization list: ${error}`);
            });
    };

    const addDocumentsToDigitizationList = async (
        digitization_list_id: number,
        query: DocumentsQuery
    ) => {
        ApiDigitizationExtractions.addDocumentsToExtraction(
            digitization_list_id,
            query
        )
            .then((response) => {
                const transformedData: DigitizationExtraction =
                    new DigitizationListModel(response.data);
                setDigitizationLists(
                    digitizationLists.map((digitization_list) =>
                        digitization_list.id === digitization_list_id
                            ? transformedData
                            : digitization_list
                    )
                );
            })
            .catch((error) => {
                if (
                    400 <= error.response.status &&
                    error.response.status < 500
                ) {
                    showToast(
                        "error",
                        t("Digitization list update failed"),
                        error.response.data.detail
                    );
                }
                console.error(`Could not update digitization list: ${error}`);
            });
    };

    const removeDocumentsFromDigitizationList = async (
        digitization_list_id: number,
        query: DocumentsQuery
    ) => {
        ApiDigitizationExtractions.removeDocumentsFromExtraction(
            digitization_list_id,
            query
        )
            .then((response) => {
                const transformedData: DigitizationExtraction =
                    new DigitizationListModel(response.data);
                setDigitizationLists(
                    digitizationLists.map((digitization_list) =>
                        digitization_list.id === digitization_list_id
                            ? transformedData
                            : digitization_list
                    )
                );
            })
            .catch((error) => {
                if (
                    400 <= error.response.status &&
                    error.response.status < 500
                ) {
                    showToast(
                        "error",
                        t("Digitization list update failed"),
                        error.response.data.detail
                    );
                }
                console.error(`Could not update digitization list: ${error}`);
            });
    };

    const deleteDigitizationList = async (digitization_list_id: number) => {
        ApiDigitizationExtractions.deleteExtraction(digitization_list_id)
            .then((response) => {
                setDigitizationLists(
                    digitizationLists.filter(
                        (digitization_list) =>
                            digitization_list.id !== digitization_list_id
                    )
                );
            })
            .catch((error) => {
                console.error(`Could not delete digitization list: ${error}`);
            });
    };

    useEffect(() => {
        console.log(`Fetching extractions from server.`);
        loadExtractions(0, loadAmount);
    }, []);

    const contextValue: DigitizationListsContextProps = {
        digitizationLists,
        numFound,
        loadExtractions,
        createDigitizationList,
        addDocumentsToDigitizationList,
        removeDocumentsFromDigitizationList,
        deleteDigitizationList,
    };

    return (
        <DigitizationListsContext.Provider value={contextValue}>
            {children}
        </DigitizationListsContext.Provider>
    );
};

export const useDigitizationLists = (): DigitizationListsContextProps => {
    const context = useContext(DigitizationListsContext);

    if (!context) {
        throw new Error(
            "useExtractions must be used within a ExtractionsProvider"
        );
    }

    return context;
};
