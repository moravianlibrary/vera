import { useCallback, useState } from "react";
import { useAccess } from "../AccessContext";

interface ObjectiveSettingsInjectorProps<T> {
    settings: T;
    setSettingsProperty: (name: string, value: any) => void;
    saveSettings: () => void;
}

const useObjectiveSettings = <T extends Object>(
    settingsName: string,
    defaultSettings: T
) => {
    const { getSettings, updateSettings } = useAccess();

    const [settings, setSettings] = useState<T>(
        (getSettings(settingsName) as T) || defaultSettings
    );

    const setSettingsProperty = useCallback(
        (name: string, value: any) => {
            setSettings((prev) => ({ ...prev, [name]: value }));
        },
        [setSettings]
    );

    const saveSettings = useCallback(() => {
        updateSettings(settingsName, settings);
    }, [settings, settingsName, updateSettings]);

    return {
        settings,
        setSettingsProperty,
        saveSettings,
    };
};

export default useObjectiveSettings;
export type { ObjectiveSettingsInjectorProps };
