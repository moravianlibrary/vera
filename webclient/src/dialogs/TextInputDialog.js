import React, { useState, useRef, useEffect } from "react";
import { InputText } from "primereact/inputtext";
import { Dialog } from "primereact/dialog";

const TextInputDialog = (props) => {
    const { header } = props;
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState("");

    const hideDialog = () => {
        if (props.onHide) {
            console.log("onHide");
            props.onHide();
        }
        setVisible(false);
    };

    const handleInput = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    }

    const handleValueChange = (e) => {
        setValue(e.target.value);
    }; 

    const handleConfirm = () => {
        if (props.onConfirm) {
            props.onConfirm(value);
        }
        hideDialog();
    };

    useEffect(() => {
        setVisible(props.visible);
    }, [props.visible]);

    return (
        <Dialog
            header={header}
            visible={visible}
            autoFocus
            onHide={hideDialog}
            handleConfirm={handleConfirm}
        >
            <InputText
                type="text" 
                onChange={handleValueChange}
                autoFocus
                onKeyDown={handleInput}
            />
        </Dialog>
    );
}

export default TextInputDialog;