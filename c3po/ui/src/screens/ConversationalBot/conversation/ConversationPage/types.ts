export type File = {
  file_id: string;
  filename: string;
  file_type: string;
};
export type ThinkingStep = {
  content: string;
  timestamp?: string;
  stage?: string;
};

export type Message = {
  role: string;
  text: string;
  data: [];
  type: "user_input" | "summary" | string;
  summary?: null | string; // Summary can be null or string
  sql_query?:string
  result?: ResultEntity[] | string | null;
  chart: {
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
  message_type: "user_input" | "summary" | string;
  data_limit_exceeded?: boolean;
  user_id?: string;
  conversation_id: string;
  message_id?: string;
  timestamp?: string;
  file?: File;
  index?: number; // Add this property to track the index of the message
  stage?: string; // Add stage for status updates
  selected_agents?: string[]; // Add selected agents for routing info
  error_type?: string; // Add error type for error handling
  error_message?: string; // Add error message for error handling
  error_occurred?: boolean; // Add error occurred flag
  thinking_steps?: ThinkingStep[]; // Intermediate messages collected during streaming
};

export type Conversation = {
  conversation_id: string;
  title: string;
  messages: Message[];
  user_id?: string;
};

export interface ResultEntity {
  [key: string]: string;
}

export type StreamedMessage = {
  file: any;
  PK: string;
  SK: string;
  event: "synthetic" | "status-update" | "artifact-update" | "title_update";
  conversation_id: string;
  role: "system" | "assistant" | "user";
  message_id: string;
  is_final: boolean;
  title?: string; // Add title for title_update events
  chart?: {
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
  timestamp: string;
  stage: string;
  message?: string;
  agent_message?: string;
  contextId?: string;
  taskId?: string;
  artifactId?: string;
  artifact_name?: string;
  summary?: string;
  sql_query?: string;
  result?: ResultEntity[] | string | null;
  parse_error?: string;
  selected_agents?: string[]; // Add selected agents
  type?: string; // Add type for artifact updates
  error_type?: string; // Add error type for error handling
  error_message?: string; // Add error message for error handling
  error_occurred?: boolean; // Add error occurred flag
  data_limit_exceeded?: boolean;
  user_id?: string;
};

export const convertStreamedToMessage = (stream: StreamedMessage): Message => {
  // Safely extract and sanitize text content
  const getSafeText = () => {
    const text = stream.agent_message || stream.summary || stream.message || "";

    // If text is too long or contains complex formatting, truncate it
    if (text.length > 10000) {
      return text.substring(0, 10000) + "... [Content truncated due to length]";
    }

    // Remove or escape problematic characters that might cause markdown parsing issues
    return (
      text
        .replace(/```/g, "`") // Replace triple backticks with single
        .replace(/`/g, "\\`") // Escape single backticks
        .replace(/\*\*/g, "\\*\\*") // Escape double asterisks
        .replace(/\*/g, "\\*") // Escape single asterisks
        // .replace(/#{1,6}\s/g, "") // Remove markdown headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to plain text
        .replace(/\n{3,}/g, "\n\n")
    ); // Limit consecutive newlines
  };

  // Helper to ensure result is always an array if possible
  const getParsedResult = () => {
    if (typeof stream.result === "string") {
      let parsed = stream.result;
      // Try to handle double-encoded JSON strings
      try {
        while (typeof parsed === "string") {
          parsed = JSON.parse(parsed);
        }
        // console.log("Parsed result (robust):", parsed);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error(
          "Failed to robustly parse result string:",
          stream.result,
          e
        );
        return [];
      }
    }
    return Array.isArray(stream.result) ? stream.result : [];
  };

  let file: File | undefined;
  if (stream.file) {
    if (typeof stream.file === "string") {
      try {
        file = JSON.parse(stream.file);
      } catch {
        file = undefined;
      }
    } else {
      file = stream.file as File;
    }
  }

  return {
    role: stream.role || "assistant",
    text: getSafeText(),
    data: [],
    type:
      stream.event === "synthetic"
        ? "summary"
        : stream.event === "artifact-update" && stream.type
        ? stream.type
        : stream.event || stream.type || "summary",
    summary: stream.summary ?? null,
    result: getParsedResult(),
    chart:
      stream.chart && typeof stream.chart === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(stream.chart);
              return parsed && Object.keys(parsed).length > 0 ? parsed : null;
            } catch {
              return null;
            }
          })()
        : stream.chart && Object.keys(stream.chart).length > 0
        ? stream.chart
        : null,
    message_type:
      stream.event === "synthetic"
        ? "summary"
        : stream.event === "artifact-update" && stream.type
        ? stream.type
        : stream.event || stream.type || "summary",
    conversation_id: stream.conversation_id || "",
    message_id: stream.message_id || "",
    timestamp: stream.timestamp || "",
    stage: stream.stage || "",
    selected_agents: stream.selected_agents || [],
    error_type: stream.error_type || "",
    error_message: stream.error_message || "",
    error_occurred: stream.error_occurred || false,
    file,
    sql_query: stream.sql_query || "",
    data_limit_exceeded: stream.data_limit_exceeded,
    user_id: stream.user_id,
  };
};
