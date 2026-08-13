import './ConfirmModal.css';

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, confirming, onConfirm, onCancel }) {
  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-modal-title">{title}</h3>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn confirm-modal-btn--cancel" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button
            className={`confirm-modal-btn ${danger ? 'confirm-modal-btn--danger' : 'confirm-modal-btn--primary'}`}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
