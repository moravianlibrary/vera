import { Button } from "primereact/button";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Toolbar } from "primereact/toolbar";
import { useIntentions } from "../../contexts/categories/IntentionsContext";
import EditIntentionMenu, {
    EditIntentionMenuRef,
} from "./components/EditIntentionMenu";
import IntentionFactory from "../../data/factories/IntentionFactory";
import CategoriesDisplayOptions from "./components/toolbar/CategoriesDisplayOptions";
import IntentionsDisplayOptions from "./components/toolbar/IntentionDisplayOptions";
import DepartmentsDisplayOptions from "./components/toolbar/DepartmentsDisplayOptions";
import SelectCategoryView from "./components/toolbar/SelectCategoryView";
import { ActionAccessComponent } from "../../services/AccessService";
import { ActionType } from "../../types/ActionType";

export enum CategoryViewType {
    CategoryTable = "CategoryTable",
    CategoryChart = "CategoryChart",
    Intentions = "Intentions",
}

interface CategoriesToolbarProps {
    categoryView: CategoryViewType;
    onCategoryViewChange: (viewType: CategoryViewType) => void;
}

const CategoriesToolbar: React.FC<CategoriesToolbarProps> = ({
    categoryView,
    onCategoryViewChange,
}) => {
    return (
        <Toolbar
            className="p-2 surface-100 w-full"
            start={
                categoryView === CategoryViewType.Intentions ? (
                    <IntentionsOptions />
                ) : (
                    <CategoryOptions />
                )
            }
            end={
                <SelectCategoryView
                    categoryView={categoryView}
                    onCategoryViewChange={onCategoryViewChange}
                />
            }
        />
    );
};

interface CategoryOptionsProps {}

const CategoryOptions: React.FC<CategoryOptionsProps> = ({}) => {
    const { t } = useTranslation();

    return (
        <div className="flex ml-2 gap-4 flex-wrap">
            <InplaceOptions label={t("Categories display options")}>
                <CategoriesDisplayOptions />
            </InplaceOptions>
            <InplaceOptions label={t("Intentions display options")}>
                <IntentionsDisplayOptions />
            </InplaceOptions>
            <ActionAccessComponent action={ActionType.ReadCategoriesAll}>
                <InplaceOptions label={t("Departments display options")}>
                    <DepartmentsDisplayOptions />
                </InplaceOptions>
            </ActionAccessComponent>
        </div>
    );
};

interface IntentionsOptionsProps {}

const IntentionsOptions: React.FC<IntentionsOptionsProps> = () => {
    const { t } = useTranslation();
    const { createIntention } = useIntentions();

    const editIntentionRef = useRef<EditIntentionMenuRef>(null);

    return (
        <div className="flex ml-2 gap-4 flex-wrap">
            <EditIntentionMenu
                ref={editIntentionRef}
                intention={IntentionFactory.createEmpty()}
                callback={createIntention}
            />
            <Button
                className="m-0 text-800"
                icon="pi pi-plus"
                text
                label={t("Add intention")}
                onClick={() => editIntentionRef.current?.toggle()}
            />
        </div>
    );
};

interface InplaceOptionsProps {
    label: string;
    children: React.ReactNode;
}

const InplaceOptions: React.FC<InplaceOptionsProps> = ({ label, children }) => {
    const [contentVisible, setContentVisible] = useState(false);

    if (!contentVisible) {
        return (
            <div className="flex align-items-center">
                <Button
                    className="text-gray-700"
                    icon="pi pi-angle-double-right"
                    label={label}
                    text
                    onClick={() => setContentVisible(true)}
                />
            </div>
        );
    }

    return (
        <div className="flex align-items-center border-round border-1 border-300 p-2">
            <Button
                className="text-gray-700"
                icon="pi pi-angle-double-left"
                text
                onClick={() => setContentVisible(false)}
            />
            {children}
        </div>
    );
};

export default CategoriesToolbar;
