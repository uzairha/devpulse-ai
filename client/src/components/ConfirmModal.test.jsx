import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from './ConfirmModal.jsx';

const baseProps = {
  title: 'Disconnect repo',
  message: 'This removes all synced data.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmModal', () => {
  it('renders the title, message and a default confirm label', () => {
    render(<ConfirmModal {...baseProps} />);
    expect(screen.getByText('Disconnect repo')).toBeInTheDocument();
    expect(screen.getByText('This removes all synced data.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('wires the Cancel and confirm buttons to their handlers', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmModal {...baseProps} confirmLabel="Disconnect" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables both buttons and shows a working label while confirming', () => {
    render(<ConfirmModal {...baseProps} confirming />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
  });

  it('uses the danger style for the confirm button when danger is set', () => {
    render(<ConfirmModal {...baseProps} danger />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('confirm-modal-btn--danger');
  });

  it('cancels on a backdrop click but not on a click inside the modal body', () => {
    const onCancel = vi.fn();
    const { container } = render(<ConfirmModal {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Disconnect repo')); // inside the modal
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.confirm-modal-backdrop'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
