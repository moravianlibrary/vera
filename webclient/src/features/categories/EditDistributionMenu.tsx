import React, { useEffect, useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { useTranslation } from "react-i18next";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import LabeledComponent from "../../components/LabeledComponent";
import { InputNumber } from "primereact/inputnumber";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { Button } from "primereact/button";

interface EditDistributionMenuProps {}

const EditDistributionMenu: React.FC<EditDistributionMenuProps> = () => {
    const { t } = useTranslation();
    const { editDistribution, setEditDistribution } = useCategoryModels();

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(editDistribution !== null);
    }, [editDistribution]);

    return (
        <Sidebar
            visible={visible}
            onHide={() => setEditDistribution(null)}
            position="bottom"
            className="h-min"
        >
            {editDistribution && (
                <DistributionForm
                    category={editDistribution}
                    onHide={() => setEditDistribution(null)}
                />
            )}
        </Sidebar>
    );
};

interface DistributionFormProps {
    category: CategoryModel;
    onHide: () => void;
}

const DistributionForm: React.FC<DistributionFormProps> = ({
    category,
    onHide,
}) => {
    const { t } = useTranslation();
    const { saveDistribution } = useCategoryModels();

    return (
        <div className="flex flex-column gap-2">
            <LabeledComponent label={t("Change distribution for category")}>
                <span className="font-bold">{category.name}</span>
            </LabeledComponent>
            {category.children.map((child, index) => (
                <LabeledComponent key={index} label={child.name}>
                    <div className="p-inputgroup">
                        <InputNumber
                            autoFocus={index === 0}
                            size={3}
                            value={child.percentage}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    child.setPercentage(
                                        parseFloat(
                                            (e.target as HTMLInputElement).value
                                        )
                                    );
                                    if (
                                        index ===
                                        category.children.length - 1
                                    ) {
                                        saveDistribution();
                                    }
                                }
                            }}
                            onChange={(e) => child.setPercentage(e.value)}
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
                    label={t("Save")}
                    icon="pi pi-save"
                    outlined
                    severity="success"
                    onClick={() => {
                        saveDistribution();
                    }}
                />
                <Button
                    label={t("Cancel")}
                    icon="pi pi-times"
                    outlined
                    severity="danger"
                    onClick={() => {
                        saveDistribution();
                    }}
                />
            </div>
        </div>
    );
};

export default EditDistributionMenu;
