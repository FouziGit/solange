"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LogoMark } from "./Brandmark";
import { Check } from "./icons";

type Step = "email" | "code" | "success";

const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Onboarding gate — a cinematic, motion-heavy landing (Vinted/Vestiaire vibe):
 * email → 6-digit code → access. Code is SIMULATED for now (shown on screen);
 * swapping in a real Resend email is a drop-in on `sendCode`. A "Passer" button
 * skips auth for beta testing. `onComplete` unlocks the app.
 */
export function AuthScreen({ onComplete }: { onComplete: () => void }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [emailErr, setEmailErr] = useState(false);
  const [codeErr, setCodeErr] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const valid = emailRe.test(email.trim());

  const sendCode = () => {
    if (!valid) {
      setEmailErr(true);
      return;
    }
    // SIMULATED: generate a code and reveal it. (Real email → call an API here.)
    setDemoCode(String(Math.floor(100000 + Math.random() * 900000)));
    setCode("");
    setCodeErr(false);
    setStep("code");
    setTimeout(() => codeRef.current?.focus(), 450);
  };

  const onCode = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 6);
    setCode(d);
    setCodeErr(false);
    if (d.length === 6) {
      if (d === demoCode) {
        setStep("success");
        setTimeout(onComplete, 1500);
      } else {
        setCodeErr(true);
        setTimeout(() => setCode(""), 550);
      }
    }
  };

  return (
    <div className="theme-dark fixed inset-0 z-[100] overflow-hidden bg-noir text-bone">
      {/* drifting light blobs — quiet motion so the screen feels alive */}
      {!reduce && (
        <>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -left-[20%] -top-[10%] size-[70vh] rounded-full bg-bone/[0.07] blur-[110px]"
            animate={{ x: [0, 60, -20, 0], y: [0, 40, 10, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -bottom-[15%] -right-[15%] size-[60vh] rounded-full bg-bone/[0.05] blur-[120px]"
            animate={{ x: [0, -50, 20, 0], y: [0, -30, -10, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

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
          {/* expanding sonar ring on entrance */}
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full border border-bone/40"
              initial={{ opacity: 0.6, scale: 0.7 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.3 }}
            />
          )}
          {/* the mark — gentle breathing loop once it has arrived */}
          <motion.div
            animate={reduce ? undefined : { y: [0, -7, 0] }}
            transition={
              reduce
                ? undefined
                : {
                    duration: 4.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.2,
                  }
            }
          >
            <LogoMark variant="white" className="size-20" />
          </motion.div>
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
                    setEmailErr(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && sendCode()}
                  placeholder="ton@email.com"
                  aria-label="Adresse email"
                  className={`field mt-2 rounded-full text-center text-[15px] ${
                    emailErr ? "border-bone/70" : ""
                  }`}
                />
                {emailErr && (
                  <p className="text-center text-[11px] text-ash">
                    Entre une adresse email valide.
                  </p>
                )}
                <motion.button
                  onClick={sendCode}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={!valid}
                  className="mt-1 rounded-full bg-bone py-3.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-40"
                >
                  Recevoir le code
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
                  onChange={(e) => onCode(e.target.value)}
                  inputMode="numeric"
                  aria-label="Code de vérification à 6 chiffres"
                  className="sr-only"
                />

                {/* demo hint (removed once real email is wired) */}
                <p className="mt-1 rounded-full border border-bone/15 bg-bone/[0.03] px-3 py-1.5 text-[11px] text-ash">
                  Démo · ton code :{" "}
                  <span className="font-display font-bold tracking-[0.3em] text-bone">
                    {demoCode}
                  </span>
                </p>

                <button
                  onClick={() => setStep("email")}
                  className="mt-1 text-[12px] text-ash transition-colors hover:text-bone"
                >
                  ← Modifier l&apos;email
                </button>
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
          className="pb-safe absolute inset-x-0 bottom-6 z-10 mx-auto block w-fit text-[12.5px] tracking-wide text-ash transition-colors hover:text-bone"
        >
          Passer · accès beta test →
        </motion.button>
      )}
    </div>
  );
}
