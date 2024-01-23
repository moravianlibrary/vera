import React from "react";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";

interface CategoriesChartInsertProps {
    node: CategoryNode
}

const CategoriesChartInsert: React.FC<CategoriesChartInsertProps> = ({ node }) => {
    const { handleInsertChildNode } = useCategoryNodes();

    return (
        <div onClick={() => handleInsertChildNode(node.parentNode!)} style={{ cursor: "pointer" }}>
            <i className="pi pi-plus-circle text-blue-400 m-0 p-0" />
        </div>
    );
}

export default CategoriesChartInsert;
