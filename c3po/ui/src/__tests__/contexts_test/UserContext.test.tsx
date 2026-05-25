import React, { useContext } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { UserContext, UserProvider } from "../../contexts/UserContext";
import { vi } from "vitest";
import { decodeToken } from "../../sso/decodeToken";
import type { Mock } from "vitest";
import { ConfigContext } from "../../contexts/ConfigContext";

// Mock decodeToken
vi.mock("../../sso/decodeToken", () => ({
  decodeToken: vi.fn(),
}));

describe("UserProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  function WithContext({ children }: React.PropsWithChildren) {
    return (
      <ConfigContext value={{
        config: {
          admin_ad_group: "APP_genai_app_admin_user",
          admin_secret: "",
          app_default_user_id: "",
          app_title: "",
          chat_mgr_secret: "",
          okta_auth_url: "",
          okta_client_id: "",
          okta_redirect_uri: "",
          support_email: ""
        }, setConfig: () => { },
      }}>
        {children}
      </ConfigContext>
    )
  }

  function TestComponent() {
    const { user, setUser } = useContext(UserContext);
    return (
      <WithContext>
        <div>
          <span data-testid="user-role">{user?.userRole || ""}</span>
          <button
            data-testid="set-user"
            onClick={() =>
              setUser({
                userId: "2",
                userName: "Jane",
                userRole: "admin",
              })
            }
          >
            Set User
          </button>
        </div>
      </WithContext>
    );
  }

  it("provides null user by default", () => {
    render(
      <WithContext>
        <UserProvider>
          <TestComponent />
        </UserProvider>
      </WithContext>
    );
    expect(screen.getByTestId("user-role").textContent).toBe("");
  });

  it("loads user from localStorage token as admin", async () => {
    localStorage.setItem("authToken", "fake-token");
    (decodeToken as Mock).mockReturnValueOnce({
      sub: "1",
      userinfo: { name: "Alice" },
      groups: ["APP_genai_app_admin_user"],
    });

    render(
      <WithContext>
        <UserProvider>
          <TestComponent />
        </UserProvider>
      </WithContext>
    );

    await waitFor(() =>
      expect(screen.getByTestId("user-role").textContent).toBe("admin")
    );
  });

  it("loads user from localStorage token as user", async () => {
    localStorage.setItem("authToken", "fake-token");
    (decodeToken as Mock).mockReturnValueOnce({
      sub: "1",
      userinfo: { name: "Bob" },
      groups: ["some-other-group"],
    });

    render(
      <WithContext>
        <UserProvider>
          <TestComponent />
        </UserProvider>
      </WithContext>
    );

    await waitFor(() =>
      expect(screen.getByTestId("user-role").textContent).toBe("user")
    );
  });

  it("setUser updates user context", async () => {
    render(
      <WithContext>
        <UserProvider>
          <TestComponent />
        </UserProvider>
      </WithContext>
    );
    screen.getByTestId("set-user").click();
    await waitFor(() =>
      expect(screen.getByTestId("user-role").textContent).toBe("admin")
    );
  });
});
