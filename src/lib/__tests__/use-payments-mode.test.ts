import { describe, expect, it, vi } from "vitest";
import { PAYMENTS_UNKNOWN, createPaymentsModeStore } from "../use-payments-mode";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createPaymentsModeStore", () => {
  it("une seule requête pour N abonnés", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true as const,
      data: { live: true, test: false },
    }));
    const s = createPaymentsModeStore(fetcher);
    const l1 = vi.fn();
    const l2 = vi.fn();
    s.subscribe(l1);
    s.subscribe(l2);
    s.subscribe(() => {});
    expect(s.getSnapshot()).toEqual(PAYMENTS_UNKNOWN);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot()).toEqual({
      ready: true,
      live: true,
      test: false,
      failed: false,
    });
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    // un abonné tardif ne relance pas la question
    s.subscribe(() => {});
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("échec : jamais ready, jamais « simulé », relance possible", async () => {
    let ok = false;
    const fetcher = vi.fn(async () =>
      ok
        ? { ok: true as const, data: { live: false, test: false } }
        : { ok: false as const },
    );
    const s = createPaymentsModeStore(fetcher);
    s.subscribe(() => {});
    await flush();
    expect(s.getSnapshot()).toEqual({ ...PAYMENTS_UNKNOWN, failed: true });
    ok = true;
    s.load();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(s.getSnapshot()).toEqual({
      ready: true,
      live: false,
      test: false,
      failed: false,
    });
  });

  it("une exception réseau devient un échec", async () => {
    const s = createPaymentsModeStore(() => Promise.reject(new Error("x")));
    s.subscribe(() => {});
    await flush();
    expect(s.getSnapshot().failed).toBe(true);
    expect(s.getSnapshot().ready).toBe(false);
  });
});
