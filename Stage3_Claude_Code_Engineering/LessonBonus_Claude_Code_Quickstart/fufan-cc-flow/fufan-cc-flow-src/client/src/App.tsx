import AppLayout from "./components/layout/AppLayout";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
  // Connect WebSocket (always, regardless of projectPath)
  useWebSocket();

  return (
    <ErrorBoundary scope="App">
      <AppLayout />
    </ErrorBoundary>
  );
}
