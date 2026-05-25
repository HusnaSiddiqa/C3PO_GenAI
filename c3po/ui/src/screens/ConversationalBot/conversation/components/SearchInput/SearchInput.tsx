import {
  Button,
  CircularProgress,
  useTheme,
  Typography,
  Box,
  Select,
  MenuItem,
  Switch,
  Tooltip,
} from "@mui/material";
import {
  InputControls,
  SearchInputWrapper,
  VoidButton,
  PulseButtonContainer,
  PulseSpan,
  PulseCore,
  StopIconWrap,
  BRAND_900,
  BRAND_RAW,
} from "./styles";
import { type ChangeEvent, type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import {
  PaperclipIcon,
  PaperPlaneRightIcon,
  XCircleIcon,
  SquareIcon,
  BrainIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { authFetch } from "../../../../../helpers/authFetch";
import { ErrorTile } from "../../../../Setting/components/ErrorTile";

interface SearchInputProps {
  defaultInput: string | undefined;
  resetDefault: VoidFunction;
  onSearch: (input: string) => void;
  loading: boolean;
  disabled: boolean;
  streamError: string;
  onFileUploaded?: (fileId: string, fileName: string) => void;
  onStreamStopButtonClick: () => void;
  selectedSource?: string;
  setSelectedSource?: (val: string) => void;
  availableSources?: string[];
  isThinkingEnabled?: boolean;
  setIsThinkingEnabled?: (val: boolean) => void;
}

export const SearchInput = ({
  defaultInput = "",
  resetDefault,
  onSearch,
  loading,
  disabled,
  streamError,
  onFileUploaded,
  onStreamStopButtonClick,
  selectedSource,
  setSelectedSource,
  availableSources = [],
  isThinkingEnabled = false,
  setIsThinkingEnabled,
}: SearchInputProps) => {
  const theme = useTheme();
  const [inputText, setInputText] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [stopped, setStopped] = useState(false);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const SUPPORTED_FORMATS = [
    ".csv",
    ".xlsx",
    ".pdf",
    ".json",
    ".ppt",
    ".pptx",
    ".txt",
  ];

  const formRef = useRef<HTMLFormElement | null>(null); // Add this

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // // Click outside to dismiss error
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setErrorMessage(null);
      }
    };

    if (errorMessage) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [errorMessage]);

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", "harikrish@gilead.com");

      const recentConversationId = sessionStorage.getItem(
        "recentConversationId"
      );
      if (recentConversationId && recentConversationId !== "/") {
        formData.append("conversation_id", recentConversationId);
      }

      const response = await authFetch("/v2/chat-manager/conversation/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw response;
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsFileLoading(false);
      if (onFileUploaded) {
        onFileUploaded(data.file_id, data.filename);
      }
    },
    onError: async (error: Response) => {
      setIsFileLoading(false);
      if (error instanceof Response) {
        try {
          const err = await error.json();
          setErrorMessage(
            err.detail || "Failed to upload the file. Please try again."
          );
        } catch {
          setErrorMessage("Failed to upload the file. Please try again.");
        }
      } else {
        setErrorMessage("Failed to upload the file. Please try again.");
      }
    },
  });

  useEffect(() => {
    if (loading) setStopped(false);
  }, [loading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const fileExtension = file.name.substring(file.name.lastIndexOf("."));
      const fileSize = file.size;

      if (!SUPPORTED_FORMATS.includes(fileExtension)) {
        setErrorMessage(
          "Unsupported file format. Please upload a .csv, .xlsx, .pdf, or .json file."
        );
        return;
      }

      if (fileSize > MAX_FILE_SIZE) {
        setErrorMessage(
          "File size exceeds the 10MB limit. Please upload a smaller file."
        );
        return;
      }

      setErrorMessage(null);
      setUploadedFileName(file.name);
      setIsFileLoading(true);

      uploadFileMutation.mutate(file);
    }
  };

  const handleClearFile = () => {
    setUploadedFileName(null);
    setIsFileLoading(false);
    setErrorMessage(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSubmit = (evt: FormEvent) => {
    evt.preventDefault();

    if (inputText && uploadedFileName) {
      onSearch(`${inputText}`);
      setInputText(""); // Clear user input
      setUploadedFileName(null); // Reset uploadedFileName
    } else if (uploadedFileName) {
      onSearch(``);
      setUploadedFileName(null); // Reset uploadedFileName
    } else if (inputText) {
      onSearch(inputText);
      setInputText("");
    }
  };

  useEffect(() => {
    if (defaultInput) {
      setInputText(defaultInput);
      resetDefault();
    }
  }, [defaultInput, resetDefault]);

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {streamError && (
        <Box
          sx={{
            display: "flex",
            gap: theme.spacing(3),
            padding: theme.spacing(8),
          }}
        >
          <ErrorTile
            visible={!!streamError}
            message={streamError}
            width="40%"
          />
          {/* <Button
            onClick={() => {}}
            variant="outlined"
            sx={{
              outlineColor: "yellowgreen",
              color: theme.palette.contrast.status.redOff100,
            }}
          >
            <Typography
              color={theme.palette.contrast.status.redOff100}
              variant="p3Bold"
            >
              Regenerate
            </Typography>
          </Button> */}
        </Box>
      )}
      {setIsThinkingEnabled && (
        <Box
          display="flex"
          alignItems="center"
          gap={theme.spacing(2)}
          mb={theme.spacing(2)}
          sx={{ userSelect: "none" }}
        >
          <Tooltip title={isThinkingEnabled ? "Thinking enabled — model will reason step by step" : "Enable thinking mode"}>
            <Box display="flex" alignItems="center" gap={theme.spacing(1)} sx={{ cursor: "pointer" }} onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}>
              <BrainIcon
                size={16}
                color={isThinkingEnabled ? theme.palette.primary.main : theme.palette.text.disabled}
              />
              <Typography
                variant="p3"
                color={isThinkingEnabled ? theme.palette.primary.main : theme.palette.text.disabled}
              >
                Thinking
              </Typography>
              <Switch
                size="small"
                checked={isThinkingEnabled}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIsThinkingEnabled(e.target.checked)}
                onClick={(e: MouseEvent) => e.stopPropagation()}
                disabled={loading}
              />
            </Box>
          </Tooltip>
        </Box>
      )}
      <SearchInputWrapper
        style={{
          backgroundColor:
            loading && !stopped ? theme.palette.contrast.grayscale.level10 : "",
          opacity: loading && !stopped ? 0.6 : 1,
          transition: "background-color 0.2s, opacity 0.2s",
          borderRadius: "8px",
        }}
      >
        {/* File Box inside input container, above input row */}
        {uploadedFileName && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
              borderRadius: "6px",
              backgroundColor: theme.palette.background.paper,
              fontSize: "1rem",
              minHeight: "36px",
              marginBottom: theme.spacing(1),
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.contrast.grayscale.level50,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {uploadedFileName}
            </Typography>
            {isFileLoading && (
              <CircularProgress
                size={16}
                sx={{
                  marginLeft: theme.spacing(1),
                  color: theme.palette.contrast.grayscale.level50,
                }}
              />
            )}
            <VoidButton onClick={handleClearFile}>
              <XCircleIcon />
            </VoidButton>
          </div>
        )}

        <InputControls>
          {/* Source Dropdown - shown when backend returns available sources */}
          {setSelectedSource && availableSources && availableSources.length > 0 && (
            <Select
              value={selectedSource || "Auto"}
              onChange={(e) => setSelectedSource(e.target.value as string)}
              disabled={loading}
              size="small"
              variant="standard"
              disableUnderline
              sx={{
                minWidth: 100,
                fontSize: "0.85rem",
                color: theme.palette.text.secondary,
                "& .MuiSelect-select": {
                  paddingY: "4px",
                  paddingLeft: "8px",
                },
                "&::before, &::after": { display: "none" },
                borderRight: `1px solid ${theme.palette.divider}`,
                paddingRight: theme.spacing(2),
              }}
            >
              <MenuItem value="Auto">Auto</MenuItem>
              {availableSources.map((source) => (
                <MenuItem key={source} value={source}>
                  {source}
                </MenuItem>
              ))}
            </Select>
          )}
          <input
            type="text"
            placeholder={
              loading && !stopped
                ? "Processing your query..."
                : "Ask me anything..."
            }
            value={inputText}
            onChange={(evt) => setInputText(evt.currentTarget.value)}
            disabled={(loading && !stopped) || disabled}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              padding: "8px 12px",
              fontSize: "1rem",
              color: theme.palette.text.primary,
              backgroundColor: "transparent",
            }}
          />
          {loading ? (
            <VoidButton
              onClick={onStreamStopButtonClick}
              style={{ position: "relative", width: 36, height: 36 }}
              aria-label="Stop streaming"
              title="Stop"
            >
              <PulseButtonContainer>
                <PulseSpan style={{ ["--i" as any]: 0 }} />
                <PulseSpan style={{ ["--i" as any]: 1 }} />
                <PulseCore />
              </PulseButtonContainer>

              <StopIconWrap>
                <SquareIcon size={16} weight="bold" color={BRAND_900} />
              </StopIconWrap>
            </VoidButton>
          ) : (
            <>
              <VoidButton
                type="submit"
                disabled={
                  disabled || !!errorMessage || !inputText // disables if no text
                }
                style={{
                  opacity: disabled || !!errorMessage || !inputText ? 0.4 : 1,
                  pointerEvents:
                    disabled || !!errorMessage || !inputText ? "none" : "auto",
                  transition: "opacity 0.2s",
                  position: "relative",
                  width: 36,
                  height: 36,
                }}
              >
                <PaperPlaneRightIcon
                  color={BRAND_RAW}
                  size={theme.spacing(8)}
                />
              </VoidButton>
            </>
          )}
          <Button
            component="label"
            startIcon={
              <PaperclipIcon
                color={theme.palette.contrast.grayscale.level50}
                size={theme.spacing(8)}
              />
            }
            disabled={disabled}
          >
            <input
              id="file-upload"
              ref={inputRef}
              type="file"
              accept={SUPPORTED_FORMATS.join(",")}
              hidden
              onChange={handleFileChange}
              disabled={disabled}
              onBlur={() => setErrorMessage(null)}
            />
          </Button>
        </InputControls>
      </SearchInputWrapper>
      {errorMessage && (
        <Typography
          color="error"
          variant="body2"
          sx={{
            marginTop: theme.spacing(1),
            color:
              theme.palette.mode === "dark"
                ? theme.palette.error.light
                : theme.palette.error.main,
            backgroundColor:
              theme.palette.mode === "dark"
                ? "rgba(244, 67, 54, 0.1)"
                : "rgba(244, 67, 54, 0.05)",
            padding: theme.spacing(1),
            borderRadius: "4px",
            border: `1px solid ${theme.palette.mode === "dark"
                ? theme.palette.error.dark
                : theme.palette.error.light
              }`,
          }}
        >
          {errorMessage}
        </Typography>
      )}
    </form>
  );
};
