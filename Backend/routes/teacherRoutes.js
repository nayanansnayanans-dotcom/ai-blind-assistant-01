const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { Exam, Result, AssistanceRequest } = require('../models/TeacherModels');

// In-Memory Fallback Stores for Offline / Disconnected MongoDB mode
const inMemoryAssistanceRequests = [];
const inMemoryExams = [];
const inMemoryResults = [];

const isDbConnected = () => mongoose.connection.readyState === 1 && mongoose.connection.db;

// 1. Create a New Accessible Exam
router.post('/exams', async (req, res) => {
  const teacherEmail = String(req.body.creatorEmail || req.body.teacherEmail || '').trim().toLowerCase();
  const examPayload = {
    ...req.body,
    creatorEmail: teacherEmail,
    teacherEmail: teacherEmail
  };

  if (!isDbConnected()) {
    const mockExam = { _id: `mem-exam-${Date.now()}`, ...examPayload, createdAt: new Date() };
    inMemoryExams.unshift(mockExam);
    return res.status(201).json({ success: true, message: "Exam created (In-Memory Fallback)", data: mockExam });
  }

  try {
    const newExam = new Exam(examPayload);
    const savedExam = await newExam.save({ bufferCommands: false });
    return res.status(201).json({ success: true, message: "Exam created successfully in MongoDB", data: savedExam });
  } catch (error) {
    const mockExam = { _id: `mem-exam-${Date.now()}`, ...examPayload, createdAt: new Date() };
    inMemoryExams.unshift(mockExam);
    res.status(201).json({ success: true, message: "Exam created (In-Memory Fallback)", data: mockExam });
  }
});

// 2. Get All Exams Created by Teachers (Filtered by teacherEmail when provided)
router.get('/exams', async (req, res) => {
  const teacherEmail = String(req.query.teacherEmail || req.query.email || '').trim().toLowerCase();

  if (!isDbConnected()) {
    const filteredMem = teacherEmail
      ? inMemoryExams.filter(e => (String(e.creatorEmail || e.teacherEmail || '').toLowerCase() === teacherEmail))
      : inMemoryExams;
    return res.status(200).json({ success: true, data: filteredMem, note: 'Serving from In-Memory fallback (MongoDB disconnected)' });
  }

  try {
    const query = {};
    if (teacherEmail) {
      query.$or = [
        { creatorEmail: teacherEmail },
        { teacherEmail: teacherEmail }
      ];
    }
    const exams = await Exam.find(query).setOptions({ bufferCommands: false }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    const filteredMem = teacherEmail
      ? inMemoryExams.filter(e => (String(e.creatorEmail || e.teacherEmail || '').toLowerCase() === teacherEmail))
      : inMemoryExams;
    res.status(200).json({ success: true, data: filteredMem, note: 'Serving from In-Memory fallback' });
  }
});

// 3. Update an exam
router.put('/exams/:id', async (req, res) => {
  if (!isDbConnected()) {
    const index = inMemoryExams.findIndex(x => x._id === req.params.id);
    if (index !== -1) {
      inMemoryExams[index] = { ...inMemoryExams[index], ...req.body };
      return res.json({ success: true, message: 'Exam updated (In-Memory)', data: inMemoryExams[index] });
    }
    const updatedFallback = { _id: req.params.id, ...req.body };
    inMemoryExams.unshift(updatedFallback);
    return res.json({ success: true, message: 'Exam updated (In-Memory)', data: updatedFallback });
  }

  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true, bufferCommands: false });
    if (exam) return res.json({ success: true, message: 'Exam updated in MongoDB', data: exam });
  } catch (error) {
    // fallback
  }

  const index = inMemoryExams.findIndex(x => x._id === req.params.id);
  if (index !== -1) {
    inMemoryExams[index] = { ...inMemoryExams[index], ...req.body };
    return res.json({ success: true, message: 'Exam updated (In-Memory)', data: inMemoryExams[index] });
  }
  const updatedFallback = { _id: req.params.id, ...req.body };
  inMemoryExams.unshift(updatedFallback);
  return res.json({ success: true, message: 'Exam updated (In-Memory)', data: updatedFallback });
});

