import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";

const PercentageComponent = (props) => {
    const [editMode, setEditMode] = useState(false);
    const [value, setValue] = useState(props.percentage ? props.percentage : 0);
    const [autoFocusInput, setAutoFocusInput] = useState(false);

    const handleEdit = () => {
        if (props.onEditPercentage) {
            props.onEditPercentage(props.node);
        }
    };

    const handleValueChange = (e) => {
        setValue(e.value);
        if (props.onPercentageChange) {
            props.onPercentageChange(props.node, e.value);
        }
    };

    const handleUpdate = () => {
        if (props.onUpdatePercentage) {
            props.onUpdatePercentage();
        }
    };

    const handleClose = () => {
        if (props.onClosePercentageEditing) {
            props.onClosePercentageEditing();
        }
    };

    useEffect(() => {
        setValue(props.node.category.percentage);
        setEditMode(props.editPercentageNodes.includes(props.node));
        setAutoFocusInput(props.editPercentageNodes.length > 0 && props.editPercentageNodes[0] == props.node);
    }, [props.editPercentageNodes, props.node]);

    if (editMode) {
        return (
            <div className="flex align-items-center gap-1">
                <div className="p-inputgroup flex-1" style={{ width: '115px' }}>
                    <InputNumber
                        autoFocus={autoFocusInput}
                        size={2}
                        value={value}
                        onValueChange={handleValueChange}
                        min={0} max={100}
                        maxFractionDigits={2} />
                    <span className="p-inputgroup-addon">%</span>
                </div>
                <Button className="p-1" text severity="secondary" onClick={handleUpdate}>
                    <i className="pi pi-check" />
                </Button>
                <Button className="p-1" text severity="secondary" onClick={handleClose}>
                    <i className="pi pi-times" />
                </Button>
            </div>
        );
    }
    return (
        <div className="flex align-items-center">
            <div>
                <span className="font-bold">[</span>
                <span>{props.percentage}%</span>
                <span className="font-bold">]</span>
            </div>
            <Button className="p-1" text severity="secondary"
                onClick={handleEdit}>
                <i className="pi pi-pencil" />
            </Button>
        </div>
    );
};

export default PercentageComponent;
