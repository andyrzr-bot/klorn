import type { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { lazy, Suspense, useEffect } from "react";
import { persistOptions } from "../api/query-client";
import { SessionProvider, useSession } from "../auth/session";
import { I18nProvider } from "../i18n/I18nProvider";
import { Shell } from "../layout/Shell";
import { useLayoutPlan } from "../layout/viewport";
import { installBackButton } from "../platform/back-button";
import { installKeyboardInsets } from "../platform/keyboard";
import { isNative } from "../platform/native";
import { PushLayer } from "../push/PushLayer";
import { RouterProvider, useRouter } from "../router/Router";
import type { Route } from "../router/routes";
import { AccountsScreen } from "../screens/accounts/AccountsScreen";
import { LinkRelay } from "../screens/accounts/LinkRelay";
import { AssistantScreen } from "../screens/assistant/AssistantScreen";
import { CalendarScreen } from "../screens/calendar/CalendarScreen";
import { CoverScreen } from "../screens/cover/CoverScreen";
import { FilesScreen } from "../screens/files/FilesScreen";
import { WelcomeScreen } from "../screens/login/WelcomeScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { TodayScreen } from "../screens/today/TodayScreen";
import { StatusNoteHost } from "../ui/StatusNote";
import { ThemeProvider } from "./theme";

// Mail is the largest screen (reader, composer, sheets, sanitizer): its own
// chunk, loaded from the bundle on first use, so a cold start into Today
// parses less.
const MailScreen = lazy(() =>
  import("../screens/mail/MailScreen").then((m) => ({ default: m.MailScreen })),
);

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "today":
    case "notFound":
      return <TodayScreen />;
    case "mail":
      return (
        <Suspense fallback={<div className="boot" aria-busy="true" />}>
          <MailScreen lane={route.lane} id={route.id} view={route.view} />
        </Suspense>
      );
    case "calendar":
      return <CalendarScreen id={route.id} />;
    case "files":
      return <FilesScreen id={route.id} />;
    case "assistant":
      return <AssistantScreen section={route.section} id={route.id} />;
    case "accounts":
      return <AccountsScreen />;
    case "settings":
      return <SettingsScreen section={route.section} />;
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
  useEffect(() => installKeyboardInsets(), []);
  useEffect(() => {
    if (session.status !== "loading") hideSplash();
  }, [session.status]);

  if (session.status === "loading") return <div className="boot" aria-busy="true" />;
  if (session.status === "signedOut") return <WelcomeScreen />;
  const signedIn = (
    <>
      <StatusNoteHost />
      <LinkRelay />
      <PushLayer />
    </>
  );
  if (plan.sizeClass === "cover" && plan.posture === "flat") {
    return (
      <>
        <CoverScreen />
        {signedIn}
      </>
    );
  }
  return (
    <>
      <Shell plan={plan}>
        <Screen route={router.route} />
      </Shell>
      {signedIn}
    </>
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
