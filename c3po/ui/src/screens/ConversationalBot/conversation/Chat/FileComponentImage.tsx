import { Box, Divider, useTheme } from "@mui/material";
import { CloudArrowDownIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import tablet from "../images/tablet.jpg"; // Dummy image
import React from "react";
import { authFetch } from "../../../../helpers/authFetch";

interface FileComponentImageProps {
  fileId?: string;
  filename?: string;
  downloadUrl?: string;
}

export const FileComponentImage = ({
  filename,
  fileId,
}: FileComponentImageProps) => {
  const theme = useTheme();
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
    <Box
      ref={boxRef}
      sx={{
        width: 340,
        bgcolor: theme.palette.contrast.fixed.white, // <-- White background
        borderRadius: 1,
        boxShadow: 1,
        p: 2,
        position: "relative",
      }}
    >
      {/* Dummy image */}
      <Box
        sx={{
          width: "100%",
          height: 160,
          bgcolor: theme.palette.contrast.status.blue10,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
        }}
      >
        <img
          src={tablet}
          alt={filename || "dummy image"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "8px",
          }}
        />
      </Box>
      {/* Horizontal line */}
      <Divider sx={{ mb: 2 }} />
      {/* Download icon at bottom right */}
      {/* <Box sx={{ display: "flex", justifyContent: "flex-end" }}> */}
      <Box
        sx={{ display: "flex", justifyContent: "flex-end", cursor: "pointer" }}
        onClick={() => downloadMutation.mutate()}
      >
        <CloudArrowDownIcon
          size={22}
          color={theme.palette.contrast.main.main100}
        />
      </Box>
      {/* </Box> */}
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
