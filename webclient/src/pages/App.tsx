import React, { StrictMode } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// import Home from './Home';
import Access from "./Access";
import Navbar from "../components/Navbar";
import "../config/i18n";
import "../styles/App.css";
import "../styles/Palette.css";
import { ToastProvider } from "../contexts/toast/ToastContext";
import Categories from "../pages/Categories";
import Documents from "../pages/Documents";
import Login from "../components/Login";
import { ActionAccessRoute } from "../services/AccessService";
import { UserProvider } from "../contexts/user/UserContext";
import Tasks from "./Tasks";
import { ActionType } from "../types/ActionType";
import Home from "./Home";
import Extractions from "./Extractions";
import { AccessProvider } from "../contexts/access/AccessContext";
import NavigationMenu from "../components/NavigationMenu";

function App() {
    return (
        <ToastProvider>
            <UserProvider>
                <AccessProvider>
                    <StrictMode>
                        <Router>
                            <div className="App">
                                {/* <Navbar /> */}
                                <NavigationMenu />
                                <main>
                                    <Routes>
                                        <Route path="/" element={<Home />} />
                                        <Route
                                            path="/login"
                                            element={<Login />}
                                        />
                                        <Route
                                            element={
                                                <ActionAccessRoute
                                                    action={
                                                        ActionType.ReadDatatable
                                                    }
                                                />
                                            }
                                        >
                                            <Route
                                                path="/documents"
                                                element={<Documents />}
                                            />
                                        </Route>
                                        <Route
                                            element={
                                                <ActionAccessRoute
                                                    action={
                                                        ActionType.ReadCategories
                                                    }
                                                />
                                            }
                                        >
                                            <Route
                                                path="/categories"
                                                element={<Categories />}
                                            />
                                        </Route>
                                        <Route
                                            element={
                                                <ActionAccessRoute
                                                    action={ActionType.Extract}
                                                />
                                            }
                                        >
                                            <Route
                                                path="/extractions"
                                                element={<Extractions />}
                                            />
                                        </Route>
                                        <Route
                                            element={
                                                <ActionAccessRoute
                                                    action={
                                                        ActionType.PlanTasks
                                                    }
                                                />
                                            }
                                        >
                                            <Route
                                                path="/tasks"
                                                element={<Tasks />}
                                            />
                                        </Route>
                                        <Route
                                            element={
                                                <ActionAccessRoute
                                                    action={
                                                        ActionType.EditAccess
                                                    }
                                                />
                                            }
                                        >
                                            <Route
                                                path="/access"
                                                element={<Access />}
                                            />
                                        </Route>
                                    </Routes>
                                </main>
                            </div>
                        </Router>
                    </StrictMode>
                </AccessProvider>
            </UserProvider>
        </ToastProvider>
    );
}

export default App;
