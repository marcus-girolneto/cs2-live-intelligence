// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapsApiProvider } from "../api/context";
import type { MapsApi } from "../api/maps.api";
import type { Progress } from "../model/progress";
import { useCoachProgress } from "./useCoachProgress";

const progress = { timeline: [], reviews: [] } as unknown as Progress;
const wrap =
  (api: MapsApi) =>
  ({ children }: { children: ReactNode }) => (
    <MapsApiProvider value={api}>{children}</MapsApiProvider>
  );

describe("useCoachProgress", () => {
  it("loads progress from the injected api", async () => {
    const api: MapsApi = {
      getProgress: async () => progress,
      rateReview: async () => {},
    };
    const { result } = renderHook(() => useCoachProgress(), {
      wrapper: wrap(api),
    });
    expect(result.current.progress).toBeNull();
    await waitFor(() => expect(result.current.progress).toBe(progress));
    expect(result.current.failed).toBe(false);
  });
  it("reports failure instead of throwing", async () => {
    const api: MapsApi = {
      getProgress: async () => {
        throw new Error("down");
      },
      rateReview: async () => {},
    };
    const { result } = renderHook(() => useCoachProgress(), {
      wrapper: wrap(api),
    });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.progress).toBeNull();
  });
});
