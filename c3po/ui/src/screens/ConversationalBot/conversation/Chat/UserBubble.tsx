import { Box } from "@mui/material";
import { ChatUserBallom, ChatContent } from "./styles";
import type { Message } from "../ConversationPage/types";
import { FileComponent } from "./FileComponent";

interface UserBubbleProps {
  chat: Message;
  index: number;
}

export const UserBubble = ({
  chat,
  index,
}: UserBubbleProps) => {

  return (
    <Box
      key={`user-balloon-${index}`}
      display="flex"
      alignItems="flex-end"
      flexDirection="column"
    >
      <ChatUserBallom $role="user" variant="elevation" $error={undefined}>
        <ChatContent
          sx={{ fontFamily: "Proxima Nova, sans-serif" }}
          $role="user"
        >

          { chat.file?.filename && (
            <FileComponent
              fileId={chat.file.file_id}
              filename={chat.file.filename}
              />
          ) }
          
          {chat.summary && (
            <span
              style={{
                display: "block",
                marginTop: chat.file?.filename ? 4 : 0,
                textAlign: "left",
                width: "100%",
              }}
            >
              {chat.summary}
            </span>
          )}
        </ChatContent>
      </ChatUserBallom>
    </Box>
  );
};