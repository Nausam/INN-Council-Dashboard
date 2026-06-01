This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Salary Slips

The Salary Slips page lets employees view and download PDF slips by record card number.

1. **Firestore** (`council-hr-dashboard`): collections `employees` and `salary_slips` with fields `recordCardNumber`, `employeeId`, `periodLabel`, `objectKey`, `fileName`.
2. **Cloudflare R2**: set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`. Correspondence uses `R2_CORRESPONDENCE_BUCKET_NAME`.
3. **Clerk**: set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` for dashboard auth.
4. **Firebase Admin**: set `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIRESTORE_DATABASE_ID=council-hr-dashboard`.

Upload PDFs to R2 (e.g. `slips/{recordCardNumber}/2025-01.pdf`) and register via `POST /api/salary-slips` or the admin upload UI.

### Migrating from Appwrite

```bash
npm run migrate:firestore   # export Appwrite -> Firestore
npm run migrate:files       # Appwrite Storage -> R2 (land rent PDFs)
npm run migrate:clerk       # Appwrite users -> Clerk
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
