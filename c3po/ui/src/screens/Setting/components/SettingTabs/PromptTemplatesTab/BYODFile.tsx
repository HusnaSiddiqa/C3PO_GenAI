import { Box, Button, Typography, useTheme } from "@mui/material";
import { CloudArrowUpIcon, XIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../../../../../contexts/UserContext";
import { uploadByodFile } from "../../../helpers/helpers";
import { ErrorTile } from "../../ErrorTile";
import { SuccessTile } from "../../SuccessTile";
import { SUPPORTED_FORMATS } from "../constant/constant";

type BYODFileProps = {
  setUploadedBYODFileData: (
    value: { file_url: string; filename: string; file_id: string; file_type: string } | null
  ) => void;
};

const BYODFile = ({ setUploadedBYODFileData }: BYODFileProps) => {
  const theme = useTheme();
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const userId = useContext(UserContext)?.user?.userId ?? "";

  // Auto-hide success and error messages after 1 second
  useEffect(() => {
    let successTimeout: ReturnType<typeof setTimeout> | null = null;
    let errorTimeout: ReturnType<typeof setTimeout> | null = null;

    if (successMessage) {
      successTimeout = setTimeout(() => setSuccessMessage(null), 1000);
    }

    if (errorMessage) {
      errorTimeout = setTimeout(() => setErrorMessage(null), 1000);
    }

    return () => {
      if (successTimeout) clearTimeout(successTimeout);
      if (errorTimeout) clearTimeout(errorTimeout);
    };
  }, [successMessage, errorMessage]);

  const uploadFileMutation = useMutation({
    mutationFn: uploadByodFile,
    onSuccess: (data: { file_url: string; filename: string; file_id: string; file_type: string }) => {
      setSuccessMessage("File uploaded successfully.");
      setUploadedBYODFileData(data);
      setErrorMessage(null);
    },
    onError: async (error: Response) => {
      setErrorMessage(error.statusText || "An error occurred while uploading the file.");
      setSelectedFile(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const fileExtension = file.name.substring(file.name.lastIndexOf("."));

      if (!SUPPORTED_FORMATS.includes(fileExtension)) {
        setErrorMessage(
          `Unsupported file format. Please upload a ${SUPPORTED_FORMATS.join(
            ", "
          )} file.`
        );
        return;
      }
      setErrorMessage(null);
      setSelectedFile(file);
    }
  };

  const onFileUploaded = (file: File) => {
    if (file) {
      const param: { file: File; user_id: string; } = {
        file: new File([file], file.name, { type: file.type }),
        user_id: userId
      };
      uploadFileMutation.mutate(param);
    }
  };


  return (
    <Box display="flex" gap={theme.spacing(8)} width="100%" >
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
          BYOD Data File
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
                border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                borderRadius: theme.spacing(2),
                paddingX: theme.spacing(4),
                paddingY: theme.spacing(2),
                display: "flex",
                alignItems: "center",
                gap: theme.spacing(4),
                cursor: "pointer",
              }}
              onClick={() => inputFileRef.current?.click()}
            >
              <input
                style={{ display: "none" }}
                ref={inputFileRef}
                type="file"
                onChange={handleFileChange}
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
                    color={selectedFile ? theme.palette.contrast.grayscale.level100 : theme.palette.contrast.grayscale.level50}
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
                    onClick={() => {
                      // e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  />
                )}
              </Box>
            </Box>
            <Box sx={{ marginLeft: "22px" }}>
              {errorMessage && (
                <ErrorTile message={errorMessage} visible={errorMessage ? true : false} />
              )}
              {successMessage && (
                <SuccessTile message={successMessage} visible={true} />
              )}
            </Box>
          </Box>
          <Button
            variant="contained"
            disabled={!selectedFile}
            onClick={() => selectedFile && onFileUploaded(selectedFile)}
            sx={{
              height: "fit-content",
              alignSelf: "start",
              paddingX: theme.spacing(4),
              paddingY: theme.spacing(3),
              ...theme.typography.p3Bold,
              textTransform: "none",
            }}
          >
            Upload
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default BYODFile;