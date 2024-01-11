import { Button } from "primereact/button";
import { useUser } from "../models/UserContext";

const UserInfo = () => {
    const { user } = useUser();

    return (
        <Button
            style={{color: "white"}}
            text 
            // label={`${user?.username} (${timeRemaining})`}
            label={user?.username}
            disabled
            // onClick={isLoggedIn ? handleLogout : handleOpen}
        />
    );
};

export default UserInfo;