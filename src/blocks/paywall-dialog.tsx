import { m } from '@/paraglide/messages.js';
import { Pricing } from '@/blocks/pricing';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// "Out of credits" dialog for the homepage generator. Its own module so the
// dialog code is only downloaded once it is first opened (blocks/hotel-lobby).
export default function PaywallDialog({
  open,
  onOpenChange,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-6xl">
        <Pricing variant="dialog" title={title ?? m['hotel.paywall.title']()} />
      </DialogContent>
    </Dialog>
  );
}
