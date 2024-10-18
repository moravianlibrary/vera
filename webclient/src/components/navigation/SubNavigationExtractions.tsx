import React from "react";
import { useTranslation } from "react-i18next";
import { ActionType } from "../../types/ActionType";
import SubNavigationButtonGroup from "./SubNavigationButtonGroup";

interface SubNavigationExtractionsProps {}

const SubNavigationExtractions: React.FC<
    SubNavigationExtractionsProps
> = () => {
    const { t } = useTranslation("navigation");

    return (
        <SubNavigationButtonGroup
            navigationButtons={[
                {
                    label: t("extractions"),
                    to: "/extractions",
                    action: ActionType.Extract,
                },
                {
                    label: t("digitization-lists"),
                    to: "/extractions/digitization-lists",
                    action: ActionType.Extract,
                },
                {
                    label: t("locations"),
                    to: "/extractions/locations",
                    action: ActionType.Extract,
                },
            ]}
        />
    );
};

export default SubNavigationExtractions;
