"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Navbar = () => {
  const pathname = usePathname();

  // Define the navigation links
  const navigation = [
    { name: "Dashboard", href: "/" },
    { name: "Employees", href: "/employees" },
    { name: "Attendance", href: "/attendance" },
    { name: "Reports", href: "/reports" },
  ];

  return (
    <nav className="border-b p-4 sticky top-0 bg-white/70 backdrop-blur-sm z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image
              src="/assets/icons/logo.png"
              alt="logo"
              width={75}
              height={75}
            />
          </Link>
          {/* <p className="text-black font-bold text-md">Innamaadhoo Council</p> */}
        </div>

        {/* Navigation Links */}
        <div className="space-x-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-black px-3 py-2 rounded-sm text-sm font-medium"
            >
              <span
                className={`${
                  pathname === item.href
                    ? "bg-cyan-700 text-white" // Highlight the active page
                    : "hover:bg-gray-200 hover:text-black"
                } px-2 py-1 rounded-sm`}
              >
                {item.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
