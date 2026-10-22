"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return <Sonner position="bottom-center" duration={3000} toastOptions={{ className: "!rounded-lg !border-border !bg-surface !text-foreground" }} />;
}

export { toast } from "sonner";
