import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFeedbackDetails } from "../../helpers/helpers";
import { useContext, useEffect, useRef, useState } from "react";
import { Box, Button, TextField, Typography, useTheme } from "@mui/material";
import { ThumbsDownIcon, ThumbsUpIcon } from "@phosphor-icons/react";
import Popup from "../Popup";
import { SuccessTile } from "../SuccessTile";
import { ErrorTile } from "../ErrorTile";
import { UserContext } from "../../../../../src/contexts/UserContext";
import { useUnsavedChanges } from "../../context/UnsavedTabChangesContext";
import { DirtyChangesWarning } from "../DirtyChangesWarning";
interface props {
  selectedRowData: Record<string, string | Object>;
  showFeedbackDetailsFlag: boolean;
  onBackButtonClick: (showFeedbackDetailsFlag: boolean) => void;
}

export const FeedbackDetails = ({
  selectedRowData,
  showFeedbackDetailsFlag,
  onBackButtonClick,
}: props) => {
  const [feedbackData, setFeedbackData] =
    useState<Record<string, string | Object>>();
  const [disableButton, setDisableButton] = useState<boolean>(true);
  const [showFeedbackTable, setShowFeedbackTable] = useState<boolean>(
    showFeedbackDetailsFlag
  );
  const [sqlQuery, setSqlQuery] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [openWarning, setOpenWarning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [originalSqlQuery, setOriginalSqlQuery] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const { user } = useContext(UserContext);
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const queryClient = useQueryClient();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (showSuccess) {
      setOpenWarning(false);
      setDisableButton(true);
      timeout = setTimeout(() => setShowSuccess(false), 2000);
    }
    if (showError) {
      timeout = setTimeout(() => setShowError(false), 2000);
    }
    return () => clearTimeout(timeout);
  }, [showSuccess, showError]);

  useEffect(() => {
    if (selectedRowData) {
      setFeedbackData(selectedRowData);
    }
    if (feedbackData) {
      const query = feedbackData?.sql_query?.toString() || "";
      setSqlQuery(query);
      setOriginalSqlQuery(query);
    }
  }, [selectedRowData, feedbackData]);

  useEffect(() => {
    if (showSuccess) {
      setOpenWarning(false);
      setDisableButton(true);
      // Auto-hide success message after 1 second
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  useEffect(() => {
    // Check if current SQL query is different from original
    const hasChanges = sqlQuery !== originalSqlQuery;
    setDisableButton(!hasChanges);
    setHasUnsavedChanges(hasChanges); //For unsaved changes context
  }, [sqlQuery, originalSqlQuery, setHasUnsavedChanges]);

  const setQuery = (val: string) => {
    setSqlQuery(val);
  };

  const handleSave = (data: Record<string, string | Object>) => {
    // Extract the ID from the ArrowCircleRightIcon component
    let id = "";
    if (data.id && typeof data.id === "object" && "props" in data.id) {
      id = (data.id as any).props.values;
    } else if (typeof data.id === "string") {
      id = data.id;
    }

    const feedbackData: {
      id: string;
      sql_query: string;
      user_id: string;
      conversation_id: string;
    } = {
      id: data.id?.toString() || "",
      sql_query: sqlQuery,
      conversation_id: data.conversation_id?.toString() || "",
      user_id: data.user_id?.toString() || "",
    };
    saveData(feedbackData);
  };

  const handleBack = () => {
    if (!disableButton) {
      setOpenWarning(true);
    } else {
      setShowFeedbackTable(true);
      onBackButtonClick(showFeedbackTable);
    }
  };

  const handleClickMore = () => {
    setOpen(true);
  };

  const { mutate: saveData } = useMutation({
    mutationFn: updateFeedbackDetails,
    onSuccess: (data) => {
      setShowSuccess(true);
      // Update the original query to match current state
      setOriginalSqlQuery(sqlQuery);
      setQuery(data?.updated_fields?.feedback_sql_query || "");
      // Invalidate and refetch the feedback data to ensure persistence
      // queryClient.invalidateQueries({ queryKey: ["feedbackDetails"] });
    },
    onError: () => {
      setShowError(true);
      // Auto-hide error message after 3 seconds
      const timer = setTimeout(() => {
        setShowError(false);
      }, 3000);
      return () => clearTimeout(timer);
    },
  });

  return (
    <>
      {feedbackData && (
        <Box
          ref={ref}
          sx={{
            display: "flex",
            height: "100%",
            padding: "24px",
            flexDirection: "column",
            alignItems: "flexStart",
            gap: "12px",
            flexShrink: 0,
            alignSelf: "stretch",
          }}
        >
          {showSuccess && <SuccessTile visible={showSuccess} />}
          {showError && <ErrorTile visible={showError} />}
          <Box
            sx={{
              display: "flex",
              padding: "12px",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              width: "100%",
              gap: 2,
            }}
          >
            <Box display="flex" alignItems="center" gap={2}>
              <Typography
                sx={{
                  color: theme.palette.text.primary,
                  fontFamily: "Proxima Nova",
                  fontSize: "24px",
                  fontWeight: 700,
                }}
              >
                User ID:
              </Typography>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: theme.palette.text.primary,
                  fontFamily: "Proxima Nova",
                  fontSize: "14px",
                  fontWeight: 400,
                  lineHeight: "20px",
                  maxWidth: 200,
                }}
              >
                {selectedRowData?.user_id?.toString()}
              </Typography>
            </Box>
            <Box display="flex" gap={2}>
              <ThumbsUpIcon
                weight={
                  feedbackData?.rating?.toString() === "positive" ||
                  feedbackData?.rating?.toString() === "5"
                    ? "fill"
                    : "regular"
                }
                color={
                  theme.palette.mode === "dark"
                    ? theme.palette.success.light
                    : theme.palette.contrast.status.green100
                }
                style={{ width: "24px", height: "24px", marginTop: "6px" }}
              />
              <ThumbsDownIcon
                weight={
                  feedbackData?.rating?.toString() === "negative" ||
                  feedbackData?.rating?.toString() === "1"
                    ? "fill"
                    : "regular"
                }
                color={
                  theme.palette.mode === "dark"
                    ? theme.palette.success.light
                    : theme.palette.contrast.status.redOff100
                }
                style={{ width: "24px", height: "24px", marginTop: "6px" }}
              />
              <Button
                onClick={handleBack}
                variant="contained"
                sx={{
                  ...theme.typography.p3Bold,
                  paddingX: theme.spacing(4),
                  paddingY: theme.spacing(3),
                  textTransform: "none",
                }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                disabled={disableButton}
                onClick={() => handleSave(feedbackData)}
                sx={{
                  ...theme.typography.p3Bold,
                  paddingX: theme.spacing(4),
                  paddingY: theme.spacing(3),
                  textTransform: "none",
                }}
              >
                {"Save"}
              </Button>
              {openWarning ? (
                <DirtyChangesWarning
                  open={openWarning}
                  onClose={() => {
                    setOpenWarning(false);
                    onBackButtonClick(showFeedbackTable);
                  }}
                  onStay={() => {
                    setOpenWarning(false);
                  }}
                />
              ) : (
                ""
              )}
            </Box>
          </Box>
          <Box
            key={0}
            sx={{
              display: "flex",
              flexDirection: "column",
              padding: "16px 24px",
              gap: 1,
              flex: 1, // Take remaining space
              minHeight: 0, // Allow proper flex shrinking
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                color: theme.palette.text.secondary,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
              }}
            >
              Prompt
            </Typography>
            <Typography
              sx={{
                color: theme.palette.contrast.grayscale.level100,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
                fontWeight: 400,
              }}
            >
              {feedbackData?.prompt?.toString()}
            </Typography>
            <Typography
              sx={{
                fontWeight: 700,
                color: theme.palette.text.secondary,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
              }}
            >
              Response
              <Typography
                onClick={handleClickMore}
                component={"span"}
                sx={{
                  color:
                    theme.palette.mode === "dark"
                      ? theme.palette.contrast.main.main100
                      : theme.palette.primary.main,
                  cursor: "pointer",
                  fontFeatureSettings: "'liga' off, 'clig' off",
                  marginLeft: "6px",
                  /* Paragraph/font-p3 */
                  fontFamily: "Proxima Nova",
                  fontSize: "14px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "normal",
                }}
              >
                View All
              </Typography>
              <Popup
                open={open}
                data={feedbackData?.response?.toString()}
                onClose={() => setOpen(false)}
              />
            </Typography>
            <Typography
              component={"span"}
              sx={{
                color: theme.palette.contrast.grayscale.level100,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
                fontWeight: 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
              }}
            >
              {feedbackData?.response?.toString()}
            </Typography>
            <Typography
              sx={{
                fontWeight: 700,
                color: theme.palette.text.secondary,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
              }}
            >
              Agent
            </Typography>
            <Typography
              sx={{
                color: theme.palette.contrast.grayscale.level100,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
                fontWeight: 400,
              }}
            >
              {feedbackData?.Agent?.toString()}
            </Typography>
            <Typography
              sx={{
                fontWeight: 700,
                color: theme.palette.text.secondary,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
              }}
            >
              Feedback / Comment (If any)
            </Typography>
            <Typography
              sx={{
                color: theme.palette.contrast.grayscale.level100,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
                fontWeight: 400,
              }}
            >
              {feedbackData?.feedback?.toString()}
            </Typography>
            <Typography
              sx={{
                fontWeight: 700,
                color: theme.palette.text.secondary,
                fontFamily: "Proxima Nova",
                fontSize: "14px",
              }}
            >
              SQL Query
            </Typography>
            <TextField
              value={sqlQuery}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              maxRows={12}
              size="small"
              variant="outlined"
              sx={{
                "& .MuiInputBase-root": {
                  minHeight: "150px",
                  maxHeight: "300px",
                  alignItems: "flex-start",
                  overflow: "hidden", // Prevent outer container from scrolling
                },
                "& .MuiInputBase-inputMultiline": {
                  minHeight: "130px !important",
                  maxHeight: "280px",
                  overflowY: "auto !important", // Force scrollbar when needed
                  resize: "none", // Remove resize to avoid conflicts
                  padding: "0 !important", // Remove default padding conflicts
                  lineHeight: "1.5", // Better line spacing for readability
                  fontFamily: "monospace", // Better for SQL code
                  fontSize: "13px", // Slightly smaller for more content
                },
                "& .MuiOutlinedInput-root": {
                  padding: "12px",
                  overflow: "hidden", // Prevent outer container from scrolling
                },
                "& .MuiOutlinedInput-root.Mui-focused": {
                  "& .MuiInputBase-inputMultiline": {
                    overflowY: "auto !important", // Ensure scroll works when focused
                  },
                },
                // Custom scrollbar styling for better UX
                "& .MuiInputBase-inputMultiline::-webkit-scrollbar": {
                  width: "8px",
                },
                "& .MuiInputBase-inputMultiline::-webkit-scrollbar-track": {
                  background: "#f1f1f1",
                  borderRadius: "4px",
                },
                "& .MuiInputBase-inputMultiline::-webkit-scrollbar-thumb": {
                  background: "#c1c1c1",
                  borderRadius: "4px",
                  "&:hover": {
                    background: "#a8a8a8",
                  },
                },
              }}
            />
          </Box>
        </Box>
      )}
    </>
  );
};
