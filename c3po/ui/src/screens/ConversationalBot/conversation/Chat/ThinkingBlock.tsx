import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
  useTheme,
} from "@mui/material";
import { CaretDown, Brain } from "@phosphor-icons/react";
import type { ThinkingStep } from "../ConversationPage/types";

interface ThinkingBlockProps {
  thinkingSteps: ThinkingStep[];
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinkingSteps }) => {
  const theme = useTheme();

  if (!thinkingSteps || thinkingSteps.length === 0) return null;

  const purple = theme.palette.mode === "dark"
    ? "rgba(139, 92, 246, 0.75)"
    : "rgba(109, 40, 217, 0.65)";

  return (
    <Accordion
      defaultExpanded={false}
      disableGutters
      elevation={0}
      sx={{
        background: "transparent",
        boxShadow: "none",
        border: "none",
        "&:before": { display: "none" },
        "&.Mui-expanded": { margin: 0 },
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      <AccordionSummary
        expandIcon={<CaretDown size={14} color={purple} />}
        sx={{
          minHeight: "28px !important",
          padding: "0 6px 0 2px",
          "& .MuiAccordionSummary-content": {
            margin: "4px 0 !important",
          },
        }}
      >
        <Box display="flex" alignItems="center" gap={0.75}>
          <Brain size={15} weight="duotone" color={purple} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 500,
              color: purple,
              letterSpacing: "0.01em",
            }}
          >
            Thinking Process ({thinkingSteps.length} step{thinkingSteps.length > 1 ? "s" : ""})
          </Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ padding: 0, mt: 0.5 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            maxHeight: "260px",
            overflowY: "auto",
            pl: 0.5,
            pr: 1,
            "&::-webkit-scrollbar": { width: "4px" },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: theme.palette.mode === "dark"
                ? "rgba(139, 92, 246, 0.3)"
                : "rgba(109, 40, 217, 0.2)",
              borderRadius: "2px",
            },
            "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          }}
        >
          {thinkingSteps.map((step, index) => (
            <Box key={index} display="flex" gap={1} alignItems="flex-start">
              <Box
                sx={{
                  flexShrink: 0,
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: theme.palette.mode === "dark"
                    ? "rgba(139, 92, 246, 0.15)"
                    : "rgba(109, 40, 217, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mt: "2px",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontSize: "9px", fontWeight: 700, color: purple }}
                >
                  {index + 1}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                {step.stage && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: purple,
                      display: "block",
                      mb: 0.25,
                      opacity: 0.75,
                      textTransform: "capitalize",
                    }}
                  >
                    {step.stage.replace(/-/g, " ")}
                  </Typography>
                )}
                <Typography
                  component="pre"
                  variant="caption"
                  sx={{
                    color: theme.palette.text.disabled,
                    lineHeight: 1.55,
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    margin: 0,
                    display: "block",
                  }}
                >
                  {step.content}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default ThinkingBlock;
