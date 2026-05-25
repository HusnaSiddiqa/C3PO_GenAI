import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme
} from "@mui/material";
import { Delete } from "@mui/icons-material"
import { IconContext } from "phosphor-react";
import { deleteSubAgent } from "../../../helpers/helpers";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSelectedAgent } from "./context/SelectedAgentContext";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

const AgentTile = ({
  agentName,
  isSelected,
  onClick,
  hasSubAgents,
  icon,
  parentAgentID,
  isSubAgent = false,
}: {
  agentName: string;
  isSelected: boolean;
  onClick: () => void;
  hasSubAgents: boolean;
  icon: React.ReactNode;
  parentAgentID: string;
  isSubAgent?: boolean;
}) => {
  const theme = useTheme();
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState<boolean>(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const queryClient = useQueryClient();
  const { setSelectedAgent } = useSelectedAgent();
  const showAsSelected = isSelected && !hasSubAgents;

  const refreshSubAgents = () => queryClient.invalidateQueries({
    queryKey: ["subAgents", parentAgentID]
  });

  function dismissDialog() {
    setSelectedAgent(null)
    setErrorMessage('');
    setIsErrorDialogOpen(false);
    refreshSubAgents();
  }

  function handleDeleteClick() {
    setIsDeleteConfirmationOpen(true);
  }

  function handleConfirmDelete() {
    setIsDeleteConfirmationOpen(false);
    deleteSubAgentFlow();
  }

  function handleCancelDelete() {
    setIsDeleteConfirmationOpen(false);
  }

  function deleteSubAgentFlow() {
    setErrorMessage('');

    return deleteSubAgent(agentName)
      .then(() => {
        setSelectedAgent(null)
        refreshSubAgents();
      })
      .catch((reason) => {
        setIsErrorDialogOpen(true);
        setErrorMessage(reason.message);
      });
  }

  return (
    <Box
      width={"100%"}
      padding={theme.spacing(1)}
      display={"flex"}
      alignItems={"center"}
      justifyContent={"space-between"}
      gap={theme.spacing(4)}
      borderRadius={theme.spacing(1.3)}
      borderRight={
        showAsSelected
          ? `6px solid ${theme.palette.contrast.main.main100}`
          : undefined
      }
      bgcolor={showAsSelected ? theme.palette.contrast.status.blue10 : undefined}
      onClick={onClick}
      sx={{
        cursor: "pointer",
        transition: "background-color 0.2s ease",
        "&:hover": {
          backgroundColor: showAsSelected
            ? theme.palette.contrast.status.blue10
            : theme.palette.action.hover, // or any light shade you prefer
        },
      }}
    >
      <Box
        display={"flex"}
        alignItems={"center"}
      >
        <Box
          marginRight={theme.spacing(2)}
          padding={theme.spacing(2)}
          borderRadius={theme.spacing(2)}
          bgcolor={
            !showAsSelected ? theme.palette.contrast.grayscale.level5 : undefined
          }
          display={"flex"}
          alignItems={"center"}
        >
          <IconContext.Provider
            value={{
              size: theme.spacing(7),
              height: "100%",
              color: theme.palette.contrast.main.main100,
              display: "flex"
            }}
          >
            {icon}
          </IconContext.Provider>
        </Box>
        <Typography
          color={
            showAsSelected
              ? theme.palette.contrast.main.main100
              : theme.palette.contrast.grayscale.level100
          }
          variant={showAsSelected ? "p3Bold" : "p3"}
        >
          {agentName}
        </Typography>
      </Box>
      {
        isSubAgent &&
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick();
          }}
          size="small"
        >
          <Delete fontSize="small" />
        </IconButton>
      }
      <DeleteConfirmationDialog
        open={isDeleteConfirmationOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        agentName={agentName}
      />
      <Dialog open={isErrorDialogOpen}>
        <DialogTitle>
          Error deleting sub-agent
        </DialogTitle>
        <DialogContent>
          {errorMessage}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={(e) => {
              e.stopPropagation();
              deleteSubAgentFlow();
            }}
          >
            Retry
          </Button>
          <Button onClick={(e) => {
            e.stopPropagation();
            dismissDialog();
          }}>
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentTile;