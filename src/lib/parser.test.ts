import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseContext } from "./parser";

const SAMPLES_DIR = join(__dirname, "../../samples");
const sampleFiles = readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".txt"));

describe("parseContext", () => {
  it("finds sample files", () => {
    expect(sampleFiles.length).toBeGreaterThan(0);
  });

  for (const file of sampleFiles) {
    describe(file, () => {
      const raw = readFileSync(join(SAMPLES_DIR, file), "utf8");
      let entries: ReturnType<typeof parseContext>;

      it("parses without error", () => {
        entries = parseContext(raw);
        expect(entries.length).toBeGreaterThan(0);
      });

      it("has at least one system entry", () => {
        entries = entries ?? parseContext(raw);
        const systemEntries = entries.filter(
          (e) => e.kind === "system" || e.kind === "section-header"
        );
        expect(systemEntries.length).toBeGreaterThan(0);
      });

      it("classifies events correctly (no events misclassified as user-text)", () => {
        entries = entries ?? parseContext(raw);
        const userTexts = entries.filter((e) => e.kind === "user-text");
        for (const entry of userTexts) {
          expect(entry.content).not.toMatch(/<event\s+name=/);
        }
      });

      it("classifies system tags correctly (no tags misclassified as user-text)", () => {
        entries = entries ?? parseContext(raw);
        const userTexts = entries.filter((e) => e.kind === "user-text");
        for (const entry of userTexts) {
          // Content that is entirely a single XML tag should be user-tag, not user-text
          expect(entry.content).not.toMatch(/^\s*<([a-z_]+)>[\s\S]*<\/\1>\s*$/);
        }
      });
    });
  }
});
