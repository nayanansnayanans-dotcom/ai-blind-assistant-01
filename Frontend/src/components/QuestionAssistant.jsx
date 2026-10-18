import React, { useState } from 'react';
import { saveQuestion } from '../services/api';

export default function QuestionAssistant() {
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!questionText || !answerText) {
      setStatusMessage('Please fill in both fields.');
      return;
    }

    try {
      await saveQuestion({
        questionText,
        answerText,
        category: 'exam',
        language: 'en'
      });
      setStatusMessage('Question and answer successfully saved to database!');
      setQuestionText('');
      setAnswerText('');
    } catch (err) {
      setStatusMessage('Error saving to database. Please try again.');
    }
  };

  return (
    <div className="container mt-4">
      <h2>Exam Assistant - Log Interaction</h2>
      <form onSubmit={handleSubmit} className="mt-3">
        <div className="mb-3">
          <label htmlFor="question" className="form-label">Question Asked:</label>
          <input
            type="text"
            id="question"
            className="form-control"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="answer" className="form-label">Assistant Response:</label>
          <textarea
            id="answer"
            className="form-control"
            rows="3"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-success">Save Interaction</button>
      </form>
      {statusMessage && <p className="mt-3 text-info" aria-live="polite">{statusMessage}</p>}
    </div>
  );
}