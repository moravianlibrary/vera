import React, { useEffect, useRef, useState } from "react";

import "../styles/Documents.css";
import { Dialog } from "primereact/dialog";
import InsertDocuments from "../features/insert-documents/InsertDocuments";
import DocumentsHeader from "../features/documents/DocumentsHeader";
import DocumentsTable from "../features/documents/DocumentsTable";
import { DocumentsProvider } from "../contexts/documents/DocumentsContext";
import { AssignableCategoriesProvider } from "../contexts/categories/AssignableCategoriesContext";
import {
    DocumentsSearchProvider,
    useDocumentsSearch,
} from "../contexts/documents/search/DocumentsSearchContext";
import { useSearchParams } from "react-router-dom";
import ApiCategories, { AssignableCategory } from "../adapters/ApiCategories";
import { DigitizationListsProvider } from "../contexts/extractions/DigitizationListsContext";
import { DigitizationListsManagerProvider } from "../contexts/extractions/DigitizationListsManagerContext";
import { DocumentsQueryProvider } from "../contexts/documents/search/DocumentsQueryContext";
import { DocumentsSelectionProvider } from "../contexts/documents/DocumentsSelectionContext";
import { DocumentsActionsProvider } from "../contexts/documents/DocumentsActionsContext";
import { AdvancedSearchProvider } from "../contexts/documents/search/AdvancedSearchContext";
import { CategoriesProvider } from "../contexts/categories/CategoriesContext";

const Documents: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [extractionId, setExtractionId] = useState<number | null>(null);
    const [digitizationListId, setDigitizationListId] = useState<number | null>(
        null
    );
    const [categoryIds, setCategoryIds] = useState<number[]>([]);

    const handleSetCategoryIds = (categoryId: number) => {
        ApiCategories.getCategory(categoryId)
            .then((response) => {
                const flattenCategoryIds: number[] = [];
                const traverseCategories = (category: AssignableCategory) => {
                    flattenCategoryIds.push(category.id);
                    if (
                        category.children_categories &&
                        category.children_categories.length > 0
                    ) {
                        category.children_categories.forEach(
                            (childCategory: any) => {
                                traverseCategories(childCategory);
                            }
                        );
                    }
                };
                traverseCategories(response.data);
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
                <AssignableCategoriesProvider>
                    <CategoriesProvider>
                        <DigitizationListsProvider>
                            <DocumentsSearchProvider>
                                <DocumentsProvider>
                                    <DocumentsSelectionProvider>
                                        <DocumentsActionsProvider>
                                            <DigitizationListsManagerProvider>
                                                <AdvancedSearchProvider>
                                                    <DocumentsDiv />
                                                </AdvancedSearchProvider>
                                            </DigitizationListsManagerProvider>
                                        </DocumentsActionsProvider>
                                    </DocumentsSelectionProvider>
                                </DocumentsProvider>
                            </DocumentsSearchProvider>
                        </DigitizationListsProvider>
                    </CategoriesProvider>
                </AssignableCategoriesProvider>
            </DocumentsQueryProvider>
        </div>
    );
};

const DocumentsDiv: React.FC = () => {
    const { activeQuery } = useDocumentsSearch();

    const [insertMode, setInsertMode] = useState(false);
    const [createMode, setCreateMode] = useState(false);

    return (
        <div>
            <DocumentsHeader
                onInsert={() => setInsertMode(true)}
                onCreate={() => setCreateMode(true)}
            />
            <DocumentsTable />
            <Dialog visible={insertMode} onHide={() => setInsertMode(false)}>
                <InsertDocuments onClose={() => setInsertMode(false)} />
            </Dialog>
        </div>
    );
};

export default Documents;
