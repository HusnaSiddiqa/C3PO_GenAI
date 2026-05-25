import { styled, Card, Box, keyframes } from "@mui/material";
import { customScrollbar } from "../../commonStyles";
import type {} from "../../../../ThemeV2";

const rotateBorder = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
`;

export const StreamingWrapper = styled(Box, {
  shouldForwardProp: (prop) => prop !== "$isStreaming",
})<{ $isStreaming: boolean }>(({ theme, $isStreaming }) => ({
  position: "relative",
  borderRadius: theme.spacing(4),
  width: "fit-content",
  maxWidth: "100%",
  ...($isStreaming && {
    padding: "2px",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "200%",
      height: "200%",
      background:
        "conic-gradient(from 0deg, #7c3aed 0%, #2563eb 25%, #06b6d4 50%, #10b981 75%, #7c3aed 100%)",
      animation: `${rotateBorder} 3s linear infinite`,
      zIndex: 0,
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
  }),
}));

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
    maxWidth: "100%",
    flexDirection: "column",
    
}))