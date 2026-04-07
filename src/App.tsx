import { useState } from "react";
import { ClassifiedEntry } from "./types";
import { parseContext } from "./lib/parser";
import FileInput from "./components/FileInput";
import ContextViewer from "./components/ContextViewer";

export default function App() {
  const [entries, setEntries] = useState<ClassifiedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleParse(raw: string) {
    try {
      const parsed = parseContext(raw);
      setEntries(parsed);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse context");
      setEntries(null);
    }
  }

  function handleReset() {
    setEntries(null);
    setError(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>GB Context Viewer</h1>
        {entries && (
          <button className="reset-btn" onClick={handleReset}>
            Load another file
          </button>
        )}
      </header>
      <hr className="header-rule" />
      {error && <div className="error-banner">{error}</div>}
      {entries ? (
        <ContextViewer entries={entries} />
      ) : (
        <FileInput onParse={handleParse} />
      )}
    </div>
  );
}
