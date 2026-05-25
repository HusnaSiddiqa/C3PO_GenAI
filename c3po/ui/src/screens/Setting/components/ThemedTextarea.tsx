import { TextareaAutosize, useTheme } from "@mui/material";

function ThemedTextarea({
  minRows,
  isResizable = true,
  placeHolderText,
  value,
  onChange,
  maxRows,
  error,
}: {
  minRows: number,
  isResizable: boolean,
  placeHolderText: string,
  value: string,
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void,
  maxRows?: number,
  error?: boolean,
}) {
  const theme = useTheme();

  return (
    <>
      <style>
        {`
          .themed-textarea-override {
            overflow: auto !important;
          }
        `}
      </style>
      <TextareaAutosize
        className="themed-textarea-override"
        maxRows={maxRows}
        minRows={minRows}
        placeholder={placeHolderText}
        value={value}
        onChange={onChange}
        style={{
          whiteSpace: 'pre-wrap',
          backgroundColor: theme.palette.contrast.grayscale.level0,
          color: theme.palette.contrast.grayscale.level100,
          width: '100%',
          borderRadius: theme.spacing(2),
          border: `1px solid ${error
            ? theme.palette.error.main
            : theme.palette.contrast.grayscale.level10}`,
          padding: `${theme.spacing(2)} ${theme.spacing(4)}`,
          fontFamily: theme.typography.p3.fontFamily,
          fontSize: theme.typography.p3.fontSize,
          lineHeight: theme.typography.p3.lineHeight,
          resize: isResizable ? 'vertical' : "none",
          outline: 'none',
          transition: 'border-color 0.2s ease-in-out',
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = `1px solid ${theme.palette.contrast.main.main100}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = `1px solid ${error
            ? theme.palette.error.main
            : theme.palette.contrast.grayscale.level10}`;
        }}
      />
    </>
  )
}

export default ThemedTextarea;