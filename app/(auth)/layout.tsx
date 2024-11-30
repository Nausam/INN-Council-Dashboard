import Image from "next/image";
import React from "react";

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen">
      <section className="bg-cyan-600 p-10 hiddem w-1/2 items-center justify-center lg:flex xl:w-2/5">
        <div className="flex max-h-[800px] max-w-[430px] flex-col justify-center items-center space-y-12">
          <Image
            src="/assets/icons/logo.png"
            alt="logo"
            width={224}
            height={224}
          />

          <div className="flex flex-col items-center justify-centerspace-y-5 text-white gap-5">
            <h1 className="text-4xl font-extrabold">Innamaadhoo Council</h1>
            <p className="text-xl font-light">
              Welcome to Innamaadhoo Council Dashboard
            </p>
          </div>

          <Image
            src="/assets/images/files.png"
            alt="files"
            width={324}
            height={324}
            className="transition-all hover:rotate-2 hover:scale-105"
          />
        </div>
      </section>

      <section className="flex flex-1 flex-col items-center bg-white p-4 py-10 lg:justify-center lg:p-10 lg:py-0">
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
