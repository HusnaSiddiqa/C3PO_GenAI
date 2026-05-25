import { Box, Button, Typography, useTheme } from "@mui/material";
import { CloudArrowUpIcon, XIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../../../../../contexts/UserContext";
import { getBenchmarkDetails } from "../../../helpers/helpers";
import { ErrorTile } from "../../ErrorTile";

function isValidFile(file: File | null): boolean {
  const maxSizeInBytes = 10 * 1024 * 1024; // 10 MB
  if (!file) return true;

  // Check file size
  if (file.size > maxSizeInBytes) {
    return false;
  }

  // Check file type - only allow CSV and XLSX for benchmarking
  const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  const allowedBenchmarkFormats = [".csv", ".xlsx"];

  return allowedBenchmarkFormats.includes(fileExtension);
}

const BenchmarkingInputFile = (
  {
    uploadedBYODFileData,
    agentName,
    accuracy,
    setAccuracy,
    selectedFile,
    setSelectedFile,
  }: {
    uploadedBYODFileData?: {
      file_url: string;
      filename: string;
      file_id: string;
      file_type: string
    } | null,
    agentName: string
    accuracy: string | null,
    setAccuracy: (value: string) => void,
    selectedFile: File | null,
    setSelectedFile: (file: File | null) => void,
  }
) => {
  const theme = useTheme();
  const inputFileRef = useRef<HTMLInputElement>(null);

  const userId = useContext(UserContext)?.user?.userId ?? "";
  const [error, setError] = useState<string | null>(null);

  // Auto-hide error message after 1 second
  useEffect(() => {
    let errorTimeout: ReturnType<typeof setTimeout> | null = null;

    if (error) {
      errorTimeout = setTimeout(() => setError(null), 1000);
    }

    return () => {
      if (errorTimeout) clearTimeout(errorTimeout);
    };
  }, [error]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      const allowedBenchmarkFormats = [".csv", ".xlsx"];

      // Clear previous errors
      setError(null);

      // Check file type first
      if (!allowedBenchmarkFormats.includes(fileExtension)) {
        setError(`Invalid file format. Only CSV (.csv) and Excel (.xlsx) files are allowed for benchmarking.`);
        setSelectedFile(null);
        return;
      }

      // Check file size
      const maxSizeInBytes = 10 * 1024 * 1024; // 10 MB
      if (file.size > maxSizeInBytes) {
        setError(`File size too large. Maximum allowed size is 10 MB.`);
        setSelectedFile(null);
        return;
      }

      // File is valid
      setSelectedFile(file);
    }
  };

  const { mutate: getAccuracy, isPending: isBenchmarkRunning } = useMutation({
    mutationFn: getBenchmarkDetails, // This now returns a proper promise
    onSuccess: (data) => {
      setAccuracy(data.accuracy);
    },
    onSettled: (data) => {
      if (data) {
        console.log(data, "hello from onSettled");
        setAccuracy(data.accuracy);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleRun = (selectedFile: File) => {
    if (uploadedBYODFileData && selectedFile && agentName) {
      getAccuracy({
        benchmark_file: selectedFile,
        user_id: userId,
        agent_name: agentName,
        BYOD_file_data: uploadedBYODFileData,
      });
    } else if (selectedFile && agentName) {
      getAccuracy({
        benchmark_file: selectedFile,
        user_id: userId,
        agent_name: agentName
      });

    }
  }

  return (
    <Box display="flex" gap={theme.spacing(8)} width="100%">
      <Box
        sx={{
          maxWidth: "255px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing(2),
        }}
      >
        <Typography
          variant="p3Bold"
          sx={{ color: theme.palette.contrast.grayscale.level75 }}
        >
          Benchmarking file
        </Typography>
        <Box display="flex" alignItems="center" gap={theme.spacing(1.3)}>
          <Box
            width="100%"
            display="flex"
            flexDirection="column"
            gap={theme.spacing(1.3)}
          >
            <Box
              sx={{
                border: `1px solid ${isValidFile(selectedFile)
                  ? theme.palette.contrast.grayscale.level10
                  : theme.palette.contrast.status.redOff100
                  }`,
                borderRadius: theme.spacing(2),
                paddingX: theme.spacing(4),
                paddingY: theme.spacing(2),
                display: "flex",
                alignItems: "center",
                gap: theme.spacing(4),
                cursor: isBenchmarkRunning ? "not-allowed" : "pointer",
                opacity: isBenchmarkRunning ? 0.7 : 1,
              }}
              onClick={() => !isBenchmarkRunning && inputFileRef.current?.click()}
            >
              <input
                style={{ display: "none" }}
                ref={inputFileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                data-testid="file-upload"
                disabled={isBenchmarkRunning}
              />
              <Box
                display="flex"
                alignItems="center"
                flex={1}
                justifyContent="space-between"
              >
                <Box display="flex" alignItems="center" gap={theme.spacing(2)}>
                  <CloudArrowUpIcon
                    size={theme.spacing(7)}
                    color={theme.palette.contrast.grayscale.level50}
                  />
                  <Typography
                    color={theme.palette.contrast.grayscale.level50}
                    variant="p3"
                    sx={{
                      maxWidth: "108px",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedFile ? selectedFile.name : "Pick a file"}
                  </Typography>
                </Box>
                {selectedFile && (
                  <XIcon
                    onClick={(e) => {
                      if (!isBenchmarkRunning) {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setError(null);
                        // Reset the file input value to allow re-uploading the same file
                        if (inputFileRef.current) {
                          inputFileRef.current.value = '';
                        }
                      }
                    }}
                    style={{
                      cursor: isBenchmarkRunning ? 'not-allowed' : 'pointer',
                      opacity: isBenchmarkRunning ? 0.5 : 1,
                    }}
                  />
                )}
              </Box>
            </Box>
            {/* File type hint */}
            <Typography
              sx={{
                fontSize: theme.spacing(3.5),
                color: theme.palette.contrast.grayscale.level50,
                fontStyle: "italic",
              }}
            >
              Supported formats: CSV (.csv) - Max size: 10MB
            </Typography>

            {/* Validation error messages */}
            {selectedFile && !isValidFile(selectedFile) && (
              <Typography
                sx={{
                  fontSize: theme.spacing(4),
                  color: theme.palette.contrast.status.redOff100,
                }}
              >
                {selectedFile.size > 10 * 1024 * 1024
                  ? "File exceeds size limit (10MB)"
                  : "Invalid file format. Only CSV files are allowed."}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            disabled={!selectedFile || !isValidFile(selectedFile) || isBenchmarkRunning}
            onClick={() => selectedFile && handleRun(selectedFile)}
            sx={{
              height: "fit-content",
              alignSelf: "start",
              paddingX: theme.spacing(4),
              paddingY: theme.spacing(3),
              ...theme.typography.p3Bold,
              textTransform: "none",
            }}
          >
            {isBenchmarkRunning ? "Running..." : "Run"}
          </Button>
        </Box>
        <Box sx={{ marginLeft: "22px" }}>
          {error && <ErrorTile visible={error ? true : false} message={error} />}
        </Box>
      </Box>

      <Box display="flex" flexDirection="column" gap={theme.spacing(4)}>
        <Typography
          variant="p3Bold"
          sx={{ color: theme.palette.contrast.grayscale.level75 }}
        >
          Accuracy
        </Typography>
        {accuracy && selectedFile ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.spacing(4),
              backgroundColor: theme.palette.contrast.status.green10,
              paddingX: theme.spacing(4),
              paddingY: theme.spacing(1),
              border: `1px solid ${theme.palette.contrast.status.green100}`,
            }}
          >
            <Typography
              variant="f1Bold"
              sx={{
                color: theme.palette.contrast.status.green100,
              }}
            >
              {accuracy}
            </Typography>
          </Box>
        ) : (
          <Typography
            variant="p3"
            sx={{
              color: theme.palette.contrast.grayscale.level50,
            }}
          >
            N/A
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default BenchmarkingInputFile;