import React, { useRef, useState } from "react";
import CreateLocationMenu from "./CreateLocationMenu";
import { OverlayPanel } from "primereact/overlaypanel";
import { useTranslation } from "react-i18next";
import { SplitButton } from "primereact/splitbutton";
import TabSeparatedInput from "../../../components/TabSeparatedInput";
import { Dialog } from "primereact/dialog";
import StorageMenu from "./StorageMenu";
import LibraryMenu from "./LibraryMenu";

const LocationsMenuButton = () => {
    const { t } = useTranslation();

    const createLocationMenuPanel = useRef<OverlayPanel>(null);

    const [libraryMenuVisible, setLibraryMenuVisible] =
        useState<boolean>(false);
    const [storageMenuVisible, setStorageMenuVisible] =
        useState<boolean>(false);

    const [tabSeparatedInputVisible, setTabSeparatedInputVisible] =
        useState<boolean>(false);
    const [tabSeparatedValues, setTabSeparatedValues] = useState<
        [key: string, value: string][]
    >([]);

    const items = [
        {
            label: t("Manage libraries"),
            icon: "pi pi-pencil",
            command: () => setLibraryMenuVisible(true),
        },
        {
            label: t("Manage storages"),
            icon: "pi pi-pencil",
            command: () => setStorageMenuVisible(true),
        },
        {
            label: t("Insert using tab separated text input"),
            icon: "pi pi-clipboard",
            command: () => setTabSeparatedInputVisible(true),
        },
    ];

    const valuesMappers = [
        {
            key: "library",
            label: t("Library"),
            required: true,
        },
        {
            key: "storage",
            label: t("Storage"),
            required: true,
        },
        {
            key: "name",
            label: t("Location name"),
            required: true,
        },
        {
            key: "regexp",
            label: t("Location prefix"),
            required: true,
        },
        {
            key: "description",
            label: t("Description"),
        },
        {
            key: "additionalInfo",
            label: t("Additional information"),
        },
        {
            key: "state",
            label: t("Location state"),
        },
    ];

    return (
        <React.Fragment>
            <SplitButton
                className="fixed"
                icon="pi pi-angle-down"
                dropdownIcon="pi pi-ellipsis-v"
                label={t("Create location")}
                outlined
                model={items}
                onClick={(e) => createLocationMenuPanel.current!.toggle(e)}
            />
            <OverlayPanel ref={createLocationMenuPanel}>
                <CreateLocationMenu />
            </OverlayPanel>
            <Dialog
                visible={libraryMenuVisible}
                onHide={() => setLibraryMenuVisible(false)}
            >
                <LibraryMenu onClose={() => setLibraryMenuVisible(false)} />
            </Dialog>
            <Dialog
                visible={storageMenuVisible}
                onHide={() => setStorageMenuVisible(false)}
            >
                <StorageMenu onClose={() => setStorageMenuVisible(false)} />
            </Dialog>
            <TabSeparatedInput
                visible={tabSeparatedInputVisible}
                onHide={() => setTabSeparatedInputVisible(false)}
                valueMappers={valuesMappers}
                onSubmit={setTabSeparatedValues}
            />
        </React.Fragment>
    );
};

export default LocationsMenuButton;
