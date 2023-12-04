import { Button } from "primereact/button";
import { Menu } from 'primereact/menu';
import { SplitButton } from 'primereact/splitbutton';
import { MultiSelect } from 'primereact/multiselect';
import { useTranslation } from "react-i18next";
import { InputText } from "primereact/inputtext";
import { useEffect, useRef, useState } from "react";
import { NodeType } from "../categories/Categories";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from 'primereact/checkbox';
import { Panel } from "primereact/panel";
import { Card } from "primereact/card";
import { Chip } from 'primereact/chip';
import { InputNumber } from "primereact/inputnumber";

const CategoryNode = (props) => {
    if (!props.node) {
        return;
    } else if (props.node.type == NodeType.INSERT) {
        return (<InsertNode {...props} />)
    } else if (props.node.type == NodeType.ROOT) {
        return (<CategoryView {...props} />)
    } else if (props.node.type == NodeType.CATEGORY) {
        return (<CategoryView {...props} />)
    } else if (props.node.type == NodeType.UPDATE_CATEGORY) {
        return (<UpdateCategoryView {...props} />)
    }
}

const InsertNode = (props) => {
    const handleClick = () => {
        if (props.onClick) {
            props.onClick(props.node);
        }
    };

    return (
        <div onClick={() => handleClick()} style={{ cursor: "pointer" }}>
            <i className="pi pi-plus-circle text-blue-400 m-0 p-0" />
        </div>
    );
}

const PercentageComponent = (props) => {
    const [editMode, setEditMode] = useState(false);
    const [value, setValue] = useState(props.percentage ? props.percentage : 0);
    const [autoFocusInput, setAutoFocusInput] = useState(false);

    const handleEdit = () => {
        if (props.onEditPercentage) {
            props.onEditPercentage(props.node);
        }
    };

    const handleValueChange = (e) => {
        setValue(e.value);
        if (props.onPercentageChange) {
            props.onPercentageChange(props.node, e.value);
        }
    };

    const handleUpdate = () => {
        if (props.onUpdatePercentage) {
            props.onUpdatePercentage();
        }
    };

    const handleClose = () => {
        if (props.onClosePercentageEditing) {
            props.onClosePercentageEditing();
        }
    };

    useEffect(() => {
        setValue(props.node.category.percentage);
        setEditMode(props.editPercentageNodes.includes(props.node));
        setAutoFocusInput(props.editPercentageNodes.length > 0 && props.editPercentageNodes[0] == props.node);
    }, [props.editPercentageNodes, props.node]);

    if (editMode) {
        return (
            <div className="flex align-items-center gap-1">
                <div className="p-inputgroup flex-1" style={{ width: '115px' }}>
                    <InputNumber
                        autoFocus={autoFocusInput}
                        size={2}
                        value={value}
                        onValueChange={handleValueChange}
                        min={0} max={100}
                        maxFractionDigits={2} />
                    <span className="p-inputgroup-addon">%</span>
                </div>
                <Button className="p-1" text severity="secondary" onClick={handleUpdate}>
                    <i className="pi pi-check" />
                </Button>
                <Button className="p-1" text severity="secondary" onClick={handleClose}>
                    <i className="pi pi-times" />
                </Button>
            </div>
        );
    }
    return (
        <div className="flex align-items-center">
            <div>
                <span className="font-bold">[</span>
                <span>{props.percentage}%</span>
                <span className="font-bold">]</span>
            </div>
            <Button className="p-1" text severity="secondary"
                onClick={handleEdit}>
                <i className="pi pi-pencil" />
            </Button>
        </div>
    );
};

