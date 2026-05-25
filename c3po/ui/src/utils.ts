import { useTheme as getTheme } from '@mui/material';
export function toTitleCase(text: string) {
  return (text || '')
    .split('_')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const getColor = (i: number) =>{
    const theme = getTheme();
    const colors = [
      theme.palette.contrast.main.main100,
      theme.palette.contrast.status.green100,
      theme.palette.contrast.status.orange,
      theme.palette.contrast.status.yellow,
      theme.palette.contrast.status.red,
      theme.palette.contrast.status.blue,
      theme.palette.contrast.status.blue10,
      theme.palette.contrast.status.green10,
      theme.palette.contrast.status.greenOff20,
      theme.palette.contrast.status.redLight,
      theme.palette.contrast.status.purple,
      theme.palette.contrast.status.pink,
      theme.palette.contrast.status.redOff10,
      theme.palette.contrast.status.redOff100,
    ];
    const uniqueColors = Array.from(new Set(colors));
    return uniqueColors[i % uniqueColors.length];
}
  