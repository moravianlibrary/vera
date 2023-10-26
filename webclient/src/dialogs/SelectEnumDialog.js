import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";

const SelectCategoryDialog = (props) => {
    const [title, setTitle] = useState("Select value");
    const [visible, setVisible] = useState(false);
    const [values, setValues] = useState([]);
    const [selected, setSelected] = useState(null);

    const hideDialog = () => {
        setVisible(false);
        if (props.onHide) {
            props.onHide();
        }
    };

    const handleConfirm = () => {
        if (props.onSelect) {
            props.onSelect(values.find(value => value.name === selected));
        }
        hideDialog();
    };

    useEffect(() => {
        setVisible(props.visible);
    }, [props.visible]);

    useEffect(() => {
        if (props.title) {
            setTitle(props.title);
        }
    }, [props.title]);

    useEffect(() => {
        setValues(props.values);
    }, [props.values]);

    return (
        <div>
            <Dialog
                visible={visible}
                onHide={hideDialog}
                header={title}
                style={{margin: "50px"}}
                // modal={true}
            >
                <Dropdown
                    value={selected}
                    options={values.map(value => value.name)}
                    onChange={(e) => setSelected(e.value)}
                />
                <Button style={{marginLeft: "10px"}} className="p-button-rounded p-button-text p-button-success" icon="pi pi-check" onClick={handleConfirm} />
            </Dialog>
        </div>
    );
};

export default SelectCategoryDialog;