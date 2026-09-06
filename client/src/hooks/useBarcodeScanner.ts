/**
 * useBarcodeScanner — Hook para detectar lectores de código de barras USB/HID
 *
 * Los lectores USB emulan teclado pero escriben muy rápido (< 50ms entre chars).
 * Este hook detecta esa velocidad y dispara el callback con el código completo
 * cuando llega el Enter final, sin interferir con el tipeo normal del usuario.
 *
 * Uso:
 *   useBarcodeScanner({ onScan: (code) => addToCart(code), enabled: isCreateOpen })
 */
import { useEffect, useRef } from "react";

interface UseBarccodeScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  /** Tiempo máximo entre teclas para considerarse un escáner (ms). Default: 50ms */
  threshold?: number;
  /** Longitud mínima del código para considerarse válido. Default: 4 */
  minLength?: number;
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  threshold = 50,
  minLength = 4,
}: UseBarccodeScannerOptions) {
  const bufferRef    = useRef<string>("");
  const lastKeyRef   = useRef<number>(0);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el foco está en un input/textarea (el modal ya lo maneja)
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      const now = Date.now();
      const elapsed = now - lastKeyRef.current;
      lastKeyRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= minLength) {
          onScan(code);
        }
        return;
      }

      // Si el tiempo entre teclas es mayor al umbral, resetear buffer
      if (elapsed > threshold && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // Solo acumular caracteres imprimibles
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }

      // Auto-limpiar buffer después de 500ms sin Enter
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = "";
      }, 500);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, onScan, threshold, minLength]);
}
