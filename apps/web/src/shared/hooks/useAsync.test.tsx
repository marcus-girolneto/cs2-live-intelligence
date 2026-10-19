// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsync } from "./useAsync";

describe("useAsync", () => {
  it("loads data and exposes loading state", async () => {
    const { result } = renderHook(() => useAsync(async () => 42, []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeUndefined();
  });
  it("captures errors and recovers on refresh", async () => {
    let fail = true;
    const { result } = renderHook(() =>
      useAsync(async () => {
        if (fail) throw new Error("boom");
        return "ok";
      }, []),
    );
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    fail = false;
    await act(() => result.current.refresh());
    expect(result.current.data).toBe("ok");
    expect(result.current.error).toBeUndefined();
  });
  it("aborts the previous run when deps change and ignores stale results", async () => {
    const signals: AbortSignal[] = [];
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) =>
        useAsync(
          (signal) => {
            signals.push(signal);
            return new Promise<number>((r) =>
              setTimeout(() => r(id), id === 1 ? 30 : 0),
            );
          },
          [id],
        ),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe(2));
    await new Promise((r) => setTimeout(r, 40));
    expect(result.current.data).toBe(2);
    expect(signals[0]!.aborted).toBe(true);
  });
  it("does not run while disabled", async () => {
    const load = vi.fn(async () => 1);
    const { result } = renderHook(() => useAsync(load, [], { enabled: false }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(load).not.toHaveBeenCalled();
  });
  it("supports local updates with setData", async () => {
    const { result } = renderHook(() => useAsync(async () => [1], []));
    await waitFor(() => expect(result.current.data).toEqual([1]));
    act(() => result.current.setData((p) => [...(p ?? []), 2]));
    expect(result.current.data).toEqual([1, 2]);
  });
});
