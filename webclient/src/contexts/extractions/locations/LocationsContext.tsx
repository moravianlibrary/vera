import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LocationState } from "../../../types/LocationState";
import {
    Library,
    Storage,
    Location,
    ApiLibraries,
    ApiStorages,
    ApiLocations,
} from "../../../adapters/ApiLocations";
import { useToast } from "../../ToastContext";

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
    ) => Promise<Location>;
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
    locations: Location[];
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
    const apiLibraries = new ApiLibraries();
    const apiStorages = new ApiStorages();
    const apiLocations = new ApiLocations();

    const { t } = useTranslation();
    const showToast = useToast();

    const [libraries, setLibraries] = React.useState<Library[]>([]);
    const [storages, setStorages] = React.useState<Storage[]>([]);
    const [locations, setLocations] = React.useState<Location[]>([]);

    const createLibrary = async (name: string): Promise<Library> => {
        try {
            const response = await apiLibraries.create({
                name: name,
            });

            showToast(
                "success",
                t("The library was created successfully"),
                `${t("Name")}: ${name}`
            );
            setLibraries((libraries) => [...libraries, response.data]);
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
            const response = await apiStorages.create({
                library_id: library_id,
                name: name,
            });
            showToast(
                "success",
                t("The storage was created successfully"),
                `${t("Name")}: ${name}`
            );
            setStorages((storages) => [...storages, response.data]);
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

    const createLocation = async (
        storage_id: number,
        name: string,
        regexp: string,
        state: LocationState,
        description: string | null,
        additional_info: string | null
    ): Promise<Location> => {
        try {
            const response = await apiLocations.create({
                storage_id: storage_id,
                name: name,
                regexp: regexp,
                state: state,
                description: description,
                additional_info: additional_info,
            });
            showToast("success", t("The location was created successfully"));
            const location = response.data;
            setLocations((locations) => [...locations, location]);
            return location;
        } catch (error) {
            showToast("error", t("Location creation failed"), "");
            console.error(error);
            throw error;
        }
    };

    const updateLibrary = (id: number, name: string) => {
        apiLibraries
            .update(id, {
                name: name,
            })
            .then((response) => {
                showToast(
                    "success",
                    t("The library was updated successfully"),
                    `${t("Name")}: ${name}`
                );
                setLibraries(
                    libraries?.map((l) => (l.id === id ? response.data : l))
                );
                const storage = storages.find((s) => s.library_id === id);
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
        apiStorages
            .update(storage_id, {
                name: name,
                library_id: library_id,
            })
            .then((response) => {
                showToast(
                    "success",
                    t("The storage was updated successfully"),
                    `${t("Name")}: ${name}`
                );
                setStorages(
                    storages?.map((s) =>
                        s.id === storage_id ? response.data : s
                    )
                );
                const library = libraries.find((l) => l.id === library_id);
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
        apiLocations
            .update(location_id, {
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
                setLocations(
                    locations?.map((l) =>
                        l.id === location_id ? response.data : l
                    )
                );
            })
            .catch((error) => {
                showToast("error", t("Location update failed"), "");
                console.error(error);
            });
    };

    const deleteLibrary = (id: number) => {
        apiLibraries
            .delete(id)
            .then((response) => {
                showToast(
                    "success",
                    t("The library was deleted successfully"),
                    `${t("Name")}: ${response.data.name}`
                );
                setLibraries(libraries?.filter((l) => l.id !== id));
            })
            .catch((error) => {
                showToast("error", t("Library deletion failed"), "");
                console.error(error);
            });
    };

    const deleteStorage = (storage_id: number) => {
        apiStorages
            .delete(storage_id)
            .then((response) => {
                showToast(
                    "success",
                    t("The storage was deleted successfully"),
                    `${t("Name")}: ${response.data.name}`
                );
                setStorages(storages?.filter((s) => s.id !== storage_id));
            })
            .catch((error) => {
                showToast("error", t("Storage deletion failed"), "");
                console.error(error);
            });
    };

    const deleteLocation = (location_id: number) => {
        apiLocations
            .delete(location_id)
            .then((response) => {
                showToast(
                    "success",
                    t("The location was deleted successfully"),
                    `${t("Name")}: ${response.data.name}`
                );
                setLocations(locations?.filter((l) => l.id !== location_id));
            })
            .catch((error) => {
                showToast("error", t("Location deletion failed"), "");
                console.error(error);
            });
    };

    const fetchLocations = async () => {
        apiLibraries
            .getPage(1, 50)
            .then((response) => {
                // setLibraries(response.data);
                // setStorages(
                //     response.data.map((l) => l.storages).flatMap((s) => s)
                // );
                // const locations = response.data.flatMap((library) =>
                //     library.storages.flatMap((storage) =>
                //         storage.locations.map(
                //             (location) =>
                //                 new Location(library, storage, location)
                //         )
                //     )
                // );
                setLocations(locations);
            })
            .catch((error) => {
                console.error(error);
            });
    };

    useEffect(() => {
        fetchLocations();
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
