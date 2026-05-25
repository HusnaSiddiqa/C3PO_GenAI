import React from "react";
import {
  Box,
  Typography,
  useTheme,
  keyframes,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  IconButton,
  Tooltip,
} from "@mui/material";
import { ArrowDownIcon, Copy } from "@phosphor-icons/react";
import { ChatContent, ChatAgentBallom, StreamingWrapper } from "./styles";
import StreamingText from "../../../../components/StreamingText/StreamingText";
import { ChartBarIcon, DotIcon } from "@phosphor-icons/react";
import { FeedbackIconsBar } from "../components/ChatSection/FeedbackIconsBar";
import DynamicChart from "../components/ChatSection/DynamicChart";
import { FileComponentImage } from "./FileComponentImage";
import TableDataVisualizer from "../components/ChatSection/TableDataVisualizer";
import { ThinkingBlock } from "./ThinkingBlock";
import type { ThinkingStep } from "../ConversationPage/types";

// Typing indicator animation
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

interface AgentBubbleProps {
  animatedTextAllowed?: boolean;
  content: string | any; // Allow any type for content to handle edge cases
  toShowInitialStaticLoader: boolean;
  isBotResponseStreaming: boolean;
  messageId?: string;
  messageTimestamp?: string; // Optional timestamp for the message
  getAgentName?: string; // Optional agent name
  visualTableData: Record<string, string>[];
  visualDataType: string;
  sql_query?: string;
  dataLimitExceeded: boolean;
  conversationId: string;
  csvFileName: string;
  chartData: {
    type: "line" | "bar";
    data: {
      x_label: string;
      y_label: string;
      x: string[];
      y: number[];
      label: string;
      priority?: number;
      legend?: string[];
    };
  } | null;
  type?: string; // Optional type for the message, if needed
  file?: {
    filename: string;
    file_id?: string;
  };
  rating?: string; // Optional rating for feedback
  comment?: string; // Optional comment for feedback
  selected_agents?: string[]; // Optional selected agents for routing info
  error_type?: string; // Optional error type for error handling]
  userId: string;
  thinkingSteps?: ThinkingStep[]; // Optional thinking steps for collapsible display
}

