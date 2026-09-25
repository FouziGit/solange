"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { MIN_AGE, paymentsClaim } from "@/lib/legal";
import { announce } from "@/lib/announce";
import { usePaymentsMode } from "@/lib/use-payments-mode";
import {
  CODE_VALIDITY_MIN,
  type Missing,
  RESEND_DELAY_S,
  missingForCode,
  missingMessage,
  resendWait,
} from "@/lib/auth-form";
import { LogoMark } from "./Brandmark";
import { Check } from "./icons";

type Step = "email" | "code" | "success";

/**
 * Onboarding gate — cinematic landing: email → code 6 chiffres → accès.
 * AUTH RÉELLE : le code est généré, haché et vérifié CÔTÉ SERVEUR
 * (/api/auth/*) et envoyé par email (Resend). « Passer » = mode démo
 * invité, sans compte : rien n'est persisté. `onComplete` déverrouille.
 */
export function AuthScreen({ onComplete }: { onComplete: () => void }) {
  const { refreshSession } = useStore();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  /* Acceptation recueillie AVANT l'envoi du code : on ne fait pas
     recevoir un email à quelqu'un pour lui poser la question ensuite.
     Les deux cases sont distinctes et non pré-cochées — une case
     pré-cochée ne vaut pas consentement. L'acceptation est ensuite
     transmise à /api/auth/verify, qui l'horodate côté serveur. */
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [ageDeclared, setAgeDeclared] = useState(false);
  /* « Recevoir le code » reste actionnable (aria-disabled, pas disabled) :
     un bouton grisé ne dit pas ce qui manque. Au toucher, on le dit, et
     les champs fautifs passent en aria-invalid. */
  const [tried, setTried] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const legalRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  /* « Modifier l'email » disparaît avec l'étape code : le champ email
     reprend le focus à son retour (pas au premier affichage). */
  const [editingEmail, setEditingEmail] = useState(false);
  // Délai serveur de 60 s entre deux envois : décompte sur « Renvoyer »
  const [sends, setSends] = useState(0);
  const [wait, setWait] = useState(0);
  const reduce = useReducedMotion();
  const claim = paymentsClaim(usePaymentsMode());
  const errId = useId();
  const hintId = useId();
  const sentId = useId();

  const missing = missingForCode({ email, acceptLegal, ageDeclared });
  const canSend = missing.length === 0;
  const hint = missingMessage(missing);
  // L'erreur serveur prime ; sinon, après un essai, ce qui manque encore
  const shownError = error ?? (tried ? hint : null);
  // Aide du bouton : le message visible s'il l'affiche déjà, sinon sr-only
  const hintVisible = !!hint && shownError === hint;
  const invalid = (m: Missing) => tried && missing.includes(m);
  // Le flou n'est pas coupé par MotionRoot (reducedMotion="user")
  const blur = (px: number) => (reduce ? "blur(0px)" : `blur(${px}px)`);

  useEffect(() => {
    if (step !== "code" || sends === 0) return;
    const sentAt = Date.now();
    const id = setInterval(() => {
      const left = resendWait(sentAt, Date.now());
      setWait(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [step, sends]);

  const fail = (message: string) => {
    setError(message);
    announce(message, "assertive");
  };

  const sendCode = async () => {
    if (busy) return;
    if (!canSend) {
      setTried(true);
      setError(null);
      if (hint) announce(hint, "assertive");
      const first = { email: emailRef, legal: legalRef, age: ageRef }[
        missing[0]
      ];
      first.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await api.sendCode(email.trim().toLowerCase());
    setBusy(false);
    if (!res.ok) {
      fail(res.error);
      return;
    }
    setSends((n) => n + 1);
    setWait(RESEND_DELAY_S);
    setTried(false);
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
      const res = await api.verify(email.trim().toLowerCase(), d, {
        acceptLegal,
        ageDeclared,
      });
      setBusy(false);
      if (res.ok) {
        await refreshSession();
        setStep("success");
        announce("Connexion réussie. Bienvenue.");
        setTimeout(onComplete, 1500);
      } else {
        setCodeErr(true);
        fail(res.error);
        setTimeout(() => setCode(""), 550);
      }
    }
  };

  return (
    /* Défile : en paysage ou avec le texte agrandi, le formulaire dépasse
       la hauteur de l'écran et ne doit jamais être rogné. */
    <div className="theme-dark fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-noir text-bone">
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.7)" }}
      />

      {/* mt-auto (logo) + mb-auto (étapes) : le bloc reste centré, et
          « Passer » suit dans le flux, en bas */}
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col items-center px-7 pt-12 pb-6">
        {/* logo — materialises out of blur, with a halo pulse + soft breathing */}
        <motion.div
          initial={{ scale: 0.55, opacity: 0, filter: blur(18) }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-auto"
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
        <h1 className="mt-7 flex pl-[0.42em]">
          <span className="sr-only">SOLANGE, connexion</span>
          {"SOLANGE".split("").map((ch, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, y: 14, filter: blur(8) }}
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
        </h1>

        {/* steps — the whole block cascades in once, after the intro */}
        <motion.div
          /* naît visible : c'est l'élément LCP du premier écran (mesuré) */
          initial={{ y: 14 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 mb-auto w-full"
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
                  ref={emailRef}
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
                  autoFocus={editingEmail}
                  aria-invalid={invalid("email") || undefined}
                  aria-describedby={shownError ? errId : undefined}
                  className={`field mt-2 rounded-full text-center text-base md:text-[15px] ${
                    error || invalid("email") ? "border-bone/70" : ""
                  }`}
                />
                {/* annoncé par announce() : pas de role="alert" ici, sinon
                    le message serait lu deux fois */}
                {shownError && (
                  <p id={errId} className="text-center text-[11px] text-ash">
                    {shownError}
                  </p>
                )}

                <div className="mt-1 flex flex-col gap-3 text-left">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      ref={legalRef}
                      type="checkbox"
                      checked={acceptLegal}
                      onChange={(e) => {
                        setAcceptLegal(e.target.checked);
                        setError(null);
                      }}
                      aria-invalid={invalid("legal") || undefined}
                      aria-describedby={
                        invalid("legal") && shownError ? errId : undefined
                      }
                      className="mt-0.5 size-5 shrink-0 accent-bone"
                    />
                    <span className="text-[12.5px] leading-relaxed text-bone/80">
                      J&apos;accepte les{" "}
                      <Link
                        href="/cgu"
                        className="text-bone underline underline-offset-4"
                      >
                        conditions d&apos;utilisation
                      </Link>{" "}
                      et les{" "}
                      <Link
                        href="/cgv"
                        className="text-bone underline underline-offset-4"
                      >
                        conditions de vente
                      </Link>
                      , et j&apos;ai lu la{" "}
                      <Link
                        href="/confidentialite"
                        className="text-bone underline underline-offset-4"
                      >
                        politique de confidentialité
                      </Link>
                      .
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      ref={ageRef}
                      type="checkbox"
                      checked={ageDeclared}
                      onChange={(e) => {
                        setAgeDeclared(e.target.checked);
                        setError(null);
                      }}
                      aria-invalid={invalid("age") || undefined}
                      aria-describedby={
                        invalid("age") && shownError ? errId : undefined
                      }
                      className="mt-0.5 size-5 shrink-0 accent-bone"
                    />
                    <span className="text-[12.5px] leading-relaxed text-bone/80">
                      Je déclare avoir {MIN_AGE} ans ou plus.
                    </span>
                  </label>
                </div>

                <motion.button
                  onClick={() => void sendCode()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={busy}
                  aria-disabled={!canSend || undefined}
                  aria-describedby={
                    hint ? (hintVisible ? errId : hintId) : undefined
                  }
                  className="mt-1 rounded-full bg-bone py-3.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-40 aria-disabled:opacity-40"
                >
                  {busy ? "Envoi…" : "Recevoir le code"}
                </motion.button>
                {hint && !hintVisible && (
                  <span id={hintId} className="sr-only">
                    {hint}
                  </span>
                )}

                <p className="mt-1 text-center text-[11px] leading-relaxed text-ash">
                  {claim === "simule" &&
                    "Les paiements sont simulés : aucune somme n'est débitée. "}
                  {claim === "stripe" &&
                    "Le paiement se fait par carte, via Stripe. "}
                  <Link
                    href="/informations-legales"
                    className="underline underline-offset-4 transition-colors hover:text-bone"
                  >
                    Informations légales
                  </Link>
                </p>
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
                <p id={sentId} className="text-center text-[14px] text-bone/85">
                  Code envoyé à{" "}
                  <span className="text-bone">{email.trim()}</span>
                  <span className="mt-1 block text-[12.5px] text-ash">
                    Valable {CODE_VALIDITY_MIN} minutes.
                  </span>
                </p>

                {/* 6 boxes driven by one hidden input. Secousse d'erreur
                    coupée sous « Réduire les animations » : l'erreur est
                    écrite et annoncée, elle n'en dépend pas. */}
                <motion.div
                  animate={
                    codeErr && !reduce ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }
                  }
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
                  aria-invalid={codeErr || undefined}
                  aria-describedby={error ? `${sentId} ${errId}` : sentId}
                  className="sr-only"
                />

                {/* annoncé par announce(), comme à l'étape email */}
                {error && (
                  <p
                    id={errId}
                    className="mt-1 text-center text-[11px] text-ash"
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
                    onClick={() => {
                      setEditingEmail(true);
                      setStep("email");
                    }}
                    className="min-h-11 text-[12px] text-ash transition-colors hover:text-bone"
                  >
                    ← Modifier l&apos;email
                  </button>
                  <button
                    onClick={() => void sendCode()}
                    disabled={busy || wait > 0}
                    className="min-h-11 text-[12px] tabular-nums text-ash transition-colors hover:text-bone disabled:opacity-40"
                  >
                    {wait > 0
                      ? `Renvoyer le code dans ${wait} s`
                      : "Renvoyer le code"}
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

        {/* skip — beta access. Dans le flux (plus en absolute) : il ne
            recouvre plus le formulaire et défile avec lui. */}
        {step !== "success" && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={onComplete}
            className="pb-safe mt-8 block min-h-11 text-[12.5px] tracking-wide text-ash transition-colors hover:text-bone"
          >
            Passer · mode démo sans compte →
          </motion.button>
        )}
      </div>
    </div>
  );
}
