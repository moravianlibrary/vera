import React from "react";
import { useTranslation } from "react-i18next";
import { ActionType } from "../../types/ActionType";
import SubNavigationButtonGroup from "./SubNavigationButtonGroup";

interface SubNavigationAccessProps {}

const SubNavigationAccess: React.FC<SubNavigationAccessProps> = () => {
    const { t } = useTranslation("navigation");

    return (
        <SubNavigationButtonGroup
            navigationButtons={[
                {
                    label: t("departments"),
                    to: "/access-management/departments",
                    action: ActionType.EditAccess,
                },
                {
                    label: t("roles"),
                    to: "/access-management/roles",
                    action: ActionType.EditAccess,
                },
            ]}
        />
    );
};

export default SubNavigationAccess;
