import React from "react";
import { Toolbar } from "primereact/toolbar";

interface SubNavigationMenuProps {
    start?: React.ReactNode;
    center?: React.ReactNode;
    end?: React.ReactNode;
}

const SubNavigationMenu: React.FC<SubNavigationMenuProps> = ({
    start,
    center,
    end,
}) => {
    return (
        <div className="navbar">
            <Toolbar
                className="p-1 surface-100 w-full"
                // style={{ backgroundColor: "#ebedef" }}
                start={start}
                center={center}
                end={end}
            />
        </div>
    );
};

export default SubNavigationMenu;
