import React from "react";
import { useTranslation } from "react-i18next";
import { ActionType } from "../types/ActionType";
import Login from "./Login";
import { Toolbar } from "primereact/toolbar";
import NavigationButtonGroup from "./navigation/NavigationButtonGroup";

interface NavigationMenuProps {}

const NavigationMenu: React.FC<NavigationMenuProps> = () => {
    return (
        <div className="navbar">
            <Toolbar
                className="p-2"
                style={{ backgroundColor: "#ebedef" }}
                start={NavigationMenuStart}
                end={NavigationMenuEnd}
            />
        </div>
    );
};

const NavigationMenuStart = () => {
    const { t } = useTranslation("navigation");

    return (
        <NavigationButtonGroup
            navigationButtons={[
                {
                    to: "/",
                    imageSource: "/logo32.svg",
                },
                {
                    label: t("documents"),
                    icon: "pi pi-book",
                    to: "/documents",
                    action: ActionType.ReadDatatable,
                },
                {
                    label: t("catalog-records"),
                    icon: "pi pi-server",
                    to: "/catalog-records",
                    action: ActionType.ReadCatalogRecords,
                },
                {
                    label: t("categories"),
                    icon: "pi pi-tags",
                    to: "/categories",
                    action: ActionType.ReadDatatable,
                },
                {
                    label: t("extractions"),
                    icon: "pi pi-receipt",
                    to: "/extractions",
                    action: ActionType.Extract,
                },
                {
                    label: t("tasks"),
                    icon: "pi pi-play-circle",
                    to: "/tasks",
                    action: ActionType.PlanTasks,
                },
                {
                    label: t("access-management"),
                    icon: "pi pi-user-edit",
                    to: "/access-management/departments",
                    action: ActionType.EditAccess,
                },
            ]}
        />
    );
};

const NavigationMenuEnd = () => {
    return <Login />;
};

export default NavigationMenu;
