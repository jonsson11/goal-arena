import type { ButtonHTMLAttributes } from "react";

type GameButtonVariant = "primary" | "secondary" | "destructive";

type GameButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GameButtonVariant;
};

const ESTILOS_VARIANTE: Record<GameButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive text-white",
};

export function GameButton({
  variant = "primary",
  className = "",
  disabled,
  ...props
}: GameButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`rounded-md px-4 py-2 font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS_VARIANTE[variant]} ${className}`}
      {...props}
    />
  );
}