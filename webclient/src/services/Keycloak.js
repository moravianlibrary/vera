import { Axios } from "axios";
import { createContext, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";

const keycloakProperties = {
    // url: process.env.REACT_APP_KEYCLOAK_SERVER_URL,
    // realm: process.env.REACT_APP_KEYCLOAK_REALM,
    // clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID,
    url: 'https://keycloak.osdd.mzk.cz',
    realm: 'mzk',
    clientId: 'vera',
    redirectUri: window.location.origin + '/login',
    exchangeCodeUri: 'http://localhost:8000/auth/token',
};

class Keycloak {
    constructor(keycloakProperties) {
        this.url = keycloakProperties.url;
        this.realm = keycloakProperties.realm;
        this.clientId = keycloakProperties.clientId;
        this.redirectUri = keycloakProperties.redirectUri;
        this.exchangeCodeUri = keycloakProperties.exchangeCodeUri;

        const keycloak = JSON.parse(localStorage.getItem('keycloak'));

        this.isLoggedIn = keycloak?.isLoggedIn ? keycloak.isLoggedIn : false;
        this.token = keycloak?.token ? keycloak.token : null;
        this.expiresAt = keycloak?.expiresAt ? keycloak.expiresAt : null;
    }

    async login() {
        if (this.isLoggedIn) {
            return;
        }
        localStorage.setItem('after_login_redirect', JSON.stringify(window.location.pathname));

        const url = `${this.url}/realms/${this.realm}/protocol/openid-connect/auth`;
        const query = {
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
        };

        const queryParams = new URLSearchParams(query);
        const loginUrl = `${url}?${queryParams.toString()}`;
        window.location.href = loginUrl;
    }

    async exchangeCodeForToken(code) {
        if (this.exchangeInProgress) {
            return;
        }
        this.exchangeInProgress = true;

        const query = {
            code: code,
            redirect_uri: this.redirectUri,
        };

        const queryParams = new URLSearchParams(query);
        const urlWithParams = `${this.exchangeCodeUri}?${queryParams.toString()}`;

        try {
            const response = await fetch(urlWithParams, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const responseData = await response.json();
            this.token = responseData.access_token;
            this.expiresAt = responseData.expires_in;
            this.isLoggedIn = true;
            localStorage.setItem('token', this.token);
            localStorage.setItem('keycloak', JSON.stringify(this));
        } catch (error) {
            console.error('Fetch error:', error);
            this.token = null;
            this.expiresIn = -1;
            this.isLoggedIn = false;
            localStorage.removeItem('token');
            localStorage.removeItem('keycloak');
        } finally {
            this.exchangeInProgress = false;
        }
    }

    async logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('keycloak');

        const currentURI = window.location.href;
        const keycloakLogoutUrl = `${this.url}/realms/${this.realm}/protocol/openid-connect/logout?redirect_uri=${currentURI}`;
        window.location.href = keycloakLogoutUrl;
    }

    redirect() {
        const redirect = JSON.parse(localStorage.getItem('after_login_redirect'));
        window.location.href = redirect;
    }

    static parseExpiration(expiresIn) {
        const now = new Date();
        const expirationTime = now.getTime() + expiresIn * 1000;
        return new Date(expirationTime);
    }
};

const KeycloakEventContext = createContext();

export const useKeycloakEvents = () => {
    return useContext(KeycloakEventContext);
};

const KeycloakEventProvider = ({ children }) => {
    const events = {
        afterLogin: () => {},
        afterLogout: () => {},
    };

    return (
        <KeycloakEventContext.Provider value={events}>
            {children}
        </KeycloakEventContext.Provider>
    );
};

const KeycloakContext = createContext();

const KeycloakProvider = ({ children }) => {
  const keycloakInstance = new Keycloak(keycloakProperties);

  return (
    <KeycloakEventProvider>
        <KeycloakContext.Provider value={keycloakInstance}>
            {children}
        </KeycloakContext.Provider>
    </KeycloakEventProvider>
  );
};

export const useKeycloak = () => {
    const keycloakInstance = useContext(KeycloakContext);
    const location = useLocation();
    const events = useKeycloakEvents();


    if (!keycloakInstance) {
        throw new Error('useKeycloak must be used within a KeycloakProvider');
    }

    useEffect(() => {
        const exchangeCodeForToken = async () => {
            const params = new URLSearchParams(location.search);
            const code = params.get('code');
            if (code !== null) {
                await keycloakInstance.exchangeCodeForToken(code);
                if (keycloakInstance.isLoggedIn) {
                    events.afterLogin();
                    keycloakInstance.redirect();
                }
            }
        };
        if (!keycloakInstance.isLoggedIn) {
            exchangeCodeForToken();
        }
        console.log(keycloakInstance);
    }, [location]);

    return {
        keycloak: keycloakInstance,
    };
};

export default KeycloakProvider;
