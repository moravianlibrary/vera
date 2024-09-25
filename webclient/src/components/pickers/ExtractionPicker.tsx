import React, { useEffect, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import ApiExtractions, { Extraction } from "../../adapters/ApiExtractions";
import { Tooltip } from "primereact/tooltip";

interface ExtractionPickerProps {
    extraction_id: number | null;
    callback(extraction_id: number | null): void;
    className?: string;
}

interface ExtractionOption {
    value: number;
    data: Extraction;
}

const ExtractionPicker: React.FC<ExtractionPickerProps> = ({
    extraction_id,
    callback,
    className,
}) => {
    // TODO: create context, virtual scroll
    // const { extractions } = useExtractions();
    const api = new ApiExtractions();
    const [extractions, setExtractions] = useState<ExtractionOption[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!loaded) {
            setLoaded(true);
            api.getPage(0, 20).then((response) => {
                setExtractions(
                    response.data.items.map((extraction) => {
                        return {
                            value: extraction.id,
                            data: extraction,
                            name: `${extraction.generated_by} ${extraction.generated_at}`,
                        };
                    })
                );
            });
        }
    }, [extractions]);

    return (
        <Dropdown
            className="w-full"
            showClear
            optionLabel="name"
            value={extraction_id}
            itemTemplate={(item) => <ExtractionItem data={item.data} />}
            valueTemplate={(value, props) => (
                <ExtractionItemValue data={value?.data} />
            )}
            options={extractions}
            onChange={(e) => callback(e.value)}
        />
    );
};

interface ExtractionItemProps {
    data: Extraction;
}

const ExtractionItem: React.FC<ExtractionItemProps> = ({ data }) => {
    return (
        <div>
            <Tooltip
                target={`.item-${data.id}`}
                content={`${data.generated_at}, Id: ${data.id}`}
            />
            <ExtractionItemValue data={data} />
        </div>
    );
};

const ExtractionItemValue: React.FC<ExtractionItemProps> = ({ data }) => {
    if (!data) {
        return <span>-</span>;
    }

    return (
        <div className={`flex justify-content-between item-${data.id}`}>
            <span>{data.generated_by}:</span>
            <span>{`${data.selected_pages}/${data.target_pages}`}</span>
        </div>
    );
};

export default ExtractionPicker;
