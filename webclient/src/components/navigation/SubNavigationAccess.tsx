import React from "react";
import { useTranslation } from "react-i18next";
import { ActionType } from "../../types/ActionType";
import NavigationButtonGroup from "./NavigationButtonGroup";

interface SubNavigationAccessProps {}

const SubNavigationAccess: React.FC<SubNavigationAccessProps> = () => {
    const { t } = useTranslation("navigation");

    return (
        <NavigationButtonGroup
            navigationButtons={[
                {
                    label: t("departments"),
                    to: "/departments",
                    action: ActionType.EditAccess,
                },
                {
                    label: t("roles"),
                    to: "/roles",
                    action: ActionType.EditAccess,
                },
            ]}
        />
    );
};

export default SubNavigationAccess;
