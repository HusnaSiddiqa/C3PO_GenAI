import { useContext, useEffect, useRef, useState } from "react";
import { HistoryContainer, SearchInput } from "./styles";
import {
  Box,
  Typography,
  useTheme,
  TextField,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import {
  PlusCircleIcon,
  PencilSimpleIcon,
  TrashIcon,
  CaretRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { HeaderButton } from "../ChatSection/HeaderButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { UpdateTitleData } from "./updateTitleData";
import { DeleteConversation } from "./deleteConversation";
import { UserContext } from "../../../../../contexts/UserContext";
import { authFetch } from "../../../../../helpers/authFetch";
import { useConfig } from "../../../../../contexts/ConfigContext";

type ChatHistory = {
  [key: string]: Conversation[];
};

type Conversation = {
  conversation_id: string;
  timestamp: string;
  title: string;
};

type AgentOptionsProps = {
  setCurrentConversationId: React.Dispatch<React.SetStateAction<string>>;
  setConversationTitle: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  updateConversationTitleInHistory?: (
    conversationId: string,
    newTitle: string
  ) => void;
};

declare global {
  interface ImportMeta {
    env: {
      VITE_APP_DEFAULT_USER_ID: string;
    };
  }
}

export const AgentOptions = ({
  setCurrentConversationId,
  setConversationTitle,
  updateConversationTitleInHistory,
}: AgentOptionsProps) => {
  const isHistoryEmpty = useRef(false); // Updated to reflect non-empty state
  const [showOptions, setShowOptions] = useState(""); // State to manage expanded options
  const [searchQuery, setSearchQuery] = useState(""); // State for search input
  const theme = useTheme();
  const navigate = useNavigate();
  const { conversationId: currentId } = useParams<{ conversationId: string }>();
  const [editting, setEditting] = useState<string>();
  const [editValue, setEditValue] = useState<string>("");
  const [userHistory, setUserHistory] = useState<ChatHistory>({});
  const [showOlder, setShowOlder] = useState(false);

  const { mutate } = UpdateTitleData();
  const { user } = useContext(UserContext);
  const { mutate: deleteConversation } = DeleteConversation();
  const queryClient = useQueryClient();

  const { config } = useConfig();

  const effectiveUserId =
    user?.userId || config.app_default_user_id || "";

  const {
    data: historyData,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useQuery({
    queryKey: ["chat-history", effectiveUserId],
    queryFn: () =>
      authFetch(
        `/v2/chat-manager/chat/history?user_id=${encodeURIComponent(
          effectiveUserId
        )}`
      ).then((res) => res.json()),
    enabled: !!effectiveUserId, // Only run query if userId exists
    retry: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  useEffect(() => {
    if (historyData && Object.keys(historyData.chatHistory).length > 0) {
      setUserHistory(historyData.chatHistory);

      let foundTitle: string | undefined = undefined;

      Object.values(historyData.chatHistory).forEach((value) => {
        const conversations = value as Conversation[];
        const found = conversations.find(
          (conv) => conv.conversation_id === currentId
        );
        if (found) foundTitle = found.title;
      });
      setConversationTitle(foundTitle);
    }
  }, [historyData, currentId, setConversationTitle]);

  if (isHistoryLoading) {
    return (
      <HistoryContainer $empty={isHistoryEmpty.current}>
        <Box
          display="flex"
          flexDirection="column"
          gap={theme.spacing(8)}
          className="history-container-group"
        >
          <Typography
            variant="p2Bold"
            color={theme.palette.contrast.grayscale.level50}
          >
            Loading history...
          </Typography>
        </Box>
      </HistoryContainer>
    );
  }

  if (historyError) {
    console.error("Error fetching history:", historyError);
    return (
      <HistoryContainer $empty={isHistoryEmpty.current}>
        <Box
          display="flex"
          flexDirection="column"
          gap={theme.spacing(8)}
          className="history-container-group"
        >
          <Typography
            variant="p2Bold"
            color={theme.palette.contrast.grayscale.level50}
          >
            Error loading history!
          </Typography>
        </Box>
      </HistoryContainer>
    );
  }

  const handleHistoryOption = (itemKey: string) => {
    if (showOptions === itemKey) {
      setShowOptions("");
    } else {
      setShowOptions(itemKey);
    }
  };

  const handleEditChat = (chatId: string, currentTitle: string) => {
    setEditting(chatId);
    setEditValue(currentTitle);
  };

  const handleHistory = (newId: string) => {
    if (!currentId) {
      navigate(`${newId}`);
      setCurrentConversationId(newId);
    } else if (currentId !== newId) {
      navigate(`/${newId}`, { replace: true });
      setCurrentConversationId(newId);
    }
    setShowOptions("");
    setEditting(undefined);
  };

  const handleDeleteChat = (conversation: Conversation, dayKey: string) => {
    deleteConversation(conversation.conversation_id);

    if (conversation.conversation_id === currentId) {
      setCurrentConversationId("dummy-conversation-id");
      setConversationTitle(undefined);
      navigate("/"); // Navigate to home or default state
    }
    // The chat history will be refreshed automatically via query invalidation
  };

  const handleSaveEdit = (conversation: Conversation, dayKey: string) => {
    if (conversation.conversation_id === editting) {
      setEditting(undefined);
      const payload = {
        conversation_id: conversation.conversation_id,
        title: editValue,
      };
      mutate(payload, {
        onSuccess: () => {
          // Invalidate and refetch chat history after successful update
          queryClient.invalidateQueries({
            queryKey: ["chat-history", effectiveUserId],
          });
        },
      });
      if (conversation.conversation_id === currentId) {
        setConversationTitle(editValue);
      }
    } else {
      setEditValue(conversation.title);
      setEditting(conversation.conversation_id);
    }
  };

  const renderEachHistoryItem = (
    conversation: Conversation,
    itemKeyPrefix: string,
    index: number,
    dayKey: string
  ) => {
    const isSelected = conversation.conversation_id === currentId;

    return (
      <Box
        display="flex"
        alignItems="center"
        gap={theme.spacing(2)}
        key={`${itemKeyPrefix}-${index}`}
        sx={{
          cursor: "pointer",
          backgroundColor: isSelected
            ? theme.palette.contrast.main.main100
            : "transparent",
          borderRadius: theme.spacing(2),
          padding: theme.spacing(2),
          marginBottom: theme.spacing(1),
          transition: "background-color 0.2s ease-in-out",
          "&:hover": {
            backgroundColor: isSelected
              ? theme.palette.contrast.main.main100
              : theme.palette.action.hover,
          },
        }}
        onClick={() => handleHistory(conversation.conversation_id)}
      >
        <Box
          sx={{
            minWidth: 0,
            flexGrow: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          {conversation.conversation_id &&
          conversation.conversation_id === editting ? (
            <SearchInput
              placeholder="Type a conversation title..."
              value={editValue}
              onChange={(evt) => setEditValue(evt.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Typography
              sx={{
                minWidth: 0,
                maxWidth: 300, // Adjust as needed
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flexGrow: 1,
                flexShrink: 1,
                display: "block",
              }}
              variant="p3"
              color={
                isSelected
                  ? theme.palette.primary.contrastText
                  : theme.palette.contrast.grayscale.level50
              }
              title={conversation.title}
            >
              {conversation.title}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            ml: theme.spacing(2),
            display: "flex",
            alignItems: "center",
          }}
        >
          <CaretRightIcon
            size={theme.spacing(8)}
            onClick={(e) => {
              e.stopPropagation();
              handleHistoryOption(`${itemKeyPrefix}`);
            }}
            color={
              isSelected
                ? theme.palette.primary.contrastText
                : theme.palette.contrast.grayscale.level50
            }
          />
        </Box>
        {showOptions === `${itemKeyPrefix}` && (
          <Box
            display="flex"
            gap={theme.spacing(2)}
            alignItems="center"
            ml={theme.spacing(2)}
            flexShrink={0}
          >
            {conversation.conversation_id !== undefined &&
            editting === conversation.conversation_id ? (
              <>
                <Tooltip title="Save changes">
                  <CheckCircleIcon
                    size={theme.spacing(8)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEdit(conversation, dayKey);
                    }}
                    color={theme.palette.contrast.status.green100}
                  />
                </Tooltip>
                <Tooltip title="Cancel">
                  <XCircleIcon
                    size={theme.spacing(8)}
                    color={theme.palette.contrast.status.red}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditting(undefined);
                    }}
                  />
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title="Edit">
                  <PencilSimpleIcon
                    size={theme.spacing(8)}
                    color={theme.palette.contrast.grayscale.level50}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditChat(
                        conversation.conversation_id,
                        conversation.title || ""
                      );
                    }}
                  />
                </Tooltip>
                <Tooltip title="Delete">
                  <TrashIcon
                    size={theme.spacing(8)}
                    color={theme.palette.contrast.status.red}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(conversation, dayKey);
                    }}
                  />
                </Tooltip>
              </>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const renderHistorySection = (
    title: string,
    itemKeyPrefix: string,
    conversations: Conversation[]
  ) => {
    const filteredConversations = conversations
      .filter((conversation) =>
        conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    return (
      <>
        <Typography
          variant="p2Bold"
          color={theme.palette.contrast.grayscale.level50}
        >
          {title}
        </Typography>
        <Box display="flex" gap={theme.spacing(2)} flexDirection="column">
          {filteredConversations.map((conversation, index) => (
            <>
              {showOptions !== `${itemKeyPrefix}-${index}` &&
                renderEachHistoryItem(
                  conversation,
                  `${itemKeyPrefix}-${index}`,
                  index,
                  `${itemKeyPrefix}`
                )}
              {showOptions === `${itemKeyPrefix}-${index}` &&
                renderEachHistoryItem(
                  conversation,
                  `${itemKeyPrefix}-${index}`,
                  index,
                  `${itemKeyPrefix}`
                )}
            </>
          ))}
        </Box>
      </>
    );
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <HistoryContainer $empty={isHistoryEmpty.current}>
      <Box
        display="flex"
        flexDirection="column"
        gap={theme.spacing(8)}
        className="history-container-group"
      >
        <Typography variant="p2Bold">Search</Typography>

        <TextField
          variant="outlined"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowOptions(""); // Reset options
            setEditting(undefined); // Reset editing
          }}
          size="small"
          sx={{
            marginTop: -4,
            marginBottom: 2,
            width: "100%",
            maxWidth: "400px",
            alignSelf: "center",
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <MagnifyingGlassIcon size={20} />
                </InputAdornment>
              ),
            },
          }}
        />

        {isHistoryEmpty.current && (
          <Typography
            variant="p2Bold"
            color={theme.palette.contrast.grayscale.level50}
          >
            History is empty! Start a new conversation.
          </Typography>
        )}
        {!isHistoryEmpty.current && (
          <Box display="flex" flexDirection="column" gap={theme.spacing(4)}>
            {/* {renderHistorySection("Today", "today", ["What is chatbot?", "How does AI work?"])}
            {renderHistorySection("Yesterday", "yesterday", ["Explain machine learning.", "What is deep learning?"])}
            {renderHistorySection("Last 7 Days", "last7Days", ["What is neural network?", "How does GPT work?"])}
            {renderHistorySection("Last 30 Days", "last30Days", ["What is data science?", "Explain reinforcement learning."])} */}
            {Object.entries(userHistory).map(([dayKey, conversations]) => {
              if (dayKey === "older" && !showOlder) {
                return null; // skip rendering key4 unless showExtra is true
              }
              return renderHistorySection(
                capitalize(dayKey),
                dayKey,
                conversations
              );
            })}
          </Box>
        )}
        {
          <HeaderButton
            variant="outlined"
            onClick={() => setShowOlder(true)}
            sx={{
              width: "fit-content",
              alignSelf: "center",
              display: !showOlder ? "flex" : "none",
            }}
          >
            <Typography
              variant="p3Bold"
              textTransform="none"
              color={theme.palette.contrast.grayscale.level50}
              mr={theme.spacing(4)}
            >
              Load more
            </Typography>
            <PlusCircleIcon
              size={theme.spacing(8)}
              color={theme.palette.contrast.grayscale.level50}
            />
          </HeaderButton>
        }
      </Box>
    </HistoryContainer>
  );
};
