import { createTheme, type Theme } from "@mui/material/styles";
import type { CSSProperties } from "react";
import ProximaNovaRegular from "./assets/fonts/Proxima-Nova/ProximaNova-Regular.ttf";
import ProximaNovaLight from "./assets/fonts/Proxima-Nova/ProximaNova-Light.ttf";
import ProximaNovaExtrabld from "./assets/fonts/Proxima-Nova/ProximaNova-Extrabld.ttf";
import ProximaNovaBold from "./assets/fonts/Proxima-Nova/ProximaNova-Bold.ttf";
import ProximaNovaBlack from "./assets/fonts/Proxima-Nova/ProximaNova-Black.ttf";
import ProximaNovaSemibold from "./assets/fonts/Proxima-Nova/ProximaNova-Semibold.ttf";
import ProximaNovaTThin from "./assets/fonts/Proxima-Nova/ProximaNovaT-Thin.ttf";
declare module "@mui/material/styles" {
  interface Theme {
    custom: {
      spacingValues: Record<string, number>;
    };
  }
  interface ThemeOptions {
    custom?: {
      spacingValues?: Record<string, number>;
    };
  }
  interface Palette {
    contrast: {
      grayscale: {
        level100: string;
        level75: string;
        level50: string;
        level25: string;
        level10: string;
        level5: string;
        level0: string;
      };
      main: {
        main100: string;
        main10: string;
      };
      status: {
        redLight: string;
        blue10: string;
        blue: string;
        green100: string;
        green10: string;
        greenOff20: string;
        red: string;
        orange: string;
        orange10: string;
        yellow: string;
        purple: string;
        pink: string;
        redOff10: string;
        redOff100: string;
      };
      fixed: {
        white: string;
        brandRed: string;
      };
    };
  }
  interface TypeBackground {
    main?: string;
  }

  interface PaletteOptions {
    background?: Partial<TypeBackground>;
    contrast?: {
      grayscale?: {
        level100?: string;
        level75?: string;
        level50?: string;
        level25?: string;
        level10?: string;
        level5?: string;
        level0?: string;
      };
      main?: {
        main100?: string;
        main10?: string;
      };
      status?: {
        blue?: string;
        blue10?: string; // <-- Add this line
        green100?: string;
        green10?: string;
        greenOff20?: string;
        red?: string;
        redLight?: string;
        orange?: string;
        orange10?: string;
        yellow?: string;
        purple?: string;
        pink?: string;
        redOff10: string;
        redOff100: string;
      };
      fixed?: {
        white?: string;
        brandRed?: string;
      };
    };
  }
  interface TypographyVariants {
    p1: CSSProperties;
    p1Bold: CSSProperties;
    p2: CSSProperties;
    p2Bold: CSSProperties;
    p3: CSSProperties;
    p3Bold: CSSProperties;
    f1: CSSProperties;
    f1Bold: CSSProperties;
    f2: CSSProperties;
    f2Bold: CSSProperties;
    f3Bold: CSSProperties;
  }

  interface TypographyVariantsOptions {
    p1?: CSSProperties;
    p1Bold?: CSSProperties;
    p2?: CSSProperties;
    p2Bold?: CSSProperties;
    p3?: CSSProperties;
    p3Bold?: CSSProperties;
    f1?: CSSProperties;
    f1Bold?: CSSProperties;
    f2?: CSSProperties;
    f2Bold?: CSSProperties;
    f3Bold?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    p1: true;
    p1Bold: true;
    p2: true;
    p2Bold: true;
    p3: true;
    p3Bold: true;
    f1: true;
    f1Bold: true;
    f2: true;
    f2Bold: true;
    f3Bold: true;
  }
}

const lightPalette = {
  black100: "#1E1E1E",
  black75: "#565656",
  black50: "#8E8E8E",
  black25: "#C7C7C7",
  black10: "#E9E9E9",
  black5: "#F4F4F4",
  black0: "#FFFFFF",

  white100: "#FFFFFF",
  brandRed: "#C5203F",

  blue100: "#4880FF",
  blue10: "#EDF2FF",

  green100: "#1CCAB8",
  green10: "#E8FAF8",

  greenOff20: "#388E3C",

  red100: "#c5203f",
  red10: "#FFECEC",
  redOff100: "#FF4343",
  redOff10: "#FFECEC",
  orange100: "#FF8743",
  orange10: "#FFF3EC",

  yellow100: "#FFD56D",
  yellow10: "#FFBF90",

  purple100: "#6226EF",
  purple10: "#EFE9FD",

  pink100: "#BA29FF",
  pink10: "#F8EAFF",

  main100: "#1B2E55",
  main10: "#E4E7EB",
};

