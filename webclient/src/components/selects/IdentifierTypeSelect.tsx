import { Dropdown } from "primereact/dropdown";
import { IdentifierType } from "../../types/IdentifierType";
import { IdentifierTypeSelectItems } from "../../data/factories/DropdownItemsFactory";

interface IdentifierTypeSelectProps {
    value: IdentifierType;
    callback: (value: IdentifierType) => void;
}

const IdentifierTypeSelect: React.FC<IdentifierTypeSelectProps> = ({
    value,
    callback,
}) => {
    return (
        <Dropdown
            options={IdentifierTypeSelectItems()}
            value={value}
            onChange={(e) => callback(e.value)}
        />
    );
};

export default IdentifierTypeSelect;
