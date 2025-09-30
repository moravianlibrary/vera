import { useState, type ReactElement } from "react";
import "@patternfly/react-core/dist/styles/base.css";

import {
    Routes,
    Route,
    Link,
    useNavigate,
    useLocation,
} from "react-router-dom";
import {
    Page,
    Masthead,
    PageSidebar,
    PageSection,
    PageSectionVariants,
    Nav,
    NavList,
    NavItem,
    Brand,
    Button,
    Content,
    MastheadMain,
    MastheadToggle,
    PageToggleButton,
    MastheadBrand,
    MastheadLogo,
    MastheadContent,
    PageSidebarBody,
    Card,
    NavExpandable,
} from "@patternfly/react-core";
import ProjectsContainer from "../containers/ProjectsContainer";
import { useTranslation } from "react-i18next";
import DocumentsSection from "./DocumentsSection";

interface NavigationItem {
    key: string;
    to: string;
}

interface NavigationSection {
    section: string;
    items: NavigationItem[];
}

const NAVIGATION_CONFIG: (NavigationSection | NavigationItem)[] = [
    { key: "home", to: "/" },
    {
        section: "documents",
        items: [
            { key: "document-list", to: "/documents" },
            { key: "document-proposals", to: "/documents/proposals" },
            { key: "document-additions", to: "/documents/additions" },
            { key: "catalog-records", to: "/catalog-records" },
        ],
    },
    {
        section: "organization-and-planning",
        items: [
            { key: "categories", to: "/categories" },
            { key: "intentions", to: "/intentions" },
            { key: "projects", to: "/projects" },
        ],
    },
    {
        section: "digitization",
        items: [{ key: "lists", to: "/digitization-lists" }],
    },
    { key: "tasks", to: "/tasks" },
    { key: "watchdogs", to: "/watchdogs" },
    {
        section: "access-management",
        items: [
            { key: "groups", to: "/groups" },
            { key: "roles", to: "/roles" },
        ],
    },
    {
        section: "system-management",
        items: [
            { key: "settings", to: "/settings" },
            { key: "plugins", to: "/plugins" },
            { key: "watchdogs", to: "/system-watchdogs" },
            { key: "maintenance", to: "/maintenance" },
        ],
    },
];

interface NavigationItemReverse extends NavigationItem {
    section: string;
}

const NAVIGATION_ITEMS: NavigationItemReverse[] = NAVIGATION_CONFIG.flatMap(
    (section) =>
        "items" in section
            ? section.items.map((item) => ({
                  ...item,
                  section: section.section,
              }))
            : [{ ...section, section: "n/a" }]
).filter((item) => item.key !== "home");

interface NavOnSelectProps {
    groupId: number | string;
    itemId: number | string;
    to: string;
}

const MainPage = (): ReactElement => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    const initItem = NAVIGATION_ITEMS.filter((item) =>
        location.pathname.startsWith(item.to)
    ).sort((a, b) => b.to.length - a.to.length)[0];

    const [activeGroup, setActiveGroup] = useState<string>(
        initItem?.section || "n/a"
    );
    const [activeItem, setActiveItem] = useState<string>(
        initItem?.key || "home"
    );

    const onNavSelect = (
        _event: React.FormEvent<HTMLInputElement>,
        selectedItem: NavOnSelectProps
    ) => {
        _event.preventDefault();
        setActiveItem(selectedItem.itemId as string);
        navigate(selectedItem.to);
    };

    const masthead = (
        <Masthead>
            <MastheadMain>
                <MastheadToggle>
                    <PageToggleButton
                        isHamburgerButton
                        aria-label="Global navigation"
                    />
                </MastheadToggle>
                {/* <MastheadBrand>
                    <MastheadLogo>
                        <Brand
                            src={pfLogo}
                            alt="PatternFly"
                            heights={{ default: "36px" }}
                        />
                    </MastheadLogo>
                </MastheadBrand> */}
            </MastheadMain>
            <MastheadContent>
                <a>Content</a>
            </MastheadContent>
        </Masthead>
    );

    const navItem = (item: NavigationItem, section?: string) => {
        return (
            <NavItem
                key={item.key}
                itemId={item.key}
                to={item.to}
                isActive={activeItem === item.key}
            >
                {section
                    ? t(`navbar:${section}.${item.key}`)
                    : t(`navbar:${item.key}`)}
            </NavItem>
        );
    };

    const navSection = (section: NavigationSection) => {
        return (
            <NavExpandable
                key={section.section}
                groupId={section.section}
                isActive={activeGroup === section.section}
                isExpanded={activeGroup === section.section}
                title={t(`navbar:${section.section}.section-title`)}
            >
                {section.items.map((item) => navItem(item, section.section))}
            </NavExpandable>
        );
    };

    // TODO: This is compact version of sidebar, make also expanded version and toggle between them
    // Expanded version should have Sections instead of Expandables
    const pageNav = (
        <Nav onSelect={onNavSelect}>
            <NavList>
                {NAVIGATION_CONFIG.map((entry) =>
                    "section" in entry ? navSection(entry) : navItem(entry)
                )}
            </NavList>
        </Nav>
    );

    const sidebar = (
        <PageSidebar>
            <PageSidebarBody>{pageNav}</PageSidebarBody>
        </PageSidebar>
    );

    return (
        <Page masthead={masthead} sidebar={sidebar} isManagedSidebar>
            <Routes>
                <Route path="/documents" element={<DocumentsSection />} />
                <Route path="/projects" element={<ProjectsContainer />} />
            </Routes>
        </Page>
    );
};

export default MainPage;
