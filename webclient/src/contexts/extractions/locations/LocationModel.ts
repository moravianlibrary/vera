import { Location, Storage } from "../../../adapters/ApiLocations";
import { LocationState } from "../../../types/LocationState";

class LocationModel implements Location {
    id: number;
    name: string;
    regexp: string;
    description?: string | null | undefined;
    additional_info?: string | null | undefined;
    state: LocationState;
    storage_id: number;
    storage: Storage;

    library_name: string;
    storage_name: string;

    constructor(data: Location) {
        this.id = data.id;
        this.name = data.name;
        this.regexp = data.regexp;
        this.description = data.description;
        this.additional_info = data.additional_info;
        this.state = data.state;
        this.storage_id = data.storage_id;
        this.storage = data.storage;

        this.library_name = data.storage.library.name;
        this.storage_name = data.storage.name;
    }
}

export default LocationModel;
