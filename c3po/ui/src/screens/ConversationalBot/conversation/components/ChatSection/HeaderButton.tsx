import { Button, styled } from "@mui/material";

export const HeaderButton = styled(Button)(({theme}) => ({
    display: "flex",
    textTransform: "none",
    gap: theme.spacing(2),
    minWidth: "unset",
    padding: `${theme.spacing(2)} ${theme.spacing(4)}`,
    height: theme.spacing(12)
}))