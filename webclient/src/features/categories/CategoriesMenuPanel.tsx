import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { SelectButton } from "primereact/selectbutton";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import CategoryPicker from "../../components/pickers/CategoryPicker";
import { NodeType } from "../../contexts/categories/CategoryNodeType";
import ExtractionPicker from "../../components/pickers/ExtractionPicker";

interface CategoriesMenuPanelProps {}

const CategoriesMenuPanel: React.FC<CategoriesMenuPanelProps> = (props) => {
    const { t } = useTranslation();
    const {
        categoryNodes,
        handleFocusRootNode,
        activeLevel,
        handleFocusLevel,
        handleFocusCategory,
        focusAssignable,
        handleFocusAssignableCategories,
    } = useCategoryNodes();
    const { extractionId, setExtractionId, extractionMarked } = useCategories();

    const levelOptions = [0, 1, 2, 3];

    const [selectedCategory, setSelectedCategory] = useState<number | null>(
        null
    );

    useEffect(() => {
        if (categoryNodes && categoryNodes.length > 0) {
            const node = categoryNodes[0];
            setSelectedCategory(
                node.type === NodeType.Root || node.type === NodeType.LevelRoot
                    ? null
                    : node.category.id
            );
        }
    }, [categoryNodes]);

    const floatingPanelStyle: React.CSSProperties = {
        position: "fixed",
        top: "70px",
        left: "20px",
        zIndex: "1000",
        boxShadow: "0px 0px 10px 0px rgba(0,0,0,0.35)",
        margin: "0px",
        padding: "0px",
    };

    return (
        <div
            className="flex flex-column bg-white p-1"
            style={floatingPanelStyle}
        >
            <Button
                className="m-0 text-800"
                text
                icon="pi pi-eye"
                label={t("All categories")}
                onClick={() => handleFocusRootNode()}
            />
            <Divider className="m-0" />
            <div className="flex flex-column gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Categories of level")}:
                </span>
                <SelectButton
                    options={levelOptions}
                    value={activeLevel}
                    onChange={(e) => handleFocusLevel(e.value)}
                />
            </div>
            <Divider className="m-0" />
            <div className="flex flex-column gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Selected category")}:
                </span>
                <CategoryPicker
                    className={
                        selectedCategory ? "border-primary border-3" : ""
                    }
                    category_id={selectedCategory}
                    callback={handleFocusCategory}
                />
            </div>
            <Divider className="m-0" />
            <Button
                className={
                    focusAssignable
                        ? "m-0 text-800 border-yellow-500 bg-yellow-500"
                        : "m-0 text-800"
                }
                text={!focusAssignable}
                icon={focusAssignable ? "pi pi-star-fill" : "pi pi-star"}
                label={t("Assignable categories")}
                onClick={() => handleFocusAssignableCategories()}
            />
            <Divider className="m-0" />
            <Divider className="m-0 pt-2" />
            <div className="flex flex-column gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Show extraction")}:
                </span>
                <ExtractionPicker
                    extraction_id={extractionId}
                    callback={setExtractionId}
                />
            </div>
            {extractionId && (
                <div className="mx-2 w-13rem">
                    {extractionMarked && (
                        <span className="font-bold">
                            {t(
                                "Documents are no longer included in the categories"
                            )}
                        </span>
                    )}
                    {!extractionMarked && (
                        <div className="font-bold text-left">
                            {t(
                                "Documents are still included in the categories"
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CategoriesMenuPanel;
