import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocations } from "../../../contexts/extractions/locations/LocationsContext";
import DeleteButton from "../../../components/buttons/DeleteButton";
import { LocationState } from "../../../types/LocationState";
import EditButton from "../../../components/buttons/EditButton";
import LocationModel from "../../../contexts/extractions/locations/LocationModel";
import { Dialog } from "primereact/dialog";
import LocationForm from "./LocationForm";
import { Library, Location, Storage } from "../../../adapters/ApiLocations";
import { Button } from "primereact/button";

interface LocationsTableProps {}

const compareLocations = (a: LocationModel, b: LocationModel): number => {
    return (
        a.library_name.localeCompare(b.library_name) ||
        // a.storage_name.localeCompare(b.storage_name) ||
        a.name.localeCompare(b.name)
    );
};

const LocationsTable: React.FC<LocationsTableProps> = () => {
    const { t } = useTranslation();
    const { locations } = useLocations();

    const [values, setValues] = useState<Location[]>(
        locations.sort(compareLocations)
    );
    const [editLocation, setEditLocation] = useState<LocationModel | null>(
        null
    );

    useEffect(() => {
        setValues(locations.sort(compareLocations));
        console.log(locations);
    }, [locations]);

    const locationStateBody = (data: any, options: any) => {
        return (
            <p>
                {t(
                    data.state === LocationState.Active
                        ? "Location active"
                        : "Location closed"
                )}
            </p>
        );
    };

    return (
        <div>
            <DataTable value={values}>
                <Column header={t("Library")} field="library_name" />
                <Column header={t("Storage")} field="storage_name" />
                <Column header={t("Location")} field="name" />
                <Column header={t("Location prefix")} field="regexp" />
                <Column header={t("Description")} field="description" />
                <Column
                    header={t("Additional information")}
                    field="additional_info"
                />
                <Column
                    header={t("Location state")}
                    field="state"
                    body={locationStateBody}
                />
                <Column
                    header={t("Edit")}
                    body={(data, options) => (
                        <EditButton
                            itemId={data.id}
                            onEditItem={() => setEditLocation(data)}
                        />
                    )}
                />
                <Column
                    header={t("Delete")}
                    body={(data, options) => <DeleteButton itemId={data.id} />}
                />
            </DataTable>
            {editLocation && (
                <EditLocation
                    location={editLocation}
                    onClose={() => setEditLocation(null)}
                />
            )}
        </div>
    );
};

interface EditLocationProps {
    location: LocationModel;
    onClose: () => void;
}

const EditLocation: React.FC<EditLocationProps> = ({
    location: inputLocation,
    onClose,
}) => {
    const { t } = useTranslation();
    const { updateLocation } = useLocations();

    const [library, setLibrary] = useState<Library | null>(
        inputLocation.library
    );
    const [storage, setStorage] = useState<Storage | null>(
        inputLocation.storage
    );
    const [location, setLocation] = useState<Location | null>(inputLocation);

    const handleUpdateLocation = () => {
        if (storage && location) {
            updateLocation(
                location.id,
                storage.id,
                location.name,
                location.regexp,
                location.state,
                location.description ?? null,
                location.additional_info ?? null
            );
        }
    };

    return (
        <Dialog visible={true} onHide={onClose}>
            <LocationForm
                library={library}
                storage={storage}
                location={location}
                onLibraryChange={setLibrary}
                onStorageChange={setStorage}
                onLocationChange={setLocation}
            />
            <div className="flex mt-4 gap-2 justify-content-end">
                <Button
                    icon="pi pi-check"
                    label={t("Save")}
                    severity="success"
                    outlined
                    onClick={handleUpdateLocation}
                />
                <Button
                    icon="pi pi-times"
                    label={t("Cancel")}
                    severity="danger"
                    outlined
                    onClick={onClose}
                />
            </div>
        </Dialog>
    );
};

export default LocationsTable;
