import { Button, ButtonProps } from "primereact/button";
import { OverlayPanel } from "primereact/overlaypanel";
import React, { useEffect, useRef } from "react";

interface OverlayFormLayoutProps {
    buttonProps: ButtonProps;
    form: React.ReactNode;
    visible?: boolean;
}

const OverlayFormLayout: React.FC<OverlayFormLayoutProps> = ({
    buttonProps,
    form,
    visible,
}) => {
    const formButton = useRef<Button>(null);
    const formPanel = useRef<OverlayPanel>(null);

    useEffect(() => {
        if (visible && formPanel.current) {
        }
    }, [visible, formPanel]);

    return (
        <div className="layout-overlay-form">
            <Button
                ref={formButton}
                className="toggle-button"
                icon={"pi pi-chevron-down"}
                {...buttonProps}
                onClick={(e) => formPanel.current!.toggle(e)}
            />
            <OverlayPanel className="overlay-panel" ref={formPanel}>
                {form}
            </OverlayPanel>
        </div>
    );
};

export default OverlayFormLayout;
