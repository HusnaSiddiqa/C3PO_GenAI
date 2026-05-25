import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { styled, Typography, Box, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

const MarkdownContainer = styled("div")(() => ({
  a: {
    fontWeight: "bold",
    textDecoration: "underline",
  },
  p: {
    margin: "0 !important",
    fontSize: "16px",
    fontWeight: "400",
    lineHeight: "1.6",
  },
  strong: {
    fontWeight: "700",
  },
  code: {
    fontFamily: `"Fira Code", monospace`,
    fontSize: "0.875em",
    background: (theme) => theme.palette.background.main,
    padding: "2px 4px",
    borderRadius: "4px",
  },
  // Add proper list styling
  ul: {
    margin: "8px 0",
    paddingLeft: "24px",
    listStyleType: "disc",
  },
  ol: {
    margin: "8px 0",
    paddingLeft: "24px",
    listStyleType: "decimal",
  },
  li: {
    margin: "4px 0",
    fontSize: "16px",
    fontWeight: "400",
    lineHeight: "1.6",
    fontFamily: "Proxima Nova, sans-serif",
  },
  // Nested lists
  "ul ul": {
    listStyleType: "circle",
    margin: "4px 0",
  },
  "ul ul ul": {
    listStyleType: "square",
    margin: "4px 0",
  },
  "ol ol": {
    listStyleType: "lower-alpha",
    margin: "4px 0",
  },
  "ol ol ol": {
    listStyleType: "lower-roman",
    margin: "4px 0",
  },
  width: "100%",
  boxSizing: "border-box",
  wordWrap: "break-word",
}));

// Add a collapsible component for example queries
const CollapsibleExampleQueries = ({ children }: { children: React.ReactNode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          p: 1,
          borderRadius: 1,
          backgroundColor: "rgba(0, 0, 0, 0.04)",
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.08)",
          },
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: "bold",
            flexGrow: 1,
            fontFamily: "Proxima Nova, sans-serif",
          }}
        >
          Example Queries
        </Typography>
        <IconButton size="small" sx={{ p: 0 }}>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={isExpanded}>
        <Box sx={{ mt: 1, pl: 2, borderLeft: "2px solid #e0e0e0" }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};

const preprocessToMarkdown = (input: string, showTechnicalDetails: boolean = true): string => {
  if (!input) return "";

  let output = input;

  // Add newlines before each metadata field for separation
  output = output.replace(/(Rephrased Query:)/g, "\n$1");
  output = output.replace(/(Selected Data Sources:)/g, "\n$1");
  output = output.replace(/(Business Rules:)/g, "\n$1");
  output = output.replace(/(Tables Selected:)/g, "\n$1");
  output = output.replace(/(Example Queries?:)/g, "\n$1");

  // Bold metadata fields
  output = output.replace(
    /^(Rephrased Query|Selected Data Sources|Business Rules|Tables Selected|Example Queries?):/gm,
    (_, key) => `**${key}:**`
  );

  // Convert Selected Data Sources to markdown list
  output = output.replace(
    /\*\*Selected Data Sources:\*\*\s*\[([^\]]*)\]/,
    (_, items) =>
      `**Selected Data Sources:**\n` +
      items
        .split(",")
        .map((item) => `- ${item.replace(/['"]/g, "").trim()}`)
        .join("\n")
  );

  // Convert Business Rules to markdown list
  output = output.replace(
    /\*\*Business Rules:\*\*\s*\[([^\]]*)\]/,
    (_, items) =>
      `**Business Rules:**\n` +
      items
        .split("', '")
        .map((item) => `- ${item.replace(/['"]/g, "").trim()}`)
        .join("\n")
  );

  // Handle Example Queries - show in collapsible container for business users
  if (showTechnicalDetails) {
    // For technical users, show as before
    output = output.replace(
      /Example Queries:\s*\[\{[^]*?'Correct Code':\s*"((?:[^"\\]|\\.)*)"/m,
      (match, sql) => {
        const formattedSql = sql
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\`/g, "`")
          .replace(/\\\*/g, "*")
          .trim();
        return `**Example Query:**\n\n\`\`\`sql\n${formattedSql}\n\`\`\``;
      }
    );
  } else {
    // For business users, wrap in collapsible container
    output = output.replace(
      /Example Queries:\s*\[\{[^]*?'Correct Code':\s*"((?:[^"\\]|\\.)*)"/m,
      (match, sql) => {
        const formattedSql = sql
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\`/g, "`")
          .replace(/\\\*/g, "*")
          .trim();
        return `\n<COLLAPSIBLE_EXAMPLE_QUERIES>\n\n\`\`\`sql\n${formattedSql}\n\`\`\`\n\n</COLLAPSIBLE_EXAMPLE_QUERIES>\n`;
      }
    );
    
    // Also handle the case where Example Queries is already in markdown format
    output = output.replace(
      /\*\*Example Queries?:\*\*([\s\S]*?)(?=\n\*\*|$)/g,
      (match, content) => {
        return `\n<COLLAPSIBLE_EXAMPLE_QUERIES>\n\n${content.trim()}\n\n</COLLAPSIBLE_EXAMPLE_QUERIES>\n`;
      }
    );
  }

  // Remove stray "**" at the end
  output = output.replace(/\n\*\*\s*$/, "");

  // Collapse multiple blank lines
  output = output.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing whitespace
  return output.trim();
};

