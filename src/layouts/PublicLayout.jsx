import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <>
      <TopBar />
      <Outlet />
      <Footer />
    </>
  );
}