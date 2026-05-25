import React, { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { Outlet, useSearchParams } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { getTheme } from "../ThemeV2";
import Header from "../screens/ConversationalBot/conversation/components/Header/Header";

export default function Layout() {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("embed") === "true";

  // Initialize mode from localStorage, fallback to "light"
  const [mode, setMode] = useState<"light" | "dark">(
    () => (localStorage.getItem("themeMode") as "light" | "dark") || "light"
  );

  const toggleTheme = () => {
    setMode((prev) => {
      const newMode = prev === "light" ? "dark" : "light";
      localStorage.setItem("themeMode", newMode); // Persist to localStorage
      return newMode;
    });
  };

  const theme = useMemo(() => getTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          flexGrow: 1,
          position: "absolute",
          top: "0px",
          left: "0px",
          right: "0",
          bottom: "0",
          overflowY: "auto",
          fontFamily: "Proxima Nova",
        }}
      >
        {!isEmbed && <Header toggleTheme={toggleTheme} mode={mode} />}
        <Outlet />
      </Box>
    </ThemeProvider>
  );
}
