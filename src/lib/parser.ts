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

const EVENT_RE = /<event\s+name="?([^\s">]+)"?([^>]*)>([\s\S]*?)<\/event>/;
const TASK_ID_RE = /task_id="?([^\s">]+)"?/;
const SUMMARY_RE = /<session_history_summary>([\s\S]*?)<\/session_history_summary>/;
const SESSION_START_RE = /<start_of_session>([\s\S]*?)<\/start_of_session>/;
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

  const sessionMatch = content.match(SESSION_START_RE);
  if (sessionMatch) {
    return {
      index,
      role: entry.role,
      kind: "user-session-start",
      content,
      eventSummary: sessionMatch[1].trim() || undefined,
    };
  }

  return { index, role: entry.role, kind: "user-text" as EntryKind, content };
}

const SECTION_HEADER_RE = /^[= ]{3,}\n\s*(.+?)\s*\n[= ]{3,}$/;

interface RawSection {
  title: string | null;
  json: string;
}

function extractSections(raw: string): RawSection[] {
  const sections: RawSection[] = [];
  let remaining = raw;

  while (remaining.length > 0) {
    const arrayStart = remaining.indexOf("[");
    if (arrayStart === -1) break;

    // Look for a section header in the text before this array
    const preamble = remaining.slice(0, arrayStart);
    const headerMatch = preamble.match(SECTION_HEADER_RE);
    const title = headerMatch ? headerMatch[1].trim() : null;

    // Find the matching closing bracket by parsing through the fixed content
    // We need to find the end of this JSON array, accounting for raw newlines
    const fixed = fixNonStandardJson(remaining.slice(arrayStart));
    let depth = 0;
    let inStr = false;
    let esc = false;
    let endPos = -1;
    for (let i = 0; i < fixed.length; i++) {
      const ch = fixed[i];
      if (esc) { esc = false; continue; }
      if (inStr) {
        if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) { endPos = i; break; }
      }
    }

    if (endPos === -1) break;

    sections.push({ title, json: fixed.slice(0, endPos + 1) });

    // Advance past this array in the original text.
    // The fixed text may be longer than the original due to escape expansion,
    // so we find the next section by looking for the next header/array.
    // Find the corresponding ] in the original text by scanning for the
    // Nth ] that closes the top-level array.
    let origDepth = 0;
    let origInStr = false;
    let origEsc = false;
    let origEnd = -1;
    for (let i = arrayStart; i < remaining.length; i++) {
      const ch = remaining[i];
      if (origEsc) { origEsc = false; continue; }
      if (origInStr) {
        if (ch === "\\") origEsc = true;
        else if (ch === '"') origInStr = false;
        continue;
      }
      if (ch === '"') origInStr = true;
      else if (ch === "[") origDepth++;
      else if (ch === "]") {
        origDepth--;
        if (origDepth === 0) { origEnd = i; break; }
      }
    }

    if (origEnd === -1) break;
    remaining = remaining.slice(origEnd + 1);
  }

  return sections;
}

export function parseContext(raw: string): ClassifiedEntry[] {
  const sections = extractSections(raw);

  if (sections.length === 0) {
    throw new Error("No JSON arrays found in input");
  }

  const allEntries: ClassifiedEntry[] = [];
  let globalIndex = 0;
  const multiSection = sections.length > 1;

  for (const section of sections) {
    const data: RawEntry[] = JSON.parse(section.json);

    if (!Array.isArray(data)) {
      throw new Error("Expected a JSON array of context entries");
    }

    if (multiSection) {
      allEntries.push({
        index: globalIndex++,
        role: "system",
        kind: "section-header",
        content: section.title ?? "Context",
      });
    }

    for (const entry of data) {
      allEntries.push(classifyEntry(entry, globalIndex++));
    }
  }

  return allEntries;
}
