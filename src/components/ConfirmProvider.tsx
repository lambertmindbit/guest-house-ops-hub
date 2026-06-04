"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type AlertOpts = { title: string; message?: string; okLabel?: string };

type Dialog =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: "alert"; resolve: (v: boolean) => void } & AlertOpts);

type ConfirmApi = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  alert: (opts: AlertOpts) => Promise<void>;
};

const Ctx = createContext<ConfirmApi | null>(null);

// In-app replacement for window.confirm / window.alert — a styled modal so
// destructive actions (delete, archive, cancel) don't show raw browser popups.
export function useConfirm(): ConfirmApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dlg, setDlg] = useState<Dialog | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ kind: "confirm", resolve, ...opts })),
    [],
  );
  const alert = useCallback(
    (opts: AlertOpts) => new Promise<void>((resolve) => setDlg({ kind: "alert", resolve: () => resolve(), ...opts })),
    [],
  );

  function done(result: boolean) {
    dlg?.resolve(result);
    setDlg(null);
  }

  useEffect(() => {
    if (!dlg) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") done(false);
      else if (e.key === "Enter") done(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlg]);

  return (
    <Ctx.Provider value={{ confirm, alert }}>
      {children}
      {dlg && (
        <div className="dialog-backdrop" onClick={() => done(false)}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="dialog__body">
              <div className="dialog__title">{dlg.title}</div>
              {dlg.message && <div className="dialog__msg">{dlg.message}</div>}
            </div>
            <div className="dialog__actions">
              {dlg.kind === "confirm" && (
                <button className="btn btn--ghost btn--sm" onClick={() => done(false)}>{dlg.cancelLabel ?? "Cancel"}</button>
              )}
              <button
                autoFocus
                className={`btn btn--sm ${dlg.kind === "confirm" && dlg.danger ? "btn--danger" : "btn--primary"}`}
                onClick={() => done(true)}
              >
                {dlg.kind === "alert" ? dlg.okLabel ?? "OK" : dlg.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
