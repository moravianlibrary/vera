import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LocationState } from "../../../types/LocationState";
import ApiLocations, { Library, Storage } from "../../../adapters/ApiLocations";
import { useToast } from "../../toast/ToastContext";
import LocationModel from "./LocationModel";

interface LocationsContextProps {
    createLibrary: (name: string) => Promise<Library>;
    createStorage: (library_id: number, name: string) => Promise<Storage>;
    createLocation: (
        storage_id: number,
        name: string,
        regexp: string,
        state: LocationState,
        description: string | null,
        additional_info: string | null
    ) => void;
    updateLibrary: (id: number, name: string) => void;
    updateStorage: (
        storage_id: number,
        name: string,
        library_id: number
    ) => void;
    updateLocation: (
        location_id: number,
        storage_id: number,
        name: string,
        regexp: string,
        state: LocationState,
        description: string | null,
        additional_info: string | null
    ) => void;
    deleteLibrary: (id: number) => void;
    deleteStorage: (storage_id: number) => void;
    deleteLocation: (location_id: number) => void;
    libraries: Library[];
    storages: Storage[];
    locations: LocationModel[];
}

const LocationsContext = createContext<LocationsContextProps | undefined>(
    undefined
);

interface LocationsProviderProps {
    children: ReactNode;
}

