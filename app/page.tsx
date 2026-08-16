"use client";

import { LandingPage } from "@/components/LandingPage";
import { NotificationRuntime } from "@/components/NotificationSystem";

export default function HomePage() {
  return (
    <>
      {/* The in-tab event engine must run on the landing page too — otherwise real
          scheduled events never produce notifications until the dashboard is opened. */}
      <NotificationRuntime now={new Date()} showTopAlert={false} />
      <LandingPage />
    </>
  );
}
