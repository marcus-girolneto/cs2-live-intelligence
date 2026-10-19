"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Star } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import { useMatchesApi } from "../api/context";
export function FeedbackForm() {
  const { t } = useI18n();
  const api = useMatchesApi();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function send() {
    setNotice("");
    setError("");
    try {
      await api.sendFeedback(rating, comment);
      setNotice(t("Thanks! Feedback saved."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not save feedback."));
    }
  }
  return (
    <Panel
      icon={<Star size={20} />}
      title={t("Was this analysis useful?")}
      className="flat"
    >
      <form
        className="feedback-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label>
          {t("Feedback rating")}
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          {t("Feedback comment")}
          <textarea
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button className="btn btn-ghost">{t("Send feedback")}</button>
          {notice && (
            <span role="status" className="good small">
              {notice}
            </span>
          )}
          {error && (
            <span role="alert" className="form-error">
              {error}
            </span>
          )}
        </div>
      </form>
    </Panel>
  );
}
