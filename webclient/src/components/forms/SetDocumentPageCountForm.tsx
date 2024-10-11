import { InputNumber } from "primereact/inputnumber";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface SetDocumentPageCountAttributes {
    document_id?: number | null;
    sysno: string;
    title: string;
    barcode?: string | null;
    volume?: string | null;
    volume_year?: string | null;
    bundle?: string | null;
}

interface SetDocumentPageCountFormProps {
    attributes: SetDocumentPageCountAttributes;
    setPageCountCallback: (pageCount: number) => void;
    cancelCallback?: () => void;
}

const SetDocumentPageCountForm: React.FC<SetDocumentPageCountFormProps> = ({
    attributes,
    setPageCountCallback,
    cancelCallback,
}) => {
    const { t } = useTranslation();

    const [pageCount, setPageCount] = useState<number | null>(null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (pageCount !== null) {
            setPageCountCallback(pageCount);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            onAbort={cancelCallback}
            style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "1rem",
                alignItems: "center",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateRows: "auto auto",
                    gap: "0.5rem",
                }}
            >
                <span
                    style={{
                        maxWidth: "40ch",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {attributes.title}
                </span>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(auto-fit, minmax(100px, 1fr))`,
                        gap: "0.5rem",
                    }}
                >
                    <span>{attributes.sysno}</span>
                    {(attributes.volume || attributes.volume_year) && (
                        <span>{`${t("")}: ${
                            attributes.volume || attributes.volume_year
                        }`}</span>
                    )}
                    {attributes.bundle && (
                        <span>{`${t("")}: ${attributes.bundle}`}</span>
                    )}
                    {attributes.barcode && (
                        <span>{`${t("")}: ${attributes.barcode}`}</span>
                    )}
                </div>
            </div>
            <InputNumber
                className="w-8rem"
                autoFocus
                value={pageCount}
                onChange={(e) => setPageCount(e.value)}
                min={1}
                max={100000}
                maxFractionDigits={0}
            />
        </form>
    );
};

export default SetDocumentPageCountForm;
