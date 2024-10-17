import React, { StrictMode } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// import Home from './Home';
import "../config/i18n";
import "../styles/App.css";
import "../styles/Layouts.css";
import "../styles/Palette.css";
import { ToastProvider } from "../contexts/ToastContext";
import Categories from "../pages/Categories";
import Documents from "../pages/Documents";
import Login from "../components/Login";
import Tasks from "./Tasks";
import { ActionType } from "../types/ActionType";
import Home from "./Home";
import { AccessProvider } from "../contexts/AccessContext";
import NavigationMenu from "../components/NavigationMenu";
import ActionAccessRoute from "../components/access/ActionAccessRoute";
import CatalogRecords from "./CatalogRecords";
import WithProviders from "../components/wrappers/WithProviders";
import { ConfirmDialog } from "primereact/confirmdialog";
import PeriodicTasks from "./PeriodicTasks";
import { NotificationProvider } from "../contexts/NotificationContext";
import DigitizationLists from "./DigitizationLists";
import Locations from "./Locations";
import Extractions from "./Extractions";
import Departments from "./Departments";
import Roles from "./Roles";

function Routing() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route
                element={
                    <ActionAccessRoute action={ActionType.ReadDatatable} />
                }
            >
                <Route path="/documents" element={<Documents />} />
            </Route>
            <Route
                element={
                    <ActionAccessRoute action={ActionType.ReadCatalogRecords} />
                }
            >
                <Route path="/catalog-records" element={<CatalogRecords />} />
            </Route>
            <Route
                element={
                    <ActionAccessRoute action={ActionType.ReadCategories} />
                }
            >
                <Route path="/categories" element={<Categories />} />
            </Route>
            <Route element={<ActionAccessRoute action={ActionType.Extract} />}>
                <Route path="/extractions" element={<Extractions />} />
            </Route>
            <Route element={<ActionAccessRoute action={ActionType.Extract} />}>
                <Route
                    path="/extractions/digitization-lists"
                    element={<DigitizationLists />}
                />
            </Route>
            <Route element={<ActionAccessRoute action={ActionType.Extract} />}>
                <Route path="/extractions/locations" element={<Locations />} />
            </Route>
            <Route
                element={<ActionAccessRoute action={ActionType.PlanTasks} />}
            >
                <Route path="/tasks" element={<Tasks />} />
            </Route>
            <Route
                element={<ActionAccessRoute action={ActionType.AdminTasks} />}
            >
                <Route path="/tasks/periodic" element={<PeriodicTasks />} />
            </Route>
            <Route
                element={<ActionAccessRoute action={ActionType.EditAccess} />}
            >
                <Route path="/departments" element={<Departments />} />
            </Route>
            <Route
                element={<ActionAccessRoute action={ActionType.EditAccess} />}
            >
                <Route path="/roles" element={<Roles />} />
            </Route>
        </Routes>
    );
}

function App() {
    return (
        <WithProviders
            providers={[AccessProvider, ToastProvider, NotificationProvider]}
        >
            <StrictMode>
                <Router>
                    <main className="app">
                        <NavigationMenu />
                        <div className="content">
                            <Routing />
                        </div>
                        <ConfirmDialog />
                    </main>
                </Router>
            </StrictMode>
        </WithProviders>
    );
}

export default App;
