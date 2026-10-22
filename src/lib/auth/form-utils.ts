import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Aplica os `fieldErrors` de um ActionResult nos campos do formulário.
 * Retorna true se algum campo conhecido recebeu erro.
 */
export function aplicarErrosDeCampo<T extends FieldValues>(
  setError: UseFormSetError<T>,
  campos: readonly Path<T>[],
  fieldErrors: Record<string, string[]> | undefined,
): boolean {
  if (!fieldErrors) return false;
  let aplicou = false;
  for (const campo of campos) {
    const mensagem = fieldErrors[campo]?.[0];
    if (mensagem) {
      setError(campo, { type: "server", message: mensagem }, { shouldFocus: !aplicou });
      aplicou = true;
    }
  }
  return aplicou;
}
