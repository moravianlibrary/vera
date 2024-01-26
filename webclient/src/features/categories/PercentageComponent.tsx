import React, { useEffect, useRef } from "react";

import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";

interface CateogryPercentageProps {
    node: CategoryNode
}

const CategoryPercentage: React.FC<CateogryPercentageProps> = ({ node }) => {
    const {
        handleEditPercentage,
        editPercentageNodes,
        handlePercentageChange,
        handleUpdatePercentage,
        handleClosePercentageEdit,
        focusEditPercentageIndex,
        handleGoToNextPercentage,
        handleFocusPercentageNode,
    } = useCategoryNodes();

    const inputRef = useRef(null);

    useEffect(() => {
        if (editPercentageNodes[focusEditPercentageIndex] === node && inputRef.current) {
            (inputRef.current as InputNumber).focus();
        }
    }, [focusEditPercentageIndex]);


    if (editPercentageNodes.includes(node)) {
        return (
            <div className="flex align-items-center gap-1">
                <div className="p-inputgroup flex-1" style={{ width: '115px' }}>
                    <InputNumber
                        ref={inputRef}
                        autoFocus={node === editPercentageNodes[0]}
                        onFocus={() => handleFocusPercentageNode(node)}
                        size={2}
                        value={node.percentage}
                        onValueChange={(e) => handlePercentageChange(node, e.value!)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleGoToNextPercentage();
                            }
                        }}
                        min={0} max={100}
                        maxFractionDigits={2} />
                    <span className="p-inputgroup-addon">%</span>
                </div>
                <Button className="p-1" text severity="secondary" onClick={handleUpdatePercentage}>
                    <i className="pi pi-check" />
                </Button>
                <Button className="p-1" text severity="secondary" onClick={handleClosePercentageEdit}>
                    <i className="pi pi-times" />
                </Button>
            </div>
        );
    }
    return (
        <div className="flex align-items-center">
            <div>
                <span className="font-bold">[</span>
                <span>{node.percentage}%</span>
                <span className="font-bold">]</span>
            </div>
            <Button className="p-1" text severity="secondary"
                onClick={() => handleEditPercentage(node)}>
                <i className="pi pi-pencil" />
            </Button>
        </div>
    );
};

export default CategoryPercentage;
