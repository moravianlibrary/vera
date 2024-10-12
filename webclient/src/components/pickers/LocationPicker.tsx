import React, { useEffect, useState } from "react";
import { Library, Location, Storage } from "../../adapters/ApiLocations";
import {
    TreeSelect,
    TreeSelectChangeEvent,
    TreeSelectProps,
} from "primereact/treeselect";
import { useLocations } from "../../contexts/LocationsContext";
import { TreeNode } from "primereact/treenode";
import { useTranslation } from "react-i18next";

export enum LocationType {
    Library = "Library",
    Storage = "Storage",
    Location = "Location",
}

export interface MetaLocation {
    type: LocationType;
    data: Library | Storage | Location;
}

interface LocationPickerProps {
    location: MetaLocation | null;
    callback(location: MetaLocation | null): void;
    className?: string;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
    location,
    callback,
    className,
}: LocationPickerProps) => {
    const { t } = useTranslation();
    const { libraries, storages, locations } = useLocations();

    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    useEffect(() => {
        const setSelectedKeyFromLocation = (location: MetaLocation | null) => {
            setSelectedKey(
                location
                    ? location.type === LocationType.Library
                        ? `${location.data.id}`
                        : location.type === LocationType.Storage
                        ? `${(location.data as Storage).library_id}-${
                              location.data.id
                          }`
                        : location.type === LocationType.Location
                        ? `${(location.data as Location).storage.library_id}-${
                              (location.data as Location).storage.id
                          }-${location.data.id}`
                        : null
                    : null
            );
        };
        setSelectedKeyFromLocation(location);
    }, [location]);

    const options: TreeNode[] = libraries.map((lib) => ({
        key: `${lib.id}`,
        label: lib.name,
        data: lib.name,
        children: lib.storages.map((s) => ({
            key: `${lib.id}-${s.id}`,
            label: s.name,
            data: `${lib.name} > ${s.name}`,
            children: s.locations.map((loc) => ({
                key: `${lib.id}-${s.id}-${loc.id}`,
                label: loc.name,
                data: `${lib.name} > ${s.name} > ${loc.name}`,
            })),
        })),
    }));

    const handleChange = (event: TreeSelectChangeEvent) => {
        const keyPath = event.value ? event.value.toString() : null;
        setSelectedKey(keyPath);
        if (!keyPath) {
            callback(null);
            return;
        }
        const parts = keyPath.split("-");
        if (parts.length === 3) {
            const location =
                locations.find((l) => l.id === parseInt(parts[2])) ?? null;
            if (location) {
                callback({
                    type: LocationType.Location,
                    data: location,
                });
                return;
            }
        } else if (parts.length === 2) {
            const storage =
                storages.find((s) => s.id === parseInt(parts[1])) ?? null;
            if (storage) {
                callback({
                    type: LocationType.Storage,
                    data: storage,
                });
                return;
            }
        } else if (parts.length === 1) {
            const library = libraries.find((l) => l.id === parseInt(parts[0]));
            if (library) {
                callback({
                    type: LocationType.Library,
                    data: library,
                });
                return;
            }
        }
        callback(null);
    };

    const valueBodyTemplate = (
        nodes: TreeNode | TreeNode[],
        props: TreeSelectProps
    ) => {
        if (Array.isArray(nodes) && nodes.length === 1) {
            const node = nodes[0];
            if (node) {
                return node.data;
            }
        }
        return props.placeholder;
    };

    return (
        <TreeSelect
            className={className}
            options={options}
            value={selectedKey}
            onChange={handleChange}
            valueTemplate={valueBodyTemplate}
            placeholder={t("Select location")}
            filter
            showClear
        />
    );
};

export default LocationPicker;
