import Image from "next/image";
import React from "react";

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex w-full max-w-7xl min-h-screen mx-auto">
      {/* Blue Section */}
      <section className="bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-600 p-10 hidden w-1/2 items-center justify-center lg:flex xl:w-2/5 shadow-lg">
        <div className="flex max-h-[800px] max-w-[430px] flex-col justify-center items-center space-y-12 text-center">
          {/* Animated Logo */}
          <div className="flex items-center justify-center w-44 h-44 bg-white rounded-full shadow-lg transform ">
            <Image
              src="/assets/icons/logo.png"
              alt="logo"
              fill
              className="object-contain p-2"
            />
          </div>

          {/* Text Content */}
          <div className="flex flex-col items-center justify-center space-y-5 text-white">
            <h1 className="text-4xl font-extrabold tracking-wide drop-shadow-lg">
              Innamaadhoo Council
            </h1>
            <p className="text-mdl font-light max-w-sm leading-relaxed">
              Welcome to the official Innamaadhoo Council Dashboard. Streamline
              your workflow and get insights effortlessly.
            </p>
          </div>

          {/* Hoverable Image */}
          <Image
            src="/assets/images/files.png"
            alt="files"
            width={324}
            height={324}
            className="transition-all hover:rotate-2 hover:scale-105 drop-shadow-lg"
          />
        </div>
      </section>

      {/* White Section */}
      <section className="flex flex-1 flex-col items-center bg-white p-4 py-10 lg:justify-center lg:p-10 lg:py-0">
        {/* Logo for smaller screens */}
        <div className="mb-16 lg:hidden">
          <Image
            src="/assets/icons/logo.png"
            alt="logo"
            width={224}
            height={82}
            className="h-auto w-[200px] lg:w-[250px]"
          />
        </div>
        {children}
      </section>
    </div>
  );
};

export default layout;
