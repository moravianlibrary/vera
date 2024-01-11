import { intervalToDuration } from 'date-fns';
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { accessService } from '../services/AccessService';
import { useKeycloak, useKeycloakEvents } from '../services/Keycloak';

const UserInfo = () => {
    const { keycloak } = useKeycloak();
    const events = useKeycloakEvents();

    const [user, setUser] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);

    useEffect(() => {
        events.afterLogin(() => {
            accessService.getCurrentUser();
        });
    }, [events]);

    useEffect(() => {
        const updateCurrentUser = () => {
            if (keycloak.isLoggedIn) {
                accessService.loadCurrentUser();
            }
        };

        const updateRemainingTime = () => {
            const currentUser = accessService.getCurrentUser();
        
            if (currentUser === null) {
                return;
            }

            if (currentUser?.expires_on) {
                const expiresOnDate = new Date(currentUser.expires_on);
                const now = new Date();
                if (expiresOnDate - now >= 0) {
                    const duration = intervalToDuration({start: now, end: expiresOnDate});
                    const hours = duration.hours.toString().padStart(2, '0');
                    const minutes = duration.minutes.toString().padStart(2, '0');
                    const seconds = duration.seconds.toString().padStart(2, '0');
                    setTimeRemaining(`${hours}:${minutes}:${seconds}`);
                } else {
                    setTimeRemaining('00:00:00');
                    // authService.deleteCurrentUser();
                    window.location.reload();
                }
            }
        };

        updateCurrentUser();
        updateRemainingTime();
        const intervalId = setInterval(updateRemainingTime, 1000);
        return () => {
            clearInterval(intervalId);
        };
    }, []);

    return (
        <Button
            style={{color: "white"}}
            text 
            label={`${user?.username} (${timeRemaining})`}
            disabled
            // onClick={isLoggedIn ? handleLogout : handleOpen}
        />
    );
};

export default UserInfo;