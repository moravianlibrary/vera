import React, { useEffect, useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { useTranslation } from "react-i18next";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import LabeledComponent from "../../components/LabeledComponent";
import { InputNumber } from "primereact/inputnumber";

interface EditDistributionMenuProps {}

const EditDistributionMenu: React.FC<EditDistributionMenuProps> = () => {
    const { t } = useTranslation();
    const { editDistribution, setEditDistribution } = useCategoryNodes();

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
    category: CategoryNode;
    onHide: () => void;
}

const DistributionForm: React.FC<DistributionFormProps> = ({
    category,
    onHide,
}) => {
    const { t } = useTranslation();
    const { saveDistribution } = useCategoryNodes();

    return (
        <div className="flex flex-column gap-2">
            <LabeledComponent label={t("distribution.category.name")}>
                <span>{category.category.name}</span>
            </LabeledComponent>
            {category.children.map((child, index) => (
                <LabeledComponent key={index} label={child.category.name}>
                    <div className="p-inputgroup">
                        <InputNumber
                            autoFocus={index === 0}
                            size={3}
                            value={child.category.percentage}
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
        </div>
    );
};

export default EditDistributionMenu;
