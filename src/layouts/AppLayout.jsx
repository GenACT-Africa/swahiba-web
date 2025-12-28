import { Outlet } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <TopBar />

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}