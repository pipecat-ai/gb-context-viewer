export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface RawEntry {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export type EntryKind =
  | "system"
  | "user-text"
  | "user-event"
  | "user-summary"
  | "user-tag"
  | "assistant"
  | "assistant-tool-call"
  | "tool-response"
  | "section-header";

export interface ClassifiedEntry {
  index: number;
  role: RawEntry["role"];
  kind: EntryKind;
  content: string;
  eventName?: string;
  eventTaskId?: string;
  eventBody?: string;
  eventSummary?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  summaryContent?: string;
}
