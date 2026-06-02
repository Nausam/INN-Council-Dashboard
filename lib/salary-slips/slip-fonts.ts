import { Carlito } from "next/font/google";
import localFont from "next/font/local";

/** Dhivehi — Faruma.ttf from /public/fonts (council payslip standard). */
export const slipFaruma = localFont({
  src: "../../public/fonts/Faruma.ttf",
  variable: "--font-slip-dhivehi",
  display: "swap",
  weight: "400",
  style: "normal",
});

/**
 * English — Carlito (metric-compatible with Calibri, common on official slips).
 */
export const slipCarlito = Carlito({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-slip-latin",
  display: "swap",
});

export const salarySlipFontClassName = `${slipCarlito.variable} ${slipFaruma.variable}`;
