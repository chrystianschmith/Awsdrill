import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Violações WCAG 2.1 A/AA (inclui contraste). */
export async function violacoesA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => ({ id: v.id, impacto: v.impact, alvos: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
}