export const LocationsProvider: React.FC<LocationsProviderProps> = ({
    children,
}) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const [libraries, setLibraries] = React.useState<Library[]>([]);
    const [storages, setStorages] = React.useState<Storage[]>([]);
    const [locations, setLocations] = React.useState<LocationModel[]>([]);

    const createLibrary = async (name: string): Promise<Library> => {
        try {
            const response = await ApiLocations.createLibrary({
                name: name,
            });

            showToast(
                "success",
                t("The library was created successfully"),
                `${t("Name")}: ${name}`
            );
            setLibraries([...libraries, response.data]);
            return response.data as Library;
        } catch (error) {
            showToast("error", t("Library creation failed"), "");
            console.error(error);
            throw error;
        }
    };

    const createStorage = async (
        library_id: number,
        name: string
    ): Promise<Storage> => {
        try {
            const response = await ApiLocations.createStorage({
                library_id: library_id,
                name: name,
            });
            showToast(
                "success",
                t("The storage was created successfully"),
                `${t("Name")}: ${name}`
            );
            setStorages([...storages, response.data]);
            libraries
                .find((l) => l.id === library_id)!
                .storages.push(response.data);
            return response.data as Storage;
        } catch (error) {
            showToast("error", t("Storage creation failed"), "");
            console.error(error);
            throw error;
        }
    };

    const createLocation = (
        storage_id: number,
        name: string,
        regexp: string,
        state: LocationState,
        description: string | null,
        additional_info: string | null
    ) => {
        ApiLocations.createLocation({
            storage_id: storage_id,
            name: name,
            regexp: regexp,
            state: state,
            description: description,
            additional_info: additional_info,
        })
            .then((response) => {
                showToast(
                    "success",
                    t("The location was created successfully")
                );
                const storage = storages.find((s) => s.id === storage_id);
                const library = libraries.find(
                    (l) => l.id === storage!.library_id
                );
                setLocations([
                    ...locations,
                    new LocationModel(library!, storage!, response.data),
                ]);
            })
            .catch((error) => {
                showToast("error", t("Location creation failed"), "");
                console.error(error);
            });
    };

    const updateLibrary = (id: number, name: string) => {
        ApiLocations.updateLibrary(id, {
            name: name,
        })
            .then(() => {
                showToast(
                    "success",
                    t("The library was updated successfully"),
                    `${t("Name")}: ${name}`
                );
                setLibraries(
                    libraries?.map((l) =>
                        l.id === id ? { ...l, name: name } : l
                    )
                );
            })
            .catch((error) => {
                showToast("error", t("Library update failed"), "");
                console.error(error);
            });
    };

    const updateStorage = (
        storage_id: number,
        name: string,
        library_id: number
    ) => {
        ApiLocations.updateStorage(storage_id, {
            name: name,
            library_id: library_id,
        })
            .then(() => {
                showToast(
                    "success",
                    t("The storage was updated successfully"),
                    `${t("Name")}: ${name}`
                );
                setStorages(
                    storages?.map((s) =>
                        s.id === storage_id ? { ...s, name: name } : s
                    )
                );
            })
            .catch((error) => {
                showToast("error", t("Storage update failed"), "");
                console.error(error);
            });
    };

    const updateLocation = (
        location_id: number,
        storage_id: number,
        name: string,
        regexp: string,
        state: LocationState,
        description: string | null,
        additional_info: string | null
    ) => {
        ApiLocations.updateLocation(location_id, {
            storage_id: storage_id,
            name: name,
            regexp: regexp,
            state: state,
            description: description,
            additional_info: additional_info,
        })
            .then((response) => {
                showToast(
                    "success",
                    t("The location was updated successfully")
                );
                const storage = storages.find((s) => s.id === storage_id);
                const library = libraries.find(
                    (l) => l.id === storage!.library_id
                );
                setLocations(
                    locations?.map((l) =>
                        l.id === location_id
                            ? new LocationModel(
                                  library!,
                                  storage!,
                                  response.data
                              )
                            : l
                    )
                );
            })
            .catch((error) => {
                showToast("error", t("Location update failed"), "");
                console.error(error);
            });
    };

    const deleteLibrary = (id: number) => {
        ApiLocations.deleteLibrary(id)
            .then(() => {
                showToast(
                    "success",
                    t("The library was deleted successfully"),
                    `${t("Name")}: ${id}`
                );
                setLibraries(libraries?.filter((l) => l.id !== id));
            })
            .catch((error) => {
                showToast("error", t("Library deletion failed"), "");
                console.error(error);
            });
    };

    const deleteStorage = (storage_id: number) => {
        ApiLocations.deleteStorage(storage_id)
            .then(() => {
                showToast(
                    "success",
                    t("The storage was deleted successfully"),
                    `${t("Name")}: ${storage_id}`
                );
                setStorages(storages?.filter((s) => s.id !== storage_id));
            })
            .catch((error) => {
                showToast("error", t("Storage deletion failed"), "");
                console.error(error);
            });
    };

    const deleteLocation = (location_id: number) => {
        ApiLocations.deleteLocation(location_id)
            .then(() => {
                showToast(
                    "success",
                    t("The location was deleted successfully")
                );
                setLocations(locations?.filter((l) => l.id !== location_id));
            })
            .catch((error) => {
                showToast("error", t("Location deletion failed"), "");
                console.error(error);
            });
    };

    useEffect(() => {
        ApiLocations.getLibraries()
            .then((response) => {
                setLibraries(response.data);
                setStorages(
                    response.data.map((l) => l.storages).flatMap((s) => s)
                );
                const locations = response.data.flatMap((library) =>
                    library.storages.flatMap((storage) =>
                        storage.locations.map(
                            (location) =>
                                new LocationModel(library, storage, location)
                        )
                    )
                );
                setLocations(locations);
            })
            .catch((error) => {
                console.error(error);
            });
    }, []);

    const contextValue: LocationsContextProps = {
        createLibrary,
        createStorage,
        createLocation,
        updateLibrary,
        updateStorage,
        updateLocation,
        deleteLibrary,
        deleteStorage,
        deleteLocation,
        libraries,
        storages,
        locations,
    };

    return (
        <LocationsContext.Provider value={contextValue}>
            {children}
        </LocationsContext.Provider>
    );
};

export const useLocations = (): LocationsContextProps => {
    const context = useContext(LocationsContext);

    if (!context) {
        throw new Error("useLocations must be used within a LocationsProvider");
    }

    return context;
};
