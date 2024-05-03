import React, { ReactNode, createContext, useContext, useState } from "react";
import { DocumentsQuery } from "../../../adapters/ApiDocuments";
import { SearchGroup, SearchGroupParams } from "./SearchNodes";
import ApiGeneratedExtractions from "../../../adapters/ApiGeneratedExtractions";
import ApiDigitizationExtractions from "../../../adapters/ApiDigitizationExtractions";
import ApiTasks from "../../../adapters/ApiTasks";

interface DocumentsQueryContextProps {
    query: DocumentsQuery;
    queryAll: () => void;
    isQueryAll: boolean;

    categoryIds: number[];
    searchByCategoryIds: (categoryId: number[]) => void;
    taskId: number | null;
    searchByTaskId: (taskId: number | null) => void;
    extractionId: number | null;
    searchByExtractionId: (extractionId: number | null) => void;
    digitizationListId: number | null;
    searchByDigitizationListId: (digitizationListId: number | null) => void;

    searchPhrase: string | null;
    searchBySearchPhrase: (searchPhrase: string) => void;

    searchGroup: SearchGroupParams | null;
    searchBySearchGroup: (searchGroup: SearchGroupParams) => void;
}

interface DocumentsQueryProviderProps {
    children: ReactNode;
}

const DocumentsQueryContext = createContext<
    DocumentsQueryContextProps | undefined
>(undefined);

export const DocumentsQueryProvider: React.FC<DocumentsQueryProviderProps> = ({
    children,
}) => {
    const [query, setQuery] = useState<DocumentsQuery>({});
    const [isQueryAll, setIsQueryAll] = useState(false);

    const [categoryIds, setCategoryIds] = useState<number[]>([]);
    const [taskId, setTaskId] = useState<number | null>(null);
    const [extractionId, setExtractionId] = useState<number | null>(null);
    const [digitizationListId, setDigitizationListId] = useState<number | null>(
        null
    );

    const [searchPhrase, setSearchPhrase] = useState<string | null>(null);
    const [searchGroup, setSearchGroup] = useState<SearchGroupParams | null>(
        null
    );

    const queryAll = () => {
        setIsQueryAll(true);
        setQuery({});
        setCategoryIds([]);
        setTaskId(null);
        setExtractionId(null);
        setDigitizationListId(null);
        setSearchPhrase(null);
        setSearchGroup(null);
    };

    const searchByCategoryIds = (categoryIds: number[]) => {
        if (categoryIds.length === 0) {
            queryAll();
            return;
        }
        setCategoryIds(categoryIds);
        setIsQueryAll(false);
        setQuery({
            search_group: SearchGroup.createCategoryIdSearch(categoryIds),
        });
    };

    const searchByTaskId = (taskId: number | null) => {
        if (taskId === null) {
            queryAll();
            return;
        }
        ApiTasks.getTaskDocuments(taskId).then((response) => {
            setTaskId(taskId);
            setIsQueryAll(false);
            setQuery({
                id_list: response.data.map((d) => d.document_id),
            });
        });
    };

    const searchByExtractionId = (extractionId: number | null) => {
        if (extractionId === null) {
            queryAll();
            return;
        }
        ApiGeneratedExtractions.getExtraction(extractionId).then((response) => {
            setExtractionId(extractionId);
            setIsQueryAll(false);
            setQuery({
                id_list: response.data.document_ids,
            });
        });
    };

    const searchByDigitizationListId = (digitizationListId: number | null) => {
        if (digitizationListId === null) {
            queryAll();
            return;
        }
        ApiDigitizationExtractions.getExtraction(digitizationListId).then(
            (response) => {
                setDigitizationListId(digitizationListId);
                setIsQueryAll(false);
                setQuery({
                    id_list: response.data.document_ids,
                });
            }
        );
    };

    const searchBySearchPhrase = (searchPhrase: string) => {
        setSearchPhrase(searchPhrase);
        setIsQueryAll(false);
        setQuery({ search_phrase: searchPhrase });
    };

    const searchBySearchGroup = (searchGroup: SearchGroupParams) => {
        setSearchGroup(searchGroup);
        setIsQueryAll(false);
        setQuery({ search_group: searchGroup });
    };

    const contextValue: DocumentsQueryContextProps = {
        query,
        queryAll,
        isQueryAll,
        categoryIds,
        searchByCategoryIds,
        taskId,
        searchByTaskId,
        extractionId,
        searchByExtractionId,
        digitizationListId,
        searchByDigitizationListId,
        searchPhrase,
        searchBySearchPhrase,
        searchGroup,
        searchBySearchGroup,
    };

    return (
        <DocumentsQueryContext.Provider value={contextValue}>
            {children}
        </DocumentsQueryContext.Provider>
    );
};

export const useDocumentsQuery = (): DocumentsQueryContextProps => {
    const context = useContext(DocumentsQueryContext);

    if (!context) {
        throw new Error(
            "useDocumentsQuery must be used within a DocumentsQueryProvider"
        );
    }

    return context;
};
