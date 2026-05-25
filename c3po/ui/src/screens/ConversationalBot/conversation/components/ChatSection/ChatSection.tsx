import { Box, Card, Grid, Typography, useTheme, Skeleton } from "@mui/material";
import { TextIndentIcon, TextOutdentIcon } from "@phosphor-icons/react";
import { HeaderButton } from "./HeaderButton";
import { useQuery } from "@tanstack/react-query";
import { Chat } from "../../Chat/Chat";
import type { Message } from "../../ConversationPage/types";
import { authFetch } from "../../../../../helpers/authFetch";

type ChatSectionProps = {
  isMenuOpen: boolean;
  openMenu: () => void;
  conversationHistory: Message[];
  toShowInitialStaticLoader: boolean;
  handleSelectQuestion: (text: string) => void;
  conversationLoading: boolean;
  conversationError: boolean;
  uploadedFileName?: string | null;
  conversationTitle?: string;
  isBotResponseStreaming: boolean;
  userId: string;
};

export const ChatSection = ({
  openMenu,
  isMenuOpen,
  conversationHistory,
  toShowInitialStaticLoader,
  handleSelectQuestion,
  conversationLoading,
  conversationError,
  conversationTitle,
  isBotResponseStreaming,
  userId,
}: ChatSectionProps) => {
  const theme = useTheme();

  const { data, isLoading, error } = useQuery({
    queryKey: [],
    queryFn: () =>
      authFetch(`/v2/admin/settings/onboarding`).then((res) => res.json()),
    retry: true,
  });

  const displayTitle = conversationTitle ? (
    conversationTitle
  ) : isLoading ? (
    <Skeleton width="50%" />
  ) : error ? (
    "Error loading agent name"
  ) : (
    data?.agent_name
  );

  const displayDescription = conversationTitle
    ? data?.agent_name
    : data?.agent_description;

  return (
    <>
      <Card variant="elevation" sx={{ overflow: "unset", zIndex: 1 }}>
        <Grid container rowGap={theme.spacing(8)} flexWrap={"wrap"}>
          <Grid size="grow">
            <Box display="flex" alignItems="center" gap={theme.spacing(4)}>
              <HeaderButton variant="outlined" onClick={openMenu}>
                {!isMenuOpen ? (
                  <TextIndentIcon
                    size={theme.spacing(8)}
                    color={theme.palette.contrast.grayscale.level50}
                  />
                ) : (
                  <TextOutdentIcon
                    size={theme.spacing(8)}
                    color={theme.palette.contrast.grayscale.level50}
                  />
                )}
              </HeaderButton>
              <Box display="flex" flexDirection="column">
                <Typography
                  variant="h5"
                  sx={{
                    textTransform: "capitalize",
                    fontFamily: "Proxima Nova, sans-serif",
                  }}
                >
                  {displayTitle}
                </Typography>
                <Typography
                  variant="p2"
                  sx={{
                    fontFamily: "Proxima Nova, sans-serif",
                    marginTop: theme.spacing(2),
                  }}
                >
                  {isLoading ? (
                    <Skeleton width="80%" />
                  ) : error ? (
                    "Error loading agent description"
                  ) : (
                    displayDescription
                  )}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Card>
      {!isBotResponseStreaming && conversationLoading && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <div>Loading...</div>
        </Box>
      )}
      {!isBotResponseStreaming && conversationError && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <div>Error fetching conversation: {conversationError}</div>
        </Box>
      )}

      <Chat
        conversationHistory={conversationHistory}
        agentName={data?.agent_name}
        toShowInitialStaticLoader={toShowInitialStaticLoader}
        isBotResponseStreaming={isBotResponseStreaming}
        handleSelectQuestion={handleSelectQuestion}
        userId={userId}
      />
    </>
  );
};

export default ChatSection;
