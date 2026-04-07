import { RawEntry, ClassifiedEntry, EntryKind } from "../types";

function fixNonStandardJson(raw: string): string {
  // The context files have raw newlines (and other control chars) inside JSON
  // string values, which is invalid JSON. Escape them while preserving
  // structural newlines (those outside of strings).
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      // Valid JSON escape chars after backslash: " \ / b f n r t u
      // If the char after \ is a raw newline (like shell line-continuation),
      // treat the backslash as literal and also escape the control char.
      const validEscapes = '"\\/bfnrtu';
      if (inString && !validEscapes.includes(ch)) {
        // The backslash wasn't a real JSON escape — double it, then handle ch
        result = result.slice(0, -1) + "\\\\";
        escaped = false;
        // Re-process this char normally (don't continue)
        i--;
        continue;
      }
      result += ch;
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        result += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        result += ch;
        inString = false;
        continue;
      }
      // Replace raw control characters inside strings
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === "\n") result += "\\n";
        else if (ch === "\r") result += "\\r";
        else if (ch === "\t") result += "\\t";
        else result += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
      result += ch;
    } else {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
    }
  }
  return result;
}

const EVENT_RE = /<event\s+name="([^"]+)"([^>]*)>([\s\S]*?)<\/event>/;
const TASK_ID_RE = /task_id="([^"]*)"/;
const SUMMARY_RE = /<session_history_summary>([\s\S]*?)<\/session_history_summary>/;
const SECTOR_RE = /(?:in|around) sector (\d+)/;

function extractEventSummary(eventName: string, body: string): string | undefined {
  if (eventName === "movement.complete" || eventName === "map.local") {
    const m = body.match(SECTOR_RE);
    if (m) return `sector ${m[1]}`;
  }
  return undefined;
}

function classifyEntry(entry: RawEntry, index: number): ClassifiedEntry {
  const content = entry.content ?? "";

  if (entry.role === "system") {
    return { index, role: entry.role, kind: "system", content };
  }

  if (entry.role === "tool") {
    return {
      index,
      role: entry.role,
      kind: "tool-response",
      content,
      toolCallId: entry.tool_call_id,
    };
  }

  if (entry.role === "assistant") {
    if (entry.tool_calls && entry.tool_calls.length > 0) {
      return {
        index,
        role: entry.role,
        kind: "assistant-tool-call",
        content,
        toolCalls: entry.tool_calls,
      };
    }
    return { index, role: entry.role, kind: "assistant", content };
  }

  // User messages — check for events, summaries, or plain text
  const eventMatch = content.match(EVENT_RE);
  if (eventMatch) {
    const taskIdMatch = eventMatch[2].match(TASK_ID_RE);
    const body = eventMatch[3].trim();
    const name = eventMatch[1];
    return {
      index,
      role: entry.role,
      kind: "user-event",
      content,
      eventName: name,
      eventTaskId: taskIdMatch?.[1] || undefined,
      eventBody: body,
      eventSummary: extractEventSummary(name, body),
    };
  }

  const summaryMatch = content.match(SUMMARY_RE);
  if (summaryMatch) {
    return {
      index,
      role: entry.role,
      kind: "user-summary",
      content,
      summaryContent: summaryMatch[1].trim(),
    };
  }

  return { index, role: entry.role, kind: "user-text" as EntryKind, content };
}

export function parseContext(raw: string): ClassifiedEntry[] {
  const fixed = fixNonStandardJson(raw);
  const data: RawEntry[] = JSON.parse(fixed);

  if (!Array.isArray(data)) {
    throw new Error("Expected a JSON array of context entries");
  }

  return data.map((entry, i) => classifyEntry(entry, i));
}
