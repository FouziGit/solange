"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Avatar } from "@/components/chrome/Avatar";
import { conversations, type Message } from "@/lib/mock";
import { EASE, euro } from "@/lib/utils";
import {
  Verified,
  Search,
  ArrowLeft,
  Send,
  Bag,
} from "@/components/chrome/icons";

export default function MessagesPage() {
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<Record<string, Message[]>>({});

  const active = conversations.find((c) => c.id === selId) ?? conversations[0];
  const thread = [...active.messages, ...(extra[active.id] ?? [])];

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setExtra((e) => ({
      ...e,
      [active.id]: [...(e[active.id] ?? []), { from: "me", text }],
    }));
    setDraft("");
  };

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row">
      {/* conversation list */}
      <aside
        className={`flex-col border-bone/10 md:flex md:w-[340px] md:border-r ${
          selId ? "hidden md:flex" : "flex"
        }`}
      >
        <header className="px-5 pb-4 pt-10 md:pt-12">
          <p className="eyebrow text-sm text-bone/55">Boîte de réception</p>
          <h1 className="font-editorial text-4xl font-semibold tracking-tight text-bone">
            Messages
          </h1>
          <div className="glass mt-4 flex items-center gap-2 rounded-full px-3.5 py-2.5">
            <Search className="size-4 text-ash" />
            <input
              placeholder="Rechercher une conversation…"
              aria-label="Rechercher une conversation"
              className="w-full bg-transparent text-base text-bone outline-none placeholder:text-ash md:text-[13px]"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 pb-28 md:pb-4">
          {conversations.map((c) => {
            const on = active.id === c.id;
            const last = (extra[c.id] ?? []).at(-1) ?? c.messages.at(-1);
            return (
              <button
                key={c.id}
                onClick={() => setSelId(c.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors ${
                  on ? "bg-bone/[0.07]" : "hover:bg-bone/[0.04]"
                }`}
              >
                <Avatar
                  name={c.name}
                  seed={c.seed}
                  className="size-12 text-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-semibold text-bone">
                      {c.name}
                    </span>
                    {c.verified && <Verified className="size-3.5 text-bone" />}
                    <span className="ml-auto text-[10px] text-ash">
                      {c.time}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-ash">
                    {last?.from === "me" ? "Toi : " : ""}
                    {last?.text}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-bone text-[10px] font-bold text-ink">
                    {c.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* thread */}
      <section
        className={`flex-1 flex-col ${selId ? "flex" : "hidden md:flex"}`}
      >
        {/* thread header */}
        <header className="flex items-center gap-3 border-b border-bone/10 px-4 py-3 pt-10 md:pt-3">
          <button
            onClick={() => setSelId(null)}
            className="grid size-9 place-items-center rounded-full text-bone hover:bg-bone/10 md:hidden"
            aria-label="Retour"
          >
            <ArrowLeft className="size-5" />
          </button>
          <Avatar
            name={active.name}
            seed={active.seed}
            className="size-10 text-lg"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold text-bone">
                {active.name}
              </span>
              {active.verified && <Verified className="size-3.5 text-bone" />}
            </div>
            <span className="text-[11px] text-ash">@{active.handle}</span>
          </div>
        </header>

        {/* product context */}
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-bone/10 bg-bone/[0.03] p-2.5">
          <span className="grid size-11 place-items-center rounded-xl bg-coal text-bone/70">
            <Bag className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="overline text-[9px] text-ash">{active.itemBrand}</p>
            <p className="truncate text-[13px] text-bone">{active.itemName}</p>
          </div>
          <span className="font-display text-sm font-bold text-bone">
            {euro(active.itemPriceEUR)}
          </span>
        </div>

        {/* messages */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-5">
          {thread.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE.luxe }}
              className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${
                m.from === "me"
                  ? "self-end rounded-br-md bg-bone text-ink"
                  : "self-start rounded-bl-md bg-coal text-bone"
              }`}
            >
              {m.text}
            </motion.div>
          ))}
        </div>

        {/* composer — clears the floating mobile tab bar + home indicator */}
        <div className="flex items-center gap-2 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 md:pb-5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Écris un message…"
            aria-label="Écrire un message"
            className="glass h-11 flex-1 rounded-full px-4 text-base text-bone outline-none placeholder:text-ash md:text-[13.5px]"
          />
          <button
            onClick={send}
            aria-label="Envoyer le message"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-bone text-ink transition-transform active:scale-90"
          >
            <Send className="size-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
