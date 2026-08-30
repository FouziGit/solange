"use client";

import { Sheet } from "../ui/Sheet";
import { useState } from "react";
import { commentsByLook } from "@/lib/mock";
import { Avatar } from "../chrome/Avatar";
import { Send } from "../chrome/icons";

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
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      eyebrow="Commentaires"
      title={`${thread.length} message${thread.length > 1 ? "s" : ""}`}
      container="absolute"
    >
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
                  <span className="shrink-0 text-[11px] text-ash">
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
    </Sheet>
  );
}
