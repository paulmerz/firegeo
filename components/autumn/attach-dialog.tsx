"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { type CheckProductPreview } from "autumn-js";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAttachContent } from "@/lib/autumn/attach-content";
import { useCustomer } from "@/hooks/useAutumnCustomer";
import { isNetworkError } from "@/lib/network-utils";
import { useTranslations } from "next-intl";

export interface AttachDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  preview: CheckProductPreview;
}

export default function AttachDialog(params?: AttachDialogProps) {
  const { attach, refetch } = useCustomer();
  const [loading, setLoading] = useState(false);
  const tErrors = useTranslations('errors');
  const [optionsInput, setOptionsInput] = useState<FeatureOption[]>(
    params?.preview?.options || []
  );

  const getTotalPrice = () => {
    let sum = due_today?.price || 0;
    optionsInput.forEach((option) => {
      if (option.price && option.quantity) {
        sum += option.price * (option.quantity / option.billing_units);
      }
    });
    return sum;
  };

  useEffect(() => {
    setOptionsInput(params?.preview?.options || []);
  }, [params?.preview?.options]);

  if (!params || !params.preview) {
    return <></>;
  }

  const { open, setOpen, preview } = params;
  const { items, due_today } = preview;
  const { title, message } = getAttachContent(preview);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={cn(
          "p-0 pt-4 gap-0 text-foreground overflow-hidden text-sm"
        )}
      >
        <DialogTitle className={cn("px-6 mb-1 ")}>{title}</DialogTitle>
        <div className={cn("px-6 mt-1 mb-4 text-muted-foreground")}>
          {message}
        </div>
        {(items || optionsInput.length > 0) && (
          <div className="mb-6 px-6">
            {items?.map((item) => (
              <PriceItem key={item.description}>
                <span className="truncate flex-1">
                  {item.description}
                </span>
                <span>{item.price}</span>
              </PriceItem>
            ))}

            {optionsInput?.map((option, index) => {
              return (
                <OptionsInput
                  key={option.feature_name}
                  option={option as FeatureOptionWithRequiredPrice}
                  optionsInput={optionsInput}
                  setOptionsInput={setOptionsInput}
                  index={index}
                />
              );
            })}
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row justify-between gap-x-4 py-2 pl-6 pr-3 bg-secondary border-t shadow-inner">
          {due_today && (
            <TotalPrice>
              <span>Due Today</span>
              <span>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: due_today.currency,
                }).format(getTotalPrice())}
              </span>
            </TotalPrice>
          )}
          <button
            onClick={async () => {
              setLoading(true);
              try {
                await attach({
                  productId: preview.product_id,
                  options: optionsInput.map((option) => ({
                    featureId: option.feature_id,
                    quantity: option.quantity || 0,
                  })),
                  successUrl: window.location.origin + '/dashboard',
                  cancelUrl: window.location.origin + '/plans',
                });
                setOpen(false);
                
                // Refresh customer data to update credits in navbar
                await refetch();
                
                // Show success message based on scenario
                if (preview.scenario === 'downgrade') {
                  alert(`Downgrade scheduled! Your plan will change to ${preview.product_name} on ${new Date(preview.next_cycle_at!).toLocaleDateString()}.`);
                  // Redirect to dashboard after downgrade
                  window.location.href = '/dashboard';
                } else if (preview.scenario === 'upgrade') {
                  alert(`Upgrade successful! You're now on the ${preview.product_name} plan.`);
                  // Redirect to dashboard after upgrade
                  window.location.href = '/dashboard';
                }
              } catch (error) {
                console.error('Error attaching product:', error);
                
                // Check if it's a network error and show appropriate message
                let errorMessage = 'An error occurred. Please try again or contact support.';
                if (isNetworkError(error)) {
                  errorMessage = tErrors('connectionLost');
                } else if (error instanceof Error) {
                  if (error.message.includes('internet') || error.message.includes('connection')) {
                    errorMessage = tErrors('noInternetConnection');
                  }
                }
                
                alert(errorMessage);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="btn-firecrawl-orange inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 h-8 px-4 min-w-16 gap-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span className="whitespace-nowrap flex gap-1">
                  Confirm
                </span>
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const PriceItem = ({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        "flex flex-col pb-4 sm:pb-0 gap-1 sm:flex-row justify-between sm:h-7 sm:gap-2 sm:items-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

interface FeatureOption {
  feature_id: string;
  feature_name: string;
  billing_units: number;
  price?: number;
  quantity?: number;
}

interface FeatureOptionWithRequiredPrice
  extends Omit<FeatureOption, "price" | "quantity"> {
  price: number;
  quantity: number;
}

export const OptionsInput = ({
  option,
  optionsInput,
  setOptionsInput,
  index,
}: {
  option: FeatureOptionWithRequiredPrice;
  optionsInput: FeatureOption[];
  setOptionsInput: (options: FeatureOption[]) => void;
  index: number;
}) => {
  const { feature_name, billing_units, quantity, price } = option;
  return (
    <PriceItem key={feature_name}>
      <span>{feature_name}</span>
      <QuantityInput
        key={feature_name}
        value={quantity ? quantity / billing_units : ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const newOptions = [...optionsInput];
          newOptions[index].quantity = parseInt(e.target.value) * billing_units;
          setOptionsInput(newOptions);
        }}
      >
        <span className="">
          × ${price} per {billing_units === 1 ? " " : billing_units}{" "}
          {feature_name}
        </span>
      </QuantityInput>
    </PriceItem>
  );
};

export const QuantityInput = ({
  children,
  onChange,
  value,
  className,
  ...props
}: {
  children: React.ReactNode;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const currentValue = Number(value) || 0;

  const handleValueChange = (newValue: number) => {
    const syntheticEvent = {
      target: { value: String(newValue) },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  return (
    <div
      className={cn(className, "flex flex-row items-center gap-4")}
      {...props}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            currentValue > 0 && handleValueChange(currentValue - 1)
          }
          disabled={currentValue <= 0}
          className="h-6 w-6 pb-0.5"
        >
          -
        </Button>
        <span className="w-8 text-center text-foreground">
          {currentValue}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleValueChange(currentValue + 1)}
          className="h-6 w-6 pb-0.5"
        >
          +
        </Button>
      </div>
      {children}
    </div>
  );
};

export const TotalPrice = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="w-full font-semibold flex justify-between items-center">
      {children}
    </div>
  );
};

export const PricingDialogButton = ({
  children,
  size,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "lg" | "default" | "icon";
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size={size}
      className={cn(className, "shadow-sm shadow-stone-400")}
    >
      {children}
      <ArrowRight className="!h-3" />
    </Button>
  );
};
