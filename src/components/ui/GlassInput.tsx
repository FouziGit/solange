"use client";

import { cn } from "@/lib/utils";

/** Nom accessible obligatoire, pour qu'aucun champ ne reste muet : un
    `aria-label`, ou mieux un `id` relié à une <FieldLabel htmlFor={id}>
    visible (VoiceOver et Contrôle vocal lisent alors l'étiquette affichée). */
type BaseProps = (
  | { "aria-label": string; id?: string }
  | { id: string; "aria-label"?: undefined }
) & {
  className?: string;
};

type InputProps = BaseProps &
  React.InputHTMLAttributes<HTMLInputElement> & {
    multiline?: false;
  };

type TextareaProps = BaseProps &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    multiline: true;
  };

/**
 * Thin glass <input>/<textarea> wrapper applying the `.field` utility
 * (provided by globals.css). Set `multiline` for a textarea.
 */
export function GlassInput(props: InputProps | TextareaProps) {
  if (props.multiline) {
    const { multiline, className, ...rest } = props;
    void multiline;
    return <textarea className={cn("field", className)} {...rest} />;
  }
  const { multiline, className, ...rest } = props;
  void multiline;
  return <input className={cn("field", className)} {...rest} />;
}
