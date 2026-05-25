import React from 'react';
import { Dialog, DialogContent, Box, Typography, useTheme, } from '@mui/material';
import { X } from 'phosphor-react';



interface ResponsePopupProps {
  open: boolean;
  onClose: () => void;
  data: string
}


const Popup: React.FC<ResponsePopupProps> = ({ open, onClose, data }) => {
  const theme = useTheme();
  return (
    <Dialog open={open} maxWidth="md" fullWidth>
      <DialogContent sx={{ padding: 0 }}>
        <Box
          sx={{
            display: "flex",
            width: "100%",
            padding: "12px",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: "12px",
            background: theme.palette.contrast.grayscale.level0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              paddingBottom: "12px",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6px",
              alignSelf: "stretch",
              borderBottom: `1px solid ${theme.palette.contrast.grayscale.level10}`,
            }}
          ><Typography
              sx={{
                color: theme.palette.contrast.grayscale.level75,
                fontFamily: "Proxima Nova",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              Response
            </Typography><X onClick={onClose} style={{ width: "16px", height: "16px", flexShrink: 0, gap: 2 }} weight='fill' color={theme.palette.contrast.grayscale.level100} />
          </Box>
            <Box sx={{ alignSelf: "stretch", flexDirection: "row", }}>
              <Typography
                sx={{
                  color: theme.palette.contrast.grayscale.level75,
                  fontFamily: "Proxima Nova",
                  fontSize: "16px",
                  fontWeight: 400,
                }}
              >
                {data}
              </Typography>
            </Box>

        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default Popup;
