import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AccessDenied from "../AccessDenied";
import { describe, it, expect } from "vitest";

describe("AccessDenied", () => {
  it("renders the Access Denied heading", () => {
    render(<AccessDenied />);
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  it("renders the permission message", () => {
    render(<AccessDenied />);
    expect(
      screen.getByText("You do not have permission to view this page.")
    ).toBeInTheDocument();
  });

  it("renders the contact email link", () => {
    render(<AccessDenied />);
    const emailLink = screen.getByRole("link", {
      name: "support@example.com",
    });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute(
      "href",
      "mailto:support@example.com"
    );
  });

  it("renders the Back to Login button", () => {
    render(<AccessDenied />);
    expect(
      screen.getByRole("button", { name: "Back to Login" })
    ).toBeInTheDocument();
  });

  it("redirects to /login when Back to Login is clicked", () => {
    // Mock window.location.href
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: "" };

    render(<AccessDenied />);
    const button = screen.getByRole("button", { name: "Back to Login" });
    fireEvent.click(button);
    expect(window.location.href).toBe("/login");

    // Restore original location
    window.location = originalLocation;
  });
});
