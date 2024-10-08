import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import { useToast } from "../ToastContext";
import { useTranslation } from "react-i18next";
import { DigitizationList } from "../../adapters/ApiDigitizationLists";
import ApiDigitizationLists from "../../adapters/ApiDigitizationLists";
import { EsQuery } from "../../adapters/ApiTasks";
import { confirmDialog } from "primereact/confirmdialog";
import { useIntentions } from "../categories/IntentionsContext";

interface DigitizationListsContextProps {
    digitizationLists: DigitizationList[];
    numFound: number;
    loadExtractions: (offset: number, limit: number) => void;
    createDigitizationList: (
        query: Object,
        intention_id: number
    ) => Promise<DigitizationList>;
    addDocumentsToDigitizationList: (
        digitization_list_id: number,
        query: Object
    ) => Promise<DigitizationList>;
    removeDocumentsFromDigitizationList: (
        digitization_list_id: number,
        query: Object
    ) => Promise<DigitizationList>;
    deleteDigitizationList: (digitization_list_id: number) => void;

    findDigitizationList: (
        digitization_list_id: number
    ) => Promise<DigitizationList>;

    onInitiateListCreation: (
        count: number,
        queryParams: EsQuery,
        intentionId: number
    ) => void;
    onInitiateListItemsAddition: (
        count: number,
        queryParams: EsQuery,
        digitizationListId: number
    ) => void;
    onInitiateListItemsRemoval: (
        count: number,
        queryParams: EsQuery,
        digitizationListId: number
    ) => void;
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
    // const { removeDocumentFromResults } = useDocuments();

    const loadAmount = 50;
    const [digitizationLists, setDigitizationLists] = useState<
        DigitizationList[]
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
        query: Object,
        intention_id: number
    ): Promise<DigitizationList> => {
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
        query: Object
    ): Promise<DigitizationList> => {
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
        query: Object
    ): Promise<DigitizationList> => {
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

    const onInitiateListCreation = (
        count: number,
        queryParams: EsQuery,
        intentionId: number
    ) => {
        confirmDialog({
            message: t(
                `Are you sure you want to create digitization list from {{count}} selected documents?`,
                { count }
            ),
            header: t("Confirm action"),
            icon: "pi pi-question",
            acceptLabel: t("common.yes"),
            rejectLabel: t("common.no"),
            accept: () => createDigitizationList(queryParams, intentionId),
        });
    };

    const onInitiateListItemsAddition = (
        count: number,
        queryParams: EsQuery,
        digitizationListId: number
    ) => {
        confirmDialog({
            message: t(
                `Are you sure you want to add {{count}} selected documents to digitization list {{digitizationListId}}?`,
                { count, digitizationListId }
            ),
            header: t("Confirm action"),
            icon: "pi pi-question",
            acceptLabel: t("common.yes"),
            rejectLabel: t("common.no"),
            accept: () =>
                addDocumentsToDigitizationList(digitizationListId, queryParams),
        });
    };

    const onInitiateListItemsRemoval = (
        count: number,
        queryParams: EsQuery,
        digitizationListId: number
    ) => {
        confirmDialog({
            message: t(
                `Are you sure you want to remove {{count}} selected documents from digitization list {{digitizationListId}}?`,
                { count, digitizationListId }
            ),
            header: t("Confirm action"),
            icon: "pi pi-question",
            acceptLabel: t("common.yes"),
            rejectLabel: t("common.no"),
            accept: () =>
                removeDocumentsFromDigitizationList(
                    digitizationListId,
                    queryParams
                ),
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

        findDigitizationList,

        onInitiateListCreation,
        onInitiateListItemsAddition,
        onInitiateListItemsRemoval,
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
