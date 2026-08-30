"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { LogoMark } from "./Brandmark";
import { Check } from "./icons";

type Step = "email" | "code" | "success";

const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Onboarding gate — cinematic landing: email → code 6 chiffres → accès.
 * AUTH RÉELLE : le code est généré, haché et vérifié CÔTÉ SERVEUR
 * (/api/auth/*) et envoyé par email (Resend). « Passer » = mode démo
 * invité, sans compte : rien n'est persisté. `onComplete` déverrouille.
 */
export function AuthScreen({ onComplete }: { onComplete: () => void }) {
  const reduce = useReducedMotion();
  const { refreshSession } = useStore();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const valid = emailRe.test(email.trim());

  const sendCode = async () => {
    if (!valid) {
      setError("Entre une adresse email valide.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await api.sendCode(email.trim().toLowerCase());
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCode("");
    setCodeErr(false);
    setStep("code");
    setTimeout(() => codeRef.current?.focus(), 450);
  };

  const onCode = async (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 6);
    setCode(d);
    setCodeErr(false);
    setError(null);
    if (d.length === 6 && !busy) {
      setBusy(true);
      const res = await api.verify(email.trim().toLowerCase(), d);
      setBusy(false);
      if (res.ok) {
        await refreshSession();
        setStep("success");
        setTimeout(onComplete, 1500);
      } else {
        setCodeErr(true);
        setError(res.error);
        setTimeout(() => setCode(""), 550);
      }
    }
  };

  return (
    <div className="theme-dark fixed inset-0 z-[100] overflow-hidden bg-noir text-bone">
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.7)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-7">
        {/* logo — materialises out of blur, with a halo pulse + soft breathing */}
        <motion.div
          initial={{ scale: 0.55, opacity: 0, filter: "blur(18px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* halo bloom behind the mark */}
          <motion.span
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full bg-bone/30 blur-2xl"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.55, 0.22], scale: [0.5, 1.5, 1.15] }}
            transition={{ duration: 1.9, ease: "easeOut" }}
          />
          {/* the mark — gentle breathing loop once it has arrived */}
          <LogoMark variant="white" className="size-20" />
        </motion.div>

        {/* wordmark — thin, wide-tracked Montserrat (refined / luxe), revealed
            letter by letter. Left inset balances the last letter's trailing
            tracking so the word stays optically centred. */}
        <div className="mt-7 flex pl-[0.42em]" aria-label="SOLANGE">
          {"SOLANGE".split("").map((ch, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                delay: 0.55 + i * 0.09,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="font-display text-[1.7rem] font-light tracking-[0.42em] text-bone"
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* steps — the whole block cascades in once, after the intro */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 w-full"
        >
          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-3"
              >
                <p className="text-center text-[15px] text-bone/85">
                  Entre ton email pour recevoir ton code d&apos;accès.
                </p>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && void sendCode()}
                  placeholder="ton@email.com"
                  aria-label="Adresse email"
                  className={`field mt-2 rounded-full text-center text-[15px] ${
                    error ? "border-bone/70" : ""
                  }`}
                />
                {error && (
                  <p className="text-center text-[11px] text-ash" role="alert">
                    {error}
                  </p>
                )}
                <motion.button
                  onClick={() => void sendCode()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={!valid || busy}
                  className="mt-1 rounded-full bg-bone py-3.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-40"
                >
                  {busy ? "Envoi…" : "Recevoir le code"}
                </motion.button>
              </motion.div>
            )}

            {step === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-3"
              >
                <p className="text-center text-[14px] text-bone/85">
                  Code envoyé à{" "}
                  <span className="text-bone">{email.trim()}</span>
                </p>

                {/* 6 boxes driven by one hidden input */}
                <motion.div
                  animate={codeErr ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => codeRef.current?.focus()}
                  className="mt-2 flex cursor-text gap-2"
                >
                  {Array.from({ length: 6 }).map((_, i) => {
                    const active = i === code.length;
                    return (
                      <div
                        key={i}
                        className={`font-display grid size-12 place-items-center rounded-xl border text-xl font-bold tabular-nums transition-colors ${
                          codeErr
                            ? "border-bone/60"
                            : active
                              ? "border-bone bg-bone/[0.06]"
                              : code[i]
                                ? "border-bone/40"
                                : "border-bone/15"
                        }`}
                      >
                        {code[i] ?? ""}
                      </div>
                    );
                  })}
                </motion.div>
                <input
                  ref={codeRef}
                  value={code}
                  onChange={(e) => void onCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Code de vérification à 6 chiffres"
                  className="sr-only"
                />

                {error && (
                  <p
                    className="mt-1 text-center text-[11px] text-ash"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                {busy && (
                  <p className="mt-1 text-center text-[11px] text-ash">
                    Vérification…
                  </p>
                )}

                <div className="mt-1 flex items-center gap-4">
                  <button
                    onClick={() => setStep("email")}
                    className="min-h-11 text-[12px] text-ash transition-colors hover:text-bone"
                  >
                    ← Modifier l&apos;email
                  </button>
                  <button
                    onClick={() => void sendCode()}
                    disabled={busy}
                    className="min-h-11 text-[12px] text-ash transition-colors hover:text-bone disabled:opacity-40"
                  >
                    Renvoyer le code
                  </button>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  className="grid size-16 place-items-center rounded-full bg-bone text-ink"
                >
                  <Check className="size-8" />
                </motion.span>
                <p className="font-display text-2xl font-bold uppercase tracking-tight text-bone">
                  Bienvenue
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* skip — beta access */}
      {step !== "success" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={onComplete}
          className="pb-safe absolute inset-x-0 bottom-6 z-10 mx-auto block w-fit min-h-11 text-[12.5px] tracking-wide text-ash transition-colors hover:text-bone"
        >
          Passer · mode démo sans compte →
        </motion.button>
      )}
    </div>
  );
}
