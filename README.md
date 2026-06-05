# 🚕 Uber Supplier Agent & Driver Change Tracker (উবার সাপ্লায়ার এজেন্ট)

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![React](https://img.shields.io/badge/React-19.0-blue.svg)
![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)
![Firebase](https://img.shields.io/badge/Firebase-12.0-yellow.svg)
![Playwright](https://img.shields.io/badge/Playwright-Automated-green.svg)

*(Please scroll down for the English version)*

---

# 🇧🇩 বাংলা ভার্সন (Bengali Version)

**Uber Supplier Agent** হলো উবার ফ্লিট ম্যানেজার (Fleet Managers) এবং সাপ্লায়ার পার্টনারদের জন্য তৈরি একটি সম্পূর্ণ অটোমেটেড ফুল-স্ট্যাক ড্যাশবোর্ড। এই প্রজেক্টের মূল উদ্দেশ্য হলো `supplier.uber.com` পোর্টাল থেকে ড্রাইভারদের যাবতীয় ডেটা অটোমেটিকালি সংগ্রহ করা, ট্র্যাক করা এবং তা বিশ্লেষণ করে ম্যানেজারদের সিদ্ধান্ত নিতে সাহায্য করা।

---

## 🌟 বিস্তারিত ফিচারসমূহ (Comprehensive Features)

### ১. 🔄 অটোমেটেড ডেটা সিঙ্ক্রোনাইজেশন (Automated Data Sync)
- **Live Headless Browser Scraping:** প্রজেক্টটির ব্যাকএন্ডে **Playwright** এবং **Chromium** ব্রাউজার ব্যবহার করা হয়েছে। আপনি যখন সিঙ্ক শুরু করেন, তখন ব্যাকএন্ড সম্পূর্ণ অদৃশ্যভাবে উবার পোর্টালে লগইন করে এবং একটির পর একটি পেজ পরিবর্তন করে ড্রাইভারদের তথ্য এক্সট্রাক্ট করে।
- **Manual DOM Parsing:** কখনো উবার এর সার্ভারে সমস্যা থাকলে, আপনি সরাসরি উবারের ওয়েবসাইট থেকে HTML কপি করে পেস্ট করতে পারেন। আমাদের সিস্টেম মুহূর্তের মধ্যে সেই HTML থেকে শত শত ড্রাইভারের ডেটা বের করে আনবে।
- **Change Detection Engine:** যদি কোনো ড্রাইভার তার ইমেইল বা ফোন নম্বর পরিবর্তন করে, ড্যাশবোর্ডে নতুন নম্বরটি আপডেট হয়ে যাবে এবং পুরনো নম্বরটি "Historical Record" হিসেবে সংরক্ষিত থাকবে।

### ২. 👥 মাল্টি-ট্যানেন্ট আইসোলেশন এবং নিরাপত্তা (Multi-tenant Security & Auth)
- **Google Authentication:** প্রজেক্টটি Firebase Auth দ্বারা সুরক্ষিত। যেকেউ তার গুগল অ্যাকাউন্ট দিয়ে লগইন করতে পারবে।
- **Data Privacy:** একাধিক ফ্লিট ম্যানেজার একই অ্যাপ ব্যবহার করতে পারবেন। তবে এক ম্যানেজারের ডেটা অন্যজন কখনোই দেখতে পাবেন না। প্রতিটি ইউজারের ডেটা ডাটাবেজে আলাদা সাব-কালেকশনে সেভ করা হয়।

### ৩. 🎯 রিওয়ার্ড এবং মাইলস্টোন ট্র্যাকিং (Reward Tracking)
- **Trip Milestones:** আপনি প্রতিটি ড্রাইভারের জন্য একটি টার্গেট বা রিওয়ার্ড সাইকেল (যেমন: ৫২ ট্রিপে ১টি গিফট) সেট করতে পারেন।
- **F10 & F50 Tracking:** যেসব ড্রাইভার ১০টি বা ৫০টি ট্রিপ সম্পন্ন করেছে, তাদের তালিকা আলাদাভাবে দেখা যায়।

---

## 📖 ইউজার গাইড (কীভাবে ব্যবহার করবেন)

এই অ্যাপের কোন ফিচারটি কীভাবে ব্যবহার করতে হয় তার একটি পূর্ণাঙ্গ গাইড নিচে দেওয়া হলো:

### ১. অটোমেটিক লাইভ সিঙ্ক (Live Sync)
- **কী করবেন:** ড্যাশবোর্ডের উপরে **"Start Live Sync"** বাটনে ক্লিক করুন। 
- **কীভাবে কাজ করে:** ক্লিক করার পর একটি পপ-আপ আসবে। সেখানে আপনার উবার সাপ্লায়ার পোর্টালের Email, Password এবং Org ID দিন। এরপর কতোগুলো পেজ স্ক্র্যাপ করবেন তা ঠিক করে Start এ ক্লিক করুন। ব্যাকএন্ডে অদৃশ্য ব্রাউজার ওপেন হয়ে সব ডেটা আপনার ড্যাশবোর্ডে এনে দিবে।

### ২. ম্যানুয়াল HTML ইম্পোর্ট (Manual Sync)
- **কখন করবেন:** যদি লাইভ সিঙ্ক কাজ না করে বা উবার পোর্টালে 2FA (লগইন কোড) চায়, তখন এটি ব্যবহার করবেন।
- **কীভাবে করবেন:** 
  1. আপনার ব্রাউজার থেকে `supplier.uber.com` এ লগইন করুন এবং Drivers পেজে যান।
  2. কীবোর্ডের `Ctrl + U` (বা Right Click > View Page Source) চেপে পেজের HTML কোড কপি করুন।
  3. আমাদের অ্যাপের উপরের **"Import HTML"** বাটনে ক্লিক করে কোডগুলো বক্সে পেস্ট করুন এবং Sync বাটনে ক্লিক করুন। সাথে সাথেই সব ডেটা টেবিলে চলে আসবে।

### ৩. F10 & F50 রিওয়ার্ড ট্র্যাকিং (Rewards Management)
- **কীভাবে দেখবেন:** ড্যাশবোর্ডের বাম পাশে **"Completed F10"** বা **"Completed F50"** ফিল্টার বাটনে ক্লিক করুন।
- **"Done" বাটনের ব্যবহার:** যে ড্রাইভারদের ট্রিপ ১০ বা ৫০ পার হয়েছে, তাদের নামের পাশে একটি **"Done"** বাটন আসবে। ড্রাইভারকে তার পুরস্কার বা পেমেন্ট বুঝিয়ে দেওয়ার পর এই **Done** বাটনে ক্লিক করুন। এতে ড্রাইভারটি রিওয়ার্ড লিস্ট থেকে সরে যাবে।

### ৪. বাল্ক ডিলিট এবং রিসেট (Bulk Operations)
- **কী করবেন:** ড্যাশবোর্ডের উপরে **"Select"** বাটনে ক্লিক করুন অথবা টেবিলের বাম পাশের চেকবক্সগুলোতে টিক দিন।
- **কীভাবে করবেন:** একাধিক ড্রাইভার সিলেক্ট করার পর উপরের ডানদিকে **"Actions"** মেনু পাবেন। সেখান থেকে আপনি চাইলে সবাইকে একসাথে **Permanent Delete** করতে পারবেন অথবা সবার **Rewards Reset** করে জিরো করে দিতে পারবেন।

### ৫. সিমুলেটর মোড (Simulator Sandbox)
- **কীভাবে করবেন:** উপরের ডানদিকের সেটিংস আইকনে (⚙️) ক্লিক করে **"Sandbox/Simulator Mode"** চালু করুন। 
- **কীভাবে কাজ করে:** এটি চালু করলে আপনার আসল ডাটাবেজ সুরক্ষিত থাকবে। আপনি চাইলে ফেক (Fake) ডেটা তৈরি করে অ্যাপের যেকোনো ফিচার (যেমন ডিলিট বা সিঙ্ক) টেস্ট করে দেখতে পারবেন। 

---

## 🏗️ ব্যবহৃত টেকনোলজি (Technology Stack)

**ফ্রন্টএন্ড:** React 19, Vite, TailwindCSS v4, TypeScript.  
**ব্যাকএন্ড:** Node.js, Express.js, Playwright.  
**ডাটাবেজ:** Firebase Firestore, Firebase Auth.

---

## 🚀 কীভাবে রান করবেন (Installation & Setup)

**ধাপ ১: ডিপেনডেন্সি ইন্সটল করা**
```bash
npm install
npx playwright install chromium
```

**ধাপ ২: Environment Variables**
রুট ফোল্ডারে `.env` ফাইল তৈরি করে নিচের লাইনটি বসান:
```env
ENCRYPTION_KEY="your_secure_32_character_long_secret"
```

**ধাপ ৩: প্রজেক্ট রান করা**
```bash
npm run dev
```

---

<br><br>

---
---

# 🇬🇧 English Version

**Uber Supplier Agent** is a full-stack automation console and dashboard designed specifically for Uber Fleet Managers and Supplier Partners. It automates the extraction, synchronization, and historical tracking of driver data directly from the `supplier.uber.com` portal.

---

## 🌟 Comprehensive Features

### 1. 🔄 Automated Data Synchronization
- **Live Headless Browser Scraping:** Powered by **Playwright** and **Chromium**, the backend spins up an invisible browser, logs into the Uber portal, and scrapes driver data silently.
- **Manual DOM Parsing:** Users can simply copy the raw HTML from the Uber portal and paste it into the app to parse hundreds of drivers instantly.
- **Change Detection Engine:** The system intelligently monitors if a driver changes their Phone Number or Email Address, keeping the old data in a "Historical Log".

### 2. 👥 Multi-tenant Isolation & Authentication
- **Secure Google Login:** Powered by Firebase Authentication.
- **Strict Data Privacy:** The database stores data scoped strictly to the user's ID: `users/{uid}/drivers/{uuid}`.

---

## 📖 User Guide (How to Use Features)

Here is a comprehensive guide on how to interact with the core features of the app:

### 1. Live Sync (Automated Scraping)
- **What it does:** Automatically logs into Uber and extracts your driver data.
- **How to use:** Click the **"Start Live Sync"** button on the top menu. Enter your Uber Supplier Email, Password, and Org ID. Select how many pages you want to scrape, then click Start. The backend will invisible navigate the portal and populate your dashboard.

### 2. Manual HTML Import (Fallback Sync)
- **When to use:** Use this if Live Sync fails due to Uber's 2FA (Login codes) or server issues.
- **How to use:** 
  1. Log into `supplier.uber.com` manually in your browser.
  2. Go to the Drivers page, right-click, and select **View Page Source** (or press `Ctrl+U`).
  3. Copy the entire HTML, click **"Import HTML"** in our app, paste the code into the text box, and click **Sync**.

### 3. F10 & F50 Reward Tracking
- **What it does:** Tracks drivers who have reached critical milestones (10 or 50 trips).
- **How to use:** Click on the **"Completed F10"** or **"Completed F50"** filter tags on the left sidebar. You will see a list of eligible drivers. Once you hand over their reward, click the **"Done"** button next to their name to remove them from the pending rewards queue.

### 4. Bulk Delete & Reset Actions
- **What it does:** Allows applying actions to multiple drivers simultaneously.
- **How to use:** Click the **"Select"** button to enable checkboxes on the table rows. Select multiple drivers. An **"Actions"** dropdown will appear at the top right, allowing you to either **Permanently Delete** them or **Reset Rewards** to zero.

### 5. Simulator Mode (Sandbox)
- **What it does:** Creates a safe testing environment without touching your real Firebase database.
- **How to use:** Click the **Settings (⚙️)** icon on the top right, and toggle on **"Sandbox/Simulator Mode"**. You can now inject fake drivers and test out deletions or rewards tracking safely.

---

## 🏗️ Technology Stack

**Frontend:** React 19, Vite, TailwindCSS v4, TypeScript.  
**Backend:** Node.js, Express.js, Playwright.  
**Database:** Firebase Firestore, Firebase Auth.

---

## 🚀 Installation & Setup

### Step 1: Install Dependencies
```bash
npm install
npx playwright install chromium
```

### Step 2: Environment Variables
Create a `.env` file in the root directory:
```env
ENCRYPTION_KEY="your_secure_32_character_long_secret"
```

### Step 3: Start Development Server
```bash
npm run dev
```

---

## 🔐 Firebase Security Rules
Deploy these rules in your Firebase Firestore console:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
