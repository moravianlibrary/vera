import { Button, ButtonProps } from "primereact/button";
import { OverlayPanel } from "primereact/overlaypanel";
import React, { useRef } from "react";

interface OverlayFormLayoutProps {
    buttonProps: ButtonProps;
    form: React.ReactNode;
}

const OverlayFormLayout: React.FC<OverlayFormLayoutProps> = ({
    buttonProps,
    form,
}) => {
    const formPanel = useRef<OverlayPanel>(null);

    return (
        <div className="layout-overlay-form">
            <Button
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