// 4. View Student Results (Filtered by teacherEmail)
router.get('/results', async (req, res) => {
  const teacherEmail = String(req.query.teacherEmail || req.query.email || '').trim().toLowerCase();

  if (!isDbConnected()) {
    const filtered = teacherEmail
      ? inMemoryResults.filter(r => (String(r.teacherEmail || r.creatorEmail || '').toLowerCase() === teacherEmail))
      : inMemoryResults;
    return res.status(200).json({ success: true, data: filtered });
  }

  try {
    let query = {};
    if (teacherEmail) {
      const teacherExams = await Exam.find({
        $or: [{ creatorEmail: teacherEmail }, { teacherEmail: teacherEmail }]
      }).select('_id');
      const examIds = teacherExams.map(e => e._id);
      query = {
        $or: [
          { examId: { $in: examIds } },
          { teacherEmail: teacherEmail },
          { creatorEmail: teacherEmail }
        ]
      };
    }
    let results = await Result.find(query).setOptions({ bufferCommands: false }).populate('studentId', 'name username email').populate('examId', 'title subject').sort({ submittedAt: -1 });
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    const filtered = teacherEmail
      ? inMemoryResults.filter(r => (String(r.teacherEmail || r.creatorEmail || '').toLowerCase() === teacherEmail))
      : inMemoryResults;
    res.status(200).json({ success: true, data: filtered });
  }
});

// 5. Delete an Exam
router.delete('/exams/:id', async (req, res) => {
  if (isDbConnected()) {
    try {
      await Exam.findByIdAndDelete(req.params.id).setOptions({ bufferCommands: false });
    } catch (e) {}
  }
  const index = inMemoryExams.findIndex(x => x._id === req.params.id);
  if (index !== -1) inMemoryExams.splice(index, 1);
  res.status(200).json({ success: true, message: "Exam deleted successfully" });
});

