import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useContext,
} from "react";

import { ConversationPageContainer } from "./style";
import { SearchInput } from "../components/SearchInput/SearchInput";
import { Box, useTheme, Snackbar, Alert } from "@mui/material";
import ChatSection from "../components/ChatSection/ChatSection";
import Sidebar from "../components/ChatSection/Sidebar";
import AppFooter from "../components/ChatSection/AppFooter";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useStreamBotResponse } from "./useFetchBotResponse";
import { useParams } from "react-router-dom";
import { convertStreamedToMessage, type Message, type ThinkingStep } from "./types";
import { fetchConversation } from "./fetchConversationApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserContext } from "../../../../contexts/UserContext";
import { useConfig } from "../../../../contexts/ConfigContext";
import { fetchAvailableSources } from "../../../Setting/helpers/helpers";

export const ConversationPage: React.FC = () => {
  return (
    <ConversationPageContainer>
      <Box>
        <Outlet />
      </Box>
    </ConversationPageContainer>
  );
};

export const ChatSectionComponent = () => {
  const theme = useTheme();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatUserPrompt, setChatUserPrompt] = useState<string>("");
  const [conversationHistory, setConversationHistory] = useState<
    Record<string, Message[]>
  >({});
  const [apiMessagesUpdated, setApiMessagesUpdated] = useState<boolean>(false);
  const { conversationId } = useParams();
  const [currentConversationId, setCurrentConversationId] = useState<string>(
    conversationId || "dummy-conversation-id"
  );
  const lastConversationId = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<
    string | undefined
  >();

  const { user } = useContext(UserContext);
  const { config } = useConfig();

  const [selectedSource, setSelectedSource] = useState<string>("Auto");
  const [isThinkingEnabled, setIsThinkingEnabled] = useState<boolean>(false);
  const isSourceSelectorEnabled = config.enable_source_selector === "true";

  // Fetch available sources from API only when feature flag is enabled
  const { data: sourcesData, isError: sourcesError } = useQuery({
    queryKey: ["available-sources"],
    queryFn: fetchAvailableSources,
    enabled: isSourceSelectorEnabled,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const availableSources: string[] = sourcesData?.sources || [];

  const handleFileUploaded = useCallback((fileId: string, fileName: string) => {
    setUploadedFileId(fileId);
    setUploadedFileName(fileName);
  }, []);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleMenuClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  const handleSelectQuestion = (text: string) => {
    setChatUserPrompt(text);
  };

  useEffect(() => {
    if (currentConversationId) {
      if (currentConversationId === "dummy-conversation-id") {
        sessionStorage.setItem("recentConversationId", "/");
      } else {
        sessionStorage.setItem("recentConversationId", currentConversationId);
      }
    }
  }, [currentConversationId]);

  const {
    data: conversationData,
    isLoading: conversationLoading,
    isError: conversationError,
    error: conversationErrorDetails,
    refetch: refetchConversation,
  } = useQuery({
    queryKey: ["conversation_id", currentConversationId],
    queryFn: () => fetchConversation(currentConversationId!),
    enabled:
      !!currentConversationId &&
      currentConversationId !== "dummy-conversation-id",
    retry: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Function to reload API and update state
  const reloadConversation = async () => {
    const { data } = await refetchConversation();
    if (data?.messages) {
      setMessages(data.messages);
      setConversationHistory((prev) => ({
        ...prev,
        [currentConversationId]: data.messages,
      }));
    }
  };

  useEffect(() => {
    if (
      conversationData?.messages &&
      currentConversationId !== lastConversationId.current &&
      !hasLocalChanges
    ) {
      lastConversationId.current = currentConversationId;
      // Only set messages from API if we don't have local conversation history
      const localHistory = conversationHistory[currentConversationId];
      if (!localHistory || localHistory.length === 0) {
        setMessages(conversationData.messages);
        setConversationHistory((prev) => ({
          ...prev,
          [currentConversationId]: conversationData.messages,
        }));
      }
    }
  }, [
    conversationData,
    currentConversationId,
    conversationHistory,
    hasLocalChanges,
    setMessages,
    setConversationHistory,
    reloadConversation,
  ]);

  const {
    mutate: fetchBotResponse,
    isPending: isBotResponseStreaming,
    cancelStream,
    error: streamError,
  } = useStreamBotResponse();
  const [toShowInitialStaticLoader, setToShowInitialStaticLoader] =
    useState(false);
  const [showNotFoundToast, setShowNotFoundToast] = useState(false);
  const hasNavigatedRef = useRef(false);
  const hasCalledHistoryAPI = useRef(false);
  const thinkingStepsRef = useRef<ThinkingStep[]>([]);

  const queryClient = useQueryClient();

  // Handle conversation not found error and show toast before redirecting
  useEffect(() => {
    if (conversationError && conversationErrorDetails) {
      const errorMessage = conversationErrorDetails.message || '';
      if (errorMessage === "CONVERSATION_NOT_FOUND") {
        setShowNotFoundToast(true);
        // Set conversationError to false to prevent error display in ChatSection
        queryClient.setQueryData(
          ["conversation_id", currentConversationId],
          { data: null, error: null, isError: false }
        );
      }
    }
  }, [conversationError, conversationErrorDetails, queryClient, currentConversationId]);

  const handleSearch = useCallback(
    (text: string) => {
      setToShowInitialStaticLoader(true);
      
      // Reset the flag for new search
      hasCalledHistoryAPI.current = false;
      // Reset thinking steps for new search
      thinkingStepsRef.current = [];
      
      const isNewConversation =
        currentConversationId === "dummy-conversation-id";
      let resolvedConversationId = currentConversationId;

      const newUserMessage: Message = {
        role: "user",
        message_type: "user_input",
        summary: text,
        conversation_id: isNewConversation ? "new" : currentConversationId,
        data: [],
        file:
          uploadedFileId && uploadedFileName
            ? {
                file_id: uploadedFileId,
                filename: uploadedFileName,
                file_type: "file",
              }
            : undefined,
        text,
        type: "user_input",
        chart: null,
      };

      const tempBotMessage: Message = {
        role: "system",
        message_type: "agent_message",
        conversation_id: currentConversationId,
        data: [],
        text: "Loading...",
        type: "summary",
        chart: null,
      };

      // Get existing messages for the current conversation
      const existingMessages = conversationHistory[currentConversationId] || [];

      // Add new messages to the conversation history
      setConversationHistory((prev) => ({
        ...prev,
        [currentConversationId]: [
          ...existingMessages,
          newUserMessage,
          tempBotMessage,
        ],
      }));
      setHasLocalChanges(true);

      fetchBotResponse({
        text,
        conversationId: isNewConversation ? null : currentConversationId,
        fileId: uploadedFileId,
        userId: user?.userId,
        selectedSource: selectedSource === "Auto" ? null : selectedSource,
        isThinkingEnabled,

        onStreamingMessage: (partialMessage) => {
          if (partialMessage.is_final === true) return;

          // Collect intermediate messages as thinking steps
          // Check multiple possible content fields for comprehensive capture
          const messageContent = 
            partialMessage.agent_message || 
            partialMessage.message || 
            partialMessage.summary || 
            partialMessage.parse_error ||
            "";
          
          // Collect all meaningful intermediate content, excluding only title updates and artifacts
          const shouldCollect = 
            messageContent && 
            partialMessage.event !== "title_update" &&
            partialMessage.stage !== "artifact" &&
            partialMessage.stage !== "completed" &&
            partialMessage.stage !== "error";
          
          if (shouldCollect) {
            thinkingStepsRef.current.push({
              content: messageContent,
              timestamp: partialMessage.timestamp,
              stage: partialMessage.stage,
            });
          }

          // Call chat history API only once when stream starts to get the latest history on top
          if (!hasCalledHistoryAPI.current) {
            const effectiveUserId = user?.userId || config.app_default_user_id || "";
            queryClient.invalidateQueries({ queryKey: ["chat-history", effectiveUserId] });
            hasCalledHistoryAPI.current = true;
          }

          // Handle title update events
          if (partialMessage.event === "title_update" && partialMessage.title) {
            setConversationTitle(partialMessage.title);
            // Also update the conversation title in the chat history
            updateConversationTitleInHistory(partialMessage.conversation_id, partialMessage.title);
            return; // Don't process as a regular message
          }

          // Check if this is an error message
          if (partialMessage.stage === "error" || partialMessage.error_type) {
            const errorMessage: Message = {
              role: "system",
              message_type: "error",
              summary:
                partialMessage.error_message ||
                "An error occurred while processing your request",
              conversation_id: resolvedConversationId,
              data: [],
              text:
                partialMessage.error_message ||
                "An error occurred while processing your request",
              type: "error",
              chart: null,
              error_type: partialMessage.error_type,
              error_message: partialMessage.error_message,
            };

            // Update conversation history with error message
            setConversationHistory((prev) => {
              const updated = [...(prev[resolvedConversationId] || [])];
              const lastIndex = updated.length - 1;

              if (lastIndex >= 0) {
                updated[lastIndex] = errorMessage;
              }

              return {
                ...prev,
                [resolvedConversationId]: updated,
              };
            });

            setToShowInitialStaticLoader(false);
            return;
          }

          let botMessage: Message;
          try {
            botMessage = convertStreamedToMessage(partialMessage);
          } catch (error) {
            console.error("Error converting streamed message:", error);
            // Create a safe fallback message
            botMessage = {
              role: partialMessage.role || "assistant",
              message_type: "summary",
              summary: "Message processing error",
              conversation_id: resolvedConversationId,
              data: [] as [],
              text: "Message processing error",
              type: "summary",
              chart: null,
            };
          }

          // Handle system messages (including working stage messages)
          // if (partialMessage.role === "system") {
          //   // For system messages, we want to show them as assistant messages for better UX
          //   botMessage.role = "assistant";
          //   botMessage.message_type = "agent_message";
          //   botMessage.type = "summary";
          // }

          if (partialMessage.role === "assistant") {
            setUploadedFileId(null);
            setUploadedFileName(null);
          }

          if (
            partialMessage.conversation_id &&
            isNewConversation &&
            !hasNavigatedRef.current
          ) {
            hasNavigatedRef.current = true;
            resolvedConversationId = partialMessage.conversation_id;
            setCurrentConversationId(resolvedConversationId);

            // Preserve the conversation history when navigating to a new conversation
            setConversationHistory((prev) => {
              const dummyMessages = prev["dummy-conversation-id"] || [];
              return {
                ...prev,
                [resolvedConversationId]: dummyMessages,
              };
            });

            // Update URL without page refresh, preserving query params (e.g. embed=true)
            const qs = searchParams.toString();
            navigate(`/${resolvedConversationId}${qs ? `?${qs}` : ""}`, { replace: true });
            
            // Refresh chat history to include the new conversation
            const effectiveUserId = user?.userId || config.app_default_user_id || "";
            queryClient.invalidateQueries({ queryKey: ["chat-history", effectiveUserId] });
          }

          // Update the conversation history with the streaming response
          setConversationHistory((prev) => {
            let updated = [...(prev[resolvedConversationId] || [])];
            const lastIndex = updated.length - 1;

            // Only append assistant messages, update others
            if (partialMessage.role === "assistant" ||
              (lastIndex >= 0 && updated[lastIndex].role === "assistant")) {
              updated = updated.filter(msg => msg.role !== "system");
              updated.push(botMessage);
            } else if (lastIndex >= 0) {
              // For other message types, update the last message
              updated[lastIndex] = {
                ...updated[lastIndex],
                ...botMessage,
              };
            }

            return {
              ...prev,
              [resolvedConversationId]: updated,
            };
          });

          setToShowInitialStaticLoader(false);
        },

        onStreamFinalMessage: (finalMessage) => {
          // Capture the collected thinking steps
          const collectedThinkingSteps = [...thinkingStepsRef.current];
          // Reset thinking steps after capturing
          thinkingStepsRef.current = [];

          // Check if final message contains error information
          if (finalMessage.error_occurred || finalMessage.error_type) {
            const errorMessage: Message = {
              role: "system",
              message_type: "error",
              summary:
                finalMessage.error_message ||
                "An error occurred while processing your request",
              conversation_id: resolvedConversationId,
              data: [],
              text:
                finalMessage.error_message ||
                "An error occurred while processing your request",
              type: "error",
              chart: null,
              error_type: finalMessage.error_type,
              error_message: finalMessage.error_message,
              data_limit_exceeded: finalMessage.data_limit_exceeded,
              user_id: finalMessage.user_id,
            };

            // Append error message to conversation history instead of replacing
            setConversationHistory((prev) => {
              let updated = [...(prev[resolvedConversationId] || [])];
              updated = updated.filter(msg => msg.role !== "system");
              updated.push(errorMessage);

              return {
                ...prev,
                [resolvedConversationId]: updated,
              };
            });
          } else {
            const isCompletionMessage =
              finalMessage.stage === "completed" && finalMessage.role === "system";

            setConversationHistory((prev) => {
              let updated = [...(prev[resolvedConversationId] || [])];
              updated = updated.filter(msg => msg.role !== "system");

              if (collectedThinkingSteps.length > 0) {
                const lastAssistantIndex = [...updated]
                  .reverse()
                  .findIndex(msg => msg.role === "assistant");

                if (lastAssistantIndex !== -1) {
                  const assistantIndex = updated.length - 1 - lastAssistantIndex;
                  updated[assistantIndex] = {
                    ...updated[assistantIndex],
                    thinking_steps: collectedThinkingSteps,
                  };

                  return {
                    ...prev,
                    [resolvedConversationId]: updated,
                  };
                }
              }

              if (!isCompletionMessage) {
                try {
                  const finalBotMessage = convertStreamedToMessage(finalMessage);
                  if (collectedThinkingSteps.length > 0) {
                    finalBotMessage.thinking_steps = collectedThinkingSteps;
                  }
                  updated.push(finalBotMessage);
                } catch (error) {
                  console.error("Error converting final streamed message:", error);
                }
              }

              return {
                ...prev,
                [resolvedConversationId]: updated,
              };
            });
          }

          setToShowInitialStaticLoader(false);
          setApiMessagesUpdated(true);
          
          // Refresh chat history after stream completes to include any new conversations
          if (isNewConversation) {
            const effectiveUserId = user?.userId || config.app_default_user_id || "";
            queryClient.invalidateQueries({ queryKey: ["chat-history", effectiveUserId] });
          }
        },
        onStreamError: () => {
          // Clean up: remove loading message
          setConversationHistory((prev) => {
            const updated = [...(prev[currentConversationId] || [])];
            const lastIndex = updated.length - 1;

            if (
              lastIndex >= 0 &&
              (updated[lastIndex].role === "assistant" ||
                updated[lastIndex].role === "system")
            ) {
              updated.splice(lastIndex, 1);
            }

            return {
              ...prev,
              [currentConversationId]: updated,
            };
          });
          setUploadedFileId(null);
          setUploadedFileName(null);
          setToShowInitialStaticLoader(false);
        },
      });
    },
    [
      currentConversationId,
      conversationHistory,
      uploadedFileId,
      uploadedFileName,
      fetchBotResponse,
      navigate,
      user,
      queryClient,
      selectedSource,
    ]
  );

  const cancelStreamHandler = () => {
    cancelStream();
    // Reset the flag when stream is cancelled
    hasCalledHistoryAPI.current = false;

    setConversationHistory((prev) => {
      const updated = [...(prev[currentConversationId] || [])];
      const lastIndex = updated.length - 1;

      if (
        lastIndex >= 0 &&
        (updated[lastIndex].role === "assistant" ||
          updated[lastIndex].role === "system")
      ) {
        updated.splice(lastIndex, 1);
      }

      return {
        ...prev,
        [currentConversationId]: updated,
      };
    });

    setUploadedFileId(null);
    setUploadedFileName(null);
    setToShowInitialStaticLoader(false);
  };

  const updateConversationTitleInHistory = (conversationId: string, newTitle: string) => {
    // Update the chat history cache when a title update event is received
    // The chat history query now uses a fixed key
    const effectiveUserId = user?.userId || import.meta.env.VITE_APP_DEFAULT_USER_ID || "";
    queryClient.setQueryData(
      ["chat-history", effectiveUserId],
      (oldData: any) => {
        if (!oldData || !oldData.chatHistory) return oldData;
        
        const updatedChatHistory = { ...oldData.chatHistory };
        
        // Find and update the conversation title in the chat history
        Object.keys(updatedChatHistory).forEach((dayKey) => {
          const conversations = updatedChatHistory[dayKey];
          const conversationIndex = conversations.findIndex(
            (conv: any) => conv.conversation_id === conversationId
          );
          
          if (conversationIndex !== -1) {
            updatedChatHistory[dayKey] = [
              ...conversations.slice(0, conversationIndex),
              { ...conversations[conversationIndex], title: newTitle },
              ...conversations.slice(conversationIndex + 1),
            ];
          }
        });
        
        return {
          ...oldData,
          chatHistory: updatedChatHistory,
        };
      }
    );
  };

  const startNewConversation = () => {
    setCurrentConversationId("dummy-conversation-id");
    setConversationHistory({});
    setUploadedFileId(null);
    setUploadedFileName(null);
    setChatUserPrompt("");
    setMessages([]);
    setApiMessagesUpdated(false);
    setHasLocalChanges(false);
    const qs = searchParams.toString();
    navigate(qs ? `/?${qs}` : "/");
    hasNavigatedRef.current = false;
    setRefreshKey((prev) => prev + 1);
    setSelectedSource("Auto");
  };
  return (
    <>
      <Box
        flexGrow={1}
        width="80vw"
        display="flex"
        flexWrap="wrap"
        height="calc(100vh - 50px)"
        paddingBlock={theme.spacing(16)}
        // maxWidth={theme.breakpoints.values.lg}
      >
        <Box
          sx={{
            display: "flex",
            width: "100%",
            height: "100%",
            gap: isSidebarOpen ? theme.spacing(8) : 0,
            transition: "gap 0.3s ease-in-out",
          }}
        >
          <Sidebar
            key={refreshKey}
            open={isSidebarOpen}
            startNewConversation={startNewConversation}
            setCurrentConversationId={setCurrentConversationId}
            setConversationTitle={setConversationTitle}
            updateConversationTitleInHistory={updateConversationTitleInHistory}
          />
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="space-between"
            flexGrow={1}
          >
            <ChatSection
              key={refreshKey}
              openMenu={handleMenuClick}
              isMenuOpen={isSidebarOpen}
              conversationHistory={
                conversationHistory[currentConversationId] ||
                conversationData?.messages ||
                []
              }
              isBotResponseStreaming={isBotResponseStreaming}
              toShowInitialStaticLoader={toShowInitialStaticLoader}
              handleSelectQuestion={handleSelectQuestion}
              conversationLoading={conversationLoading}
              conversationError={conversationError}
              uploadedFileName={uploadedFileName}
              conversationTitle={conversationTitle}
              userId={conversationData?.user_id ?? ''}
            />
            <Box
              display="flex"
              flexDirection="column"
              gap={theme.spacing(8)}
              width="100%"
            >
              <SearchInput
                key={refreshKey}
                defaultInput={chatUserPrompt}
                onSearch={handleSearch}
                resetDefault={() => setChatUserPrompt("")}
                loading={isBotResponseStreaming}
                disabled={isBotResponseStreaming}
                onFileUploaded={handleFileUploaded}
                onStreamStopButtonClick={cancelStreamHandler}
                streamError={streamError?.message ?? ""}
                selectedSource={selectedSource}
                setSelectedSource={setSelectedSource}
                availableSources={availableSources}
                isThinkingEnabled={isThinkingEnabled}
                setIsThinkingEnabled={setIsThinkingEnabled}
              />
            </Box>
          </Box>
        </Box>
        {<AppFooter openDisclaimer={() => console.log("link clicked")} />}
      </Box>
      
      {/* Toast notification for conversation not found */}
      <Snackbar
        open={showNotFoundToast}
        autoHideDuration={3000}
        onClose={() => {
          setShowNotFoundToast(false);
          startNewConversation()
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => {
            setShowNotFoundToast(false);
            startNewConversation()
          }} 
          severity="warning" 
          sx={{ width: '100%' }}
        >
          Conversation not found. Redirecting to home page...
        </Alert>
      </Snackbar>

      {/* Toast notification for sources fetch error */}
      <Snackbar
        open={sourcesError}
        autoHideDuration={5000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          Failed to load available sources. Please try again later.
        </Alert>
      </Snackbar>
    </>
  );
};
