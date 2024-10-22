import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { useEffect, useState } from "react";

interface TimeoutSelectProps {
    initValue: number;
    value: number | null;
    callback: (value: number | null) => void;
    unit?: string;
}

const TimeoutSelect: React.FC<TimeoutSelectProps> = ({
    initValue,
    value,
    callback,
    unit,
}) => {
    const [isActive, setIsActive] = useState<boolean>(value !== null);
    const [currValue, setCurrValue] = useState<number>(
        value !== null ? value : initValue
    );

    useEffect(() => {
        if (isActive) {
            callback(currValue);
        }
    }, [isActive, currValue]);

    return (
        <div className="flex align-items-center gap-2">
            <Checkbox
                checked={isActive}
                onChange={(e) => setIsActive(e.checked)}
            />
            <InputNumber
                className="w-6rem"
                value={currValue}
                onChange={(e) => setCurrValue(e.value)}
                min={0}
                max={99}
                showButtons
            />
            <span>{unit || "s"}</span>
        </div>
    );
};

export default TimeoutSelect;
