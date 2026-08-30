"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Heart,
  Comment,
  Share,
  Bookmark,
  Music,
  Hanger,
} from "../chrome/icons";
import { Avatar } from "../chrome/Avatar";
import { RailAction } from "./RailAction";
import { compact } from "@/lib/utils";

export function ActionRail({
  liked,
  saved,
  likes,
  comments,
  shares,
  onLike,
  onSave,
  onComment,
  onShop,
  shopCount,
  creatorSeed,
  creatorName,
  active,
}: {
  liked: boolean;
  saved: boolean;
  likes: number;
  comments: number;
  shares: number;
  onLike: () => void;
  onSave: () => void;
  onComment?: () => void;
  /** Opens the Shop-the-look drawer. When set, a cart bubble tops the rail. */
  onShop?: () => void;
  shopCount?: number;
  creatorSeed?: string;
  creatorName?: string;
  active?: boolean;
}) {
  const reduce = useReducedMotion();
  // CSS-driven disc spin, only while this card is active (and motion allowed)
  const spinning = active && !reduce;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Pièces du look — cintre, ouvre le tiroir Shop-the-look. */}
      {onShop && (
        <RailAction
          label={
            shopCount && shopCount > 0
              ? `${shopCount} pièce${shopCount > 1 ? "s" : ""}`
              : "Shop"
          }
          onClick={onShop}
          ariaLabel="Voir les pièces à shopper"
        >
          <Hanger className="size-6 text-bone" />
        </RailAction>
      )}

      <RailAction
        label={compact(likes + (liked ? 1 : 0))}
        onClick={onLike}
        pressed={liked}
        ariaLabel={liked ? "Retirer le j'aime" : "J'aime"}
      >
        <motion.span
          key={liked ? "on" : "off"}
          animate={liked && !reduce ? { scale: [1, 1.35, 1] } : {}}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {/* filled state is the only signal — strict B&W, no colour swap */}
          <Heart filled={liked} className="size-6 text-bone" />
        </motion.span>
      </RailAction>

      <RailAction
        label={compact(comments)}
        onClick={onComment}
        ariaLabel="Commentaires"
      >
        <Comment className="size-6 text-bone" />
      </RailAction>

      <RailAction label={compact(shares)} ariaLabel="Partager">
        <Share className="size-[22px] text-bone" />
      </RailAction>

      <RailAction
        label={saved ? "Enregistré" : "Garder"}
        onClick={onSave}
        accent
        pressed={saved}
        ariaLabel={saved ? "Retirer des enregistrements" : "Enregistrer"}
      >
        <Bookmark filled={saved} className="size-6 text-bone" />
      </RailAction>

      {/* spinning sound disc — optionnel (retiré du feed mobile : le
          créateur vit désormais en bas de la carte) */}
      {creatorSeed && creatorName && (
        <span
          className={`relative mt-1 grid size-12 place-items-center rounded-full bg-ink ring-1 ring-bone/20 ${
            spinning ? "spin-disc" : ""
          }`}
        >
          <Avatar
            name={creatorName}
            seed={creatorSeed}
            className="size-9 text-base opacity-80"
          />
          <span className="absolute inset-0 grid place-items-center">
            <Music className="size-4 text-bone" />
          </span>
        </span>
      )}
    </div>
  );
}
