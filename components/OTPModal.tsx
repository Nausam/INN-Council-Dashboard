"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { verifySecret, sendEmailOTP } from "@/lib/actions/user.actions";
import { useRouter } from "next/navigation";

const OtpModal = ({
  accountId,
  email,
}: {
  accountId: string;
  email: string;
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsLoading(true);

    console.log({ accountId, password });

    try {
      const sessionId = await verifySecret({ accountId, password });

      console.log({ sessionId });

      if (sessionId) router.push("/");
    } catch (error) {
      console.log("Failed to verify OTP", error);
    }

    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    await sendEmailOTP({ email });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md flex flex-col items-center justify-center">
        <AlertDialogHeader className="flex flex-col items-center justify-center mb-6">
          <AlertDialogTitle className="text-xl font-semibold text-gray-800 text-center">
            Enter Your OTP
          </AlertDialogTitle>
          <Image
            src="/assets/icons/close-dark.svg"
            alt="close"
            width={20}
            height={20}
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 cursor-pointer"
          />
          <AlertDialogDescription className="text-sm text-gray-600 mt-2 text-center">
            We&apos;ve sent a code to{" "}
            <span className="font-medium text-cyan-500">{email}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <InputOTP maxLength={6} value={password} onChange={setPassword}>
          <InputOTPGroup className="flex justify-center gap-4 mt-4">
            <InputOTPSlot
              index={0}
              className="w-12 h-12 bg-gray-50 text-center text-xl font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <InputOTPSlot
              index={1}
              className="w-12 h-12 bg-gray-50 text-center text-xl font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <InputOTPSlot
              index={2}
              className="w-12 h-12 bg-gray-50 text-center text-xl font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <InputOTPSlot
              index={3}
              className="w-12 h-12 bg-gray-50 text-center text-xl font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <InputOTPSlot
              index={4}
              className="w-12 h-12 bg-gray-50 text-center text-xl font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <InputOTPSlot
              index={5}
              className="w-12 h-12 bg-gray-50 text-center text-xl font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </InputOTPGroup>
        </InputOTP>

        <AlertDialogFooter className="mt-6 w-full flex flex-col items-center gap-4">
          <AlertDialogAction
            onClick={handleSubmit}
            className="w-full bg-cyan-500 text-white text-lg font-medium py-6 rounded-full hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            type="button"
          >
            Submit
            {isLoading && (
              <Image
                src="/assets/icons/loader.svg"
                alt="loader"
                width={24}
                height={24}
                className="ml-2 animate-spin"
              />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
        <div className="text-center text-sm text-gray-600">
          Didn&apos;t get a code?{" "}
          <Button
            type="button"
            variant="link"
            className="text-cyan-500 hover:underline"
            onClick={handleResendOtp}
          >
            Click to resend
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OtpModal;
