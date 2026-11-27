import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Tour from "./Tour";
import useFirstRunTour from "./useFirstRunTour";
import { shopSteps, SHOP_TOUR_KEY } from "./shopSteps";

export default function ShopTour() {
  const { user } = useAuth() || {};
  const location = useLocation();
  // First visit only, on the home page, and never for the owner (she has her own tour).
  const { open, close } = useFirstRunTour({
    name: "shop",
    storageKey: SHOP_TOUR_KEY,
    enabled: location.pathname === "/" && !user?.isAdmin,
    delay: 2500,
  });
  return <Tour steps={shopSteps(user)} open={open} onClose={close} label="Shop tour" />;
}
