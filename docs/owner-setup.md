# Owner setup: Performance, Risk Tools, Transparency Centre and paid plans

Until you finish the steps below, **every feature is open to everyone** and the Plans tab says "Paid plans open soon". Nothing breaks.

## 1. Tell users the truth about markup (Transparency Centre)
Open `src/pages/insights/transparency-config.ts` and set `markupPercent`:
- the markup percentage on your Deriv app registration (for example `1`), or
- `0` if you add none, or
- leave it `null` to say nothing about markup yet.

Check your Deriv app settings first. What the page says must match them.

## 2. Turn on paid plans
1. In Supabase, open **SQL Editor > New query**, paste all of `supabase/billing.sql`, and **Run**.
2. In Supabase **Project Settings > API**, copy the **Project URL** and the **anon public** key. Never use the `service_role` key.
3. In Render, open your service > **Environment** and add:
   - `BILLING_SUPABASE_URL` = the Project URL
   - `BILLING_SUPABASE_ANON_KEY` = the anon public key
4. In `src/pages/insights/plans-config.ts`, fill in `PAYMENT` with your M-Pesa Till or Paybill number (and name). Until you do, customers see "Payments open soon".
5. Change prices in the same file if you want. Redeploy.

## 3. Approve a payment
Customers pay by M-Pesa, then send their phone number and M-Pesa code on the Plans tab.
1. In Supabase **Table Editor**, open `plan_requests` (you can see it there). Find the pending request.
2. Check the payment in your M-Pesa statement (code, amount, phone).
3. In **SQL Editor** run `select public.activate_plan('REQUEST-ID');` to give 30 days (an active plan is extended).
   To refuse: `select public.reject_plan('REQUEST-ID');`

## Good to know
- Plan limits are enforced in the browser. They stop normal use, but a technical person could bypass them. For hard limits, features would need to run on a server.
- A plan is matched to the customer's Deriv account IDs, so one payment covers their real and demo accounts.
- Automatic M-Pesa (STK push) needs a Safaricom Daraja account and a small server function. It is not included.
- Before you charge customers, check Kenyan licensing, Deriv's terms for your app, and data-protection registration (the Plans tab stores account ID, phone and M-Pesa code).
