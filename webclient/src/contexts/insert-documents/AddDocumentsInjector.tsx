import { useCallback, useState } from "react";
import ApiDocuments, {
    AddDocumentResponse,
    CatalogDocumentResponse,
    Identifier,
} from "../../adapters/ApiDocuments";
import { AddDocumentsSettings } from "./InsertDocumentsContext";
import AddDocumentResponseStatus from "../../types/AddDocumentResponseStatus";
import { set } from "date-fns";

interface IdentifierWithSettings extends Identifier {
    categoryId: number;
    extractionPriority: number;
}

interface AddDocumentsInjectorProps {
    processedCount: number;
    totalCount: number;
    responses: AddDocumentResponse[];
    multipleIssuesDocuments: Record<string, CatalogDocumentResponse>;
    addDocument: (identifier: Identifier) => void;
    addDocuments: (identifiers: IdentifierWithSettings[]) => void;
    resetResponses: () => void;
}

const useAddDocuments = (api: ApiDocuments, settings: AddDocumentsSettings) => {
    const [processedCount, setProcessedCount] = useState<number>(0);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [responses, setResponses] = useState<AddDocumentResponse[]>([]);
    const [multipleIssuesDocuments, setMultipleIssuesDocuments] = useState<
        Record<string, CatalogDocumentResponse>
    >({});

    const addDocument = useCallback(
        async (identifier: Identifier) => {
            try {
                setTotalCount((prev) => prev + 1);

                const response = (
                    await api.insertDocument(
                        identifier,
                        settings.categoryId,
                        false
                    )
                ).data;

                if (
                    response.status ===
                        AddDocumentResponseStatus.MultipleIssues &&
                    response.document
                ) {
                    setMultipleIssuesDocuments((prev) => ({
                        ...prev,
                        [response.document!.sysno]: response.document!,
                    }));
                }
                if (
                    response.document &&
                    response.document.sysno in multipleIssuesDocuments
                ) {
                    setMultipleIssuesDocuments((prev) => ({
                        ...prev,
                        [response.document!.sysno]: {
                            ...(prev[response.document!.sysno] || {}),
                            ...response.document,
                        },
                    }));
                }

                setResponses((prev) => [...prev, response]);
            } catch (error) {
                console.error(`Error while accepting input: ${error}`);
            } finally {
                setProcessedCount((prev) => prev + 1);
            }
        },
        [settings, responses, setResponses, multipleIssuesDocuments]
    );

    const addDocuments = useCallback(
        async (identifiers: IdentifierWithSettings[]) => {
            try {
                setTotalCount((prev) => prev + identifiers.length);

                const responses = await Promise.all(
                    identifiers.map(async (identifier) => {
                        const response = await api.insertDocument(
                            {
                                identifier_type: identifier.identifier_type,
                                value: identifier.value,
                            },
                            identifier.categoryId,
                            false
                        );

                        // Update processed count immediately after each insertion
                        setProcessedCount((prev) => prev + 1);

                        return response.data;
                    })
                );

                setMultipleIssuesDocuments((prev) => ({
                    ...prev,
                    ...responses
                        .filter(
                            (response) =>
                                response.status ===
                                AddDocumentResponseStatus.MultipleIssues
                        )
                        .reduce((acc, response) => {
                            acc[response.document!.sysno] = response.document!;
                            return acc;
                        }, {} as Record<string, CatalogDocumentResponse>),
                }));

                setResponses((prev) => [...prev, ...responses]);
            } catch (error) {
                console.error(`Error while accepting input: ${error}`);
            } finally {
                setProcessedCount((prev) => prev + 1);
            }
        },
        [
            setTotalCount,
            setMultipleIssuesDocuments,
            setResponses,
            setProcessedCount,
        ]
    );

    const resetResponses = useCallback(() => {
        setProcessedCount(0);
        setTotalCount(0);
        setResponses([]);
        setMultipleIssuesDocuments({});
    }, []);

    return {
        processedCount,
        totalCount,
        responses,
        multipleIssuesDocuments,
        addDocument,
        addDocuments,
        resetResponses,
    };
};

export default useAddDocuments;
export type { AddDocumentsInjectorProps };
