import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  classifyParserFailure,
  ProcessDemoParser,
} from "../../src/infrastructure/parser/demo-parser.js";

describe("classifyParserFailure", () => {
  it("maps known parser errors to user-safe messages", () => {
    expect(
      classifyParserFailure(
        "demo-parser: invalid CS2 demo header: expected PBDEMS2\n",
      ).message,
    ).toBe("Demo parser: this is not a CS2 demo file");
    expect(
      classifyParserFailure(
        "demo-parser: demo contains no fully observed valid live rounds",
      ).message,
    ).toBe("Demo parser: no complete rounds were found in this demo");
  });

  it("keeps only the first error line, without stack traces or paths", () => {
    const { message, detail } = classifyParserFailure(
      [
        "demo-parser: warning: replay unavailable",
        "demo-parser: demo parse: unable to find existing entity 76 in /data/objects/x.dem",
        "stacktrace:",
        "goroutine 4 [running]:",
      ].join("\n"),
    );
    expect(message).toBe(
      "Demo parser could not read this demo (unsupported or corrupted file)",
    );
    expect(detail).toBe(
      "demo-parser: demo parse: unable to find existing entity 76 in <path>",
    );
  });
});

describe("ProcessDemoParser", () => {
  let dir = "";
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("rejects with the classified message and reports the parser's error line", async () => {
    dir = await mkdtemp(join(tmpdir(), "fake-parser-"));
    const bin = join(dir, "parser.sh");
    await writeFile(
      bin,
      "#!/bin/sh\necho 'demo-parser: demo parse: unable to find existing entity 76' >&2\necho 'goroutine 1 [running]:' >&2\nexit 1\n",
    );
    await chmod(bin, 0o755);
    const seen: string[] = [];
    const parser = new ProcessDemoParser(
      bin,
      10_000,
      () => "/usr/bin:/bin",
      undefined,
      (detail) => seen.push(detail),
    );
    await expect(parser.parse(join(dir, "missing.dem"))).rejects.toThrow(
      "Demo parser could not read this demo (unsupported or corrupted file)",
    );
    expect(seen).toEqual([
      "demo-parser: demo parse: unable to find existing entity 76",
    ]);
  });
});
