import { useCallback, useEffect, useState } from "react";
import {
    CatalogDocumentResponse,
    CatalogIssueResponse,
    Identifier,
} from "../../adapters/ApiDocuments";
import { IssuanceType } from "../../types/IssuanceType";
import { IdentifierType } from "../../types/IdentifierType";

interface SelectIssuesInjectorProps {
    totalCountIssuesDocuments: number;
    currIndex: number;
    currIssuesDocument: CatalogDocumentResponse | null;
    nextIssuesDocument: CatalogDocumentResponse | null;
    prevIssuesDocument: CatalogDocumentResponse | null;

    creatingIssues: CatalogIssueResponse[];
    editions: CatalogIssueResponse[];
    volumes: CatalogIssueResponse[];
    bundles: CatalogIssueResponse[];

    createIssue: (issue: CatalogIssueResponse) => void;
    goToNextDocument: () => void;
    goToPrevDocument: () => void;
    reset: () => void;
}

const naturalSort = (a, b) => {
    if (a === null) {
        return -1;
    }
    if (b === null) {
        return 1;
    }
    if (a === b) {
        return 0;
    }

    const numA = parseInt(a);
    const numB = parseInt(b);

    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const charCodeA = a.charCodeAt(i);
        const charCodeB = b.charCodeAt(i);

        if (!isNaN(charCodeA) && !isNaN(charCodeB)) {
            if (charCodeA !== charCodeB) {
                return charCodeA - charCodeB;
            }
        } else {
            return charCodeA - charCodeB;
        }
    }

    return a.length - b.length;
};

const useIssuesSelection = (
    multipleIssuesDocuments: CatalogDocumentResponse[],
    addDocument: (identifier: Identifier) => void
) => {
    const [totalCountIssuesDocuments, setTotalCountIssuesDocuments] =
        useState<number>(0);
    const [currIndex, setCurrIndex] = useState<number>(0);
    const [currIssuesDocument, setCurrIssuesDocument] =
        useState<CatalogDocumentResponse | null>(null);
    const [nextIssuesDocument, setNextIssuesDocument] =
        useState<CatalogDocumentResponse | null>(null);
    const [prevIssuesDocument, setPrevIssuesDocument] =
        useState<CatalogDocumentResponse | null>(null);
    const [creatingIssues, setCreatingIssues] = useState<
        CatalogIssueResponse[]
    >([]);
    const [editions, setEditions] = useState<CatalogIssueResponse[]>([]);
    const [volumes, setVolumes] = useState<CatalogIssueResponse[]>([]);
    const [bundles, setBundles] = useState<CatalogIssueResponse[]>([]);

    const chooseIssuesForDocument = useCallback(() => {
        setCurrIndex(currIndex);
        setCurrIssuesDocument(multipleIssuesDocuments[currIndex]);
        setNextIssuesDocument(multipleIssuesDocuments[currIndex + 1] || null);
        setPrevIssuesDocument(multipleIssuesDocuments[currIndex - 1] || null);

        const issues = multipleIssuesDocuments[currIndex].issues!;
        setEditions(
            issues
                .filter((issue) => issue.issuance_type === IssuanceType.Unit)
                .sort((a, b) => naturalSort(a.barcode, b.barcode))
        );
        setVolumes(
            issues
                .filter((issue) => issue.issuance_type === IssuanceType.Volume)
                .sort((a, b) => {
                    let value = naturalSort(a.volume, b.volume);
                    if (value === 0) {
                        value = naturalSort(a.volume_year, b.volume_year);
                    }
                    return value;
                })
        );
        setBundles(
            issues
                .filter((issue) => issue.issuance_type === IssuanceType.Bundle)
                .sort((a, b) => {
                    let value = naturalSort(a.volume, b.volume);
                    if (value === 0) {
                        value = naturalSort(a.volume_year, b.volume_year);
                    }
                    if (value === 0) {
                        value = naturalSort(a.bundle, b.bundle);
                    }
                    return value;
                })
        );
    }, [
        multipleIssuesDocuments,
        currIndex,
        setCurrIndex,
        setCurrIssuesDocument,
        setNextIssuesDocument,
        setPrevIssuesDocument,
        setEditions,
        setVolumes,
        setBundles,
    ]);

    const createIssue = useCallback(
        async (issue: CatalogIssueResponse) => {
            setCreatingIssues([...creatingIssues, issue]);
            await addDocument({
                identifier_type: IdentifierType.Barcode,
                value: issue.barcode!,
            });
            setCreatingIssues(creatingIssues.filter((i) => i !== issue));
        },
        [addDocument, creatingIssues, setCreatingIssues]
    );

    const goToNextDocument = useCallback(() => {
        if (currIndex < multipleIssuesDocuments.length - 1) {
            setCurrIndex(currIndex + 1);
        }
    }, [currIndex, multipleIssuesDocuments, chooseIssuesForDocument]);

    const goToPrevDocument = useCallback(() => {
        if (currIndex > 0) {
            setCurrIndex(currIndex - 1);
        }
    }, [currIndex, chooseIssuesForDocument]);

    const reset = useCallback(() => {
        setCurrIndex(0);
        setCurrIssuesDocument(null);
        setNextIssuesDocument(null);
        setPrevIssuesDocument(null);
        setEditions([]);
        setVolumes([]);
        setBundles([]);
    }, []);

    useEffect(() => {
        if (multipleIssuesDocuments.length > 0) {
            setTotalCountIssuesDocuments(multipleIssuesDocuments.length);
            chooseIssuesForDocument();
        }
    }, [multipleIssuesDocuments, chooseIssuesForDocument]);

    return {
        totalCountIssuesDocuments,
        currIndex,
        currIssuesDocument,
        nextIssuesDocument,
        prevIssuesDocument,

        creatingIssues,
        editions,
        volumes,
        bundles,

        createIssue,
        goToNextDocument,
        goToPrevDocument,
        reset,
    };
};

export default useIssuesSelection;
export type { SelectIssuesInjectorProps };