const CategoryEditMenu = (props) => {
    const menuRef = useRef(null);

    const handleToggleMenu = (e) => {
        menuRef.current.toggle(e);
    };

    const handleEditCategory = (e) => {
        handleToggleMenu(e);
        if (props.onEdit) {
            props.onEdit(props.node);
        }
    };

    const handleDeleteCategory = (e) => {
        handleToggleMenu(e);
        if (props.onDelete) {
            props.onDelete(props.node);
        }
    };

    const items = [
        {
            template: (item, options) => {
                return (
                    <Button className="p-1" text severity="secondary" onClick={handleEditCategory}>
                        <i className="pi pi-pencil" />
                    </Button>
                )
            }
        }, {
            separator: true
        }, {
            template: (item, options) => {
                return (
                    <Button className="p-1" text severity="secondary" onClick={handleDeleteCategory}>
                        <i className="pi pi-trash" />
                    </Button>
                )
            }
        }
    ];

    return (
        <div className="flex">
            <Menu
                className="surface-300 w-auto"
                model={items}
                popup
                popupAlignment="right"
                template={<div></div>}
                ref={menuRef} />
            <Button className="p-1" text severity="secondary" onClick={handleToggleMenu}>
                <i className="pi pi-cog" />
            </Button>
        </div>
    );
};

const CategoryView = (props) => {
    const { node } = props;
    const { t } = useTranslation();


    const { category } = node;
    const [missingPagesCount, setMissingPagesCount] = useState(0);

    useEffect(() => {
        setMissingPagesCount(Math.max(node.quota - category.count_pages, 0));
    }, [node.quota]);

    const handleClick = () => {
        if (props.onClick) {
            props.onClick(node);
        }
    };

    return (
        <div>
            <div className="flex justify-content-between align-items-baseline gap-2">
                {node.type == NodeType.CATEGORY && <CategoryEditMenu {...props} />}
                <span className="font-bold text-lg mb-3"
                    onClick={() => handleClick()}
                    style={{ cursor: "pointer" }}
                >
                    {node.category.name}
                </span>
                {node.type == NodeType.CATEGORY &&
                    <PercentageComponent percentage={node.category.percentage} {...props} />
                }
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

const UpdateCategoryView = (props) => {
    const { t } = useTranslation();
    const { node } = props;
    const departmentsOptions = props.departments;

    const { category } = node;
    const [name, setName] = useState(node.category && node.category.name);
    const [description, setDescription] = useState(node.category && node.category.description);
    const [assignable, setAssignable] = useState(node.category && node.category.assignable);
    const [departments, setDepartments] = useState(node.category && node.category.departments);

    const handleUpdate = () => {
        if (props.onUpdate) {
            const values = {
                name: name,
                description: description,
                assignable: assignable,
                departments: departments
            }
            props.onUpdate(node, values);
        }
        handleCloseEditing();
    }

    const handleCloseEditing = () => {
        if (props.onCloseEditing) {
            props.onCloseEditing(node);
        }
    }

    return (
        <div>
            <div className="flex flex-column gap-3">
                <div className="flex jsutify-content-start gap-2">
                    <Button className="p-1 surface-200" text severity="success" onClick={handleUpdate}>
                        <i className="pi pi-check" style={{ fontSize: '0.75rem' }} />
                    </Button>
                    <Button className="p-1 surface-200" text severity="danger" onClick={handleCloseEditing}>
                        <i className="pi pi-times" style={{ fontSize: '0.75rem' }} />
                    </Button>
                </div>
                <InputText
                    placeholder={t('name')}
                    keyfilter="alphanum"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                /> 
                <InputTextarea
                    placeholder={t('description')}
                    keyfilter="alphanum"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex align-items-center">
                    <Checkbox
                        inputId="assignable"
                        onChange={e => setAssignable(e.checked)}
                        checked={assignable}
                    />
                    <label htmlFor="assignable" className="ml-2">{t('assignable_category')}</label>
                </div>
                {departmentsOptions && departmentsOptions.length > 0 &&
                <div className="flex flex-column gap-1">
                    <span className="text-left">{t('use_category_departments')}:</span>
                    <div className="card flex justify-content-center">
                        <MultiSelect
                            placeholder={t('select_departments')}
                            value={departments} 
                            onChange={(e) => setDepartments(e.value)} 
                            options={departmentsOptions} 
                            optionLabel="name"
                            className="w-full md:w-20rem"
                            // selectedItemTemplate={(value) => <span>{value.name}</span>}
                            display="chip" 
                        />
                    </div>
                </div>}
            </div>
        </div>
    );
};

export default CategoryNode;