"use client";

/**
 * @file components/dashboard/CandidateProfileForm.tsx
 * @description Candidate Profile & KYC Form.
 * Allows candidates to update contact details, reservation eligibility category,
 * domicile address, language preferences, and verify mobile OTP.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React, { useState, useTransition } from "react";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Globe,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
  Save,
} from "lucide-react";
import {
  updateCandidateProfileAction,
  sendContactOtpAction,
  verifyContactOtpAction,
} from "@/app/dashboard/actions";
import type { AccountSettingsInput } from "@/lib/schemas/candidate-workspace";

interface CandidateProfileProps {
  initialEmail: string;
  initialFullName: string;
  initialProfile: {
    first_name?: string | null;
    last_name?: string | null;
    alternate_email?: string | null;
    phone?: string | null;
    is_phone_verified?: boolean | null;
    alternate_phone?: string | null;
    gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
    date_of_birth?: string | null;
    category?: string | null;
    address_line?: string | null;
    state?: string | null;
    district?: string | null;
    pincode?: string | null;
    language_preference?: string | null;
  } | null;
}

const INDIAN_STATES = [
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Andhra Pradesh",
  "Telangana",
  "Kerala",
  "Delhi (NCT)",
  "Uttar Pradesh",
  "Bihar",
  "Rajasthan",
  "Madhya Pradesh",
  "West Bengal",
  "Gujarat",
  "Punjab",
  "Haryana",
  "Odisha",
  "Assam",
  "Jharkhand",
  "Chhattisgarh",
  "Uttarakhand",
  "Himachal Pradesh",
  "Goa",
  "Jammu and Kashmir",
  "All India / Central",
];

const RESERVATION_CATEGORIES = [
  "General",
  "EWS (Economically Weaker Section)",
  "OBC (Other Backward Classes)",
  "OBC - Non Creamy Layer",
  "SC (Scheduled Caste)",
  "ST (Scheduled Tribe)",
  "PwD (Persons with Benchmark Disabilities)",
  "Ex-Servicemen",
];

export default function CandidateProfileForm({
  initialEmail,
  initialFullName,
  initialProfile,
}: CandidateProfileProps) {
  const [formData, setFormData] = useState<AccountSettingsInput>({
    firstName: initialProfile?.first_name || initialFullName.split(" ")[0] || "",
    lastName: initialProfile?.last_name || initialFullName.split(" ").slice(1).join(" ") || "",
    alternateEmail: initialProfile?.alternate_email || "",
    phone: initialProfile?.phone || "",
    alternatePhone: initialProfile?.alternate_phone || "",
    gender: (initialProfile?.gender as any) || "prefer_not_to_say",
    dateOfBirth: initialProfile?.date_of_birth || "",
    category: initialProfile?.category || "General",
    addressLine: initialProfile?.address_line || "",
    state: initialProfile?.state || "Karnataka",
    district: initialProfile?.district || "",
    pincode: initialProfile?.pincode || "",
    languagePreference: (initialProfile?.language_preference as any) || "en",
  });

  const [isPhoneVerified, setIsPhoneVerified] = useState(
    Boolean(initialProfile?.is_phone_verified)
  );

  // OTP Verification state
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpStatusMsg, setOtpStatusMsg] = useState<string | null>(null);
  const [otpErrorMsg, setOtpErrorMsg] = useState<string | null>(null);

  const [saveStatusMsg, setSaveStatusMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaveStatusMsg(null);
    setSaveErrorMsg(null);
  };

  const handleSendOtp = () => {
    if (!formData.phone || !/^[6-9]\d{9}$/.test(formData.phone)) {
      setOtpErrorMsg("Please enter a valid 10-digit Indian mobile number");
      return;
    }
    setOtpErrorMsg(null);
    startTransition(async () => {
      const res = await sendContactOtpAction(formData.phone!);
      if (res.success) {
        setIsOtpSent(true);
        setOtpStatusMsg(res.message || "OTP code sent!");
      } else {
        setOtpErrorMsg(res.error || "Failed to send OTP");
      }
    });
  };

  const handleVerifyOtp = () => {
    if (!otpCode || otpCode.length < 4) {
      setOtpErrorMsg("Enter 6-digit OTP");
      return;
    }
    setOtpErrorMsg(null);
    startTransition(async () => {
      const res = await verifyContactOtpAction(formData.phone!, otpCode);
      if (res.success) {
        setIsPhoneVerified(true);
        setIsOtpSent(false);
        setOtpStatusMsg("Mobile number verified successfully!");
      } else {
        setOtpErrorMsg(res.error || "Invalid OTP");
      }
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatusMsg(null);
    setSaveErrorMsg(null);

    startTransition(async () => {
      const res = await updateCandidateProfileAction(formData);
      if (res.success) {
        setSaveStatusMsg("Candidate profile and KYC updated successfully!");
      } else {
        setSaveErrorMsg(res.error || "Failed to save profile");
      }
    });
  };

  return (
    <form onSubmit={handleSaveProfile} className="space-y-6">
      {saveStatusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveStatusMsg}</span>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {/* Section 1: Basic & Identity */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <User className="w-5 h-5 text-blue-600" /> Legal Identity & Demographics
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Legal name and date of birth are cross-referenced with official matriculation certificates for age eligibility.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              First Name *
            </label>
            <input
              type="text"
              required
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName || ""}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Date of Birth (YYYY-MM-DD)
            </label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth || ""}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Gender
            </label>
            <select
              name="gender"
              value={formData.gender || "prefer_not_to_say"}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            >
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reservation Category
            </label>
            <select
              name="category"
              value={formData.category || "General"}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            >
              {RESERVATION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Language Preference
            </label>
            <select
              name="languagePreference"
              value={formData.languagePreference}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            >
              <option value="en">English (Default)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Contact & OTP Verification */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <Phone className="w-5 h-5 text-blue-600" /> Contact Channels & OTP Verification
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Verified numbers receive time-sensitive deadline alerts and hall ticket release pings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Primary Account Email (Read-only)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled
                value={initialEmail}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alternate Recovery Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="alternateEmail"
                placeholder="optional@gmail.com"
                value={formData.alternateEmail || ""}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Mobile Number & Verification Row */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mobile Number (India +91)
                </label>
                {isPhoneVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                    Pending Verification
                  </span>
                )}
              </div>
              <input
                type="tel"
                name="phone"
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={formData.phone || ""}
                onChange={(e) => {
                  handleInputChange(e);
                  if (isPhoneVerified) setIsPhoneVerified(false);
                }}
                className="w-full max-w-sm px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            {!isPhoneVerified && (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition self-start sm:self-end"
              >
                <Send className="w-3.5 h-3.5" /> Send OTP
              </button>
            )}
          </div>

          {/* OTP Input Subform */}
          {isOtpSent && !isPhoneVerified && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-36 px-3 py-1.5 text-center tracking-widest text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isPending}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Verify
              </button>
            </div>
          )}

          {otpStatusMsg && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{otpStatusMsg}</p>
          )}
          {otpErrorMsg && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">{otpErrorMsg}</p>
          )}
        </div>
      </div>

      {/* Section 3: Domicile Address */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <MapPin className="w-5 h-5 text-blue-600" /> Domicile & Location
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Ensures candidate priority for state public service commissions (e.g. KPSC, MPSC, TNPSC).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              State / Union Territory
            </label>
            <select
              name="state"
              value={formData.state || "Karnataka"}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              District
            </label>
            <input
              type="text"
              name="district"
              placeholder="e.g. Bengaluru Urban"
              value={formData.district || ""}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              PIN Code
            </label>
            <input
              type="text"
              maxLength={6}
              name="pincode"
              placeholder="e.g. 560001"
              value={formData.pincode || ""}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {isPending ? "Saving Profile..." : "Save Profile Details"}
        </button>
      </div>
    </form>
  );
}
