import { Card, styled } from "@mui/material";
import { customScrollbar } from "../../commonStyles";

export const ConversationPageContainer = styled('div')(({theme}) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "auto",
    backgroundColor: theme.palette.background.main,
    fontFamily: "Proxima Nova",
}))

export const ChatContent = styled('section')<{$role?: string}>(({theme, $role}) => ({
    padding: theme.spacing(4),
    textAlign: $role === "user" ? "end" : "start",
    "> .chat-details-option-button": {
        marginRight: "1em"
    },
}))
export const ChatContainer = styled('div')(({theme}) => ({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    overflow: "hidden",
    overflowY: "auto",
    flexGrow: 1,
    padding: theme.spacing(8),
    ...customScrollbar(theme),
    "> div": {
        display: "flex",
        flexDirection: "column",
    }
}))

export const ChatAgentBallom = styled(Card, {
    shouldForwardProp: (prop) => prop !== "$maxExpanded",
  })<{ $maxExpanded: boolean }>(({theme, $maxExpanded}) => ({
    color: theme.palette.contrast.grayscale.level75,
    padding: 0,
    boxShadow: "none",
    borderRadius: theme.spacing(4),
    display: "flex",
    width: $maxExpanded ? "calc(100vw - 10%)" : "fit-content",
    maxWidth: "90%",
    flexDirection: "column",
    backgroundColor: theme.palette.background.default,
    fontFamily: "Proxima Nova",
}))

export const ChatUserBallom = styled(Card, {
    shouldForwardProp: (prop) => prop !== "$role",
  })<{ $role: string, $error?: boolean }>(({theme, $role, $error}) => ({
    color: theme.palette.contrast.grayscale.level75,
    ...($error && {
        backgroundColor: theme.palette.contrast.status.redOff10,
        color: theme.palette.contrast.status.redOff100,
        border: `1px solid ${theme.palette.contrast.status.redOff100}`,
    }),
    padding: 0,
    borderRadius: theme.spacing(4),
    boxShadow: "none",
    display: "flex",
    width: "auto",
    maxWidth: "70%",
    flexDirection: "column",
    alignSelf: $role === "user" ? "flex-end" : "flex-start"
}))

export const BubbleHeader = styled('div')(() => ({
    display: "flex",
    paddingBottom: "12px",
    alignItems: "center",
    gap: "6px",
    alignSelf: "stretch",
    fontFamily:"Proxima Nova"
}))

export const ClickableQuestions = styled('div')(({theme}) => ({
    fontFamily: "Proxima Nova",
    color: theme.palette.contrast.status.blue,
    
}))


