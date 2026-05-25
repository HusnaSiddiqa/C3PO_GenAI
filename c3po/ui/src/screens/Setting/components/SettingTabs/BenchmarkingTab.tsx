import {
  Box,
  Button,
  InputAdornment,
  List,
  ListItem,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { InfoIcon, XIcon } from "@phosphor-icons/react";
import { CloudArrowUp, ToggleLeft, ToggleRight } from "phosphor-react";
import { useContext, useEffect, useRef, useState } from "react";
import { TableComponent } from "../TableComponent";
import { FeedbackTableDataType } from "./FeedbackTab";
import {
  getClickableQuestions,
  onBenchmarkingRunCall,
  updateClickableQuestions,
  uploadClickableFile,
} from "../../helpers/helpers";
import { useMutation } from "@tanstack/react-query";
import { ClickableQuestionsDetails } from "../../helpers/types";
import { UserContext } from "../../../../../src/contexts/UserContext";
import { ErrorTile } from "../ErrorTile";
import { SuccessTile } from "../SuccessTile";
import { useUnsavedChanges } from "../../context/UnsavedTabChangesContext";


export const BenchmarkingTab = () => {
  const theme = useTheme();
  const [file, setFile] = useState<File>();
  const [tableData, setTableData] = useState<FeedbackTableDataType | null>(
    null
  );
  const [showInfo, setShowInfo] = useState(false);
  const [clickableFlags, setClickableFlags] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<boolean>(false);
  const [clickableQuestionsData, setClickableQuestionsData] = useState<
    ClickableQuestionsDetails[]
  >([]);
  const [originalQuestionsData, setOriginalQuestionsData] = useState<
    ClickableQuestionsDetails[]
  >([]);
  const [timestamp, setTimestamp] = useState<string>("");
  const userId = useContext(UserContext).user?.userId ?? "";
  const [disabled, setDisabled] = useState<boolean>(false);
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [unsavedFlag, setUnsavedFlag] = useState<boolean>(false);
  const hasInitialDataLoaded = useRef(false);

  // Call clickableQuestions on component load only once, even after tab switches
  useEffect(() => {
    if (!hasInitialDataLoaded.current) {
      clickableQuestions();
      hasInitialDataLoaded.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUnsavedFlag(true);
    setSuccess(false);
    setError(undefined);
    setFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const toggleClickable = (id: string) => {
    setClickableFlags((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const {
    mutate: clickableQuestions,
    isPending,
    isError: isClickableQuestionsError,
  } = useMutation({
    mutationFn: getClickableQuestions,
    mutationKey: ["clickableQuestionsKey", userId],
    onSuccess: (data: ClickableQuestionsDetails[]) => {
      formatTimestamp(new Date().toISOString());
      setClickableQuestionsData(data);
      setOriginalQuestionsData(data);
    },
    throwOnError: true,
    retry: false,
  });

  const { mutate: uploadFile, isPending: isUploading } = useMutation({
    mutationFn: uploadClickableFile,
    onSuccess: () => {
      clickableQuestions(); // Only call after successful upload, not on update error
    },
    onError: (error) => {
      setError(error.message);
      setFile(undefined);
    },
  });

  const { mutate: updateClickableQuestion } = useMutation({
    mutationFn: updateClickableQuestions,
    onSuccess: (response: { updated_items: { updated_at: string }[] }) => {
      setUnsavedFlag(false);
      setSuccess(true);
      setDisabled(true);
      const raw = response.updated_items[0].updated_at;
      formatTimestamp(raw);
      clickableQuestions(); // Only refresh after successful update
    },
    onError: (error) => {
      setError(error.message);
      setSuccess(false);
    },
  });

const { mutate: getMatchScores, isPending: isOnBenchmarkingRunCallPending } =
    useMutation({
      mutationFn: onBenchmarkingRunCall,
      onSuccess: () => {
        console.log("Benchmark run complete. Refetching data from the database...");
        clickableQuestions();
      },
      onError: (error) => {
        setError(error.message);
      },
    });
  const formatTimestamp = (raw: string) => {
    const date = new Date(raw);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatted = `${pad(date.getDate())}/${pad(
      date.getMonth() + 1
    )}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    setTimestamp(formatted);
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (error) {
      timeoutId = setTimeout(() => setError(undefined), 2000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [error]);

  useEffect(() => {
    if (file) {
      const param = {
        file: new File([file], file.name, { type: file.type }),
        user_id: userId,
      };
      uploadFile(param);
    }
  }, [file, userId, uploadFile]);

  useEffect(() => {
    if (clickableQuestionsData.length > 0) {
      // Only set initial flags when questions data changes
      setClickableFlags(() => {
        const newFlags: Record<string, boolean> = {};
        clickableQuestionsData.forEach((item) => {
          const rowId = item.PK || item.SK;
          newFlags[rowId] = item.enabled;
        });
        return newFlags;
      });
    }
  }, [clickableQuestionsData]);

  useEffect(() => {
    if (clickableQuestionsData.length > 0) {
      const data: Record<string, string | React.ReactNode>[] =
        clickableQuestionsData.map((item: ClickableQuestionsDetails, idx) => {
          const rowId = item.PK || item.SK;
          const isActive = clickableFlags[rowId] ?? item.enabled;
          const SwitchIcon = isActive ? ToggleLeft : ToggleRight;
          return {
            ...item,
            enabled: (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  textTransform: "none",
                }}
              >
                <SwitchIcon
                  key={rowId}
                  size="24"
                  cursor="pointer"
                  onClick={() => toggleClickable(rowId)}
                  weight={isActive ? "fill" : "regular"}
                  color={
                    isActive
                      ? theme.palette.contrast.main.main100
                      : theme.palette.contrast.grayscale.level50
                  }
                  style={{ ...theme.typography.p3Bold, cursor: "pointer" }}
                  values={clickableFlags[rowId] ? "true" : "false"}
                />
                <TextField
                  size="small"
                  variant="outlined"
                  value={item.category || ""}
                  placeholder="Category"
                  sx={{ minWidth: 18, width: "auto", minHeight: 15 }}
                  onChange={(e) => {
                    const newCategory = e.target.value;
                    setClickableQuestionsData((prev) =>
                      prev.map((q, i) =>
                        (q.PK || q.SK) === rowId
                          ? { ...q, category: newCategory }
                          : q
                      )
                    );
                  }}
                />
              </Box>
            ),
            scorer: typeof item.scorer === 'boolean' ? String(item.scorer).toUpperCase() : 'N/A',
          };
        });

      setTableData({
        columns: [
          { id: "question", label: "Question" },
          { id: "expected_answer", label: "Expected Answer" },
          { id: "expected_sql", label: "SQL Query" },
          { id: "enabled", label: "Use as Clickable" },
          { id: "scorer", label: "Match score" },
        ],
        rows: data,
      });
    }
  }, [clickableQuestionsData, clickableFlags, theme.palette.mode]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (success) {
      timeoutId = setTimeout(() => setSuccess(false), 2000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [success]);

  useEffect(() => {
    setHasUnsavedChanges(unsavedFlag); //For unsaved changes context
  }, [unsavedFlag, setHasUnsavedChanges]);

  const handleRun = () => {
    if (file) {
      getMatchScores({
        benchmark_file: file,
        user_id: userId,
      });
    }
  };

  const handleSave = () => {
    setError(undefined);
    // Find only modified rows
    const modifiedRows = clickableQuestionsData
      ?.filter((item) => {
        const rowId = item.PK || item.SK;
        const original = originalQuestionsData?.find(
          (orig) => (orig.PK || orig.SK) === rowId
        );
        if (!original) return true; // New row
        const enabledNow = clickableFlags[rowId] ?? item.enabled;
        const enabledOrig = original.enabled;
        const categoryNow = item.category || "";
        const categoryOrig = original.category || "";

        const scorerNow = item.scorer;
        const scorerOrig = original.scorer;
        return enabledNow !== enabledOrig || categoryNow !== categoryOrig || scorerNow !== scorerOrig;
      })
      .map((item) => {
        const rowId = item.PK || item.SK;
        return {
          PK: item.PK,
          SK: item.SK,
          category: item.category || "",
          enabled: clickableFlags[rowId] ?? item.enabled,
          scorer: item.scorer,
        };
      });
        console.log("Data being sent to backend:", modifiedRows);
    updateClickableQuestion(modifiedRows);
  };

  const hasModifications = clickableQuestionsData.some((item) => {
    const rowId = item.PK || item.SK;
    const original = originalQuestionsData.find(
      (orig) => (orig.PK || orig.SK) === rowId
    );
    if (!original) return true; // New row
    const enabledNow = clickableFlags[rowId] ?? item.enabled;
    const enabledOrig = original.enabled;
    const categoryNow = item.category || "";
    const categoryOrig = original.category || "";
    return enabledNow !== enabledOrig || categoryNow !== categoryOrig;
  });

  return (
    <>
      <Box
        sx={{
          display: "flex",
          padding: "12px",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          width: "100%",
          gap: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography
          sx={{
            color: theme.palette.text.primary,
            fontFeatureSettings: "'liga' off, 'clig' off",
            fontFamily: "Proxima Nova",
            fontSize: "24px",
            fontStyle: "normal",
            fontWeight: "700",
            lineHeight: "normal",
          }}
        >
          Benchmarking
        </Typography>

        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
          <TextField
            size="small"
            variant="outlined"
            value={file?.name || ""}
            placeholder="No file selected"
            slotProps={{
              input: {
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <Button
                      component="label"
                      role={undefined}
                      tabIndex={-1}
                      sx={{ minWidth: 0 }}
                    >
                      <CloudArrowUp
                        fill="none"
                        size={24}
                        style={{
                          color: theme.palette.text.secondary,
                          cursor: "pointer",
                        }}
                      />
                      <input
                        type="file"
                        hidden
                        accept=".csv"
                        onChange={handleFileChange}
                      />
                    </Button>
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end" sx={{ cursor: "pointer" }}>
                    {file && (
                      <XIcon
                        size={24}
                        style={{
                          color: theme.palette.text.secondary,
                          cursor: isOnBenchmarkingRunCallPending
                            ? "not-allowed"
                            : "pointer",
                          opacity: isOnBenchmarkingRunCallPending ? 0.5 : 1,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(undefined);
                          setUnsavedFlag(false);
                          setTableData(null);
                          setClickableQuestionsData([]);
                          setOriginalQuestionsData([]);
                        }}
                      />
                    )}
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: "200px",
              gap: "6px",
              borderRadius: "6px",
              border: theme.palette.divider,
              background: theme.palette.contrast.grayscale.level0,
            }}
          />
          <InfoIcon
            aria-label="info"
            onClick={() => setShowInfo((prev) => !prev)}
            weight="fill"
            style={{
              color: theme.palette.text.secondary,
              marginTop: 2,
              marginLeft: 2,
              width: "12px",
              height: "12px",
              aspectRatio: "1/1",
            }}
          />
          {showInfo && <InfoText />}
          <Button
            onClick={handleRun}
            variant="contained"
            sx={{
              ...theme.typography.p3Bold,
              paddingX: theme.spacing(4),
              paddingY: theme.spacing(3),
              textTransform: "none",
            }}
            disabled={isOnBenchmarkingRunCallPending}
          >
            Run
          </Button>
        </Box>
      </Box>
      <ErrorTile visible={!!error} message={error} />
      {success && <SuccessTile visible={success} />}
      <Box sx={{ height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            height: "100%",
            padding: "0 24px 24px 40px",
            alignItems: "flex-start",
            gap: "12px",
            flexShrink: 0,
            alignSelf: "stretch",
            flexDirection: "column",
          }}
        >
          {isPending || isUploading ? (
            <Typography>Loading...</Typography>
          ) : (
            <Box
              sx={{
                display: "flex",
                paddingTop: "20px",
                flexDirection: "row",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Typography
                sx={{
                  overflow: "hidden",
                  color: theme.palette.text.secondary,
                  fontFeatureSettings: "'liga' off, 'clig' off",
                  textOverflow: "ellipsis",
                  fontFamily: "Proxima Nova",
                  fontSize: "16px",
                  fontStyle: "normal",
                  fontWeight: "700",
                  lineHeight: "normal",
                }}
              >
                Data Preview
              </Typography>
              <Typography
                sx={{
                  color: theme.palette.text.disabled,
                  fontFeatureSettings: "'liga' off, 'clig' off",
                  fontFamily: "Proxima Nova",
                  fontSize: "14px",
                  fontStyle: "normal",
                  fontWeight: "400",
                  lineHeight: "normal",
                }}
              >
                {` Last updated : ${timestamp}`}
              </Typography>
            </Box>
          )}

          {tableData && (
            <>
              <TableComponent
                data={tableData}
                download={true}
                disabled={disabled}
                benchmarkData={true}
              />

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  width: "100%",
                  mt: 4,
                }}
              >
                <Button
                  onClick={handleSave}
                  variant="contained"
                  disabled={!hasModifications} // <-- Only enabled if there are modifications
                  sx={{
                    ...theme.typography.p3Bold,
                    paddingX: theme.spacing(4),
                    paddingY: theme.spacing(3),
                    textTransform: "none",
                  }}
                >
                  Save
                </Button>
              </Box>
            </>
          )}
        </Box>
        {isClickableQuestionsError && (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="p2"
              color={theme.palette.contrast.grayscale.level50}
            >
              No data to preview
            </Typography>
          </Box>
        )}
      </Box>
    </>
  );
};

const InfoText = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "absolute",
        right: "114px",
        top: "205px",
        borderRadius: "12px",
        background: theme.palette.contrast.grayscale.level0,
        border: `0px solid ${theme.palette.contrast.grayscale.level10}`,
        zIndex: 10,
      }}
    >
      <Box
        sx={{
          padding: "24px",
          justifyContent: "space-between",
          alignItems: "center",
          alignSelf: "stretch",
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography
          sx={{
            color: theme.palette.text.secondary,
            fontFamily: "Arial",
            fontSize: "14px",
            fontWeight: 700,
            lineHeight: "20px",
            mb: 1,
          }}
        >
          File Format Guidelines
        </Typography>
        <List sx={{ listStyleType: "disc", pl: 2 }}>
          <ListItem
            sx={{
              display: "list-item",
              color: theme.palette.text.secondary,
              fontFamily: "Arial",
              fontSize: "14px",
            }}
          >
            CSV file with headers: question, expected_answer, category, enabled,
            Order, sql_query
          </ListItem>
          <ListItem
            sx={{
              display: "list-item",
              color: theme.palette.text.secondary,
              fontFamily: "Arial",
              fontSize: "14px",
            }}
          >
            Questions should be clear and specific
          </ListItem>
          <ListItem
            sx={{
              display: "list-item",
              color: theme.palette.text.secondary,
              fontFamily: "Arial",
              fontSize: "14px",
            }}
          >
            Expected answers should match the format you want the agent to
            respond with
          </ListItem>
          <ListItem
            sx={{
              display: "list-item",
              color: theme.palette.text.secondary,
              fontFamily: "Arial",
              fontSize: "14px",
            }}
          >
            Expected SQL should be valid SQL queries that produce the expected
            answer
          </ListItem>
        </List>
      </Box>
    </Box>
  );
};