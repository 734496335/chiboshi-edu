"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva("duo-btn", {
  variants: {
    variant: {
      primary: "primary",
      success: "success",
      danger: "danger",
      secondary: "secondary",
      warning: "warning",
      ghost: "ghost",
      locked: "locked",
      primaryOutline: "primary-outline",
      successOutline: "success-outline",
      dangerOutline: "danger-outline",
      secondaryOutline: "secondary-outline",
    },
    size: {
      sm: "sm",
      md: "",
      lg: "lg",
      xl: "xl",
      icon: "icon",
    },
  },
  defaultVariants: {
    variant: "ghost",
    size: "md",
  },
});

interface Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
