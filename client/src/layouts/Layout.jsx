import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-text">
      <Navbar />
      <main className="flex-grow flex flex-col pt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
