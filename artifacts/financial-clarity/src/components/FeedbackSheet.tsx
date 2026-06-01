import { Mail } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

const WHATSAPP_PHONE = '918830828911';
const WHATSAPP_MESSAGE = 'Hey Wishvesh, I want to give you one feedback on the fiscal focus application like the message .';
const SUPPORT_EMAIL = 'bytetobrain95@gmail.com';
const EMAIL_SUBJECT = 'Fiscal Focus App Feedback';
const EMAIL_BODY = 'Hey Wishvesh, I want to give you one feedback on the fiscal focus application like the message .';

interface FeedbackSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps) {
  const handleWhatsApp = () => {
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
            Reach out on WhatsApp or email — we read every message.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="feedback-whatsapp"
            onClick={handleWhatsApp}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-[#25D366] text-white flex items-center justify-center">
              <WhatsAppIcon size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">WhatsApp</p>
              <p className="text-[11px] text-muted-foreground">+91 88308 28911</p>
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
