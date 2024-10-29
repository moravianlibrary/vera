import React, {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import ApiDocuments, {
    AddDocumentResponse,
    IdentifierWithAttributes,
} from "../adapters/ApiDocuments";
import {
    FACETS_QUERY,
    getStatusPageQuery,
} from "../config/add_documents_responses";
import { IdentifierType } from "../types/IdentifierType";
import useObjectiveSettings, {
    ObjectiveSettingsInjectorProps,
} from "./base/ObjectiveSettingsInjector";
import AddDocumentResponseStatus from "../types/AddDocumentResponseStatus";

export interface AddDocumentsSettings {
    identifierType: IdentifierType;
    categoryId: number | null;
    insertAnotherAfter: number | null;
    extractionPriority: number;
}

const SETTINGS_NAME = "addDocumentSettings";

const DEFAULT_SETTINGS: AddDocumentsSettings = {
    identifierType: IdentifierType.Sysno,
    categoryId: null,
    insertAnotherAfter: 3,
    extractionPriority: 3,
};

export interface Bucket {
    key: string;
    doc_count: number;
}

interface AddDocumentsContextProps
    extends ObjectiveSettingsInjectorProps<AddDocumentsSettings> {
    addDocument: (value: string) => void;
    addDocuments: (attributes: IdentifierWithAttributes[]) => void;
    numProcessed: number;
    numFound: number;
    statusBuckets: Bucket[];
    getResponses: (
        status: AddDocumentResponseStatus,
        page: number,
        pageSize: number
    ) => Promise<AddDocumentResponse[]>;
}

interface AddDocumentsProviderProps {
    children: ReactNode;
}

const AddDocumentsContext = createContext<AddDocumentsContextProps | undefined>(
    undefined
);

export const AddDocumentsProvider: React.FC<AddDocumentsProviderProps> = ({
    children,
}) => {
    const api = new ApiDocuments();
    const { t } = useTranslation("documents");

    const { settings, saveSettings, ...restOfObjectiveSettingsProps } =
        useObjectiveSettings<AddDocumentsSettings>(
            SETTINGS_NAME,
            DEFAULT_SETTINGS
        );

    const [numProcessed, setNumProcessed] = useState<number>(0);
    const [numFound, setNumFound] = useState<number>(0);
    const [statusBuckets, setStatusBuckets] = useState<Bucket[]>([]);

    const fetchProcessedCount = async () => {
        try {
            const facetsResponse = (
                await api.searchAddDocumentsResponses(FACETS_QUERY)
            ).data;

            const numFound = facetsResponse.hits.total.value;

            const buckets: Bucket[] =
                facetsResponse.aggregations.status_facet.buckets;
            const unprocessedBucket = buckets.find(
                (bucket) => bucket.key === AddDocumentResponseStatus.Unprocessed
            );
            const processedBuckets = buckets.filter(
                (bucket) => bucket.key !== AddDocumentResponseStatus.Unprocessed
            );

            setNumFound(numFound);
            setNumProcessed(numFound - (unprocessedBucket?.doc_count || 0));
            setStatusBuckets(processedBuckets);
        } catch (error) {
            console.error("Error fetching unprocessed count:", error);
        }
    };

    const addDocument = useCallback(
        (value: string) => {
            api.insertDocument({
                identifier_type: settings.identifierType,
                value,
                category_id: settings.categoryId,
                extraction_priority: settings.extractionPriority,
            });
            setNumFound((prev) => prev + 1);
        },
        [settings]
    );

    const addDocuments = (attributes: IdentifierWithAttributes[]) => {
        api.insertDocument(attributes);
        setNumFound((prev) => prev + attributes.length);
    };

    const getResponses = async (
        status: AddDocumentResponseStatus,
        page: number,
        pageSize: number
    ) => {
        try {
            const response = await api.searchAddDocumentsResponses(
                getStatusPageQuery(status, page, pageSize)
            );
            return response.data.hits.hits.map((hit) => hit._source);
        } catch (error) {
            return [];
        }
    };

    useEffect(() => {
        if (numFound === numProcessed) return;

        const timer = setInterval(() => {
            setNumFound((prevCount) => {
                if (prevCount > 0) {
                    fetchProcessedCount();
                }
                return prevCount;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [numFound]);

    useEffect(() => {
        fetchProcessedCount();
    }, []);

    const contextValue: AddDocumentsContextProps = {
        settings,
        saveSettings,
        ...restOfObjectiveSettingsProps,

        addDocument,
        addDocuments,
        numProcessed,
        numFound,
        statusBuckets,
        getResponses,
    };

    return (
        <AddDocumentsContext.Provider value={contextValue}>
            {children}
        </AddDocumentsContext.Provider>
    );
};

export const useAddDocuments = () => {
    const context = useContext(AddDocumentsContext);
    if (!context) {
        throw new Error(
            "useAddDocuments must be used within a AddDocumentsProvider"
        );
    }
    return context;
};
