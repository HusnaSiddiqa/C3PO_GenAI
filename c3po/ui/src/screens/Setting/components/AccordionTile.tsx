// AccordionMenu.tsx
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
  useTheme,
  Typography,
  Box,
  Tooltip,
} from "@mui/material";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export interface SubItem<TMeta = Record<string, unknown>> {
  id: string;
  label: string;
  metadata: TMeta;
}

export interface AccordionItem<TMeta = Record<string, unknown>> {
  title: string;
  items: SubItem<TMeta>[];
}

export interface AccordionMenuProps<TMeta = Record<string, unknown>> {
  data: AccordionItem<TMeta>[];
  onSubItemClick?: (subItem: SubItem<TMeta>) => void;
  defaultExpanded?: string;
  disabled?: boolean;
  reset?: boolean;
}

export default function AccordionMenu({
  data,
  onSubItemClick,
  defaultExpanded = "",
  disabled = false,
  reset,
}: AccordionMenuProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | false>(defaultExpanded);
  const [selectedSubItem, setSelectedSubItem] = useState<string | null>(null);

  const handleAccordionChange =
    (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
    };

  const handleSubItemClick = (subItem: SubItem) => {
    setSelectedSubItem(subItem.id);
    onSubItemClick?.(subItem);
  };

  useEffect(() => {
    if (reset) {
      setExpanded(false);
      setSelectedSubItem(null);
    }
  }, [reset]);

  return (
    <Box width="100%">
      {data.map((section, index) => (
        <Accordion
          key={section.title}
          expanded={expanded === section.title}
          onChange={handleAccordionChange(section.title)}
          sx={{
            backgroundColor: theme.palette.contrast.grayscale.level0,
            boxShadow: "none",
            "&::before": { display: "none" },
          }}
        >
          <AccordionSummary
            expandIcon={<CaretDownIcon />}
            sx={{ padding: 0 }}
            aria-controls={`panel-${index}-content`}
            id={`panel-${index}-header`}
          >
            <Typography
              color={theme.palette.contrast.grayscale.level100}
              variant="p2Bold"
            >
              {section.title}
            </Typography>
          </AccordionSummary>

          <AccordionDetails
            sx={{
              padding: theme.spacing(0),
              maxHeight: {
                md: "280px",
                lg: "400px",
              },
              overflowY: "auto",
            }}
          >
            <List disablePadding>
              {section.items.map((item) => (
                <ListItemButton
                  disabled={disabled}
                  key={item.id}
                  selected={selectedSubItem === item.id}
                  onClick={() => handleSubItemClick(item)}
                  sx={{
                    paddingX: theme.spacing(4),
                    paddingY: theme.spacing(2),
                    borderRadius: theme.spacing(1.3),
                    "&.Mui-selected": {
                      borderRight: `6px solid ${theme.palette.contrast.main.main100}`,
                      backgroundColor: theme.palette.contrast.status.blue10,
                      color: theme.palette.contrast.main.main100,
                    },
                  }}
                >
                  <ListItemText
                    sx={{
                      maxWidth: 280,
                      minWidth: 65,
                    }}
                    primary={
                      <Tooltip title={item.label || ""}>
                        <Typography
                        sx={{
                         overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block", 
                        }}
                         noWrap
                          variant={
                            selectedSubItem === item.id ? "p3Bold" : "p3"
                          }
                          color={
                            selectedSubItem === item.id
                              ? theme.palette.contrast.main.main100
                              : theme.palette.contrast.grayscale.level75
                          }
                        >
                          {item.label}
                        </Typography>
                      </Tooltip>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
