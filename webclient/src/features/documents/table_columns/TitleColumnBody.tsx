import React from "react";
import { IndexDocument } from "../../../adapters/ApiDocuments";

const TitleColumnBody = (document: IndexDocument) => {
    const titleStyle: any = {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
    };
    return (
        <span style={titleStyle} className="overflow-ellipsis">
            {document.title}
        </span>
    );
};

export default TitleColumnBody;
