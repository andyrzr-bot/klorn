import type { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect } from "react";
import { persistOptions } from "../api/query-client";
import { SessionProvider, useSession } from "../auth/session";
import { I18nProvider } from "../i18n/I18nProvider";
import { Shell } from "../layout/Shell";
import { useLayoutPlan } from "../layout/viewport";
import { installBackButton } from "../platform/back-button";
import { isNative } from "../platform/native";
import { RouterProvider, useRouter } from "../router/Router";
import type { Route } from "../router/routes";
import { AccountsScreen } from "../screens/accounts/AccountsScreen";
import { CoverScreen } from "../screens/cover/CoverScreen";
import { WelcomeScreen } from "../screens/login/WelcomeScreen";
import { MailScreen } from "../screens/mail/MailScreen";
import { PlaceholderScreen } from "../screens/placeholder/PlaceholderScreen";
import { TodayScreen } from "../screens/today/TodayScreen";
import { ThemeProvider } from "./theme";

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "today":
    case "notFound":
      return <TodayScreen />;
    case "mail":
      return <MailScreen lane={route.lane} id={route.id} />;
    case "calendar":
      return <PlaceholderScreen title="tab.calendar" icon="calendar" />;
    case "files":
      return <PlaceholderScreen title="tab.files" icon="files" />;
    case "assistant":
      return <PlaceholderScreen title="tab.assistant" icon="spark" />;
    case "accounts":
      return <AccountsScreen />;
  }
}

let splashHidden = false;

function hideSplash() {
  if (splashHidden || !isNative()) return;
  splashHidden = true;
  void import("@capacitor/splash-screen").then(({ SplashScreen }) =>
    SplashScreen.hide({ fadeOutDuration: 160 }).catch(() => {}),
  );
}

function Root() {
  const session = useSession();
  const plan = useLayoutPlan();
  const router = useRouter();

  useEffect(() => installBackButton(router.back), [router.back]);
  useEffect(() => {
    if (session.status !== "loading") hideSplash();
  }, [session.status]);

  if (session.status === "loading") return <div className="boot" aria-busy="true" />;
  if (session.status === "signedOut") return <WelcomeScreen />;
  if (plan.sizeClass === "cover" && plan.posture === "flat") return <CoverScreen />;
  return (
    <Shell plan={plan}>
      <Screen route={router.route} />
    </Shell>
  );
}

export function App({ queryClient }: { queryClient: QueryClient }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions("session")}>
      <ThemeProvider>
        <I18nProvider>
          <SessionProvider>
            <RouterProvider>
              <Root />
            </RouterProvider>
          </SessionProvider>
        </I18nProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
