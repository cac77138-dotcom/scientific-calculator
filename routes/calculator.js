
const express = require("express");
const History = require("../models/History");

const router = express.Router();

// Get the latest 100 calculations
router.get("/history", async (req, res) => {
  try {
    const history = await History.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Could not load history" });
  }
});

// Save a calculation
router.post("/history", async (req, res) => {
  try {
    const { expression, result } = req.body;

    if (
      typeof expression !== "string" ||
      typeof result !== "string" ||
      !expression.trim() ||
      !result.trim() ||
      expression.length > 500 ||
      result.length > 500
    ) {
      return res.status(400).json({
        error: "Invalid expression or result"
      });
    }

    const item = await History.create({
      expression,
      result
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: "Could not save calculation" });
  }
});

// Delete one calculation
router.delete("/history/:id", async (req, res) => {
  try {
    const item = await History.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({ error: "Calculation not found" });
    }

    res.json({ message: "Calculation deleted" });
  } catch (error) {
    res.status(400).json({ error: "Invalid history ID" });
  }
});

// Delete all calculations
router.delete("/history", async (req, res) => {
  try {
    await History.deleteMany({});
    res.json({ message: "History cleared" });
  } catch (error) {
    res.status(500).json({ error: "Could not clear history" });
  }
});

module.exports = router;