export const AgentBubble = ({
  content,
  toShowInitialStaticLoader,
  isBotResponseStreaming,
  getAgentName = "Agent Name",
  messageId,
  messageTimestamp,
  visualTableData,
  visualDataType,
  sql_query,
  chartData,
  file,
  rating,
  comment,
  selected_agents,
  error_type,
  dataLimitExceeded,
  conversationId,
  csvFileName,
  userId,
  thinkingSteps,
}: AgentBubbleProps) => {
  const theme = useTheme();

  // Function to copy SQL query to clipboard
  const handleCopySqlQuery = async () => {
    if (sql_query) {
      try {
        await navigator.clipboard.writeText(sql_query);
        // You could add a toast notification here if you have a notification system
      } catch (err) {
        console.error('Failed to copy SQL query:', err);
      }
    }
  };

  // Helper function to safely convert content to string
  const getSafeContent = (): string => {
    if (typeof content === 'string') {
      return content;
    }
    if (content && typeof content === 'object') {
      // Handle error objects with code and message
      if ('code' in content && 'message' in content) {
        return `Error ${content.code}: ${content.message}`;
      }
      // Handle other objects by converting to JSON string
      try {
        return JSON.stringify(content);
      } catch {
        return 'Invalid content format';
      }
    }
    return String(content || '');
  };

  const safeContent = getSafeContent();

  {
    /* // TODO: if we get array in text key for multiple responses from BOT  */
  }
  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={theme.spacing(5)}
      width="fit-content"
      maxWidth="90%"
    >
      {!toShowInitialStaticLoader && thinkingSteps && thinkingSteps.length > 0 && (
        <ThinkingBlock thinkingSteps={thinkingSteps} />
      )}
      {toShowInitialStaticLoader ? (
        <StreamingWrapper $isStreaming>
          <ChatAgentBallom variant="elevation" $maxExpanded={false}>
            <Box
              display="flex"
              gap={theme.spacing(2)}
              padding={theme.spacing(4)}
              alignItems="center"
              borderBottom={`1px solid ${theme.palette.grey[500]}`}
            >
              <ChartBarIcon size={theme.spacing(8)} />
              <DotIcon size={theme.spacing(8)} />
              <Typography variant="subtitle1">{getAgentName}</Typography>
            </Box>
            <ChatContent>
              <Box display="flex" alignItems="center" gap={1}>
                <Box
                  sx={{
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                  }}
                >
                  <Box
                    sx={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "grey.500",
                      animation: `${blink} 1.4s infinite`,
                    }}
                  />
                  <Box
                    sx={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "grey.500",
                      animation: `${blink} 1.4s infinite`,
                      animationDelay: "0.2s",
                    }}
                  />
                  <Box
                    sx={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "grey.500",
                      animation: `${blink} 1.4s infinite`,
                      animationDelay: "0.4s",
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {getAgentName} is thinking...
                </Typography>
              </Box>
            </ChatContent>
          </ChatAgentBallom>
        </StreamingWrapper>
      ) : (
        <StreamingWrapper $isStreaming={isBotResponseStreaming}>
          <ChatAgentBallom variant="elevation" $maxExpanded={false}>
          <Box
            display="flex"
            gap={theme.spacing(2)}
            padding={theme.spacing(4)}
            alignItems="center"
            borderBottom={`1px solid ${theme.palette.grey[500]}`}
          >
            <ChartBarIcon size={theme.spacing(8)} />
            <DotIcon size={theme.spacing(8)} />
            <Typography variant="subtitle1">{getAgentName}</Typography>
          </Box>

          {/* Content rendering logic */}
          {visualTableData.length > 0 && visualDataType === "sql_result" ? (
            <ChatContent>
              <StreamingText
                content={content}
                isStreaming={isBotResponseStreaming}
                speed={15}
              />
              <TableDataVisualizer
                rawData={visualTableData}
                dataLimitExceeded={dataLimitExceeded}
                conversationId={conversationId}
                csvFileName={csvFileName}
                userId={userId}
                data-testid="table-visualizer"
              />
               {sql_query && sql_query?.length > 0 && (
              <Accordion
                sx={{
                  mt: 2,
                  '& .MuiAccordionSummary-root': {
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(0, 0, 0, 0.2)' 
                      : 'rgba(0, 0, 0, 0.04)',
                    borderRadius: '4px 4px 0 0',
                  },
                  '& .MuiAccordionDetails-root': {
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(0, 0, 0, 0.3)' 
                      : 'rgba(0, 0, 0, 0.08)',
                    borderRadius: '0 0 4px 4px',
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ArrowDownIcon />}
                  aria-controls="panel2-content"
                  id="panel2-header"
                >
                  <Typography component="span" sx={{ fontWeight: 500 }}>
                    SQL Query
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      p: 2,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      overflow: 'auto',
                      maxHeight: '400px',
                      position: 'relative',
                      '& pre': {
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }
                    }}
                  >
                   
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 1,
                        }}
                      >
                        <Tooltip title="Copy SQL query">
                          <IconButton
                            size="small"
                            onClick={handleCopySqlQuery}
                            sx={{
                              backgroundColor: theme.palette.mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.1)' 
                                : 'rgba(0, 0, 0, 0.1)',
                              '&:hover': {
                                backgroundColor: theme.palette.mode === 'dark' 
                                  ? 'rgba(255, 255, 255, 0.2)' 
                                  : 'rgba(0, 0, 0, 0.2)',
                              }
                            }}
                          >
                            <Copy size={16} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                   
                    <pre
                      style={{
                        color: theme.palette.mode === 'dark' 
                          ? '#e0e0e0' 
                          : '#333',
                        fontFamily: '"Fira Code", "Monaco", "Cascadia Code", "Roboto Mono", monospace',
                      }}
                    >
                      {sql_query && sql_query?.length > 0
                        ? sql_query
                        : "No SQL query provided."}
                    </pre>
                  </Box>
                </AccordionDetails>
              </Accordion>
               )}
            </ChatContent>
          ) : visualDataType === "chart" && (chartData || visualTableData.length > 0) ? (
            <ChatContent>
              <StreamingText
                content={content}
                isStreaming={isBotResponseStreaming}
                speed={15}
              />
              <DynamicChart
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                charts={visualTableData.length > 0 ? (visualTableData as any[]) : Array.isArray(chartData) ? (chartData as any[]) : [chartData!]}
              />
            </ChatContent>
          ) : visualDataType === "file" && file ? (
            <ChatContent>
              <StreamingText
                content={content}
                isStreaming={isBotResponseStreaming}
                speed={15}
              />
              <FileComponentImage
                data-testid="file-image"
                fileId={file.file_id}
                filename={file.filename}
              />
            </ChatContent>
          ) : visualDataType === "thinking" ? (
            <ChatContent>
              <Box display="flex" alignItems="center" gap={1}>
                <Box
                  sx={{
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                  }}
                >
                  <Box
                    sx={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "grey.500",
                      animation: `${blink} 1.4s infinite`,
                    }}
                  />
                  <Box
                    sx={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "grey.500",
                      animation: `${blink} 1.4s infinite`,
                      animationDelay: "0.2s",
                    }}
                  />
                  <Box
                    sx={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "grey.500",
                      animation: `${blink} 1.4s infinite`,
                      animationDelay: "0.4s",
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {content}
                </Typography>
              </Box>
            </ChatContent>
          ) : visualDataType === "agent-routing" ? (
            <ChatContent>
              <Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {content}
                </Typography>
                {selected_agents && selected_agents.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography
                      variant="caption"
                      color="primary.main"
                      fontWeight="bold"
                    >
                      Selected Agents: {selected_agents.join(", ")}
                    </Typography>
                  </Box>
                )}
              </Box>
            </ChatContent>
          ) : visualDataType === "working" ? (
            <ChatContent>
              <Box display="flex" alignItems="center" gap={1}>
                <Box
                  sx={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "primary.main",
                    animation: `${blink} 1s infinite`,
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {safeContent}
                </Typography>
              </Box>
            </ChatContent>
          ) : visualDataType === "error" ? (
            <ChatContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 2,
                  p: 2,
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "rgba(211, 47, 47, 0.1)" // Dark red with transparency for dark theme
                      : "rgba(244, 67, 54, 0.08)", // Very light red for light theme
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor:
                    theme.palette.mode === "dark"
                      ? "rgba(244, 67, 54, 0.5)" // Semi-transparent red border for dark theme
                      : "rgba(244, 67, 54, 0.3)", // Lighter red border for light theme
                }}
              >
                <Box
                  sx={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? "#ff5252" // Brighter red for dark theme
                        : "#d32f2f", // Standard error red for light theme
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    mt: 0.5,
                  }}
                >
                  <Typography variant="caption" color="white" fontWeight="bold">
                    !
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    color={
                      theme.palette.mode === "dark"
                        ? "#ff8a80" // Light red for dark theme
                        : "#d32f2f" // Standard error red for light theme
                    }
                    fontWeight="bold"
                    sx={{ mb: 1 }}
                  >
                    Error Occurred
                  </Typography>
                  <Typography variant="body2" color="text.primary">
                    {safeContent}
                  </Typography>
                  {error_type && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: "block" }}
                    >
                      Error Type: {error_type}
                    </Typography>
                  )}
                </Box>
              </Box>
            </ChatContent>
          ) : (
            <ChatContent>
              <StreamingText
                content={safeContent}
                isStreaming={isBotResponseStreaming}
                speed={15} // Adjust speed as needed
              />
            </ChatContent>
          )}
          </ChatAgentBallom>
        </StreamingWrapper>
      )}
      {!isBotResponseStreaming && (
        <FeedbackIconsBar
          data-testid="feedback-bar"
          text={safeContent}
          messageId={messageId}
          messageTimestamp={messageTimestamp}
          rating={rating}
          comment={comment}
        />
      )}
    </Box>
  );
};
