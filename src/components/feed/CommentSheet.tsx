"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { commentsByLook } from "@/lib/mock";
import { Avatar } from "../chrome/Avatar";
import { Send, X } from "../chrome/icons";

/**
 * Bottom-sheet comment thread for a feed look. Mirrors ShopTheLook's
 * AnimatePresence spring drawer (glass, bg-coal/95, noir) and reuses the
 * messages composer pattern. The composer is intentionally non-submitting
 * (mock-only — no backend): typing is allowed, send is a no-op.
 */
export function CommentSheet({
  lookId,
  open,
  onOpenChange,
}: {
  lookId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const thread = commentsByLook[lookId] ?? [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 z-30 bg-ink/70 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="absolute inset-x-0 bottom-0 z-40 flex max-h-[78%] flex-col overflow-hidden rounded-t-[28px] border-t border-bone/15 bg-coal/95 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <p className="eyebrow text-sm text-bone">Commentaires</p>
                <p className="font-display text-xl font-bold tracking-mega text-bone">
                  {thread.length} message{thread.length > 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="grid size-9 place-items-center rounded-full bg-bone/10 text-bone"
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mx-5 h-px bg-bone/10" />

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              {thread.length === 0 ? (
                <p className="py-8 text-center text-sm text-ash">
                  Aucun commentaire pour l&apos;instant.
                </p>
              ) : (
                thread.map((c) => (
                  <div key={`${c.handle}-${c.time}`} className="flex gap-3">
                    <Avatar
                      name={c.name}
                      seed={c.seed}
                      className="size-9 shrink-0 text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[13px] font-semibold text-bone">
                          @{c.handle}
                        </span>
                        <span className="shrink-0 text-[10px] text-ash">
                          {c.time}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-bone/90">
                        {c.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* composer — non-submitting (mock), clears the home indicator */}
            <div className="flex items-center gap-2 border-t border-bone/10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:pb-5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ajoute un commentaire…"
                aria-label="Ajouter un commentaire"
                className="glass h-11 flex-1 rounded-full px-4 text-base text-bone outline-none placeholder:text-ash md:text-[13.5px]"
              />
              <button
                type="button"
                onClick={() => setDraft("")}
                aria-label="Publier le commentaire"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-bone text-ink transition-transform active:scale-90"
              >
                <Send className="size-5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
