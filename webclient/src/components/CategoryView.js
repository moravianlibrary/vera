import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { Category } from "../models/Category";
import { InputText } from "primereact/inputtext";
import { useEffect, useState } from "react";
import { NodeType } from "../views/Categories";

const CategoryNode = (props) => {
    const { node } = props;

    const handleClick = () => {
        if (props.onClick) {
            props.onClick(node);
        }
    };

    if (node.type == NodeType.INSERT) {
        return (<InsertNode props={props} node={node} onClick={handleClick} />)
    } else if (node.type == NodeType.ROOT) {
        return (<CategoryView props={props} node={props.node} onClick={handleClick} />)
    } else if (node.type == NodeType.CATEGORY) {
        return (<CategoryView props={props} node={props.node} onClick={handleClick} />)
    }
}

const InsertNode = (props) => {
    const handleClick = () => {
        if (props.onClick) {
            props.onClick(props.node);
        }
    };

    return (
        <Button className="pi pi-plus-circle text-blue-400 m-0 p-0"
            text
            onClick={handleClick}
        />
    );
}

const CategoryView = (props) => {
    const { node } = props;
    const { t } = useTranslation();


    const { category } = node;
    const [name, setName] = useState(node.category && node.category.name);
    const [missingPagesCount, setMissingPagesCount] = useState(0);

    useEffect(() => {
        setMissingPagesCount(Math.max(node.quota - category.count_pages, 0));
    }, [node.quota]);

    const handleClick = () => {
        if (props.onClick) {
            props.onClick(node);
        }
    };

    const percentageComponent = (node) => {
        if (node.canEdit && node.isEditing) {
            return (
                <div>
                    <Button className="p-1" text>
                        <i className="pi pi-check" style={{ fontSize: '0.6rem' }} />
                    </Button>
                    <Button className="p-1" text severity="danger">
                        <i className="pi pi-times" style={{ fontSize: '0.6rem' }} />
                    </Button>
                </div>
            )
        }
        return (
            <div>
                <span className="font-bold">[</span>
                <span>{node.category.percentage}%</span>
                <span className="font-bold">]</span>
                {node.canEdit && !node.isEditing &&
                    <Button className="p-1" text severity="secondary">
                        <i className="pi pi-pencil" style={{ fontSize: '0.6rem' }} />
                    </Button>
                }
            </div>
        );
    };


    if (node.isEditing) {
    // if (!node.isEditing) {
        return (
            <div>
                <div className="flex justify-content-between align-items-baseline">
                    <div></div>
                    <InputText
                        placeholder={t('name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    /> 
                    {percentageComponent(node)}
                </div>
            </div>
        );
    }

    return (
        <div onClick={() => handleClick()} style={{ cursor: "pointer" }}>
            <div className="flex justify-content-between align-items-baseline">
                <div></div>
                <span className="font-bold text-lg mb-3">{node.category.name}</span>
                {percentageComponent(node)}
            </div>
            <div className="flex flex-column align-items-start">
                {node.category.description && <span>{category.description}</span>}
                <div><span className="font-bold">{category.count_pages}</span> {t('category_count_pages')}</div>
                {missingPagesCount > 0 &&
                <div><span className="font-bold warning">{missingPagesCount}</span> {t('category_missing_count_pages')}</div>}
                <div><span className="font-bold">{category.count_documents_with_pages}</span> {t('category_count_documents_with_pages')}</div>
                <div><span className="font-bold">{category.count_documents}</span> {t('category_count_documents')}</div>
            </div>
        </div>
    );
};

export default CategoryNode;