/** Petite marque de Kosmy Board (un tableau d'espaces), dessinée en ligne. */
export function KosmyBoardMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" opacity="0.55" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" opacity="0.55" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  );
}

