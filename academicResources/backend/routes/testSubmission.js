import express from "express";
import Result from "../models/Result.js";
import Question from "../models/Question.js";
import Test from "../models/Test.js";
import { verifyToken, verifyAdmin, validateObjectId } from "../middleware/auth.js";

const router = express.Router();

router.post("/submit/:testId", verifyToken, validateObjectId('testId'), async (req, res) => {
  try {
    const { testId } = req.params;
    const { answers, questionTimings } = req.body;
    const userId = req.userId;

    const test = await Test.findById(testId);

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    const now = new Date();

    const isScheduledTest = test.startTime && test.endTime;

    if (isScheduledTest) {
      if (now < new Date(test.startTime)) {
        return res.status(403).json({ message: "This test has not started yet" });
      }
      if (now > new Date(test.endTime)) {
        return res.status(403).json({ message: "This test has ended" });
      }
    }

    /* Block re-attempt unless teacher explicitly unlocked it */
    const existingBlocked = await Result.findOne({ userId, testId, reattemptAllowed: false });
    if (existingBlocked) {
      return res.status(409).json({ message: "You have already attempted this test" });
    }

    const questions = await Question.find({ testId });

    let score = 0;
    const detailedAnswers = {};

    questions.forEach(q => {
      const given = answers[q._id.toString()];
      if (given === q.answer) score++;
      detailedAnswers[q._id.toString()] = {
        given,
        correct: given === q.answer,
        correctAnswer: q.answer,
        explanation: q.explanation || "",
      };
    });

    const result = new Result({
      userId,
      testId,
      score,
      total: questions.length,
      answers,
      questionTimings: questionTimings && typeof questionTimings === 'object' ? questionTimings : {},
    });

    await result.save();

    res.json({
      score,
      total: questions.length,
      resultId: result._id,
      detailedAnswers,
    });

  } catch (error) {
    console.error('[submit test]', error.message);
    res.status(500).json({ message: "Failed to submit test" });
  }
});

// User's test history — last 10 attempts (private + public)
router.get("/history", verifyToken, async (req, res) => {
  try {
    const results = await Result.find({ userId: req.userId })
      .populate("testId", "title category subject startTime endTime duration shareCode isPublic publishStatus")
      .sort({ submittedAt: -1 })
      .limit(10);
    res.json(results);
  } catch (error) {
    console.error('[test history]', error.message);
    res.status(500).json({ message: "Failed to fetch test history" });
  }
});

// User's own attempted tests
router.get("/my-results/:userId", verifyToken, async (req, res) => {
  try {
    if (req.params.userId !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const results = await Result.find({ userId: req.params.userId })
      .populate("testId", "title category subject startTime endTime duration")
      .sort({ submittedAt: -1 });

    res.json(results);
  } catch (error) {
    console.error('[user results]', error.message);
    res.status(500).json({ message: "Failed to fetch user results" });
  }
});

// Admin can see results of a test
router.get("/results/:testId", verifyAdmin, async (req, res) => {
  try {
    const results = await Result.find({ testId: req.params.testId })
      .populate("userId", "name email")
      .populate("testId", "title category subject duration startTime endTime")
      .sort({ submittedAt: -1 });

    res.json(results);
  } catch (error) {
    console.error('[test results]', error.message);
    res.status(500).json({ message: "Failed to fetch test results" });
  }
});

// Public leaderboard — anyone with the share code can view all results
router.get("/leaderboard/:shareCode", async (req, res) => {
  try {
    const test = await Test.findOne({ shareCode: req.params.shareCode });
    if (!test) {
      return res.status(404).json({ message: "No test found with that code. Please check and try again." });
    }

    const results = await Result.find({ testId: test._id })
      .populate("userId", "name avatar")
      .sort({ score: -1, submittedAt: 1 }); // highest score first; earliest submission wins tie

    const maskName = (name = "") => {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      return parts[0] + " " + parts.slice(1).map(p => p[0] + ".").join(" ");
    };

    const leaderboard = results.map((r, idx) => ({
      rank:        idx + 1,
      userId:      r.userId?._id?.toString() || "",
      name:        maskName(r.userId?.name || "Unknown"),
      avatar:      r.userId?.avatar || null,
      score:       r.score,
      total:       r.total,
      pct:         r.total ? Math.round((r.score / r.total) * 100) : 0,
      submittedAt: r.submittedAt,
    }));

    res.json({
      test: {
        title:      test.title,
        subject:    test.subject,
        category:   test.category,
        duration:   test.duration,
        startTime:  test.startTime,
        endTime:    test.endTime,
        shareCode:  test.shareCode,
      },
      leaderboard,
      totalAttempts: results.length,
    });
  } catch (error) {
    console.error('[leaderboard]', error.message);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

export default router;