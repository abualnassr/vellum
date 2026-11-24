interface UnsavedModalProps {
  title: string;
  isAppClose: boolean;
  dirtyCount: number;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  onCancel: () => void;
}

export function UnsavedModal({
  title,
  isAppClose,
  dirtyCount,
  onSaveAndContinue,
  onDiscardAndContinue,
  onCancel,
}: UnsavedModalProps) {
  return (
    <div className="vellum-modal-backdrop centered" onClick={onCancel}>
      <div
        className="modal-card"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Unsaved Changes"
      >
        <div className="modal-header">
          <h2>Unsaved Changes</h2>
        </div>
        <div className="modal-body" style={{ gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isAppClose
              ? `You have ${dirtyCount} unsaved document${dirtyCount > 1 ? 's' : ''}. Would you like to save before exiting Vellum?`
              : `Save changes to "${title}" before closing this tab?`}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={onDiscardAndContinue}>
              {isAppClose ? 'Exit Without Saving' : "Don't Save"}
            </button>
            <button type="button" className="btn-primary" onClick={onSaveAndContinue}>
              {isAppClose ? 'Save All & Exit' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
