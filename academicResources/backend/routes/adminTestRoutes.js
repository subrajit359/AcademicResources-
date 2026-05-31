import express from "express";
import Test from "../models/Test.js";
import Question from "../models/Question.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import { verifyAdmin, validateObjectId } from "../middleware/auth.js";
import { sendNotification } from "../index.js";

const router = express.Router();

// Create new test — admin only
router.post("/create", verifyAdmin, async (req, res) => {
  try {
    const { title, description, category, subject, duration, startTime, endTime, createdBy } = req.body;
    if (!title || !duration) return res.status(400).json({ message: "title and duration are required" });
    const test = new Test({
      title, description,
      category: category || "CSE",
      subject: subject || "",
      duration,
      startTime: startTime || null,
      endTime: endTime || null,
      createdBy: createdBy || req.userId,
    });
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    console.error('[admin create test]', error.message);
    res.status(500).json({ message: "Failed to create test" });
  }
});

// Get all tests — enriched with creator info, question counts, attempt counts — paginated
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const query = {};
    if (req.query.category) query.category = req.query.category;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;

    const [tests, total, qAgg, rAgg] = await Promise.all([
      Test.find(query).populate("teacherId", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
      Test.countDocuments(query),
      Question.aggregate([{ $group: { _id: "$testId", count: { $sum: 1 } } }]),
      Result.aggregate([{ $group: { _id: "$testId", count: { $sum: 1 } } }]),
    ]);

    const qMap = Object.fromEntries(qAgg.map(x => [x._id.toString(), x.count]));
    const rMap = Object.fromEntries(rAgg.map(x => [x._id.toString(), x.count]));

    const enriched = tests.map(t => {
      const obj = t.toObject();
      const id  = t._id.toString();
      obj.questionCount = qMap[id] || 0;
      obj.attemptCount  = rMap[id] || 0;
      return obj;
    });

    res.json({ tests: enriched, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('[admin fetch tests]', error.message);
    res.status(500).json({ message: "Failed to fetch tests" });
  }
});

// Update test — admin only
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const { title, description, category, subject, duration, startTime, endTime } = req.body;
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { title, description, category, subject, duration, startTime: startTime || null, endTime: endTime || null },
      { new: true }
    );
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to update test" });
  }
});

// Add question to a test — admin only
router.post("/:testId/question", verifyAdmin, async (req, res) => {
  try {
    const question = new Question({ ...req.body, testId: req.params.testId });
    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to add question" });
  }
});

// Get all questions of a test — requires auth; answers hidden for non-admins
router.get("/:testId/questions", verifyAdmin, async (req, res) => {
  try {
    const questions = await Question.find({ testId: req.params.testId });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch questions" });
  }
});

// Delete a single question — admin only; verifies question belongs to stated testId
router.delete("/:testId/questions/:questionId", verifyAdmin, async (req, res) => {
  try {
    const deleted = await Question.findOneAndDelete({
      _id: req.params.questionId,
      testId: req.params.testId,
    });
    if (!deleted) return res.status(404).json({ message: "Question not found" });
    res.json({ message: "Question deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question" });
  }
});

// Edit a single question — admin only; verifies question belongs to stated testId
router.put("/:testId/questions/:questionId", verifyAdmin, async (req, res) => {
  try {
    const { title, question, options, answer } = req.body;
    const q = await Question.findOneAndUpdate(
      { _id: req.params.questionId, testId: req.params.testId },
      { title: title || question, options, answer },
      { new: true }
    );
    if (!q) return res.status(404).json({ message: "Question not found" });
    res.json(q);
  } catch (error) {
    res.status(500).json({ message: "Failed to update question" });
  }
});

// Allow re-attempt — admin deletes a specific result so the student can retake
router.delete("/:testId/results/:resultId", verifyAdmin, async (req, res) => {
  try {
    const deleted = await Result.findOneAndDelete({
      _id: req.params.resultId,
      testId: req.params.testId,
    });
    if (!deleted) return res.status(404).json({ message: "Result not found" });
    res.json({ message: "Result cleared — student may now re-attempt" });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear result" });
  }
});

// Admin see results of a test — admin only
router.get("/:testId/results", verifyAdmin, async (req, res) => {
  try {
    const results = await Result.find({ testId: req.params.testId })
      .populate("userId", "name email")
      .populate("testId", "title category subject duration startTime endTime")
      .sort({ submittedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch results" });
  }
});

// Get all teacher-created tests with teacher info + question counts — admin only
router.get("/teacher-all", verifyAdmin, async (req, res) => {
  try {
    const tests = await Test.find({ teacherId: { $exists: true, $ne: null } })
      .populate("teacherId", "name email")
      .sort({ createdAt: -1 });
    const counts = await Question.aggregate([
      { $group: { _id: "$testId", count: { $sum: 1 } } }
    ]);
    const qMap = Object.fromEntries(counts.map(r => [r._id.toString(), r.count]));
    res.json(tests.map(t => ({ ...t.toObject(), questionCount: qMap[t._id.toString()] || 0 })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all publish requests — admin only
router.get("/publish-requests", verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { publishStatus: status } : { publishStatus: { $ne: 'none' } };
    const tests = await Test.find(query).populate("teacherId", "name email").sort({ updatedAt: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch publish requests" });
  }
});

// Approve a publish request — admin only
router.put("/:id/publish-approve", verifyAdmin, async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { publishStatus: 'approved', publishNote: '', isPublic: true },
      { new: true }
    ).populate("teacherId", "name email");
    if (!test) return res.status(404).json({ message: "Test not found" });

    // Notify all students about the newly published test
    const students = await User.find({ role: "student" });
    const studentMsg = `📝 New test published: "${test.title}"`;
    students.forEach(s => {
      sendNotification(s._id.toString(), studentMsg, "/test").catch(() => {});
    });

    // Notify the teacher their test was approved
    if (test.teacherId?._id) {
      sendNotification(
        test.teacherId._id.toString(),
        `✅ Your test "${test.title}" has been approved and published!`,
        "/teacher/tests"
      ).catch(() => {});
    }

    res.json(test);
  } catch (err) {
    res.status(500).json({ message: "Failed to approve" });
  }
});

// Reject a publish request — admin only
router.put("/:id/publish-reject", verifyAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { publishStatus: 'rejected', publishNote: note || '', isPublic: false },
      { new: true }
    ).populate("teacherId", "name email");
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json(test);
  } catch (err) {
    res.status(500).json({ message: "Failed to reject" });
  }
});

// Delete test and all its data — admin only
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    await Question.deleteMany({ testId: req.params.id });
    await Result.deleteMany({ testId: req.params.id });
    res.json({ message: "Test deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete test" });
  }
});

export default router;
