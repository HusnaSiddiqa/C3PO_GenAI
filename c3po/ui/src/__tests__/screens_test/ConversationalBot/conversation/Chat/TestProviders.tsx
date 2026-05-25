import React from "react";
import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getTheme } from '../../../../../ThemeV2';

const queryClient = new QueryClient();

export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme("light")}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
