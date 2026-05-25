import { Input, styled, Typography } from "@mui/material";
import { customScrollbar } from "../../../commonStyles";

export const AgentCrewModal = styled('div')(() => ({
    position: "absolute",
    right: "4em",
    top: "1em",
    width: "431px",
    height: "711px",
    borderRadius: "4px",
    opacity: "1",
    display: "flex",
    flexDirection: "column",
    padding: "24px",
    gap: "0px 10px",
    flexWrap: "nowrap",
    alignContent: "flex-start",
    background: "white",
    zIndex: "3",
    boxShadow: "0px 4px 10px 0px rgba(0, 0, 0, 0.3)"
}))

export const AgentCrewContent = styled('div')<{$empty: boolean}>(({theme, $empty}) => ({
    display: "flex",
    width: "100%",
    justifyContent: $empty ? "center" : "flex-start",
    flexDirection: "column",
    flexGrow: 1,
    overflow: "hidden",
    overflowY: "auto",
    ...customScrollbar(theme)

}))

export const AgentCrewHeader = styled('span')(() => ({
    width: "100%",
    display: "flex",
    
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    ".environment-select": {
        width: "100%",
        marginBottom: "1em"
    }
}))

export const AgentCrewDisclaimer = styled('div')(({theme}) => ({
    display: "flex",
    gap: theme.spacing(4),
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing(4),
    borderRadius: theme.spacing(2),
    backgroundColor: theme.palette.contrast.status.green10,
    border: `1px solid ${theme.palette.contrast.status.green100}`
}))

export const SearchInput = styled(Input)(({theme}) => ({
    display: "flex",
    alignItems: "center",
    width: "100%",
    gap: theme.spacing(2),
    height: theme.spacing(12),
    padding: `${theme.spacing(2)} ${theme.spacing(4)}`,
    border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
    borderRadius: theme.spacing(2),
    "&&&:before": {
        borderBottom: "none"
    },
    "&&:after": {
        borderBottom: "none"
    },
    '& .MuiInputBase-input': {
        ...theme.typography.p3,
    },
    '& .MuiInputBase-input::placeholder': {
        ...theme.typography.p3,
    }
}))

export const AgentCard = styled('div')(({theme}) => ({
    display: "flex",
    gap: theme.spacing(2),
    flexDirection: "column",
    padding: theme.spacing(4),
    border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
    minHeight: theme.spacing(33),
    height: theme.spacing(33),
    borderRadius: theme.spacing(2),
    width: "100%"
}))
export const AgentCardTitle = styled('span')(() => ({
    display: "flex",
    alignItems: "center",
    fontSize: "1em",
    color: "#111827",
    fontWeight: "500",
    flexGrow: 1,
    height: "2em"
}))
export const AgentCardDescription = styled(Typography)(({theme}) => ({
    color: theme.palette.contrast.grayscale.level50,
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
}))
export const AgentCrewList = styled('div')(({theme}) => ({
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(4),
}))