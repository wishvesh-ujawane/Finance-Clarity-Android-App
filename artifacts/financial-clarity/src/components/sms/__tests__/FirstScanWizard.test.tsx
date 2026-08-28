import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstScanWizard } from '../FirstScanWizard';
import { SMS_COPY } from '@/lib/sms/copy';

function setup(overrides: Partial<React.ComponentProps<typeof FirstScanWizard>> = {}) {
  const onClose = vi.fn();
  const onScanStart = vi.fn();
  const onMaybeLater = vi.fn();
  render(
    <FirstScanWizard
      open={true}
      onClose={onClose}
      onScanStart={onScanStart}
      onMaybeLater={onMaybeLater}
      {...overrides}
    />,
  );
  return { onClose, onScanStart, onMaybeLater };
}

describe('FirstScanWizard', () => {
  it('renders when open=true', () => {
    setup();
    // jest-dom is not wired for this project, so use a plain existence assertion.
    expect(screen.getByText(SMS_COPY.wizard.title)).toBeTruthy();
  });

  it('invokes onScanStart with the default 30-day range when primary CTA tapped', () => {
    const { onScanStart } = setup();
    fireEvent.click(screen.getByText(SMS_COPY.wizard.primaryCta));
    expect(onScanStart).toHaveBeenCalledTimes(1);
    expect(onScanStart).toHaveBeenCalledWith(30);
  });

  it('changes selection when a different range button is tapped', () => {
    const { onScanStart } = setup();
    fireEvent.click(screen.getByText(SMS_COPY.wizard.days90));
    fireEvent.click(screen.getByText(SMS_COPY.wizard.primaryCta));
    expect(onScanStart).toHaveBeenCalledWith(90);
  });

  it('invokes onMaybeLater when secondary CTA tapped', () => {
    const { onMaybeLater } = setup();
    fireEvent.click(screen.getByText(SMS_COPY.wizard.secondaryCta));
    expect(onMaybeLater).toHaveBeenCalledTimes(1);
  });
});
