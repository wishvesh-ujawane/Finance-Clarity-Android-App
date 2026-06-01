import { useState } from 'react';
import { IntroCarousel } from './IntroCarousel';
import { AuthStep } from './AuthStep';
import { RestoreChoiceStep } from './RestoreChoiceStep';
import { markOnboardingComplete } from '@/lib/onboarding';
import type { RemoteBackupInfo } from '@/context/BackupContext';

type Step = 'intro' | 'auth' | 'restore-choice';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('intro');
  const [remote, setRemote] = useState<RemoteBackupInfo | null>(null);

  const finish = (reason: string) => {
    markOnboardingComplete(reason);
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Finance Clarity"
      data-testid="onboarding-flow"
    >
      {step === 'intro' && (
        <IntroCarousel
          onComplete={() => setStep('auth')}
          onSkip={() => setStep('auth')}
        />
      )}

      {step === 'auth' && (
        <AuthStep
          onSignedIn={(info) => {
            if (info) {
              setRemote(info);
              setStep('restore-choice');
            } else {
              finish('signed-in-no-backup');
            }
          }}
          onSkip={() => finish('skipped-auth')}
        />
      )}

      {step === 'restore-choice' && remote && (
        <RestoreChoiceStep
          remote={remote}
          onDone={() => finish('post-restore-choice')}
        />
      )}
    </div>
  );
}
