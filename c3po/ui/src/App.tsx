import { ErrorBoundary } from "react-error-boundary";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import AccessDenied from "./AccessDenied.tsx";
import { AppContainer, ContentWrapper } from "./App-styles";
import Layout from "./components/Layout";
import { useConfig } from "./contexts/ConfigContext.tsx";
import { UserProvider } from "./contexts/UserContext";
import {
  ChatSectionComponent,
  ConversationPage,
} from "./screens/ConversationalBot/conversation/ConversationPage/ConversationPage";
import BotLayout from "./screens/ConversationalBot/Layout";
import { ErrorFallback } from "./screens/Setting/components/ErrorBoundry";
import { BenchmarkingTab } from "./screens/Setting/components/SettingTabs/BenchmarkingTab";
import { FeedbackTabComponent } from "./screens/Setting/components/SettingTabs/FeedbackTab";
import { InstructionsTab } from "./screens/Setting/components/SettingTabs/InstructionsTab";
import { OnboardingTab } from "./screens/Setting/components/SettingTabs/OnboardingTab";
import PromptTemplates from "./screens/Setting/components/SettingTabs/PromptTemplatesTab/PromptTemplatesTab";
import { SchemaConfigTab } from "./screens/Setting/components/SettingTabs/SchemaConfigTab";
import { SettingSection } from "./screens/Setting/SettingsSection";
import CallbackPage from "./sso/CallbackPage.tsx";
import Login from "./sso/Login.tsx";
import ProtectedRoute from "./sso/ProtectedRoute.tsx";
// import { LoginCallback } from "@okta/okta-react";
// import OktaAuthProvider from "./okta/authConfig";
// import ProtectedRoute from "./okta/protectedroute";

// const restoreOriginalUri = async (_oktaAuth: unknown, originalUri: string) => {
//   window.location.replace(originalUri || window.location.pathname);
// };

function App() {
  const { config } = useConfig()
  console.log(config);
  // Set document title from environment variable
  document.title = config.app_title || "Gilead-C3PO";

  if (
    window.location.hostname === "127.0.0.1" &&
    window.location.port === "4000"
  ) {
    localStorage.setItem("authEnabled", "false");
  }

  const authEnabled =
    localStorage.getItem("authEnabled") === "false" ? "false" : "true";
  console.log("Auth Enabled:", authEnabled);

  return (
    <Router>
      <UserProvider>
        <AppContainer>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => { }}>
            <ContentWrapper>
              <Routes>
                {/* Authentication routes */}

                {authEnabled === "true" ? (
                  <>
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth/oauth/okta" element={<CallbackPage />} />
                    <Route path="/callback" element={<CallbackPage />} />
                    <Route element={<Layout />}>
                      <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<BotLayout />} />
                        <Route element={<BotLayout />}>
                          <Route
                            path="/:conversationId?"
                            element={<ConversationPage />}
                          >
                            <Route index element={<ChatSectionComponent />} />
                            <Route path="settings" element={<SettingSection />}>
                              <Route
                                index
                                element={<Navigate to="onboarding" replace />}
                              />
                              <Route
                                path="onboarding"
                                element={<OnboardingTab />}
                              />
                              <Route
                                path="instructions"
                                element={<InstructionsTab />}
                              />
                              <Route
                                path="prompt-templates"
                                element={<PromptTemplates />}
                              />
                              <Route
                                path="schema-config"
                                element={<SchemaConfigTab />}
                              />
                              <Route
                                path="benchmarking"
                                element={<BenchmarkingTab />}
                              />
                              <Route
                                path="feedback"
                                element={<FeedbackTabComponent />}
                              />
                            </Route>
                          </Route>
                        </Route>
                      </Route>
                    </Route>
                  </>
                ) : (
                  // Public routes (no auth)
                  <Route element={<Layout />}>
                    <Route path="/" element={<BotLayout />} />
                    <Route element={<BotLayout />}>
                      <Route
                        path="/:conversationId?"
                        element={<ConversationPage />}
                      >
                        <Route index element={<ChatSectionComponent />} />
                        <Route path="settings" element={<SettingSection />}>
                          <Route
                            index
                            element={<Navigate to="onboarding" replace />}
                          />
                          <Route
                            path="onboarding"
                            element={<OnboardingTab />}
                          />
                          <Route
                            path="instructions"
                            element={<InstructionsTab />}
                          />
                          <Route
                            path="prompt-templates"
                            element={<PromptTemplates />}
                          />
                          <Route
                            path="schema-config"
                            element={<SchemaConfigTab />}
                          />
                          <Route
                            path="benchmarking"
                            element={<BenchmarkingTab />}
                          />
                          <Route
                            path="feedback"
                            element={<FeedbackTabComponent />}
                          />
                        </Route>
                      </Route>
                    </Route>
                  </Route>
                )}

                {/* Catch-all route */}
                <Route path="/access-denied" element={<AccessDenied />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </ContentWrapper>
          </ErrorBoundary>
        </AppContainer>
      </UserProvider>
    </Router>
  );
}

export default App;
