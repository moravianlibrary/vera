import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchLocationField } from "../../../contexts/documents/search/SearchNodes";
import React from "react";
import { RegexOption } from "../../../types/SearchTypes";
import LocationPicker, {
    LocationType,
    MetaLocation,
} from "../../../components/pickers/LocationPicker";
import { useLocations } from "../../../contexts/extractions/locations/LocationsContext";

interface AdvancedSearchLocationFieldProps {
    data: SearchLocationField;
}

const AdvancedSearchLocationField: React.FC<
    AdvancedSearchLocationFieldProps
> = ({ data }) => {
    const { t } = useTranslation();
    const { libraries, storages, locations } = useLocations();

    const [option, setOption] = useState<RegexOption>(
        data.option as RegexOption
    );
    const [location, setLocation] = useState<MetaLocation | null>(null);

    const parseLocationIdsToLocation = (
        locationIds: number[] | null
    ): MetaLocation | null => {
        if (!locationIds || locationIds.length === 0) {
            return null;
        }
        if (locationIds.length === 1) {
            const location = locations.find((l) => l.id === locationIds[0]);
            return location
                ? {
                      type: LocationType.Location,
                      data: location,
                  }
                : null;
        }
        const foundInStorages = storages.filter((s) =>
            s.locations.some((l) => locationIds.includes(l.id))
        );
        if (foundInStorages.length === 1) {
            return {
                type: LocationType.Storage,
                data: foundInStorages[0],
            };
        }
        const foundInLibraries = libraries.filter((l) =>
            l.storages.some((s) =>
                s.locations.some((l) => locationIds.includes(l.id))
            )
        );
        if (foundInLibraries.length === 1) {
            return {
                type: LocationType.Library,
                data: foundInLibraries[0],
            };
        }
        return null;
    };

    useEffect(() => {
        setLocation(parseLocationIdsToLocation(data.value as number[]));
    }, [data.value]);

    const handleSelectOption = (e: DropdownChangeEvent) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleSelectLocation = (location: MetaLocation | null) => {
        if (!location) {
            setLocation(null);
            return;
        }

        setLocation(location);
        if (location.type === LocationType.Library) {
            data.setValue(
                libraries
                    .find((l) => l.id === location.data.id)
                    ?.storages.flatMap((s) => s.locations.map((l) => l.id))
            );
        } else if (location.type === LocationType.Storage) {
            data.setValue(
                storages
                    .find((s) => s.id === location.data.id)
                    ?.locations.map((l) => l.id)
            );
        } else if (location.type === LocationType.Location) {
            data.setValue([location.data.id]);
        }
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                className="w-12rem"
                value={option}
                onChange={handleSelectOption}
                options={Object.keys(RegexOption).map((option) => ({
                    value: option,
                    label: t(option),
                }))}
                placeholder={t("Select operation")}
            />
            <LocationPicker
                location={location}
                callback={handleSelectLocation}
            />
        </div>
    );
};

export default AdvancedSearchLocationField;
