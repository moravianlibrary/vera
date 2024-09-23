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
import { DigitizationExtraction } from "../../adapters/ApiDigitizationExtractions";
import ApiDigitizationLists from "../../adapters/ApiDigitizationExtractions";

interface DigitizationListsContextProps {
    digitizationLists: DigitizationExtraction[];
    numFound: number;
    loadExtractions: (offset: number, limit: number) => void;
    createDigitizationList: (
        query: DocumentsQuery,
        intention_id?: number
    ) => Promise<DigitizationExtraction>;
    addDocumentsToDigitizationList: (
        digitization_list_id: number,
        query: DocumentsQuery
    ) => Promise<DigitizationExtraction>;
    removeDocumentsFromDigitizationList: (
        digitization_list_id: number,
        query: DocumentsQuery
    ) => Promise<DigitizationExtraction>;
    deleteDigitizationList: (digitization_list_id: number) => void;

    findDigitizationList: (
        digitization_list_id: number
    ) => Promise<DigitizationExtraction>;
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
    const api = new ApiDigitizationLists();

    const { t } = useTranslation();
    const showToast = useToast();
    // const { removeDocumentFromResults } = useDocuments();

    const loadAmount = 50;
    const [digitizationLists, setDigitizationLists] = useState<
        DigitizationExtraction[]
    >([]);
    const [numFound, setNumFound] = useState<number>(0);

    const loadExtractions = async (offset: number, limit: number) => {
        const page = offset / loadAmount + 1;
        const pageSize = loadAmount;
        api.getPage(page, pageSize)
            .then((response) => {
                setDigitizationLists(response.data.items);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(`Could not receive digitization lists: ${error}`);
            });
    };

    const createDigitizationList = async (
        query: DocumentsQuery,
        intention_id?: number
    ): Promise<DigitizationExtraction> => {
        try {
            const response = await api.createFromQuery(query, intention_id);
            setDigitizationLists([response.data, ...digitizationLists]);
            return response.data;
        } catch (error) {
            console.error(`Could not create digitization list: ${error}`);
            throw error;
        }
    };

    const addDocumentsToDigitizationList = async (
        digitization_list_id: number,
        query: DocumentsQuery
    ): Promise<DigitizationExtraction> => {
        try {
            const response = await api.addDocumentsToExtraction(
                digitization_list_id,
                query
            );
            setDigitizationLists(
                digitizationLists.map((digitization_list) =>
                    digitization_list.id === digitization_list_id
                        ? response.data
                        : digitization_list
                )
            );
            return response.data;
        } catch (error) {
            console.error(`Could not create digitization list: ${error}`);
            throw error;
        }
    };

    const removeDocumentsFromDigitizationList = async (
        digitization_list_id: number,
        query: DocumentsQuery
    ): Promise<DigitizationExtraction> => {
        try {
            const response = await api.removeDocumentsFromExtraction(
                digitization_list_id,
                query
            );
            setDigitizationLists(
                digitizationLists.map((digitization_list) =>
                    digitization_list.id === digitization_list_id
                        ? response.data
                        : digitization_list
                )
            );
            return response.data;
        } catch (error) {
            console.error(`Could not create digitization list: ${error}`);
            throw error;
        }
    };

    const deleteDigitizationList = async (digitization_list_id: number) => {
        api.delete(digitization_list_id)
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

    const findDigitizationList = async (digitization_list_id: number) => {
        return (await api.get(digitization_list_id)).data;
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

        findDigitizationList,
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
