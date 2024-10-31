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
    CatalogIssueResponse,
    IdentifierWithAttributes,
} from "../adapters/ApiDocuments";
import {
    ALL_ITEMS_QUERY,
    FACETS_QUERY,
    getStatusPageQuery,
} from "../config/add_documents_responses";
import { IdentifierType } from "../types/IdentifierType";
import useObjectiveSettings, {
    ObjectiveSettingsInjectorProps,
} from "./base/ObjectiveSettingsInjector";
import AddDocumentResponseStatus, {
    orderBy,
} from "../types/AddDocumentResponseStatus";
import { ItemsPaginationProps } from "./base/PaginationInjector";
import { DigitizationState } from "../types/DigitizationState";

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
    extends ObjectiveSettingsInjectorProps<AddDocumentsSettings>,
        ItemsPaginationProps<AddDocumentResponse> {
    addDocument: (value: string) => void;
    addDocumentIssue: (responseId: string, barcode: string) => Promise<void>;
    addAllDocumentIssues: () => Promise<void>;
    addDocuments: (attributes: IdentifierWithAttributes[]) => void;
    removeResults: () => void;
    numProcessed: number;
    numFoundAll: number;
    statusBuckets: Bucket[];
    showStatus: AddDocumentResponseStatus | null;
    setShowStatus: (status: AddDocumentResponseStatus | null) => void;
    setDocumentPageCount: (
        responseId: string,
        documentId: string,
        pageCountManual: number | null
    ) => void;
    issues: CatalogIssueResponse[];
    reset: () => void;
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
    const [numFoundAll, setNumFoundAll] = useState<number>(0);
    const [statusBuckets, setStatusBuckets] = useState<Bucket[]>([]);
    const [showStatus, setShowStatus] =
        useState<AddDocumentResponseStatus | null>(null);

    const [items, setItems] = useState<AddDocumentResponse[]>([]);
    const [issues, setIssues] = useState<CatalogIssueResponse[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(1);
    const pageSizeOptions = [1, 5, 10, 50];

    const fetchFacets = async () => {
        try {
            const response = (
                await api.searchAddDocumentsResponses(FACETS_QUERY)
            ).data;

            const numFound = response.hits.total.value;

            const buckets: Bucket[] =
                response.aggregations.status_facet.buckets;
            const unprocessedBucket = buckets.find(
                (bucket) => bucket.key === AddDocumentResponseStatus.Unprocessed
            );
            const processedBuckets = buckets
                .filter(
                    (bucket) =>
                        bucket.key !== AddDocumentResponseStatus.Unprocessed
                )
                .sort((a, b) =>
                    orderBy(
                        a.key as AddDocumentResponseStatus,
                        b.key as AddDocumentResponseStatus
                    )
                );

            setNumFoundAll(numFound);
            setNumProcessed(numFound - (unprocessedBucket?.doc_count || 0));
            setStatusBuckets(processedBuckets);
        } catch (error) {
            console.error("Error fetching facets:", error);
        }
    };

    const fetchItems = useCallback(async () => {
        try {
            const response = (
                await api.searchAddDocumentsResponses(
                    getStatusPageQuery(showStatus, page, pageSize)
                )
            ).data;

            const items = response.hits.hits.map((hit) => hit._source);
            items.forEach((item) => {
                if (item.document) {
                    item.document.parentResponse = item;
                    item.document.issues.forEach((issue) => {
                        issue.parentDocument = item.document;
                    });
                }
            });
            const numFound = response.hits.total.value;
            const issues = items.flatMap((item) => item.document?.issues || []);

            setItems(items);
            setNumFound(numFound);
            setIssues(issues);
        } catch (error) {
            console.error("Error fetching add documents responses:", error);
        }
    }, [showStatus, page, pageSize]);

    const removeResults = async () => {
        api.deleteAddDocumentsResponses().then(() => {
            refresh();
        });
    };

    const addDocument = useCallback(
        (value: string) => {
            api.insertDocument({
                identifier_type: settings.identifierType,
                value,
                category_id: settings.categoryId,
                extraction_priority: settings.extractionPriority,
            });
            setNumFoundAll((prev) => prev + 1);
        },
        [settings]
    );

    const addDocumentIssue = useCallback(
        async (responseId: string, barcode: string) => {
            api.addDocumentIssues(responseId, {
                identifier_type: IdentifierType.Barcode,
                value: barcode,
                category_id: settings.categoryId,
                extraction_priority: settings.extractionPriority,
            }).then(() => {
                refresh();
            });
            setNumFoundAll((prev) => prev + 1);
        },
        [settings, showStatus, page, pageSize]
    );

    const addAllDocumentIssues = useCallback(async () => {
        Promise.all(
            items.map((response) =>
                api.addDocumentIssues(
                    response.id,
                    response.document.issues
                        .filter(
                            (issue) =>
                                !issue.document_id &&
                                issue.can_digitize &&
                                !issue.processing &&
                                issue.digitization_state ===
                                    DigitizationState.NotDigitized
                        )
                        .map((issue) => ({
                            identifier_type: IdentifierType.Barcode,
                            value: issue.barcode,
                            category_id: settings.categoryId,
                            extraction_priority: settings.extractionPriority,
                        }))
                )
            )
        ).then(() => refresh());

        const totalIssuesCount = items.reduce((acc, response) => {
            const filteredIssuesCount = response.document.issues.filter(
                (issue) =>
                    !issue.document_id &&
                    issue.can_digitize &&
                    !issue.processing &&
                    issue.digitization_state === DigitizationState.NotDigitized
            ).length;
            return acc + filteredIssuesCount;
        }, 0);
        setNumFoundAll((prev) => prev + totalIssuesCount);
    }, [settings, showStatus, items, page, pageSize]);

    const addDocuments = (attributes: IdentifierWithAttributes[]) => {
        api.insertDocument(attributes);
        setNumFoundAll((prev) => prev + attributes.length);
    };

    const setDocumentPageCount = (
        responseId: string,
        documentId: string,
        pageCountManual: number | null
    ) => {
        api.updateResponseDocument(responseId, documentId, {
            page_count_manual: pageCountManual,
        }).then(() => {
            refresh();
        });
    };

    const reset = () => {
        setShowStatus(null);
        setItems([]);
        setIssues([]);
        setPage(1);
        setPage(1);
    };

    const refresh = () => {
        fetchFacets();
        if (showStatus) {
            fetchItems();
        } else {
            reset();
        }
    };

    useEffect(() => {
        if (numFoundAll === numProcessed) return;

        const timer = setInterval(() => {
            fetchFacets();
            if (showStatus) {
                fetchItems();
            }
        }, 3000);

        const checkIfCompleted = () => {
            if (numFoundAll === numProcessed) {
                clearInterval(timer);
            }
        };

        checkIfCompleted();

        return () => clearInterval(timer);
    }, [numFoundAll, numProcessed]);

    useEffect(() => {
        refresh();
    }, [showStatus, page, pageSize]);

    const contextValue: AddDocumentsContextProps = {
        settings,
        saveSettings,
        ...restOfObjectiveSettingsProps,

        addDocument,
        addDocumentIssue,
        addAllDocumentIssues,
        addDocuments,
        removeResults,
        numProcessed,
        numFoundAll,
        statusBuckets,
        showStatus,
        setShowStatus,
        setDocumentPageCount,
        reset,

        items,
        issues,
        numFound,
        refresh,
        page,
        setPage,
        pageSize,
        setPageSize,
        pageSizeOptions,
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
