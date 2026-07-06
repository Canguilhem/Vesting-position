import { ExternalLinkIcon, iconActionClass } from "./icons";

type Props = {
  href: string;
  label?: string;
  stopPropagation?: boolean;
  className?: string;
};

export function ExplorerLinkButton({
  href,
  label = "View on explorer",
  stopPropagation = false,
  className = iconActionClass,
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={`${className} hover:text-foreground`}
    >
      <ExternalLinkIcon />
    </a>
  );
}
