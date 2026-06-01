import { Instagram, Mail } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const INSTAGRAM_URL = 'https://www.instagram.com/fiscalfocus';
const SUPPORT_EMAIL = 'supportbytetobrain@gmail.com';
const EMAIL_SUBJECT = 'Fiscal Focus App Feedback';
const EMAIL_BODY = 'Hey, I want to give you one feedback on the fiscalfocus application.';

interface FeedbackSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps) {
  const handleInstagram = () => {
    window.open(INSTAGRAM_URL, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  };

  const handleEmail = () => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}&body=${encodeURIComponent(EMAIL_BODY)}`;
    window.location.href = mailto;
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[30vh] max-h-[30vh] rounded-t-2xl px-5 pb-5 pt-5">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">Send Feedback</SheetTitle>
          <SheetDescription className="text-xs">
            Reach out via Instagram or email — we read every message.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="feedback-instagram"
            onClick={handleInstagram}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 text-white flex items-center justify-center">
              <Instagram size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Instagram</p>
              <p className="text-[11px] text-muted-foreground">@fiscalfocus</p>
            </div>
          </button>

          <button
            type="button"
            data-testid="feedback-email"
            onClick={handleEmail}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Mail size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Email</p>
              <p className="text-[11px] text-muted-foreground">Send an email</p>
            </div>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
