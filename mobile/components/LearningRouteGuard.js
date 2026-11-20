import React, { useEffect } from "react";

// Guard the route itself, including direct navigation to details, questions, and completion.
export default function LearningRouteGuard({ allowed, navigation, module, children }) {
  useEffect(() => {
    if (!allowed) {
      // Replace the locked route so Back cannot return to it; leave unrelated routes intact.
      navigation.replace("LearningHome", { lockedModule: module });
    }
  }, [allowed, navigation, module]);

  // Never mount locked learning content, even while the redirect is being processed.
  return allowed ? children : null;
}
