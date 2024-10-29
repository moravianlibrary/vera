import { useCallback, useState } from "react";
import ApiDocuments, {
    AddDocumentResponse,
    CatalogDocumentResponse,
    Identifier,
    IdentifierWithAttributes,
} from "../../adapters/ApiDocuments";
import { AddDocumentsSettings } from "./InsertDocumentsContext";

interface AddDocumentsInjectorProps {
    processedCount: number;
    totalCount: number;
    responses: AddDocumentResponse[];
    multipleIssuesDocuments: Record<string, CatalogDocumentResponse>;
    addDocument: (identifier: IdentifierWithAttributes) => void;
    addDocuments: (identifiers: IdentifierWithAttributes[]) => void;
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
        async (identifier: IdentifierWithAttributes) => {
            try {
                await api.insertDocument(identifier);
            } catch (error) {
                console.error(`Error while accepting input: ${error}`);
            }
        },
        [settings, setResponses, multipleIssuesDocuments, api]
    );

    const addDocuments = useCallback(
        async (identifiers: IdentifierWithAttributes[]) => {
            try {
                await api.insertDocument(identifiers);
            } catch (error) {
                console.error(`Error while accepting input: ${error}`);
            }
        },
        [
            setTotalCount,
            setMultipleIssuesDocuments,
            setResponses,
            setProcessedCount,
            api,
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
