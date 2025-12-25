# PayPal Anonymous Payment Setup Guide

## Problem
PayPal.me links show your personal username, which may not be professional or anonymous.

## Solution: PayPal Hosted Buttons (Recommended)

### Step 1: Create PayPal Hosted Buttons

1. **Log in to PayPal** → Go to Dashboard
2. **Navigate**: Tools → PayPal Buttons → Create Button
3. **Button Type**: 
   - For Monthly: Choose "Subscription" (recurring)
   - For Annual: Choose "Subscription" (recurring)
4. **Configure**:
   - **Button Name**: "ScoutLens Pro Monthly" / "ScoutLens Pro Annual"
   - **Price**: $9.99 / $79.00
   - **Billing Cycle**: Monthly / Yearly
   - **Currency**: USD
5. **Save** and copy the **Hosted Button ID**

### Step 2: Update app.js

Replace in `app.js` (line ~1120):

```javascript
const PAYPAL_MONTHLY_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YOUR_MONTHLY_ID';
const PAYPAL_ANNUAL_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YOUR_ANNUAL_ID';

const USE_PAYPAL_BUTTONS = true; // Change to true
```

### Benefits:
- ✅ No username visible
- ✅ Professional appearance
- ✅ Customizable button text
- ✅ Automatic recurring billing
- ✅ PayPal handles all payment processing

---

## Alternative: PayPal Business Account

If you prefer PayPal.me links:

1. **Convert to Business Account**:
   - PayPal Dashboard → Settings → Account Type
   - Upgrade to Business Account (free)

2. **Set Business Display Name**:
   - Settings → Business Information
   - Change "Business Display Name" to "ScoutLens Pro"

3. **Update Link**:
   ```javascript
   const PAYPAL_BUSINESS_NAME = 'ScoutLensPro';
   const PAYPAL_MONTHLY_ME = `https://paypal.me/${PAYPAL_BUSINESS_NAME}/9.99`;
   ```

---

## Testing

1. Use PayPal Sandbox for testing
2. Test both monthly and annual subscriptions
3. Verify payment flow works correctly
4. Check that no personal info is visible

---

## Current Status

- ✅ Code updated to support PayPal Hosted Buttons
- ⏳ Waiting for you to create buttons and add IDs
- ⏳ Set `USE_PAYPAL_BUTTONS = true` after setup

