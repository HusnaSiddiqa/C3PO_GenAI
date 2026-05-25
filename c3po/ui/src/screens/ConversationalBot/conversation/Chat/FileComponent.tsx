import { Box, useTheme, IconButton } from "@mui/material";
import {
  FileIcon,
  CloudArrowDownIcon,
  FilePdfIcon,
  FileCsvIcon,
  FilePptIcon,
  FileImageIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { useTheme as getTheme } from "@mui/material";
import { authFetch } from "../../../../helpers/authFetch";

interface FileComponentProps {
  fileId?: string; // The ID of the file to download
  filename?: string;
  downloadUrl?: string;
}

function getFileTypeColor(filename?: string) {
  const theme = getTheme();
  if (!filename) return theme.palette.background.main; // default background
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return theme.palette.contrast.status.redLight; // light red
    case "csv":
      return theme.palette.contrast.status.green10; // light green
    case "ppt":
    case "pptx":
      return theme.palette.contrast.status.orange10; // light orange
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return theme.palette.contrast.status.green10; // light blue
    default:
      return theme.palette.background.main; // default background
  }
}

function getFileIcon(filename?: string) {
  const theme = getTheme();
  if (!filename)
    return (
      <FileIcon
        size={22}
        color={theme.palette.contrast.grayscale.level100}
        style={{ marginRight: 8 }}
      />
    );
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return (
        <FilePdfIcon
          size={22}
          color={theme.palette.contrast.grayscale.level100}
          style={{ marginRight: 8 }}
        />
      );
    case "csv":
      return (
        <FileCsvIcon
          size={22}
          color={theme.palette.contrast.grayscale.level100}
          style={{ marginRight: 8 }}
        />
      );
    case "ppt":
    case "pptx":
      return (
        <FilePptIcon
          size={22}
          color={theme.palette.contrast.grayscale.level100}
          style={{ marginRight: 8 }}
        />
      );
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return (
        <FileImageIcon
          size={22}
          color={theme.palette.contrast.grayscale.level100}
          style={{ marginRight: 8 }}
        />
      );
    default:
      return (
        <FileIcon
          size={22}
          color={theme.palette.contrast.grayscale.level100}
          style={{ marginRight: 8 }}
        />
      );
  }
}

export const FileComponent = ({ filename, fileId }: FileComponentProps) => {
  const theme = useTheme();
  const bgColor = getFileTypeColor(filename);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await authFetch(
        `/v2/chat-manager/conversation/download/${fileId}`,
        {
          method: "GET",
        }
      );
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      return blob;
    },
    onError: (error: Error) => {
      setErrorMsg(error.message);
    },
    onSuccess: (blob: Blob) => {
      setErrorMsg(null);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  });

  useEffect(() => {
    if (!errorMsg) return;
    function handleClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setErrorMsg(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [errorMsg]);

  return (
    <Box ref={boxRef}>
      <Box
        sx={{
          background: bgColor,
          border: `1px solid  ${theme.palette.contrast.main.main100}`,
          borderRadius: "8px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          color: theme.palette.text.primary,
          fontSize: "1rem",
          boxShadow: 1,
        }}
      >
        {getFileIcon(filename)}
        <Box sx={{ flex: 1 }}>{filename}</Box>
        <IconButton
          onClick={() => {
            downloadMutation.mutate();
          }}
          size="small"
          sx={{ ml: 1 }}
          disabled={downloadMutation.isPending}
        >
          <CloudArrowDownIcon
            size={22}
            color={theme.palette.contrast.grayscale.level100}
          />
        </IconButton>
      </Box>
      {errorMsg && (
        <Box
          sx={{
            color: theme.palette.contrast.status.red,
            fontSize: "0.9rem",
            mt: 1,
          }}
        >
          {errorMsg}
        </Box>
      )}
    </Box>
  );
};
