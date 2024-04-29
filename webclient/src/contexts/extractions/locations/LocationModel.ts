import { Library, Location, Storage } from "../../../adapters/ApiLocations";
import { LocationState } from "../../../types/LocationState";

class LocationModel implements Location {
    id: number;
    name: string;
    regexp: string;
    description?: string | null | undefined;
    additional_info?: string | null | undefined;
    state: LocationState;
    storage_id: number;

    library: Library;
    library_name: string;
    storage: Storage;
    storage_name: string;

    constructor(library: Library, storage: Storage, location: Location) {
        this.id = location.id;
        this.name = location.name;
        this.regexp = location.regexp;
        this.description = location.description;
        this.additional_info = location.additional_info;
        this.state = location.state;
        this.storage_id = location.storage_id;
        this.storage = storage;

        this.library = library;
        this.library_name = library.name;
        this.storage = storage;
        this.storage_name = storage.name;
    }
}

export default LocationModel;
