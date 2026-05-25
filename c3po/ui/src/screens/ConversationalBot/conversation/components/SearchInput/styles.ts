import { Button, styled, keyframes } from "@mui/material";

export const BRAND_50  = "#f8c9cf";
export const BRAND_200 = "#f193a0";
export const BRAND_400 = "#ea5d70";
export const BRAND_900 = "#5b0c16";
export const BRAND_RAW = "#c5203f";

// export const SearchInputWrapper = styled(Input)(({theme}) => ({
//     width: "100%",
//     background: theme.palette.contrast.grayscale.level0,
//     boxShadow: "0px 0px 24px 0px rgba(0, 0, 0, 0.05)",
//     boxSizing: "border-box",
//     borderRadius: theme.spacing(4),
//     padding: theme.spacing(8),

//     "> .MuiInputAdornment-positionEnd": {
//         marginRight: "1em"
//     },
//     "&&&:before": {
//         borderBottom: "none"
//     },
//     "&&:after": {
//         borderBottom: "none"
//     },
//     // " .controls": {
//     //     display: "flex",
//     //     color: "#9CA3AF"
//     // },
//     ".spinning": {
//         "svg": {
//             color: "#9CA3AF",
//         }
//     }

// }))


export const SearchInputWrapper = styled('div')(({theme}) => ({
    width: "100%",
    background: theme.palette.contrast.grayscale.level0,
    boxShadow: "0px 0px 24px 0px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
    borderRadius: theme.spacing(4),
    padding: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
}))

export const VoidButton = styled(Button)(() => ({
    minWidth: "unset",
    color: "unset",
    padding: "0px"
}))

export const InputControls = styled('div')(({theme}) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(4),
    height: theme.spacing(8),
    '> .blocked-block': {
        alignSelf: "flex-start"
    },
    '> button:disabled': {
        // TBD
        "svg": {
            color: theme.palette.contrast.grayscale.level25
        }
    }
}))

const pulseAnimate = keyframes`
  0%   { transform: scale(1);   opacity: 0.85; }
  100% { transform: scale(2);   opacity: 0;    }
`;

export const PulseButtonContainer = styled("div")({
  position: "relative",
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

export const PulseCore = styled("div")({
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  background: BRAND_400, // mid tone core fill
});

export const PulseSpan = styled("span")({
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  background: BRAND_200,            // like the video: inherit-ish from core
  opacity: 0.8,
  animation: `${pulseAnimate} 3s ease-out infinite`,
  animationDelay: "calc(1s * var(--i))", // stagger = smooth, no clunky reset
  willChange: "transform, opacity",
  pointerEvents: "none",             // don’t block clicks
  zIndex: 0,
});

export const StopIconWrap = styled("div")({
  position: "absolute",
  zIndex: 2,
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "auto",
});