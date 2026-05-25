import React, { useEffect, useRef, useCallback } from "react";
import { Box, useTheme } from "@mui/material";
import { ChatContainer } from "./styles";
import { AgentBubble } from "./AgentBubble";
import { ChatExamples } from "../components/ChatSection/ChatExamples";
import type { Message } from "../ConversationPage/types";
import { UserBubble } from "./UserBubble";
import { find } from "lodash";

interface ChatProps {
  conversationHistory: Message[];
  agentName: string; // Name of the agent to be displayed
  toShowInitialStaticLoader: boolean; // Indicates if the bot response is loading
  handleSelectQuestion: (text: string) => void; // Function to handle question selection from examples
  uploadedFileName?: string | null; // Name of the uploaded file, if any
  isBotResponseStreaming: boolean;
  userId: string;
}

export const Chat = ({
  conversationHistory,
  agentName,
  toShowInitialStaticLoader,
  isBotResponseStreaming,
  handleSelectQuestion,
  userId,
}: ChatProps) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        behavior: "smooth",
        top: containerRef.current.scrollHeight,
      });
    }
  }, []);

  // Use MutationObserver to detect content changes during streaming
  useEffect(() => {
    if (!containerRef.current || !isBotResponseStreaming) return;

    const observer = new MutationObserver(() => {
      scrollToBottom();
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [isBotResponseStreaming, scrollToBottom]);

  // Scroll on conversation history changes
  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory, scrollToBottom]);

  // Scroll when loading state changes
  useEffect(() => {
    if (toShowInitialStaticLoader) {
      scrollToBottom();
    }
  }, [toShowInitialStaticLoader, scrollToBottom]);

  // Create a unique key for the last message to force re-render during streaming
  const getLastMessageKey = () => {
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (lastMessage && (lastMessage.role === "assistant" || lastMessage.role === "system")) {
      return `${lastMessage.message_id}-${lastMessage.text?.length || 0}-${isBotResponseStreaming}`;
    }
    return null;
  };

  let csvFileCounter = 0
  
  const finalUserId = userId ||
    ((find(conversationHistory, 'user_id') ?? {}).user_id ?? '')

  return (
    <ChatContainer ref={containerRef}>
      <Box display="flex" flexDirection="column" gap={theme.spacing(4)}>
        <ChatExamples select={handleSelectQuestion} getAgentName={agentName} />
        {conversationHistory.map((chat, index) => {
          if (chat.data_limit_exceeded) {
            csvFileCounter++
          }
          return (
            <React.Fragment key={`chat-${index}`}>
              {chat.role === "user" && <UserBubble chat={chat} index={index} />}
              {(chat.role === "assistant" || chat.role === "system") && (
                <AgentBubble
                  key={`agent-bubble-${index}${index === conversationHistory.length - 1 ? `-${getLastMessageKey()}` : ''}`}
                  content={chat.text || chat.summary || (chat.summary === null ? "No response received. Please try asking question differently adding more context to question" : "")}
                  toShowInitialStaticLoader={index === conversationHistory.length - 1 &&
                    toShowInitialStaticLoader} // Show loading only for the most recent message
                  getAgentName={agentName}
                  messageId={chat.message_id} // Pass messageId if needed
                  messageTimestamp={chat.timestamp} // Pass message timestamp if needed
                  visualTableData={Array.isArray(chat.result) ? chat.result : []} // Ensure it's an array
                  visualDataType={chat.message_type} // Pass the visualization type if available
                  sql_query={chat?.sql_query} // Pass SQL query if available
                  chartData={chat.chart}
                  userId={finalUserId}
                  dataLimitExceeded={chat.data_limit_exceeded ?? false}
                  csvFileName={`${csvFileCounter}.csv`}
                  conversationId={chat.conversation_id}
                  type={chat.type}
                  file={chat.file} // Pass file if needed
                  isBotResponseStreaming={index === conversationHistory.length - 1 && isBotResponseStreaming}
                  selected_agents={chat.selected_agents}
                  error_type={chat.error_type}
                  thinkingSteps={chat.thinking_steps} />
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </ChatContainer>
  );
};