const darkPalette = {
  white100: "#FFFFFF",
  black30: "#B6B9BE",
  black80: "#39465A",
  black95: "#19202B",
  black90: "#222839",
  blue100: "#4880FF",
  blue200: "#283857",
  green200: "#21434C",
  green20: "#57727a",
  greenOff200: "#144d17",
  red200: "#3A293A",
  redOff20: "#3e393c",
  red300: "#B11733",
  redOff200: "#432F3A",
  orange200: "#43339A",
  yellow200: "#434441",
  purple200: "#2C2A54",
  pink200: "#392B57",

  main100: "#4880FF",
  main10: "#19202B",
};

export const getTheme = (mode: "light" | "dark") => {
  const isLight = mode === "light";

  const globalTheme = createTheme({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    palette: {
      mode,
      primary: { main: isLight ? lightPalette.blue100 : darkPalette.blue200 },
      secondary: {
        main: isLight ? lightPalette.purple100 : darkPalette.purple200,
      },
      background: {
        main: isLight ? lightPalette.black5 : darkPalette.black95,
        default: isLight ? lightPalette.white100 : darkPalette.black90,
        paper: isLight ? lightPalette.black5 : darkPalette.black80,
      },
      text: {
        primary: isLight ? lightPalette.black100 : darkPalette.white100,
        secondary: isLight ? lightPalette.black75 : darkPalette.black30,
      },
      error: { main: isLight ? lightPalette.red100 : darkPalette.red200 },
      warning: {
        main: isLight ? lightPalette.orange100 : darkPalette.orange200,
      },
      info: { main: isLight ? lightPalette.blue100 : darkPalette.blue200 },
      success: { main: isLight ? lightPalette.green100 : darkPalette.green200 },
      contrast: {
        grayscale: {
          level100: isLight ? lightPalette.black100 : darkPalette.white100,
          level75: isLight ? lightPalette.black75 : darkPalette.black30,
          level50: isLight ? lightPalette.black50 : darkPalette.black30,
          level25: isLight ? lightPalette.black25 : darkPalette.black30,
          level10: isLight ? lightPalette.black10 : darkPalette.black80,
          level5: isLight ? lightPalette.black5 : darkPalette.black95,
          level0: isLight ? lightPalette.white100 : darkPalette.black90,
        },
        main: {
          main100: isLight ? lightPalette.main100 : darkPalette.main100,
          main10: isLight ? lightPalette.main10 : darkPalette.main10,
        },
        status: {
          blue: isLight ? lightPalette.blue100 : darkPalette.blue100,
          blue10: isLight ? lightPalette.blue10 : darkPalette.blue200, // <-- Add this line
          green100: isLight ? lightPalette.green100 : darkPalette.green200,
          green10: isLight ? lightPalette.green10 : darkPalette.green20,
          greenOff20: isLight
            ? lightPalette.greenOff20
            : darkPalette.greenOff200,
          red: isLight ? lightPalette.red100 : darkPalette.red200,
          redLight: isLight ? lightPalette.red10 : darkPalette.red300,
          orange: isLight ? lightPalette.orange100 : darkPalette.orange200,
          orange10: isLight ? lightPalette.orange10 : darkPalette.orange200,
          yellow: isLight ? lightPalette.yellow100 : darkPalette.yellow200,
          purple: isLight ? lightPalette.purple100 : darkPalette.purple200,
          pink: isLight ? lightPalette.pink100 : darkPalette.pink200,
          redOff10: isLight ? lightPalette.redOff10 : darkPalette.redOff20,
          redOff100: isLight ? lightPalette.redOff100 : darkPalette.redOff200,
        },
        fixed: {
          white: lightPalette.white100,
          brandRed: lightPalette.brandRed,
        },
      },
    },

    typography: {
      fontFamily: "'Proxima Nova', sans-serif",
      // Headers
      h1: {
        fontSize: "2.75rem", // 44px
        fontWeight: 700,
        lineHeight: "80%",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      h2: {
        fontSize: "2rem", // 32px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      h3: {
        fontSize: "1.75rem", // 28px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      h4: {
        fontSize: "1.5rem", // 24px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      h5: {
        fontSize: "1.125rem", // 18px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      h6: {
        fontSize: "1rem", // 16px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },

      // Paragraphs
      p1: {
        //p1
        fontSize: "1.125rem", // 18px
        fontWeight: 400,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFamily: "'Proxima Nova', sans-serif",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      p2: {
        //p2
        fontSize: "1rem", // 16px
        fontWeight: 400,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      p3: {
        //p3
        fontSize: "0.875rem", // 14px
        fontWeight: 400,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFamily: "'Proxima Nova', sans-serif",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      p1Bold: {
        //p1
        fontSize: "1.125rem", // 18px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      p2Bold: {
        //p2
        fontSize: "1rem", // 16px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFamily: "'Proxima Nova', sans-serif",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },
      p3Bold: {
        //p3
        fontSize: "0.875rem", // 16px
        fontWeight: 700,
        lineHeight: "normal",
        fontStyle: "normal",
        fontFamily: "'Proxima Nova', sans-serif",
        fontFeatureSettings: "'liga' off, 'clig' off",
      },

      // Footers
      f1: {
        fontSize: "0.75rem", // 12px
        fontWeight: 400,
        lineHeight: "normal",
      },
      f1Bold: {
        fontSize: "0.75rem", // 12px
        fontWeight: 700,
        lineHeight: "normal",
        fontFamily: "'Proxima Nova', sans-serif",
      },
      f2: {
        fontSize: "0.625rem", // 10px
        fontWeight: 400,
        lineHeight: "normal",
      },
      f2Bold: {
        fontSize: "0.625rem", // 10px
        fontWeight: 700,
        lineHeight: "normal",
      },
      f3Bold: {
        fontSize: "0.5rem", // 8px
        fontWeight: 700,
        lineHeight: "normal",
      },
    },
    spacing: 3,

    custom: {
      spacingValues: {
        xss: 3,
        xs: 6,
        sm: 12,
        md: 24,
        lg: 48,
        xl: 96,
      },
    },

    breakpoints: {
      values: {
        xs: 0, // smartphones
        sm: 600, // small and medium screens
        md: 960, // medium screens
        lg: 1280, // large screens
        xl: 1920, // extra large screens
      },
    },

    shape: {
      borderRadius: 8,
    },
  });
  globalTheme.components = {
    MuiCssBaseline: {
      styleOverrides: `
          @font-face {
            font-family: 'Proxima Nova';
            font-weight: 100; /* Thin */
            font-style: normal;
            font-display: swap;
            src: local('Proxima Nova Thin'), url(${ProximaNovaTThin}) format('truetype');
          }
          @font-face {
            font-family: 'Proxima Nova';
            font-weight: 300; /* Light */
            font-style: normal;
            font-display: swap;
            src: local('Proxima Nova Light'), url(${ProximaNovaLight}) format('truetype');
          }
          @font-face {
            font-family: 'Proxima Nova';
            font-weight: 400; /* Regular */
            font-style: normal;
            font-display: swap;
            src: local('Proxima Nova'), url(${ProximaNovaRegular}) format('truetype');
          }
          @font-face {
            font-family: 'Proxima Nova';
            font-weight: 600; /* Semi Bold */
            font-style: normal;
            font-display: swap;
            src: local('Proxima Nova Semibold'), url(${ProximaNovaSemibold}) format('truetype');
          }
          @font-face {
            font-family: 'Proxima Nova';
            font-weight: 700; /* Bold */
            font-style: normal;
            font-display: swap;
            src: local('Proxima Nova Bold'), url(${ProximaNovaBold}) format('truetype');
          }
          @font-face {
            font-family: 'Proxima Nova';
            font-weight: 800; /* Extra Bold */
            font-style: normal;
            font-display: swap;
            src: local('Proxima Nova Extrabold'), url(${ProximaNovaExtrabld}) format('truetype');
          }
          @font-face {
            font-family: 'Proxima Nova';
            font-weight: 900; /* Black */
            font-style: normal;
            font-display: swap;
            src: local('Proxima Nova Black'), url(${ProximaNovaBlack}) format('truetype');
          }
        `,
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          border: `2px solid ${globalTheme.palette.contrast.main.main100}`,
          backgroundColor: globalTheme.palette.contrast.main.main100,
        },
      },
    },

    MuiBackdrop: {
      ...globalTheme.components?.MuiBackdrop,
      styleOverrides: {
        root: {
          backgroundColor: globalTheme.palette.contrast.grayscale.level5,
          opacity: "90% !important",
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          ...globalTheme.typography.p1Bold,
          textTransform: "none",
          paddingInline: "0px",
          minWidth: "unset",
          marginRight: globalTheme.spacing(6),
          color: globalTheme.palette.contrast.grayscale.level50,
          "&.Mui-selected": {
            color: globalTheme.palette.contrast.main.main100,
          },
        },
      },
    },

    MuiButton: {
      ...globalTheme.components?.MuiButton,
      variants: [
        {
          props: { variant: "contained" },
          style: {
            backgroundColor: globalTheme.palette.contrast.main.main100,
            // "&:hover": {
            //   backgroundColor: globalTheme.palette.contrast.main.main100,
            //   opacity: "90%",
            // },
          },
        },
        {
          props: { variant: "outlined" },
          style: {
            borderColor: globalTheme.palette.contrast.grayscale.level10,
            "&:hover": {
              borderColor: globalTheme.palette.contrast.grayscale.level10,
              opacity: "90%",
            },
          },
        },
      ],
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderRadius: globalTheme.spacing(2),
          "&:hover": {
            boxShadow: "none",
          },
          "&.MuiButton-root.Mui-disabled": {
            color: globalTheme.palette.contrast.grayscale.level25,
          },
        },
      },
    },

    MuiInput: {
      ...globalTheme.components?.MuiInput,
      styleOverrides: {
        root: {
          "& .MuiInputBase-input": {
            ...globalTheme.typography.p2Bold,
            color: globalTheme.palette.contrast.grayscale.level75,
          },
          "& .MuiInputBase-input::placeholder": {
            ...globalTheme.typography.p2Bold,
            color: globalTheme.palette.contrast.grayscale.level25,
          },
          "& .MuiInputAdornment-positionEnd": {
            marginRight: "0px !important",
          },
          "> input": {
            padding: 0,
            height: globalTheme.spacing(8),
          },
        },
      },
    },
    MuiIconButton: {
      ...globalTheme.components?.MuiIconButton,
      styleOverrides: {
        root: {
          padding: `${globalTheme.spacing(2)} ${globalTheme.spacing(
            4
          )} ${globalTheme.spacing(2)} ${globalTheme.spacing(4)}`,
          borderRadius: globalTheme.spacing(2),
          border: `1px solid ${globalTheme.palette.contrast.grayscale.level10}`,
        },
      },
    },
    MuiCard: {
      ...globalTheme.components?.MuiCard,
      variants: [
        {
          props: { variant: "outlined" },
          style: {
            backgroundColor: "transparent",
            border: `1px solid ${globalTheme.palette.contrast.grayscale.level10}`,
            padding: globalTheme.spacing(8),
            borderRadius: globalTheme.spacing(4),
          },
        },
        {
          props: { variant: "elevation" },
          style: {
            position: "relative",
            backgroundColor: globalTheme.palette.background.default,
            boxShadow: "0px 0px 24px 0px #0000000D",
            padding: globalTheme.spacing(8),
            borderRadius: globalTheme.spacing(4),
          },
        },
      ],
    },
    MuiTypography: {
      ...globalTheme.components?.MuiTypography,
      variants: [
        {
          props: { variant: "p1" },
          style: globalTheme.typography.p1,
        },
        {
          props: { variant: "p2" },
          style: globalTheme.typography.p2,
        },
        {
          props: { variant: "p3" },
          style: globalTheme.typography.p3,
        },
        {
          props: { variant: "p1Bold" },
          style: globalTheme.typography.p1Bold,
        },
        {
          props: { variant: "p2Bold" },
          style: globalTheme.typography.p2Bold,
        },
        {
          props: { variant: "p3Bold" },
          style: globalTheme.typography.p3Bold,
        },
        {
          props: { variant: "f1" },
          style: globalTheme.typography.f1,
        },
        {
          props: { variant: "f1Bold" },
          style: globalTheme.typography.f1Bold,
        },
        {
          props: { variant: "f2" },
          style: globalTheme.typography.f2,
        },
        {
          props: { variant: "f2Bold" },
          style: globalTheme.typography.f2Bold,
        },
        {
          props: { variant: "f3Bold" },
          style: globalTheme.typography.f3Bold,
        },
      ],
    },
    MuiDialog: {
      ...globalTheme.components?.MuiDialog,
      styleOverrides: {
        paper: {
          border: `5px solid ${globalTheme.palette.contrast.grayscale.level10}`,
        },
      },
    },
  };
  return globalTheme;
};

export const oneLightCustom = (theme: Theme) => {
  return {
    ".codeStyle": {
      backgroundColor: theme.palette.contrast.main.main10,
      "& code > span": {
        display: "flex",
        flexWrap: "wrap",
      },
    },
    '.codeStyle code[class*="language-"]': {
      color: theme.palette.text.secondary,
      background: theme.palette.contrast.main.main10,
      fontFamily: '"Fira Code", monospace',
      fontSize: "0.875em",
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
    },
    '.codeStyle pre[class*="language-"]': {
      color: theme.palette.text.secondary,
      background: theme.palette.contrast.main.main10,
      padding: "1em",
      margin: "0",
      overflow: "auto",
      borderRadius: "6px",
    },
    ".codeStyle .token.comment": {
      color: "#a0a1a7",
      fontStyle: "italic",
    },
    ".codeStyle .token.keyword": {
      color: "#a626a4",
      fontWeight: "bold",
    },
    ".codeStyle .token.string": {
      color: "#50a14f",
    },
    ".codeStyle .token.function": {
      color: "#4078f2",
    },
    ".codeStyle .token.variable": {
      color: "#e45649",
    },
    ".codeStyle .token.number": {
      color: "#986801",
    },
    ".codeStyle .token.boolean": {
      color: "#0184bc",
      fontWeight: "bold",
    },
    ".codeStyle .token.operator": {
      color: "#0184bc",
    },
    ".codeStyle .token.punctuation": {
      color: theme.palette.text.primary,
    },
    ".codeStyle .token.class-name": {
      color: "#c18401",
    },
    ".codeStyle .token.constant": {
      color: "#986801",
    },
    ".codeStyle .token.tag": {
      color: "#e45649",
    },
    ".codeStyle .token.attr-name": {
      color: "#986801",
    },
    ".codeStyle .token.property": {
      color: "#4078f2",
    },
  };
};

export const oneDarkCustom = (theme: Theme) => {
  return {
    ".codeStyle": {
      backgroundColor: theme.palette.contrast.main.main10,
    },
    '.codeStyle code[class*="language-"]': {
      color: theme.palette.text.secondary,
      background: theme.palette.contrast.main.main10,
      fontFamily: '"Fira Code", monospace',
      fontSize: "0.875em",
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
    },
    '.codeStyle pre[class*="language-"]': {
      color: theme.palette.text.secondary,
      background: theme.palette.contrast.main.main10,
      padding: "1em",
      margin: "0",
      overflow: "auto",
      borderRadius: "6px",
    },
    ".codeStyle .token.comment": {
      color: "#5c6370",
      fontStyle: "italic",
    },
    ".codeStyle .token.keyword": {
      color: "#c678dd",
      fontWeight: "bold",
    },
    ".codeStyle .token.string": {
      color: "#98c379",
    },
    ".codeStyle .token.function": {
      color: "#61afef",
    },
    ".codeStyle .token.variable": {
      color: "#e06c75",
    },
    ".codeStyle .token.number": {
      color: "#d19a66",
    },
    ".codeStyle .token.boolean": {
      color: "#56b6c2",
      fontWeight: "bold",
    },
    ".codeStyle .token.operator": {
      color: "#abb2bf",
    },
    ".codeStyle .token.punctuation": {
      color: theme.palette.text.primary,
    },
    ".codeStyle .token.class-name": {
      color: "#e5c07b",
    },
    ".codeStyle .token.constant": {
      color: "#d19a66",
    },
    ".codeStyle .token.tag": {
      color: "#e06c75",
    },
    ".codeStyle .token.attr-name": {
      color: "#d19a66",
    },
    ".codeStyle .token.property": {
      color: "#61afef",
    },
  };
};
