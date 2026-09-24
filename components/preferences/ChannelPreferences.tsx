/**
 * @file components/preferences/ChannelPreferences.tsx
 * @module ChannelPreferences
 * @description Multi-channel push alert configuration component. Provides toggle controls
 * for Web Push, Telegram, WhatsApp, and Email digests with endpoint configuration fields.
 * 
 * Task ID: TASK-05010101 (Subtask: SUB-0501010102)
 * Architecture Reference: ADR-001 (Frontend Component), ADR-007 (Omnichannel Alert Engine)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - WCAG-accessible form controls with associated labels and helper texts
 * - Dynamic contact input reveals based on active channels
 * - Seamless integration with Next.js 15 Server Actions
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Send,
  MessageSquare,
  Mail,
  Info,
  Smartphone,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import type { NotificationChannel, ChannelMetadata } from "@/types/subscriptions";
import {
  getTelegramConnectLinkAction,
  disconnectTelegramAction,
} from "@/app/preferences/actions";

const CHANNELS_CONFIG: ChannelMetadata[] = [
  {
    id: "web_push",
    label: "Browser Web Push Notifications",
    description: "Instant browser notifications on desktop and mobile as soon as notifications are published.",
    badgeText: "Recommended",
    iconName: "bell",
  },
  {
    id: "email",
    label: "Email Alerts & Daily Digest",
    description: "Curated notification digests and critical application deadline reminders sent to your registered email.",
    badgeText: "Reliable",
    iconName: "mail",
  },
  {
    id: "telegram",
    label: "Telegram Bot Direct Alerts",
    description: "Instant markdown alerts with official PDF download links delivered directly to your Telegram chat.",
    badgeText: "Fastest",
    iconName: "telegram",
    requiresExtraInput: "telegramChatId",
    inputPlaceholder: "e.g. 123456789 or @username",
    inputHelpText: "Start @UpaguruBot on Telegram and type /start to view your Chat ID.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Priority Alerts",
    description: "High-priority deadline reminders and last-chance application notifications directly on WhatsApp.",
    badgeText: "High Priority",
    iconName: "whatsapp",
    requiresExtraInput: "whatsappPhoneNumber",
    inputPlaceholder: "e.g. 9876543210",
    inputHelpText: "Enter your 10-digit mobile number with WhatsApp active.",
  },
];

interface ChannelPreferencesProps {
  preferredChannels: NotificationChannel[];
  onChannelsChange: (channels: NotificationChannel[]) => void;
  telegramChatId: string;
  onTelegramChatIdChange: (val: string) => void;
  whatsappPhoneNumber: string;
  onWhatsappPhoneNumberChange: (val: string) => void;
  errors?: Record<string, string[]>;
}

export default function ChannelPreferences({
  preferredChannels,
  onChannelsChange,
  telegramChatId,
  onTelegramChatIdChange,
  whatsappPhoneNumber,
  onWhatsappPhoneNumberChange,
  errors = {},
}: ChannelPreferencesProps) {
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    getTelegramConnectLinkAction().then((res) => {
      if (res.success && res.connectUrl) {
        setConnectUrl(res.connectUrl);
        if (res.chatId && !telegramChatId) {
          onTelegramChatIdChange(res.chatId);
        }
      }
    });
  }, []);

  const handleDisconnectTelegram = async () => {
    setIsDisconnecting(true);
    await disconnectTelegramAction();
    onTelegramChatIdChange("");
    setIsDisconnecting(false);
  };

  const toggleChannel = (channelId: NotificationChannel) => {
    if (preferredChannels.includes(channelId)) {
      // Must maintain at least one channel
      if (preferredChannels.length === 1) return;
      onChannelsChange(preferredChannels.filter((c) => c !== channelId));
    } else {
      onChannelsChange([...preferredChannels, channelId]);
    }
  };

  const renderIcon = (channelId: NotificationChannel) => {
    switch (channelId) {
      case "web_push":
        return <Bell className="w-5 h-5 text-indigo-600" />;
      case "telegram":
        return <Send className="w-5 h-5 text-sky-500" />;
      case "whatsapp":
        return <MessageSquare className="w-5 h-5 text-emerald-600" />;
      case "email":
        return <Mail className="w-5 h-5 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-4" data-testid="channel-preferences-container">
      <div>
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <span>Delivery Channels & Frequency</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {preferredChannels.length} active
          </span>
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Select all channels where you want to receive timely examination alerts and deadline reminders.
        </p>
      </div>

      {errors.preferredChannels && (
        <p className="text-xs text-red-600 font-medium" role="alert">
          {errors.preferredChannels[0]}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {CHANNELS_CONFIG.map((channel) => {
          const isEnabled = preferredChannels.includes(channel.id);

          return (
            <div
              key={channel.id}
              className={`rounded-xl border p-4 transition-all duration-150 ${
                isEnabled
                  ? "border-purple-300 bg-purple-50/40 shadow-xs"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isEnabled ? "bg-white shadow-2xs" : "bg-gray-100"
                    }`}
                  >
                    {renderIcon(channel.id)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {channel.label}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-700">
                        {channel.badgeText}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {channel.description}
                    </p>
                  </div>
                </div>

                <label
                  htmlFor={`toggle-${channel.id}`}
                  className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5"
                >
                  <input
                    type="checkbox"
                    id={`toggle-${channel.id}`}
                    checked={isEnabled}
                    onChange={() => toggleChannel(channel.id)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                </label>
              </div>

              {/* Extra input for Telegram */}
              {channel.id === "telegram" && isEnabled && (
                <div className="mt-3.5 pt-3 border-t border-purple-100/80 space-y-3">
                  {telegramChatId ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-sky-900 dark:text-sky-200">
                            Telegram Account Connected
                          </p>
                          <p className="text-[11px] text-sky-700 dark:text-sky-400">
                            Chat ID: {telegramChatId}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isDisconnecting}
                        onClick={handleDisconnectTelegram}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:underline disabled:opacity-50"
                      >
                        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {connectUrl && (
                        <a
                          href={connectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-xl shadow-xs transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>1-Click Connect to @UpaguruBot</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Info className="w-3 h-3 text-sky-500 flex-shrink-0" />
                        <span>
                          Click above to launch @UpaguruBot. It will automatically bind your account and enable instant recruitment alerts.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Fallback Manual Chat ID input */}
                  <div>
                    <label
                      htmlFor="input-telegram-chat-id"
                      className="block text-[11px] font-semibold text-gray-600"
                    >
                      Or enter Chat ID manually:
                    </label>
                    <div className="mt-1 relative rounded-md shadow-2xs">
                      <input
                        type="text"
                        id="input-telegram-chat-id"
                        value={telegramChatId}
                        onChange={(e) => onTelegramChatIdChange(e.target.value)}
                        placeholder="e.g. 123456789"
                        className="block w-full text-xs rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white"
                      />
                    </div>
                  </div>

                  {errors.telegramChatId && (
                    <p className="text-xs text-red-600 mt-1 font-medium" role="alert">
                      {errors.telegramChatId[0]}
                    </p>
                  )}
                </div>
              )}

              {/* Extra input for WhatsApp */}
              {channel.id === "whatsapp" && isEnabled && (
                <div className="mt-3.5 pt-3 border-t border-purple-100/80">
                  <label
                    htmlFor="input-whatsapp-phone"
                    className="block text-xs font-semibold text-gray-700"
                  >
                    WhatsApp Mobile Number
                  </label>
                  <div className="mt-1 relative rounded-md shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="tel"
                      id="input-whatsapp-phone"
                      value={whatsappPhoneNumber}
                      onChange={(e) => onWhatsappPhoneNumberChange(e.target.value)}
                      placeholder={channel.inputPlaceholder}
                      className="block w-full text-xs rounded-lg border border-gray-300 pl-8 pr-3 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
                    <Info className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>{channel.inputHelpText}</span>
                  </div>
                  {errors.whatsappPhoneNumber && (
                    <p className="text-xs text-red-600 mt-1 font-medium" role="alert">
                      {errors.whatsappPhoneNumber[0]}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
