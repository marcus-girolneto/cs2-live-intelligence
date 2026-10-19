"use client";
import { useCallback, useEffect, useState } from "react";
import { useLiveApi } from "../api/context";
import type { Simulator, SimulatorAction } from "../model/types";

/** Local match simulator: status polled every 3 s, start/stop with the server's error text. */
export function useSimulator(onStart: () => void) {
  const api = useLiveApi();
  const [sim, setSim] = useState<Simulator>({ available: false });
  const [simError, setSimError] = useState("");
  const pollSim = useCallback(() => {
    void api
      .simulatorStatus()
      .then((s) => setSim(s))
      .catch(() => setSim({ available: false }));
  }, [api]);
  useEffect(() => {
    pollSim();
    const timer = setInterval(pollSim, 3000);
    return () => clearInterval(timer);
  }, [pollSim]);
  async function simulate(action: SimulatorAction) {
    setSimError("");
    try {
      const body = await api.simulate(action);
      setSim({ ...body, available: true });
      if (action === "start") onStart();
    } catch (e) {
      setSimError(e instanceof Error ? e.message : "Request failed.");
    }
  }
  return { sim, simError, simulate };
}
