"use client";

import { cn } from "@/lib/utils";

type BaseProps = {
  /** Accessible label — required so the field is never unlabelled. */
  "aria-label": string;
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
