import React, { createContext, useContext, useState } from 'react';
import { User } from './User'; // Assuming you have defined your User class

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const setUserContext = (userData) => {
    const newUser = User.createUser(userData);
    setUser(newUser);
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
