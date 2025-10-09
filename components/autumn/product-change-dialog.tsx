'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getStripeCheckoutLocale } from '@/lib/locale-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/hooks/useAutumnCustomer';
import { useCreditsInvalidation } from '@/hooks/useCreditsInvalidation';
import { Loader2 } from 'lucide-react';

interface ProductChangeDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  preview: {
    title?: string;
    message?: string;
    product_id?: string;
    due_today?: {
      price?: number;
      currency?: string;
    };
  };
}

const ProductChangeDialog = ({ open, setOpen, preview }: ProductChangeDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { attach, refetch } = useCustomer();
  const { invalidateCredits } = useCreditsInvalidation();
  const t = useTranslations('autumn.productChangeDialog');
  const tc = useTranslations('common');
  const locale = useLocale();

  const handleConfirm = async () => {
    if (!preview.product_id) return;
    
    setIsLoading(true);
    try {
      await attach({
        productId: preview.product_id,
        checkoutSessionParams: {
          success_url: window.location.origin + '/dashboard',
          cancel_url: window.location.origin + '/dashboard',
          locale: getStripeCheckoutLocale(locale),
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          billing_address_collection: 'required',
          customer_update: { address: 'auto', shipping: 'auto', name: 'auto' },
        },
      });
      // Refresh customer data to update usage statistics
      await refetch();
      // Invalidate credits cache to update navbar counter
      await invalidateCredits();
      setOpen(false);
    } catch (error) {
      console.error('Error attaching product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price?: number, currency = 'USD') => {
    if (!price) return null;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{preview?.title || t('title')}</DialogTitle>
          {preview?.message && (
            <DialogDescription>{preview.message}</DialogDescription>
          )}
        </DialogHeader>
        
        {preview?.due_today?.price !== undefined && (
          <div className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('dueToday')}</span>
              <span className="text-lg font-semibold">
                {formatPrice(preview.due_today.price, preview.due_today.currency)}
              </span>
            </div>
          </div>
        )}
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            {tc('cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('processing')}
              </>
            ) : (
              tc('confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductChangeDialog;