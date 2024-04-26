import { LocationState } from "../types/LocationState";
import axiosInstance, { authHeader } from "./ApiBase";

interface LibraryBase {
    id: string;
    name: string;
}

interface LibraryCreate extends LibraryBase {}

interface Library extends LibraryBase {
    storages: Storage[];
}

interface StorageBase {
    name: string;
    library_id: string;
}

interface StorageCreate extends StorageBase {}

interface Storage extends StorageBase {
    id: number;
    library: Library;
    locations: Location[];
}

interface LocationBase {
    name: string;
    regexp: string;
    description?: string | null;
    additional_info?: string | null;
    state: LocationState;
    storage_id: number;
}

interface LocationCreate extends LocationBase {}

interface Location extends LocationBase {
    id: number;
    storage: Storage;
}

namespace ApiLocations {
    export function createLibrary(library: LibraryCreate) {
        return axiosInstance.post<Library>("/locations/libraries", library);
    }

    export function createStorage(storage: StorageCreate) {
        return axiosInstance.post<Storage>("/locations/storages", storage);
    }

    export function createLocation(location: LocationCreate) {
        return axiosInstance.post<Location>("/locations/locations", location);
    }

    export function updateLibrary(library_id: string, library: LibraryCreate) {
        return axiosInstance.put(`/locations/libraries/${library_id}`, library);
    }

    export function updateStorage(storage_id: number, storage: StorageCreate) {
        return axiosInstance.put(`/locations/storages/${storage_id}`, storage);
    }

    export function updateLocation(location_id: number, location: LocationCreate) {
        return axiosInstance.put(`/locations/${location_id}`, location);
    }

    export function deleteLibrary(id: string) {
        return axiosInstance.delete(`/locations/libraries/${id}`);
    }

    export function deleteStorage(id: number) {
        return axiosInstance.delete(`/locations/storages/${id}`);
    }

    export function deleteLocation(id: number) {
        return axiosInstance.delete(`/locations/locations/${id}`);
    }

    export function getLibraries() {
        return axiosInstance.get<Library[]>("/locations/libraries");
    }

    export function getStorages() {
        return axiosInstance.get<Storage[]>("/locations/storages");
    }

    export function getLocations() {
        return axiosInstance.get<Location[]>("/locations/locations");
    }
}

export default ApiLocations;
export type { LibraryCreate, StorageCreate, LocationCreate, Library, Storage, Location };
