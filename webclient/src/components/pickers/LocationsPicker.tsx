import React, { useEffect, useState } from "react";
import { Library, Location, Storage } from "../../adapters/ApiLocations";
import { useLocations } from "../../contexts/LocationsContext";
import { useTranslation } from "react-i18next";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";

interface LocationsPickerProps {
    value: Location[];
    callback: (value: Location[]) => void;
    className?: string;
}

const LocationsPicker: React.FC<LocationsPickerProps> = ({
    value,
    callback,
    className,
}) => {
    const { t } = useTranslation("locations");
    const { locations } = useLocations();

    const onChange = (e: DropdownChangeEvent) => {
        callback(e.value ? (Array.isArray(e.value) ? e.value : [e.value]) : []);
    };

    return (
        <div>
            <MultiSelect
                className="w-full md:w-20rem"
                options={locations}
                value={value}
                useOptionAsValue={true}
                display="chip"
                optionValue="id"
                optionLabel="name"
                multiple
                onChange={onChange}
                placeholder={t("form.placeholder.location")}
                filter
                showClear
            />
        </div>
    );
};

export default LocationsPicker;
