import { styled } from "@mui/material/styles";
import {
  ChatCenteredDots,
  Copy,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import { css } from "@emotion/react"; // FIXED: Correct import

export const MessageActions = styled('div')(({ theme }) => ({
  display: "flex",
  gap: "5px",
  color: theme.palette.contrast.grayscale.level50,
  marginLeft: "auto",
}));

export const iconStyles = ({ selected, theme }: { selected?: boolean; theme }) => css`
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  padding: 2px;
  ${selected &&
    `
      border-color: ${theme.palette.contrast.grayscale.level10};
      color: ${theme.palette.contrast.grayscale.level10} !important;
    `}
`;

// Styled ThumbsUp
export const StyledThumbsUp = styled(ThumbsUp, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ selected, theme }) => ({
  ...iconStyles({ selected, theme }),
  color: selected
    ? theme.palette.contrast.grayscale.level75
    : theme.palette.contrast.grayscale.level50,
}));

// Styled ThumbsDown
export const StyledThumbsDown = styled(ThumbsDown, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ selected, theme }) => ({
  ...iconStyles({ selected, theme }),
  color: selected
    ? theme.palette.contrast.grayscale.level75
    : theme.palette.contrast.grayscale.level50,
}));

export const StyledCopy = styled(Copy)<{ selected?: boolean }>`
  ${({ selected, theme }) => iconStyles({ selected, theme })}
`;

export const StyledChatCenteredDots = styled(ChatCenteredDots)<{ selected?: boolean }>`
  ${({ selected, theme }) => iconStyles({ selected, theme })}
  color: ${({ selected, theme }) =>
    selected ? theme.palette.contrast.grayscale.level75 : theme.palette.contrast.grayscale.level50};
`;

export const CopyMessage = styled('div')(({ theme }) => ({
  fontSize: 12,
  color: theme.palette.contrast.status.green100,
  paddingLeft: 8,
}));

export const Overlay = styled('div')({
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
});

export const Modal = styled('div')(({ theme }) => ({
  width: 400,
  backgroundColor: theme.palette.contrast.fixed.white,
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.2)",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16,
}));

export const ModalHeader = styled('div')({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

export const Title = styled('div')(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  fontWeight: 700,
  fontSize: 18,
  color: theme.palette.contrast.main.main100,
  gap: 12,
}));

export const IconBox = styled('div')(({ theme }) => ({
  padding: 6,
  borderRadius: 6,
  backgroundColor: theme.palette.contrast.grayscale.level25,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

export const CloseButton = styled('button')(({ theme }) => ({
  backgroundColor: theme.palette.contrast.grayscale.level10,
  border: "none",
  borderRadius: "50%",
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  color: theme.palette.contrast.grayscale.level75,
  cursor: "pointer",
  transition: "background 0.2s ease",
  "&:hover": {
    backgroundColor: theme.palette.contrast.grayscale.level25,
  },
}));

export const Divider = styled('hr')(({ theme }) => ({
  border: "none",
  borderTop: `1px solid ${theme.palette.contrast.grayscale.level10}`,
}));

export const StyledTextarea = styled('textarea')(({ theme }) => ({
  width: "100%",
  minHeight: 100,
  resize: "none",
  borderRadius: 8,
  padding: 12,
  border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
  fontSize: 14,
  outline: "none",
  "&:focus": {
    borderColor: theme.palette.primary.main,
  },
}));

export const Footer = styled('div')({
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
});

export const CancelButton = styled('button')(({ theme }) => ({
  padding: "8px 16px",
  borderRadius: 6,
  border:` 1px solid ${theme.palette.contrast.grayscale.level10}`,
  background: theme.palette.contrast.fixed.white,
  color: theme.palette.contrast.grayscale.level50,
  cursor: "pointer",
}));

export const SubmitButton = styled('button', {
  shouldForwardProp: (prop) => prop !== "disabled",
})<{ disabled?: boolean }>(({ disabled, theme }) => ({
  padding: "8px 16px",
  borderRadius: 6,
  background: disabled
    ? theme.palette.contrast.grayscale.level10
    : theme.palette.primary.main,
  color: disabled
    ? theme.palette.contrast.grayscale.level25
    : theme.palette.contrast.fixed.white,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
}));