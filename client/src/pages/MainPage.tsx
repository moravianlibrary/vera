import { useState, type ReactElement } from "react";
import "@patternfly/react-core/dist/styles/base.css";

import { Routes, Route } from "react-router-dom";
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
} from "@patternfly/react-core";
import { BarsIcon } from "@patternfly/react-icons";
import ProjectsContainer from "../containers/ProjectsContainer";
// import { DashboardContainer } from "../containers/DashboardContainer";
// import { AdditionsContainer } from "../containers/AdditionsContainer";

interface NavOnSelectProps {
    groupId: number | string;
    itemId: number | string;
    to: string;
}

const MainPage = (): ReactElement => {
    const [activeItem, setActiveItem] = useState(1);

    const onNavSelect = (
        _event: React.FormEvent<HTMLInputElement>,
        selectedItem: NavOnSelectProps
    ) => {
        setActiveItem(selectedItem.itemId as number);
        console.log("selected item", selectedItem);
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

    const pageNav = (
        <Nav onSelect={onNavSelect}>
            <NavList>
                <NavItem itemId={0} isActive={activeItem === 0} to="/projects">
                    Projects
                </NavItem>
                <NavItem itemId={1} isActive={activeItem === 1} to="/">
                    Policy
                </NavItem>
                <NavItem itemId={2} isActive={activeItem === 2} to="#auth">
                    Authentication
                </NavItem>
                <NavItem itemId={3} isActive={activeItem === 3} to="#network">
                    Network services
                </NavItem>
                <NavItem itemId={4} isActive={activeItem === 4} to="#server">
                    Server
                </NavItem>
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
            <PageSection aria-labelledby="main-title">
                <Routes>
                    {/* <Route path="/dashboard" element={<DashboardContainer />} /> */}
                    <Route path="/projects" element={<ProjectsContainer />} />
                </Routes>
            </PageSection>
        </Page>
    );
};

export default MainPage;
