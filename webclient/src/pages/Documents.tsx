import React, { useEffect, useState } from "react";

import "../styles/Documents.css";
import { Dialog } from "primereact/dialog";
import InsertDocuments from "../features/insert-documents/InsertDocuments";
import DocumentsHeader, {
    TableViewType,
} from "../features/documents/DocumentsHeader";
import DocumentsTable from "../features/documents/DocumentsTable";
import { DocumentsProvider } from "../contexts/documents/DocumentsContext";
import { useSearchParams } from "react-router-dom";
import ApiCategories, { Category } from "../adapters/ApiCategories";
import { DigitizationListsProvider } from "../contexts/extractions/DigitizationListsContext";
import { DigitizationListsManagerProvider } from "../contexts/extractions/DigitizationListsManagerContext";
import {
    DocumentsQueryProvider,
    useDocumentsQuery,
} from "../contexts/documents/search/DocumentsQueryContext";
import { DocumentsSelectionProvider } from "../contexts/documents/DocumentsSelectionContext";
import { DocumentsActionsProvider } from "../contexts/documents/DocumentsActionsContext";
import { AdvancedSearchProvider } from "../contexts/documents/search/AdvancedSearchContext";
import { CategoriesProvider } from "../contexts/categories/CategoriesContext";
import { GeneratedExtractionsProvider } from "../contexts/extractions/GeneratedExtractionsContext";
import { LocationsProvider } from "../contexts/extractions/locations/LocationsContext";
import { IntentionsProvider } from "../contexts/categories/IntentionsContext";

const Documents: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [extractionId, setExtractionId] = useState<number | null>(null);
    const [digitizationListId, setDigitizationListId] = useState<number | null>(
        null
    );
    const [categoryIds, setCategoryIds] = useState<number[]>([]);

    const handleSetCategoryIds = (categoryId: number) => {
        ApiCategories.getCategories()
            .then((response) => {
                const flattenCategoryIds: number[] = [];
                const traverseCategories = (
                    category: Category,
                    found = false
                ) => {
                    if (found || categoryId === category.id) {
                        flattenCategoryIds.push(category.id);
                    }
                    if (
                        category.sub_categories &&
                        category.sub_categories.length > 0
                    ) {
                        category.sub_categories.forEach(
                            (childCategory: any) => {
                                traverseCategories(
                                    childCategory,
                                    found || categoryId === category.id
                                );
                            }
                        );
                    }
                };
                response.data.forEach((category: Category) => {
                    traverseCategories(category, category.id === categoryId);
                });
                setCategoryIds(flattenCategoryIds);
            })
            .catch((error) => {
                console.error(error);
            });
    };

    useEffect(() => {
        if (searchParams.has("extractionId")) {
            setExtractionId(parseInt(searchParams.get("extractionId")!, 10));
        } else if (searchParams.has("digitizationListId")) {
            setDigitizationListId(
                parseInt(searchParams.get("digitizationListId")!, 10)
            );
        } else if (searchParams.has("categoryId")) {
            handleSetCategoryIds(parseInt(searchParams.get("categoryId")!, 10));
        }
        window.history.replaceState(null, "", `${window.location.pathname}`);
    }, [searchParams, setExtractionId]);

    return (
        <div className="table-container">
            <DocumentsQueryProvider>
                <IntentionsProvider>
                    <CategoriesProvider>
                        <DigitizationListsProvider>
                            <LocationsProvider>
                                <GeneratedExtractionsProvider>
                                    <DocumentsProvider>
                                        <DocumentsSelectionProvider>
                                            <DocumentsActionsProvider>
                                                <DigitizationListsManagerProvider>
                                                    <AdvancedSearchProvider>
                                                        <DocumentsDiv
                                                            categoryIds={
                                                                categoryIds
                                                            }
                                                            extractionId={
                                                                extractionId
                                                            }
                                                            digitizationListId={
                                                                digitizationListId
                                                            }
                                                        />
                                                    </AdvancedSearchProvider>
                                                </DigitizationListsManagerProvider>
                                            </DocumentsActionsProvider>
                                        </DocumentsSelectionProvider>
                                    </DocumentsProvider>
                                </GeneratedExtractionsProvider>
                            </LocationsProvider>
                        </DigitizationListsProvider>
                    </CategoriesProvider>
                </IntentionsProvider>
            </DocumentsQueryProvider>
        </div>
    );
};

interface DocumentsDivProps {
    categoryIds: number[];
    extractionId: number | null;
    digitizationListId: number | null;
}

const DocumentsDiv: React.FC<DocumentsDivProps> = ({
    categoryIds,
    extractionId,
    digitizationListId,
}) => {
    const {
        searchByCategoryIds,
        searchByExtractionId,
        searchByDigitizationListId,
    } = useDocumentsQuery();

    const [insertMode, setInsertMode] = useState(false);
    const [createMode, setCreateMode] = useState(false);
    const [tableViewType, setTableViewType] = useState<TableViewType>(
        TableViewType.DatatableVisual
    );

    useEffect(() => {
        searchByCategoryIds(categoryIds);
        if (extractionId !== null) {
            searchByExtractionId(extractionId);
        } else if (digitizationListId !== null) {
            searchByDigitizationListId(digitizationListId);
        }
    }, [categoryIds, extractionId, digitizationListId]);

    return (
        <div>
            <DocumentsHeader
                onInsert={() => setInsertMode(true)}
                onCreate={() => setCreateMode(true)}
                tableViewType={tableViewType}
                onTableViewTypeChange={setTableViewType}
            />
            <DocumentsTable tableViewType={tableViewType} />
            <Dialog visible={insertMode} onHide={() => setInsertMode(false)}>
                <InsertDocuments onClose={() => setInsertMode(false)} />
            </Dialog>
        </div>
    );
};

export default Documents;
