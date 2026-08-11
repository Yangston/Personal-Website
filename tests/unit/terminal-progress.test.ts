import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createActivityReporter,
  createProgressReporter,
  formatElapsedTime,
  withActivity,
} from "../../scripts/photography/lib/terminal-progress.mjs";

function createCaptureStream(isTTY = false, columns = 120) {
  let output = "";
  return {
    stream: {
      isTTY,
      columns,
      write(chunk: string) {
        output += chunk;
        return true;
      },
    },
    output: () => output,
  };
}

describe("terminal progress", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces one interactive line and terminates it once", () => {
    const capture = createCaptureStream(true);
    const progress = createProgressReporter({
      total: 2,
      label: "Reading EXIF",
      stream: capture.stream,
    });

    progress.update(1, "Canada/toronto/first.JPEG");
    progress.update(2, "Canada/toronto/second.JPEG");
    progress.finish();

    expect(capture.output()).toBe(
      "\r\u001B[2K[1/2 |  50%] Reading EXIF: Canada/toronto/first.JPEG" +
        "\r\u001B[2K[2/2 | 100%] Reading EXIF: Canada/toronto/second.JPEG\n",
    );
  });

  it("emits first, periodic, and final milestones without terminal controls", () => {
    const capture = createCaptureStream();
    const progress = createProgressReporter({
      total: 10,
      label: "Reading EXIF",
      stream: capture.stream,
      milestoneCount: 2,
    });

    for (let current = 1; current <= 10; current += 1)
      progress.update(current, `photo-${current}.JPEG`);
    progress.finish();

    const output = capture.output();
    expect(output.split("\n").filter(Boolean)).toEqual([
      "[ 1/10 |  10%] Reading EXIF: photo-1.JPEG",
      "[ 5/10 |  50%] Reading EXIF: photo-5.JPEG",
      "[10/10 | 100%] Reading EXIF: photo-10.JPEG",
    ]);
    expect(output).not.toMatch(/[\r\u001B]/);
  });

  it("stays quiet for an empty archive", () => {
    const capture = createCaptureStream(true);
    const progress = createProgressReporter({
      total: 0,
      label: "Reading EXIF",
      stream: capture.stream,
    });

    progress.finish();

    expect(capture.output()).toBe("");
  });

  it("leaves a clean terminal line when work fails", () => {
    const capture = createCaptureStream(true);
    const progress = createProgressReporter({
      total: 2,
      label: "Reading EXIF",
      stream: capture.stream,
    });

    expect(() => {
      try {
        progress.update(1, "Canada/toronto/first.JPEG");
        throw new Error("ExifTool failed");
      } finally {
        progress.finish();
      }
    }).toThrow("ExifTool failed");
    progress.finish();

    expect(capture.output().endsWith("\n")).toBe(true);
    expect(capture.output().match(/\n/g)).toHaveLength(1);
  });

  it("formats elapsed activity time", () => {
    expect(formatElapsedTime(0)).toBe("00:00");
    expect(formatElapsedTime(65_999)).toBe("01:05");
    expect(formatElapsedTime(3_723_000)).toBe("1:02:03");
  });

  it("refreshes interactive activity and cleans up its timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const capture = createCaptureStream(true);
    const activity = createActivityReporter({
      label: "Processing",
      detail: "img-7577 (san-francisco)",
      stream: capture.stream,
    });

    activity.start();
    vi.advanceTimersByTime(2_000);
    activity.update("img-7578 (san-francisco)");
    activity.succeed();

    const output = capture.output();
    expect(output).toContain("[00:00] Processing: img-7577");
    expect(output).toContain("[00:02] Processing: img-7578");
    expect(output).toContain("Completed Processing (00:02).\n");
    expect(output.match(/\r\u001B\[2K/g)?.length).toBeGreaterThanOrEqual(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("emits redirected state changes and periodic heartbeats", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const capture = createCaptureStream();
    const activity = createActivityReporter({
      label: "Finding priors",
      detail: "img-7577",
      stream: capture.stream,
    });

    activity.start();
    vi.advanceTimersByTime(29_000);
    expect(capture.output().split("\n").filter(Boolean)).toHaveLength(1);
    activity.update("img-7578");
    vi.advanceTimersByTime(30_000);
    activity.succeed();

    const output = capture.output();
    expect(output).toContain("[00:00] Finding priors: img-7577");
    expect(output).toContain("[00:29] Finding priors: img-7578");
    expect(output).toContain("[00:30] Finding priors: img-7578");
    expect(output).toContain("Completed Finding priors (00:59).\n");
    expect(output).not.toMatch(/[\r\u001B]/);
  });

  it("preserves activity failures and terminates reporting", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const capture = createCaptureStream(true);

    await expect(
      withActivity(
        {
          label: "Overlay audit",
          detail: "img-7577",
          stream: capture.stream,
        },
        async () => {
          await vi.advanceTimersByTimeAsync(1_000);
          throw new Error("Provider render failed");
        },
      ),
    ).rejects.toThrow("Provider render failed");

    expect(capture.output()).toContain("Failed Overlay audit (00:01).\n");
    expect(vi.getTimerCount()).toBe(0);
  });
});
