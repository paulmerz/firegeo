'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('autumn.productChangeDialog');
  const tc = useTranslations('common');

  const handleConfirm = async () => {
    if (!preview.product_id) return;
    
    setIsLoading(true);
    try {
      await attach({
        productId: preview.product_id,
        checkoutSessionParams: {
          return_url: window.location.origin + '/dashboard',
          success_url: window.location.origin + '/dashboard',
          cancel_url: window.location.origin + '/dashboard',
        },
      });
      // Refresh customer data to update credits in navbar
      await refetch();
      setOpen(false);
    } catch (error) {
      console.error('Error attaching product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price?: number, currency = 'USD') => {
    if (!price) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price / 100); // Assuming price is in cents
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