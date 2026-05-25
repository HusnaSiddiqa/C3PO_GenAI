import { useContext, useState } from "react";
import styled, { css } from "styled-components";
import {
  ChatCenteredDots,
  Copy,
  ThumbsDown,
  ThumbsUp,
  X,
} from "phosphor-react";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { UserContext } from "../../../../../contexts/UserContext";
import { authFetch } from "../../../../../helpers/authFetch";
import { useTheme } from "@mui/material";

interface ModalProps {
  $bg: string;
}
interface TitleProps {
  $color: string;
}
interface StyledTextareaProps {
  $border: string;
  $bg: string;
  $color: string;
}

const MessageActions = styled.div`
  display: flex;
  gap: 5px;
  color: #606770;
  margin-left: auto;
`;

const iconStyles = css<{ selected?: boolean }>`
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  padding: 2px;
  ${({ selected }) =>
    selected &&
    css`
      border-color: #0b1e3d;
      color: #a9a9a9 !important;
    `};
`;

const StyledThumbsUp = styled((props) => (
  <ThumbsUp {...props} weight={props.selected ? "fill" : "regular"} />
))<{ selected?: boolean }>`
  ${iconStyles}
  color: ${({ selected }) => (selected ? "#a9a9a9" : "#606770")};
`;

const StyledThumbsDown = styled((props) => (
  <ThumbsDown {...props} weight={props.selected ? "fill" : "regular"} />
))<{ selected?: boolean }>`
  ${iconStyles}
  color: ${({ selected }) => (selected ? "#a9a9a9" : "#606770")};
`;

const StyledCopy = styled(Copy)<{ selected?: boolean }>`
  ${iconStyles}
`;

const StyledChatCenteredDots = styled(ChatCenteredDots)<{ selected?: boolean }>`
  ${iconStyles}
  color: ${({ selected }) => (selected ? "#a9a9a9" : "#606770")};
`;

const CopyMessage = styled.div`
  font-size: 12px;
  color: green;
  padding-left: 8px;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const Modal = styled.div<ModalProps>`
  width: 400px;
  background-color: ${({ $bg }) => $bg};
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.div<TitleProps>`
  display: flex;
  align-items: center;
  font-weight: 700;
  font-size: 18px;
  color: ${({ $color }) => $color};
  gap: 12px;
`;

const IconBox = styled.div`
  padding: 6px;
  border-radius: 6px;
  background-color: darkgray;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CloseButton = styled.button`
  background-color: #f0f0f0;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #333;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background-color: #ddd;
  }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #e0e0e0;
`;

const StyledTextarea = styled.textarea<StyledTextareaProps>`
  width: 100%;
  min-height: 100px;
  resize: none;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid ${({ $border }) => $border};
  font-size: 14px;
  outline: none;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  &:focus {
    border-color: #1976d2;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const CancelButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  color: #666;
  cursor: pointer;
`;

const SubmitButton = styled.button<{ disabled?: boolean }>`
  padding: 8px 16px;
  border-radius: 6px;
  background: ${({ disabled }) => (disabled ? "#eee" : "#1976d2")};
  color: ${({ disabled }) => (disabled ? "#aaa" : "white")};
  border: none;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
`;

const submitFeedback = async ({
  userId,
  message_id,
  feedback,
  feedback_rating,
  messageTimestamp,
}: {
  userId?: string; // Optional userId if needed
  message_id: string;
  feedback?: string;
  feedback_rating?: string;
  messageTimestamp?: string;
}) => {
  const response = await authFetch(
    `/v2/chat-manager/feedback/message/${message_id}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId || "",
        message_id,
        feedback_rating,
        feedback_comment: feedback,
        conversation_id: sessionStorage.getItem("recentConversationId") || "",
        assistant_message_timestamp: messageTimestamp,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to send feedback");
  }

  return response.json();
};

const useSubmitFeedback = () => {
  return useMutation({
    mutationFn: submitFeedback,
  });
};

export const FeedbackIconsBar = ({
  text,
  messageId, // Optional messageId if needed
  messageTimestamp,
  rating,
  comment,
}: {
  text: string;
  messageId?: string; // Optional messageId if needed
  messageTimestamp?: string; // Optional timestamp for the message
  rating?: string; // Optional rating if needed
  comment?: string; // Optional comment if needed
}) => {
  const [thumbStatus, setThumbStatus] = useState<
    "positive" | "negative" | null
  >(rating === "positive" || rating === "negative" ? rating : null);
  const [activeIcon, setActiveIcon] = useState<"comment" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState(comment || ""); // Initialize with existing comment if available
  // const [feedbackRating, setFeedbackRating] = useState('');
  const { user } = useContext(UserContext);
  const { mutate } = useSubmitFeedback();
  const theme = useTheme();

  const handleThumb = (type: "positive" | "negative") => {
    if (thumbStatus === type) {
      // Do nothing if the same thumb is clicked
      return;
    }
    setThumbStatus(type);
    setActiveIcon(null);
    setShowModal(false);
    handleSubmitFeedback(
      messageId ?? "",
      feedback,
      type,
      messageTimestamp ?? ""
    );
  };

  const handleCommentClick = () => {
    setShowModal((prev) => !prev);
    setActiveIcon((prev) => (prev === "comment" ? null : "comment"));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => {
        setActiveIcon(null);
        setCopied(false);
      }, 2000);
    });
    setActiveIcon("copy");
  };

  const handleSubmitFeedback = async (
    message_id: string,
    feedback: string,
    feedback_rating: string,
    messageTimestamp?: string
  ) => {
    mutate(
      {
        userId: user?.userId || "",
        message_id,
        feedback,
        feedback_rating,
        messageTimestamp,
      },
      {
        onSuccess: () => {
          setFeedback("");
          if (feedback) {
            setShowModal(false);
          }
        },
        onError: (error) => {
          setShowModal(false);
          console.error("Error submitting feedback:", error);
        },
      }
    );
  };

  return (
    <>
      <MessageActions data-testId="messageactions">
        <StyledThumbsUp
          size={25}
          selected={thumbStatus === "positive"}
          onClick={() => {
            handleThumb("positive");
          }}
        />
        <StyledThumbsDown
          size={25}
          selected={thumbStatus === "negative"}
          onClick={() => {
            handleThumb("negative");
          }}
        />
        <StyledChatCenteredDots
          size={25}
          selected={activeIcon === "comment"}
          onClick={thumbStatus ? handleCommentClick : undefined}
          style={{
            cursor: thumbStatus ? "pointer" : "not-allowed",
            opacity: thumbStatus ? 1 : 0.3,
          }}
        />

        <StyledCopy
          size={25}
          selected={activeIcon === "copy"}
          onClick={handleCopy}
        />
        {copied && <CopyMessage>Copied! </CopyMessage>}
      </MessageActions>

      {showModal && (
        <Overlay>
          <Modal
            $bg={
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : "#fff"
            }
          >
            <ModalHeader>
              <Title
                $color={
                  theme.palette.mode === "dark"
                    ? theme.palette.contrast.grayscale.level100
                    : "#1b2c4b"
                }
              >
                <IconBox>
                  <ChatCenteredDots size={20} color="#0b1e3d" />
                </IconBox>
                Send Feedback
              </Title>
              <CloseButton
                onClick={() => {
                  setShowModal(false);
                  setActiveIcon(null);
                }}
              >
                <X size={18} />
              </CloseButton>
            </ModalHeader>
            <Divider />
            <StyledTextarea
              placeholder="Type your feedback..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              $border={
                theme.palette.mode === "dark"
                  ? theme.palette.contrast.grayscale.level10
                  : "#ccc"
              }
              $bg={
                theme.palette.mode === "dark"
                  ? theme.palette.background.default
                  : "#fff"
              }
              $color={
                theme.palette.mode === "dark"
                  ? theme.palette.contrast.grayscale.level100
                  : "#1b2c4b"
              }
            />
            <Footer>
              <CancelButton
                onClick={() => {
                  setShowModal(false);
                  setActiveIcon(null);
                }}
              >
                Cancel
              </CancelButton>
              <SubmitButton
                disabled={!feedback.trim()}
                onClick={() => {
                  handleSubmitFeedback(
                    messageId ?? "",
                    feedback,
                    thumbStatus ?? "", // Convert null to empty string
                    messageTimestamp
                  );
                  setActiveIcon(null);
                }}
              >
                Send
              </SubmitButton>
            </Footer>
          </Modal>
        </Overlay>
      )}
    </>
  );
};
