import type { Appearance } from "@clerk/types";

import { councilBrand } from "@/lib/design-tokens";

/** @deprecated Use councilBrand from @/lib/design-tokens */
export const authBrand = councilBrand;

export const councilClerkAppearance: Appearance = {
  variables: {
    colorPrimary: councilBrand.primary,
    colorText: councilBrand.foreground,
    colorTextSecondary: councilBrand.textSecondary,
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#0f172a",
    colorDanger: "#e11d48",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
    fontSize: "0.9375rem",
  },
  layout: {
    logoPlacement: "none",
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
    showOptionalFields: false,
  },
  elements: {
    rootBox: "w-full mx-auto",
    cardBox: "w-full shadow-none",
    card: "shadow-none border-0 bg-transparent p-0 gap-5 w-full",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    main: "gap-5 overflow-visible",
    socialButtons: "overflow-visible pt-2 !overflow-visible",
    socialButtonsBlockButton:
      "h-12 w-full max-w-full box-border rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-teal-300 hover:bg-teal-50/60 transition-all",
    socialButtonsBlockButtonText: "font-medium text-slate-700",
    dividerLine: "bg-slate-100",
    dividerText: "text-slate-400 text-xs font-medium",
    formFieldLabel: "text-sm font-medium text-slate-700",
    formFieldInput:
      "h-12 rounded-xl border-slate-200 bg-slate-50/60 text-slate-900 shadow-sm focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20",
    formButtonPrimary:
      "h-12 w-full max-w-full box-border rounded-xl bg-teal-600 text-sm font-semibold normal-case shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-colors",
    formButtonReset: "text-teal-700 hover:text-teal-900",
    footer: "hidden",
    footerAction: "hidden",
    identityPreview: "rounded-lg border border-slate-200 bg-slate-50",
    identityPreviewText: "text-slate-800 font-medium",
    identityPreviewEditButton: "text-teal-700",
    formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-600",
    otpCodeFieldInput: "rounded-lg border-slate-200",
    alertText: "text-sm",
    formResendCodeLink: "text-teal-700 font-medium",
    devBar: "hidden",
  },
};
