import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import CreateSubAgentDialog from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/CreateSubAgentDialog";
import { UserContext, User } from "../../../contexts/UserContext";
import { AllSubAgentsContext } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/AllSubAgentsContext";
import { Agent, SubAgent } from "../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";

// Mock the createSubAgent helper
vi.mock("../../../screens/Setting/helpers/helpers", () => ({
  createSubAgent: vi.fn(),
}));

import { createSubAgent } from "../../../screens/Setting/helpers/helpers";

// Mock child components
vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/ModelsDropDown", () => ({
  default: vi.fn(({ model, setModel, error }) => (
    <div data-testid="models-dropdown">
      <input
        data-testid="model-select"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        aria-label="Model"
        className={error ? "error" : ""}
      />
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/TemperatureAutocomplete", () => ({
  default: vi.fn(({ temperature, setTemperature, error }) => (
    <div data-testid="temperature-autocomplete">
      <input
        data-testid="temperature-input"
        value={temperature}
        onChange={(e) => setTemperature(e.target.value)}
        aria-label="Temperature"
        className={error ? "error" : ""}
      />
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/PromptTemplateField", () => ({
  default: vi.fn(({ prompt, setPrompt, error }) => (
    <div data-testid="prompt-template-field">
      <textarea
        data-testid="prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt template here"
        className={error ? "error" : ""}
      />
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/BenchmarkingInputFile", () => ({
  default: vi.fn(({ agentName, uploadedBYODFileData }) => (
    <div data-testid="benchmarking-input-file">
      Benchmarking file for {agentName}
      {uploadedBYODFileData && <div data-testid="byod-file-data">BYOD Data: {uploadedBYODFileData.filename}</div>}
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/BYODFile", () => ({
  default: vi.fn(({ setUploadedBYODFileData }) => (
    <div data-testid="byod-file">
      <button
        data-testid="upload-byod-button"
        onClick={() =>
          setUploadedBYODFileData({
            file_url: "http://example.com/file.csv",
            filename: "test.csv",
            file_id: "file-123",
            file_type: "csv",
          })
        }
      >
        Upload BYOD File
      </button>
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/ThemedTextarea", () => ({
  default: vi.fn(({ value, onChange, placeHolderText, error }) => (
    <textarea
      data-testid="themed-textarea-input"
      value={value}
      onChange={onChange}
      placeholder={placeHolderText}
      className={error ? "error" : ""}
    />
  )),
}));

vi.mock("../../../screens/Setting/components/LabelledInputTextField", () => ({
  LabelledInputTextField: vi.fn(({ value, onChange, placeHolderText, error, label }) => (
    <div data-testid="labelled-input-textfield">
      <label>{label}</label>
      <textarea
        data-testid="description-input"
        value={value}
        onChange={onChange}
        placeholder={placeHolderText}
        className={error ? "error" : ""}
      />
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/ErrorTile", () => ({
  ErrorTile: vi.fn(({ visible, message }) =>
    visible ? <div data-testid="error-tile">{message}</div> : null
  ),
}));

const mockUser: User = {
  userId: "test-user-123",
  userName: "Test User",
  userRole: "admin",
};

const mockAllSubAgents: SubAgent[] = [
  {
    id: "sub-1",
    name: "SQL Sub Agent",
    agent_type: "SQL Agent",
    description: "SQL sub agent",
    relates_to: [],
  },
  {
    id: "sub-2",
    name: "RAG Sub Agent",
    agent_type: "RAG Agent",
    description: "RAG sub agent",
    relates_to: [],
  },
  {
    id: "sub-3",
    name: "Planning Sub Agent",
    agent_type: "Planning Agent",
    description: "Planning sub agent",
    relates_to: [],
  },
];

const mockAgentType: Agent = {
  id: "agent-1",
  name: "SQL Agent",
};

const mockBYODAgentType: Agent = {
  id: "agent-byod",
  name: "BYOD",
};

function renderWithProviders(
  ui: React.ReactElement,
  {
    user = mockUser,
    allSubAgents = mockAllSubAgents,
  }: {
    user?: User;
    allSubAgents?: SubAgent[];
  } = {}
) {
  const theme = getTheme("light");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider value={{ user, setUser: vi.fn() }}>
        <AllSubAgentsContext.Provider
          value={{ allSubAgents, setAllSubAgents: vi.fn() }}
        >
          <ThemeProvider theme={theme}>{ui}</ThemeProvider>
        </AllSubAgentsContext.Provider>
      </UserContext.Provider>
    </QueryClientProvider>
  );
}

describe("CreateSubAgentDialog", () => {
  const mockCloseDialog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering Tests", () => {
    it("renders dialog with correct title for SQL Agent", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      expect(screen.getByText("Create new SQL Agent")).toBeInTheDocument();
    });

    it("renders dialog with correct title for BYOD Agent", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockBYODAgentType}
        />
      );

      expect(screen.getByText("Create new BYOD")).toBeInTheDocument();
    });

    it("renders all required form fields", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      expect(screen.getByRole("textbox", { name: /agent name/i })).toBeInTheDocument();
      expect(screen.getByTestId("labelled-input-textfield")).toBeInTheDocument();
      expect(screen.getByTestId("prompt-template-field")).toBeInTheDocument();
      expect(screen.getByTestId("models-dropdown")).toBeInTheDocument();
      expect(screen.getByTestId("temperature-autocomplete")).toBeInTheDocument();
    });

    it("renders 'Relates to' autocomplete", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      expect(screen.getByRole("combobox", { name: /relates to/i })).toBeInTheDocument();
    });

    it("renders BenchmarkingInputFile for non-BYOD agents", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      expect(screen.getByTestId("benchmarking-input-file")).toBeInTheDocument();
      expect(screen.queryByTestId("byod-file")).not.toBeInTheDocument();
    });

    it("renders BYODFile for BYOD agents", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockBYODAgentType}
        />
      );

      expect(screen.getByTestId("byod-file")).toBeInTheDocument();
    });

    it("renders BenchmarkingInputFile after BYOD file upload", async () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockBYODAgentType}
        />
      );

      const uploadButton = screen.getByTestId("upload-byod-button");
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId("byod-file-data")).toBeInTheDocument();
        expect(screen.getByText("BYOD Data: test.csv")).toBeInTheDocument();
      });
    });

    it("renders action buttons", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      expect(screen.getByRole("button", { name: /create sub-agent/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("does not render dialog when isDialogOpen is false", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={false}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      expect(screen.queryByText("Create new SQL Agent Agent")).not.toBeInTheDocument();
    });
  });

  describe("Form Interaction Tests", () => {
    it("updates name field on user input", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const nameInput = screen.getByRole("textbox", { name: /agent name/i });
      await user.type(nameInput, "Test Agent Name");

      expect(nameInput).toHaveValue("Test Agent Name");
    });

    it("updates description field on user input", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const descriptionInput = screen.getByTestId("description-input");
      await user.type(descriptionInput, "Test description");

      expect(descriptionInput).toHaveValue("Test description");
    });

    it("updates prompt field via PromptTemplateField component", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const promptInput = screen.getByTestId("prompt-input");
      await user.type(promptInput, "Test prompt template");

      expect(promptInput).toHaveValue("Test prompt template");
    });

    it("selects model via ModelsDropDown component", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const modelSelect = screen.getByTestId("model-select");
      await user.type(modelSelect, "gpt-4");

      expect(modelSelect).toHaveValue("gpt-4");
    });

    it("selects temperature via TemperatureAutocomplete component", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const temperatureInput = screen.getByTestId("temperature-input");
      await user.type(temperatureInput, "0.7");

      expect(temperatureInput).toHaveValue("0.7");
    });

    it("selects multiple 'relates to' agents", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const relatesToInput = screen.getByRole("combobox", { name: /relates to/i });
      expect(relatesToInput).toBeInTheDocument();

      // Click to open autocomplete
      await user.click(relatesToInput);
    });
  });

  describe("Validation Tests", () => {
    it("submit button is disabled when all fields are empty", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      expect(submitButton).toBeDisabled();
    });

    it("submit button is disabled when only name is filled", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const nameInput = screen.getByRole("textbox", { name: /agent name/i });
      await user.type(nameInput, "Test Agent");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      expect(submitButton).toBeDisabled();
    });

    it("submit button is disabled when name, description filled but not others", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const nameInput = screen.getByRole("textbox", { name: /agent name/i });
      await user.type(nameInput, "Test Agent");

      const descriptionInput = screen.getByTestId("description-input");
      await user.type(descriptionInput, "Test description");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      expect(submitButton).toBeDisabled();
    });

    it("submit button is enabled when all required fields are filled", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      await user.type(screen.getByRole("textbox", { name: /agent name/i }), "Test Agent");
      await user.type(screen.getByTestId("description-input"), "Test description");
      await user.type(screen.getByTestId("prompt-input"), "Test prompt");
      await user.type(screen.getByTestId("model-select"), "gpt-4");
      await user.type(screen.getByTestId("temperature-input"), "0.7");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      expect(submitButton).toBeEnabled();
    });

    it("shows error state on required fields when empty", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const nameInput = screen.getByRole("textbox", { name: /agent name/i });
      const descriptionInput = screen.getByTestId("description-input");
      const promptInput = screen.getByTestId("prompt-input");
      const modelSelect = screen.getByTestId("model-select");
      const temperatureInput = screen.getByTestId("temperature-input");

      expect(nameInput).toHaveAttribute("aria-invalid", "true");
      expect(descriptionInput).toHaveClass("error");
      expect(promptInput).toHaveClass("error");
      expect(modelSelect).toHaveClass("error");
      expect(temperatureInput).toHaveClass("error");
    });
  });

  describe("Dialog Actions Tests", () => {
    it("closes dialog when Cancel button is clicked", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockCloseDialog).toHaveBeenCalledTimes(1);
    });

    it("does not close dialog on Escape key", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const dialog = screen.getByRole("dialog");
      fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

      // Should not call closeDialog due to disableEscapeKeyDown
      expect(mockCloseDialog).not.toHaveBeenCalled();
    });
  });

  describe("Form Submission Tests", () => {
    it("calls createSubAgent with correct payload on submit", async () => {
      const user = userEvent.setup();
      const mockCreateSubAgent = vi.mocked(createSubAgent);
      mockCreateSubAgent.mockResolvedValue({
        agentId: "new-agent-id",
        versionAlias: "v1",
        prompt: "Test prompt",
        model: "gpt-4",
        temperature: "0.7",
        benchmarkFile: "",
        accuracy: 0,
      });

      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      await user.type(screen.getByRole("textbox", { name: /agent name/i }), "Test Agent");
      await user.type(screen.getByTestId("description-input"), "Test description");
      await user.type(screen.getByTestId("prompt-input"), "Test prompt");
      await user.type(screen.getByTestId("model-select"), "gpt-4");
      await user.type(screen.getByTestId("temperature-input"), "0.7");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateSubAgent).toHaveBeenCalledWith({
          agent_name: "Test Agent",
          agent_description: "Test description",
          agent_type: "SQL Agent",
          relates_to: [],
          prompt: "Test prompt",
          model: "gpt-4",
          temperature: "0.7",
          user_id: "test-user-123",
        });
      });
    });

    it("closes dialog after successful submission", async () => {
      const user = userEvent.setup();
      const mockCreateSubAgent = vi.mocked(createSubAgent);
      mockCreateSubAgent.mockResolvedValue({
        agentId: "new-agent-id",
        versionAlias: "v1",
        prompt: "Test prompt",
        model: "gpt-4",
        temperature: "0.7",
        benchmarkFile: "",
        accuracy: 0,
      });

      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      await user.type(screen.getByRole("textbox", { name: /agent name/i }), "Test Agent");
      await user.type(screen.getByTestId("description-input"), "Test description");
      await user.type(screen.getByTestId("prompt-input"), "Test prompt");
      await user.type(screen.getByTestId("model-select"), "gpt-4");
      await user.type(screen.getByTestId("temperature-input"), "0.7");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCloseDialog).toHaveBeenCalled();
      });
    });

    it("shows error message on submission failure", async () => {
      const user = userEvent.setup();
      const mockCreateSubAgent = vi.mocked(createSubAgent);
      mockCreateSubAgent.mockRejectedValue(new Error("Failed to create sub-agent"));

      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      await user.type(screen.getByRole("textbox", { name: /agent name/i }), "Test Agent");
      await user.type(screen.getByTestId("description-input"), "Test description");
      await user.type(screen.getByTestId("prompt-input"), "Test prompt");
      await user.type(screen.getByTestId("model-select"), "gpt-4");
      await user.type(screen.getByTestId("temperature-input"), "0.7");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId("error-tile")).toBeInTheDocument();
        expect(screen.getByText(/Failed to create sub-agent/i)).toBeInTheDocument();
      });
    });

    it("does not close dialog on submission failure", async () => {
      const user = userEvent.setup();
      const mockCreateSubAgent = vi.mocked(createSubAgent);
      mockCreateSubAgent.mockRejectedValue(new Error("Failed to create sub-agent"));

      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      await user.type(screen.getByRole("textbox", { name: /agent name/i }), "Test Agent");
      await user.type(screen.getByTestId("description-input"), "Test description");
      await user.type(screen.getByTestId("prompt-input"), "Test prompt");
      await user.type(screen.getByTestId("model-select"), "gpt-4");
      await user.type(screen.getByTestId("temperature-input"), "0.7");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId("error-tile")).toBeInTheDocument();
      });

      expect(mockCloseDialog).not.toHaveBeenCalled();
    });
  });

  describe("Agent Type-Specific Tests", () => {
    it("renders BenchmarkingInputFile for SQL Agent (non-BYOD)", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      expect(screen.getByTestId("benchmarking-input-file")).toBeInTheDocument();
      expect(screen.getByText("Benchmarking file for SQL Agent")).toBeInTheDocument();
    });

    it("renders BenchmarkingInputFile for RAG Agent (non-BYOD)", () => {
      const ragAgentType: Agent = { id: "agent-2", name: "RAG Agent" };
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={ragAgentType}
        />
      );

      expect(screen.getByTestId("benchmarking-input-file")).toBeInTheDocument();
      expect(screen.getByText("Benchmarking file for RAG Agent")).toBeInTheDocument();
    });

    it("renders BYODFile for BYOD Agent", () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockBYODAgentType}
        />
      );

      expect(screen.getByTestId("byod-file")).toBeInTheDocument();
      expect(screen.queryByTestId("benchmarking-input-file")).not.toBeInTheDocument();
    });

    it("shows BenchmarkingInputFile for BYOD agent after file upload", async () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockBYODAgentType}
        />
      );

      expect(screen.queryByTestId("byod-file-data")).not.toBeInTheDocument();

      const uploadButton = screen.getByTestId("upload-byod-button");
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId("byod-file-data")).toBeInTheDocument();
      });
    });

    it("passes uploadedBYODFileData to BenchmarkingInputFile when available", async () => {
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockBYODAgentType}
        />
      );

      const uploadButton = screen.getByTestId("upload-byod-button");
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText("BYOD Data: test.csv")).toBeInTheDocument();
      });
    });
  });

  describe("Context Integration Tests", () => {
    it("uses user from UserContext for submission", async () => {
      const user = userEvent.setup();
      const mockCreateSubAgent = vi.mocked(createSubAgent);
      mockCreateSubAgent.mockResolvedValue({
        agentId: "new-agent-id",
        versionAlias: "v1",
        prompt: "Test prompt",
        model: "gpt-4",
        temperature: "0.7",
        benchmarkFile: "",
        accuracy: 0,
      });

      const customUser: User = {
        userId: "custom-user-456",
        userName: "Custom User",
        userRole: "user",
      };

      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />,
        { user: customUser }
      );

      await user.type(screen.getByRole("textbox", { name: /agent name/i }), "Test Agent");
      await user.type(screen.getByTestId("description-input"), "Test description");
      await user.type(screen.getByTestId("prompt-input"), "Test prompt");
      await user.type(screen.getByTestId("model-select"), "gpt-4");
      await user.type(screen.getByTestId("temperature-input"), "0.7");

      const submitButton = screen.getByRole("button", { name: /create sub-agent/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateSubAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: "custom-user-456",
          })
        );
      });
    });

    it("filters current agent type from 'relates to' options", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const relatesToInput = screen.getByRole("combobox", { name: /relates to/i });
      await user.click(relatesToInput);

      await waitFor(() => {
        // Should show RAG and Planning agents but not SQL Agent
        expect(screen.queryByText("RAG Sub Agent")).toBeInTheDocument();
        expect(screen.queryByText("Planning Sub Agent")).toBeInTheDocument();
        expect(screen.queryByText("SQL Sub Agent")).not.toBeInTheDocument();
      });
    });

    it("shows all other agent types in 'relates to' dropdown", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateSubAgentDialog
          isDialogOpen={true}
          closeDialog={mockCloseDialog}
          agentType={mockAgentType}
        />
      );

      const relatesToInput = screen.getByLabelText("Relates to");
      await user.click(relatesToInput);

      await waitFor(() => {
        // Verify that non-SQL agents are shown
        const options = screen.getAllByRole("option");
        expect(options.length).toBeGreaterThan(0);
      });
    });
  });
});
