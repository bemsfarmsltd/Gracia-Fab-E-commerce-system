import { useEffect } from "react";
import Tour from "./Tour";
import useFirstRunTour from "./useFirstRunTour";
import { adminSteps, adminTourKey } from "./adminSteps";

export default function AdminTour({ user, onOpenMenu }) {
  const { open, close } = useFirstRunTour({ name: "admin", storageKey: adminTourKey(user), enabled: Boolean(user), delay: 1200 });
  // Phones: the menu is a drawer; open it so the tour can point at it.
  useEffect(() => {
    if (open && window.innerWidth <= 992) onOpenMenu?.(true);
  }, [open, onOpenMenu]);
  const done = (result) => {
    close(result);
    if (window.innerWidth <= 992) onOpenMenu?.(false);
  };
  return <Tour steps={adminSteps(user)} open={open} onClose={done} label="Admin tour" />;
}
