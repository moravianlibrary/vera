import React, { useRef, useState } from "react";
import CreateLocationMenu from "./CreateLocationMenu";
import { OverlayPanel } from "primereact/overlaypanel";
import { useTranslation } from "react-i18next";
import { SplitButton } from "primereact/splitbutton";
import TabSeparatedInput, {
    ModelType,
} from "../../../components/TabSeparatedInput";
import { Dialog } from "primereact/dialog";
import StorageMenu from "./StorageMenu";
import LibraryMenu from "./LibraryMenu";
import { ProgressSpinner } from "primereact/progressspinner";
import { useLocations } from "../../../contexts/extractions/locations/LocationsContext";
import { LocationState } from "../../../types/LocationState";

const LocationsMenuButton = () => {
    const { t } = useTranslation();
    const {
        libraries,
        storages,
        locations,
        createLibrary,
        createStorage,
        createLocation,
    } = useLocations();

    const createLocationMenuPanel = useRef<OverlayPanel>(null);

    const [libraryMenuVisible, setLibraryMenuVisible] =
        useState<boolean>(false);
    const [storageMenuVisible, setStorageMenuVisible] =
        useState<boolean>(false);

    const [tabSeparatedInputVisible, setTabSeparatedInputVisible] =
        useState<boolean>(false);
    const [processingData, setProcessingData] = useState<boolean>(false);

    const processTableData = async (data: ModelType[]) => {
        setProcessingData(true);
        const librariesMap = new Map(libraries.map((l) => [l.name, l]));
        const storagesMap = new Map();
        storages.forEach((s) => {
            if (!storagesMap.has(s.name)) {
                storagesMap.set(s.name, [s]);
            } else {
                storagesMap.get(s.name)!.push(s);
            }
        });
        const locationsMap = new Map();
        locations.forEach((l) => {
            if (!locationsMap.has(l.name)) {
                locationsMap.set(l.name, [l]);
            } else {
                locationsMap.get(l.name)!.push(l);
            }
        });

        const getLibrary = async (name: string) => {
            if (!librariesMap.has(name)) {
                librariesMap.set(name, await createLibrary(name));
            }
            return librariesMap.get(name);
        };

        const getStorage = async (libraryId: number, name: string) => {
            if (
                storagesMap.has(name) &&
                storagesMap
                    .get(name)!
                    .map((s) => s.library_id)
                    .includes(libraryId)
            ) {
                return storagesMap
                    .get(name)!
                    .find((s) => s.library_id === libraryId);
            }
            const storage = await createStorage(libraryId, name);
            if (!storagesMap.has(name)) {
                storagesMap.set(name, [storage]);
            } else {
                storagesMap.get(name)!.push(storage);
            }
            return storage;
        };

        for (const row of data) {
            if (row.library && row.storage && row.name && row.regexp) {
                try {
                    const library = await getLibrary(row.library);
                    const storage = await getStorage(library!.id, row.storage);
                    if (
                        !locationsMap.has(row.name) ||
                        !locationsMap
                            .get(row.name)!
                            .map((l) => l.storage_id)
                            .includes(storage!.id)
                    ) {
                        const location = await createLocation(
                            storage!.id,
                            row.name,
                            row.regexp,
                            row.state === "Closed"
                                ? LocationState.Closed
                                : LocationState.Active,
                            row.description ?? null,
                            row.additional_info ?? null
                        );
                        if (!locationsMap.has(row.name)) {
                            locationsMap.set(row.name, [location]);
                        } else {
                            locationsMap.get(row.name)!.push(location);
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
        setProcessingData(false);
    };

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
            label: t("Insert using table data form"),
            icon: "pi pi-clipboard",
            command: () => setTabSeparatedInputVisible(true),
        },
    ];

    const locationMapping = [
        {
            mapTo: "library",
            mapFrom: t("Library"),
            required: true,
        },
        {
            mapTo: "storage",
            mapFrom: t("Storage"),
            required: true,
        },
        {
            mapTo: "name",
            mapFrom: t("Location name"),
            required: true,
        },
        {
            mapTo: "regexp",
            mapFrom: t("Location prefix"),
            required: true,
        },
        {
            mapTo: "description",
            mapFrom: t("Description"),
        },
        {
            mapTo: "additionalInfo",
            mapFrom: t("Additional information"),
        },
        {
            mapTo: "state",
            mapFrom: t("Location state"),
        },
    ];

    return (
        <React.Fragment>
            <div className="fixed flex align-items-center">
                <SplitButton
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
                    mapModel={locationMapping}
                    onSubmit={processTableData}
                />
                {processingData && (
                    <ProgressSpinner
                        style={{ width: "50px", height: "50px" }}
                    />
                )}
            </div>
        </React.Fragment>
    );
};

export default LocationsMenuButton;
