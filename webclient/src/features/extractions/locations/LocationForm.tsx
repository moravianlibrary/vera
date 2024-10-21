import React from "react";
import { useTranslation } from "react-i18next";
import LabeledComponent from "../../../components/wrappers/LabeledComponent";
import { Dropdown } from "primereact/dropdown";
import { Library, Location, Storage } from "../../../adapters/ApiLocations";
import { InputText } from "primereact/inputtext";
import { LocationState } from "../../../types/LocationState";
import LocationLibraryForm from "./LocationLibraryForm";
import LocationStorageForm from "./LocationStorageForm";
import LocationPrefixForm from "./LocationPrefixForm";

interface LocationFormProps {
    library: Library | null;
    storage: Storage | null;
    location: Location | null;
    onLibraryChange: (library: Library | null) => void;
    onStorageChange: (storage: Storage | null) => void;
    onLocationChange: (location: Location | null) => void;
}

const LocationForm: React.FC<LocationFormProps> = ({
    library,
    storage,
    location,
    onLibraryChange,
    onStorageChange,
    onLocationChange,
}) => {
    const { t } = useTranslation("locations");

    const handleNameChange = (name: string) => {
        onLocationChange({
            ...location,
            name: name,
        } as Location);
    };

    const handlePrefixChange = (prefix: string) => {
        onLocationChange({
            ...location,
            regexp: prefix,
        } as Location);
    };

    const handleStateChange = (state: LocationState) => {
        onLocationChange({
            ...location,
            state: state,
        } as Location);
    };

    const handleDescriptionChange = (description: string) => {
        onLocationChange({
            ...location,
            description: description,
        } as Location);
    };

    const handleAdditionalInfoChange = (additionalInfo: string) => {
        onLocationChange({
            ...location,
            additional_info: additionalInfo,
        } as Location);
    };

    return (
        <div className="flex flex-column gap-1">
            <LabeledComponent
                className="justify-content-between"
                label={t("form.library")}
            >
                <LocationLibraryForm
                    library={library}
                    onChangeLibrary={onLibraryChange}
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.storage")}
            >
                <LocationStorageForm
                    library={library}
                    storage={storage}
                    onChangeStorage={onStorageChange}
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.name")}
            >
                <InputText
                    value={location ? location.name : ""}
                    onChange={(e) => handleNameChange(e.target.value)}
                    autoFocus
                    disabled={!storage}
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.regexp")}
            >
                <LocationPrefixForm
                    prefix={location ? location.regexp : ""}
                    onChangePrefix={handlePrefixChange}
                    disabled={!location?.name}
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.additional-info")}
            >
                <InputText
                    value={
                        location && location.additional_info
                            ? location.additional_info
                            : ""
                    }
                    onChange={(e) => handleAdditionalInfoChange(e.target.value)}
                    autoFocus
                    disabled={!location?.name || !location?.regexp}
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.description")}
            >
                <InputText
                    value={
                        location && location.description
                            ? location.description
                            : ""
                    }
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    autoFocus
                    disabled={!location?.name || !location?.regexp}
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.state")}
            >
                <Dropdown
                    value={location ? location.state : null}
                    options={Object.values(LocationState).map((state) => ({
                        label: t(`location-state.${state}`, { ns: "types" }),
                        value: state,
                    }))}
                    onChange={(e) =>
                        handleStateChange(e.value as LocationState)
                    }
                    disabled={!location?.name || !location?.regexp}
                />
            </LabeledComponent>
        </div>
    );
};

export default LocationForm;
