import { intervalToDuration } from 'date-fns';
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { authService } from "../services/Auth";

const UserInfo = () => {
    const [user, setUser] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);

    useEffect(() => {
        const updateRemainingTime = () => {
            const currentUser = authService.getCurrentUser();
            setUser(currentUser);

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
                    authService.deleteCurrentUser();
                    window.location.reload();
                }
            }
        };

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
            // onClick={isLoggedIn ? handleLogout : handleOpen}
        />
    );
};

export default UserInfo;