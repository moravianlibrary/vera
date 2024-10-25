import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocations } from "../../contexts/LocationsContext";
import DeleteButton from "../../components/buttons/DeleteButton";
import EditButton from "../../components/buttons/EditButton";
import { Dialog } from "primereact/dialog";
import LocationForm from "./locations/LocationForm";
import { Library, Location, Storage } from "../../adapters/ApiLocations";
import { Button } from "primereact/button";
import { Avatar } from "primereact/avatar";
import { Tooltip } from "primereact/tooltip";
import DataTablePaginator from "../../components/views/DataTablePaginator";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";

interface LocationsTableProps {}

const compareLocations = (a: Location, b: Location): number => {
    return (
        a.storage.library.name.localeCompare(b.storage.library.name) ||
        // a.storage.name.localeCompare(b.storage.name) ||
        a.name.localeCompare(b.name)
    );
};

const LocationsTable: React.FC<LocationsTableProps> & {
    Paginator: React.FC;
} = () => {
    const { t } = useTranslation("locations");
    const { locations, deleteLocation } = useLocations();

    const [values, setValues] = useState<Location[]>(
        locations.sort(compareLocations)
    );
    const [editLocation, setEditLocation] = useState<Location | null>(null);

    useEffect(() => {
        setValues(locations.sort(compareLocations));
    }, [locations]);

    const locationStateBody = (data: any, options: any) => {
        return <p>{t(`location-state.${data.state}`, { ns: "types" })}</p>;
    };

    const getSubPatternBody = (subPattern: string, index: number) => {
        if (subPattern === "[[:digit:]]") {
            return (
                <div key={index}>
                    <Avatar label="D" className="any-digit bg-green-100" />
                </div>
            );
        }
        if (subPattern === "[[:alpha:]]") {
            return (
                <div key={index}>
                    <Avatar label="L" className="any-letter bg-blue-100" />
                </div>
            );
        }
        if (subPattern === "[[:alnum:]]") {
            return (
                <div key={index}>
                    <Avatar
                        label="X"
                        className="any-letter-or-digit bg-cyan-100"
                    />
                </div>
            );
        }
        return <p key={index}>{subPattern}</p>;
    };

    const locationPatternBody = (data: Location, options: any) => {
        const specialCharactersRegex =
            /(\[\[:digit:\]\]|\[\[:alpha:\]\]|\[\[:alnum:\]\])/g;
        const patternTokenized = data.regexp
            .split(specialCharactersRegex)
            .filter((token) => token);
        return (
            <div className="flex align-items-center">
                <Tooltip
                    target=".any-digit"
                    content={t("table.values.special-characters.any-digit")}
                    position="top"
                />
                <Tooltip
                    target=".any-letter"
                    content={t("table.values.special-characters.any-letter")}
                    position="top"
                />
                <Tooltip
                    target=".any-letter-or-digit"
                    content={t(
                        "table.values.special-characters.any-letter-or-digit"
                    )}
                    position="top"
                />
                {patternTokenized.map(getSubPatternBody)}
            </div>
        );
    };

    const tableHeader = (
        <ColumnGroup>
            <Row>
                <Column header={t("table.columns.library")} />
                <Column header={t("table.columns.storage")} />
                <Column header={t("table.columns.name")} />
                <Column header={t("table.columns.regexp")} />
                <Column header={t("table.columns.description")} />
                <Column header={t("table.columns.additional-info")} />
                <Column header={t("table.columns.state")} />
                <Column header={t("table.columns.actions")} colSpan={2} />
            </Row>
        </ColumnGroup>
    );

    return (
        <div>
            <DataTable
                value={values}
                scrollable
                scrollHeight="flex"
                headerColumnGroup={tableHeader}
            >
                <Column field="storage.library.name" />
                <Column field="storage.name" />
                <Column field="name" />
                <Column field="regexp" body={locationPatternBody} />
                <Column field="description" />
                <Column field="additional_info" />
                <Column field="state" body={locationStateBody} />
                <Column
                    body={(data, options) => (
                        <EditButton
                            itemId={data.id}
                            onEditItem={() => setEditLocation(data)}
                        />
                    )}
                />
                <Column
                    body={(data, options) => (
                        <DeleteButton
                            itemId={data.id}
                            onDelete={() => deleteLocation(data.id)}
                        />
                    )}
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

const LocationsTablePaginator: React.FC = () => {
    const { t } = useTranslation("locations");
    const { numFound, page, setPage, pageSize, setPageSize } = useLocations();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            numFoundText={t("num-found", { count: numFound })}
        />
    );
};

LocationsTable.Paginator = LocationsTablePaginator;

interface EditLocationProps {
    location: Location;
    onClose: () => void;
}

const EditLocation: React.FC<EditLocationProps> = ({
    location: inputLocation,
    onClose,
}) => {
    const { t } = useTranslation();
    const { updateLocation } = useLocations();

    const [library, setLibrary] = useState<Library | null>(
        inputLocation.storage.library
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
