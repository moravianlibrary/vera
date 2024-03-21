import React, { useEffect, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import ApiExtractions from "../../adapters/ApiExtractions";
import ExtractionModel from "../../contexts/extractions/ExtractionModel";
import { Tooltip } from "primereact/tooltip";

interface ExtractionPickerProps {
    extraction_id: number | null;
    callback(extraction_id: number | null): void;
    className?: string;
}

interface ExtractionOption {
    value: number;
    data: ExtractionModel;
}

const ExtractionPicker: React.FC<ExtractionPickerProps> = ({
    extraction_id,
    callback,
    className,
}) => {
    // TODO: create context, virtual scroll
    // const { extractions } = useExtractions();
    const [extractions, setExtractions] = useState<ExtractionOption[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!loaded) {
            setLoaded(true);
            ApiExtractions.getExtractions(0, 20).then((response) => {
                setExtractions(
                    response.data.extractions.map((extraction) => {
                        const extractionModel = new ExtractionModel(extraction);
                        return {
                            value: extractionModel.id,
                            data: extractionModel,
                            name: `${extractionModel.extractor} ${extractionModel.extracted_at}`,
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
    data: ExtractionModel;
}

const ExtractionItem: React.FC<ExtractionItemProps> = ({ data }) => {
    return (
        <div>
            <Tooltip
                target={`.item-${data.id}`}
                content={`${data.extracted_at}, Id: ${data.id}`}
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
            <span>{data.extractor}:</span>
            <span>{`${data.extracted_pages}/${data.target_pages}`}</span>
        </div>
    );
};

export default ExtractionPicker;
