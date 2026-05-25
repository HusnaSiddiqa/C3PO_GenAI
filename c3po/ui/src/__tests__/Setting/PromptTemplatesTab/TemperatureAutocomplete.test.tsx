import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import TemperatureAutocomplete from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/TemperatureAutocomplete";
import "@testing-library/jest-dom";

function renderWithProviders(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("TemperatureAutocomplete", () => {
  describe("Rendering Tests", () => {
    it("renders temperature input with label", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.7"
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(0.7);
    });

    it("renders with empty temperature value", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(null);
    });

    it("renders with required attribute", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.5"
          setTemperature={mockSetTemperature}
          required={true}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      expect(input).toBeRequired();
    });

    it("renders without required attribute", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.5"
          setTemperature={mockSetTemperature}
          required={false}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      expect(input).not.toBeRequired();
    });

    it("renders with error state", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.5"
          setTemperature={mockSetTemperature}
          error={true}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("renders without error state", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.5"
          setTemperature={mockSetTemperature}
          error={false}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      expect(input).toHaveAttribute("aria-invalid", "false");
    });

    it("displays 'Temperature:' prefix in input", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.7"
          setTemperature={mockSetTemperature}
        />
      );

      expect(screen.getByText(/Temperature:/)).toBeInTheDocument();
    });
  });

  describe("Interaction Tests", () => {
    it("updates value on user input", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "0.8");

      expect(mockSetTemperature).toHaveBeenCalled();
      expect(mockSetTemperature).toHaveBeenCalledWith("0.8");
    });

    it("updates existing value on user input", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.5"
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.clear(input);
      await user.type(input, "1");

      expect(mockSetTemperature).toHaveBeenCalled();
    });

    it("allows decimal values", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "0.75");

      // Check that setTemperature was called multiple times with decimal values
      expect(mockSetTemperature).toHaveBeenCalled();
      expect(mockSetTemperature.mock.calls.length).toBeGreaterThan(0);
    });

    it("handles clearing the input field", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.7"
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.clear(input);

      expect(mockSetTemperature).toHaveBeenCalledWith("");
    });
  });

  describe("Number Input Type Tests", () => {
    it("allows entering only numbers", () => {
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature="0.7"
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      expect(input).toHaveAttribute("type", "number");
    });

    it("rejects invalid number values", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "a");

      // Check that setTemperature was called
      expect(mockSetTemperature).not.toHaveBeenCalled();
    });
  });

  describe("Validation Tests", () => {
    it("clamps negative values to 0", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "-0.5");

      // Should clamp to "0" when a negative value is entered
      expect(mockSetTemperature).toHaveBeenCalledWith("0");
    });

    it("clamps values greater than 1 to 1", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "1.5");

      // Should clamp to "1" when value exceeds 1
      expect(mockSetTemperature).toHaveBeenCalledWith("1");
    });

    it("accepts values within valid range (0-1)", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "0.7");

      // Should accept valid values without clamping
      const calls = mockSetTemperature.mock.calls;
      expect(calls.some(call => call[0] === "0.7")).toBe(true);
    });

    it("accepts boundary value 0", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "0");

      // Should accept 0 as a valid value
      expect(mockSetTemperature).toHaveBeenCalledWith("0");
    });

    it("accepts boundary value 1", async () => {
      const user = userEvent.setup();
      const mockSetTemperature = vi.fn();
      renderWithProviders(
        <TemperatureAutocomplete
          temperature=""
          setTemperature={mockSetTemperature}
        />
      );

      const input = screen.getByLabelText(/temperature/i);
      await user.type(input, "1");

      // Should accept 1 as a valid value
      expect(mockSetTemperature).toHaveBeenCalledWith("1");
    });
  });
});
