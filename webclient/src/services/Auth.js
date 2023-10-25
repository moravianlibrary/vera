import { Component } from 'react';
import { Route } from 'react-router';
import { Outlet } from 'react-router-dom';

import { api } from './Api';

class AuthService {
    login(username, password) {
        api.getToken(username, password)
            .then(response_data => {
                if (response_data.access_token) {
                    localStorage.setItem("user", JSON.stringify(response_data));
                    console.log("User " + username + " successfully logged in.");
                }
            })
            .catch(error => {
                console.log("Error occurred while logging in: " + error);
            })
        ;
    }

    logout() {
        localStorage.removeItem("user");
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('user'));
    }

    isLoggedIn() {
        const user = this.getCurrentUser();
        return !user || !user.access_token || user.access_token === "";
    }
}

export default function authHeader(contentType = 'application/json') {
    const user = authService.getCurrentUser();
    if (user && user.access_token) {
        return {
            Authorization: 'Bearer ' + user.access_token,
            'Content-Type': contentType,
        };
    } else {
        return {};
    }
}

// export const ProtectedRoute = ({ ...rest }) => {
export const ProtectedRoute = () => {
    const user = authService.getCurrentUser();

    if (!user || !user.access_token || user.access_token === "") {
        return (
        <div>Denied</div>
        );
    }

    return <Outlet />;
};

export const authService = new AuthService();
