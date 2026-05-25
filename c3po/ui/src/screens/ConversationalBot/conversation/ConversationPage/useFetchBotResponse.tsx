import { useMutation } from "@tanstack/react-query";
import { StreamedMessage } from "./types";
import { authFetch } from "../../../../helpers/authFetch";

type StreamBotPayload = {
  text: string;
  conversationId: string | null;
  fileId: string | null;
  userId?: string;
  selectedSource?: string | null;
  isThinkingEnabled?: boolean;
};

type StreamBotResult = {
  conversationId: string;
};

let abortController: AbortController | null = null;

export const useStreamBotResponse = () => {
  const mutation = useMutation<
    StreamBotResult,
    Error,
    StreamBotPayload & {
      onStreamingMessage: (message: StreamedMessage) => void;
      onStreamFinalMessage: (finalMessage: StreamedMessage) => void;
      onStreamError?: (err: Error) => void;
    }
  >({
    mutationFn: async ({
      text,
      conversationId,
      fileId,
      userId,
      selectedSource,
      isThinkingEnabled,
      onStreamingMessage,
      onStreamFinalMessage,
      onStreamError,
    }) => {
      abortController = new AbortController(); // reset for each request

      const effectiveUserId = userId ?? "harikrishnan.palanisamy@gilead.com";
      try {
        const response = await authFetch(
          "/v2/chat-manager/conversation/query-stream",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: abortController.signal,
            body: JSON.stringify({
              conversation_id: conversationId,
              user_id: effectiveUserId, // TODO: move to context/env
              message: text,
              file: fileId ? { file_id: fileId } : null,
              selected_source: selectedSource,
              thinking_enabled: isThinkingEnabled ?? false,
            }),
          }
        );

        if (!response.ok || !response.body) {
          throw new Error(`Stream error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed: StreamedMessage = JSON.parse(line);
              if (parsed.is_final === true) {
                onStreamFinalMessage(parsed); // Only handle it as final
              } else {
                onStreamingMessage(parsed); // Only non-final goes here
              }
            } catch (err) {
              console.warn("Stream parse error:", err, line);
              onStreamError?.(err as Error);
            }
          }
        }

        return { conversationId: conversationId || "new" };
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          console.log("Stream aborted by user.");
          return { conversationId: conversationId || "new" };
        } else {
          onStreamError?.(err as Error);
          throw err;
        }
      }
    },
  });

  const cancelStream = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  return {
    ...mutation,
    cancelStream,
  };
};
