import "@/styles/globals.scss";

import { BackgroundWrapper } from "@/components/background-wrapper";
import { LanguageProvider } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Skeleton } from "@/components/skeleton";
import { ThemeProvider } from "@/components/theme-provider";
import { LANGS, getLanguage } from "@/lib/i18n";
import { getServiceConfig } from "@/lib/service-url";
import { getAllowedLanguages } from "@/lib/zitadel";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { getWorkplaceLoginContext } from "@/lib/workplace-context";
import React, { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("title") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);
  const workplaceContext = await getWorkplaceLoginContext();
  const productName = workplaceContext?.tenantName || "Workplace";
  const brandStyle = workplaceContext
    ? ({
        "--workplace-primary": workplaceContext.primaryColor || "#16794a",
        "--workplace-accent": workplaceContext.accentColor || workplaceContext.primaryColor || "#16794a",
        "--theme-light-primary-500": workplaceContext.primaryColor || "#16794a",
        "--theme-light-primary-600": workplaceContext.accentColor || workplaceContext.primaryColor || "#12673e",
      } as React.CSSProperties)
    : undefined;

  let languages = LANGS;
  try {
    const settings = await getAllowedLanguages({ serviceConfig });
    if (settings.allowedLanguages?.length) {
      languages = settings.allowedLanguages
        .filter((code) => LANGS.find((l) => l.code === code))
        .map((code) => getLanguage(code));
    }
  } catch (e) {
    console.error("Failed to load supported languages", e);
  }

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <head />
      <body style={brandStyle}>
        <ThemeProvider>
          <Tooltip.Provider>
            <Suspense
              fallback={
                <BackgroundWrapper
                  className={`bg-background-light-600 dark:bg-background-dark-600 relative flex min-h-screen flex-col justify-center`}
                >
                  <div className="relative mx-auto w-full max-w-[440px] py-8">
                    <Skeleton>
                      <div className="h-40"></div>
                    </Skeleton>
                    <div className="flex flex-row items-center justify-end space-x-4 py-4">
                    </div>
                  </div>
                </BackgroundWrapper>
              }
            >
              <LanguageProvider>
                <BackgroundWrapper className="workplace-auth-shell">
                  <header className="workplace-auth-header">
                    <a
                      href={workplaceContext?.tenantOrigin || process.env.WORKPLACE_PLATFORM_URL || "/"}
                      className="workplace-auth-wordmark"
                      aria-label={productName}
                    >
                      {workplaceContext?.logoUrl ? (
                        <img src={workplaceContext.logoUrl} alt="" className="workplace-auth-logo" />
                      ) : (
                        <span aria-hidden="true">{productName.slice(0, 1).toUpperCase()}</span>
                      )}
                      <strong>{productName}</strong>
                    </a>
                    <div className="workplace-auth-tools">
                      <LanguageSwitcher languages={languages} />
                    </div>
                  </header>
                  <div className="workplace-auth-stage">
                    <div>{children}</div>
                  </div>
                </BackgroundWrapper>
              </LanguageProvider>
            </Suspense>
          </Tooltip.Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
