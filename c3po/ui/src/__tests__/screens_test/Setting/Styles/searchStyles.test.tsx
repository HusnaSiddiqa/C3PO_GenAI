import React from "react";
import { render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Search, SearchIconWrapper, StyledInputBase } from "../../../../screens/Setting/components/Styles/searchStyles";


const theme = createTheme({
  palette: {
    grey: { 400: "#ccc" },
    contrast: { main: { main100: "#1976d2" } },
  },
  spacing: (...args: any[]) => args.length === 2 ? `${args[0] * 8}px ${args[1] * 8}px` : `${args[0] * 8}px`,
});

describe("searchStyles components", () => {
  it("renders Search with correct styles", () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Search data-testid="search-div">Search Content</Search>
      </ThemeProvider>
    );
    const searchDiv = container.querySelector('[data-testid="search-div"]');
    expect(searchDiv).toBeInTheDocument();
    expect(searchDiv).toHaveStyle("position: relative");
    expect(searchDiv).toHaveStyle("width: 200px");
    expect(searchDiv).toHaveStyle("height: 36px");
    expect(searchDiv).toHaveStyle("border-width: 1px");
    expect(searchDiv).toHaveStyle("padding-top: 6px");
    expect(searchDiv).toHaveStyle("padding-bottom: 6px");
    expect(searchDiv).toHaveStyle("padding-left: 12px");
    expect(searchDiv).toHaveStyle("border-top-left-radius: 6px");
    expect(searchDiv).toHaveStyle("border-bottom-left-radius: 6px");
    expect(searchDiv).toHaveStyle("border-style: solid");
    expect(searchDiv).toHaveStyle("border-color: #ccc");
    expect(searchDiv).toHaveStyle("display: flex");
    expect(searchDiv).toHaveStyle("align-items: center");
  });

  it("renders SearchIconWrapper with correct styles", () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <SearchIconWrapper data-testid="icon-wrapper">Icon</SearchIconWrapper>
      </ThemeProvider>
    );
    const iconWrapper = container.querySelector('[data-testid="icon-wrapper"]');
    expect(iconWrapper).toBeInTheDocument();
    expect(iconWrapper).toHaveStyle("height: 34.8px");
    expect(iconWrapper).toHaveStyle("position: relative");
    expect(iconWrapper).toHaveStyle("display: flex");
    expect(iconWrapper).toHaveStyle("align-items: center");
    expect(iconWrapper).toHaveStyle("justify-content: end");
    expect(iconWrapper).toHaveStyle("background-color: #1976d2");
  });

  it("renders StyledInputBase", () => {
    const { getByTestId } = render(
      <ThemeProvider theme={theme}>
        <StyledInputBase data-testid="input-base" />
      </ThemeProvider>
    );
    expect(getByTestId("input-base")).toBeInTheDocument();
  });
  });