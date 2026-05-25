import React, { createContext, useState, useEffect } from "react";
import { decodeToken } from "../sso/decodeToken"; // Adjust path if needed
import { useConfig } from "./ConfigContext";

export interface User {
  userId: string;
  userName: string;
  userRole: "admin" | "user" | "";
}

export interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
});

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUserState] = useState<User | null>(null);
  const { config } = useConfig();

  useEffect(() => {
    // Load user from authToken in localStorage on mount
    const token = localStorage.getItem("authToken");
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        const userRole = decoded.groups?.includes(
          config.admin_ad_group
        )
          ? "admin"
          : "user";
        setUserState({
          userId: decoded.sub,
          userName: decoded.userinfo.name,
          userRole,
        });
      }
    }
  }, [config.admin_ad_group]);

  const setUser = (user: User | null) => {
    setUserState(user);
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};
