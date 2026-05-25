import { Box, Typography, useTheme } from "@mui/material";
import { ChartBarIcon, DotIcon } from "@phosphor-icons/react";
import {
  ChatAgentBallom,
  ClickableQuestions,
} from "../../ConversationPage/style";
import MarkdownRenderer from "../../../../../components/MarkdownRenderer/MarkdownRenderer"; // Import MarkdownRenderer
import type { ClickablesData } from "../../../../../GenAiTypes";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authFetch } from "../../../../../helpers/authFetch";

interface ChatExampleProps {
  select: (example: string) => void;
  getAgentName: string;
}

export const ChatExamples = ({ select, getAgentName }: ChatExampleProps) => {
  const theme = useTheme();

  const {
    data: clickableData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["clickableData"],
    queryFn: () =>
      authFetch("/v2/chat-manager/chat/clickable").then((res) => res.json()),
    retry: true,
  });

  const [clickableQuestionDetails, setClickableQuestionDetails] = useState<
    ClickablesData[]
  >([]);

  useEffect(() => {
    if (clickableData) {
      setClickableQuestionDetails(clickableData);
    }
  }, [clickableData]);

  if (isLoading) return <p>Loading clickable questions...</p>;
  if (error)
    return <p>Failed to load clickable questions. Please try again later.</p>;

  return (
    <Box display="flex" flexDirection="column" gap={theme.spacing(8)}>
      <ChatAgentBallom variant="elevation" $maxExpanded={false}>
        <Box
          display="flex"
          gap={theme.spacing(2)}
          padding={theme.spacing(4)}
          alignItems="center"
          borderBottom={`1px solid ${theme.palette.contrast.grayscale.level10}`}
        >
          <ChartBarIcon size={theme.spacing(8)} />
          <DotIcon size={theme.spacing(8)} />
          <Typography
            variant="p2Bold"
            color={theme.palette.contrast.grayscale.level75}
          >
            {getAgentName}
          </Typography>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          gap={theme.spacing(4)}
          padding={theme.spacing(4)}
        >
          {clickableQuestionDetails.length > 0 ? (
            clickableQuestionDetails.map((section) => (
              <div key={section.category}>
                <Typography
                  variant="h6"
                  style={{ marginBottom: theme.spacing(2) }} // Added bottom spacing
                >
                  {section.category}
                </Typography>
                <ol
                  style={{
                    paddingLeft: theme.spacing(4),
                    listStylePosition: "outside",
                  }}
                >
                  {section.clickable_questions?.map((q, index) => (
                    <li
                      key={`${section.category}-${q.id}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing(1),
                        cursor: "pointer",
                      }}
                    >
                      <a
                        href="#"
                        onClick={() => select(q.question)}
                        style={{
                          color:
                            theme.palette.mode === "light"
                              ? theme.palette.primary.main
                              : theme.palette.contrast.main.main100,
                          textDecoration: "none",
                        }}
                      >
                        {index + 1}.
                      </a>
                      <ClickableQuestions
                        onClick={() => select(q.question)}
                        style={{
                          color:
                            theme.palette.mode === "light"
                              ? theme.palette.primary.main
                              : theme.palette.contrast.main.main100,
                          textDecoration: "none",
                        }}
                      >
                        <MarkdownRenderer>{q.question}</MarkdownRenderer>
                      </ClickableQuestions>
                    </li>
                  ))}
                </ol>
              </div>
            ))
          ) : (
            <Typography variant="body2" color="textSecondary">
              No clickable questions available.
            </Typography>
          )}
          <Typography variant="body2">
            Would you like a prompt template in any{" "}
            <span className="font-medium">specific category</span>?
          </Typography>
        </Box>
      </ChatAgentBallom>
    </Box>
  );
};
