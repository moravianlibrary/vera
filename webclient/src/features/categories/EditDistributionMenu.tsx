import React, { useEffect, useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { useTranslation } from "react-i18next";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import LabeledComponent from "../../components/wrappers/LabeledComponent";
import { InputNumber } from "primereact/inputnumber";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { Button } from "primereact/button";
import {
    ChildDistribution,
    ParentDistribution,
} from "../../adapters/ApiCategories";
import { useIntentions } from "../../contexts/categories/IntentionsContext";

interface EditDistributionMenuProps {}

const EditDistributionMenu: React.FC<EditDistributionMenuProps> = () => {
    const { editDistribution, setEditDistribution } = useCategoryModels();
    const { activeIntention } = useIntentions();

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(editDistribution !== null);
    }, [editDistribution]);

    if (!activeIntention) {
        return null;
    }

    return (
        <Sidebar
            visible={visible}
            onHide={() => setEditDistribution(null)}
            position="bottom"
            className="h-min"
        >
            {editDistribution && (
                <DistributionForm
                    intentionId={activeIntention.id}
                    category={editDistribution}
                    onHide={() => setEditDistribution(null)}
                />
            )}
        </Sidebar>
    );
};

interface DistributionFormProps {
    intentionId: number;
    category: CategoryModel;
    onHide: () => void;
}

const DistributionForm: React.FC<DistributionFormProps> = ({
    intentionId,
    category,
    onHide,
}) => {
    const { t } = useTranslation("categories");
    const { saveDistribution, setEditDistribution } = useCategoryModels();

    const [distributions, setDistributions] = useState<ChildDistribution[]>(
        category.sub_categories.map((child) => {
            return { category_id: child.id, percentage: child.percentage ?? 0 };
        })
    );

    const changePercentage = (index: number, percentage: number) => {
        setDistributions(
            distributions.map((p, i) =>
                i === index
                    ? { category_id: p.category_id, percentage: percentage }
                    : p
            )
        );
    };

    const handleSaveDistribution = () => {
        const parentDistribution: ParentDistribution = {
            intention_id: intentionId,
            distributions: distributions,
        };
        saveDistribution(parentDistribution);
    };

    return (
        <div className="flex flex-column gap-2">
            <LabeledComponent label={t("actions.edit-distribution")}>
                <span className="font-bold">{category.name}</span>
            </LabeledComponent>
            {category.sub_categories.map((child, index) => (
                <LabeledComponent key={index} label={child.name}>
                    <div className="p-inputgroup">
                        <InputNumber
                            autoFocus={index === 0}
                            size={3}
                            value={child.percentage}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    if (
                                        index ===
                                        category.sub_categories.length - 1
                                    ) {
                                        handleSaveDistribution();
                                    }
                                }
                            }}
                            onChange={(e) =>
                                changePercentage(index, e.value as number)
                            }
                            min={0}
                            max={100}
                            maxFractionDigits={2}
                        />
                        <span className="p-inputgroup-addon">%</span>
                    </div>
                </LabeledComponent>
            ))}
            <div className="flex gap-4">
                <Button
                    label={t("save", { ns: "app" })}
                    icon="pi pi-save"
                    outlined
                    severity="success"
                    onClick={handleSaveDistribution}
                />
                <Button
                    label={t("cancel", { ns: "app" })}
                    icon="pi pi-times"
                    outlined
                    severity="danger"
                    onClick={() => setEditDistribution(null)}
                />
            </div>
        </div>
    );
};

export default EditDistributionMenu;
