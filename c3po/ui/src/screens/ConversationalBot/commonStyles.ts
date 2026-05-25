import type { Theme } from "@mui/material";

export const customScrollbar = (theme: Theme) => ({
    /* width */
    "&::-webkit-scrollbar": {
        height: "10px",
        width: "10px",
        display: "none"
    },
  
    /* Track */
    "&::-webkit-scrollbar-track": {
        boxShadow: "inset 0 0 2px grey", 
        borderRadius: "10px"
    },
    
    /* Handle */
    "&::-webkit-scrollbar-thumb": {
        background: theme.palette.contrast.grayscale.level50, 
        borderRadius: "10px"
    },
    
    /* Handle on hover */
    "&::-webkit-scrollbar-thumb:hover": {
        background: theme.palette.contrast.grayscale.level50
    }
})