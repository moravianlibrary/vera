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

    categoryId: number | null;
    searchByCategoryId: (categoryId: number) => void;
    taskId: number | null;
    searchByTaskId: (taskId: number) => void;
    extractionId: number | null;
    searchByExtractionId: (extractionId: number) => void;
    digitizationListId: number | null;
    searchByDigitizationListId: (digitizationListId: number) => void;

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
    const [isQueryAll, setIsQueryAll] = useState(true);

    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [taskId, setTaskId] = useState<number | null>(null);
    const [extractionId, setExtractionId] = useState<number | null>(null);
    const [digitizationListId, setDigitizationListId] = useState<number | null>(
        null
    );

    const [searchPhrase, setSearchPhrase] = useState<string | null>(null);
    const [searchGroup, setSearchGroup] = useState<SearchGroupParams | null>(
        null
    );

    // const [triggerSearchTimer, setTriggerSearchTimer] = useState<
    //     NodeJS.Timeout | undefined
    // >(undefined);

    const queryAll = () => {
        setIsQueryAll(true);
        setQuery({});
    };

    const searchByCategoryId = (categoryId: number) => {
        setCategoryId(categoryId);
        setQuery({
            search_group: SearchGroup.createCategoryIdSearch([categoryId]),
        });
    };

    const searchByTaskId = (taskId: number) => {
        ApiTasks.getTaskDocuments(taskId).then((response) => {
            setTaskId(taskId);
            setQuery({
                id_list: response.data.map((d) => d.document_id),
            });
        });
    };

    const searchByExtractionId = (extractionId: number) => {
        ApiGeneratedExtractions.getExtraction(extractionId).then((response) => {
            setExtractionId(extractionId);
            setQuery({
                id_list: response.data.document_ids,
            });
        });
    };

    const searchByDigitizationListId = (digitizationListId: number) => {
        ApiDigitizationExtractions.getExtraction(digitizationListId).then(
            (response) => {
                setDigitizationListId(digitizationListId);
                setQuery({
                    id_list: response.data.document_ids,
                });
            }
        );
    };

    const searchBySearchPhrase = (searchPhrase: string) => {
        setSearchPhrase(searchPhrase);
        setQuery({ search_phrase: searchPhrase });
    };

    const searchBySearchGroup = (searchGroup: SearchGroupParams) => {
        setSearchGroup(searchGroup);
        setQuery({ search_group: searchGroup });
    };

    const contextValue: DocumentsQueryContextProps = {
        query,
        queryAll,
        isQueryAll,
        categoryId,
        searchByCategoryId,
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
