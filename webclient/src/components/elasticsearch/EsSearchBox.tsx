import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import React, { useEffect, useState } from "react";
import { SearchBoxProps, useSearchBox } from "react-instantsearch";
import { IconField } from "primereact/iconfield";
import { InputIcon } from "primereact/inputicon";

interface EsSearchBoxProps extends SearchBoxProps {}

const EsSearchBox: React.FC<EsSearchBoxProps> = (props) => {
    const { query, refine, clear } = useSearchBox(props);
    const [value, setValue] = useState("");

    useEffect(() => {
        setValue(query);
    }, [query]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        refine(value);
    };

    return (
        <form className="flex p-inputgroup" onSubmit={handleSearch}>
            <IconField iconPosition="left">
                <InputIcon className="pi pi-search" />
                <InputText
                    type="text"
                    className="ais-SearchBox-input"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                    }}
                />
            </IconField>
            <Button type="button" outlined icon="pi pi-times" onClick={clear} />
        </form>
    );
};

export default EsSearchBox;
