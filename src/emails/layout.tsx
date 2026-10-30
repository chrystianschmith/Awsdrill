import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

// Mesma identidade do app: barra preta, amarelo só no botão (texto preto) e no "Drill".
const amarelo = "#f7c600";
const preto = "#131311";

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
      <Body style={{ backgroundColor: "#f7f6f1", fontFamily: "Helvetica, Arial, sans-serif", color: "#1f1e1a" }}>
        <Container style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px", backgroundColor: "#ffffff" }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#ffffff",
              backgroundColor: preto,
              padding: "12px 16px",
              margin: 0,
            }}
          >
            {BRAND.partes[0]} <span style={{ color: amarelo }}>{BRAND.partes[1]}</span>
          </Text>
          <Section style={{ marginTop: 16 }}>{children}</Section>
          {action ? (
            <Section style={{ marginTop: 24 }}>
              <Button
                href={action.href}
                style={{
                  backgroundColor: amarelo,
                  color: preto,
                  padding: "12px 20px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {action.label}
              </Button>
            </Section>
          ) : null}
          <Hr style={{ marginTop: 32, borderColor: "#e6e3d8" }} />
          <Text style={{ fontSize: 12, color: "#66625a" }}>
            Você recebe este e-mail porque tem uma conta no {BRAND.name}.{" "}
            <Link href={`${appUrl}/conta#notificacoes`} style={{ color: "#66625a" }}>
              Preferências de e-mail
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const paragrafo = { fontSize: 14, lineHeight: "22px", margin: "0 0 12px" } as const;
