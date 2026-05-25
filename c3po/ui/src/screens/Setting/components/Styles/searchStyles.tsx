import { styled } from '@mui/material/styles';
import InputBase from '@mui/material/InputBase';

export const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  width: 200,
  height: 36,
  borderWidth: 1,
  paddingTop: 6,
  paddingBottom: 6,
  paddingLeft: 12,
  borderTopLeftRadius: 6,
  borderBottomLeftRadius: 6,
  borderStyle: 'solid',
  borderColor: theme.palette.grey[400],
  display: 'flex',
  alignItems: 'center',
}));

export const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: 34.8,
  position: 'relative',
  display: 'flex',
  alignItems: "center",
  justifyContent: "end",
  backgroundColor: theme.palette.contrast.main.main100
}));

export const StyledInputBase = styled(InputBase)(() => ({
  color: 'inherit',
}));