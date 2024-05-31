import React, { forwardRef, useImperativeHandle, useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { IntentionCreate } from "../../../adapters/ApiCategories";
import IntentionForm from "../../../components/forms/IntentionForm";

interface EditIntentionMenuProps {
    intention: IntentionCreate;
    intentionId?: number;
    callback: (intention: IntentionCreate, intentionId?: number) => void;
}

interface EditIntentionMenuRef {
    toggle: () => void;
}

const EditIntentionMenu: React.ForwardRefRenderFunction<
    unknown,
    EditIntentionMenuProps
> = ({ intention, intentionId, callback }, ref) => {
    const [visible, setVisible] = useState(false);

    useImperativeHandle(
        ref,
        () => ({
            toggle() {
                setVisible(!visible);
            },
        }),
        [visible]
    );

    const handleSubmit = (intention: IntentionCreate) => {
        callback(intention, intentionId);
        setVisible(false);
    };

    return (
        <Sidebar
            visible={visible}
            onHide={() => setVisible(false)}
            position="bottom"
            className="h-min"
        >
            <IntentionForm
                intention={intention}
                onSubmit={handleSubmit}
                onAbort={() => setVisible(false)}
            />
        </Sidebar>
    );
};

export default forwardRef(EditIntentionMenu);
export type { EditIntentionMenuRef };
