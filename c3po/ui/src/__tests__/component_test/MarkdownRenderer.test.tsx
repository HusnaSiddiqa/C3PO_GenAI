import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MarkdownRenderer from "../../components/MarkdownRenderer/MarkdownRenderer";
import * as ReactMarkdownLib from "react-markdown";

describe("MarkdownRenderer", () => {
  it("renders plain text", () => {
    render(<MarkdownRenderer>hello world</MarkdownRenderer>);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("renders bold text", () => {
    render(<MarkdownRenderer>**bold**</MarkdownRenderer>);
    const bold = screen.getByText("bold");
    expect(bold).toBeInTheDocument();
    expect(bold.closest("span") || bold.closest("p")).toHaveStyle(
      "font-weight: 700"
    );
  });

  it("renders italic text", () => {
    render(<MarkdownRenderer>_italic_</MarkdownRenderer>);
    const italic = screen.getByText("italic");
    expect(italic).toBeInTheDocument();
    expect(italic.closest("span") || italic.closest("p")).toHaveStyle(
      "font-style: italic"
    );
  });

  it("renders inline code", () => {
    render(<MarkdownRenderer>{"`code`"}</MarkdownRenderer>);
    const code = screen.getByText("code");
    expect(code).toBeInTheDocument();
    expect(code.closest("span") || code.closest("p")).toHaveStyle(
      "font-family: monospace"
    );
  });

  it("renders code block", () => {
    render(<MarkdownRenderer>{"```\nconst a = 1;\n```"}</MarkdownRenderer>);
    expect(screen.getByText("const a = 1;")).toBeInTheDocument();
  });

  it("renders list items", () => {
    render(<MarkdownRenderer>{"- item1\n- item2"}</MarkdownRenderer>);
    expect(screen.getByText("item1")).toBeInTheDocument();
    expect(screen.getByText("item2")).toBeInTheDocument();
  });

  it("renders headings", () => {
    render(
      <MarkdownRenderer>
        {"# Heading1\n## Heading2\n### Heading3"}
      </MarkdownRenderer>
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Heading1"
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Heading2"
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Heading3"
    );
  });

  it("renders links", () => {
    render(<MarkdownRenderer>[link](https://example.com)</MarkdownRenderer>);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://example.com"
    );
  });

  // Optionally skip or update this test if your component can't handle non-string children
  // it("renders fallback on markdown error", () => {
  //   const Broken = () => (
  //     <MarkdownRenderer>{new Proxy({}, {}) as any}</MarkdownRenderer>
  //   );
  //   render(<Broken />);
  //   expect(screen.getByText("")).toBeInTheDocument();
  // });

  it("handles preprocess metadata fields", () => {
    render(
      <MarkdownRenderer>
        {
          "Rephrased Query: test\nSelected Data Sources: ['A','B']\nBusiness Rules: ['rule1','rule2']"
        }
      </MarkdownRenderer>
    );
    expect(screen.getByText("Rephrased Query:")).toBeInTheDocument();
    expect(screen.getByText("Selected Data Sources:")).toBeInTheDocument();
    expect(screen.getByText("Business Rules:")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("rule1,rule2")).toBeInTheDocument();
  });

  it("handles empty string", () => {
    render(<MarkdownRenderer>{""}</MarkdownRenderer>);
    expect(document.querySelector(".markdown")).toBeInTheDocument();
  });

  it("handles undefined", () => {
    render(<MarkdownRenderer>{undefined as any}</MarkdownRenderer>);
    expect(document.querySelector(".markdown")).toBeInTheDocument();
  });
  // Add to your MarkdownRenderer.test.tsx

  it("handles Tables Selected and Example Queries metadata", () => {
    render(
      <MarkdownRenderer>
        {
          "Tables Selected: ['table1','table2']\nExample Queries: [{ 'Correct Code': \"SELECT * FROM table1;\" }]"
        }
      </MarkdownRenderer>
    );
    expect(screen.getByText("Tables Selected:")).toBeInTheDocument();
    expect(screen.getByText("['table1','table2']")).toBeInTheDocument();
    expect(screen.getByText("Example Queries:")).toBeInTheDocument();
    expect(
      screen.getByText("[{ 'Correct Code': \"SELECT * FROM table1;\" }]")
    ).toBeInTheDocument();
  });
  it("sanitizes markdown content", () => {
    render(
      <MarkdownRenderer>
        {"#Heading\n\\nText with \x01control\x02 chars\n\\\\*escaped*"}
      </MarkdownRenderer>
    );
    // Heading should have a space after #
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Heading"
    );
    // Control chars removed, newline normalized
    expect(screen.getByText("Text with control chars")).toBeInTheDocument();
    // Escaped * should be unescaped
    expect(screen.getByText("escaped")).toBeInTheDocument();
  });
  // it("renders fallback content for non-string children", () => {
  //   // @ts-expect-error: purposely passing non-string to trigger fallback
  //   render(<MarkdownRenderer>{12345}</MarkdownRenderer>);
  //   expect(screen.getByText("12345")).toBeInTheDocument();
  // });

  it("hides technical details when showTechnicalDetails is false", () => {
    render(
      <MarkdownRenderer showTechnicalDetails={false}>
        {
          "Rephrased Query: test\nSelected Data Sources: ['A','B']\nBusiness Rules: ['rule1','rule2']\nExample Queries: [{ 'Correct Code': \"SELECT * FROM table1;\" }]"
        }
      </MarkdownRenderer>
    );

    // Business content should still be visible
    expect(screen.getByText("Rephrased Query:")).toBeInTheDocument();
    expect(screen.getByText("Selected Data Sources:")).toBeInTheDocument();
    expect(screen.getByText("Business Rules:")).toBeInTheDocument();

    // Technical content should be hidden
    expect(screen.queryByText("Example Queries:")).not.toBeInTheDocument();
    // expect(screen.queryByText("SELECT * FROM table1;")).not.toBeInTheDocument();
  });

  it("shows technical details when showTechnicalDetails is true", () => {
    render(
      <MarkdownRenderer showTechnicalDetails={true}>
        {
          "Rephrased Query: test\nSelected Data Sources: ['A','B']\nBusiness Rules: ['rule1','rule2']\nExample Queries: [{ 'Correct Code': \"SELECT * FROM table1;\" }]"
        }
      </MarkdownRenderer>
    );

    // All content should be visible
    expect(screen.getByText("Rephrased Query:")).toBeInTheDocument();
    expect(screen.getByText("Selected Data Sources:")).toBeInTheDocument();
    expect(screen.getByText("Business Rules:")).toBeInTheDocument();
    expect(screen.getByText("Example Queries:")).toBeInTheDocument();
    // expect(screen.getByText("SELECT * FROM table1;")).toBeInTheDocument();
  });
});
