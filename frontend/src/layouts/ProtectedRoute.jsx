import React from "react";
import { useUser, RedirectToSignIn } from "@clerk/clerk-react";

export default function ProtectedRoute({ children }) {
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return <>{children}</>;
}
