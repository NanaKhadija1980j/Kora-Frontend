import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import BatchTxQueuePanel from '../components/dashboard/BatchTxQueuePanel';

/**
 * Issue #876: BatchTxQueuePanel live region never announces status changes.
 * These tests assert that the aria-live region receives announcement text
 * on progress, completion, and failure transitions.
 */
describe('BatchTxQueuePanel accessibility announcements', () => {
  it('renders a polite live region for status announcements', () => {
    render(<BatchTxQueuePanel />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('announces progress as transactions are processed', () => {
    const { rerender } = render(<BatchTxQueuePanel processed={0} total={3} />);

    rerender(<BatchTxQueuePanel processed={1} total={3} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/1 of 3/i);
  });

  it('announces completion when all transactions succeed', () => {
    const { rerender } = render(<BatchTxQueuePanel processed={2} total={3} />);

    rerender(<BatchTxQueuePanel processed={3} total={3} status="success" />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/complete|success/i);
  });

  it('announces failure when the batch fails', () => {
    const { rerender } = render(<BatchTxQueuePanel processed={1} total={3} />);

    rerender(<BatchTxQueuePanel processed={1} total={3} status="error" />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/fail|error/i);
  });

  it('updates the announcement text on subsequent progress changes', () => {
    const { rerender } = render(<BatchTxQueuePanel processed={1} total={4} />);

    act(() => {
      rerender(<BatchTxQueuePanel processed={2} total={4} />);
    });

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/2 of 4/i);
  });
});
