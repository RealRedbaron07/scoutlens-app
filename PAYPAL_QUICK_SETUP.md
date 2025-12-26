# 💰 PayPal Quick Setup

**Status:** ✅ PayPal is already configured as your payment method!

---

## 🎯 WHAT YOU NEED TO DO

You have **2 options** - choose one:

---

## ⚡ OPTION 1: Use PayPal.me (1 minute - Easiest)

**What it does:** Uses your PayPal.me link. Works immediately!

### Step 1: Get Your PayPal.me Username
1. Go to [paypal.com](https://paypal.com) → Log in
2. Go to **Settings** → **PayPal.Me**
3. Your link: `https://paypal.me/YOURUSERNAME`
4. **Copy your username** (the part after `/paypal.me/`)

### Step 2: Update app.js
Open `app.js` and find line **1521**:
```javascript
const PAYPAL_BUSINESS_NAME = 'ScoutLensPro';
```

**Replace `'ScoutLensPro'` with your actual PayPal username:**
```javascript
const PAYPAL_BUSINESS_NAME = 'your-actual-paypal-username';
```

**Example:** If your PayPal.me is `https://paypal.me/johnsmith`, use:
```javascript
const PAYPAL_BUSINESS_NAME = 'johnsmith';
```

### Step 3: Done!
- Save the file
- Deploy
- Payments will go to your PayPal! 💰

**Note:** This shows your name, but works immediately.

---

## 🎯 OPTION 2: PayPal Hosted Buttons (10 minutes - Professional)

**What it does:** Anonymous, professional, no personal name shown.

### Step 1: Create Buttons in PayPal
1. Go to [paypal.com](https://paypal.com) → Log in
2. Click **Tools** → **PayPal Buttons**
3. **Create Monthly Button:**
   - Type: **Subscription**
   - Name: `ScoutLens Pro Monthly`
   - Price: `9.99`
   - Billing: **Monthly**
   - Copy the `hosted_button_id` (looks like `ABC123XYZ`)
4. **Create Annual Button:**
   - Type: **Subscription**
   - Name: `ScoutLens Pro Annual`
   - Price: `72.00`
   - Billing: **Yearly**
   - Copy the `hosted_button_id`

### Step 2: Update app.js
Find lines **1515-1516**:
```javascript
const PAYPAL_MONTHLY_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=PASTE_MONTHLY_ID_HERE';
const PAYPAL_ANNUAL_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=PASTE_ANNUAL_ID_HERE';
```

Replace with your button IDs:
```javascript
const PAYPAL_MONTHLY_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YOUR_MONTHLY_ID';
const PAYPAL_ANNUAL_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YOUR_ANNUAL_ID';
```

Then find line **1527** and change:
```javascript
let USE_PAYPAL_BUTTONS = true; // ✅ Enable hosted buttons
```

### Step 3: Done!
- Save the file
- Deploy
- Payments are anonymous and professional! 💰

---

## ✅ WHICH ONE?

**Use PayPal.me if:**
- ✅ You want to start NOW (1 minute)
- ✅ You don't mind your name showing
- ✅ You want the simplest setup

**Use Hosted Buttons if:**
- ✅ You want anonymity
- ✅ You want professional look
- ✅ You have 10 minutes

---

## 🧪 TEST IT

1. Click "Upgrade to Pro" in your app
2. Click a payment link
3. Should redirect to PayPal
4. Test with a small amount first!

---

## 📊 CHECK PAYMENTS

1. Go to [paypal.com](https://paypal.com)
2. Click **Activity** or **Summary**
3. See all payments
4. Filter by "Subscriptions" for recurring payments

---

**That's it! PayPal is ready. Just update your username or button IDs. 💰**

