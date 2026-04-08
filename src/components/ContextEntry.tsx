import { useState } from "react";
import { ClassifiedEntry } from "../types";

interface Props {
  entry: ClassifiedEntry;
}

const KIND_LABELS: Record<string, string> = {
  system: "SYSTEM",
  "user-text": "USER",
  "user-event": "EVENT",
  "user-summary": "SUMMARY",
  "user-tag": "TAG",
  assistant: "ASSISTANT",
  "assistant-tool-call": "ASSISTANT",
  "tool-response": "TOOL",
};


export default function ContextEntry({ entry }: Props) {
  const kindClass = `entry--${entry.kind}`;
  const isExpandable =
    entry.kind === "user-event" ||
    entry.kind === "system" ||
    entry.kind === "user-summary" ||
    entry.kind === "tool-response";

  const [open, setOpen] = useState(false);

  if (entry.kind === "section-header") {
    return (
      <div className="section-header">
        <span className="section-header-text">{entry.content}</span>
      </div>
    );
  }

  return (
    <div className={`entry ${kindClass}`}>
      <div
        className={`entry-header ${isExpandable ? "entry-header--expandable" : ""}`}
        onClick={isExpandable ? () => setOpen(!open) : undefined}
      >
        {isExpandable ? (
          <span className="chevron-inline">{open ? "\u25BC" : "\u25B6"}</span>
        ) : (
          <span className="chevron-inline" />
        )}
        <span className="entry-index">#{entry.index}</span>
        <span className={`role-badge role-badge--${entry.kind}`}>
          {KIND_LABELS[entry.kind] ?? entry.role.toUpperCase()}
        </span>
        {entry.eventName && (
          <span className="event-badge">{entry.eventName}</span>
        )}
        {entry.eventSummary && (
          <span className="event-summary">{entry.eventSummary}</span>
        )}
        {entry.eventTaskId && (
          <span className="task-id">task:{entry.eventTaskId.slice(0, 8)}</span>
        )}
        {entry.kind === "assistant-tool-call" &&
          entry.toolCalls?.map((tc) => (
            <span key={tc.id} className="tool-call-badge">
              {tc.function.name}()
            </span>
          ))}
        {entry.kind === "tool-response" && entry.toolCallId && (
          <span className="task-id">
            call:{entry.toolCallId.slice(0, 12)}
          </span>
        )}
      </div>

      {entry.kind === "system" && open && (
        <div className="collapsible-body">
          <pre className="entry-content">{entry.content}</pre>
        </div>
      )}

      {entry.kind === "user-text" && (
        <div className="entry-body">
          <pre className="entry-content">{entry.content}</pre>
        </div>
      )}

      {entry.kind === "user-event" && open && (
        <div className="collapsible-body">
          <pre className="entry-content">{entry.eventBody}</pre>
        </div>
      )}

      {entry.kind === "user-summary" && open && (
        <div className="collapsible-body">
          <pre className="entry-content">
            {entry.summaryContent ?? entry.content}
          </pre>
        </div>
      )}

      {entry.kind === "assistant" && (
        <div className="entry-body">
          <pre className="entry-content">{entry.content}</pre>
        </div>
      )}

      {entry.kind === "assistant-tool-call" && (
        <>
          {entry.content && (
            <div className="entry-body">
              <pre className="entry-content">{entry.content}</pre>
            </div>
          )}
          {entry.toolCalls?.map((tc) => (
            <div key={tc.id} className="entry-body">
              <pre className="entry-content tool-call-args">
                {formatJson(tc.function.arguments)}
              </pre>
            </div>
          ))}
        </>
      )}

      {entry.kind === "tool-response" && open && (
        <div className="collapsible-body">
          <pre className="entry-content">{formatJson(entry.content)}</pre>
        </div>
      )}
    </div>
  );
}

function formatJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
