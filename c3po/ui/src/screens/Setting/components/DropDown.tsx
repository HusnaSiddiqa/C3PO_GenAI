import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Radio from "@mui/material/Radio";
import Divider from "@mui/material/Divider";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { useTheme } from "@mui/material/styles";

export type DropDownOption = {
  label: string | number | React.ReactNode;
  value: string | number | React.ReactNode;
};

type DropDownProps = {
  value: string | number | Object | React.ReactNode;
  options: DropDownOption[];
  onChange: (value: string | number | Object | React.ReactNode) => void;
  placeholder?: string;
  width?: string | number;
  padding?: string;
  feedbackScreen: boolean
};


export const DropDown: React.FC<DropDownProps> = ({
  value,
  options,
  onChange,
  placeholder = "Select...",
  width = 220,
  padding,
  feedbackScreen = false,
}) => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const selected = options.find((opt) => opt.value === value);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <Box
      sx={{
        width,
        position: "relative",
      }}
      ref={ref}
    >
      {/* Trigger */}
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
          borderRadius: theme.spacing(2),
          padding: padding,
          background: theme.palette.contrast.grayscale.level0,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Typography
          variant="p3"
          color={theme.palette.contrast.grayscale.level100}
          sx={{ flex: 1 }}
        >
          {selected?.value == "" ? `${placeholder}` : feedbackScreen ? selected?.value : `${placeholder} ${selected?.value}`}
        </Typography>
        {open ? (
          <CaretUpIcon color={theme.palette.contrast.grayscale.level50} />
        ) : (
          <CaretDownIcon color={theme.palette.contrast.grayscale.level50} />
        )}
      </Box>
      {/* Dropdown */}
      {open && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: "110%",
            width: "100%",
            bgcolor: theme.palette.contrast.grayscale.level0,
            // border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
            borderRadius: 1,
            boxShadow: "0px 0px 24px 0px rgba(0,0,0,0.1)",
            zIndex: 10,
            mt: 1,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {options
            .filter((item) =>
               item 
            )
            .map((opt, idx) => (
              <React.Fragment key={JSON.stringify(opt.value)}>
                <Box
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    px: theme.spacing(4),
                    pt: idx === 0 ? theme.spacing(4) : undefined,
                    pb: idx === options.length - 1 ? theme.spacing(4) : undefined,
                    cursor: "pointer",
                    bgcolor: "transparent",
                  }}
                >
                  <Radio
                    checked={opt.value === value}
                    sx={{
                      mr: 2,
                      color:
                        opt.value === value
                          ? theme.palette.contrast.status.green100
                          : theme.palette.contrast.grayscale.level10,
                      "&.Mui-checked": {
                        color: theme.palette.contrast.status.green100,
                      },
                      "& .MuiSvgIcon-root": {
                        background:
                          opt.value !== value
                            ? theme.palette.contrast.grayscale.level10
                            : "transparent",
                        borderRadius: "50%",
                      },
                    }}
                  />
                  <Typography
                    variant={"p1"}
                    fontSize={"14px"}
                    overflow={"hidden"}
                    textOverflow={"ellipsis"}
                    whiteSpace={"nowrap"}
                    sx={{ flex: 1 }}
                    color={theme.palette.contrast.grayscale.level50}
                  >
                    {opt.label}
                  </Typography>
                </Box>
                {idx < options.length - 1 && (
                  <Divider sx={{ marginX: theme.spacing(8) }} />
                )}
              </React.Fragment>
            ))}

        </Box>
      )}
    </Box>
  );
};
