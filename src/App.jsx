import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import CustomCursor from "./components/CustomCursor.jsx";

function SettingsHost() {
  const { apiKey, model, handleSaveSettings, settingsOpen, setSettingsOpen } = useApp();
  if (!settingsOpen) return null;
  return (
    <SettingsModal
      apiKey={apiKey}
      model={model}
      onSave={handleSaveSettings}
      onClose={() => setSettingsOpen(false)}
    />
  );
}

/**
 * Wraps route renders with a CSS fade-in transition keyed to the location.
 * Each navigation triggers a re-mount of the inner content, which replays
 * the page-transition animation without any third-party library.
 */
function AnimatedRoutes() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState("enter");

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransitionStage("exit");
    }
  }, [location, displayLocation]);

  function handleAnimationEnd() {
    if (transitionStage === "exit") {
      setTransitionStage("enter");
      setDisplayLocation(location);
    }
  }

  return (
    <div
      className={transitionStage === "exit" ? "page-exit" : "page-transition"}
      onAnimationEnd={handleAnimationEnd}
      style={{ minHeight: "100dvh", width: "100%" }}
    >
      <Routes location={displayLocation}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chat/:chatId" element={<ChatPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <CustomCursor />
      <AnimatedRoutes />
      <SettingsHost />
    </AppProvider>
  );
}
