import { format } from 'date-fns';
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
                const timeRemainingDate = new Date(expiresOnDate - now);
                setTimeRemaining(format(timeRemainingDate, 'HH:mm:ss'));
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