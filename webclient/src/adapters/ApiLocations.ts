import { LocationState } from "../types/LocationState";
import { ApiBase, ApiOptions } from "./ApiBase";

interface Library {
    id: number;
    name: string;
}

interface Storage {
    id: number;
    name: string;
    library_id: number;
    library: Library;
}

interface Location {
    id: number;
    name: string;
    regexp: string;
    description?: string | null;
    additional_info?: string | null;
    state: LocationState;
    storage_id: number;
    storage: Storage;
}

class ApiLibraries extends ApiBase<Library> {
    constructor() {
        super("/locations/libraries", {
            disableGet: true,
        } as ApiOptions);
    }
}

class ApiStorages extends ApiBase<Storage> {
    constructor() {
        super("/locations/storages", {
            disableGet: true,
        } as ApiOptions);
    }
}

class ApiLocations extends ApiBase<Location> {
    constructor() {
        super("/locations/locations", {
            disableGet: true,
        } as ApiOptions);
    }
}

export { ApiLibraries, ApiStorages, ApiLocations };
export type { Library, Storage, Location };
