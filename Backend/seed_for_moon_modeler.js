// Backend/seed_for_moon_modeler.js
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch(e){}

require('dotenv').config();
const mongoose = require('mongoose');
const { Exam, Result, AssistanceRequest, ContactMessage } = require('./models/TeacherModels');
const PdfDocument = require('./models/PdfDocument');
const Log = require('./models/Log');
const User = require('./models/User');

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb+srv://ai-blind-assistant-01:nayanans6@cluster0.ekpioxa.mongodb.net/ai_blind_assistant?retryWrites=true&w=majority&appName=Cluster0';
  console.log('Connecting to MongoDB Atlas at:', uri.split('@')[1]);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected to MongoDB Atlas successfully.');

  const teacher = (await User.findOne({ role: 'teacher' })) || (await User.findOne());
  const student = (await User.findOne({ role: 'student' })) || (await User.findOne());

  console.log('Using Teacher ID:', teacher?._id, 'Student ID:', student?._id);

  // 1. Seed EXAMS collection with embedded QUESTIONS
  const examCount = await Exam.countDocuments();
  let examDoc;
  if (examCount === 0) {
    examDoc = await Exam.create({
      title: 'Computer Science & AI Midterm Assessment',
      subject: 'Computer Science',
      durationMinutes: 60,
      date: '2026-10-30',
      startTime: '10:00 AM',
      passingMarks: 40,
      instructions: 'Audio-guided exam with automated multi-angle proctoring. Use voice dictation or keyboard to submit answers.',
      status: 'Published',
      assignedStudents: [student ? student.email : 'student@test.com'],
      targetStudentEmail: student ? student.email : 'student@test.com',
      targetStudentName: student ? student.username : 'Nayana',
      languages: ['en', 'hi', 'kn'],
      defaultLanguage: 'en',
      createdBy: teacher ? teacher._id : new mongoose.Types.ObjectId(),
      creatorEmail: teacher ? teacher.email : 'teacher@test.com',
      teacherEmail: teacher ? teacher.email : 'teacher@test.com',
      questions: [
        {
          questionNumber: 1,
          questionText: 'What is the primary role of an Activation Function in Artificial Neural Networks?',
          questionType: 'MCQ',
          marks: 5,
          difficulty: 'Medium',
          options: [
            'A) Introduces non-linearity to learn complex patterns',
            'B) Increases computational complexity needlessly',
            'C) Decreases the number of weights to zero',
            'D) Normalizes text audio waveforms'
          ],
          correctAnswer: 'A) Introduces non-linearity to learn complex patterns'
        },
        {
          questionNumber: 2,
          questionText: 'Explain the working principle of Automated Biometric Proctoring in VisionAssist AI.',
          questionType: 'Descriptive',
          marks: 5,
          difficulty: 'Hard',
          options: [],
          correctAnswer: 'Automated Biometric Proctoring uses multi-angle face enrollment (Center, Right, Left) and continuous facial recognition to detect unauthorized persons, face absence, or camera deactivation.'
        }
      ]
    });
    console.log('✅ Created sample Exam document with 2 embedded Questions');
  } else {
    examDoc = await Exam.findOne();
    console.log('Exam collection already populated:', examDoc.title);
  }

  // 2. Seed RESULTS collection with embedded ANSWERS_LOG
  const resCount = await Result.countDocuments();
  if (resCount === 0) {
    await Result.create({
      studentId: student ? student._id : new mongoose.Types.ObjectId(),
      studentName: student ? student.username : 'Nayana',
      examId: examDoc ? examDoc._id : new mongoose.Types.ObjectId(),
      examTitle: examDoc ? examDoc.title : 'Computer Science & AI Midterm Assessment',
      examLanguage: 'en',
      score: 9,
      totalMarks: 10,
      answersLog: [
        {
          questionIndex: 0,
          questionText: 'What is the primary role of an Activation Function in Artificial Neural Networks?',
          studentAnswer: 'A) Introduces non-linearity to learn complex patterns',
          translatedAnswer: 'A) Introduces non-linearity to learn complex patterns',
          language: 'en',
          transcript: 'Option A introduces non-linearity to learn complex patterns',
          isCorrect: true
        },
        {
          questionIndex: 1,
          questionText: 'Explain the working principle of Automated Biometric Proctoring in VisionAssist AI.',
          studentAnswer: 'Multi-angle scanning with Center Right Left angles to verify student identity and lock inputs if absent.',
          translatedAnswer: 'Multi-angle scanning with Center Right Left angles to verify student identity and lock inputs if absent.',
          language: 'en',
          transcript: 'Multi-angle scanning with Center Right Left angles to verify student identity',
          isCorrect: true
        }
      ],
      submittedAt: new Date()
    });
    console.log('✅ Created sample Result document with 2 embedded AnswersLog items');
  } else {
    console.log('Result collection already has', resCount, 'documents');
  }

  // 3. Seed ASSISTANCE_REQUESTS collection
  const assistCount = await AssistanceRequest.countDocuments();
  if (assistCount === 0) {
    await AssistanceRequest.create({
      studentName: student ? student.username : 'Nayana',
      studentId: student && student.studentId ? student.studentId : '2026CS101',
      examTitle: examDoc ? examDoc.title : 'Computer Science & AI Midterm Assessment',
      request: 'Emergency SOS: Audio voice dictation guidance requested.',
      type: 'Emergency SOS',
      status: 'Resolved',
      time: '10:15 AM',
      createdAt: new Date()
    });
    console.log('✅ Created sample AssistanceRequest document');
  }

  // 4. Seed PDF_DOCUMENTS collection
  const pdfCount = await PdfDocument.countDocuments();
  if (pdfCount === 0) {
    await PdfDocument.create({
      title: 'Artificial Intelligence & Neural Networks Study Guide',
      subject: 'Computer Science',
      fileUrl: 'https://visionassist-ai.edu/materials/ai-guide.pdf',
      uploadedAt: new Date()
    });
    console.log('✅ Created sample PdfDocument document');
  }

  // 5. Seed LOGS collection
  const logCount = await Log.countDocuments();
  if (logCount === 0) {
    await Log.create({
      featureUsed: 'exam-assistance',
      status: 'success',
      details: 'Candidate Nayana completed multi-angle face verification (Center, Right, Left) and entered proctored exam.',
      timestamp: new Date()
    });
    console.log('✅ Created sample Log document');
  }

  // 6. Seed CONTACT_MESSAGES collection
  const contactCount = await ContactMessage.countDocuments();
  if (contactCount === 0) {
    await ContactMessage.create({
      name: student ? student.username : 'Nayana',
      email: student ? student.email : 'student@test.com',
      role: 'Student',
      subject: 'Exam Audio Assistance Query',
      message: 'Can I use keyboard shortcuts in addition to voice commands during the exam?',
      status: 'Resolved',
      createdAt: new Date()
    });
    console.log('✅ Created sample ContactMessage document');
  }

  const finalCollections = await mongoose.connection.db.listCollections().toArray();
  console.log('\n======================================================');
  console.log('🎉 ALL COLLECTIONS SUCCESSFULLY SEEDED IN ATLAS:');
  for (const c of finalCollections) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(`   📁 ${c.name} : ${count} documents`);
  }
  console.log('======================================================\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
