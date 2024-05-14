import React, { useRef } from "react";
import { Menubar } from "primereact/menubar";
import { useUser } from "../contexts/user/UserContext";
import { useTranslation } from "react-i18next";
import { ActionType } from "../types/ActionType";
import Login from "./Login";
import { useNavigate } from "react-router-dom";
import { Toolbar } from "primereact/toolbar";
import { Button } from "primereact/button";
import { ActionAccessComponent } from "../services/AccessService";
import { Menu } from "primereact/menu";

interface NavigationMenuProps {}

const NavigationMenu: React.FC<NavigationMenuProps> = () => {
    const { t } = useTranslation();
    const { user } = useUser();
    const navigate = useNavigate();

    const items = [
        {
            label: "Router",
            icon: "pi pi-palette",
            items: [
                {
                    label: "Styled",
                    url: "/theming",
                },
                {
                    label: "Unstyled",
                    url: "/unstyled",
                },
            ],
        },
        {
            label: "Programmatic",
            icon: "pi pi-link",
            // command: () => {
            //     router.push("/installation");
            // },
        },
        {
            label: "External",
            icon: "pi pi-home",
            items: [
                {
                    label: "React.js",
                    url: "/documents",
                },
                {
                    label: "Vite.js",
                    url: "https://vitejs.dev/",
                },
            ],
        },
    ];
    const getMenuItems = () => {
        if (!user || !user.actions) {
            return [];
        }
        const items: any = [];

        if (user.actions.includes(ActionType.ReadDatatable)) {
            items.push({
                label: t("Documents"),
                icon: "pi pi-book",
                command: () => navigate("/documents"),
            });
        }
        if (user.actions.includes(ActionType.ReadCategories)) {
            items.push({
                label: t("Categories"),
                icon: "pi pi-tags",
                command: () => navigate("/categories"),
            });
        }
        if (user.actions.includes(ActionType.Extract)) {
            items.push({
                label: t("Extractions"),
                icon: "pi pi-receipt",
                command: () => navigate("/extractions"),
            });
        }
        if (user.actions.includes(ActionType.PlanTasks)) {
            items.push({
                label: t("Tasks"),
                icon: "pi pi-receipt",
                command: () => navigate("/tasks"),
            });
        }
        if (user.actions.includes(ActionType.EditAccess)) {
            items.push({
                label: t("Access"),
                icon: "pi pi-receipt",
                command: () => navigate("/access"),
            });
        }

        return items;
    };

    return (
        <div className="card w-screen">
            <Toolbar
                className="p-2 "
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
