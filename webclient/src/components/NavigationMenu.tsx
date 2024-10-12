import React, { useRef } from "react";
import { Menubar } from "primereact/menubar";
import { useAccess } from "../contexts/AccessContext";
import { useTranslation } from "react-i18next";
import { ActionType } from "../types/ActionType";
import Login from "./Login";
import { useNavigate } from "react-router-dom";
import { Toolbar } from "primereact/toolbar";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import ActionAccessComponent from "./access/ActionAccessComponent";
import { SplitButton } from "primereact/splitbutton";

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
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="card flex gap-2 flex-wrap">
            <Button className="p-0" text onClick={() => navigate("/")}>
                <img src="/logo32.svg" />
            </Button>
            <ActionAccessComponent action={ActionType.ReadDatatable}>
                <Button
                    className="text-gray-700"
                    label={t("Documents")}
                    icon="pi pi-book"
                    text
                    onClick={() => navigate("/documents")}
                />
            </ActionAccessComponent>
            <ActionAccessComponent action={ActionType.ReadCatalogRecords}>
                <Button
                    className="text-gray-700"
                    label={t("Catalog records")}
                    icon="pi pi-server"
                    text
                    onClick={() => navigate("/catalog-records")}
                />
            </ActionAccessComponent>
            <ActionAccessComponent action={ActionType.ReadDatatable}>
                <Button
                    className="text-gray-700"
                    label={t("Categories")}
                    icon="pi pi-tags"
                    text
                    onClick={() => navigate("/categories")}
                />
            </ActionAccessComponent>
            <ActionAccessComponent action={ActionType.Extract}>
                <Button
                    className="text-gray-700"
                    label={t("Extractions")}
                    icon="pi pi-receipt"
                    text
                    onClick={() => navigate("/extractions")}
                />
            </ActionAccessComponent>
            <ActionAccessComponent action={ActionType.PlanTasks}>
                <Button
                    className="text-gray-700"
                    label={t("Tasks")}
                    icon="pi pi-play-circle"
                    text
                    onClick={() => navigate("/tasks")}
                />
            </ActionAccessComponent>
            <ActionAccessComponent action={ActionType.EditAccess}>
                {/* <AccessMenu /> */}
                <Button
                    className="text-gray-700"
                    label={t("Access management")}
                    icon="pi pi-user-edit"
                    text
                    onClick={(event) => navigate("/access")}
                />
            </ActionAccessComponent>
        </div>
    );
};

interface AccessMenuProps {}

const AccessMenu: React.FC<AccessMenuProps> = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const menuRef = useRef<Menu | null>(null);

    const items = [
        {
            label: t("Roles"),
            command: () => navigate("/access?tab=roles"),
        },
        {
            label: t("Departments"),
            command: () => navigate("/access?tab=departments"),
        },
    ];
    return (
        <div>
            <Button
                label={t("Access management")}
                icon="pi pi-user-edit"
                text
                onClick={(event) => menuRef.current!.toggle(event)}
            />
            <Menu ref={menuRef} model={items} popup />
        </div>
    );
};

const NavigationMenuEnd = () => {
    return <Login />;
};

export default NavigationMenu;