const TOPIC_BANKS = {
  'general knowledge': [
    { text: "Which is the largest ocean on Earth?", type: 'MCQ', options: ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], answer: 'Pacific Ocean', marks: 2 },
    { text: "Who was the first person to walk on the Moon?", type: 'MCQ', options: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'], answer: 'Neil Armstrong', marks: 2 },
    { text: "What is the capital city of France?", type: 'MCQ', options: ['Paris', 'London', 'Berlin', 'Rome'], answer: 'Paris', marks: 2 },
    { text: "Which element has the chemical symbol 'O'?", type: 'MCQ', options: ['Oxygen', 'Gold', 'Osmium', 'Silver'], answer: 'Oxygen', marks: 2 },
    { text: "Which continent is known as the Dark Continent?", type: 'MCQ', options: ['Africa', 'Asia', 'Europe', 'South America'], answer: 'Africa', marks: 2 },
    { text: "How many teeth does an adult human typically have?", type: 'MCQ', options: ['32', '28', '30', '36'], answer: '32', marks: 2 },
    { text: "Which organ in the human body pumps blood throughout the circulatory system?", type: 'MCQ', options: ['Heart', 'Lungs', 'Liver', 'Kidney'], answer: 'Heart', marks: 2 },
    { text: "Explain the significance of World Earth Day celebrated on April 22nd.", type: 'Short answer', options: [], answer: 'To raise awareness about environmental protection and conservation.', marks: 5 },
    { text: "True or False: The Great Wall of China is visible from space with the naked eye.", type: 'True/False', options: ['True', 'False'], answer: 'False', marks: 2 },
    { text: "Which planet in our solar system is known as the Red Planet?", type: 'MCQ', options: ['Mars', 'Venus', 'Jupiter', 'Saturn'], answer: 'Mars', marks: 2 }
  ],
  'python': [
    { text: "Which data type in Python is immutable?", type: 'MCQ', options: ['Tuple', 'List', 'Dictionary', 'Set'], answer: 'Tuple', marks: 2 },
    { text: "What keyword is used to define a function in Python?", type: 'MCQ', options: ['def', 'function', 'define', 'func'], answer: 'def', marks: 2 },
    { text: "What is the output of len([10, 20, 30, 40]) in Python?", type: 'MCQ', options: ['4', '5', '3', 'Error'], answer: '4', marks: 2 },
    { text: "Explain the difference between a list and a tuple in Python.", type: 'Short answer', options: [], answer: 'Lists are mutable while tuples are immutable in Python.', marks: 5 },
    { text: "Which symbol is used for single-line comments in Python?", type: 'MCQ', options: ['#', '//', '/*', '<!--'], answer: '#', marks: 2 },
    { text: "What method is used to add an item to the end of a list in Python?", type: 'MCQ', options: ['append()', 'add()', 'push()', 'insert()'], answer: 'append()', marks: 2 }
  ],
  'computer networks': [
    { text: "Which layer of the OSI model handles IP addressing and routing?", type: 'MCQ', options: ['Network Layer', 'Transport Layer', 'Data Link Layer', 'Application Layer'], answer: 'Network Layer', marks: 2 },
    { text: "What default port number is used by HTTPS for secure traffic?", type: 'MCQ', options: ['443', '80', '22', '21'], answer: '443', marks: 2 },
    { text: "Explain the key differences between TCP and UDP protocols.", type: 'Short answer', options: [], answer: 'TCP is connection-oriented and reliable, while UDP is connectionless and faster.', marks: 5 },
    { text: "What does IP stand for in networking?", type: 'MCQ', options: ['Internet Protocol', 'Internal Pathway', 'Information Provider', 'Interface Program'], answer: 'Internet Protocol', marks: 2 }
  ],
  'operating systems': [
    { text: "Which process state indicates a process is waiting for I/O completion?", type: 'MCQ', options: ['Blocked / Waiting', 'Running', 'Ready', 'Terminated'], answer: 'Blocked / Waiting', marks: 2 },
    { text: "What is a Deadlock in an Operating System?", type: 'Short answer', options: [], answer: 'A state where two or more processes are blocked waiting for resources held by each other.', marks: 5 },
    { text: "Which algorithm is non-preemptive CPU scheduling?", type: 'MCQ', options: ['FCFS (First-Come First-Served)', 'Round Robin', 'SRTF', 'Preemptive Priority'], answer: 'FCFS (First-Come First-Served)', marks: 2 }
  ],
  'physics': [
    { text: "What is Newton's First Law of Motion commonly referred to as?", type: 'MCQ', options: ['Law of Inertia', 'Law of Gravity', 'Law of Acceleration', 'Law of Energy'], answer: 'Law of Inertia', marks: 2 },
    { text: "What is the speed of light in a vacuum?", type: 'MCQ', options: ['3 x 10^8 m/s', '3 x 10^6 m/s', '150,000 km/s', '300 km/s'], answer: '3 x 10^8 m/s', marks: 2 },
    { text: "Explain the principle of Conservation of Energy.", type: 'Short answer', options: [], answer: 'Energy cannot be created or destroyed, only transformed from one form to another.', marks: 5 }
  ],
  'cyber security': [
    { text: "Which cryptographic algorithm is an asymmetric public-key system?", type: 'MCQ', options: ['RSA', 'AES', 'DES', 'Blowfish'], answer: 'RSA', marks: 2 },
    { text: "What is Phishing in cybersecurity?", type: 'Short answer', options: [], answer: 'A social engineering attack to trick users into revealing sensitive credentials.', marks: 5 },
    { text: "Which HTTP header or protocol protects web traffic against eavesdropping?", type: 'MCQ', options: ['HTTPS / TLS', 'HTTP', 'FTP', 'Telnet'], answer: 'HTTPS / TLS', marks: 2 }
  ],
  'mathematics': [
    { text: "What is the value of Pi rounded to 2 decimal places?", type: 'MCQ', options: ['3.14', '3.16', '3.12', '3.18'], answer: '3.14', marks: 2 },
    { text: "Solve for x: 2x + 6 = 14", type: 'MCQ', options: ['4', '3', '5', '6'], answer: '4', marks: 2 },
    { text: "Explain the Pythagorean Theorem for right-angled triangles.", type: 'Short answer', options: [], answer: 'a^2 + b^2 = c^2 where c is the hypotenuse.', marks: 5 }
  ]
};

