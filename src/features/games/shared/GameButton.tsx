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
      // touch-manipulation: le dice al navegador que este elemento solo se
      // toca (no se hace pinch-zoom ni doble-tap-zoom sobre él), así que se
      // salta el retraso de ~300ms con el que Chrome/Safari en móvil esperan
      // a confirmar que no es el primer tap de un doble-tap -- ese retraso,
      // sumado a cualquier mínimo movimiento del dedo durante la espera, es
      // lo que hacía falta "apretar varias veces y mover" para que un botón
      // respondiera. select-none evita que un tap un poco largo se
      // interprete como selección de texto en vez de como pulsación.
      className={`touch-manipulation select-none rounded-md px-4 py-2 font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS_VARIANTE[variant]} ${className}`}
      {...props}
    />
  );
}