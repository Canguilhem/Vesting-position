import { useState } from "react";
import { CopyIcon, iconActionClass } from "./icons";

type Props = {
  value: string;
  /** Stop click from bubbling (e.g. inside a selectable card button). */
  stopPropagation?: boolean;
  className?: string;
  label?: string;
};

export function CopyButton({
  value,
  stopPropagation = false,
  className = iconActionClass,
  label = "Copy address",
}: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={copied ? "Copied!" : label}
      aria-label={label}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={`${className} cursor-pointer`}
    >
      <CopyIcon />
    </button>
  );
}
