import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

const cor = "#2b4a7a";

/** Layout único dos e-mails: uma coluna, texto curto, um botão, rodapé com preferências. */
export function EmailLayout({
  preview,
  children,
  action,
  appUrl,
}: {
  preview: string;
  children: ReactNode;
  action?: { label: string; href: string };
  appUrl: string;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f7f9fa", fontFamily: "Helvetica, Arial, sans-serif", color: "#1d2329" }}>
        <Container style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px", backgroundColor: "#ffffff" }}>
          <Text style={{ fontSize: 16, fontWeight: 700, color: cor, margin: 0 }}>{BRAND.name}</Text>
          <Section style={{ marginTop: 16 }}>{children}</Section>
          {action ? (
            <Section style={{ marginTop: 24 }}>
              <Button
                href={action.href}
                style={{ backgroundColor: cor, color: "#ffffff", padding: "12px 20px", borderRadius: 6, fontSize: 14 }}
              >
                {action.label}
              </Button>
            </Section>
          ) : null}
          <Hr style={{ marginTop: 32, borderColor: "#e3e7ea" }} />
          <Text style={{ fontSize: 12, color: "#69737d" }}>
            Você recebe este e-mail porque tem uma conta no {BRAND.name}.{" "}
            <Link href={`${appUrl}/conta#notificacoes`} style={{ color: "#69737d" }}>
              Preferências de e-mail
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const paragrafo = { fontSize: 14, lineHeight: "22px", margin: "0 0 12px" } as const;