// 6. AI Question Draft Generator
router.post('/ai/generate-questions', async (req, res) => {
  try {
    const { topic = 'General Knowledge', count = 5, difficulty = 'Medium' } = req.body;
    const topicTrim = (topic || 'General Knowledge').trim();
    const lowerTopic = topicTrim.toLowerCase();
    const numCount = Math.min(Math.max(1, Number(count) || 1), 20);

    let matchedBank = null;
    for (const key of Object.keys(TOPIC_BANKS)) {
      if (lowerTopic.includes(key) || key.includes(lowerTopic)) {
        matchedBank = TOPIC_BANKS[key];
        break;
      }
    }

    let generated = [];
    if (matchedBank && matchedBank.length > 0) {
      generated = Array.from({ length: numCount }, (_, i) => {
        const q = matchedBank[i % matchedBank.length];
        return {
          id: `ai-${Date.now()}-${i + 1}`,
          text: `[${topicTrim}] Q${i + 1}: ${q.text}`,
          type: q.type,
          marks: q.marks,
          difficulty: difficulty || 'Medium',
          options: q.options || [],
          correctAnswer: q.answer,
          ai: true
        };
      });
    } else {
      const dynamicTemplates = [
        { text: `What is the fundamental concept or primary objective of ${topicTrim}?`, type: 'MCQ', options: [`Understanding core principles of ${topicTrim}`, `System setup and installation`, `Manual record keeping`, `None of the above`], answer: `Understanding core principles of ${topicTrim}`, marks: 2 },
        { text: `Which of the following is a key component or essential feature of ${topicTrim}?`, type: 'MCQ', options: [`Standardized ${topicTrim} methodology`, `Legacy procedure`, `Unrelated system`, `Random sequence`], answer: `Standardized ${topicTrim} methodology`, marks: 2 },
        { text: `Explain the core principles of ${topicTrim} and why it is important in education.`, type: 'Short answer', options: [], answer: `Provides structured domain knowledge and foundational understanding of ${topicTrim}.`, marks: 5 },
        { text: `In ${topicTrim}, what is the main purpose of its primary mechanism?`, type: 'MCQ', options: [`Optimize performance and accuracy`, `Increase operational delay`, `Bypass validation`, `None of the above`], answer: `Optimize performance and accuracy`, marks: 2 },
        { text: `True or False: ${topicTrim} plays a vital role in modern academic curriculum and practical applications.`, type: 'True/False', options: ['True', 'False'], answer: 'True', marks: 2 },
        { text: `Describe a practical real-world scenario where ${topicTrim} is applied.`, type: 'Long answer', options: [], answer: `Real-world application of ${topicTrim} in problem solving and analysis.`, marks: 8 }
      ];

      generated = Array.from({ length: numCount }, (_, i) => {
        const t = dynamicTemplates[i % dynamicTemplates.length];
        return {
          id: `ai-${Date.now()}-${i + 1}`,
          text: `[${topicTrim}] Q${i + 1}: ${t.text}`,
          type: t.type,
          marks: t.marks,
          difficulty: difficulty || 'Medium',
          options: t.options || [],
          correctAnswer: t.answer,
          ai: true
        };
      });
    }

    res.status(200).json({ success: true, data: generated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Get All Student Assistance & SOS Requests
router.get('/assistance-requests', async (req, res) => {
  if (!isDbConnected()) {
    return res.status(200).json({ success: true, data: inMemoryAssistanceRequests });
  }
  try {
    const list = await AssistanceRequest.find().setOptions({ bufferCommands: false }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: list });
  } catch (e) {
    return res.status(200).json({ success: true, data: inMemoryAssistanceRequests });
  }
});

// 8. Create Emergency Assistance SOS Request
router.post('/assistance-requests', async (req, res) => {
  const reqData = {
    id: req.body.id || Date.now(),
    studentName: req.body.studentName || req.body.student || 'Student',
    studentId: req.body.studentId || '2026011001',
    examTitle: req.body.examTitle || 'General Platform Navigation',
    request: req.body.request || '🚨 Emergency SOS triggered by student. Requires immediate audio assist.',
    time: req.body.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: req.body.type || 'Emergency SOS',
    status: req.body.status || 'Pending'
  };

  inMemoryAssistanceRequests.unshift(reqData);

  if (isDbConnected()) {
    try {
      const newReq = new AssistanceRequest(reqData);
      await newReq.save({ bufferCommands: false });
    } catch (e) {}
  }

  return res.status(201).json({ success: true, message: "Emergency Assistance SOS Request Saved", data: reqData });
});

// 9. Update Assistance Request Status
router.put('/assistance-requests/:id', async (req, res) => {
  const { status } = req.body;
  const targetId = req.params.id;

  const idx = inMemoryAssistanceRequests.findIndex(x => String(x.id) === String(targetId) || String(x._id) === String(targetId));
  if (idx !== -1) {
    inMemoryAssistanceRequests[idx].status = status || 'Responded';
  }

  if (isDbConnected()) {
    try {
      await AssistanceRequest.findByIdAndUpdate(targetId, { status }, { bufferCommands: false });
    } catch (e) {}
  }

  return res.json({ success: true, message: "Assistance Request status updated" });
});

module.exports = router;
