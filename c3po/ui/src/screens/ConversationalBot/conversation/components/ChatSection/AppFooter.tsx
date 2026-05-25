import { Box, Link, useTheme } from '@mui/material';
import Typography from "@mui/material/Typography";
import { WarningIcon } from '@phosphor-icons/react';

type AppFooterProps = {
  openDisclaimer?: () => void;
}

const AppFooter = ({ openDisclaimer }: AppFooterProps) => {
  const theme = useTheme()
  const handleReadMore = () => {
    if (openDisclaimer) {
      openDisclaimer();
    }
  }

  return (
    <Box paddingInline={theme.spacing(8)} sx={{ mt: 4 }} component="footer" display="flex" alignItems="center" width="100%" justifyContent="space-between">
      <Box display="flex" alignItems="center" gap={theme.spacing(2)}>
        <WarningIcon weight='fill' color={theme.palette.contrast.grayscale.level50} size={theme.spacing(4)} />
        <Typography variant="f1" color={theme.palette.contrast.grayscale.level50}>
          Make sure AI-generated content is accurate and appropriate before using.
          AI-generated content may be incorrect.
        </Typography>
        <Link onClick={handleReadMore} style={{ cursor: 'pointer' }}>
          <Typography variant='f1Bold' color={theme.palette.contrast.main.main100}>Read more</Typography>
        </Link>
      </Box>
      <Box display="flex" alignItems="center" gap={theme.spacing(4)}>
        <Typography variant='f1' color={theme.palette.contrast.grayscale.level50}>GenAI App © 2026</Typography>
      </Box>
    </Box>
  );
};

export default AppFooter;