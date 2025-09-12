import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import MainPage from "./pages/MainPage";
import { useAccess } from "./hooks/useAccess";

export function App() {
    const { isAuthenticated } = useAccess();

    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="*"
                    element={isAuthenticated ? <MainPage /> : <HomePage />}
                />
                {/* other public routes */}
                <Route path="*" element={<div>404 Not Found</div>} />
            </Routes>
        </BrowserRouter>
    );
}