interface MarkdownRendererProps {
  children: string;
  showTechnicalDetails?: boolean; // New prop to control technical content visibility
}

const MarkdownRenderer = ({ children, showTechnicalDetails = true }: MarkdownRendererProps) => {
  // Sanitize the markdown content to prevent parsing errors
  const sanitizeMarkdown = (content: string): string => {
    if (!content || typeof content !== "string") {
      return "";
    }

    // Normalize newlines (handle both \n and \\n)
    let sanitized = content.replace(/\\n/g, "\n");

    // Remove control characters except \n and \t
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Unescape markdown special characters, but not inside code blocks
    // Split by code blocks to avoid unescaping inside them
    const codeBlockRegex = /(```[\s\S]*?```)/g;
    const parts = sanitized.split(codeBlockRegex);

    sanitized = parts
      .map((part) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          // Inside code block, return as is
          return part;
        }
        // Outside code block: unescape markdown
        return part
          .replace(/\\\\([*#_`[\]()!])/g, "$1")
          .replace(/\\([*#_`[\]()!])/g, "$1");
      })
      .join("");

    // Collapse 3+ newlines to 2
    sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

    // Ensure space after heading hashes
    sanitized = sanitized.replace(/^\s*(#{1,6})\s*/gm, "$1 ");

    return sanitized.trim();
  };
  
  const preprocessedContent = preprocessToMarkdown(children, showTechnicalDetails);
  const sanitizedContent = sanitizeMarkdown(preprocessedContent);

  // Process collapsible sections
  const processCollapsibleSections = (content: string): React.ReactNode[] => {
    const sections = content.split(/(<COLLAPSIBLE_EXAMPLE_QUERIES>[\s\S]*?<\/COLLAPSIBLE_EXAMPLE_QUERIES>)/);
    
    return sections.map((section, index) => {
      if (section.startsWith('<COLLAPSIBLE_EXAMPLE_QUERIES>') && section.endsWith('</COLLAPSIBLE_EXAMPLE_QUERIES>')) {
        // Extract content between tags
        const innerContent = section
          .replace('<COLLAPSIBLE_EXAMPLE_QUERIES>', '')
          .replace('</COLLAPSIBLE_EXAMPLE_QUERIES>', '')
          .trim();
        
        return (
          <CollapsibleExampleQueries key={`collapsible-${index}`}>
            <ReactMarkdown
              components={{
                p: ({ ...props }) => (
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "Proxima Nova, sans-serif" }}
                    {...props}
                  />
                ),
                code: ({ children, ...props }) => (
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: "monospace",
                      backgroundColor: "#f5f5f5",
                      padding: "2px 4px",
                      borderRadius: "4px",
                      fontSize: "0.875em",
                    }}
                    {...props}
                  >
                    {children}
                  </Typography>
                ),
                pre: ({ children, ...props }) => (
                  <Box
                    component="pre"
                    sx={{
                      backgroundColor: "#f5f5f5",
                      padding: "12px",
                      borderRadius: "4px",
                      overflow: "auto",
                      fontSize: "0.875em",
                      fontFamily: "monospace",
                      margin: "8px 0",
                    }}
                    {...props}
                  >
                    {children}
                  </Box>
                ),
              }}
            >
              {innerContent}
            </ReactMarkdown>
          </CollapsibleExampleQueries>
        );
      }
      
      // Regular content
      if (section.trim()) {
        return (
          <ReactMarkdown
            key={`content-${index}`}
            components={{
              p: ({ ...props }) => (
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "Proxima Nova, sans-serif" }}
                  {...props}
                />
              ),
              // Add custom components for basic markdown elements
              h1: ({ children, ...props }) => (
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{ fontWeight: "bold", mb: 1 }}
                  {...props}
                >
                  {children}
                </Typography>
              ),
              h2: ({ children, ...props }) => (
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{ fontWeight: "bold", mb: 1 }}
                  {...props}
                >
                  {children}
                </Typography>
              ),
              h3: ({ children, ...props }) => (
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{ fontWeight: "bold", mb: 1 }}
                  {...props}
                >
                  {children}
                </Typography>
              ),
              strong: ({ children, ...props }) => (
                <Typography
                  component="span"
                  sx={{ fontWeight: "bold" }}
                  {...props}
                >
                  {children}
                </Typography>
              ),
              em: ({ children, ...props }) => (
                <Typography
                  component="span"
                  sx={{ fontStyle: "italic" }}
                  {...props}
                >
                  {children}
                </Typography>
              ),
              code: ({ children, ...props }) => (
                <Typography
                  component="span"
                  sx={{
                    fontFamily: "monospace",
                    backgroundColor: "#f5f5f5",
                    padding: "2px 4px",
                    borderRadius: "4px",
                    fontSize: "0.875em",
                  }}
                  {...props}
                >
                  {children}
                </Typography>
              ),
              ul: ({ children, ...props }) => (
                <Box
                  component="ul"
                  sx={{ margin: "8px 0", paddingLeft: "24px" }}
                  {...props}
                >
                  {children}
                </Box>
              ),
              li: ({ children, ...props }) => (
                <Typography
                  component="li"
                  sx={{ margin: "4px 0" }}
                  {...props}
                >
                  {children}
                </Typography>
              ),
            }}
          >
            {section}
          </ReactMarkdown>
        );
      }
      
      return null;
    });
  };

  // Fallback component for when markdown parsing fails
  const FallbackContent = ({ content }: { content: string }) => (
    <Typography
      variant="body2"
      sx={{
        fontFamily: "Proxima Nova, sans-serif",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {content}
    </Typography>
  );

  return (
    <MarkdownContainer>
      <div className="markdown">
        {(() => {
          try {
            // Check if we have collapsible sections
            if (sanitizedContent.includes('<COLLAPSIBLE_EXAMPLE_QUERIES>')) {
              return processCollapsibleSections(sanitizedContent);
            }
            
            // Regular markdown rendering
            return (
              <ReactMarkdown
                components={{
                  p: ({ ...props }) => (
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "Proxima Nova, sans-serif" }}
                      {...props}
                    />
                  ),
                  // Add custom components for basic markdown elements
                  h1: ({ children, ...props }) => (
                    <Typography
                      variant="h4"
                      component="h1"
                      sx={{ fontWeight: "bold", mb: 1 }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  ),
                  h2: ({ children, ...props }) => (
                    <Typography
                      variant="h5"
                      component="h2"
                      sx={{ fontWeight: "bold", mb: 1 }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  ),
                  h3: ({ children, ...props }) => (
                    <Typography
                      variant="h6"
                      component="h3"
                      sx={{ fontWeight: "bold", mb: 1 }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  ),
                  strong: ({ children, ...props }) => (
                    <Typography
                      component="span"
                      sx={{ fontWeight: "bold" }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  ),
                  em: ({ children, ...props }) => (
                    <Typography
                      component="span"
                      sx={{ fontStyle: "italic" }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  ),
                  code: ({ children, ...props }) => (
                    <Typography
                      component="span"
                      sx={{
                        fontFamily: "monospace",
                        backgroundColor: "#f5f5f5",
                        padding: "2px 4px",
                        borderRadius: "4px",
                        fontSize: "0.875em",
                      }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  ),
                  ul: ({ children, ...props }) => (
                    <Box
                      component="ul"
                      sx={{ margin: "8px 0", paddingLeft: "24px" }}
                      {...props}
                    >
                      {children}
                    </Box>
                  ),
                  li: ({ children, ...props }) => (
                    <Typography
                      component="li"
                      sx={{ margin: "4px 0" }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  ),
                }}
              >
                {sanitizedContent}
              </ReactMarkdown>
            );
          } catch (error) {
            console.error("Markdown parsing error:", error);
            return <FallbackContent content={sanitizedContent} />;
          }
        })()}
      </div>
    </MarkdownContainer>
  );
};

export default MarkdownRenderer;
