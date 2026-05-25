import { authFetch } from "../../../../helpers/authFetch";
import type { Message, Conversation } from "./types";

export async function fetchConversation(id: string): Promise<Conversation> {
  const res = await authFetch(`/v2/chat-manager/chat/conversation/${id}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }
    throw new Error("Failed to fetch conversation");
  }
  const data = await res.json();
  const filteredMessages = data.messages.map(
    ({
      role,
      type,
      summary,
      conversation_id,
      message_id,
      timestamp,
      result,
      chart,
      file,
      feedback_rating,
      feedback_comment,
      data_limit_exceeded,
      sql_query,
    }: Message) => ({
      role,
      message_type: type,
      summary,
      conversation_id,
      message_id,
      timestamp,
      result,
      chart,
      file,
      feedback_rating,
      feedback_comment,
      sql_query,
      data_limit_exceeded,
    })
  );

  return {
    title: data.title || "Untitled Conversation",
    conversation_id: data.conversation_id,
    messages: filteredMessages,
    user_id: data.user_id,
  };
}
