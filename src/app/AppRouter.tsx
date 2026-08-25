import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export default function AppRouter() {
  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}
